"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

import { fetchCircuitProfile } from "../../../lib/api";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function CircuitProfileContent({ circuitKey, year }: { circuitKey: number; year?: number }) {
  const profileQuery = useQuery({
    queryKey: ["circuit-profile", circuitKey, year],
    queryFn: () => fetchCircuitProfile(circuitKey, year),
    refetchInterval: 60000
  });

  const circuit = profileQuery.data?.circuit;
  const fact = circuit?.facts ?? null;

  return (
    <main className="page-shell">
      <header className="hero hero--compact">
        <p className="eyebrow">Circuit Profile</p>
        <h1>{circuit?.circuitShortName ?? `Circuit ${circuitKey}`}</h1>
        <p className="hero-subtitle">
          {circuit ? `${circuit.countryName} • ${circuit.location ?? "Location pending"}` : "Session history for this circuit."}
        </p>
      </header>

      <section className="panel controls-panel">
        <div className="filters-row">
          <Link href="/circuits" className="site-header__link">
            Back to Circuits
          </Link>
          <span className="api-link">/v1/circuits/{circuitKey}</span>
        </div>
      </section>

      {circuit ? (
        <section className="details-split-grid">
          <article className="panel circuit-profile-card">
            {circuit.circuitImage ? (
              <img src={circuit.circuitImage} alt={`${circuit.circuitShortName} map`} className="circuit-map circuit-map--large" />
            ) : (
              <div className="circuit-map circuit-map--large circuit-map--placeholder">Map pending</div>
            )}
            <div className="driver-stats-grid weather-grid">
              <div>
                <strong>Country</strong>
                <p>{circuit.countryName}</p>
              </div>
              <div>
                <strong>Location</strong>
                <p>{circuit.location ?? "-"}</p>
              </div>
              <div>
                <strong>Meetings</strong>
                <p>{circuit.meetingCount}</p>
              </div>
              <div>
                <strong>Latest Event</strong>
                <p>{circuit.latestMeetingName}</p>
              </div>
            </div>
          </article>

          <article className="panel content-card">
            <div className="panel-head">
              <h2>Track Facts</h2>
            </div>
            {fact ? (
              <div className="circuit-facts-grid">
                <div>
                  <strong>Length</strong>
                  <p>{fact.trackLengthKm} km</p>
                </div>
                <div>
                  <strong>Race Distance</strong>
                  <p>{fact.raceDistanceKm} km</p>
                </div>
                <div>
                  <strong>Turns</strong>
                  <p>{fact.turns}</p>
                </div>
                <div>
                  <strong>Laps</strong>
                  <p>{fact.laps}</p>
                </div>
                <div>
                  <strong>First GP</strong>
                  <p>{fact.firstGrandPrix}</p>
                </div>
                <div>
                  <strong>Direction</strong>
                  <p>{fact.direction}</p>
                </div>
                <div>
                  <strong>DRS Zones</strong>
                  <p>{fact.drsZones}</p>
                </div>
                <div>
                  <strong>Lap Record</strong>
                  <p>{fact.lapRecord}</p>
                </div>
                <div className="circuit-fact-span">
                  <strong>Lap Record Holder</strong>
                  <p>
                    {fact.lapRecordHolder} ({fact.lapRecordYear})
                  </p>
                </div>
                <div className="circuit-fact-span">
                  <strong>Overtaking Hotspot</strong>
                  <p>{fact.overtakingHotspot}</p>
                </div>
                <div className="circuit-fact-span">
                  <strong>Quick Fact</strong>
                  <p>{fact.quickFact}</p>
                </div>
              </div>
            ) : (
              <p className="empty-copy">Track fact pack is not available yet for this circuit name variant.</p>
            )}
          </article>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h2>Sessions</h2>
        </div>
        <div className="table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Meeting</th>
                <th>Session</th>
                <th>Type</th>
                <th>State</th>
                <th>Start</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(profileQuery.data?.sessions ?? []).map((session) => (
                <tr key={session.sessionKey}>
                  <td>{session.meetingName}</td>
                  <td>{session.sessionName}</td>
                  <td>{session.sessionType}</td>
                  <td>{session.currentState}</td>
                  <td>{formatDate(session.dateStart)}</td>
                  <td>
                    <Link href={`/races/${session.sessionKey}`} className="site-header__link">
                      Open Race
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default function CircuitProfilePage() {
  const [queryClient] = useState(() => new QueryClient());
  const params = useParams<{ circuitKey: string }>();
  const searchParams = useSearchParams();
  const circuitKey = Number(params.circuitKey);
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : undefined;

  if (Number.isNaN(circuitKey)) {
    return (
      <main className="page-shell">
        <section className="panel">
          <p>Invalid circuit key.</p>
        </section>
      </main>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <CircuitProfileContent circuitKey={circuitKey} year={year} />
    </QueryClientProvider>
  );
}
