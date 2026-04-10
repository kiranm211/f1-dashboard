from __future__ import annotations

import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .cache_invalidator import CacheInvalidator
from .config import settings
from .database import Database
from .openf1_client import OpenF1Client
from .orchestrator import BatchOrchestrator
from .sync_service import SyncService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("f1-dashboard-worker")


async def main() -> None:
    database = Database()
    client = OpenF1Client()
    cache_invalidator = CacheInvalidator()
    await database.connect()
    await cache_invalidator.connect()

    sync_service = SyncService(database, client)
    orchestrator = BatchOrchestrator(database, sync_service, cache_invalidator)

    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(orchestrator.discovery_batch, "interval", seconds=settings.worker_discovery_interval_seconds)
    scheduler.add_job(orchestrator.supervisor_batch, "interval", seconds=settings.worker_supervisor_interval_seconds)
    scheduler.add_job(orchestrator.run_due_jobs, "interval", seconds=settings.worker_due_job_interval_seconds)
    scheduler.start()

    logger.info("worker started")
    await orchestrator.discovery_batch()
    await orchestrator.supervisor_batch()

    try:
        while True:
            await asyncio.sleep(3600)
    finally:
        scheduler.shutdown(wait=False)
        await client.close()
        await cache_invalidator.close()
        await database.close()


if __name__ == "__main__":
    asyncio.run(main())
