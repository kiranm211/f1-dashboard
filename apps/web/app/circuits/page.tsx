"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

import { fetchCircuits, fetchSessions } from "../../lib/api";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

function CircuitsPageContent() {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["circuits-years"],
    queryFn: () => fetchSessions({ limit: 100 }),
    refetchInterval: 60000
  });

  const circuitsQuery = useQuery({
    queryKey: ["circuits", selectedYear],
    queryFn: () => fetchCircuits(selectedYear ?? undefined),
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
        <p className="eyebrow">Track Intelligence</p>
        <h1>Circuits</h1>
        <p className="hero-subtitle">Browse tracked circuits, inspect map imagery, and compare key facts such as lap record, length, and race distance.</p>
      </header>

      <section className="panel controls-panel">
        <div className="panel-head">
          <h2>Season Filter</h2>
        </div>
        <div className="filters-row">
          <label htmlFor="circuits-year-filter">Year</label>
          <select
            id="circuits-year-filter"
            value={selectedYear ?? circuitsQuery.data?.year ?? ""}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <span className="api-link">/v1/circuits</span>
        </div>
      </section>

      <section className="circuits-grid">
        {(circuitsQuery.data?.items ?? []).map((circuit) => {
          const fact = circuit.facts;

          return (
            <article key={circuit.circuitKey} className="panel circuit-card">
              {circuit.circuitImage ? (
                <img src={circuit.circuitImage} alt={`${circuit.circuitShortName} map`} className="circuit-map" />
              ) : (
                <div className="circuit-map circuit-map--placeholder">Map pending</div>
              )}
              <div className="panel-head">
                <h2>{circuit.circuitShortName}</h2>
                <span className="race-state">{circuit.countryName}</span>
              </div>
              <p className="race-subtitle">{circuit.location ?? "Location pending"}</p>
              <div className="race-meta">
                <span>Meetings: {circuit.meetingCount}</span>
                <span>Latest: {circuit.latestMeetingName}</span>
                <span>{formatDate(circuit.latestDateStart)}</span>
              </div>
              {fact ? (
                <div className="circuit-facts-inline">
                  <span>{fact.trackLengthKm} km</span>
                  <span>{fact.turns} turns</span>
                  <span>Lap: {fact.lapRecord}</span>
                </div>
              ) : null}
              <Link href={`/circuits/${circuit.circuitKey}${circuitsQuery.data?.year ? `?year=${circuitsQuery.data.year}` : ""}`} className="site-header__link">
                Open Circuit
              </Link>
            </article>
          );
        })}
      </section>
    </main>
  );
}

export default function CircuitsPage() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <CircuitsPageContent />
    </QueryClientProvider>
  );
}
