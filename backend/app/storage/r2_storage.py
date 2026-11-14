import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import get_settings
from app.core.exceptions import ResourceNotFoundException, StorageUnavailableException

logger = logging.getLogger("saf_studio.r2_storage")

# S3 DeleteObjects accepts at most 1,000 keys per request.
_DELETE_BATCH = 1000


@dataclass
class StoredObject:
    """Listing entry for an object in the bucket."""

    key: str
    size: int
    last_modified: datetime


class R2Storage:
    """Thread-safe S3-compatible storage client for Cloudflare R2."""

    def __init__(self, s3_client: Any = None, bucket_name: str | None = None) -> None:
        self._client = s3_client
        self._bucket = bucket_name

    def _get_client(self) -> Any:
        if self._client is None:
            settings = get_settings()
            config = Config(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "standard"},
                connect_timeout=5,
                read_timeout=15,
            )
            self._client = boto3.client(
                service_name="s3",
                endpoint_url=settings.r2_effective_endpoint_url,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID or "mock-access-key",
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY or "mock-secret-key",
                region_name="auto",
                config=config,
            )
        return self._client

    @property
    def bucket_name(self) -> str:
        if self._bucket:
            return self._bucket
        return get_settings().R2_BUCKET_NAME

    async def ping(self) -> float:
        """Ping Cloudflare R2 bucket and measure round-trip latency in milliseconds."""
        import time

        client = self._get_client()
        bucket = self.bucket_name
        start = time.perf_counter()

        def _sync_ping() -> None:
            client.head_bucket(Bucket=bucket)

        try:
            await asyncio.to_thread(_sync_ping)
            latency_ms = (time.perf_counter() - start) * 1000
            return round(latency_ms, 2)
        except ClientError as exc:
            logger.error("R2 ping failed for bucket %s: %s", bucket, exc)
            raise StorageUnavailableException(
                issue=f"Cloudflare R2 bucket '{bucket}' unreachable or permission denied: {exc}"
            ) from exc
        except Exception as exc:
            logger.error("Unexpected error during R2 ping: %s", exc)
            raise StorageUnavailableException(issue=str(exc)) from exc

    async def put_object(
        self,
        key: str,
        data: bytes,
        content_type: str,
        metadata: dict[str, str] | None = None,
    ) -> str:
        """Upload raw binary data to Cloudflare R2 asynchronously."""
        client = self._get_client()
        bucket = self.bucket_name
        req_meta = metadata or {}

        def _sync_put() -> dict[str, Any]:
            return client.put_object(
                Bucket=bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
                Metadata=req_meta,
            )

        try:
            await asyncio.to_thread(_sync_put)
            logger.debug("Uploaded object to R2: %s (%d bytes)", key, len(data))
            return key
        except ClientError as exc:
            logger.error("R2 put_object failed for key %s: %s", key, exc)
            raise StorageUnavailableException(
                issue=f"Failed to upload object {key} to Cloudflare R2: {exc}"
            ) from exc
        except Exception as exc:
            logger.error("Unexpected error during R2 put_object: %s", exc)
            raise StorageUnavailableException(issue=str(exc)) from exc

    async def get_object(self, key: str) -> tuple[bytes, str]:
        """Download raw binary object from Cloudflare R2 asynchronously."""
        client = self._get_client()
        bucket = self.bucket_name

        def _sync_get() -> tuple[bytes, str]:
            resp = client.get_object(Bucket=bucket, Key=key)
            body = resp["Body"].read()
            c_type = resp.get("ContentType", "application/octet-stream")
            return body, c_type

        try:
            return await asyncio.to_thread(_sync_get)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in ("NoSuchKey", "404", "NotFound"):
                raise ResourceNotFoundException(
                    message=f"Photo media for key '{key}' not found in storage.",
                    field="key",
                ) from exc
            logger.error("R2 get_object error for key %s: %s", key, exc)
            raise StorageUnavailableException(issue=str(exc)) from exc
        except ResourceNotFoundException:
            raise
        except Exception as exc:
            logger.error("Unexpected error during R2 get_object: %s", exc)
            raise StorageUnavailableException(issue=str(exc)) from exc

    async def delete_object(self, key: str) -> bool:
        """Delete an object from Cloudflare R2 asynchronously."""
        client = self._get_client()
        bucket = self.bucket_name

        def _sync_delete() -> None:
            client.delete_object(Bucket=bucket, Key=key)

        try:
            await asyncio.to_thread(_sync_delete)
            logger.debug("Deleted object from R2: %s", key)
            return True
        except ClientError as exc:
            logger.warning("R2 delete_object warning for key %s: %s", key, exc)
            return False
        except Exception as exc:
            logger.warning("Unexpected error during R2 delete_object for key %s: %s", key, exc)
            return False

    async def delete_objects(self, keys: list[str]) -> list[str]:
        """Bulk delete objects from Cloudflare R2. Returns the keys that could NOT be deleted.

        Deleting a key that does not exist counts as success (S3 semantics). Callers use the
        returned list to keep storage accounting exact and to leave failures for later cleanup.
        """
        if not keys:
            return []
        client = self._get_client()
        bucket = self.bucket_name
        unique_keys = list(dict.fromkeys(keys))

        def _sync_bulk_delete(batch: list[str]) -> list[str]:
            resp = client.delete_objects(
                Bucket=bucket,
                Delete={"Objects": [{"Key": k} for k in batch], "Quiet": True},
            )
            return [e.get("Key", "") for e in resp.get("Errors", []) if e.get("Key")]

        failed: list[str] = []
        for start in range(0, len(unique_keys), _DELETE_BATCH):
            batch = unique_keys[start : start + _DELETE_BATCH]
            try:
                batch_failed = await asyncio.to_thread(_sync_bulk_delete, batch)
            except Exception as exc:
                logger.warning("Bulk delete request failed, retrying keys individually: %s", exc)
                batch_failed = [k for k in batch if not await self.delete_object(k)]
            if batch_failed:
                logger.warning("R2 could not delete %d object(s)", len(batch_failed))
            failed.extend(batch_failed)
        if len(failed) < len(unique_keys):
            logger.debug("Bulk deleted %d objects from R2", len(unique_keys) - len(failed))
        return failed

    async def list_objects(self, prefix: str = "") -> list[StoredObject]:
        """List every object under `prefix` (paginated ListObjectsV2; Class A operations)."""
        client = self._get_client()
        bucket = self.bucket_name

        def _sync_list() -> list[StoredObject]:
            out: list[StoredObject] = []
            kwargs: dict[str, Any] = {"Bucket": bucket, "Prefix": prefix, "MaxKeys": 1000}
            while True:
                resp = client.list_objects_v2(**kwargs)
                for item in resp.get("Contents", []):
                    out.append(
                        StoredObject(
                            key=item["Key"],
                            size=int(item.get("Size", 0)),
                            last_modified=item["LastModified"],
                        )
                    )
                if not resp.get("IsTruncated"):
                    return out
                kwargs["ContinuationToken"] = resp["NextContinuationToken"]

        try:
            return await asyncio.to_thread(_sync_list)
        except Exception as exc:
            logger.error("R2 list_objects failed for prefix '%s': %s", prefix, exc)
            raise StorageUnavailableException(issue="Failed to list storage objects") from exc

    async def total_bytes(self, prefix: str = "") -> int:
        """Total size in bytes of all objects under `prefix`."""
        return sum(obj.size for obj in await self.list_objects(prefix))

    async def get_object_size(self, key: str) -> int | None:
        """Size of an object in bytes via HeadObject (Class B), or None if it does not exist."""
        client = self._get_client()
        bucket = self.bucket_name

        def _sync_head() -> int:
            return int(client.head_object(Bucket=bucket, Key=key).get("ContentLength", 0))

        try:
            return await asyncio.to_thread(_sync_head)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in ("NoSuchKey", "404", "NotFound"):
                return None
            raise StorageUnavailableException(issue="Failed to read object metadata") from exc
        except Exception as exc:
            raise StorageUnavailableException(issue="Failed to read object metadata") from exc

    async def generate_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate short-lived presigned GET URL for an R2 object."""
        client = self._get_client()
        bucket = self.bucket_name

        def _sync_presign() -> str:
            return client.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": bucket, "Key": key},
                ExpiresIn=expires_in,
            )

        try:
            return await asyncio.to_thread(_sync_presign)
        except Exception as exc:
            logger.error("Failed to generate presigned URL for %s: %s", key, exc)
            raise StorageUnavailableException(issue=str(exc)) from exc
