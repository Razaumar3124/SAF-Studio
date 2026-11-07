from fastapi import APIRouter

from app.api.v1.endpoints import health

api_v1_router = APIRouter()

# Register Phase 1 endpoints
api_v1_router.include_router(health.router)
