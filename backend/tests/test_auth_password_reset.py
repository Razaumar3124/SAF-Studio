from datetime import UTC, datetime

import pytest
from bson import ObjectId
from httpx import AsyncClient

from app.core.security import hash_password
from app.models.user import UserInDB
from tests.fakes import FakeSessionRepository, FakeUserRepository


@pytest.fixture(autouse=True)
async def setup_reset_user(fake_user_repo: FakeUserRepository):
    """Seed a user for password reset tests."""
    now = datetime.now(UTC)
    user = UserInDB(
        _id=str(ObjectId()),
        email="reset.user@example.com",
        phone="+919876543210",
        password_hash=hash_password("ValidPassword123!"),
        full_name="Reset User",
        role="customer",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    await fake_user_repo.create(user)


@pytest.mark.asyncio
async def test_forgot_password_registered_email(
    client: AsyncClient, fake_session_repo: FakeSessionRepository
):
    """Test forgot-password for existing account returns 200 and records reset token."""
    payload = {"email": "reset.user@example.com"}
    response = await client.post("/api/v1/auth/forgot-password", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "If that email is registered" in data["message"]

    # Verify reset token was saved in database
    assert len(fake_session_repo.password_resets) == 1
    reset_entry = next(iter(fake_session_repo.password_resets.values()))
    assert reset_entry["used"] is False
    assert "token_hash" in reset_entry


@pytest.mark.asyncio
async def test_forgot_password_unregistered_email_non_enumerating(
    client: AsyncClient, fake_session_repo: FakeSessionRepository
):
    """Test forgot-password for non-existent email returns identical 200 without creating token."""
    payload = {"email": "completely.unknown@example.com"}
    response = await client.post("/api/v1/auth/forgot-password", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "If that email is registered" in data["message"]

    # No token should be recorded for unknown email
    assert len(fake_session_repo.password_resets) == 0


@pytest.mark.asyncio
async def test_forgot_password_invalid_email_format(client: AsyncClient):
    """Test invalid email format returns 422 validation error."""
    payload = {"email": "not-an-email"}
    response = await client.post("/api/v1/auth/forgot-password", json=payload)
    assert response.status_code == 422

