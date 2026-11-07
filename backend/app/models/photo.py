from datetime import UTC, datetime

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field

from app.models.user import PyObjectId


class PhotoInDB(BaseModel):
    """Internal MongoDB document model for photos collection."""

    id: PyObjectId = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    user_id: PyObjectId
    original_filename: str
    storage_key: str
    thumbnail_key: str
    preview_key: str
    storage_provider: str = Field(default="cloudflare_r2")
    bucket: str
    mime_type: str
    file_size_bytes: int
    width_px: int
    height_px: int
    aspect_ratio: float
    suggested_orientation: str
    status: str = Field(default="ready")
    is_deleted: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str},
    )
