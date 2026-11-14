"""Hard cap on total Cloudflare R2 storage (default 9.9 GB), safe under concurrent uploads.

Every upload reserves its exact byte size *before* writing to R2 with a single conditional
MongoDB update (`used + reserved + n <= cap`), so two concurrent uploads can never both slip
past the cap. Reservations are committed on success and released on failure; a reservation
record lets the maintenance job release reservations abandoned by a crashed worker.
"""

import logging
from dataclasses import dataclass

from app.core.config import get_settings
from app.core.exceptions import StorageQuotaExceededException
from app.repositories.usage_repository import UsageRepository
from app.storage.r2_storage import R2Storage

logger = logging.getLogger("saf_studio.storage_quota")

R2_SCOPE = "r2"


@dataclass
class StorageReservation:
    reservation_id: str
    nbytes: int


class StorageQuotaService:
    """Reserve / commit / release R2 storage against the global hard cap."""

    def __init__(self, usage_repo: UsageRepository, r2_storage: R2Storage) -> None:
        self.usage_repo = usage_repo
        self.r2_storage = r2_storage

    async def _ensure_seeded(self) -> None:
        """Create the ledger from the bucket's real size the first time it is needed.

        Listing the bucket is the source of truth (existing objects predate the ledger). If the
        listing fails, the upload fails too: the cap is never enforced against a guess.
        """
        if await self.usage_repo.get_scope(R2_SCOPE) is not None:
            return
        total = await self.r2_storage.total_bytes()
        await self.usage_repo.seed_scope(R2_SCOPE, total)
        logger.info("Seeded R2 storage ledger from bucket listing: %d bytes", total)

    async def reserve(self, nbytes: int) -> StorageReservation:
        """Reserve `nbytes` of R2 capacity or raise StorageQuotaExceededException."""
        settings = get_settings()
        await self._ensure_seeded()
        if not await self.usage_repo.try_reserve(
            R2_SCOPE, nbytes, settings.R2_STORAGE_HARD_CAP_BYTES
        ):
            logger.warning(
                "R2 storage cap reached: rejected upload of %d bytes (cap %d)",
                nbytes,
                settings.R2_STORAGE_HARD_CAP_BYTES,
            )
            raise StorageQuotaExceededException()
        try:
            reservation_id = await self.usage_repo.create_reservation(R2_SCOPE, nbytes)
        except Exception:
            await self.usage_repo.release_reserved(R2_SCOPE, nbytes)
            raise
        return StorageReservation(reservation_id=reservation_id, nbytes=nbytes)

    async def commit(self, reservation: StorageReservation) -> None:
        """The objects were written: count them as used storage."""
        if await self.usage_repo.delete_reservation(reservation.reservation_id):
            await self.usage_repo.commit_reserved(R2_SCOPE, reservation.nbytes)

    async def release(self, reservation: StorageReservation) -> None:
        """The upload failed or was abandoned: give the capacity back."""
        if await self.usage_repo.delete_reservation(reservation.reservation_id):
            await self.usage_repo.release_reserved(R2_SCOPE, reservation.nbytes)

    async def free(self, nbytes: int) -> None:
        """Objects of this total size were confirmed deleted from R2."""
        if nbytes > 0 and await self.usage_repo.get_scope(R2_SCOPE) is not None:
            await self.usage_repo.release_used(R2_SCOPE, nbytes)
