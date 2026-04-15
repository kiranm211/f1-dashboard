"use client";

import { useMemo, useState } from "react";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

import { fetchSessions, fetchStandings } from "../../lib/api";

function StandingsPageContent() {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["standings-years"],
    queryFn: () => fetchSessions({ limit: 100 }),
    refetchInterval: 60000
  });

  const standingsQuery = useQuery({
    queryKey: ["standings", selectedYear],
    queryFn: () => fetchStandings(selectedYear ?? undefined),
    refetchInterval: 60000
  });

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const session of sessionsQuery.data?.items ?? []) {
      years.add(new Date(session.dateStart).getUTCFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [sessionsQuery.data]);

  return (
    <main className="page-shell">
      <header className="hero hero--compact">
        <p className="eyebrow">Season Rankings</p>
        <h1>Standings</h1>
        <p className="hero-subtitle">Championship-style standings derived from synced race results. Current version uses race finish positions only.</p>
      </header>

      <section className="panel controls-panel">
        <div className="panel-head">
          <h2>Season Filter</h2>
        </div>
        <div className="filters-row">
          <label htmlFor="standings-year-filter">Year</label>
          <select
            id="standings-year-filter"
            value={selectedYear ?? standingsQuery.data?.year ?? ""}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <span className="api-link">/v1/standings</span>
        </div>
      </section>

      {standingsQuery.isError ? (
        <section className="panel">
          <p>Failed to load standings.</p>
        </section>
      ) : null}

      <section className="standings-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Drivers</h2>
          </div>
          <div className="table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Driver</th>
                  <th>Team</th>
                  <th>Pts</th>
                  <th>Wins</th>
                  <th>Podiums</th>
                </tr>
              </thead>
              <tbody>
                {(standingsQuery.data?.drivers ?? []).map((item) => (
                  <tr key={item.driverNumber}>
                    <td>{item.rank}</td>
                    <td>{item.fullName}</td>
                    <td>{item.teamName ?? "-"}</td>
                    <td>{item.points}</td>
                    <td>{item.wins}</td>
                    <td>{item.podiums}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>Teams</h2>
          </div>
          <div className="table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Pts</th>
                  <th>Wins</th>
                  <th>Podiums</th>
                  <th>Drivers</th>
                </tr>
              </thead>
              <tbody>
                {(standingsQuery.data?.teams ?? []).map((item) => (
                  <tr key={item.teamName}>
                    <td>{item.rank}</td>
                    <td>{item.teamName}</td>
                    <td>{item.points}</td>
                    <td>{item.wins}</td>
                    <td>{item.podiums}</td>
                    <td>{item.driversCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="standings-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>OpenF1 Championship Drivers</h2>
            <span className="api-link">{standingsQuery.data?.championship.sessionKey ? `/v1/championship_drivers?session_key=${standingsQuery.data.championship.sessionKey}` : "No race snapshot"}</span>
          </div>
          {(standingsQuery.data?.championship.drivers ?? []).length > 0 ? (
            <div className="table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Driver</th>
                    <th>Team</th>
                    <th>Points</th>
                    <th>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {(standingsQuery.data?.championship.drivers ?? []).map((item) => {
                    const pointsDelta = item.pointsCurrent !== null && item.pointsStart !== null ? item.pointsCurrent - item.pointsStart : null;
                    return (
                      <tr key={item.driverNumber}>
                        <td>{item.positionCurrent ?? "-"}</td>
                        <td>{item.fullName ?? item.nameAcronym ?? `#${item.driverNumber}`}</td>
                        <td>{item.teamName ?? "-"}</td>
                        <td>{item.pointsCurrent ?? "-"}</td>
                        <td>{pointsDelta !== null ? `${pointsDelta >= 0 ? "+" : ""}${pointsDelta.toFixed(0)}` : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-copy">No championship driver snapshot synced yet.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>OpenF1 Championship Teams</h2>
            <span className="api-link">{standingsQuery.data?.championship.sessionKey ? `/v1/championship_teams?session_key=${standingsQuery.data.championship.sessionKey}` : "No race snapshot"}</span>
          </div>
          {(standingsQuery.data?.championship.teams ?? []).length > 0 ? (
            <div className="table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Team</th>
                    <th>Points</th>
                    <th>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {(standingsQuery.data?.championship.teams ?? []).map((item) => {
                    const pointsDelta = item.pointsCurrent !== null && item.pointsStart !== null ? item.pointsCurrent - item.pointsStart : null;
                    return (
                      <tr key={item.teamName}>
                        <td>{item.positionCurrent ?? "-"}</td>
                        <td>{item.teamName}</td>
                        <td>{item.pointsCurrent ?? "-"}</td>
                        <td>{pointsDelta !== null ? `${pointsDelta >= 0 ? "+" : ""}${pointsDelta.toFixed(0)}` : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-copy">No championship team snapshot synced yet.</p>
          )}
        </article>
      </section>
    </main>
  );
}

export default function StandingsPage() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <StandingsPageContent />
    </QueryClientProvider>
  );
}
