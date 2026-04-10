# Implementation Notes

## Batch orchestration flow

1. `discovery_batch` refreshes meetings and sessions for the current year.
2. Session windows are converted into one of five states: `scheduled`, `warmup`, `live`, `cooldown`, `closed`.
3. `session_sync_config` stores the current state and enabled endpoint bundle.
4. `supervisor_batch` reconciles desired endpoint jobs into `sync_jobs`.
5. `run_due_jobs` executes the due jobs and records history in `sync_job_runs`.

## ORM usage

- `apps/api` uses Drizzle ORM for all application database access.
- `apps/worker` uses SQLAlchemy async ORM and PostgreSQL upserts through SQLAlchemy dialect support.
- Direct driver-level query strings were removed from app code.

## API cache layer

- `apps/api/src/cache.ts` provides Redis-backed read-through caching with graceful fallback.
- `GET /v1/sessions` uses a longer cache TTL for low-churn metadata reads.
- `GET /v1/leaderboard` uses a short cache TTL tuned for race-window traffic.
- Responses include `meta.cache` and `meta.freshness` for observability in clients.

## Cache invalidation

- `apps/worker/src/cache_invalidator.py` invalidates API cache keys after successful sync jobs.
- Sessions cache is invalidated for meeting/session/driver updates.
- Leaderboard cache is invalidated per session for position/interval/pit/stint/lap/result updates.
- Invalidation is best-effort and non-blocking; sync jobs do not fail if Redis is unavailable.

## Current endpoint bundles

- `scheduled`: `drivers`
- `warmup`: `drivers`, `weather`, `race_control`, `laps`
- `live`: `drivers`, `weather`, `race_control`, `laps`, `position`, `intervals`, `pit`, `stints`
- `cooldown`: `race_control`, `session_result`, `laps`, `pit`, `stints`
- `closed`: no recurring jobs

## Known gaps in this first implementation

- No frontend app yet.
- Migration runner exists, but there is no autogeneration workflow yet.
- No Redis cache wired into the API yet.
- Retry logic is basic job rescheduling, not full jittered transport retry handling.
- Championship, team radio, and overtake ingestion are not yet implemented.

## Developer commands

- `npm run infra:up`: start local PostgreSQL and Redis.
- `npm run db:migrate`: apply new SQL migrations and record them in `schema_migrations`.
- `npm run worker:test`: run worker-side orchestration tests.
- `npm run dev:setup`: boot infra, apply migrations, and install dependencies.
