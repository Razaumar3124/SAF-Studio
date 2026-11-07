from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    frame_materials,
    frames,
    health,
    photos,
    templates,
)

api_v1_router = APIRouter()

# Register Phase 1 endpoints
api_v1_router.include_router(health.router)

# Register Phase 2 endpoints
api_v1_router.include_router(auth.router)

# Register Phase 3 endpoints
api_v1_router.include_router(frame_materials.router)
api_v1_router.include_router(frames.router)
api_v1_router.include_router(templates.router)

# Register Phase 4 endpoints
api_v1_router.include_router(photos.router)
