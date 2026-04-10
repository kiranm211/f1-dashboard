from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    postgres_host: str = os.getenv("POSTGRES_HOST", "localhost")
    postgres_port: int = int(os.getenv("POSTGRES_PORT", "5432"))
    postgres_db: str = os.getenv("POSTGRES_DB", "f1_dashboard")
    postgres_user: str = os.getenv("POSTGRES_USER", "postgres")
    postgres_password: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    openf1_base_url: str = os.getenv("OPENF1_BASE_URL", "https://api.openf1.org/v1")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    worker_cache_invalidation_enabled: bool = os.getenv("WORKER_CACHE_INVALIDATION_ENABLED", "true").lower() == "true"
    openf1_request_timeout_seconds: float = float(os.getenv("OPENF1_REQUEST_TIMEOUT_SECONDS", "15"))
    openf1_max_concurrency: int = int(os.getenv("OPENF1_MAX_CONCURRENCY", "4"))
    openf1_retry_max_attempts: int = int(os.getenv("OPENF1_RETRY_MAX_ATTEMPTS", "4"))
    openf1_retry_base_delay_seconds: float = float(os.getenv("OPENF1_RETRY_BASE_DELAY_SECONDS", "2"))
    openf1_retry_max_delay_seconds: float = float(os.getenv("OPENF1_RETRY_MAX_DELAY_SECONDS", "30"))
    worker_discovery_interval_seconds: int = int(os.getenv("WORKER_DISCOVERY_INTERVAL_SECONDS", "300"))
    worker_supervisor_interval_seconds: int = int(os.getenv("WORKER_SUPERVISOR_INTERVAL_SECONDS", "120"))
    worker_due_job_interval_seconds: int = int(os.getenv("WORKER_DUE_JOB_INTERVAL_SECONDS", "5"))
    worker_due_jobs_batch_size: int = int(os.getenv("WORKER_DUE_JOBS_BATCH_SIZE", "2"))
    worker_due_jobs_batch_size_live: int = int(os.getenv("WORKER_DUE_JOBS_BATCH_SIZE_LIVE", "8"))
    worker_session_lookback_days: int = int(os.getenv("WORKER_SESSION_LOOKBACK_DAYS", "1"))
    worker_session_lookahead_days: int = int(os.getenv("WORKER_SESSION_LOOKAHEAD_DAYS", "1"))
    session_warmup_minutes: int = int(os.getenv("SESSION_WARMUP_MINUTES", "60"))
    session_cooldown_minutes: int = int(os.getenv("SESSION_COOLDOWN_MINUTES", "30"))

    @property
    def postgres_dsn(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
