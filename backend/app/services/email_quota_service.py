"""Daily / monthly transactional email budget (Resend free tier: 100/day, 3,000/month).

Counters are keyed by UTC calendar day and month (Resend resets at midnight UTC), are stored
in MongoDB so they hold across workers and restarts, and expire automatically once the period
is over: that expiry *is* the quota reset.
"""

import hashlib
import logging
from datetime import UTC, datetime, timedelta

from app.core.config import get_settings
from app.core.exceptions import EmailQuotaExceededException
from app.repositories.usage_repository import UsageRepository

logger = logging.getLogger("saf_studio.email_quota")


def _next_utc_midnight(now: datetime) -> datetime:
    return datetime(now.year, now.month, now.day, tzinfo=UTC) + timedelta(days=1)


def _next_utc_month(now: datetime) -> datetime:
    if now.month == 12:
        return datetime(now.year + 1, 1, 1, tzinfo=UTC)
    return datetime(now.year, now.month + 1, 1, tzinfo=UTC)


class EmailQuotaService:
    """Enforces app-wide and per-recipient email limits with atomic counters."""

    def __init__(self, usage_repo: UsageRepository) -> None:
        self.usage_repo = usage_repo

    # ---- keys -------------------------------------------------------------

    @staticmethod
    def _day_key(now: datetime) -> str:
        return f"email:day:{now:%Y-%m-%d}"

    @staticmethod
    def _month_key(now: datetime) -> str:
        return f"email:month:{now:%Y-%m}"

    @staticmethod
    def _recipient_key(now: datetime, email: str) -> str:
        # Hash the address so counters never store plaintext emails.
        digest = hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()[:32]
        return f"email:recipient:{now:%Y-%m-%d}:{digest}"

    @staticmethod
    def _retry_after(now: datetime, scope: str) -> int:
        reset = _next_utc_month(now) if scope == "month" else _next_utc_midnight(now)
        return int((reset - now).total_seconds()) + 1

    def _exceeded(self, now: datetime, scope: str) -> EmailQuotaExceededException:
        return EmailQuotaExceededException(scope=scope, retry_after=self._retry_after(now, scope))

    @staticmethod
    def _expiry(now: datetime, scope: str) -> datetime:
        # Keep counters slightly past their period so the TTL monitor never deletes them early.
        reset = _next_utc_month(now) if scope == "month" else _next_utc_midnight(now)
        return reset + timedelta(days=1)

    # ---- per-recipient allowance ---------------------------------------------

    async def consume_recipient_allowance(self, email: str) -> None:
        """Count one verification-code request for this address today (any address, registered
        or not, so the response never reveals whether an account exists)."""
        settings = get_settings()
        now = datetime.now(UTC)
        ok = await self.usage_repo.increment_counter(
            self._recipient_key(now, email),
            settings.EMAIL_PER_RECIPIENT_DAILY_LIMIT,
            self._expiry(now, "day"),
        )
        if not ok:
            logger.info("Per-recipient daily email limit reached")
            raise self._exceeded(now, "recipient")

    async def refund_recipient_allowance(self, email: str) -> None:
        await self.usage_repo.decrement_counter(self._recipient_key(datetime.now(UTC), email))

    # ---- app-wide quota -------------------------------------------------------

    async def ensure_available(self) -> None:
        """Fail fast (without consuming) if today's or this month's quota is already used up."""
        settings = get_settings()
        now = datetime.now(UTC)
        if await self.usage_repo.get_counter(self._day_key(now)) >= settings.EMAIL_DAILY_LIMIT:
            raise self._exceeded(now, "day")
        if await self.usage_repo.get_counter(self._month_key(now)) >= settings.EMAIL_MONTHLY_LIMIT:
            raise self._exceeded(now, "month")

    async def reserve_send(self) -> None:
        """Atomically consume one email from today's and this month's budget."""
        settings = get_settings()
        now = datetime.now(UTC)
        day_key, month_key = self._day_key(now), self._month_key(now)

        if not await self.usage_repo.increment_counter(
            day_key, settings.EMAIL_DAILY_LIMIT, self._expiry(now, "day")
        ):
            logger.warning("Daily email quota exhausted (%d)", settings.EMAIL_DAILY_LIMIT)
            raise self._exceeded(now, "day")

        if not await self.usage_repo.increment_counter(
            month_key, settings.EMAIL_MONTHLY_LIMIT, self._expiry(now, "month")
        ):
            await self.usage_repo.decrement_counter(day_key)
            logger.warning("Monthly email quota exhausted (%d)", settings.EMAIL_MONTHLY_LIMIT)
            raise self._exceeded(now, "month")

    async def refund_send(self) -> None:
        """Give back a reserved email when the provider definitely did not send it."""
        now = datetime.now(UTC)
        await self.usage_repo.decrement_counter(self._day_key(now))
        await self.usage_repo.decrement_counter(self._month_key(now))

    async def mark_provider_exhausted(self, scope: str) -> None:
        """Resend reported its quota is used up: stop calling it until the period resets."""
        settings = get_settings()
        now = datetime.now(UTC)
        if scope == "month":
            await self.usage_repo.saturate_counter(
                self._month_key(now), settings.EMAIL_MONTHLY_LIMIT, self._expiry(now, "month")
            )
        else:
            await self.usage_repo.saturate_counter(
                self._day_key(now), settings.EMAIL_DAILY_LIMIT, self._expiry(now, "day")
            )
