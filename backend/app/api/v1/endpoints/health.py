import time

from fastapi import APIRouter, Depends, status

from app.core.config import Settings, get_settings
from app.db.mongodb import mongo_manager
from app.schemas.common import ApiErrorResponse
from app.schemas.health import (
    DatabaseHealthStatus,
    HealthLiveResponse,
    HealthReadyResponse,
)

router = APIRouter(prefix="/health", tags=["Health & Operations"])

# Module-level start time for uptime calculation
_APP_START_TIME = time.time()


@router.get(
    "/live",
    response_model=HealthLiveResponse,
    status_code=status.HTTP_200_OK,
    summary="Liveness check",
    description="Confirms that the FastAPI service is running and accepting HTTP requests.",
)
async def health_live(
    settings: Settings = Depends(get_settings),
) -> HealthLiveResponse:
    """Liveness probe. Does not depend on external services."""
    uptime = round(time.time() - _APP_START_TIME, 2)
    return HealthLiveResponse(
        status="ok",
        service="saf-studio-api",
        version=settings.VERSION,
        uptime_seconds=uptime,
    )


@router.get(
    "/ready",
    response_model=HealthReadyResponse,
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "model": ApiErrorResponse,
            "description": "Database or external service unreachable",
        }
    },
    summary="Readiness check",
    description="Confirms that the application can communicate with MongoDB.",
)
async def health_ready(
    settings: Settings = Depends(get_settings),
) -> HealthReadyResponse:
    """Readiness probe. Pings MongoDB and returns latency."""
    latency_ms = await mongo_manager.ping()

    return HealthReadyResponse(
        status="ready",
        service="saf-studio-api",
        database=DatabaseHealthStatus(
            connected=True,
            status="connected",
            latency_ms=latency_ms,
        ),
    )
