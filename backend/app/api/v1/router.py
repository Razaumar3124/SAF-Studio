from fastapi import APIRouter

from app.api.v1.endpoints import auth, health

api_v1_router = APIRouter()

# Register Phase 1 endpoints
api_v1_router.include_router(health.router)

# Register Phase 2 endpoints
api_v1_router.include_router(auth.router)
