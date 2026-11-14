"""Run one storage maintenance pass by hand.

Usage (from backend/):
    uv run python -m scripts.storage_maintenance            # dry run: report only
    uv run python -m scripts.storage_maintenance --apply    # delete orphans, purge, reconcile

On Render, schedule the --apply form as a Cron Job (the in-process loop is off by default
because free instances sleep). The app runs it in-process only if STORAGE_MAINTENANCE_INTERVAL_HOURS > 0.
"""

import argparse
import asyncio
import json

from app.core.config import get_settings
from app.db.mongodb import mongo_manager
from app.repositories.design_repository import DesignRepository
from app.repositories.photo_repository import PhotoRepository
from app.repositories.quote_repository import QuoteRepository
from app.repositories.usage_repository import UsageRepository
from app.services.storage_maintenance_service import StorageMaintenanceService
from app.storage.r2_storage import R2Storage


async def main(apply: bool) -> None:
    await mongo_manager.connect(get_settings())
    try:
        db = mongo_manager.get_database()
        service = StorageMaintenanceService(
            usage_repo=UsageRepository(db),
            r2_storage=R2Storage(),
            photo_repo=PhotoRepository(db),
            quote_repo=QuoteRepository(db),
            design_repo=DesignRepository(db),
        )
        report = await service.run(apply=apply)
        print(json.dumps(report.summary(), indent=2, default=str))
        if not apply:
            for key in report.orphaned_photo_objects + report.unreferenced_quote_previews:
                print("would delete:", key)
    finally:
        await mongo_manager.disconnect()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply changes (default: dry run)")
    asyncio.run(main(parser.parse_args().apply))
