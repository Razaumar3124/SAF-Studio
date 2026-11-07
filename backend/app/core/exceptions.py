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
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or []


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
