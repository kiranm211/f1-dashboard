"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

import { fetchRacesCalendar, type SessionItem } from "../../lib/api";

type SessionStateFilter = SessionItem["currentState"] | "all";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDayLabel(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric"
  });
}

function formatWeekendRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "short" });
  const dayFormatter = new Intl.DateTimeFormat(undefined, { day: "numeric" });

  const startMonth = monthFormatter.format(start);
  const endMonth = monthFormatter.format(end);
  const startDay = dayFormatter.format(start);
  const endDay = dayFormatter.format(end);

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }

  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

function getStateClassName(state: SessionItem["currentState"]): string {
  switch (state) {
    case "live":
      return "race-state race-state--live";
    case "warmup":
      return "race-state race-state--warmup";
    case "cooldown":
      return "race-state race-state--cooldown";
    case "scheduled":
      return "race-state race-state--scheduled";
    case "closed":
    default:
      return "race-state race-state--closed";
  }
}

function getSessionTypeClassName(sessionType: string): string {
  const normalized = sessionType.toLowerCase();

  if (normalized.includes("sprint")) {
    return "session-type-tag session-type-tag--sprint";
  }
  if (normalized.includes("qualifying")) {
    return "session-type-tag session-type-tag--qualifying";
  }
  if (normalized.includes("practice")) {
    return "session-type-tag session-type-tag--practice";
  }
  if (normalized.includes("race")) {
    return "session-type-tag session-type-tag--race";
  }

  return "session-type-tag session-type-tag--default";
}

function RacesPageContent() {
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedState, setSelectedState] = useState<SessionStateFilter>("all");
  const [raceOnly, setRaceOnly] = useState(true);

  const racesQuery = useQuery({
    queryKey: ["races-calendar", selectedYear, selectedState, raceOnly],
    queryFn: () =>
      fetchRacesCalendar({
        year: selectedYear,
        state: selectedState === "all" ? undefined : selectedState,
        raceOnly
      }),
    refetchInterval: 30000
  });

  const availableYears = useMemo(() => racesQuery.data?.availableYears ?? [], [racesQuery.data]);
  const months = racesQuery.data?.months ?? [];

  const summary = useMemo(() => {
    let weekends = 0;
    let sessions = 0;
    let live = 0;

    for (const month of months) {
      weekends += month.weekends.length;
      for (const weekend of month.weekends) {
        sessions += weekend.sessions.length;
        for (const session of weekend.sessions) {
          if (session.currentState === "live") {
            live += 1;
          }
        }
      }
    }

    return {
      months: months.length,
      weekends,
      sessions,
      live
    };
  }, [months]);

  return (
    <main className="page-shell">
      <header className="hero hero--compact">
        <p className="eyebrow">Race Calendar</p>
        <h1>Races</h1>
        <p className="hero-subtitle">Browse race weekends by month and jump straight into each session.</p>
      </header>

      <section className="panel controls-panel">
        <div className="panel-head">
          <h2>Calendar Controls</h2>
        </div>
        <div className="filters-row">
          <label htmlFor="races-year-filter">Year</label>
          <select
            id="races-year-filter"
            value={selectedYear ?? "current"}
            onChange={(event) => setSelectedYear(event.target.value === "current" ? undefined : Number(event.target.value))}
          >
            <option value="current">Current Season</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <label htmlFor="races-state-filter">State</label>
          <select
            id="races-state-filter"
            value={selectedState}
            onChange={(event) => setSelectedState(event.target.value as SessionStateFilter)}
          >
            <option value="all">All States</option>
            <option value="scheduled">Scheduled</option>
            <option value="warmup">Warmup</option>
            <option value="live">Live</option>
            <option value="cooldown">Cooldown</option>
            <option value="closed">Closed</option>
          </select>

          <label htmlFor="races-scope-filter">Scope</label>
          <select
            id="races-scope-filter"
            value={raceOnly ? "race-only" : "all-sessions"}
            onChange={(event) => setRaceOnly(event.target.value === "race-only")}
          >
            <option value="race-only">Race Sessions Only</option>
            <option value="all-sessions">All Session Types</option>
          </select>
          <span className="api-link">/v1/races/calendar</span>
        </div>
      </section>

      <section className="calendar-summary-row" aria-label="Season summary">
        <article className="panel calendar-summary-card">
          <small>Months</small>
          <strong>{summary.months}</strong>
        </article>
        <article className="panel calendar-summary-card">
          <small>Weekends</small>
          <strong>{summary.weekends}</strong>
        </article>
        <article className="panel calendar-summary-card">
          <small>Sessions</small>
          <strong>{summary.sessions}</strong>
        </article>
        <article className="panel calendar-summary-card">
          <small>Live Now</small>
          <strong>{summary.live}</strong>
        </article>
      </section>

      {(months.length ?? 0) > 0 ? (
        <section className="panel calendar-month-jump" aria-label="Month jump navigation">
          <div className="panel-head">
            <h2>Jump To Month</h2>
          </div>
          <div className="calendar-month-jump__items">
            {months.map((month) => (
              <a key={month.month} href={`#race-month-${month.month}`} className="calendar-month-jump__item">
                {month.monthLabel}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {racesQuery.isError ? (
        <section className="panel">
          <p>Failed to load race calendar. Try again in a moment.</p>
        </section>
      ) : null}

      {racesQuery.isLoading ? (
        <section className="panel">
          <p>Loading race calendar...</p>
        </section>
      ) : null}

      {!racesQuery.isLoading && !racesQuery.isError && (racesQuery.data?.months.length ?? 0) === 0 ? (
        <section className="panel">
          <p>No race weekends match the selected filters.</p>
        </section>
      ) : null}

      <section className="calendar-months-grid">
        {months.map((month) => (
          <article id={`race-month-${month.month}`} key={month.month} className="panel calendar-month-card">
            <div className="panel-head">
              <h2>{month.monthLabel}</h2>
              <span className="month-count">{month.weekends.length} weekends</span>
            </div>

            <div className="calendar-weekend-list">
              {month.weekends.map((weekend) => (
                <section key={weekend.meetingKey} className="calendar-weekend-item">
                  {(() => {
                    const liveCount = weekend.sessions.filter((session) => session.currentState === "live").length;
                    const upcomingCount = weekend.sessions.filter(
                      (session) => session.currentState === "scheduled" || session.currentState === "warmup"
                    ).length;
                    const closedCount = weekend.sessions.filter((session) => session.currentState === "closed").length;

                    return (
                      <div className="weekend-status-chips">
                        {liveCount > 0 ? <span className="weekend-status-chip weekend-status-chip--live">{liveCount} live</span> : null}
                        {upcomingCount > 0 ? (
                          <span className="weekend-status-chip weekend-status-chip--upcoming">{upcomingCount} upcoming</span>
                        ) : null}
                        {closedCount > 0 ? (
                          <span className="weekend-status-chip weekend-status-chip--closed">{closedCount} closed</span>
                        ) : null}
                      </div>
                    );
                  })()}

                  <div className="calendar-weekend-item__header">
                    <div>
                      <h3>{weekend.meetingName}</h3>
                      <p>
                        {weekend.countryName}
                        {weekend.location ? `, ${weekend.location}` : ""}
                        {` • ${formatWeekendRange(weekend.dateStart, weekend.dateEnd)}`}
                      </p>
                    </div>
                    <span>
                      {weekend.circuitShortName ?? "Unknown Circuit"}
                      <small>{weekend.sessions.length} sessions</small>
                    </span>
                  </div>

                  <div className="calendar-session-chips">
                    {weekend.sessions.map((session) => (
                      <Link key={session.sessionKey} href={`/races/${session.sessionKey}`} className="calendar-session-chip">
                        <strong>{session.sessionName}</strong>
                        <small>
                          <span className={getSessionTypeClassName(session.sessionType)}>{session.sessionType}</span>
                          {` • ${formatDayLabel(session.dateStart)}`}
                        </small>
                        <small>{formatDateTime(session.dateStart)}</small>
                        <span className={session.dataReady ? "data-ready-badge data-ready-badge--ready" : "data-ready-badge data-ready-badge--pending"}>
                          {session.dataReady ? "Data Ready" : "Syncing"}
                        </span>
                        <span className={getStateClassName(session.currentState)}>{session.currentState.toUpperCase()}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

export default function RacesPage() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <RacesPageContent />
    </QueryClientProvider>
  );
}
