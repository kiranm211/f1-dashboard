"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

import { fetchDriverProfile } from "../../../lib/api";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

function DriverProfileContent({ driverNumber, year }: { driverNumber: number; year?: number }) {
  const profileQuery = useQuery({
    queryKey: ["driver-profile", driverNumber, year],
    queryFn: () => fetchDriverProfile(driverNumber, year),
    refetchInterval: 60000
  });

  const profile = profileQuery.data?.profile;

  return (
    <main className="page-shell">
      <header className="hero hero--compact">
        <p className="eyebrow">Driver Profile</p>
        <h1>{profile?.fullName ?? `Driver ${driverNumber}`}</h1>
        <p className="hero-subtitle">{profile?.teamName ?? "Team pending"} • Season {profileQuery.data?.year ?? year ?? new Date().getUTCFullYear()}</p>
      </header>

      <section className="panel controls-panel">
        <div className="filters-row">
          <Link href="/drivers" className="site-header__link">
            Back to Drivers
          </Link>
          <span className="api-link">/v1/drivers/{driverNumber}</span>
        </div>
      </section>

      {profile ? (
        <section className="details-split-grid">
          <article className="panel driver-profile-card">
            <div className="driver-profile-card__hero">
              {profile.headshotUrl ? (
                <img src={profile.headshotUrl} alt={profile.fullName} className="driver-headshot driver-headshot--large" />
              ) : (
                <div className="driver-headshot driver-headshot--large driver-headshot--placeholder">{profile.nameAcronym ?? profile.driverNumber}</div>
              )}
              <div className="content-card">
                <div className="panel-head">
                  <h2>{profile.fullName}</h2>
                  <span className="race-state">#{profile.driverNumber}</span>
                </div>
                <p className="race-subtitle">{profile.teamName ?? "Team pending"}</p>
                <div className="driver-meta-inline">
                  {profile.nameAcronym ? <span>{profile.nameAcronym}</span> : null}
                  {profile.countryCode ? <span>{profile.countryCode}</span> : null}
                  {profile.broadcastName ? <span>{profile.broadcastName}</span> : null}
                  {profile.facts?.nationality ? <span>{profile.facts.nationality}</span> : null}
                  {profile.facts?.debutSeason ? <span>Debut {profile.facts.debutSeason}</span> : null}
                </div>
                {profile.teamColour ? <div className="driver-team-accent" style={{ backgroundColor: `#${profile.teamColour}` }} /> : null}
                {profile.facts ? <p className="driver-fact-callout">{profile.facts.factHeadline}</p> : null}
              </div>
            </div>

            <div className="driver-stats-grid weather-grid">
              <div>
                <strong>First Name</strong>
                <p>{profile.firstName ?? "-"}</p>
              </div>
              <div>
                <strong>Last Name</strong>
                <p>{profile.lastName ?? "-"}</p>
              </div>
              <div>
                <strong>Broadcast Name</strong>
                <p>{profile.broadcastName ?? "-"}</p>
              </div>
              <div>
                <strong>Country Code</strong>
                <p>{profile.countryCode ?? "-"}</p>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h2>Season Summary</h2>
            </div>
            <div className="driver-stats-grid">
              <div>
                <strong>Rank</strong>
                <p>{profile.rank || "-"}</p>
              </div>
              <div>
                <strong>Points</strong>
                <p>{profile.points}</p>
              </div>
              <div>
                <strong>Wins</strong>
                <p>{profile.wins}</p>
              </div>
              <div>
                <strong>Podiums</strong>
                <p>{profile.podiums}</p>
              </div>
              <div>
                <strong>Race Starts</strong>
                <p>{profile.racesCount}</p>
              </div>
              <div>
                <strong>Driver Number</strong>
                <p>{profile.driverNumber}</p>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {profile?.facts ? (
        <section className="panel driver-facts-panel">
          <div className="panel-head">
            <h2>Driver Facts</h2>
          </div>
          <div className="driver-stats-grid weather-grid">
            <div>
              <strong>Nationality</strong>
              <p>{profile.facts.nationality}</p>
            </div>
            <div>
              <strong>Date of Birth</strong>
              <p>{formatDate(profile.facts.dateOfBirth)}</p>
            </div>
            <div>
              <strong>Place of Birth</strong>
              <p>{profile.facts.placeOfBirth}</p>
            </div>
            <div>
              <strong>F1 Debut</strong>
              <p>{profile.facts.debutSeason}</p>
            </div>
          </div>
          <div className="driver-facts-list">
            <div>
              <strong>Junior Career Highlight</strong>
              <p>{profile.facts.juniorCareerHighlight}</p>
            </div>
            <div>
              <strong>Quick Fact</strong>
              <p>{profile.facts.factHeadline}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h2>Recent Race Results</h2>
        </div>
        <div className="table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Meeting</th>
                <th>Session</th>
                <th>Pos</th>
                <th>Pts</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(profileQuery.data?.recentResults ?? []).map((result) => (
                <tr key={`${result.sessionKey}-${result.dateStart}`}>
                  <td>{formatDate(result.dateStart)}</td>
                  <td>{result.meetingName}</td>
                  <td>{result.sessionName}</td>
                  <td>{result.position ?? "-"}</td>
                  <td>{result.points}</td>
                  <td>{result.dsq ? "DSQ" : result.dns ? "DNS" : result.dnf ? "DNF" : "Classified"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default function DriverProfilePage() {
  const [queryClient] = useState(() => new QueryClient());
  const params = useParams<{ driverNumber: string }>();
  const searchParams = useSearchParams();
  const driverNumber = Number(params.driverNumber);
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : undefined;

  if (Number.isNaN(driverNumber)) {
    return (
      <main className="page-shell">
        <section className="panel">
          <p>Invalid driver number.</p>
        </section>
      </main>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DriverProfileContent driverNumber={driverNumber} year={year} />
    </QueryClientProvider>
  );
}
