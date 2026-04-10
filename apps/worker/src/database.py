from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any, AsyncIterator, Sequence

from sqlalchemy import and_, func, not_, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from .config import settings
from .models import (
    IntervalSnapshot,
    Lap,
    Meeting,
    PitStop,
    PositionSnapshot,
    RaceControlEvent,
    RawIngestionBatch,
    RawIngestionRecord,
    Session,
    SessionBootstrapStatus,
    SessionBootstrapSync,
    SessionDriver,
    SessionResult,
    SessionState,
    SessionSyncConfig,
    Stint,
    SyncJob,
    SyncJobRun,
    SyncJobStatus,
    SyncWatermark,
    WeatherSnapshot,
)


class Database:
    def __init__(self) -> None:
        self.engine: AsyncEngine | None = None
        self.session_factory: async_sessionmaker[AsyncSession] | None = None

    async def connect(self) -> None:
        self.engine = create_async_engine(
            settings.postgres_dsn.replace("postgresql://", "postgresql+asyncpg://"),
            future=True,
        )
        self.session_factory = async_sessionmaker(self.engine, expire_on_commit=False)

    async def close(self) -> None:
        if self.engine is not None:
            await self.engine.dispose()

    @asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        assert self.session_factory is not None
        session = self.session_factory()
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

    async def get_watermark(self, endpoint: str, session_key: int) -> datetime | None:
        async with self.session() as session:
            return await session.scalar(
                select(SyncWatermark.watermark).where(
                    SyncWatermark.endpoint == endpoint,
                    SyncWatermark.session_key == session_key,
                )
            )

    async def upsert_meetings(self, rows: list[dict[str, Any]]) -> None:
        await self._bulk_upsert(
            Meeting,
            rows,
            [Meeting.meeting_key],
            [
                "meeting_name",
                "meeting_official_name",
                "country_name",
                "location",
                "circuit_short_name",
                "circuit_key",
                "circuit_image",
                "date_start",
                "date_end",
                "gmt_offset",
                "year",
                "updated_at",
            ],
        )

    async def upsert_sessions(self, rows: list[dict[str, Any]]) -> None:
        await self._bulk_upsert(
            Session,
            rows,
            [Session.session_key],
            [
                "meeting_key",
                "session_name",
                "session_type",
                "country_name",
                "location",
                "circuit_short_name",
                "date_start",
                "date_end",
                "gmt_offset",
                "source_updated_at",
                "updated_at",
            ],
        )

    async def upsert_session_drivers(self, rows: list[dict[str, Any]]) -> None:
        await self._bulk_upsert(
            SessionDriver,
            rows,
            [SessionDriver.session_key, SessionDriver.driver_number],
            [
                "broadcast_name",
                "first_name",
                "last_name",
                "full_name",
                "name_acronym",
                "team_name",
                "team_colour",
                "headshot_url",
                "country_code",
                "updated_at",
            ],
        )

    async def upsert_weather_snapshots(self, rows: list[dict[str, Any]]) -> None:
        await self._bulk_upsert(
            WeatherSnapshot,
            rows,
            [WeatherSnapshot.session_key, WeatherSnapshot.date],
            [
                "air_temperature",
                "track_temperature",
                "humidity",
                "rainfall",
                "pressure",
                "wind_direction",
                "wind_speed",
                "fetched_at",
            ],
        )

    async def upsert_position_snapshots(self, rows: list[dict[str, Any]]) -> None:
        await self._bulk_upsert(
            PositionSnapshot,
            rows,
            [PositionSnapshot.session_key, PositionSnapshot.driver_number, PositionSnapshot.date],
            ["position", "fetched_at"],
        )

    async def upsert_interval_snapshots(self, rows: list[dict[str, Any]]) -> None:
        await self._bulk_upsert(
            IntervalSnapshot,
            rows,
            [IntervalSnapshot.session_key, IntervalSnapshot.driver_number, IntervalSnapshot.date],
            ["interval", "gap_to_leader", "fetched_at"],
        )

    async def upsert_race_control_events(self, rows: list[dict[str, Any]]) -> None:
        await self._bulk_upsert(
            RaceControlEvent,
            rows,
            [RaceControlEvent.session_key, RaceControlEvent.date, RaceControlEvent.message],
            ["category", "flag", "scope", "lap_number", "driver_number", "sector", "fetched_at"],
        )

    async def upsert_laps(self, rows: list[dict[str, Any]]) -> None:
        await self._bulk_upsert(
            Lap,
            rows,
            [Lap.session_key, Lap.driver_number, Lap.lap_number],
            [
                "date_start",
                "lap_duration",
                "duration_sector_1",
                "duration_sector_2",
                "duration_sector_3",
                "i1_speed",
                "i2_speed",
                "st_speed",
                "is_pit_out_lap",
                "fetched_at",
            ],
        )

    async def upsert_stints(self, rows: list[dict[str, Any]]) -> None:
        await self._bulk_upsert(
            Stint,
            rows,
            [Stint.session_key, Stint.driver_number, Stint.stint_number],
            ["compound", "lap_start", "lap_end", "tyre_age_at_start", "fetched_at"],
        )

    async def upsert_pit_stops(self, rows: list[dict[str, Any]]) -> None:
        await self._bulk_upsert(
            PitStop,
            rows,
            [PitStop.session_key, PitStop.driver_number, PitStop.date],
            ["lap_number", "lane_duration", "stop_duration", "fetched_at"],
        )

    async def upsert_session_results(self, rows: list[dict[str, Any]]) -> None:
        await self._bulk_upsert(
            SessionResult,
            rows,
            [SessionResult.session_key, SessionResult.driver_number],
            ["position", "duration", "gap_to_leader", "number_of_laps", "dnf", "dns", "dsq", "fetched_at"],
        )

    async def store_raw_batch(
        self,
        endpoint: str,
        session_key: int | None,
        request_url: str,
        payload_hash: str,
        rows: list[dict[str, Any]],
    ) -> int:
        async with self.session() as session:
            batch = RawIngestionBatch(
                endpoint=endpoint,
                session_key=session_key,
                requested_at=datetime.now(UTC),
                status="running",
                item_count=len(rows),
                request_url=request_url,
                payload_hash=payload_hash,
            )
            session.add(batch)
            await session.flush()
            session.add_all(
                [
                    RawIngestionRecord(batch_id=batch.batch_id, row_index=index, payload=row)
                    for index, row in enumerate(rows)
                ]
            )
            await session.flush()
            return batch.batch_id

    async def mark_batch_complete(self, batch_id: int, item_count: int) -> None:
        async with self.session() as session:
            await session.execute(
                update(RawIngestionBatch)
                .where(RawIngestionBatch.batch_id == batch_id)
                .values(completed_at=datetime.now(UTC), status="succeeded", item_count=item_count)
            )

    async def upsert_watermark(self, endpoint: str, session_key: int, watermark: datetime | None, batch_id: int) -> None:
        stmt = insert(SyncWatermark).values(
            endpoint=endpoint,
            session_key=session_key,
            watermark=watermark,
            last_batch_id=batch_id,
            updated_at=datetime.now(UTC),
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[SyncWatermark.endpoint, SyncWatermark.session_key],
            set_={
                "watermark": stmt.excluded.watermark,
                "last_batch_id": stmt.excluded.last_batch_id,
                "updated_at": stmt.excluded.updated_at,
            },
        )
        async with self.session() as session:
            await session.execute(stmt)

    async def list_recent_sessions(self) -> list[Session]:
        now = datetime.now(UTC)
        async with self.session() as session:
            result = await session.scalars(
                select(Session)
                .where(
                    and_(
                        Session.date_end >= now - timedelta(days=settings.worker_session_lookback_days),
                        Session.date_start <= now + timedelta(days=settings.worker_session_lookahead_days),
                    )
                )
                .order_by(Session.date_start.asc())
            )
            return list(result)

    async def has_live_sessions(self) -> bool:
        async with self.session() as session:
            live_count = await session.scalar(
                select(Session.session_key)
                .where(Session.current_state == SessionState.live)
                .limit(1)
            )
            return live_count is not None

    async def list_unsynced_sessions(self) -> list[Session]:
        async with self.session() as session:
            result = await session.scalars(
                select(Session)
                .outerjoin(SessionBootstrapStatus, SessionBootstrapStatus.session_key == Session.session_key)
                .where(
                    or_(
                        SessionBootstrapStatus.session_key.is_(None),
                        SessionBootstrapStatus.completed.is_(False),
                    )
                )
                .order_by(Session.date_start.asc())
            )
            return list(result)

    async def set_session_state(self, session_key: int, state: SessionState) -> None:
        async with self.session() as session:
            await session.execute(
                update(Session)
                .where(Session.session_key == session_key)
                .values(current_state=state, updated_at=datetime.now(UTC))
            )

    async def upsert_session_sync_config(
        self,
        session_key: int,
        session_type: str,
        current_state: SessionState,
        warmup_starts_at: datetime,
        live_starts_at: datetime,
        cooldown_starts_at: datetime,
        closed_at: datetime,
        enabled_endpoints: list[str],
    ) -> None:
        stmt = insert(SessionSyncConfig).values(
            session_key=session_key,
            session_type=session_type,
            current_state=current_state,
            warmup_starts_at=warmup_starts_at,
            live_starts_at=live_starts_at,
            cooldown_starts_at=cooldown_starts_at,
            closed_at=closed_at,
            enabled_endpoints=enabled_endpoints,
            cadence_overrides={},
            paused=False,
            updated_at=datetime.now(UTC),
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[SessionSyncConfig.session_key],
            set_={
                "session_type": stmt.excluded.session_type,
                "current_state": stmt.excluded.current_state,
                "warmup_starts_at": stmt.excluded.warmup_starts_at,
                "live_starts_at": stmt.excluded.live_starts_at,
                "cooldown_starts_at": stmt.excluded.cooldown_starts_at,
                "closed_at": stmt.excluded.closed_at,
                "enabled_endpoints": stmt.excluded.enabled_endpoints,
                "updated_at": stmt.excluded.updated_at,
            },
        )
        async with self.session() as session:
            await session.execute(stmt)

    async def list_active_configs(self) -> list[SessionSyncConfig]:
        async with self.session() as session:
            result = await session.scalars(select(SessionSyncConfig).where(SessionSyncConfig.paused.is_(False)))
            return list(result)

    async def ensure_sync_job(
        self,
        job_name: str,
        endpoint: str,
        session_key: int,
        cadence_seconds: int,
        next_run_at: datetime,
    ) -> None:
        stmt = insert(SyncJob).values(
            job_name=job_name,
            endpoint=endpoint,
            session_key=session_key,
            cadence_seconds=cadence_seconds,
            next_run_at=next_run_at,
            enabled=True,
            status=SyncJobStatus.pending,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[SyncJob.job_name, SyncJob.endpoint, SyncJob.session_key],
            set_={
                "cadence_seconds": stmt.excluded.cadence_seconds,
                "enabled": stmt.excluded.enabled,
                "next_run_at": stmt.excluded.next_run_at,
                "updated_at": stmt.excluded.updated_at,
            },
        )
        async with self.session() as session:
            await session.execute(stmt)

    async def disable_jobs_not_in(self, session_key: int, desired_endpoints: Sequence[str]) -> None:
        async with self.session() as session:
            query = update(SyncJob).where(SyncJob.session_key == session_key, not_(SyncJob.job_name.like("bootstrap:%")))
            if desired_endpoints:
                query = query.where(not_(SyncJob.endpoint.in_(list(desired_endpoints))))
            query = query.values(enabled=False, updated_at=datetime.now(UTC))
            await session.execute(query)

    async def get_session_type(self, session_key: int) -> str | None:
        async with self.session() as session:
            return await session.scalar(
                select(Session.session_type).where(Session.session_key == session_key)
            )

    async def fetch_due_jobs(self, limit: int = 10) -> list[SyncJob]:
        async with self.session() as session:
            result = await session.scalars(
                select(SyncJob)
                .where(
                    SyncJob.enabled.is_(True),
                    SyncJob.next_run_at <= datetime.now(UTC),
                    SyncJob.status.in_([SyncJobStatus.pending, SyncJobStatus.succeeded, SyncJobStatus.failed]),
                )
                .order_by(SyncJob.next_run_at.asc())
                .limit(limit)
            )
            return list(result)

    async def disable_job(self, job_id: int) -> None:
        async with self.session() as session:
            await session.execute(
                update(SyncJob)
                .where(SyncJob.job_id == job_id)
                .values(enabled=False, updated_at=datetime.now(UTC))
            )

    async def disable_session_jobs_by_prefix(self, session_key: int, prefix: str) -> None:
        async with self.session() as session:
            await session.execute(
                update(SyncJob)
                .where(SyncJob.session_key == session_key, SyncJob.job_name.like(f"{prefix}%"))
                .values(enabled=False, updated_at=datetime.now(UTC))
            )

    async def mark_bootstrap_endpoint_synced(self, session_key: int, endpoint: str) -> None:
        stmt = insert(SessionBootstrapSync).values(
            session_key=session_key,
            endpoint=endpoint,
            synced_at=datetime.now(UTC),
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[SessionBootstrapSync.session_key, SessionBootstrapSync.endpoint],
            set_={
                "synced_at": stmt.excluded.synced_at,
            },
        )
        async with self.session() as session:
            await session.execute(stmt)

    async def count_synced_bootstrap_endpoints(self, session_key: int, endpoints: list[str]) -> int:
        if not endpoints:
            return 0
        async with self.session() as session:
            count = await session.scalar(
                select(func.count())
                .select_from(SessionBootstrapSync)
                .where(SessionBootstrapSync.session_key == session_key, SessionBootstrapSync.endpoint.in_(endpoints))
            )
            return int(count or 0)

    async def mark_bootstrap_completed(self, session_key: int) -> None:
        stmt = insert(SessionBootstrapStatus).values(
            session_key=session_key,
            completed=True,
            completed_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[SessionBootstrapStatus.session_key],
            set_={
                "completed": True,
                "completed_at": stmt.excluded.completed_at,
                "updated_at": stmt.excluded.updated_at,
            },
        )
        async with self.session() as session:
            await session.execute(stmt)

    async def mark_job_running(self, job_id: int) -> int:
        async with self.session() as session:
            await session.execute(
                update(SyncJob)
                .where(SyncJob.job_id == job_id)
                .values(status=SyncJobStatus.running, last_started_at=datetime.now(UTC), updated_at=datetime.now(UTC))
            )
            run = SyncJobRun(
                job_id=job_id,
                started_at=datetime.now(UTC),
                status=SyncJobStatus.running,
                rows_written=0,
            )
            session.add(run)
            await session.flush()
            return run.run_id

    async def mark_job_success(self, job_id: int, run_id: int, rows_written: int, batch_id: int, cadence_seconds: int) -> None:
        async with self.session() as session:
            await session.execute(
                update(SyncJobRun)
                .where(SyncJobRun.run_id == run_id)
                .values(
                    finished_at=datetime.now(UTC),
                    status=SyncJobStatus.succeeded,
                    rows_written=rows_written,
                    batch_id=batch_id,
                )
            )
            await session.execute(
                update(SyncJob)
                .where(SyncJob.job_id == job_id)
                .values(
                    status=SyncJobStatus.succeeded,
                    last_finished_at=datetime.now(UTC),
                    last_error=None,
                    next_run_at=datetime.now(UTC) + timedelta(seconds=cadence_seconds),
                    updated_at=datetime.now(UTC),
                )
            )

    async def mark_job_failed(self, job_id: int, run_id: int, error_message: str, cadence_seconds: int) -> None:
        async with self.session() as session:
            await session.execute(
                update(SyncJobRun)
                .where(SyncJobRun.run_id == run_id)
                .values(
                    finished_at=datetime.now(UTC),
                    status=SyncJobStatus.failed,
                    error_message=error_message,
                )
            )
            await session.execute(
                update(SyncJob)
                .where(SyncJob.job_id == job_id)
                .values(
                    status=SyncJobStatus.failed,
                    last_finished_at=datetime.now(UTC),
                    last_error=error_message,
                    next_run_at=datetime.now(UTC) + timedelta(seconds=min(cadence_seconds * 2, 600)),
                    updated_at=datetime.now(UTC),
                )
            )

    async def _bulk_upsert(
        self,
        model: Any,
        rows: list[dict[str, Any]],
        index_elements: list[Any],
        update_fields: list[str],
    ) -> None:
        if not rows:
            return
        stmt = insert(model).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=index_elements,
            set_={field: getattr(stmt.excluded, field) for field in update_fields},
        )
        async with self.session() as session:
            await session.execute(stmt)
