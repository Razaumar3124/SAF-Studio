import logging
from datetime import UTC, datetime, timedelta
from typing import Literal

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.core.config import get_settings
from app.core.exceptions import (
    ForbiddenException,
    RateLimitExceededException,
    ResourceNotFoundException,
    StorageUnavailableException,
    UserStorageQuotaExceededException,
)
from app.core.security import generate_photo_signature, verify_photo_signature
from app.models.photo import PhotoInDB
from app.repositories.photo_repository import PhotoRepository
from app.schemas.photo import (
    PhotosListResponse,
    PhotoSummaryOut,
    PhotoUploadResponse,
)
from app.services.image_processing_service import ImageProcessingService, compute_content_hash
from app.services.rate_limiter import rate_limiter
from app.services.storage_quota_service import StorageQuotaService, StorageReservation
from app.storage.r2_storage import R2Storage

logger = logging.getLogger("saf_studio.photo_service")


class PhotoService:
    """Domain business service managing photograph uploads, R2 storage, access, and deletion."""

    def __init__(
        self,
        photo_repo: PhotoRepository,
        image_service: ImageProcessingService,
        r2_storage: R2Storage,
        storage_quota: StorageQuotaService,
    ) -> None:
        self.photo_repo = photo_repo
        self.image_service = image_service
        self.r2_storage = r2_storage
        self.storage_quota = storage_quota

    def _generate_signed_urls(self, photo_id: str) -> tuple[str, str]:
        """Generate short-lived HMAC signed paths for thumbnail and preview."""
        settings = get_settings()
        expires_at = int(
            (
                datetime.now(UTC) + timedelta(seconds=settings.PHOTO_SIGNED_URL_EXPIRATION_SECONDS)
            ).timestamp()
        )
        thumb_sig = generate_photo_signature(photo_id, "thumbnail", expires_at)
        prev_sig = generate_photo_signature(photo_id, "preview", expires_at)

        thumbnail_url = f"/api/v1/photos/{photo_id}/thumbnail?sig={thumb_sig}&exp={expires_at}"
        preview_url = f"/api/v1/photos/{photo_id}/preview?sig={prev_sig}&exp={expires_at}"
        return thumbnail_url, preview_url

    async def upload_photo(
        self,
        user_id: str,
        filename: str,
        file_bytes: bytes,
        declared_content_type: str | None = None,
        client_ip: str | None = None,
    ) -> PhotoUploadResponse:
        """Process and store a user uploaded photograph in Cloudflare R2 and MongoDB."""
        settings = get_settings()

        # 1. Rate limiting on photo uploads (30 uploads / hour per user)
        rate_key = f"photo_upload:{user_id}"
        if not rate_limiter.is_allowed(
            rate_key,
            max_attempts=settings.RATE_LIMIT_PHOTO_UPLOAD_MAX_ATTEMPTS,
            window_seconds=settings.RATE_LIMIT_PHOTO_UPLOAD_WINDOW_SECONDS,
        ):
            raise RateLimitExceededException(
                "Upload rate limit exceeded. You may upload up to 30 photos per hour."
            )

        # 2. Sanitize and trim filename
        clean_filename = filename.strip()[:120] if filename else "untitled.jpg"

        # 3. Duplicate detection: identical bytes already in this user's library
        if len(file_bytes) <= settings.max_upload_bytes:
            existing = await self.photo_repo.get_active_by_content_hash(
                user_id, compute_content_hash(file_bytes)
            )
            if existing:
                logger.info("Duplicate upload for user %s matched photo %s", user_id, existing.id)
                return self._to_upload_response(existing)

        # 4. Validate, normalize and compress (WebP master <= 2 MB, preview, thumbnail)
        processed = await self.image_service.process_image(
            file_bytes,
            declared_content_type=declared_content_type,
        )

        # 5. Per-user library limit (stored bytes of active photos)
        limit_bytes = settings.user_photo_storage_limit_bytes
        used_bytes = await self.photo_repo.sum_active_storage_bytes(user_id)
        if used_bytes + processed.stored_bytes > limit_bytes:
            raise UserStorageQuotaExceededException(settings.USER_PHOTO_STORAGE_LIMIT_MB)

        # 6. Reserve global R2 capacity before writing anything (9.9 GB hard cap)
        reservation = await self.storage_quota.reserve(processed.stored_bytes)

        # 7. Persistent storage keys with secure random ObjectId
        photo_id = str(ObjectId())
        master_key = f"users/{user_id}/photos/{photo_id}/master.webp"
        prev_key = f"users/{user_id}/photos/{photo_id}/preview.webp"
        thumb_key = f"users/{user_id}/photos/{photo_id}/thumbnail.webp"
        variants = [
            (master_key, processed.master_bytes, "master"),
            (prev_key, processed.preview_bytes, "preview"),
            (thumb_key, processed.thumbnail_bytes, "thumbnail"),
        ]

        uploaded_keys: list[str] = []
        try:
            for key, data, kind in variants:
                await self.r2_storage.put_object(
                    key=key,
                    data=data,
                    content_type="image/webp",
                    metadata={"user_id": user_id, "photo_id": photo_id, "type": kind},
                )
                uploaded_keys.append(key)
        except Exception as exc:
            logger.error("R2 upload failure, rolling back uploaded objects: %s", exc)
            await self._rollback(uploaded_keys, reservation)
            raise StorageUnavailableException(
                issue="Failed to store photograph in Cloudflare R2"
            ) from exc

        # 8. Save photograph metadata document in MongoDB
        now = datetime.now(UTC)
        photo_doc = PhotoInDB(
            id=photo_id,
            user_id=user_id,
            original_filename=clean_filename,
            storage_key=master_key,
            thumbnail_key=thumb_key,
            preview_key=prev_key,
            storage_provider="cloudflare_r2",
            bucket=self.r2_storage.bucket_name,
            mime_type=processed.mime_type,
            file_size_bytes=processed.file_size_bytes,
            width_px=processed.natural_width,
            height_px=processed.natural_height,
            aspect_ratio=processed.aspect_ratio,
            suggested_orientation=processed.suggested_orientation,
            content_hash=processed.content_hash,
            stored_bytes=processed.stored_bytes,
            variant_bytes={kind: len(data) for _, data, kind in variants},
            status="ready",
            is_deleted=False,
            created_at=now,
            updated_at=now,
        )

        try:
            await self.photo_repo.create(photo_doc)
        except DuplicateKeyError:
            # A concurrent identical upload won the race: keep that one, discard ours.
            await self._rollback(uploaded_keys, reservation)
            existing = await self.photo_repo.get_active_by_content_hash(
                user_id, processed.content_hash
            )
            if existing:
                return self._to_upload_response(existing)
            raise
        except Exception as exc:
            logger.error("MongoDB metadata persistence failed, rolling back R2 objects: %s", exc)
            await self._rollback(uploaded_keys, reservation)
            raise

        await self.storage_quota.commit(reservation)
        return self._to_upload_response(photo_doc)

    async def _rollback(self, uploaded_keys: list[str], reservation: StorageReservation) -> None:
        """Remove partially written objects and return the reserved capacity.

        Objects that cannot be deleted stay accounted as used (no Mongo document references
        them, so the maintenance job deletes them later and frees their bytes then).
        """
        failed = await self.r2_storage.delete_objects(uploaded_keys) if uploaded_keys else []
        if failed:
            await self.storage_quota.commit(reservation)
        else:
            await self.storage_quota.release(reservation)

    def _to_upload_response(self, photo: PhotoInDB) -> PhotoUploadResponse:
        """Build the upload response with fresh short-lived signed media URLs."""
        thumbnail_url, preview_url = self._generate_signed_urls(str(photo.id))
        return PhotoUploadResponse(
            id=str(photo.id),
            user_id=str(photo.user_id),
            original_filename=photo.original_filename,
            file_size_bytes=photo.file_size_bytes,
            mime_type=photo.mime_type,
            width_px=photo.width_px,
            height_px=photo.height_px,
            aspect_ratio=photo.aspect_ratio,
            suggested_orientation=photo.suggested_orientation,
            thumbnail_url=thumbnail_url,
            preview_url=preview_url,
            created_at=photo.created_at.isoformat(),
        )

    async def list_user_photos(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 50,
    ) -> PhotosListResponse:
        """List authenticated user's uploaded photographs."""
        photos, total = await self.photo_repo.list_by_user(
            user_id=user_id,
            page=page,
            page_size=page_size,
        )

        items: list[PhotoSummaryOut] = []
        for p in photos:
            thumb_url, _ = self._generate_signed_urls(p.id)
            items.append(
                PhotoSummaryOut(
                    id=p.id,
                    original_filename=p.original_filename,
                    width_px=p.width_px,
                    height_px=p.height_px,
                    aspect_ratio=p.aspect_ratio,
                    thumbnail_url=thumb_url,
                    created_at=p.created_at.isoformat(),
                )
            )

        return PhotosListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get_photo_media(
        self,
        photo_id: str,
        kind: Literal["thumbnail", "preview"],
        requester_user_id: str | None = None,
        sig: str | None = None,
        exp: int | None = None,
    ) -> tuple[bytes, str]:
        """Verify access and stream photograph media from Cloudflare R2."""
        if not ObjectId.is_valid(photo_id):
            raise ResourceNotFoundException("Photograph was not found.", field="id")

        photo = await self.photo_repo.get_by_id(photo_id, include_deleted=False)
        if not photo or photo.is_deleted:
            raise ResourceNotFoundException(
                "Photograph was not found or has been removed.", field="id"
            )

        # Access verification: HMAC signed URL OR Authenticated Owner Bearer token
        authorized = False
        if sig and exp is not None:
            if verify_photo_signature(photo_id, kind, sig, exp):
                authorized = True
            else:
                raise ForbiddenException("Photo access link has expired or signature is invalid.")
        elif requester_user_id:
            if str(photo.user_id) == str(requester_user_id):
                authorized = True
            else:
                raise ForbiddenException("You do not have permission to view this photograph.")

        if not authorized:
            raise ForbiddenException("Authentication or valid signature required to view photo.")

        # Determine target R2 key
        target_key = photo.thumbnail_key if kind == "thumbnail" else photo.preview_key

        return await self.r2_storage.get_object(target_key)

    async def delete_photo(self, photo_id: str, user_id: str) -> None:
        """Securely delete user's photograph from Cloudflare R2 and MongoDB."""
        if not ObjectId.is_valid(photo_id):
            raise ResourceNotFoundException("Photograph was not found.", field="id")

        photo = await self.photo_repo.get_by_id(photo_id, include_deleted=False)
        if not photo or photo.is_deleted:
            raise ResourceNotFoundException("Photograph was not found.", field="id")

        # BOLA/IDOR protection
        if str(photo.user_id) != str(user_id):
            raise ForbiddenException("You do not have permission to delete this photograph.")

        # Soft delete in database first (the photo disappears from the library immediately)
        await self.photo_repo.soft_delete(photo_id, user_id)

        # Sizes for exact storage accounting: known for new photos, looked up for legacy ones
        keys = [photo.storage_key, photo.preview_key, photo.thumbnail_key]
        sizes: dict[str, int] = {}
        if photo.variant_bytes:
            sizes = {
                photo.storage_key: photo.variant_bytes.get("master", 0),
                photo.preview_key: photo.variant_bytes.get("preview", 0),
                photo.thumbnail_key: photo.variant_bytes.get("thumbnail", 0),
            }
        else:
            for key in keys:
                try:
                    sizes[key] = await self.r2_storage.get_object_size(key) or 0
                except StorageUnavailableException:
                    sizes[key] = 0  # unknown; reconciliation corrects the ledger later

        failed = set(await self.r2_storage.delete_objects(keys))
        await self.storage_quota.free(sum(size for key, size in sizes.items() if key not in failed))
        if failed:
            logger.warning(
                "Photo %s soft-deleted but %d R2 object(s) remain; cleanup will retry",
                photo_id,
                len(failed),
            )
        else:
            logger.info("Deleted photo %s and its R2 storage assets", photo_id)
