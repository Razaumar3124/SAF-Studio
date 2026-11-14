"""Bounded reading of multipart uploads."""

from fastapi import UploadFile

from app.core.exceptions import ValidationException


async def read_upload_limited(file: UploadFile, max_bytes: int, message: str) -> bytes:
    """Read an uploaded file into memory, refusing anything larger than `max_bytes`.

    Checks the size reported by the multipart parser first, then reads at most
    `max_bytes + 1` bytes so an oversized body is never fully loaded into memory.
    """
    issue = f"File exceeds {max_bytes} bytes"
    if file.size is not None and file.size > max_bytes:
        raise ValidationException(message=message, details=[{"field": "file", "issue": issue}])
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise ValidationException(message=message, details=[{"field": "file", "issue": issue}])
    return data
