from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import Boolean, DateTime, Double, Enum as SqlEnum, ForeignKey, Integer, PrimaryKeyConstraint, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class SessionState(str, Enum):
    scheduled = "scheduled"
    warmup = "warmup"
    live = "live"
    cooldown = "cooldown"
    closed = "closed"


class SyncJobStatus(str, Enum):
    pending = "pending"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    paused = "paused"


class Meeting(Base):
    __tablename__ = "meetings"

    meeting_key: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_name: Mapped[str] = mapped_column(Text, nullable=False)
    meeting_official_name: Mapped[str | None] = mapped_column(Text)
    country_name: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str | None] = mapped_column(Text)
    circuit_short_name: Mapped[str | None] = mapped_column(Text)
    circuit_key: Mapped[int | None] = mapped_column(Integer)
    circuit_image: Mapped[str | None] = mapped_column(Text)
    date_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    date_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    gmt_offset: Mapped[str | None] = mapped_column(Text)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Session(Base):
    __tablename__ = "sessions"

    session_key: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_key: Mapped[int] = mapped_column(ForeignKey("meetings.meeting_key", ondelete="CASCADE"), nullable=False)
    session_name: Mapped[str] = mapped_column(Text, nullable=False)
    session_type: Mapped[str] = mapped_column(Text, nullable=False)
    country_name: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str | None] = mapped_column(Text)
    circuit_short_name: Mapped[str | None] = mapped_column(Text)
    date_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    date_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    gmt_offset: Mapped[str | None] = mapped_column(Text)
    current_state: Mapped[SessionState] = mapped_column(SqlEnum(SessionState, name="session_state", create_type=False), nullable=False)
    source_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SessionDriver(Base):
    __tablename__ = "session_drivers"
    __table_args__ = (PrimaryKeyConstraint("session_key", "driver_number"),)

    session_key: Mapped[int] = mapped_column(ForeignKey("sessions.session_key", ondelete="CASCADE"), nullable=False)
    driver_number: Mapped[int] = mapped_column(Integer, nullable=False)
    broadcast_name: Mapped[str | None] = mapped_column(Text)
    first_name: Mapped[str | None] = mapped_column(Text)
    last_name: Mapped[str | None] = mapped_column(Text)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    name_acronym: Mapped[str | None] = mapped_column(Text)
    team_name: Mapped[str | None] = mapped_column(Text)
    team_colour: Mapped[str | None] = mapped_column(Text)
    headshot_url: Mapped[str | None] = mapped_column(Text)
    country_code: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class WeatherSnapshot(Base):
    __tablename__ = "weather_snapshots"
    __table_args__ = (PrimaryKeyConstraint("session_key", "date"),)

    session_key: Mapped[int] = mapped_column(ForeignKey("sessions.session_key", ondelete="CASCADE"), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    air_temperature: Mapped[float | None] = mapped_column(Double)
    track_temperature: Mapped[float | None] = mapped_column(Double)
    humidity: Mapped[int | None] = mapped_column(Integer)
    rainfall: Mapped[int | None] = mapped_column(Integer)
    pressure: Mapped[float | None] = mapped_column(Double)
    wind_direction: Mapped[int | None] = mapped_column(Integer)
    wind_speed: Mapped[float | None] = mapped_column(Double)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PositionSnapshot(Base):
    __tablename__ = "position_snapshots"
    __table_args__ = (PrimaryKeyConstraint("session_key", "driver_number", "date"),)

    session_key: Mapped[int] = mapped_column(ForeignKey("sessions.session_key", ondelete="CASCADE"), nullable=False)
    driver_number: Mapped[int] = mapped_column(Integer, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class IntervalSnapshot(Base):
    __tablename__ = "interval_snapshots"
    __table_args__ = (PrimaryKeyConstraint("session_key", "driver_number", "date"),)

    session_key: Mapped[int] = mapped_column(ForeignKey("sessions.session_key", ondelete="CASCADE"), nullable=False)
    driver_number: Mapped[int] = mapped_column(Integer, nullable=False)
    interval: Mapped[float | None] = mapped_column(Double)
    gap_to_leader: Mapped[str | None] = mapped_column(Text)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class RaceControlEvent(Base):
    __tablename__ = "race_control_events"
    __table_args__ = (PrimaryKeyConstraint("session_key", "date", "message"),)

    session_key: Mapped[int] = mapped_column(ForeignKey("sessions.session_key", ondelete="CASCADE"), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    flag: Mapped[str | None] = mapped_column(Text)
    scope: Mapped[str | None] = mapped_column(Text)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    lap_number: Mapped[int | None] = mapped_column(Integer)
    driver_number: Mapped[int | None] = mapped_column(Integer)
    sector: Mapped[int | None] = mapped_column(Integer)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Lap(Base):
    __tablename__ = "laps"
    __table_args__ = (PrimaryKeyConstraint("session_key", "driver_number", "lap_number"),)

    session_key: Mapped[int] = mapped_column(ForeignKey("sessions.session_key", ondelete="CASCADE"), nullable=False)
    driver_number: Mapped[int] = mapped_column(Integer, nullable=False)
    lap_number: Mapped[int] = mapped_column(Integer, nullable=False)
    date_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lap_duration: Mapped[float | None] = mapped_column(Double)
    duration_sector_1: Mapped[float | None] = mapped_column(Double)
    duration_sector_2: Mapped[float | None] = mapped_column(Double)
    duration_sector_3: Mapped[float | None] = mapped_column(Double)
    i1_speed: Mapped[int | None] = mapped_column(Integer)
    i2_speed: Mapped[int | None] = mapped_column(Integer)
    st_speed: Mapped[int | None] = mapped_column(Integer)
    is_pit_out_lap: Mapped[bool | None] = mapped_column(Boolean)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Stint(Base):
    __tablename__ = "stints"
    __table_args__ = (PrimaryKeyConstraint("session_key", "driver_number", "stint_number"),)

    session_key: Mapped[int] = mapped_column(ForeignKey("sessions.session_key", ondelete="CASCADE"), nullable=False)
    driver_number: Mapped[int] = mapped_column(Integer, nullable=False)
    stint_number: Mapped[int] = mapped_column(Integer, nullable=False)
    compound: Mapped[str | None] = mapped_column(Text)
    lap_start: Mapped[int | None] = mapped_column(Integer)
    lap_end: Mapped[int | None] = mapped_column(Integer)
    tyre_age_at_start: Mapped[int | None] = mapped_column(Integer)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PitStop(Base):
    __tablename__ = "pit_stops"
    __table_args__ = (PrimaryKeyConstraint("session_key", "driver_number", "date"),)

    session_key: Mapped[int] = mapped_column(ForeignKey("sessions.session_key", ondelete="CASCADE"), nullable=False)
    driver_number: Mapped[int] = mapped_column(Integer, nullable=False)
    lap_number: Mapped[int] = mapped_column(Integer, nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    lane_duration: Mapped[float | None] = mapped_column(Double)
    stop_duration: Mapped[float | None] = mapped_column(Double)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SessionResult(Base):
    __tablename__ = "session_results"
    __table_args__ = (PrimaryKeyConstraint("session_key", "driver_number"),)

    session_key: Mapped[int] = mapped_column(ForeignKey("sessions.session_key", ondelete="CASCADE"), nullable=False)
    driver_number: Mapped[int] = mapped_column(Integer, nullable=False)
    position: Mapped[int | None] = mapped_column(Integer)
    duration: Mapped[Any | None] = mapped_column(JSONB)
    gap_to_leader: Mapped[Any | None] = mapped_column(JSONB)
    number_of_laps: Mapped[int | None] = mapped_column(Integer)
    dnf: Mapped[bool | None] = mapped_column(Boolean)
    dns: Mapped[bool | None] = mapped_column(Boolean)
    dsq: Mapped[bool | None] = mapped_column(Boolean)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class RawIngestionBatch(Base):
    __tablename__ = "raw_ingestion_batches"

    batch_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    session_key: Mapped[int | None] = mapped_column(Integer)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(Text, nullable=False)
    item_count: Mapped[int] = mapped_column(Integer, nullable=False)
    request_url: Mapped[str] = mapped_column(Text, nullable=False)
    payload_hash: Mapped[str | None] = mapped_column(Text)
    error_message: Mapped[str | None] = mapped_column(Text)


class RawIngestionRecord(Base):
    __tablename__ = "raw_ingestion_records"
    __table_args__ = (PrimaryKeyConstraint("batch_id", "row_index"),)

    batch_id: Mapped[int] = mapped_column(ForeignKey("raw_ingestion_batches.batch_id", ondelete="CASCADE"), nullable=False)
    row_index: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[Any] = mapped_column(JSONB, nullable=False)


class SessionSyncConfig(Base):
    __tablename__ = "session_sync_config"

    session_key: Mapped[int] = mapped_column(ForeignKey("sessions.session_key", ondelete="CASCADE"), primary_key=True)
    session_type: Mapped[str] = mapped_column(Text, nullable=False)
    current_state: Mapped[SessionState] = mapped_column(SqlEnum(SessionState, name="session_state", create_type=False), nullable=False)
    warmup_starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    live_starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    cooldown_starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    enabled_endpoints: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    cadence_overrides: Mapped[dict[str, int]] = mapped_column(JSONB, nullable=False)
    paused: Mapped[bool] = mapped_column(Boolean, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SessionBootstrapStatus(Base):
    __tablename__ = "session_bootstrap_status"

    session_key: Mapped[int] = mapped_column(ForeignKey("sessions.session_key", ondelete="CASCADE"), primary_key=True)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SessionBootstrapSync(Base):
    __tablename__ = "session_bootstrap_syncs"
    __table_args__ = (PrimaryKeyConstraint("session_key", "endpoint"),)

    session_key: Mapped[int] = mapped_column(ForeignKey("sessions.session_key", ondelete="CASCADE"), nullable=False)
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SyncWatermark(Base):
    __tablename__ = "sync_watermarks"
    __table_args__ = (PrimaryKeyConstraint("endpoint", "session_key"),)

    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    session_key: Mapped[int] = mapped_column(Integer, nullable=False)
    watermark: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_batch_id: Mapped[int | None] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SyncJob(Base):
    __tablename__ = "sync_jobs"

    job_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_name: Mapped[str] = mapped_column(Text, nullable=False)
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    session_key: Mapped[int | None] = mapped_column(ForeignKey("sessions.session_key", ondelete="CASCADE"))
    cadence_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    next_run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    status: Mapped[SyncJobStatus] = mapped_column(SqlEnum(SyncJobStatus, name="sync_job_status", create_type=False), nullable=False)
    last_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SyncJobRun(Base):
    __tablename__ = "sync_job_runs"

    run_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("sync_jobs.job_id", ondelete="CASCADE"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[SyncJobStatus] = mapped_column(SqlEnum(SyncJobStatus, name="sync_job_status", create_type=False), nullable=False)
    rows_written: Mapped[int] = mapped_column(Integer, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text)
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("raw_ingestion_batches.batch_id", ondelete="SET NULL"))
