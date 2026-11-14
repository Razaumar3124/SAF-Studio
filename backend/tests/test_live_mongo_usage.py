"""Live MongoDB checks that the quota primitives are atomic under real concurrency.

Skipped unless a local MongoDB is reachable on port 27017.
"""

import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from pymongo import AsyncMongoClient

from app.repositories.usage_repository import UsageRepository

DB_NAME = "saf_studio_pytest_usage"


@pytest.fixture
async def live_repo():
    client = AsyncMongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=1000)
    try:
        await client.admin.command("ping")
    except Exception:
        await client.close()
        pytest.skip("Local MongoDB instance not reachable on port 27017")
    await client.drop_database(DB_NAME)
    repo = UsageRepository(client[DB_NAME])
    await repo.create_indexes()
    yield repo
    await client.drop_database(DB_NAME)
    await client.close()


@pytest.mark.asyncio
async def test_live_counter_is_atomic(live_repo: UsageRepository):
    expires = datetime.now(UTC) + timedelta(days=1)
    results = await asyncio.gather(
        *(live_repo.increment_counter("email:day:test", 25, expires) for _ in range(100))
    )
    assert sum(results) == 25
    assert await live_repo.get_counter("email:day:test") == 25


@pytest.mark.asyncio
async def test_live_reservations_never_exceed_cap(live_repo: UsageRepository):
    await live_repo.seed_scope("r2", 0)
    results = await asyncio.gather(*(live_repo.try_reserve("r2", 100, 1000) for _ in range(60)))
    assert sum(results) == 10
    scope = await live_repo.get_scope("r2")
    assert scope["used_bytes"] + scope["reserved_bytes"] == 1000

    await live_repo.release_used("r2", 10**9)  # clamps at zero
    assert (await live_repo.get_scope("r2"))["used_bytes"] == 0


@pytest.fixture
async def live_db():
    client = AsyncMongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=1000)
    try:
        await client.admin.command("ping")
    except Exception:
        await client.close()
        pytest.skip("Local MongoDB instance not reachable on port 27017")
    await client.drop_database(DB_NAME)
    yield client[DB_NAME]
    await client.drop_database(DB_NAME)
    await client.close()


def _photo(user_id: str, content_hash: str | None, stored: int | None, size: int = 50):
    from bson import ObjectId

    from app.models.photo import PhotoInDB

    now = datetime.now(UTC)
    return PhotoInDB(
        id=str(ObjectId()),
        user_id=user_id,
        original_filename="p.jpg",
        storage_key="a",
        preview_key="b",
        thumbnail_key="c",
        bucket="b",
        mime_type="image/jpeg",
        file_size_bytes=size,
        width_px=800,
        height_px=600,
        aspect_ratio=1.33,
        suggested_orientation="landscape",
        content_hash=content_hash,
        stored_bytes=stored,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_live_photo_dedup_index_and_storage_sum(live_db):
    from bson import ObjectId
    from pymongo.errors import DuplicateKeyError

    from app.repositories.photo_repository import PhotoRepository

    repo = PhotoRepository(live_db)
    await repo.create_indexes()
    user = str(ObjectId())

    first = await repo.create(_photo(user, "hash-1", 1000))
    with pytest.raises(DuplicateKeyError):
        await repo.create(_photo(user, "hash-1", 1000))
    await repo.create(_photo(str(ObjectId()), "hash-1", 1000))  # other user: allowed
    await repo.create(_photo(user, None, None, size=300))  # legacy photo, no hash
    await repo.create(_photo(user, None, None, size=200))  # several legacy photos allowed

    assert await repo.sum_active_storage_bytes(user) == 1500
    await repo.soft_delete(first.id, user)
    await repo.create(_photo(user, "hash-1", 1000))  # re-upload after delete: allowed
    assert (await repo.get_active_by_content_hash(user, "hash-1")) is not None


@pytest.mark.asyncio
async def test_live_version_pruning_keeps_current(live_db):
    from bson import ObjectId

    from app.repositories.design_repository import DesignRepository

    repo = DesignRepository(live_db)
    design_id = ObjectId()
    ids = []
    for n in range(1, 8):
        vid = ObjectId()
        ids.append(vid)
        await repo.versions.insert_one({"_id": vid, "design_id": design_id, "version_number": n})

    # Pretend version 2 is current (e.g. restored); it must survive pruning
    deleted = await repo.prune_versions(
        str(design_id), keep_latest=3, current_version_id=str(ids[1])
    )
    docs = [d async for d in repo.versions.find({"design_id": design_id})]
    remaining = sorted(d["version_number"] for d in docs)
    assert remaining == [2, 5, 6, 7]
    assert deleted == 3
