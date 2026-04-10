# F1 Dashboard

This repository starts the DB-first platform for an F1 dashboard.

## What is implemented

- PostgreSQL schema for normalized OpenF1 data, raw ingestion batches, and sync orchestration.
- Fastify read API using Drizzle ORM for health, sessions, and leaderboard reads from the local database.
- Fastify read API now includes Redis-backed read-through caching for sessions and leaderboard endpoints.
- Python worker using SQLAlchemy ORM for ingestion, orchestration, and sync job state.
- Docker Compose for local PostgreSQL and Redis.

## Current structure

- `apps/api`: Fastify TypeScript read API.
- `apps/worker`: Python scheduler and OpenF1 sync worker.
- `db/migrations`: PostgreSQL schema migrations.
- `docs`: project documentation.

## Local setup

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Start infrastructure:
   `npm run infra:up`
3. Apply tracked SQL migrations:
   `npm run db:migrate`
4. Install API dependencies:
   `npm run api:install`
5. Install worker dependencies:
   `npm run worker:install`
6. Start the API:
   `npm run api:dev`
7. Start the worker in another terminal:
   `npm run worker:run`

For a first-time local bootstrap, you can also run:

`npm run dev:setup`

## API endpoints

- `GET /health`
- `GET /v1/sessions?year=2026&state=live`
- `GET /v1/leaderboard?sessionKey=1234`

`/v1/sessions` and `/v1/leaderboard` responses include a `meta` object with cache and freshness details.

## Implementation notes

- User traffic should hit only the local API. The worker is the only component allowed to call OpenF1.
- The session orchestrator derives sync state automatically from session start and end times.
- Race-only endpoints are enabled only for race sessions.
- The current worker covers discovery, drivers, weather, race control, laps, positions, intervals, pit, stints, and session results.
- SQL migrations are tracked in `schema_migrations` and applied by `db/migrate.py`.
- Worker tests currently cover orchestration state and endpoint gating and can be run with `npm run worker:test`.
- API cache behavior is configured with `CACHE_ENABLED`, `CACHE_TTL_SESSIONS_SECONDS`, and `CACHE_TTL_LEADERBOARD_SECONDS`.
- Worker can proactively invalidate API cache after successful sync jobs using `WORKER_CACHE_INVALIDATION_ENABLED` and `REDIS_URL`.
- Worker rate controls are configurable with `WORKER_DUE_JOBS_BATCH_SIZE`, `WORKER_SESSION_LOOKAHEAD_DAYS`, `OPENF1_RETRY_MAX_ATTEMPTS`, and `OPENF1_RETRY_BASE_DELAY_SECONDS`.

Worker sync modes:

- Unsynced sessions are bootstrapped once (`bootstrap:*` jobs), then those bootstrap jobs are disabled.
- If any session is live, due-job execution prioritizes `live:*` jobs and allocates bandwidth to live data sync first.
- If there is no live session, the worker processes only bootstrap jobs for newly discovered unsynced sessions.

If you see repeated `429 Too Many Requests` in worker logs, lower `WORKER_DUE_JOBS_BATCH_SIZE` to `1` and increase `OPENF1_RETRY_BASE_DELAY_SECONDS`.

## Next implementation targets

- Add migration runner and seed scripts.
- Add Redis-backed API caching.
- Add frontend app that consumes only the local API.
- Add retries with explicit 429 backoff and dead-letter replay commands.
