"""Periodic, idempotent storage hygiene for Cloudflare R2 and MongoDB.

Each run:
1. Releases upload reservations abandoned by crashed workers.
2. Deletes R2 objects nothing references any more, once older than a grace period:
   - `users/{uid}/photos/{pid}/*` whose photo document is missing or soft-deleted
     (e.g. a delete whose R2 call failed, or a crashed upload),
   - `quotes/*` previews no quote references (quotes expire via a MongoDB TTL index,
     which cannot delete their R2 preview).
   Objects of active photos are never touched, including pre-compression originals.
3. Permanently removes designs soft-deleted long ago, unless a quote references them.
4. Reconciles the R2 storage ledger with the measured bucket size.

Objects under any other prefix are never deleted.
"""

import logging
import re
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime, timedelta

from bson import ObjectId

from app.core.config import get_settings
from app.repositories.design_repository import DesignRepository
from app.repositories.photo_repository import PhotoRepository
from app.repositories.quote_repository import QuoteRepository
from app.repositories.usage_repository import UsageRepository
from app.services.storage_quota_service import R2_SCOPE
from app.storage.r2_storage import R2Storage, StoredObject

logger = logging.getLogger("saf_studio.storage_maintenance")

_PHOTO_KEY = re.compile(r"^users/(?P<user_id>[^/]+)/photos/(?P<photo_id>[0-9a-fA-F]{24})/[^/]+$")
_QUOTE_KEY = re.compile(r"^quotes/[^/]+/[^/]+/[^/]+$")
STALE_RESERVATION_MINUTES = 30


@dataclass
class MaintenanceReport:
    applied: bool
    stale_reservations_released: int = 0
    objects_scanned: int = 0
    bucket_bytes: int = 0
    orphaned_photo_objects: list[str] = field(default_factory=list)
    unreferenced_quote_previews: list[str] = field(default_factory=list)
    deleted_bytes: int = 0
    failed_deletes: list[str] = field(default_factory=list)
    designs_purged: int = 0
    ledger_used_before: int | None = None
    ledger_used_after: int | None = None

    def summary(self) -> dict:
        data = asdict(self)
        data["orphaned_photo_objects"] = len(self.orphaned_photo_objects)
        data["unreferenced_quote_previews"] = len(self.unreferenced_quote_previews)
        data["failed_deletes"] = len(self.failed_deletes)
        return data


class StorageMaintenanceService:
    """Cleans orphaned objects, purges expired soft-deleted data and reconciles accounting."""

    def __init__(
        self,
        usage_repo: UsageRepository,
        r2_storage: R2Storage,
        photo_repo: PhotoRepository,
        quote_repo: QuoteRepository,
        design_repo: DesignRepository,
    ) -> None:
        self.usage_repo = usage_repo
        self.r2_storage = r2_storage
        self.photo_repo = photo_repo
        self.quote_repo = quote_repo
        self.design_repo = design_repo

    async def run(self, apply: bool = True) -> MaintenanceReport:
        """Run one maintenance pass. With apply=False nothing is changed (dry run)."""
        settings = get_settings()
        now = datetime.now(UTC)
        report = MaintenanceReport(applied=apply)

        if apply:
            report.stale_reservations_released = await self._release_stale_reservations(now)

        ledger = await self.usage_repo.get_scope(R2_SCOPE)
        seq_before = ledger.get("seq") if ledger else None
        report.ledger_used_before = int(ledger["used_bytes"]) if ledger else None

        objects = await self.r2_storage.list_objects()
        report.objects_scanned = len(objects)
        report.bucket_bytes = sum(obj.size for obj in objects)

        grace_cutoff = now - timedelta(hours=settings.STORAGE_ORPHAN_GRACE_HOURS)
        deletable = await self._find_unreferenced(objects, grace_cutoff, report)

        if apply and deletable:
            failed = set(await self.r2_storage.delete_objects([o.key for o in deletable]))
            report.failed_deletes = sorted(failed)
            report.deleted_bytes = sum(o.size for o in deletable if o.key not in failed)
        elif not apply:
            report.deleted_bytes = sum(o.size for o in deletable)

        if apply:
            report.designs_purged = await self._purge_deleted_designs(now)
            await self._reconcile(report, seq_before)

        logger.info("Storage maintenance finished: %s", report.summary())
        return report

    async def _release_stale_reservations(self, now: datetime) -> int:
        cutoff = now - timedelta(minutes=STALE_RESERVATION_MINUTES)
        released = 0
        for res in await self.usage_repo.list_reservations(older_than=cutoff):
            if await self.usage_repo.delete_reservation(res["_id"]):
                await self.usage_repo.release_reserved(res.get("scope", R2_SCOPE), res["bytes"])
                released += 1
        return released

    async def _find_unreferenced(
        self, objects: list[StoredObject], grace_cutoff: datetime, report: MaintenanceReport
    ) -> list[StoredObject]:
        photo_alive: dict[str, bool] = {}
        deletable: list[StoredObject] = []

        for obj in objects:
            modified = obj.last_modified
            if modified.tzinfo is None:
                modified = modified.replace(tzinfo=UTC)
            if modified > grace_cutoff:
                continue  # may belong to an upload that is still in progress

            photo_match = _PHOTO_KEY.match(obj.key)
            if photo_match:
                photo_id = photo_match.group("photo_id")
                if not ObjectId.is_valid(photo_id):
                    continue
                if photo_id not in photo_alive:
                    photo = await self.photo_repo.get_by_id(photo_id, include_deleted=True)
                    photo_alive[photo_id] = bool(photo and not photo.is_deleted)
                if not photo_alive[photo_id]:
                    deletable.append(obj)
                    report.orphaned_photo_objects.append(obj.key)
                continue

            if _QUOTE_KEY.match(obj.key):
                if not await self.quote_repo.exists_with_preview_key(obj.key):
                    deletable.append(obj)
                    report.unreferenced_quote_previews.append(obj.key)
        return deletable

    async def _purge_deleted_designs(self, now: datetime) -> int:
        settings = get_settings()
        cutoff = now - timedelta(days=settings.DESIGN_PURGE_AFTER_DAYS)
        purged = 0
        for design_id in await self.design_repo.list_soft_deleted_before(cutoff):
            if await self.quote_repo.exists_for_design(design_id):
                continue  # referenced by a quote: keep
            if await self.design_repo.purge_design(design_id):
                purged += 1
        return purged

    async def _reconcile(self, report: MaintenanceReport, seq_before: int | None) -> None:
        """Set the ledger to the measured size, unless uploads/deletes happened meanwhile."""
        if seq_before is None:
            # No ledger yet: it is seeded from a fresh listing on the first upload.
            return
        in_flight = sum(r["bytes"] for r in await self.usage_repo.list_reservations())
        measured = max(0, report.bucket_bytes - report.deleted_bytes)
        if await self.usage_repo.reconcile_scope(R2_SCOPE, measured, in_flight, seq_before):
            report.ledger_used_after = measured
        else:
            # Concurrent activity: keep the ledger and just account for what we deleted.
            await self.usage_repo.release_used(R2_SCOPE, report.deleted_bytes)
            ledger = await self.usage_repo.get_scope(R2_SCOPE)
            report.ledger_used_after = int(ledger["used_bytes"]) if ledger else None
