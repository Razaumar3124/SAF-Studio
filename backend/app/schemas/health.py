from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field


class HealthLiveResponse(BaseModel):
    """Response schema for GET /api/v1/health/live."""

    status: str = Field(default="ok", description="Liveness status indicator", examples=["ok"])
    service: str = Field(
        default="saf-studio-api",
        description="Service identifier",
        examples=["saf-studio-api"],
    )
    version: str = Field(default="0.1.0", description="API application version", examples=["0.1.0"])
    uptime_seconds: float = Field(
        ...,
        description="Application uptime in seconds",
        examples=[124.5],
    )

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "status": "ok",
                "service": "saf-studio-api",
                "version": "0.1.0",
                "uptime_seconds": 3600.0,
            }
        },
    )


class DatabaseHealthStatus(BaseModel):
    """Detailed health status for the MongoDB database connection."""

    connected: bool = Field(default=True, description="Whether MongoDB is reachable")
    status: str = Field(default="connected", description="Connection status message")
    latency_ms: float | None = Field(
        default=None,
        description="Round-trip ping latency in milliseconds",
        examples=[1.2],
    )

    model_config = ConfigDict(extra="forbid")


class HealthReadyResponse(BaseModel):
    """Response schema for GET /api/v1/health/ready."""

    status: str = Field(
        default="ready",
        description="Readiness status indicator",
        examples=["ready"],
    )
    service: str = Field(
        default="saf-studio-api",
        description="Service identifier",
        examples=["saf-studio-api"],
    )
    database: DatabaseHealthStatus = Field(
        ...,
        description="Database connectivity details",
    )
    timestamp: str = Field(
        default_factory=lambda: datetime.now(UTC).isoformat(),
        description="Readiness verification timestamp",
    )

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "status": "ready",
                "service": "saf-studio-api",
                "database": {
                    "connected": True,
                    "status": "connected",
                    "latency_ms": 1.2,
                },
                "timestamp": "2026-11-07T12:00:00.000Z",
            }
        },
    )
