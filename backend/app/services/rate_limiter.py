import time
from collections import defaultdict
from threading import Lock

from app.core.exceptions import RateLimitExceededException

# Idle keys are swept at most this often; the largest window used by the app is one hour.
_PRUNE_INTERVAL_SECONDS = 300
_DEFAULT_WINDOW_SECONDS = 3600


class InMemoryRateLimiter:
    """Thread-safe sliding window rate limiter for authentication endpoints."""

    def __init__(self) -> None:
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._windows: dict[str, int] = {}
        self._last_prune = 0.0
        self._lock = Lock()

    def _prune_idle_keys(self, now: float) -> None:
        """Drop keys whose timestamps have all left their window (bounds memory use)."""
        if now - self._last_prune < _PRUNE_INTERVAL_SECONDS:
            return
        self._last_prune = now
        for key in list(self._requests):
            cutoff = now - self._windows.get(key, _DEFAULT_WINDOW_SECONDS)
            if not any(t > cutoff for t in self._requests[key]):
                del self._requests[key]
                self._windows.pop(key, None)

    def check_rate_limit(self, key: str, max_attempts: int, window_seconds: int) -> None:
        """Check whether the request key has exceeded maximum attempts within window.

        Raises:
            RateLimitExceededException: If rate limit threshold is breached.
        """
        now = time.time()
        cutoff = now - window_seconds

        with self._lock:
            self._prune_idle_keys(now)
            self._windows[key] = window_seconds
            # Purge entries older than the window
            timestamps = [t for t in self._requests[key] if t > cutoff]
            if len(timestamps) >= max_attempts:
                raise RateLimitExceededException()

            timestamps.append(now)
            self._requests[key] = timestamps

    def is_allowed(self, key: str, max_attempts: int, window_seconds: int) -> bool:
        """Check if request is within rate limit; records timestamp if allowed."""
        try:
            self.check_rate_limit(key, max_attempts, window_seconds)
            return True
        except RateLimitExceededException:
            return False

    def reset(self, key: str) -> None:
        """Clear rate limit entries for a specific key (e.g. after successful login)."""
        with self._lock:
            self._requests.pop(key, None)
            self._windows.pop(key, None)

    def clear_all(self) -> None:
        """Clear all rate limit entries (for test tear-down)."""
        with self._lock:
            self._requests.clear()
            self._windows.clear()


rate_limiter = InMemoryRateLimiter()
