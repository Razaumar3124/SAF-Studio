"""Stored master compression (WebP <= 2 MB), EXIF removal and upload size limits."""

import io
import os

import pytest
from httpx import AsyncClient
from PIL import Image

from app.core.config import get_settings
from app.services.image_processing_service import ImageProcessingService, encode_webp_within
from tests.fakes import FakePhotoRepository, FakeR2Storage
from tests.test_photo_upload import register_test_user


def noisy_jpeg(width: int, height: int, quality: int = 92) -> bytes:
    """High-entropy photo that does not compress well (worst case for size limits)."""
    img = Image.frombytes("RGB", (width, height), os.urandom(width * height * 3))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


def jpeg_with_exif(width: int = 600, height: int = 400, orientation: int = 6) -> bytes:
    exif = Image.Exif()
    exif[0x010F] = "SpyCam Inc."  # Make
    exif[0x0110] = "Model X"  # Model
    exif[0x0112] = orientation  # Orientation: rotate 90° CW to display
    gps = exif.get_ifd(0x8825)
    gps[1] = "N"
    gps[2] = (19.0, 4.0, 30.0)
    buf = io.BytesIO()
    Image.new("RGB", (width, height), "teal").save(buf, format="JPEG", exif=exif.tobytes())
    return buf.getvalue()


def assert_no_metadata(data: bytes) -> None:
    with Image.open(io.BytesIO(data)) as img:
        assert img.format == "WEBP"
        assert "exif" not in img.info
        assert "xmp" not in img.info
        assert len(img.getexif()) == 0


@pytest.mark.asyncio
async def test_master_is_webp_within_two_megabytes():
    svc = ImageProcessingService()
    raw = noisy_jpeg(1800, 1200)
    res = await svc.process_image(raw)

    assert len(res.master_bytes) <= 2_000_000
    assert res.stored_bytes == len(res.master_bytes) + len(res.preview_bytes) + len(
        res.thumbnail_bytes
    )
    with Image.open(io.BytesIO(res.master_bytes)) as master:
        assert master.format == "WEBP"
        assert master.size == (res.natural_width, res.natural_height)
    with Image.open(io.BytesIO(res.preview_bytes)) as prev:
        assert max(prev.size) <= 1600
    with Image.open(io.BytesIO(res.thumbnail_bytes)) as thumb:
        assert max(thumb.size) <= 300


@pytest.mark.asyncio
async def test_master_quality_ladder_and_downscale_honour_limit(monkeypatch):
    """With a tight limit the encoder steps quality down, then shrinks, until it fits."""
    monkeypatch.setattr(get_settings(), "PHOTO_MASTER_MAX_BYTES", 60_000)
    res = await ImageProcessingService().process_image(noisy_jpeg(1200, 900))
    assert len(res.master_bytes) <= 60_000
    assert res.natural_width < 1200  # had to downscale to fit
    assert res.aspect_ratio == pytest.approx(1200 / 900, rel=0.01)


@pytest.mark.asyncio
async def test_master_long_edge_is_capped(monkeypatch):
    monkeypatch.setattr(get_settings(), "PHOTO_MASTER_MAX_EDGE_PX", 1000)
    buf = io.BytesIO()
    Image.new("RGB", (3000, 1500), "navy").save(buf, format="JPEG")
    res = await ImageProcessingService().process_image(buf.getvalue())
    assert (res.natural_width, res.natural_height) == (1000, 500)
    assert res.suggested_orientation == "landscape"


@pytest.mark.asyncio
async def test_exif_and_gps_are_stripped_and_orientation_applied():
    res = await ImageProcessingService().process_image(jpeg_with_exif(600, 400, orientation=6))
    for data in (res.master_bytes, res.preview_bytes, res.thumbnail_bytes):
        assert_no_metadata(data)
    # Orientation 6 means the 600x400 sensor image displays as 400x600 portrait
    assert (res.natural_width, res.natural_height) == (400, 600)
    assert res.suggested_orientation == "portrait"


@pytest.mark.asyncio
async def test_transparent_png_keeps_alpha_in_master():
    buf = io.BytesIO()
    Image.new("RGBA", (500, 500), (255, 0, 0, 0)).save(buf, format="PNG")
    res = await ImageProcessingService().process_image(buf.getvalue())
    with Image.open(io.BytesIO(res.master_bytes)) as master:
        assert master.mode == "RGBA"


def test_encode_webp_within_never_exceeds_limit():
    img = Image.frombytes("RGB", (900, 900), os.urandom(900 * 900 * 3))
    data, size = encode_webp_within(img, max_bytes=120_000, max_edge_px=4096)
    assert len(data) <= 120_000
    assert max(size) < 900


@pytest.mark.asyncio
async def test_upload_accepts_up_to_15_mb_and_stores_compressed_master(
    client: AsyncClient,
    fake_r2_storage: FakeR2Storage,
    fake_photo_repo: FakePhotoRepository,
):
    _, token = await register_test_user(client, "bigphoto@example.com")
    raw = noisy_jpeg(2400, 1800, quality=95)
    assert len(raw) > 2_000_000  # larger than the stored limit
    resp = await client.post(
        "/api/v1/photos/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("big.jpg", raw, "image/jpeg")},
    )
    assert resp.status_code == 201, resp.text
    photo = await fake_photo_repo.get_by_id(resp.json()["id"])
    master, content_type, _ = fake_r2_storage.objects[photo.storage_key]
    assert photo.storage_key.endswith("/master.webp")
    assert content_type == "image/webp"
    assert len(master) <= 2_000_000
    assert photo.stored_bytes == sum(photo.variant_bytes.values())
    assert photo.mime_type == "image/jpeg"  # describes what the customer uploaded


@pytest.mark.asyncio
async def test_upload_over_15_mb_rejected_before_processing(client: AsyncClient):
    _, token = await register_test_user(client, "toolarge@example.com")
    huge = b"\xff\xd8\xff" + b"\x00" * (15 * 1024 * 1024 + 10)
    resp = await client.post(
        "/api/v1/photos/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("huge.jpg", huge, "image/jpeg")},
    )
    assert resp.status_code == 422
    assert "larger than 15 MB" in resp.json()["error"]["message"]


def test_upload_limit_cannot_be_configured_above_15_mb():
    from pydantic import ValidationError

    from app.core.config import Settings

    with pytest.raises(ValidationError):
        Settings(PHOTO_MAX_UPLOAD_MB=25)
