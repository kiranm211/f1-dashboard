"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

import { fetchDrivers, fetchSessions } from "../../lib/api";

function DriversPageContent() {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["drivers-years"],
    queryFn: () => fetchSessions({ limit: 100 }),
    refetchInterval: 60000
  });

  const driversQuery = useQuery({
    queryKey: ["drivers", selectedYear],
    queryFn: () => fetchDrivers(selectedYear ?? undefined),
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
        <p className="eyebrow">Driver Directory</p>
        <h1>Drivers</h1>
        <p className="hero-subtitle">Explore season points leaders and drill into recent race results for each driver.</p>
      </header>

      <section className="panel controls-panel">
        <div className="panel-head">
          <h2>Season Filter</h2>
        </div>
        <div className="filters-row">
          <label htmlFor="drivers-year-filter">Year</label>
          <select
            id="drivers-year-filter"
            value={selectedYear ?? driversQuery.data?.year ?? ""}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <span className="api-link">/v1/drivers</span>
        </div>
      </section>

      <section className="drivers-grid">
        {(driversQuery.data?.items ?? []).map((driver) => (
          <article key={driver.driverNumber} className="panel driver-card">
            <div className="driver-card__hero">
              {driver.headshotUrl ? (
                <img src={driver.headshotUrl} alt={driver.fullName} className="driver-headshot" />
              ) : (
                <div className="driver-headshot driver-headshot--placeholder">{driver.nameAcronym ?? driver.driverNumber}</div>
              )}
              <div className="driver-card__identity">
                <div className="panel-head">
                  <h2>{driver.fullName}</h2>
                  <span className="race-state">P{driver.rank}</span>
                </div>
                <p className="race-subtitle">{driver.teamName ?? "Independent"}</p>
                <div className="driver-meta-inline">
                  {driver.nameAcronym ? <span>{driver.nameAcronym}</span> : null}
                  {driver.countryCode ? <span>{driver.countryCode}</span> : null}
                  {driver.broadcastName ? <span>{driver.broadcastName}</span> : null}
                  {driver.facts?.nationality ? <span>{driver.facts.nationality}</span> : null}
                  {driver.facts?.debutSeason ? <span>Debut {driver.facts.debutSeason}</span> : null}
                </div>
              </div>
            </div>
            {driver.teamColour ? <div className="driver-team-accent" style={{ backgroundColor: `#${driver.teamColour}` }} /> : null}
            {driver.facts ? <p className="driver-fact-callout">{driver.facts.factHeadline}</p> : null}
            <div className="driver-stats-grid">
              <div>
                <strong>Points</strong>
                <p>{driver.points}</p>
              </div>
              <div>
                <strong>Wins</strong>
                <p>{driver.wins}</p>
              </div>
              <div>
                <strong>Podiums</strong>
                <p>{driver.podiums}</p>
              </div>
              <div>
                <strong>Races</strong>
                <p>{driver.racesCount}</p>
              </div>
            </div>
            <Link href={`/drivers/${driver.driverNumber}${driversQuery.data?.year ? `?year=${driversQuery.data.year}` : ""}`} className="site-header__link">
              Open Profile
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}

export default function DriversPage() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <DriversPageContent />
    </QueryClientProvider>
  );
}
