"""Regression tests for the pre-deployment security and reliability fixes.

Covers: production fail-fast configuration, proxy-aware client IP resolution, atomic OTP attempt
accounting, email quota refunds on unexpected failures, bounded mock outbox, post-insert photo
library limit, rate-limiter key pruning, and email verification on password reset.
"""

import asyncio
import io
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId
from httpx import AsyncClient
from PIL import Image
from pydantic import ValidationError

from app.core.config import DEV_SECRET_KEY, Settings
from app.core.exceptions import UserStorageQuotaExceededException
from app.core.security import get_client_ip, hash_password
from app.models.user import UserInDB
from app.repositories.session_repository import SessionRepository
from app.services import rate_limiter as rate_limiter_module
from app.services.email_service import EmailService, email_service
from app.services.image_processing_service import ImageProcessingService
from app.services.photo_service import PhotoService
from app.services.rate_limiter import InMemoryRateLimiter
from app.services.storage_quota_service import StorageQuotaService
from tests.fakes import (
    FakePhotoRepository,
    FakeR2Storage,
    FakeSessionRepository,
    FakeUsageRepository,
    FakeUserRepository,
)

PROD_SECRET = "prod-secret-key-with-at-least-thirty-two-chars-xyz"


def production_kwargs(**overrides) -> dict:
    """A complete, valid production configuration. Individual tests break one field at a time."""
    base = {
        "ENVIRONMENT": "production",
        "SECRET_KEY": PROD_SECRET,
        "DEBUG": False,
        "EMAIL_PROVIDER": "resend",
        "RESEND_API_KEY": "re_live_key",
        "RESEND_TEST_MODE": False,
        "GOOGLE_CLIENT_ID": "123-abc.apps.googleusercontent.com",
        "TRUSTED_PROXY_HOPS": 1,
        "PUBLIC_APP_URL": "https://api.saf-studio.example",
        "CORS_ORIGINS": ["https://app.saf-studio.example"],
        "MONGODB_URL": "mongodb+srv://app:pw@cluster0.abcde.mongodb.net/saf_studio",
        "R2_ACCOUNT_ID": "acct",
        "R2_ACCESS_KEY_ID": "key",
        "R2_SECRET_ACCESS_KEY": "secret",
    }
    base.update(overrides)
    return base


# --------------------------------------------------------------------------- production config


def test_valid_production_configuration_is_accepted():
    settings = Settings(**production_kwargs())
    assert settings.is_production


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({"SECRET_KEY": DEV_SECRET_KEY}, "SECRET_KEY"),
        ({"SECRET_KEY": "too-short"}, "SECRET_KEY"),
        ({"DEBUG": True}, "DEBUG"),
        ({"EMAIL_PROVIDER": "mock"}, "EMAIL_PROVIDER"),
        ({"RESEND_TEST_MODE": True}, "RESEND_TEST_MODE"),
        ({"GOOGLE_CLIENT_ID": ""}, "GOOGLE_CLIENT_ID"),
        ({"TRUSTED_PROXY_HOPS": 0}, "TRUSTED_PROXY_HOPS"),
        ({"PUBLIC_APP_URL": "http://localhost:5173"}, "PUBLIC_APP_URL"),
        ({"CORS_ORIGINS": ["http://localhost:5173"]}, "CORS_ORIGINS"),
        ({"MONGODB_URL": "mongodb://localhost:27017"}, "MONGODB_URL"),
        ({"R2_SECRET_ACCESS_KEY": ""}, "R2_ACCOUNT_ID"),
    ],
)
def test_production_rejects_insecure_or_missing_settings(overrides, expected):
    with pytest.raises(ValidationError) as exc_info:
        Settings(**production_kwargs(**overrides))
    assert "Invalid production configuration" in str(exc_info.value)
    assert expected in str(exc_info.value)


def test_safe_defaults_are_declared_on_the_model():
    """Checks the declared defaults (not the local .env), so developer overrides cannot skew it."""
    fields = Settings.model_fields
    assert fields["SECRET_KEY"].default == DEV_SECRET_KEY
    assert fields["EMAIL_PROVIDER"].default == "mock"
    assert fields["TRUSTED_PROXY_HOPS"].default == 0
    assert fields["STORAGE_MAINTENANCE_INTERVAL_HOURS"].default == 0
    assert "R2_MAX_UPLOAD_MB" not in fields


# --------------------------------------------------------------------------- client IP


def _request(headers: dict[str, str] | None = None, peer: str = "10.1.1.1"):
    return SimpleNamespace(headers=headers or {}, client=SimpleNamespace(host=peer))


def _with_hops(hops: int):
    return patch(
        "app.core.security.get_settings",
        return_value=SimpleNamespace(TRUSTED_PROXY_HOPS=hops),
    )


def test_client_ip_ignores_all_forwarded_headers_by_default():
    req = _request({"x-forwarded-for": "1.2.3.4", "cf-connecting-ip": "5.6.7.8"})
    with _with_hops(0):
        assert get_client_ip(req) == "10.1.1.1"


def test_client_ip_uses_rightmost_entry_with_one_trusted_hop():
    # Leftmost entries are attacker-controlled; the proxy appends the real peer on the right.
    req = _request({"x-forwarded-for": "9.9.9.9, 203.0.113.50"})
    with _with_hops(1):
        assert get_client_ip(req) == "203.0.113.50"


def test_client_ip_falls_back_to_peer_when_header_chain_is_too_short():
    req = _request({"x-forwarded-for": "203.0.113.50"})
    with _with_hops(2):
        assert get_client_ip(req) == "10.1.1.1"


def test_client_ip_ignores_cloudflare_header_even_when_proxy_trusted():
    req = _request({"cf-connecting-ip": "5.6.7.8"})
    with _with_hops(1):
        assert get_client_ip(req) == "10.1.1.1"


# --------------------------------------------------------------------------- OTP attempts


async def _seed_user(fake_user_repo: FakeUserRepository, email: str) -> None:
    now = datetime.now(UTC)
    await fake_user_repo.create(
        UserInDB(
            _id=str(ObjectId()),
            email=email,
            phone="+919800000111",
            password_hash=hash_password("OriginalPassword123!"),
            full_name="Otp User",
            role="customer",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
    )


@pytest.mark.asyncio
async def test_concurrent_wrong_otp_guesses_cannot_exceed_limit(
    client: AsyncClient,
    fake_user_repo: FakeUserRepository,
    fake_session_repo: FakeSessionRepository,
):
    """Parallel guesses must share one attempt counter: at most OTP_MAX_ATTEMPTS are evaluated."""
    email = "concurrent.otp@example.com"
    await _seed_user(fake_user_repo, email)
    email_service.mock_sent_emails.clear()
    await client.post("/api/v1/auth/forgot-password", json={"email": email})

    responses = await asyncio.gather(
        *[
            client.post(
                "/api/v1/auth/forgot-password/verify",
                json={"email": email, "otp": "000000"},
            )
            for _ in range(10)
        ]
    )
    messages = [(r.json().get("error") or {}).get("message", "") for r in responses]
    wrong_code = [m for m in messages if m.startswith("Incorrect verification code")]
    locked = [m for m in messages if "Maximum verification attempts exceeded" in m]

    assert all(r.status_code in (400, 422) for r in responses)  # nothing succeeded
    assert len(wrong_code) == 2  # attempts 1 and 2 report remaining attempts
    assert len(locked) >= 1  # attempt 3 locks the challenge
    assert len(messages) - len(wrong_code) == 8  # everything else is refused, not evaluated
    stored = next(iter(fake_session_repo.password_resets.values()))
    assert stored["attempts"] == 3


@pytest.mark.asyncio
async def test_claim_otp_attempt_refuses_expired_and_used_challenges(
    fake_session_repo: FakeSessionRepository,
):
    repo: SessionRepository | FakeSessionRepository = fake_session_repo
    from app.models.session import PasswordResetInDB

    doc = PasswordResetInDB(
        _id=str(ObjectId()),
        user_id=str(ObjectId()),
        email="claim@example.com",
        token_hash="h",
        purpose="email_otp",
        attempts=0,
        max_attempts=3,
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
        used=False,
        created_at=datetime.now(UTC),
    )
    await repo.create_password_reset(doc)
    assert (await repo.claim_otp_attempt(doc.id, 3)).attempts == 1

    fake_session_repo.password_resets["h"]["expires_at"] = datetime.now(UTC) - timedelta(minutes=1)
    assert await repo.claim_otp_attempt(doc.id, 3) is None


@pytest.mark.asyncio
async def test_password_reset_marks_email_verified(
    client: AsyncClient, fake_user_repo: FakeUserRepository
):
    email = "verify.on.reset@example.com"
    await _seed_user(fake_user_repo, email)
    email_service.mock_sent_emails.clear()
    await client.post("/api/v1/auth/forgot-password", json={"email": email})
    otp = email_service.mock_sent_emails[-1]["otp_code"]

    verified = await client.post(
        "/api/v1/auth/forgot-password/verify", json={"email": email, "otp": otp}
    )
    assert verified.status_code == 200
    reset = await client.post(
        "/api/v1/auth/forgot-password/reset",
        json={"reset_token": verified.json()["reset_token"], "new_password": "BrandNew123!"},
    )
    assert reset.status_code == 200
    user = await fake_user_repo.get_by_email(email)
    assert user.email_verified is True


# --------------------------------------------------------------------------- email quota


@pytest.mark.asyncio
async def test_unexpected_send_failure_refunds_daily_and_recipient_budget(
    client: AsyncClient, fake_user_repo: FakeUserRepository, fake_usage_repo: FakeUsageRepository
):
    email = "refund.check@example.com"
    await _seed_user(fake_user_repo, email)
    with patch.object(email_service, "send_otp_email", AsyncMock(side_effect=RuntimeError("boom"))):
        res = await client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert res.status_code == 500  # unexpected error surfaces as a generic server error

    day = datetime.now(UTC).strftime("%Y-%m-%d")
    month = datetime.now(UTC).strftime("%Y-%m")
    assert fake_usage_repo.counters.get(f"email:day:{day}", {}).get("count", 0) == 0
    assert fake_usage_repo.counters.get(f"email:month:{month}", {}).get("count", 0) == 0
    recipient_counts = [
        c["count"]
        for key, c in fake_usage_repo.counters.items()
        if key.startswith("email:recipient:")
    ]
    assert recipient_counts and all(count == 0 for count in recipient_counts)


@pytest.mark.asyncio
async def test_mock_outbox_is_bounded():
    service = EmailService()
    for i in range(250):
        await service.send_otp_email(to_email=f"u{i}@example.com", otp_code="123456")
    assert len(service.mock_sent_emails) == 200
    assert service.mock_sent_emails[-1]["to"] == "u249@example.com"


# --------------------------------------------------------------------------- photo library limit


def _jpeg_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (640, 480), (120, 80, 40)).save(buf, format="JPEG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_library_limit_is_enforced_after_insert_and_rolls_back(
    fake_photo_repo: FakePhotoRepository,
    fake_r2_storage: FakeR2Storage,
    fake_usage_repo: FakeUsageRepository,
    monkeypatch,
):
    """An upload that passed the pre-check must still be rejected by the post-insert recount."""
    service = PhotoService(
        photo_repo=fake_photo_repo,
        image_service=ImageProcessingService(),
        r2_storage=fake_r2_storage,
        storage_quota=StorageQuotaService(usage_repo=fake_usage_repo, r2_storage=fake_r2_storage),
    )
    calls = {"n": 0}

    async def racing_sum(user_id: str) -> int:
        calls["n"] += 1
        # First call (pre-check) looks empty; the recount after insert sees the limit exceeded.
        return 0 if calls["n"] == 1 else 10**12

    monkeypatch.setattr(fake_photo_repo, "sum_active_storage_bytes", racing_sum)
    with pytest.raises(UserStorageQuotaExceededException):
        await service.upload_photo(
            user_id=str(ObjectId()),
            filename="race.jpg",
            file_bytes=_jpeg_bytes(),
            declared_content_type="image/jpeg",
        )
    assert fake_photo_repo.photos == {}
    assert fake_r2_storage.objects == {}
    assert calls["n"] == 2


# --------------------------------------------------------------------------- rate limiter memory


def test_rate_limiter_prunes_idle_keys():
    limiter = InMemoryRateLimiter()
    now = 1_000_000.0
    with patch.object(rate_limiter_module.time, "time", return_value=now):
        for i in range(50):
            limiter.check_rate_limit(f"ip:{i}", max_attempts=5, window_seconds=60)
    assert len(limiter._requests) == 50

    later = now + 10_000  # every window has long expired
    with patch.object(rate_limiter_module.time, "time", return_value=later):
        limiter.check_rate_limit("ip:new", max_attempts=5, window_seconds=60)
    assert set(limiter._requests) == {"ip:new"}
