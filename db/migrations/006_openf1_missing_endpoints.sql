CREATE TABLE car_data_samples (
    session_key INTEGER NOT NULL REFERENCES sessions(session_key) ON DELETE CASCADE,
    driver_number INTEGER NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    brake INTEGER,
    drs INTEGER,
    n_gear INTEGER,
    rpm INTEGER,
    speed INTEGER,
    throttle INTEGER,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, driver_number, date)
);

CREATE INDEX idx_car_data_session_date ON car_data_samples(session_key, date DESC);

CREATE TABLE location_samples (
    session_key INTEGER NOT NULL REFERENCES sessions(session_key) ON DELETE CASCADE,
    driver_number INTEGER NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    x INTEGER,
    y INTEGER,
    z INTEGER,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, driver_number, date)
);

CREATE INDEX idx_location_session_date ON location_samples(session_key, date DESC);

CREATE TABLE team_radio_messages (
    session_key INTEGER NOT NULL REFERENCES sessions(session_key) ON DELETE CASCADE,
    driver_number INTEGER NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    recording_url TEXT NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, driver_number, date, recording_url)
);

CREATE INDEX idx_team_radio_session_date ON team_radio_messages(session_key, date DESC);

CREATE TABLE overtakes (
    session_key INTEGER NOT NULL REFERENCES sessions(session_key) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL,
    overtaking_driver_number INTEGER NOT NULL,
    overtaken_driver_number INTEGER NOT NULL,
    position INTEGER NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, date, overtaking_driver_number, overtaken_driver_number, position)
);

CREATE INDEX idx_overtakes_session_date ON overtakes(session_key, date DESC);

CREATE TABLE starting_grid (
    session_key INTEGER NOT NULL REFERENCES sessions(session_key) ON DELETE CASCADE,
    driver_number INTEGER NOT NULL,
    position INTEGER,
    lap_duration DOUBLE PRECISION,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, driver_number)
);

CREATE INDEX idx_starting_grid_session_position ON starting_grid(session_key, position);

CREATE TABLE championship_driver_standings (
    session_key INTEGER NOT NULL REFERENCES sessions(session_key) ON DELETE CASCADE,
    driver_number INTEGER NOT NULL,
    points_current DOUBLE PRECISION,
    points_start DOUBLE PRECISION,
    position_current INTEGER,
    position_start INTEGER,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, driver_number)
);

CREATE TABLE championship_team_standings (
    session_key INTEGER NOT NULL REFERENCES sessions(session_key) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    points_current DOUBLE PRECISION,
    points_start DOUBLE PRECISION,
    position_current INTEGER,
    position_start INTEGER,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, team_name)
);