"""Concurrency-safe usage counters and storage ledger persisted in MongoDB.

All quota decisions are made with single atomic MongoDB operations so they hold across
multiple workers and survive restarts (unlike the in-memory rate limiter).

Collections:
- usage_counters:        {_id, count, expires_at}  (TTL-expired; e.g. daily email counters)
- storage_usage:         {_id: "r2", used_bytes, reserved_bytes, seq, updated_at}
- storage_reservations:  {_id, scope, bytes, created_at}  (in-flight upload reservations)
"""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from pymongo import ASCENDING, IndexModel, ReturnDocument
from pymongo.asynchronous.collection import AsyncCollection
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError


class UsageRepository:
    """Atomic counter and storage-ledger primitives."""

    def __init__(self, db: AsyncDatabase) -> None:
        self.counters: AsyncCollection = db["usage_counters"]
        self.storage: AsyncCollection = db["storage_usage"]
        self.reservations: AsyncCollection = db["storage_reservations"]

    async def create_indexes(self) -> None:
        await self.counters.create_indexes(
            [IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0, name="idx_usage_ttl")]
        )
        await self.reservations.create_indexes(
            [IndexModel([("created_at", ASCENDING)], name="idx_reservations_created")]
        )

    # ------------------------------------------------------------------ counters

    async def increment_counter(self, key: str, limit: int, expires_at: datetime) -> bool:
        """Atomically increment `key` only while it is below `limit`. Returns False at the limit.

        The conditional upsert inserts the counter on first use; once the counter has reached the
        limit the filter no longer matches, the upsert collides on _id and we report "exhausted".
        """
        if limit <= 0:
            return False
        try:
            doc = await self.counters.find_one_and_update(
                {"_id": key, "count": {"$lt": limit}},
                {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": expires_at}},
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError:
            return False
        return doc is not None

    async def decrement_counter(self, key: str) -> None:
        """Give back one unit of a counter (never below zero)."""
        await self.counters.update_one({"_id": key, "count": {"$gt": 0}}, {"$inc": {"count": -1}})

    async def saturate_counter(self, key: str, limit: int, expires_at: datetime) -> None:
        """Mark a counter as exhausted (e.g. when the provider reports its quota is used up)."""
        await self.counters.update_one(
            {"_id": key},
            {"$max": {"count": limit}, "$setOnInsert": {"expires_at": expires_at}},
            upsert=True,
        )

    async def get_counter(self, key: str) -> int:
        doc = await self.counters.find_one({"_id": key})
        return int(doc.get("count", 0)) if doc else 0

    # ------------------------------------------------------------- storage ledger

    async def get_scope(self, scope: str) -> dict[str, Any] | None:
        return await self.storage.find_one({"_id": scope})

    async def seed_scope(self, scope: str, used_bytes: int) -> None:
        """Create the ledger document if it does not exist yet (first writer wins)."""
        await self.storage.update_one(
            {"_id": scope},
            {
                "$setOnInsert": {
                    "used_bytes": int(used_bytes),
                    "reserved_bytes": 0,
                    "seq": 0,
                    "updated_at": datetime.now(UTC),
                }
            },
            upsert=True,
        )

    async def try_reserve(self, scope: str, nbytes: int, cap: int) -> bool:
        """Atomically reserve `nbytes` only if used + reserved + nbytes stays within `cap`."""
        doc = await self.storage.find_one_and_update(
            {
                "_id": scope,
                "$expr": {"$lte": [{"$add": ["$used_bytes", "$reserved_bytes", nbytes]}, cap]},
            },
            {
                "$inc": {"reserved_bytes": nbytes, "seq": 1},
                "$set": {"updated_at": datetime.now(UTC)},
            },
        )
        return doc is not None

    async def commit_reserved(self, scope: str, nbytes: int) -> None:
        """Convert a reservation into used storage after a successful upload."""
        await self.storage.update_one(
            {"_id": scope},
            {
                "$inc": {"reserved_bytes": -nbytes, "used_bytes": nbytes, "seq": 1},
                "$set": {"updated_at": datetime.now(UTC)},
            },
        )

    async def release_reserved(self, scope: str, nbytes: int) -> None:
        """Return reserved bytes after a failed or abandoned upload."""
        await self.storage.update_one(
            {"_id": scope},
            [
                {
                    "$set": {
                        "reserved_bytes": {"$max": [0, {"$subtract": ["$reserved_bytes", nbytes]}]},
                        "seq": {"$add": ["$seq", 1]},
                        "updated_at": "$$NOW",
                    }
                }
            ],
        )

    async def release_used(self, scope: str, nbytes: int) -> None:
        """Subtract bytes of objects confirmed deleted from storage (never below zero)."""
        if nbytes <= 0:
            return
        await self.storage.update_one(
            {"_id": scope},
            [
                {
                    "$set": {
                        "used_bytes": {"$max": [0, {"$subtract": ["$used_bytes", nbytes]}]},
                        "seq": {"$add": ["$seq", 1]},
                        "updated_at": "$$NOW",
                    }
                }
            ],
        )

    async def reconcile_scope(
        self, scope: str, used_bytes: int, reserved_bytes: int, expected_seq: int
    ) -> bool:
        """Overwrite the ledger with measured values only if nothing changed meanwhile."""
        res = await self.storage.update_one(
            {"_id": scope, "seq": expected_seq},
            {
                "$set": {
                    "used_bytes": int(used_bytes),
                    "reserved_bytes": int(reserved_bytes),
                    "updated_at": datetime.now(UTC),
                },
                "$inc": {"seq": 1},
            },
        )
        return res.modified_count > 0

    # --------------------------------------------------------------- reservations

    async def create_reservation(self, scope: str, nbytes: int) -> str:
        reservation_id = str(ObjectId())
        await self.reservations.insert_one(
            {
                "_id": reservation_id,
                "scope": scope,
                "bytes": nbytes,
                "created_at": datetime.now(UTC),
            }
        )
        return reservation_id

    async def delete_reservation(self, reservation_id: str) -> bool:
        """Remove a reservation record. Exactly one caller wins, so bytes are settled once."""
        res = await self.reservations.delete_one({"_id": reservation_id})
        return res.deleted_count > 0

    async def list_reservations(self, older_than: datetime | None = None) -> list[dict[str, Any]]:
        query: dict[str, Any] = {}
        if older_than is not None:
            query["created_at"] = {"$lt": older_than}
        return await self.reservations.find(query).to_list(length=None)
