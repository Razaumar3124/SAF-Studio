"""Storage maintenance: orphan cleanup, expired quote previews, stale reservations,
soft-deleted design purge and ledger reconciliation. Referenced data is never deleted."""

from datetime import UTC, datetime, timedelta

import pytest
from bson import ObjectId

from app.models.design import DesignInDB, DesignWallInDB
from app.models.photo import PhotoInDB
from app.models.quote import QuoteContactSnapshot, QuoteInDB, QuoteWallSnapshot
from app.services.storage_maintenance_service import StorageMaintenanceService
from app.services.storage_quota_service import R2_SCOPE
from tests.fakes import (
    FakeDesignRepository,
    FakePhotoRepository,
    FakeQuoteRepository,
    FakeR2Storage,
    FakeUsageRepository,
)

OLD = datetime.now(UTC) - timedelta(days=3)


@pytest.fixture
def env():
    usage, r2 = FakeUsageRepository(), FakeR2Storage()
    photos, quotes, designs = FakePhotoRepository(), FakeQuoteRepository(), FakeDesignRepository()
    service = StorageMaintenanceService(usage, r2, photos, quotes, designs)
    return service, usage, r2, photos, quotes, designs


async def put(r2: FakeR2Storage, key: str, size: int, when: datetime = OLD) -> None:
    await r2.put_object(key, b"x" * size, "image/webp")
    r2.modified_at[key] = when


async def add_photo(photos: FakePhotoRepository, user_id: str, deleted: bool = False) -> str:
    photo_id = str(ObjectId())
    base = f"users/{user_id}/photos/{photo_id}"
    now = datetime.now(UTC)
    await photos.create(
        PhotoInDB(
            id=photo_id, user_id=user_id, original_filename="p.jpg",
            storage_key=f"{base}/original.jpg", preview_key=f"{base}/preview.webp",
            thumbnail_key=f"{base}/thumbnail.webp", bucket="b", mime_type="image/jpeg",
            file_size_bytes=100, width_px=800, height_px=600, aspect_ratio=1.33,
            suggested_orientation="landscape", is_deleted=deleted,
            created_at=now, updated_at=now,
        )
    )
    return photo_id


def make_quote(preview_key: str, design_id: str | None = None) -> QuoteInDB:
    return QuoteInDB(
        quote_reference=f"SQ-2026-{ObjectId()!s:.4}",
        user_id=str(ObjectId()),
        customer=QuoteContactSnapshot(full_name="A", email="a@example.com", phone="+919800000000"),
        design_id=design_id,
        wall=QuoteWallSnapshot(width_inches=120, height_inches=96),
        frames=[],
        preview_image_key=preview_key,
        preview_image_content_type="image/webp",
        share_token_hash=str(ObjectId()),
        share_token_prefix="abcd1234",
        expires_at=datetime.now(UTC) + timedelta(days=10),
    )


@pytest.mark.asyncio
async def test_orphans_deleted_and_referenced_objects_kept(env):
    service, usage, r2, photos, _, _ = env
    user = str(ObjectId())
    active = await add_photo(photos, user)
    deleted = await add_photo(photos, user, deleted=True)
    missing = str(ObjectId())

    keep = [
        f"users/{user}/photos/{active}/original.jpg",  # legacy original of an active photo
        f"users/{user}/photos/{active}/preview.webp",
        "static/catalog/frame.webp",  # unknown prefix: never touched
    ]
    remove = [
        f"users/{user}/photos/{deleted}/master.webp",  # delete whose R2 call failed
        f"users/{user}/photos/{missing}/master.webp",  # crashed upload, no document
    ]
    recent_orphan = f"users/{user}/photos/{missing}/preview.webp"
    for key in keep + remove:
        await put(r2, key, 1000)
    await put(r2, recent_orphan, 1000, when=datetime.now(UTC))  # inside the grace period
    await usage.seed_scope(R2_SCOPE, 999_999)  # drifted ledger

    report = await service.run(apply=True)

    assert sorted(report.orphaned_photo_objects) == sorted(remove)
    assert set(r2.objects) == set(keep) | {recent_orphan}
    assert report.deleted_bytes == 2000
    assert usage.storage[R2_SCOPE]["used_bytes"] == 4000  # reconciled to the bucket


@pytest.mark.asyncio
async def test_dry_run_changes_nothing(env):
    service, usage, r2, _, _, _ = env
    orphan = f"users/{ObjectId()}/photos/{ObjectId()}/master.webp"
    await put(r2, orphan, 500)
    await usage.seed_scope(R2_SCOPE, 123)

    report = await service.run(apply=False)
    assert report.orphaned_photo_objects == [orphan]
    assert orphan in r2.objects
    assert usage.storage[R2_SCOPE]["used_bytes"] == 123


@pytest.mark.asyncio
async def test_unreferenced_quote_previews_removed(env):
    service, _, r2, _, quotes, _ = env
    live_key = "quotes/u1/SQ-2026-0001/preview.webp"
    expired_key = "quotes/u1/SQ-2025-0042/preview.png"  # quote already removed by TTL
    await put(r2, live_key, 300)
    await put(r2, expired_key, 300)
    await quotes.create(make_quote(live_key))

    report = await service.run(apply=True)
    assert report.unreferenced_quote_previews == [expired_key]
    assert live_key in r2.objects and expired_key not in r2.objects


@pytest.mark.asyncio
async def test_failed_orphan_delete_is_retried_later(env):
    service, usage, r2, _, _, _ = env
    orphan = f"users/{ObjectId()}/photos/{ObjectId()}/master.webp"
    await put(r2, orphan, 700)
    await usage.seed_scope(R2_SCOPE, 700)
    r2.fail_delete_keys = {orphan}

    report = await service.run(apply=True)
    assert report.failed_deletes == [orphan]
    assert usage.storage[R2_SCOPE]["used_bytes"] == 700  # still stored, still counted

    r2.fail_delete_keys = set()
    await service.run(apply=True)
    assert orphan not in r2.objects
    assert usage.storage[R2_SCOPE]["used_bytes"] == 0


@pytest.mark.asyncio
async def test_stale_reservations_released(env):
    service, usage, _, _, _, _ = env
    await usage.seed_scope(R2_SCOPE, 0)
    assert await usage.try_reserve(R2_SCOPE, 5000, 10**9)
    rid = await usage.create_reservation(R2_SCOPE, 5000)
    usage.reservations[rid]["created_at"] = datetime.now(UTC) - timedelta(hours=2)

    report = await service.run(apply=True)
    assert report.stale_reservations_released == 1
    assert usage.reservations == {}
    assert usage.storage[R2_SCOPE]["reserved_bytes"] == 0


@pytest.mark.asyncio
async def test_soft_deleted_designs_purged_unless_referenced(env):
    service, _, _, _, quotes, designs = env
    now = datetime.now(UTC)

    async def design(deleted_days_ago: int | None) -> str:
        d = DesignInDB(
            user_id=str(ObjectId()), title="Wall", wall=DesignWallInDB(),
            is_deleted=deleted_days_ago is not None, created_at=now, updated_at=now,
        )
        await designs.create_design(d)
        if deleted_days_ago is not None:
            designs.designs[str(d.id)]["deleted_at"] = now - timedelta(days=deleted_days_ago)
        designs.versions[str(ObjectId())] = {"_id": "v", "design_id": str(d.id)}
        return str(d.id)

    old_deleted = await design(45)
    referenced = await design(45)
    recent_deleted = await design(5)
    active = await design(None)
    await quotes.create(make_quote("quotes/x/y/preview.webp", design_id=referenced))

    report = await service.run(apply=True)
    assert report.designs_purged == 1
    assert old_deleted not in designs.designs
    assert all(v["design_id"] != old_deleted for v in designs.versions.values())
    for kept in (referenced, recent_deleted, active):
        assert kept in designs.designs


@pytest.mark.asyncio
async def test_reconcile_skipped_when_ledger_changes_concurrently(env, monkeypatch):
    service, usage, r2, _, _, _ = env
    await put(r2, "static/a.webp", 100)
    await usage.seed_scope(R2_SCOPE, 50)
    original_list = r2.list_objects

    async def list_with_concurrent_upload(prefix: str = ""):
        result = await original_list(prefix)
        await usage.try_reserve(R2_SCOPE, 10, 10**9)  # an upload starts mid-run
        return result

    monkeypatch.setattr(r2, "list_objects", list_with_concurrent_upload)
    await service.run(apply=True)
    ledger = usage.storage[R2_SCOPE]
    assert ledger["used_bytes"] == 50  # not overwritten while an upload was in flight
    assert ledger["reserved_bytes"] == 10
