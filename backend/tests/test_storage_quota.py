"""R2 storage safeguards: 9.9 GB hard cap (incl. concurrency), ledger accounting,
per-user limit, duplicate detection and reliable deletion."""

import asyncio
import json
from datetime import UTC, datetime

import pytest
from bson import ObjectId
from httpx import AsyncClient

from app.core.config import get_settings
from app.core.exceptions import StorageQuotaExceededException
from app.models.photo import PhotoInDB
from app.services.image_processing_service import ImageProcessingService
from app.services.photo_service import PhotoService
from app.services.storage_quota_service import R2_SCOPE, StorageQuotaService
from tests.fakes import FakePhotoRepository, FakeQuoteRepository, FakeR2Storage, FakeUsageRepository
from tests.test_image_processing import make_test_image
from tests.test_photo_upload import register_test_user
from tests.test_quote_prepare import make_valid_design_payload

CAP = 9_900_000_000
COLORS = ["red", "green", "blue", "yellow", "purple", "orange", "white", "black", "gray", "pink"]


def ledger(repo: FakeUsageRepository) -> dict:
    return repo.storage[R2_SCOPE]


async def upload(client: AsyncClient, token: str, data: bytes, name: str = "p.jpg"):
    return await client.post(
        "/api/v1/photos/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": (name, data, "image/jpeg")},
    )


# ------------------------------------------------------------------ hard cap


@pytest.mark.asyncio
async def test_default_cap_is_9_9_gb():
    assert get_settings().R2_STORAGE_HARD_CAP_BYTES == CAP


@pytest.mark.asyncio
async def test_upload_rejected_when_storage_full_without_touching_existing_files(
    client: AsyncClient,
    fake_usage_repo: FakeUsageRepository,
    fake_r2_storage: FakeR2Storage,
    fake_photo_repo: FakePhotoRepository,
):
    _, token = await register_test_user(client, "full@example.com")
    await fake_r2_storage.put_object("users/x/photos/existing/master.webp", b"keep", "image/webp")
    await fake_usage_repo.seed_scope(R2_SCOPE, CAP - 1000)

    resp = await upload(client, token, make_test_image(600, 600))
    assert resp.status_code == 507
    err = resp.json()["error"]
    assert err["code"] == "STORAGE_QUOTA_EXCEEDED"
    assert "existing photos and designs are safe" in err["message"]

    assert list(fake_r2_storage.objects) == ["users/x/photos/existing/master.webp"]
    assert fake_photo_repo.photos == {}
    assert ledger(fake_usage_repo)["reserved_bytes"] == 0
    assert ledger(fake_usage_repo)["used_bytes"] == CAP - 1000


@pytest.mark.asyncio
async def test_ledger_seeded_from_existing_bucket_contents(
    client: AsyncClient, fake_usage_repo: FakeUsageRepository, fake_r2_storage: FakeR2Storage
):
    _, token = await register_test_user(client, "seed@example.com")
    legacy_key = "users/legacy/photos/a/original.jpg"
    await fake_r2_storage.put_object(legacy_key, b"x" * 5000, "image/jpeg")

    resp = await upload(client, token, make_test_image(500, 500))
    assert resp.status_code == 201
    photo_bytes = sum(len(v[0]) for k, v in fake_r2_storage.objects.items() if "legacy" not in k)
    assert ledger(fake_usage_repo)["used_bytes"] == 5000 + photo_bytes
    assert fake_r2_storage.list_calls == 1

    await upload(client, token, make_test_image(500, 500, color="red"))
    assert fake_r2_storage.list_calls == 1  # seeded once, not per upload


@pytest.mark.asyncio
async def test_concurrent_reservations_never_exceed_cap(monkeypatch):
    monkeypatch.setattr(get_settings(), "R2_STORAGE_HARD_CAP_BYTES", 1000)
    repo = FakeUsageRepository()
    quota = StorageQuotaService(repo, FakeR2Storage())

    async def attempt():
        try:
            return await quota.reserve(100)
        except StorageQuotaExceededException:
            return None

    results = await asyncio.gather(*(attempt() for _ in range(50)))
    granted = [r for r in results if r]
    assert len(granted) == 10
    assert ledger(repo)["reserved_bytes"] == 1000

    await asyncio.gather(*(quota.commit(r) for r in granted))
    assert ledger(repo)["used_bytes"] == 1000
    assert ledger(repo)["reserved_bytes"] == 0
    assert repo.reservations == {}


@pytest.mark.asyncio
async def test_concurrent_uploads_stay_within_cap(
    client: AsyncClient,
    fake_usage_repo: FakeUsageRepository,
    fake_r2_storage: FakeR2Storage,
    fake_photo_repo: FakePhotoRepository,
    monkeypatch,
):
    _, token = await register_test_user(client, "racer@example.com")
    sizes = []
    svc = ImageProcessingService()
    images = [make_test_image(700, 500, color=c) for c in COLORS[:6]]
    for img in images:
        sizes.append((await svc.process_image(img)).stored_bytes)
    cap = sum(sorted(sizes)[:3])  # room for at most three of the six uploads
    monkeypatch.setattr(get_settings(), "R2_STORAGE_HARD_CAP_BYTES", cap)

    responses = await asyncio.gather(
        *(upload(client, token, img, f"p{i}.jpg") for i, img in enumerate(images))
    )
    codes = [r.status_code for r in responses]
    assert set(codes) <= {201, 507}
    assert 1 <= codes.count(201) <= 3

    stored = sum(len(v[0]) for v in fake_r2_storage.objects.values())
    assert stored <= cap
    assert ledger(fake_usage_repo)["used_bytes"] == stored
    assert ledger(fake_usage_repo)["reserved_bytes"] == 0
    assert len(fake_photo_repo.photos) == codes.count(201)


@pytest.mark.asyncio
async def test_r2_failure_releases_reservation(
    client: AsyncClient, fake_usage_repo: FakeUsageRepository, fake_r2_storage: FakeR2Storage
):
    _, token = await register_test_user(client, "r2down@example.com")
    fake_r2_storage.should_fail_upload = True
    resp = await upload(client, token, make_test_image(500, 500))
    assert resp.status_code == 503
    assert ledger(fake_usage_repo)["reserved_bytes"] == 0
    assert ledger(fake_usage_repo)["used_bytes"] == 0
    assert fake_usage_repo.reservations == {}


@pytest.mark.asyncio
async def test_database_failure_rolls_back_objects_and_reservation(
    client: AsyncClient,
    fake_usage_repo: FakeUsageRepository,
    fake_r2_storage: FakeR2Storage,
    fake_photo_repo: FakePhotoRepository,
    monkeypatch,
):
    _, token = await register_test_user(client, "dbdown@example.com")

    async def boom(_photo):
        raise RuntimeError("simulated MongoDB failure")

    monkeypatch.setattr(fake_photo_repo, "create", boom)
    resp = await upload(client, token, make_test_image(500, 500))
    assert resp.status_code == 500
    assert fake_r2_storage.objects == {}
    assert ledger(fake_usage_repo)["used_bytes"] == 0
    assert ledger(fake_usage_repo)["reserved_bytes"] == 0


# ------------------------------------------------------------------ deletion


@pytest.mark.asyncio
async def test_delete_frees_exact_bytes(
    client: AsyncClient, fake_usage_repo: FakeUsageRepository, fake_r2_storage: FakeR2Storage
):
    _, token = await register_test_user(client, "deleter@example.com")
    photo_id = (await upload(client, token, make_test_image(500, 500))).json()["id"]
    assert ledger(fake_usage_repo)["used_bytes"] > 0

    resp = await client.delete(
        f"/api/v1/photos/{photo_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 204
    assert fake_r2_storage.objects == {}
    assert ledger(fake_usage_repo)["used_bytes"] == 0


@pytest.mark.asyncio
async def test_failed_r2_delete_keeps_bytes_accounted(
    client: AsyncClient,
    fake_usage_repo: FakeUsageRepository,
    fake_r2_storage: FakeR2Storage,
    fake_photo_repo: FakePhotoRepository,
):
    _, token = await register_test_user(client, "stuck@example.com")
    photo_id = (await upload(client, token, make_test_image(500, 500))).json()["id"]
    photo = await fake_photo_repo.get_by_id(photo_id)
    fake_r2_storage.fail_delete_keys = {photo.storage_key}
    master_size = len(fake_r2_storage.objects[photo.storage_key][0])

    resp = await client.delete(
        f"/api/v1/photos/{photo_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 204
    assert list(fake_r2_storage.objects) == [photo.storage_key]
    assert ledger(fake_usage_repo)["used_bytes"] == master_size


@pytest.mark.asyncio
async def test_delete_legacy_photo_uses_object_sizes():
    """Photos uploaded before compression have no size map: sizes come from R2 metadata."""
    usage, r2, photos = FakeUsageRepository(), FakeR2Storage(), FakePhotoRepository()
    user_id, photo_id = str(ObjectId()), str(ObjectId())
    base = f"users/{user_id}/photos/{photo_id}"
    for key, size in ((f"{base}/original.jpg", 9000), (f"{base}/preview.webp", 900)):
        await r2.put_object(key, b"x" * size, "image/jpeg")
    await r2.put_object(f"{base}/thumbnail.webp", b"x" * 90, "image/webp")
    await usage.seed_scope(R2_SCOPE, 9990 + 5000)
    now = datetime.now(UTC)
    await photos.create(
        PhotoInDB(
            id=photo_id,
            user_id=user_id,
            original_filename="old.jpg",
            storage_key=f"{base}/original.jpg",
            preview_key=f"{base}/preview.webp",
            thumbnail_key=f"{base}/thumbnail.webp",
            bucket="b",
            mime_type="image/jpeg",
            file_size_bytes=9000,
            width_px=800,
            height_px=600,
            aspect_ratio=1.33,
            suggested_orientation="landscape",
            created_at=now,
            updated_at=now,
        )
    )
    service = PhotoService(photos, ImageProcessingService(), r2, StorageQuotaService(usage, r2))
    await service.delete_photo(photo_id, user_id)
    assert r2.objects == {}
    assert usage.storage[R2_SCOPE]["used_bytes"] == 5000


# ------------------------------------------------------------- per-user limit


@pytest.mark.asyncio
async def test_per_user_storage_limit(client: AsyncClient, fake_photo_repo: FakePhotoRepository):
    user, token = await register_test_user(client, "hoarder@example.com")
    _, other = await register_test_user(client, "other@example.com")

    # The user's library already holds exactly the per-user limit (default 250 MB)
    limit = get_settings().user_photo_storage_limit_bytes
    now = datetime.now(UTC)
    await fake_photo_repo.create(
        PhotoInDB(
            id=str(ObjectId()),
            user_id=user["id"],
            original_filename="big.jpg",
            storage_key="k1",
            preview_key="k2",
            thumbnail_key="k3",
            bucket="b",
            mime_type="image/jpeg",
            file_size_bytes=limit,
            stored_bytes=limit,
            width_px=4000,
            height_px=3000,
            aspect_ratio=1.33,
            suggested_orientation="landscape",
            created_at=now,
            updated_at=now,
        )
    )

    blocked = await upload(client, token, make_test_image(500, 500, color="red"))
    assert blocked.status_code == 507
    err = blocked.json()["error"]
    assert err["code"] == "USER_STORAGE_LIMIT_REACHED"
    assert "Remove a few photos" in err["message"]

    # Another user's library is unaffected
    assert (await upload(client, other, make_test_image(500, 500, color="red"))).status_code == 201


# ---------------------------------------------------------- duplicate uploads


@pytest.mark.asyncio
async def test_duplicate_upload_returns_existing_photo(
    client: AsyncClient,
    fake_r2_storage: FakeR2Storage,
    fake_photo_repo: FakePhotoRepository,
    fake_usage_repo: FakeUsageRepository,
):
    _, token = await register_test_user(client, "dupe@example.com")
    img = make_test_image(640, 480)
    first = await upload(client, token, img, "a.jpg")
    used_after_first = ledger(fake_usage_repo)["used_bytes"]
    second = await upload(client, token, img, "b.jpg")

    assert first.status_code == second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert len(fake_photo_repo.photos) == 1
    assert len(fake_r2_storage.objects) == 3
    assert ledger(fake_usage_repo)["used_bytes"] == used_after_first


@pytest.mark.asyncio
async def test_same_photo_for_different_users_is_not_shared(
    client: AsyncClient, fake_photo_repo: FakePhotoRepository
):
    _, a = await register_test_user(client, "share_a@example.com")
    _, b = await register_test_user(client, "share_b@example.com")
    img = make_test_image(640, 480)
    ra, rb = await upload(client, a, img), await upload(client, b, img)
    assert ra.json()["id"] != rb.json()["id"]
    assert len(fake_photo_repo.photos) == 2


@pytest.mark.asyncio
async def test_reupload_after_delete_creates_new_photo(
    client: AsyncClient, fake_photo_repo: FakePhotoRepository
):
    _, token = await register_test_user(client, "again@example.com")
    img = make_test_image(640, 480)
    first_id = (await upload(client, token, img)).json()["id"]
    await client.delete(f"/api/v1/photos/{first_id}", headers={"Authorization": f"Bearer {token}"})
    second = await upload(client, token, img)
    assert second.status_code == 201
    assert second.json()["id"] != first_id


@pytest.mark.asyncio
async def test_concurrent_identical_uploads_store_one_copy(
    client: AsyncClient,
    fake_r2_storage: FakeR2Storage,
    fake_photo_repo: FakePhotoRepository,
    fake_usage_repo: FakeUsageRepository,
):
    _, token = await register_test_user(client, "doubleclick@example.com")
    img = make_test_image(800, 600)
    responses = await asyncio.gather(*(upload(client, token, img) for _ in range(3)))

    assert {r.status_code for r in responses} == {201}
    assert len({r.json()["id"] for r in responses}) == 1
    assert len(fake_photo_repo.photos) == 1
    assert len(fake_r2_storage.objects) == 3
    stored = sum(len(v[0]) for v in fake_r2_storage.objects.values())
    assert ledger(fake_usage_repo)["used_bytes"] == stored
    assert ledger(fake_usage_repo)["reserved_bytes"] == 0


# --------------------------------------------------------------------- quotes


@pytest.mark.asyncio
async def test_quote_rejected_when_storage_full(
    client: AsyncClient,
    fake_usage_repo: FakeUsageRepository,
    fake_quote_repo: FakeQuoteRepository,
    fake_r2_storage: FakeR2Storage,
):
    _, token = await register_test_user(client, "quote_full@example.com")
    await fake_usage_repo.seed_scope(R2_SCOPE, CAP)
    resp = await client.post(
        "/api/v1/quotes/prepare",
        headers={"Authorization": f"Bearer {token}"},
        data={"design_data": json.dumps(make_valid_design_payload(frames_count=2))},
        files={"file": ("preview.png", make_test_image(1000, 800, "PNG"), "image/png")},
    )
    assert resp.status_code == 507
    assert resp.json()["error"]["code"] == "STORAGE_QUOTA_EXCEEDED"
    assert fake_quote_repo.quotes == {}
    assert fake_r2_storage.objects == {}


@pytest.mark.asyncio
async def test_quote_preview_counted_in_ledger(
    client: AsyncClient, fake_usage_repo: FakeUsageRepository, fake_r2_storage: FakeR2Storage
):
    _, token = await register_test_user(client, "quote_ledger@example.com")
    resp = await client.post(
        "/api/v1/quotes/prepare",
        headers={"Authorization": f"Bearer {token}"},
        data={"design_data": json.dumps(make_valid_design_payload(frames_count=2))},
        files={"file": ("preview.png", make_test_image(1000, 800, "PNG"), "image/png")},
    )
    assert resp.status_code == 201
    stored = sum(len(v[0]) for v in fake_r2_storage.objects.values())
    assert ledger(fake_usage_repo)["used_bytes"] == stored
