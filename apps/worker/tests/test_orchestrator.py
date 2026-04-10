from __future__ import annotations

from datetime import UTC, datetime, timedelta
from dataclasses import dataclass

from src.orchestrator import BatchOrchestrator


class DummyDatabase:
    pass


class DummySyncService:
    pass


@dataclass
class DummyJob:
    job_name: str


def build_orchestrator() -> BatchOrchestrator:
    return BatchOrchestrator(DummyDatabase(), DummySyncService())


def test_compute_state_scheduled() -> None:
    orchestrator = build_orchestrator()
    start = datetime(2026, 4, 10, 15, 0, tzinfo=UTC)
    end = start + timedelta(hours=2)
    now = start - timedelta(hours=3)

    assert orchestrator._compute_state(now, start, end) == "scheduled"


def test_compute_state_live() -> None:
    orchestrator = build_orchestrator()
    start = datetime(2026, 4, 10, 15, 0, tzinfo=UTC)
    end = start + timedelta(hours=2)
    now = start + timedelta(minutes=10)

    assert orchestrator._compute_state(now, start, end) == "live"


def test_compute_state_cooldown_and_closed() -> None:
    orchestrator = build_orchestrator()
    start = datetime(2026, 4, 10, 15, 0, tzinfo=UTC)
    end = start + timedelta(hours=2)

    cooldown_now = end + timedelta(minutes=10)
    closed_now = end + timedelta(hours=2)

    assert orchestrator._compute_state(cooldown_now, start, end) == "cooldown"
    assert orchestrator._compute_state(closed_now, start, end) == "closed"


def test_non_race_sessions_filter_race_only_endpoints() -> None:
    orchestrator = build_orchestrator()

    endpoints = orchestrator._enabled_endpoints("Practice", "live")

    assert "position" not in endpoints
    assert "intervals" not in endpoints
    assert "pit" not in endpoints
    assert "stints" not in endpoints
    assert "drivers" in endpoints
    assert "weather" in endpoints


def test_race_sessions_include_race_only_endpoints() -> None:
    orchestrator = build_orchestrator()

    endpoints = orchestrator._enabled_endpoints("Race", "live")

    assert "position" in endpoints
    assert "intervals" in endpoints
    assert "pit" in endpoints
    assert "stints" in endpoints


def test_compute_next_run_at_defers_scheduled_jobs_until_warmup() -> None:
    orchestrator = build_orchestrator()
    now = datetime(2026, 4, 10, 10, 0, tzinfo=UTC)
    warmup_starts_at = datetime(2026, 4, 10, 12, 0, tzinfo=UTC)

    next_run_at = orchestrator._compute_next_run_at(
        now=now,
        state="scheduled",
        warmup_starts_at=warmup_starts_at,
        cadence_seconds=21600,
        session_key=1234,
        endpoint="drivers",
    )

    assert next_run_at >= warmup_starts_at


def test_compute_next_run_at_spreads_non_scheduled_jobs() -> None:
    orchestrator = build_orchestrator()
    now = datetime(2026, 4, 10, 10, 0, tzinfo=UTC)
    warmup_starts_at = datetime(2026, 4, 10, 9, 0, tzinfo=UTC)

    next_run_at = orchestrator._compute_next_run_at(
        now=now,
        state="live",
        warmup_starts_at=warmup_starts_at,
        cadence_seconds=5,
        session_key=1234,
        endpoint="position",
    )

    assert now <= next_run_at <= now + timedelta(seconds=5)


def test_scheduled_state_has_no_endpoints() -> None:
    orchestrator = build_orchestrator()

    endpoints = orchestrator._enabled_endpoints("Race", "scheduled")

    assert endpoints == []


def test_bootstrap_endpoints_for_race() -> None:
    orchestrator = build_orchestrator()

    endpoints = orchestrator._bootstrap_endpoints("Race")

    assert "drivers" in endpoints
    assert "position" in endpoints
    assert "intervals" in endpoints


def test_bootstrap_endpoints_for_non_race() -> None:
    orchestrator = build_orchestrator()

    endpoints = orchestrator._bootstrap_endpoints("Practice")

    assert "drivers" in endpoints
    assert "position" not in endpoints
    assert "intervals" not in endpoints


def test_select_due_jobs_prefers_live_when_live_session_active() -> None:
    jobs = [DummyJob("bootstrap:drivers"), DummyJob("live:position"), DummyJob("live:intervals")]

    selected = BatchOrchestrator._select_due_jobs(jobs, live_active=True)

    assert all(job.job_name.startswith("live:") for job in selected)


def test_select_due_jobs_prefers_bootstrap_when_no_live_session() -> None:
    jobs = [DummyJob("bootstrap:drivers"), DummyJob("live:position")]

    selected = BatchOrchestrator._select_due_jobs(jobs, live_active=False)

    assert all(job.job_name.startswith("bootstrap:") for job in selected)
