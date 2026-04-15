CREATE INDEX IF NOT EXISTS idx_meetings_year_date_start ON meetings(year, date_start DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_meeting_date_start ON sessions(meeting_key, date_start);
