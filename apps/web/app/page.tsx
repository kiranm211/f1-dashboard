"use client";

import { useMemo, useState } from "react";

import { QueryClient, QueryClientProvider, useQueries, useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { MetricCard } from "../components/MetricCard";
import { fetchHealth, fetchLeaderboard, fetchSessions } from "../lib/api";

function formatStaleness(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  if (value < 1000) {
    return `${value}ms`;
  }
  return `${(value / 1000).toFixed(1)}s`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function DashboardPageContent() {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<number | null>(null);

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 30000
  });

  const sessionsQuery = useQuery({
    queryKey: ["sessions", selectedYear],
    queryFn: () => fetchSessions({ year: selectedYear ?? undefined, limit: 40 }),
    refetchInterval: 30000
  });

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const session of sessionsQuery.data?.items ?? []) {
      years.add(new Date(session.dateStart).getUTCFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [sessionsQuery.data]);

  const effectiveSessionKey = selectedSession ?? sessionsQuery.data?.items[0]?.sessionKey ?? null;

  const leaderboardQuery = useQuery({
    queryKey: ["leaderboard", effectiveSessionKey],
    queryFn: () => fetchLeaderboard(effectiveSessionKey as number),
    enabled: effectiveSessionKey !== null,
    refetchInterval: 5000
  });

  const readinessChecks = useQueries({
    queries: (sessionsQuery.data?.items ?? []).map((session) => ({
      queryKey: ["leaderboard-ready", session.sessionKey],
      queryFn: () => fetchLeaderboard(session.sessionKey),
      staleTime: 60000,
      refetchInterval: 60000,
      retry: 1
    }))
  });

  const readySessionKeys = useMemo(() => {
    const keys = new Set<number>();
    (sessionsQuery.data?.items ?? []).forEach((session, index) => {
      const result = readinessChecks[index];
      if (result?.data?.items && result.data.items.length > 0) {
        keys.add(session.sessionKey);
      }
    });
    return keys;
  }, [readinessChecks, sessionsQuery.data]);

  const chartData = useMemo(
    () =>
      (leaderboardQuery.data?.items ?? []).slice(0, 10).map((item) => ({
        driver: item.nameAcronym ?? String(item.driverNumber),
        interval: item.interval ?? 0
      })),
    [leaderboardQuery.data]
  );

  const selectedSessionDetails = useMemo(
    () => (sessionsQuery.data?.items ?? []).find((session) => session.sessionKey === effectiveSessionKey) ?? null,
    [sessionsQuery.data, effectiveSessionKey]
  );

  const liveSessionCount = sessionsQuery.data?.items.filter((item) => item.currentState === "live").length ?? 0;
  const dataReadyCount = readySessionKeys.size;

  return (
    <main className="page-shell">
      <header className="hero">
        <p className="eyebrow">F1 Data Control Surface</p>
        <h1>Live Strategy Desk</h1>
        <p className="hero-subtitle">Linked APIs: health, sessions, and leaderboard with year filter and data-ready session discovery.</p>
      </header>

      <section className="metrics-grid">
        <MetricCard label="API Health" value={healthQuery.data?.status?.toUpperCase() ?? "UNKNOWN"} accent="#20bf6b" />
        <MetricCard label="Live Sessions" value={String(liveSessionCount)} accent="#ff6b6b" />
        <MetricCard label="Sessions With Data" value={String(dataReadyCount)} accent="#45aaf2" />
        <MetricCard label="Sessions Freshness" value={formatStaleness(sessionsQuery.data?.meta.freshness.stalenessMs ?? null)} accent="#f7b731" />
      </section>

      <section className="panel controls-panel">
        <div className="panel-head">
          <h2>Filters</h2>
        </div>
        <div className="filters-row">
          <label htmlFor="year-filter">Year</label>
          <select
            id="year-filter"
            value={selectedYear ?? "all"}
            onChange={(event) => {
              const next = event.target.value === "all" ? null : Number(event.target.value);
              setSelectedYear(next);
              setSelectedSession(null);
            }}
          >
            <option value="all">All Years</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <span className="api-link">/v1/sessions{selectedYear ? `?year=${selectedYear}` : ""}</span>
          <span className="api-link">/health</span>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Session Details</h2>
          </div>
          <div className="session-list">
            {(sessionsQuery.data?.items ?? []).map((session) => {
              const isReady = readySessionKeys.has(session.sessionKey);
              return (
                <button
                  key={session.sessionKey}
                  className={`session-item ${effectiveSessionKey === session.sessionKey ? "active" : ""}`}
                  onClick={() => setSelectedSession(session.sessionKey)}
                >
                  <span>{session.meetingName}</span>
                  <small>
                    {session.sessionName} - {session.currentState.toUpperCase()} - {new Date(session.dateStart).getUTCFullYear()}
                  </small>
                  <small>{isReady ? "Data Ready" : "Syncing / No Data"}</small>
                </button>
              );
            })}
          </div>
        </article>

        <article className="panel panel--wide">
          <div className="panel-head">
            <h2>Selected Session</h2>
            {effectiveSessionKey ? <span className="api-link">/v1/leaderboard?sessionKey={effectiveSessionKey}</span> : null}
          </div>
          {selectedSessionDetails ? (
            <div className="details-grid">
              <div>
                <strong>Meeting</strong>
                <p>{selectedSessionDetails.meetingName}</p>
              </div>
              <div>
                <strong>Session</strong>
                <p>{selectedSessionDetails.sessionName}</p>
              </div>
              <div>
                <strong>State</strong>
                <p>{selectedSessionDetails.currentState}</p>
              </div>
              <div>
                <strong>Start</strong>
                <p>{formatDate(selectedSessionDetails.dateStart)}</p>
              </div>
              <div>
                <strong>End</strong>
                <p>{formatDate(selectedSessionDetails.dateEnd)}</p>
              </div>
              <div>
                <strong>DB Updated</strong>
                <p>{formatDate(selectedSessionDetails.updatedAt)}</p>
              </div>
            </div>
          ) : (
            <p>No session selected.</p>
          )}

          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 8, left: 0 }}>
                <defs>
                  <linearGradient id="intervalGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#ff6b6b" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#ff6b6b" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="driver" stroke="rgba(255,255,255,0.7)" />
                <YAxis stroke="rgba(255,255,255,0.7)" />
                <Tooltip />
                <Area dataKey="interval" stroke="#ff6b6b" fill="url(#intervalGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
    </main>
  );
}

export default function Page() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <DashboardPageContent />
    </QueryClientProvider>
  );
}
