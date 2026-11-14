"""MongoDB growth safeguards: payload caps, write throttling, version retention and
graceful handling of Atlas storage-quota write errors."""

import pytest
from httpx import AsyncClient
from pymongo.errors import OperationFailure, WriteError

from app.core.config import get_settings
from app.core.handlers import is_storage_quota_error
from tests.fakes import FakeDesignRepository
from tests.test_photo_upload import register_test_user


def version_payload(x: float, **extra) -> dict:
    return {
        "layout_type": "custom",
        "items": [
            {
                "item_id": "frame-1",
                "frame_id": "frame-oak-12x16",
                "position_x_inches": x,
                "position_y_inches": 20.0,
                "photo_width_inches": 12.0,
                "photo_height_inches": 16.0,
                "total_width_inches": 16.0,
                "total_height_inches": 20.0,
            }
        ],
        **extra,
    }


async def create_design(client: AsyncClient, token: str) -> str:
    res = await client.post(
        "/api/v1/designs",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Retention Wall", "wall": {"width_inches": 120.0, "height_inches": 96.0}},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


@pytest.mark.asyncio
async def test_version_retention_keeps_newest_and_current(
    client: AsyncClient, fake_design_repo: FakeDesignRepository, monkeypatch
):
    monkeypatch.setattr(get_settings(), "DESIGN_VERSION_RETENTION", 3)
    _, token = await register_test_user(client, "retention@example.com")
    design_id = await create_design(client, token)

    for i in range(6):
        res = await client.post(
            f"/api/v1/designs/{design_id}/versions",
            headers={"Authorization": f"Bearer {token}"},
            json=version_payload(10.0 + i),
        )
        assert res.status_code == 201

    remaining = sorted(
        v["version_number"]
        for v in fake_design_repo.versions.values()
        if v["design_id"] == design_id
    )
    assert remaining == [4, 5, 6]

    detail = await client.get(
        f"/api/v1/designs/{design_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert detail.json()["current_version"]["version_number"] == 6


@pytest.mark.asyncio
async def test_oversized_layout_metadata_rejected(client: AsyncClient):
    _, token = await register_test_user(client, "bloat@example.com")
    design_id = await create_design(client, token)
    res = await client.post(
        f"/api/v1/designs/{design_id}/versions",
        headers={"Authorization": f"Bearer {token}"},
        json=version_payload(10.0, layout_metadata={"junk": "x" * 10_000}),
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_normal_layout_metadata_accepted(client: AsyncClient):
    _, token = await register_test_user(client, "normalmeta@example.com")
    design_id = await create_design(client, token)
    res = await client.post(
        f"/api/v1/designs/{design_id}/versions",
        headers={"Authorization": f"Bearer {token}"},
        json=version_payload(
            10.0,
            layout_metadata={"gapIn": 3, "gapUnit": "in", "seed": 12345, "variant": 1},
            preview={"sofa": True, "indexBadges": True, "guides": False},
        ),
    )
    assert res.status_code == 201


@pytest.mark.asyncio
async def test_design_creation_is_throttled(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(get_settings(), "RATE_LIMIT_DESIGN_CREATE_MAX_ATTEMPTS", 2)
    _, token = await register_test_user(client, "spammer@example.com")
    await create_design(client, token)
    await create_design(client, token)
    res = await client.post(
        "/api/v1/designs",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Third", "wall": {"width_inches": 120.0, "height_inches": 96.0}},
    )
    assert res.status_code == 429


@pytest.mark.asyncio
async def test_atlas_storage_quota_error_returns_friendly_507(
    client: AsyncClient, fake_design_repo: FakeDesignRepository, monkeypatch
):
    async def over_quota(_design):
        raise WriteError("you are over your space quota, using 513 MB of 512 MB", code=8000)

    monkeypatch.setattr(fake_design_repo, "create_design", over_quota)
    _, token = await register_test_user(client, "atlasfull@example.com")
    res = await client.post(
        "/api/v1/designs",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Wall", "wall": {"width_inches": 120.0, "height_inches": 96.0}},
    )
    assert res.status_code == 507
    err = res.json()["error"]
    assert err["code"] == "DATABASE_STORAGE_FULL"
    assert "existing designs and photos are safe" in err["message"]


@pytest.mark.asyncio
async def test_other_mongo_errors_stay_generic_500(
    client: AsyncClient, fake_design_repo: FakeDesignRepository, monkeypatch
):
    async def broken(_design):
        raise OperationFailure("some other failure", code=2)

    monkeypatch.setattr(fake_design_repo, "create_design", broken)
    _, token = await register_test_user(client, "mongo500@example.com")
    res = await client.post(
        "/api/v1/designs",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Wall", "wall": {"width_inches": 120.0, "height_inches": 96.0}},
    )
    assert res.status_code == 500
    assert res.json()["error"]["code"] == "INTERNAL_SERVER_ERROR"


def test_storage_quota_error_detection():
    assert is_storage_quota_error(OperationFailure("x", code=8000))
    assert is_storage_quota_error(WriteError("you are over your space quota", code=None))
    assert not is_storage_quota_error(OperationFailure("duplicate key", code=11000))
    assert not is_storage_quota_error(ValueError("space quota"))
