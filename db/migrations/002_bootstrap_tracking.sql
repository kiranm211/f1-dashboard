CREATE TABLE session_bootstrap_status (
    session_key INTEGER PRIMARY KEY REFERENCES sessions(session_key) ON DELETE CASCADE,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE session_bootstrap_syncs (
    session_key INTEGER NOT NULL REFERENCES sessions(session_key) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, endpoint)
);

CREATE INDEX idx_session_bootstrap_status_completed ON session_bootstrap_status(completed);
