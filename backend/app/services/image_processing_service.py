import asyncio
import hashlib
import io
import logging
import warnings
from dataclasses import dataclass

from PIL import Image, ImageOps

from app.core.config import get_settings
from app.core.exceptions import ValidationException

logger = logging.getLogger("saf_studio.image_processing")

# Guard against decompression bomb attacks (100 megapixels max)
Image.MAX_IMAGE_PIXELS = 100_000_000

# Magic byte signatures for supported photo formats
MAGIC_SIGNATURES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],  # With 'WEBP' at index 8
}


# WebP quality ladder tried (in order) before the image is downscaled further.
_QUALITY_LADDER = (82, 75, 68, 60)
_DOWNSCALE_STEP = 0.8
_MIN_ENCODE_EDGE_PX = 400

PREVIEW_EDGE_PX = 1600
PREVIEW_QUALITY = 80
THUMBNAIL_EDGE_PX = 300
THUMBNAIL_QUALITY = 78


@dataclass
class ProcessedImageResult:
    """Output container for validated and processed image artifacts.

    `natural_width`/`natural_height` describe the stored master (what will be printed), after
    EXIF rotation and any downscaling. `mime_type` and `file_size_bytes` describe the upload.
    """

    natural_width: int
    natural_height: int
    aspect_ratio: float
    suggested_orientation: str
    mime_type: str
    file_size_bytes: int
    content_hash: str
    master_bytes: bytes
    preview_bytes: bytes
    thumbnail_bytes: bytes

    @property
    def stored_bytes(self) -> int:
        """Total bytes this photo occupies in object storage (master + preview + thumbnail)."""
        return len(self.master_bytes) + len(self.preview_bytes) + len(self.thumbnail_bytes)


def compute_content_hash(data: bytes) -> str:
    """SHA-256 of the uploaded bytes, used for per-user duplicate detection."""
    return hashlib.sha256(data).hexdigest()


def _webp_bytes(img: Image.Image, quality: int, icc_profile: bytes | None) -> bytes:
    """Encode to WebP. EXIF/XMP are never passed to the encoder, so they are stripped
    (camera serials, GPS location); only the ICC colour profile is kept for print fidelity."""
    buf = io.BytesIO()
    kwargs: dict = {"format": "WEBP", "quality": quality, "method": 4}
    if icc_profile:
        kwargs["icc_profile"] = icc_profile
    img.save(buf, **kwargs)
    return buf.getvalue()


def encode_webp_within(
    img: Image.Image,
    max_bytes: int,
    max_edge_px: int,
    icc_profile: bytes | None = None,
) -> tuple[bytes, tuple[int, int]]:
    """Encode `img` as WebP no larger than `max_bytes` and no longer than `max_edge_px`.

    Tries a descending quality ladder at the current size, then downscales by 20 % and repeats.
    Returns the encoded bytes and the final pixel size.
    """
    current = img
    if max(current.size) > max_edge_px:
        current = current.copy()
        current.thumbnail((max_edge_px, max_edge_px), Image.Resampling.LANCZOS)

    while True:
        data = b""
        for quality in _QUALITY_LADDER:
            data = _webp_bytes(current, quality, icc_profile)
            if len(data) <= max_bytes:
                return data, current.size
        w, h = current.size
        if max(w, h) <= _MIN_ENCODE_EDGE_PX:
            # Practically unreachable (a 400 px WebP is a few dozen KB); never exceed the limit.
            raise ValidationException(
                message="We couldn't compress that image enough to store it.",
                details=[{"field": "file", "issue": "Image could not be compressed within limit"}],
            )
        current = current.resize(
            (max(1, int(w * _DOWNSCALE_STEP)), max(1, int(h * _DOWNSCALE_STEP))),
            Image.Resampling.LANCZOS,
        )


class ImageProcessingService:
    """Service handling image format sniffing, sanitization, EXIF rotation, and WebP generation."""

    @staticmethod
    def sniff_mime_type(data: bytes) -> str | None:
        """Inspect binary file headers to safely detect actual image MIME type."""
        if len(data) < 12:
            return None

        # Check JPEG
        if data.startswith(b"\xff\xd8\xff"):
            return "image/jpeg"

        # Check PNG
        if data.startswith(b"\x89PNG\r\n\x1a\n"):
            return "image/png"

        # Check WebP (RIFF....WEBP)
        if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
            return "image/webp"

        return None

    def _sync_process(
        self,
        raw_bytes: bytes,
        declared_content_type: str | None = None,
    ) -> ProcessedImageResult:
        """Synchronous CPU-bound image verification, normalization, and optimization."""
        settings = get_settings()

        # 1. Enforce payload size limits
        file_size = len(raw_bytes)
        if file_size > settings.max_upload_bytes:
            max_mb = settings.PHOTO_MAX_UPLOAD_MB
            raise ValidationException(
                message=f"That photo is larger than {max_mb} MB. Please choose a smaller file.",
                details=[
                    {
                        "field": "file",
                        "issue": f"File size ({file_size} bytes) exceeds {max_mb} MB limit",
                    }
                ],
            )

        # 2. Validate file signature / magic bytes
        sniffed_type = self.sniff_mime_type(raw_bytes)
        if not sniffed_type:
            raise ValidationException(
                message="Please choose a JPEG, PNG or WebP photo.",
                details=[
                    {
                        "field": "file",
                        "issue": (
                            "File signature does not match supported image "
                            "formats (JPEG, PNG, WebP)"
                        ),
                    }
                ],
            )

        # 3. Open image with Pillow and verify structural integrity
        #    (decompression-bomb warnings are escalated to errors)
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(raw_bytes)) as probe:
                    probe.verify()
        except Exception as exc:
            logger.warning("Pillow verify failed: %s", exc)
            raise ValidationException(
                message=(
                    "We couldn’t read that image. It may be damaged or in an unsupported format."
                ),
                details=[{"field": "file", "issue": f"Image stream is corrupt: {exc}"}],
            ) from exc

        # 4. Re-open for transformation (after verify() the image descriptor is exhausted)
        try:
            img = Image.open(io.BytesIO(raw_bytes))
        except Exception as exc:
            raise ValidationException(
                message="We couldn’t read that image.",
                details=[{"field": "file", "issue": str(exc)}],
            ) from exc

        # 5. Apply EXIF orientation transpose (smartphone cameras, portrait modes)
        try:
            img = ImageOps.exif_transpose(img)
        except Exception as exc:
            logger.debug("EXIF transpose skipped or failed: %s", exc)

        # 6. Check natural dimensions
        width, height = img.size
        min_side = min(width, height)
        if min_side < settings.PHOTO_MIN_SIDE_PX:
            raise ValidationException(
                message=(
                    "That photo is too small to print well "
                    f"(under {settings.PHOTO_MIN_SIDE_PX} px)."
                ),
                details=[
                    {
                        "field": "file",
                        "issue": (
                            f"Shortest side {min_side}px is below "
                            f"minimum {settings.PHOTO_MIN_SIDE_PX}px"
                        ),
                    }
                ],
            )

        if width > settings.PHOTO_MAX_WIDTH_PX or height > settings.PHOTO_MAX_HEIGHT_PX:
            raise ValidationException(
                message=(
                    f"Image resolution {width}x{height} exceeds the maximum allowed limit "
                    f"of {settings.PHOTO_MAX_WIDTH_PX}x{settings.PHOTO_MAX_HEIGHT_PX} pixels."
                ),
                details=[{"field": "file", "issue": "Resolution exceeds maximum allowed bounds"}],
            )

        # Normalize color mode for WebP compatibility
        icc_profile = img.info.get("icc_profile")
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "transparency" in img.info or "A" in img.mode else "RGB")
            # A profile for the source colour space (e.g. CMYK) would be wrong after conversion.
            icc_profile = None

        # 7. Stored master: WebP, <= PHOTO_MASTER_MAX_BYTES, EXIF stripped, long edge capped
        master_bytes, (master_w, master_h) = encode_webp_within(
            img,
            max_bytes=settings.PHOTO_MASTER_MAX_BYTES,
            max_edge_px=settings.PHOTO_MASTER_MAX_EDGE_PX,
            icc_profile=icc_profile,
        )

        # 8. Calculate aspect ratio and orientation of the stored master
        aspect_ratio = round(master_w / master_h, 4)
        if master_w > master_h:
            orientation = "landscape"
        elif master_h > master_w:
            orientation = "portrait"
        else:
            orientation = "square"

        # 9. 300px thumbnail and 1600px preview (WebP, EXIF stripped)
        thumb = img.copy()
        thumb.thumbnail((THUMBNAIL_EDGE_PX, THUMBNAIL_EDGE_PX), Image.Resampling.LANCZOS)
        thumb_bytes = _webp_bytes(thumb, THUMBNAIL_QUALITY, icc_profile)

        prev = img.copy()
        prev.thumbnail((PREVIEW_EDGE_PX, PREVIEW_EDGE_PX), Image.Resampling.LANCZOS)
        prev_bytes = _webp_bytes(prev, PREVIEW_QUALITY, icc_profile)

        return ProcessedImageResult(
            natural_width=master_w,
            natural_height=master_h,
            aspect_ratio=aspect_ratio,
            suggested_orientation=orientation,
            mime_type=sniffed_type,
            file_size_bytes=file_size,
            content_hash=compute_content_hash(raw_bytes),
            master_bytes=master_bytes,
            preview_bytes=prev_bytes,
            thumbnail_bytes=thumb_bytes,
        )

    async def process_image(
        self,
        raw_bytes: bytes,
        declared_content_type: str | None = None,
    ) -> ProcessedImageResult:
        """Asynchronously process an image in a worker threadpool."""
        return await asyncio.to_thread(
            self._sync_process,
            raw_bytes,
            declared_content_type,
        )
