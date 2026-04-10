from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Iterable

from .config import settings
from .cache_invalidator import CacheInvalidator
from .database import Database
from .models import SessionState
from .sync_service import SyncService
from .types import SyncResult


@dataclass(frozen=True)
class SessionContext:
    session_key: int
    session_type: str
    date_start: datetime
    date_end: datetime
    current_state: str


CADENCE_BY_STATE: dict[str, dict[str, int]] = {
    "scheduled": {},
    "warmup": {
        "drivers": 1800,
        "weather": 300,
        "race_control": 120,
        "laps": 300
    },
    "live": {
        "drivers": 1800,
        "weather": 60,
        "race_control": 5,
        "laps": 30,
        "position": 5,
        "intervals": 5,
        "pit": 15,
        "stints": 30
    },
    "cooldown": {
        "race_control": 120,
        "session_result": 120,
        "laps": 300,
        "pit": 300,
        "stints": 300
    },
    "closed": {}
}

RACE_ONLY_ENDPOINTS = {"position", "intervals", "pit", "stints", "session_result"}


class BatchOrchestrator:
    def __init__(self, database: Database, sync_service: SyncService, cache_invalidator: CacheInvalidator | None = None) -> None:
        self.database = database
        self.sync_service = sync_service
        self.cache_invalidator = cache_invalidator

    async def discovery_batch(self) -> None:
        now = datetime.now(UTC)
        await self.sync_service.upsert_meetings_and_sessions(now.year)
        await self._refresh_session_configs(now)

    async def supervisor_batch(self) -> None:
        await self.reconcile_jobs()

    async def run_due_jobs(self) -> None:
        live_active = await self.database.has_live_sessions()
        requested_limit = settings.worker_due_jobs_batch_size_live if live_active else max(settings.worker_due_jobs_batch_size, 10)
        due_jobs = await self.database.fetch_due_jobs(limit=requested_limit)
        selected_jobs = self._select_due_jobs(due_jobs, live_active)

        for job in selected_jobs:
            await self._run_single_job(
                job_id=job.job_id,
                job_name=job.job_name,
                endpoint=job.endpoint,
                session_key=job.session_key,
                cadence_seconds=job.cadence_seconds
            )

    async def reconcile_jobs(self) -> None:
        await self._ensure_bootstrap_jobs_for_unsynced_sessions()

        configs = await self.database.list_active_configs()

        for config in configs:
            if config.current_state.value != "live":
                await self.database.disable_jobs_not_in(config.session_key, [])
                continue

            desired_endpoints = list(config.enabled_endpoints)
            overrides = dict(config.cadence_overrides)
            session_key = config.session_key
            state = config.current_state.value
            now = datetime.now(UTC)

            for endpoint in desired_endpoints:
                cadence = int(overrides.get(endpoint, CADENCE_BY_STATE[state][endpoint]))
                job_name = f"{state}:{endpoint}"
                next_run_at = self._compute_next_run_at(
                    now=now,
                    state=state,
                    warmup_starts_at=config.warmup_starts_at,
                    cadence_seconds=cadence,
                    session_key=session_key,
                    endpoint=endpoint,
                )
                await self.database.ensure_sync_job(job_name, endpoint, session_key, cadence, next_run_at)

            await self.database.disable_jobs_not_in(session_key, desired_endpoints)

    async def _refresh_session_configs(self, now: datetime) -> None:
        sessions = await self.database.list_recent_sessions()

        for row in sessions:
            context = SessionContext(
                session_key=row.session_key,
                session_type=row.session_type,
                date_start=row.date_start,
                date_end=row.date_end,
                current_state=row.current_state.value
            )
            state = self._compute_state(now, context.date_start, context.date_end)
            endpoints = self._enabled_endpoints(context.session_type, state)
            warmup_starts_at = context.date_start - timedelta(minutes=settings.session_warmup_minutes)
            cooldown_starts_at = context.date_end
            closed_at = context.date_end + timedelta(minutes=settings.session_cooldown_minutes)

            await self.database.set_session_state(context.session_key, SessionState(state))
            await self.database.upsert_session_sync_config(
                context.session_key,
                context.session_type,
                SessionState(state),
                warmup_starts_at,
                context.date_start,
                cooldown_starts_at,
                closed_at,
                endpoints,
            )

    async def _run_single_job(
        self,
        job_id: int,
        job_name: str,
        endpoint: str,
        session_key: int | None,
        cadence_seconds: int
    ) -> None:
        run_id = await self.database.mark_job_running(job_id)

        try:
            result = await self._dispatch(endpoint, session_key)
            await self.database.mark_job_success(job_id, run_id, result.rows_written, result.batch_id, cadence_seconds)
            if job_name.startswith("bootstrap:") and session_key is not None:
                await self.database.mark_bootstrap_endpoint_synced(session_key, endpoint)
                session_type = await self.database.get_session_type(session_key)
                if session_type is not None:
                    required = self._bootstrap_endpoints(session_type)
                    synced_count = await self.database.count_synced_bootstrap_endpoints(session_key, required)
                    if synced_count >= len(required):
                        await self.database.mark_bootstrap_completed(session_key)
                        await self.database.disable_session_jobs_by_prefix(session_key, "bootstrap:")
                await self.database.disable_job(job_id)
            if self.cache_invalidator is not None and session_key is not None:
                await self.cache_invalidator.invalidate_after_sync(endpoint, session_key)
        except Exception as error:
            await self.database.mark_job_failed(job_id, run_id, str(error), cadence_seconds)

    async def _dispatch(self, endpoint: str, session_key: int | None) -> SyncResult:
        if session_key is None:
            raise ValueError(f"Endpoint {endpoint} requires session_key")
        if endpoint == "drivers":
            return await self.sync_service.sync_session_drivers(session_key)
        if endpoint == "weather":
            return await self.sync_service.sync_weather(session_key)
        if endpoint == "race_control":
            return await self.sync_service.sync_race_control(session_key)
        if endpoint == "laps":
            return await self.sync_service.sync_laps(session_key)
        if endpoint == "position":
            return await self.sync_service.sync_positions(session_key)
        if endpoint == "intervals":
            return await self.sync_service.sync_intervals(session_key)
        if endpoint == "pit":
            return await self.sync_service.sync_pit(session_key)
        if endpoint == "stints":
            return await self.sync_service.sync_stints(session_key)
        if endpoint == "session_result":
            return await self.sync_service.sync_session_results(session_key)
        raise ValueError(f"Unsupported endpoint: {endpoint}")

    def _compute_state(self, now: datetime, date_start: datetime, date_end: datetime) -> str:
        warmup_starts_at = date_start - timedelta(minutes=settings.session_warmup_minutes)
        closed_at = date_end + timedelta(minutes=settings.session_cooldown_minutes)

        if now < warmup_starts_at:
            return "scheduled"
        if warmup_starts_at <= now < date_start:
            return "warmup"
        if date_start <= now <= date_end:
            return "live"
        if date_end < now <= closed_at:
            return "cooldown"
        return "closed"

    def _enabled_endpoints(self, session_type: str, state: str) -> list[str]:
        endpoints = list(CADENCE_BY_STATE[state].keys())
        if session_type.lower() != "race":
            endpoints = [endpoint for endpoint in endpoints if endpoint not in RACE_ONLY_ENDPOINTS]
        return endpoints

    async def _ensure_bootstrap_jobs_for_unsynced_sessions(self) -> None:
        unsynced_sessions = await self.database.list_unsynced_sessions()
        now = datetime.now(UTC)

        for session in unsynced_sessions:
            required_endpoints = self._bootstrap_endpoints(session.session_type)
            for endpoint in required_endpoints:
                cadence = 86400
                next_run_at = self._compute_next_run_at(
                    now=now,
                    state="warmup",
                    warmup_starts_at=session.date_start,
                    cadence_seconds=30,
                    session_key=session.session_key,
                    endpoint=endpoint,
                )
                await self.database.ensure_sync_job(
                    job_name=f"bootstrap:{endpoint}",
                    endpoint=endpoint,
                    session_key=session.session_key,
                    cadence_seconds=cadence,
                    next_run_at=next_run_at,
                )

    @staticmethod
    def _bootstrap_endpoints(session_type: str) -> list[str]:
        base = ["drivers", "weather", "race_control", "laps", "pit", "stints", "session_result"]
        if session_type.lower() == "race":
            base.extend(["position", "intervals"])
        return base

    @staticmethod
    def _select_due_jobs(due_jobs: Iterable, live_active: bool) -> list:
        if live_active:
            live_jobs = [job for job in due_jobs if str(job.job_name).startswith("live:")]
            return live_jobs[: settings.worker_due_jobs_batch_size_live]

        bootstrap_jobs = [job for job in due_jobs if str(job.job_name).startswith("bootstrap:")]
        if bootstrap_jobs:
            return bootstrap_jobs[: settings.worker_due_jobs_batch_size]

        return [job for job in due_jobs if str(job.job_name).startswith("live:")][: settings.worker_due_jobs_batch_size]

    @staticmethod
    def _compute_next_run_at(
        now: datetime,
        state: str,
        warmup_starts_at: datetime,
        cadence_seconds: int,
        session_key: int,
        endpoint: str,
    ) -> datetime:
        if state == "scheduled":
            base = max(now, warmup_starts_at)
        else:
            base = now

        spread_window = max(1, min(cadence_seconds, 30))
        deterministic_spread = abs(hash(f"{session_key}:{endpoint}")) % spread_window
        return base + timedelta(seconds=deterministic_spread)
