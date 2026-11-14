"""Email quota safeguards: per-recipient and app-wide (daily/monthly) limits, refunds,
OTP failure handling, provider 429 handling, concurrency and UTC reset."""

import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from bson import ObjectId
from httpx import AsyncClient

from app.core.config import Settings, get_settings
from app.core.exceptions import EmailQuotaExceededException
from app.core.security import hash_password
from app.models.user import UserInDB
from app.services import email_quota_service as eq_module
from app.services.email_quota_service import EmailQuotaService
from app.services.email_service import EmailDeliveryException, EmailService, email_service
from tests.fakes import FakeSessionRepository, FakeUsageRepository, FakeUserRepository

EMAIL = "quota.user@safstudio.com"


@pytest.fixture(autouse=True)
async def relaxed_limits(monkeypatch, fake_user_repo: FakeUserRepository):
    """Disable the cooldown and in-memory limiters so only the quota logic is exercised."""
    settings = get_settings()
    monkeypatch.setattr(settings, "EMAIL_OTP_COOLDOWN_SECONDS", 0)
    monkeypatch.setattr(settings, "RATE_LIMIT_FORGOT_PASSWORD_MAX_ATTEMPTS", 1000)
    monkeypatch.setattr(settings, "RATE_LIMIT_FORGOT_PASSWORD_IP_MAX_ATTEMPTS", 1000)
    email_service.mock_sent_emails.clear()

    now = datetime.now(UTC)
    await fake_user_repo.create(
        UserInDB(
            _id=str(ObjectId()),
            email=EMAIL,
            phone="+919800000001",
            password_hash=hash_password("OriginalPassword123!"),
            full_name="Quota User",
            role="customer",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
    )
    yield
    email_service.mock_sent_emails.clear()


def day_key() -> str:
    return f"email:day:{datetime.now(UTC):%Y-%m-%d}"


def month_key() -> str:
    return f"email:month:{datetime.now(UTC):%Y-%m}"


async def forgot(client: AsyncClient, email: str = EMAIL):
    return await client.post("/api/v1/auth/forgot-password", json={"email": email})


# --------------------------------------------------------------- per recipient


@pytest.mark.asyncio
async def test_recipient_limited_to_five_codes_per_day(client: AsyncClient):
    for _ in range(5):
        assert (await forgot(client)).status_code == 200
    assert len(email_service.mock_sent_emails) == 5

    blocked = await forgot(client)
    assert blocked.status_code == 429
    body = blocked.json()["error"]
    assert body["code"] == "EMAIL_RECIPIENT_LIMIT_REACHED"
    assert "try again tomorrow" in body["message"].lower()
    retry_after = int(blocked.headers["retry-after"])
    assert 0 < retry_after <= 86401
    assert len(email_service.mock_sent_emails) == 5


@pytest.mark.asyncio
async def test_recipient_limit_applies_to_unknown_addresses_too(client: AsyncClient):
    """Unregistered addresses hit the same limit, so the response never reveals accounts."""
    for _ in range(5):
        assert (await forgot(client, "nobody@safstudio.com")).status_code == 200
    blocked = await forgot(client, "nobody@safstudio.com")
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "EMAIL_RECIPIENT_LIMIT_REACHED"
    assert email_service.mock_sent_emails == []


@pytest.mark.asyncio
async def test_recipient_counter_does_not_store_plaintext_email(
    client: AsyncClient, fake_usage_repo: FakeUsageRepository
):
    await forgot(client)
    assert all(EMAIL not in key for key in fake_usage_repo.counters)


# ------------------------------------------------------------------ app-wide


@pytest.mark.asyncio
@pytest.mark.parametrize("registered", [True, False])
async def test_daily_quota_exhausted_returns_friendly_429(
    client: AsyncClient, fake_usage_repo: FakeUsageRepository, registered: bool
):
    fake_usage_repo.counters[day_key()] = {"count": 100, "expires_at": datetime.now(UTC)}

    resp = await forgot(client, EMAIL if registered else "stranger@safstudio.com")
    assert resp.status_code == 429
    err = resp.json()["error"]
    assert err["code"] == "EMAIL_QUOTA_EXCEEDED"
    assert err["message"] == (
        "We've reached today's limit for sending verification codes. Please try again tomorrow."
    )
    assert "retry-after" in resp.headers
    assert email_service.mock_sent_emails == []


@pytest.mark.asyncio
async def test_full_daily_quota_of_100_is_usable(
    client: AsyncClient, fake_usage_repo: FakeUsageRepository
):
    fake_usage_repo.counters[day_key()] = {"count": 99, "expires_at": datetime.now(UTC)}
    assert (await forgot(client)).status_code == 200  # the 100th email still goes out
    assert fake_usage_repo.counters[day_key()]["count"] == 100
    assert (await forgot(client)).status_code == 429


@pytest.mark.asyncio
async def test_monthly_quota_exhausted(client: AsyncClient, fake_usage_repo: FakeUsageRepository):
    fake_usage_repo.counters[month_key()] = {"count": 3000, "expires_at": datetime.now(UTC)}
    resp = await forgot(client)
    assert resp.status_code == 429
    err = resp.json()["error"]
    assert err["code"] == "EMAIL_QUOTA_EXCEEDED"
    assert "this month" in err["message"]


@pytest.mark.asyncio
async def test_quota_block_does_not_burn_recipient_allowance(
    client: AsyncClient, fake_usage_repo: FakeUsageRepository
):
    fake_usage_repo.counters[day_key()] = {"count": 100, "expires_at": datetime.now(UTC)}
    for _ in range(8):
        assert (await forgot(client)).status_code == 429
    recipient_counts = [
        v["count"] for k, v in fake_usage_repo.counters.items() if k.startswith("email:recipient")
    ]
    assert recipient_counts == [0]


# --------------------------------------------------- OTP failure handling


@pytest.mark.asyncio
async def test_failed_send_keeps_previous_code_valid_and_refunds_quota(
    client: AsyncClient,
    fake_session_repo: FakeSessionRepository,
    fake_usage_repo: FakeUsageRepository,
):
    assert (await forgot(client)).status_code == 200
    first_code = email_service.mock_sent_emails[-1]["otp_code"]

    failure = EmailDeliveryException(message="Network error", may_have_been_sent=False)
    with patch.object(email_service, "send_otp_email", AsyncMock(side_effect=failure)):
        resp = await forgot(client)
    assert resp.status_code == 503

    # The day counter reflects only the email that was actually sent
    assert fake_usage_repo.counters[day_key()]["count"] == 1
    # No orphan OTP was stored and the first code still works
    active = [d for d in fake_session_repo.password_resets.values() if not d["used"]]
    assert len(active) == 1
    verify = await client.post(
        "/api/v1/auth/forgot-password/verify", json={"email": EMAIL, "otp": first_code}
    )
    assert verify.status_code == 200


@pytest.mark.asyncio
async def test_ambiguous_failure_keeps_quota_consumed(
    client: AsyncClient, fake_usage_repo: FakeUsageRepository
):
    """A timeout after the request was sent may still deliver: the email stays counted."""
    failure = EmailDeliveryException(message="Timed out", may_have_been_sent=True)
    with patch.object(email_service, "send_otp_email", AsyncMock(side_effect=failure)):
        assert (await forgot(client)).status_code == 503
    assert fake_usage_repo.counters[day_key()]["count"] == 1


@pytest.mark.asyncio
async def test_provider_quota_429_saturates_counter_and_stops_calls(
    client: AsyncClient, fake_usage_repo: FakeUsageRepository
):
    provider_full = EmailQuotaExceededException(scope="day", retry_after=60)
    mock_send = AsyncMock(side_effect=provider_full)
    with patch.object(email_service, "send_otp_email", mock_send):
        first = await forgot(client)
        second = await forgot(client)
    assert first.status_code == 429 and second.status_code == 429
    assert first.json()["error"]["code"] == "EMAIL_QUOTA_EXCEEDED"
    assert fake_usage_repo.counters[day_key()]["count"] >= 100
    assert mock_send.await_count == 1  # second request never reached the provider


# ------------------------------------------------------------- concurrency


@pytest.mark.asyncio
async def test_concurrent_reservations_never_exceed_daily_limit(monkeypatch):
    monkeypatch.setattr(get_settings(), "EMAIL_DAILY_LIMIT", 10)
    quota = EmailQuotaService(FakeUsageRepository())

    async def attempt() -> bool:
        try:
            await quota.reserve_send()
            return True
        except EmailQuotaExceededException:
            return False

    results = await asyncio.gather(*(attempt() for _ in range(40)))
    assert sum(results) == 10


@pytest.mark.asyncio
async def test_concurrent_forgot_password_requests_respect_quota(
    client: AsyncClient, fake_usage_repo: FakeUsageRepository, monkeypatch
):
    monkeypatch.setattr(get_settings(), "EMAIL_DAILY_LIMIT", 3)
    responses = await asyncio.gather(*(forgot(client) for _ in range(5)))
    statuses = sorted(r.status_code for r in responses)
    assert statuses.count(200) == 3
    assert statuses.count(429) == 2
    assert fake_usage_repo.counters[day_key()]["count"] == 3
    assert len(email_service.mock_sent_emails) == 3


# ------------------------------------------------------------------- reset


@pytest.mark.asyncio
async def test_daily_quota_resets_at_utc_midnight(monkeypatch):
    repo = FakeUsageRepository()
    quota = EmailQuotaService(repo)
    monkeypatch.setattr(get_settings(), "EMAIL_DAILY_LIMIT", 1)

    today = datetime(2026, 11, 14, 23, 59, 30, tzinfo=UTC)

    class FrozenToday(datetime):
        @classmethod
        def now(cls, tz=None):
            return today

    class FrozenTomorrow(datetime):
        @classmethod
        def now(cls, tz=None):
            return today + timedelta(minutes=1)

    monkeypatch.setattr(eq_module, "datetime", FrozenToday)
    await quota.reserve_send()
    with pytest.raises(EmailQuotaExceededException) as exc:
        await quota.reserve_send()
    assert exc.value.retry_after == 31  # seconds until 00:00 UTC (+1)

    monkeypatch.setattr(eq_module, "datetime", FrozenTomorrow)
    await quota.reserve_send()  # new UTC day, new budget


# ------------------------------------------------------- Resend responses


def _resend_settings() -> Settings:
    return Settings(
        ENVIRONMENT="development",
        SECRET_KEY="test-secret-key-min-32-chars-resend-quota-saf",
        EMAIL_PROVIDER="resend",
        RESEND_API_KEY="re_test_dummy_key_not_real",
        RESEND_TEST_MODE=False,
    )


def _resp(status: int, body: dict, headers: dict | None = None) -> httpx.Response:
    return httpx.Response(
        status_code=status,
        json=body,
        headers=headers or {},
        request=httpx.Request("POST", "https://api.resend.com/emails"),
    )


@pytest.mark.asyncio
async def test_resend_daily_quota_429_maps_to_quota_exception():
    service = EmailService()
    body = {"statusCode": 429, "name": "daily_quota_exceeded", "message": "Daily quota exceeded"}
    with patch("app.services.email_service.get_settings", return_value=_resend_settings()):
        with patch("httpx.AsyncClient.post", AsyncMock(return_value=_resp(429, body))):
            with pytest.raises(EmailQuotaExceededException) as exc:
                await service.send_otp_email("a@example.com", "123456")
    assert exc.value.scope == "day"


@pytest.mark.asyncio
async def test_resend_rate_limit_is_retried_once():
    service = EmailService()
    limited = _resp(429, {"name": "rate_limit_exceeded"}, {"retry-after": "1"})
    ok = _resp(200, {"id": "email_1"})
    post = AsyncMock(side_effect=[limited, ok])
    with patch("app.services.email_service.get_settings", return_value=_resend_settings()):
        with patch("httpx.AsyncClient.post", post):
            with patch("app.services.email_service.asyncio.sleep", AsyncMock()) as sleep:
                assert await service.send_otp_email("a@example.com", "123456") is True
    assert post.await_count == 2
    sleep.assert_awaited_once()


@pytest.mark.asyncio
async def test_resend_persistent_rate_limit_is_not_counted_as_sent():
    service = EmailService()
    limited = _resp(429, {"name": "rate_limit_exceeded"})
    with patch("app.services.email_service.get_settings", return_value=_resend_settings()):
        with patch("httpx.AsyncClient.post", AsyncMock(return_value=limited)):
            with patch("app.services.email_service.asyncio.sleep", AsyncMock()):
                with pytest.raises(EmailDeliveryException) as exc:
                    await service.send_otp_email("a@example.com", "123456")
    assert exc.value.may_have_been_sent is False
    assert "busy" in exc.value.message


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("error", "may_have_been_sent"),
    [
        (httpx.ConnectError("refused"), False),
        (httpx.ConnectTimeout("connect timeout"), False),
        (httpx.ReadTimeout("read timeout"), True),
    ],
)
async def test_transport_failures_classify_delivery_uncertainty(error, may_have_been_sent):
    service = EmailService()
    with patch("app.services.email_service.get_settings", return_value=_resend_settings()):
        with patch("httpx.AsyncClient.post", AsyncMock(side_effect=error)):
            with pytest.raises(EmailDeliveryException) as exc:
                await service.send_otp_email("a@example.com", "123456")
    assert exc.value.may_have_been_sent is may_have_been_sent


@pytest.mark.asyncio
async def test_health_check_makes_no_network_call():
    service = EmailService()
    with patch("app.services.email_service.get_settings", return_value=_resend_settings()):
        with patch("httpx.AsyncClient.get") as mock_get:
            health = await service.check_health()
    assert health["status"] == "ready"
    assert not mock_get.called
