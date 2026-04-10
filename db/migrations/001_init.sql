CREATE TYPE session_state AS ENUM ('scheduled', 'warmup', 'live', 'cooldown', 'closed');
CREATE TYPE sync_job_status AS ENUM ('pending', 'running', 'succeeded', 'failed', 'paused');

CREATE TABLE meetings (
    meeting_key INTEGER PRIMARY KEY,
    meeting_name TEXT NOT NULL,
    meeting_official_name TEXT,
    country_name TEXT NOT NULL,
    location TEXT,
    circuit_short_name TEXT,
    circuit_key INTEGER,
    circuit_image TEXT,
    date_start TIMESTAMPTZ NOT NULL,
    date_end TIMESTAMPTZ NOT NULL,
    gmt_offset TEXT,
    year INTEGER NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
    session_key INTEGER PRIMARY KEY,
    meeting_key INTEGER NOT NULL REFERENCES meetings(meeting_key) ON DELETE CASCADE,
    session_name TEXT NOT NULL,
    session_type TEXT NOT NULL,
    country_name TEXT NOT NULL,
    location TEXT,
    circuit_short_name TEXT,
    date_start TIMESTAMPTZ NOT NULL,
    date_end TIMESTAMPTZ NOT NULL,
    gmt_offset TEXT,
    current_state session_state NOT NULL DEFAULT 'scheduled',
    source_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_meeting ON sessions(meeting_key);
CREATE INDEX idx_sessions_state ON sessions(current_state);
CREATE INDEX idx_sessions_window ON sessions(date_start, date_end);

CREATE TABLE session_drivers (
    session_key INTEGER NOT NULL REFERENCES sessions(session_key) ON DELETE CASCADE,
    driver_number INTEGER NOT NULL,
    broadcast_name TEXT,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT NOT NULL,
    name_acronym TEXT,
    team_name TEXT,
    team_colour TEXT,
    headshot_url TEXT,
    country_code TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, driver_number)
);

CREATE TABLE weather_snapshots (
    session_key INTEGER NOT NULL REFERENCES sessions(session_key) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL,
    air_temperature DOUBLE PRECISION,
    track_temperature DOUBLE PRECISION,
    humidity INTEGER,
    rainfall INTEGER,
    pressure DOUBLE PRECISION,
    wind_direction INTEGER,
    wind_speed DOUBLE PRECISION,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, date)
);

CREATE INDEX idx_weather_session_date ON weather_snapshots(session_key, date DESC);

CREATE TABLE position_snapshots (
    session_key INTEGER NOT NULL REFERENCES sessions(session_key) ON DELETE CASCADE,
    driver_number INTEGER NOT NULL,
    position INTEGER NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, driver_number, date)
);

CREATE INDEX idx_position_session_date ON position_snapshots(session_key, date DESC);
CREATE INDEX idx_position_session_rank ON position_snapshots(session_key, position, date DESC);

CREATE TABLE interval_snapshots (
    session_key INTEGER NOT NULL REFERENCES sessions(session_key) ON DELETE CASCADE,
    driver_number INTEGER NOT NULL,
    interval DOUBLE PRECISION,
    gap_to_leader TEXT,
    date TIMESTAMPTZ NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, driver_number, date)
);

CREATE INDEX idx_interval_session_date ON interval_snapshots(session_key, date DESC);

CREATE TABLE race_control_events (
    session_key INTEGER NOT NULL REFERENCES sessions(session_key) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL,
    category TEXT NOT NULL,
    flag TEXT,
    scope TEXT,
    message TEXT NOT NULL,
    lap_number INTEGER,
    driver_number INTEGER,
    sector INTEGER,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, date, message)
);

CREATE INDEX idx_race_control_session_date ON race_control_events(session_key, date DESC);

CREATE TABLE laps (
    session_key INTEGER NOT NULL REFERENCES sessions(session_key) ON DELETE CASCADE,
    driver_number INTEGER NOT NULL,
    lap_number INTEGER NOT NULL,
    date_start TIMESTAMPTZ,
    lap_duration DOUBLE PRECISION,
    duration_sector_1 DOUBLE PRECISION,
    duration_sector_2 DOUBLE PRECISION,
    duration_sector_3 DOUBLE PRECISION,
    i1_speed INTEGER,
    i2_speed INTEGER,
    st_speed INTEGER,
    is_pit_out_lap BOOLEAN,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, driver_number, lap_number)
);

CREATE TABLE stints (
    session_key INTEGER NOT NULL REFERENCES sessions(session_key) ON DELETE CASCADE,
    driver_number INTEGER NOT NULL,
    stint_number INTEGER NOT NULL,
    compound TEXT,
    lap_start INTEGER,
    lap_end INTEGER,
    tyre_age_at_start INTEGER,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, driver_number, stint_number)
);

CREATE TABLE pit_stops (
    session_key INTEGER NOT NULL REFERENCES sessions(session_key) ON DELETE CASCADE,
    driver_number INTEGER NOT NULL,
    lap_number INTEGER NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    lane_duration DOUBLE PRECISION,
    stop_duration DOUBLE PRECISION,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, driver_number, date)
);

CREATE TABLE session_results (
    session_key INTEGER NOT NULL REFERENCES sessions(session_key) ON DELETE CASCADE,
    driver_number INTEGER NOT NULL,
    position INTEGER,
    duration JSONB,
    gap_to_leader JSONB,
    number_of_laps INTEGER,
    dnf BOOLEAN,
    dns BOOLEAN,
    dsq BOOLEAN,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, driver_number)
);

CREATE TABLE raw_ingestion_batches (
    batch_id BIGSERIAL PRIMARY KEY,
    endpoint TEXT NOT NULL,
    session_key INTEGER,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL,
    item_count INTEGER NOT NULL DEFAULT 0,
    request_url TEXT NOT NULL,
    payload_hash TEXT,
    error_message TEXT
);

CREATE TABLE raw_ingestion_records (
    batch_id BIGINT NOT NULL REFERENCES raw_ingestion_batches(batch_id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL,
    payload JSONB NOT NULL,
    PRIMARY KEY (batch_id, row_index)
);

CREATE TABLE session_sync_config (
    session_key INTEGER PRIMARY KEY REFERENCES sessions(session_key) ON DELETE CASCADE,
    session_type TEXT NOT NULL,
    current_state session_state NOT NULL,
    warmup_starts_at TIMESTAMPTZ NOT NULL,
    live_starts_at TIMESTAMPTZ NOT NULL,
    cooldown_starts_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ NOT NULL,
    enabled_endpoints JSONB NOT NULL DEFAULT '[]'::jsonb,
    cadence_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
    paused BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sync_watermarks (
    endpoint TEXT NOT NULL,
    session_key INTEGER NOT NULL,
    watermark TIMESTAMPTZ,
    last_batch_id BIGINT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (endpoint, session_key)
);

CREATE TABLE sync_jobs (
    job_id BIGSERIAL PRIMARY KEY,
    job_name TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    session_key INTEGER REFERENCES sessions(session_key) ON DELETE CASCADE,
    cadence_seconds INTEGER NOT NULL,
    next_run_at TIMESTAMPTZ NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    status sync_job_status NOT NULL DEFAULT 'pending',
    last_started_at TIMESTAMPTZ,
    last_finished_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (job_name, endpoint, session_key)
);

CREATE INDEX idx_sync_jobs_due ON sync_jobs(enabled, next_run_at);

CREATE TABLE sync_job_runs (
    run_id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES sync_jobs(job_id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status sync_job_status NOT NULL,
    rows_written INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    batch_id BIGINT REFERENCES raw_ingestion_batches(batch_id) ON DELETE SET NULL
);

CREATE VIEW latest_position_snapshots AS
SELECT DISTINCT ON (session_key, driver_number)
    session_key,
    driver_number,
    position,
    date,
    fetched_at
FROM position_snapshots
ORDER BY session_key, driver_number, date DESC;

CREATE VIEW current_leaderboard AS
SELECT
    p.session_key,
    p.driver_number,
    p.position,
    p.date,
    d.full_name,
    d.name_acronym,
    d.team_name,
    d.team_colour,
    i.interval,
    i.gap_to_leader
FROM latest_position_snapshots p
LEFT JOIN session_drivers d
    ON d.session_key = p.session_key AND d.driver_number = p.driver_number
LEFT JOIN LATERAL (
    SELECT interval, gap_to_leader
    FROM interval_snapshots i
    WHERE i.session_key = p.session_key
      AND i.driver_number = p.driver_number
    ORDER BY i.date DESC
    LIMIT 1
) i ON TRUE;
