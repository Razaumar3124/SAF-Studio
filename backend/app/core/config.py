from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables and .env file."""

    # Application metadata
    APP_NAME: str = Field(default="SAF Studio API", description="Human-readable application name")
    VERSION: str = Field(default="0.1.0", description="API version string")
    ENVIRONMENT: Literal["development", "staging", "production", "test"] = Field(
        default="development",
        description="Application running environment",
    )
    DEBUG: bool = Field(default=False, description="Enable debug mode and verbose documentation")
    HOST: str = Field(default="0.0.0.0", description="Server bind host")
    PORT: int = Field(default=8000, description="Server bind port")
    API_V1_STR: str = Field(default="/api/v1", description="URL prefix for API version 1")

    # MongoDB connection settings
    MONGODB_URL: str = Field(
        default="mongodb://localhost:27017",
        description="MongoDB connection URI",
    )
    DATABASE_NAME: str = Field(
        default="saf_studio",
        description="MongoDB database name",
    )
    MONGODB_TIMEOUT_MS: int = Field(
        default=5000,
        description="Connection and server selection timeout in milliseconds",
    )

    # CORS settings
    CORS_ORIGINS: list[str] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173"],
        description="List of allowed CORS origins",
    )

    # Structured logging level
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(
        default="INFO",
        description="Application log level",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        if isinstance(v, (list, str)):
            return v  # type: ignore[return-value]
        raise ValueError("CORS_ORIGINS must be a list or comma-separated string")

    @field_validator("CORS_ORIGINS")
    @classmethod
    def validate_production_cors(cls, v: list[str], info) -> list[str]:
        # Disallow wildcard CORS in production
        env = info.data.get("ENVIRONMENT", "development")
        if env == "production" and ("*" in v or not v):
            raise ValueError("Wildcard or empty CORS_ORIGINS is forbidden in production")
        return v

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT in ("development", "test")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Singleton getter for application settings."""
    return Settings()
