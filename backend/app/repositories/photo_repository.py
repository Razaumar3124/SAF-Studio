from datetime import UTC, datetime

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING, IndexModel
from pymongo.asynchronous.collection import AsyncCollection
from pymongo.asynchronous.database import AsyncDatabase

from app.models.photo import PhotoInDB, VisualAnalysis


class PhotoRepository:
    """Data access repository for photos collection in MongoDB."""

    def __init__(self, db: AsyncDatabase) -> None:
        self.collection: AsyncCollection = db["photos"]

    async def create_indexes(self) -> None:
        """Create necessary indexes for photos collection idempotently."""
        indexes = [
            IndexModel(
                [
                    ("user_id", ASCENDING),
                    ("is_deleted", ASCENDING),
                    ("created_at", DESCENDING),
                ],
                name="idx_photos_user",
            ),
            # One active copy of identical bytes per user (duplicate-upload detection).
            # Legacy photos without content_hash are excluded by the partial filter.
            IndexModel(
                [("user_id", ASCENDING), ("content_hash", ASCENDING)],
                name="idx_photos_user_content_hash",
                unique=True,
                partialFilterExpression={
                    "is_deleted": False,
                    "content_hash": {"$type": "string"},
                },
            ),
        ]
        await self.collection.create_indexes(indexes)

    async def create(self, photo: PhotoInDB) -> PhotoInDB:
        """Insert photo metadata document into MongoDB."""
        doc = photo.model_dump(by_alias=True)
        doc["_id"] = ObjectId(photo.id)
        if ObjectId.is_valid(str(photo.user_id)):
            doc["user_id"] = ObjectId(str(photo.user_id))

        await self.collection.insert_one(doc)
        return photo

    async def get_by_id(
        self,
        photo_id: str,
        include_deleted: bool = False,
    ) -> PhotoInDB | None:
        """Find photo document by string ObjectId."""
        if not ObjectId.is_valid(photo_id):
            return None
        query: dict = {"_id": ObjectId(photo_id)}
        if not include_deleted:
            query["is_deleted"] = False
        doc = await self.collection.find_one(query)
        return PhotoInDB(**doc) if doc else None

    async def list_by_user(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[PhotoInDB], int]:
        """List active photographs owned by user with pagination."""
        if not ObjectId.is_valid(user_id):
            return [], 0

        query = {"user_id": ObjectId(user_id), "is_deleted": False}
        total = await self.collection.count_documents(query)

        skip = max(0, (page - 1) * page_size)
        cursor = (
            self.collection.find(query).sort("created_at", DESCENDING).skip(skip).limit(page_size)
        )

        items: list[PhotoInDB] = []
        async for doc in cursor:
            items.append(PhotoInDB(**doc))
        return items, total

    async def get_active_by_content_hash(self, user_id: str, content_hash: str) -> PhotoInDB | None:
        """Find the user's active photo with identical uploaded bytes, if any."""
        if not ObjectId.is_valid(user_id):
            return None
        doc = await self.collection.find_one(
            {"user_id": ObjectId(user_id), "content_hash": content_hash, "is_deleted": False}
        )
        return PhotoInDB(**doc) if doc else None

    async def sum_active_storage_bytes(self, user_id: str) -> int:
        """Total stored bytes of the user's active photos (legacy photos: original size)."""
        if not ObjectId.is_valid(user_id):
            return 0
        pipeline = [
            {"$match": {"user_id": ObjectId(user_id), "is_deleted": False}},
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": {"$ifNull": ["$stored_bytes", "$file_size_bytes"]}},
                }
            },
        ]
        cursor = await self.collection.aggregate(pipeline)
        docs = await cursor.to_list(length=1)
        return int(docs[0]["total"]) if docs else 0

    async def update_visual_analysis(self, photo_id: str, analysis: VisualAnalysis) -> bool:
        """Cache visual analysis on photo document."""
        if not ObjectId.is_valid(photo_id):
            return False
        res = await self.collection.update_one(
            {"_id": ObjectId(photo_id)},
            {
                "$set": {
                    "visual_analysis": analysis.model_dump(),
                    "updated_at": datetime.now(UTC),
                }
            },
        )
        return res.modified_count > 0

    async def soft_delete(self, photo_id: str, user_id: str) -> bool:
        """Mark a photo document as soft-deleted ensuring ownership."""
        if not ObjectId.is_valid(photo_id) or not ObjectId.is_valid(user_id):
            return False

        res = await self.collection.update_one(
            {
                "_id": ObjectId(photo_id),
                "user_id": ObjectId(user_id),
                "is_deleted": False,
            },
            {
                "$set": {
                    "is_deleted": True,
                    "updated_at": datetime.now(UTC),
                }
            },
        )
        return res.modified_count > 0

    async def hard_delete(self, photo_id: str) -> bool:
        """Permanently remove a photo document from MongoDB."""
        if not ObjectId.is_valid(photo_id):
            return False
        res = await self.collection.delete_one({"_id": ObjectId(photo_id)})
        return res.deleted_count > 0
