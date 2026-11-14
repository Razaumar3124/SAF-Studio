from typing import Any

from fastapi import status


class AppException(Exception):
    """Base application exception supporting standard error envelope fields."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: list[dict[str, Any]] | None = None,
        headers: dict[str, str] | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or []
        self.headers = headers or {}


class DatabaseUnavailableException(AppException):
    """Raised when the database connection fails or times out."""

    def __init__(
        self,
        message: str = "Database service is currently unreachable",
        issue: str = "MongoDB ping timed out or connection failed",
    ):
        super().__init__(
            message=message,
            code="DATABASE_UNAVAILABLE",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details=[{"field": "database", "issue": issue}],
        )


class ResourceNotFoundException(AppException):
    """Raised when a requested resource is not found."""

    def __init__(self, message: str = "Requested resource was not found", field: str = "id"):
        super().__init__(
            message=message,
            code="RESOURCE_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            details=[{"field": field, "issue": message}],
        )


class ValidationException(AppException):
    """Raised for manual business logic validation failures."""

    def __init__(self, message: str, details: list[dict[str, Any]] | None = None):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details=details or [],
        )


class ConflictException(AppException):
    """Raised when an entity conflict occurs (e.g. duplicate email/phone)."""

    def __init__(self, message: str, field: str, issue: str):
        super().__init__(
            message=message,
            code="RESOURCE_CONFLICT",
            status_code=status.HTTP_409_CONFLICT,
            details=[{"field": field, "issue": issue}],
        )


class AccountAlreadyExistsException(AppException):
    """Raised when attempting to register with an already-used email or phone."""

    def __init__(self, field: str, issue: str):
        super().__init__(
            message="An account with this email or mobile number already exists.",
            code="ACCOUNT_ALREADY_EXISTS",
            status_code=status.HTTP_409_CONFLICT,
            details=[{"field": field, "issue": issue}],
        )


class InvalidCredentialsException(AppException):
    """Raised when credentials do not match records (deliberately non-enumerating)."""

    def __init__(
        self,
        message: str = "Those details don’t match our records. Check them and try again.",
    ):
        super().__init__(
            message=message,
            code="INVALID_CREDENTIALS",
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=[],
        )


class AccountDisabledException(AppException):
    """Raised when attempting to authenticate with a deactivated account."""

    def __init__(
        self,
        message: str = "This account has been deactivated. Please contact support.",
    ):
        super().__init__(
            message=message,
            code="ACCOUNT_DISABLED",
            status_code=status.HTTP_403_FORBIDDEN,
            details=[],
        )


class InvalidTokenException(AppException):
    """Raised when an access or refresh token is malformed, invalid, or forged."""

    def __init__(self, message: str = "Invalid or malformed authentication token."):
        super().__init__(
            message=message,
            code="INVALID_TOKEN",
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=[],
        )


class TokenExpiredException(AppException):
    """Raised when an access or refresh token has expired."""

    def __init__(self, message: str = "Authentication token has expired. Please log in again."):
        super().__init__(
            message=message,
            code="TOKEN_EXPIRED",
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=[],
        )


class TokenRevokedException(AppException):
    """Raised when a refresh token has been revoked or re-used."""

    def __init__(self, message: str = "Session has been revoked or expired. Please sign in again."):
        super().__init__(
            message=message,
            code="TOKEN_REVOKED",
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=[],
        )


class InvalidGoogleTokenException(AppException):
    """Raised when Google ID token fails cryptographic verification."""

    def __init__(self, message: str = "Google authentication token could not be verified."):
        super().__init__(
            message=message,
            code="INVALID_GOOGLE_TOKEN",
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=[],
        )


class GoogleSignInUnavailableException(AppException):
    """Raised when Google sign-in is requested but the server has no GOOGLE_CLIENT_ID configured."""

    def __init__(self, message: str = "Google sign-in is not available right now."):
        super().__init__(
            message=message,
            code="GOOGLE_SIGNIN_UNAVAILABLE",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details=[],
        )


class GoogleLinkRequiresVerificationException(AppException):
    """Raised when a Google sign-in matches an existing password account whose email is unproven."""

    def __init__(
        self,
        message: str = (
            "An account with this email already exists. Reset your password to verify the "
            "email address, then you can sign in with Google."
        ),
    ):
        super().__init__(
            message=message,
            code="GOOGLE_LINK_REQUIRES_VERIFICATION",
            status_code=status.HTTP_409_CONFLICT,
            details=[],
        )


class RateLimitExceededException(AppException):
    """Raised when a client exceeds rate limits."""

    def __init__(
        self,
        message: str = "Too many attempts. Please wait a minute and try again.",
    ):
        super().__init__(
            message=message,
            code="RATE_LIMIT_EXCEEDED",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details=[],
        )


class ForbiddenException(AppException):
    """Raised when an authenticated user attempts to access or mutate an unowned resource."""

    def __init__(
        self,
        message: str = "You do not have permission to access or modify this resource.",
        field: str = "id",
    ):
        super().__init__(
            message=message,
            code="FORBIDDEN",
            status_code=status.HTTP_403_FORBIDDEN,
            details=[{"field": field, "issue": message}],
        )


class EmailQuotaExceededException(AppException):
    """Raised when a daily/monthly email quota (app-wide or per recipient) is exhausted.

    `scope` is "day" or "month" for the app-wide Resend quota and "recipient" for the
    per-address daily allowance. `retry_after` is the number of seconds until the quota resets.
    """

    MESSAGES = {
        "day": (
            "We've reached today's limit for sending verification codes. Please try again tomorrow."
        ),
        "month": (
            "We've reached this month's limit for sending verification codes. "
            "Please try again next month or contact us on WhatsApp for help."
        ),
        "recipient": (
            "You've reached today's limit for verification codes. Please try again tomorrow."
        ),
    }

    def __init__(self, scope: str, retry_after: int):
        self.scope = scope
        self.retry_after = max(1, int(retry_after))
        super().__init__(
            message=self.MESSAGES.get(scope, self.MESSAGES["day"]),
            code=(
                "EMAIL_RECIPIENT_LIMIT_REACHED" if scope == "recipient" else "EMAIL_QUOTA_EXCEEDED"
            ),
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details=[{"field": "email", "issue": f"Email {scope} quota reached"}],
            headers={"Retry-After": str(self.retry_after)},
        )


class StorageQuotaExceededException(AppException):
    """Raised when accepting an upload would push total R2 storage past the hard cap."""

    def __init__(self) -> None:
        super().__init__(
            message=(
                "Photo uploads are temporarily paused because our storage is full. "
                "Your existing photos and designs are safe."
            ),
            code="STORAGE_QUOTA_EXCEEDED",
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            details=[{"field": "file", "issue": "Storage capacity reached"}],
        )


class UserStorageQuotaExceededException(AppException):
    """Raised when a user's photo library would exceed the per-user storage limit."""

    def __init__(self, limit_mb: int) -> None:
        super().__init__(
            message=(
                f"Your photo library is full ({limit_mb} MB). "
                "Remove a few photos you no longer need to upload more."
            ),
            code="USER_STORAGE_LIMIT_REACHED",
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            details=[
                {"field": "file", "issue": f"Per-user storage limit of {limit_mb} MB reached"}
            ],
        )


class DatabaseStorageFullException(AppException):
    """Raised when MongoDB Atlas rejects a write because the storage quota is exhausted."""

    def __init__(self) -> None:
        super().__init__(
            message=(
                "We couldn't save this right now because our database storage is full. "
                "Your existing designs and photos are safe. Please try again later."
            ),
            code="DATABASE_STORAGE_FULL",
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            details=[{"field": "database", "issue": "Database storage quota reached"}],
        )


class StorageUnavailableException(AppException):
    """Raised when object storage (Cloudflare R2) is unreachable or fails."""

    def __init__(
        self,
        message: str = "Storage service is currently unavailable. Please try again later.",
        issue: str = "R2 storage operation timed out or failed",
    ):
        super().__init__(
            message=message,
            code="STORAGE_UNAVAILABLE",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details=[{"field": "storage", "issue": issue}],
        )
