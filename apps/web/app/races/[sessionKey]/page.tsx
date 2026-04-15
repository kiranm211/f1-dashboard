"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fetchLeaderboard, fetchSessionByKey, fetchSessionInsights } from "../../../lib/api";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function RaceDetailPageContent({ sessionKey }: { sessionKey: number }) {
  const sessionQuery = useQuery({
    queryKey: ["race-session", sessionKey],
    queryFn: () => fetchSessionByKey(sessionKey),
    refetchInterval: 30000
  });

  const leaderboardQuery = useQuery({
    queryKey: ["race-leaderboard", sessionKey],
    queryFn: () => fetchLeaderboard(sessionKey),
    refetchInterval: 5000
  });

  const insightsQuery = useQuery({
    queryKey: ["race-insights", sessionKey],
    queryFn: () => fetchSessionInsights(sessionKey, 5000),
    refetchInterval: 15000
  });

  const chartData = useMemo(
    () =>
      (leaderboardQuery.data?.items ?? []).slice(0, 10).map((item) => ({
        driver: item.nameAcronym ?? String(item.driverNumber),
        gap: item.interval ?? 0
      })),
    [leaderboardQuery.data]
  );

  return (
    <main className="page-shell">
      <header className="hero hero--compact">
        <p className="eyebrow">Race Detail</p>
        <h1>{sessionQuery.data?.item?.meetingName ?? `Session ${sessionKey}`}</h1>
        <p className="hero-subtitle">
          {sessionQuery.data?.item
            ? `${sessionQuery.data.item.sessionName} • ${sessionQuery.data.item.currentState.toUpperCase()}`
            : "Live timing and interval view for this session."}
        </p>
      </header>

      <section className="panel controls-panel">
        <div className="filters-row">
          <Link href="/races" className="site-header__link">
            Back to Races
          </Link>
          <Link href={`/races/${sessionKey}/replay`} className="site-header__link">
            Open Replay
          </Link>
          <Link href={`/races/${sessionKey}/analysis`} className="site-header__link">
            Race Analysis
          </Link>
          <span className="api-link">/v1/leaderboard?sessionKey={sessionKey}</span>
        </div>
      </section>

      {leaderboardQuery.isError ? (
        <section className="panel">
          <p className="empty-copy">Leaderboard request failed for this session. Sync may still be in progress or this session does not publish position/interval data.</p>
        </section>
      ) : null}

      {insightsQuery.isError ? (
        <section className="panel">
          <p className="empty-copy">Session insights request failed. If watermark lag is large but recent, data may still be syncing into query tables.</p>
        </section>
      ) : null}

      {sessionQuery.data?.item ? (
        <section className="panel">
          <div className="details-grid">
            <div>
              <strong>Session</strong>
              <p>{sessionQuery.data.item.sessionName}</p>
            </div>
            <div>
              <strong>State</strong>
              <p>{sessionQuery.data.item.currentState}</p>
            </div>
            <div>
              <strong>Circuit</strong>
              <p>{sessionQuery.data.item.circuitShortName ?? "Unknown Circuit"}</p>
            </div>
            <div>
              <strong>Start</strong>
              <p>{formatDate(sessionQuery.data.item.dateStart)}</p>
            </div>
            <div>
              <strong>End</strong>
              <p>{formatDate(sessionQuery.data.item.dateEnd)}</p>
            </div>
            <div>
              <strong>Updated</strong>
              <p>{formatDate(sessionQuery.data.item.updatedAt)}</p>
            </div>
          </div>
        </section>
      ) : null}

      {sessionQuery.isSuccess && sessionQuery.data.item === null ? (
        <section className="panel">
          <p className="empty-copy">Session {sessionKey} was not found. Check the URL or sync this session before viewing details.</p>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h2>Top 10 Intervals</h2>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="driver" stroke="rgba(255,255,255,0.7)" />
              <YAxis stroke="rgba(255,255,255,0.7)" />
              <Tooltip />
              <Bar dataKey="gap" fill="#45aaf2" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Live Timing Table</h2>
        </div>
        <div className="table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Driver</th>
                <th>Team</th>
                <th>Interval</th>
              </tr>
            </thead>
            <tbody>
              {(leaderboardQuery.data?.items ?? []).map((item) => (
                <tr key={item.driverNumber}>
                  <td>{item.position}</td>
                  <td>{item.fullName ?? item.nameAcronym ?? item.driverNumber}</td>
                  <td>{item.teamName ?? "-"}</td>
                  <td>{item.gapToLeader ?? (item.interval !== null ? `+${item.interval.toFixed(3)}s` : "-")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="details-split-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Weather Snapshot</h2>
          </div>
          {insightsQuery.data?.weather ? (
            <div className="driver-stats-grid weather-grid">
              <div>
                <strong>Air</strong>
                <p>{insightsQuery.data.weather.airTemperature ?? "-"} C</p>
              </div>
              <div>
                <strong>Track</strong>
                <p>{insightsQuery.data.weather.trackTemperature ?? "-"} C</p>
              </div>
              <div>
                <strong>Humidity</strong>
                <p>{insightsQuery.data.weather.humidity ?? "-"}%</p>
              </div>
              <div>
                <strong>Wind</strong>
                <p>{insightsQuery.data.weather.windSpeed ?? "-"} m/s</p>
              </div>
            </div>
          ) : (
            <p className="empty-copy">No synced weather snapshot yet.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>Race Control</h2>
          </div>
          {(insightsQuery.data?.raceControl ?? []).length > 0 ? (
            <div className="race-control-list">
              {(insightsQuery.data?.raceControl ?? []).map((event) => (
                <div key={`${event.date}-${event.message}`} className="race-control-item">
                  <strong>{event.category}</strong>
                  <p>{event.message}</p>
                  <small>
                    {formatDate(event.date)}
                    {event.flag ? ` • ${event.flag}` : ""}
                    {event.lapNumber !== null ? ` • Lap ${event.lapNumber}` : ""}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-copy">No race control events synced yet.</p>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Recent Pit Stops</h2>
        </div>
        {(insightsQuery.data?.pitStops ?? []).length > 0 ? (
          <div className="table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Driver</th>
                  <th>Lap</th>
                  <th>Stop</th>
                  <th>Lane</th>
                </tr>
              </thead>
              <tbody>
                {(insightsQuery.data?.pitStops ?? []).map((stop) => (
                  <tr key={`${stop.date}-${stop.driverNumber}-${stop.lapNumber}`}>
                    <td>{formatDate(stop.date)}</td>
                    <td>{stop.driverNumber}</td>
                    <td>{stop.lapNumber}</td>
                    <td>{stop.stopDuration !== null ? `${stop.stopDuration.toFixed(2)}s` : "-"}</td>
                    <td>{stop.laneDuration !== null ? `${stop.laneDuration.toFixed(2)}s` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-copy">No pit stop events synced yet for this session.</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Starting Grid</h2>
        </div>
        {(insightsQuery.data?.startingGrid ?? []).length > 0 ? (
          <div className="table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Grid</th>
                  <th>Driver</th>
                  <th>Team</th>
                  <th>Quali Lap</th>
                </tr>
              </thead>
              <tbody>
                {(insightsQuery.data?.startingGrid ?? []).map((item) => (
                  <tr key={item.driverNumber}>
                    <td>{item.position ?? "-"}</td>
                    <td>{item.fullName ?? item.nameAcronym ?? `#${item.driverNumber}`}</td>
                    <td>{item.teamName ?? "-"}</td>
                    <td>{item.lapDuration !== null ? `${item.lapDuration.toFixed(3)}s` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-copy">No starting grid data synced yet for this session.</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Session Results</h2>
        </div>
        {(insightsQuery.data?.sessionResults ?? []).length > 0 ? (
          <div className="table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Driver</th>
                  <th>Team</th>
                  <th>Laps</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(insightsQuery.data?.sessionResults ?? []).map((item) => (
                  <tr key={item.driverNumber}>
                    <td>{item.position ?? "-"}</td>
                    <td>{item.fullName ?? item.nameAcronym ?? `#${item.driverNumber}`}</td>
                    <td>{item.teamName ?? "-"}</td>
                    <td>{item.numberOfLaps ?? "-"}</td>
                    <td>{item.dsq ? "DSQ" : item.dns ? "DNS" : item.dnf ? "DNF" : "Classified"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-copy">No session results synced yet for this session.</p>
        )}
      </section>

      <section className="details-split-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Recent Overtakes</h2>
          </div>
          {(insightsQuery.data?.overtakes ?? []).length > 0 ? (
            <div className="race-control-list">
              {(insightsQuery.data?.overtakes ?? []).map((event) => (
                <div key={`${event.date}-${event.overtakingDriverNumber}-${event.overtakenDriverNumber}-${event.position}`} className="race-control-item">
                  <strong>
                    Car {event.overtakingDriverNumber} over Car {event.overtakenDriverNumber}
                  </strong>
                  <small>
                    {formatDate(event.date)} • Position {event.position}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-copy">No overtakes synced yet for this session.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>Team Radio</h2>
          </div>
          {(insightsQuery.data?.teamRadio ?? []).length > 0 ? (
            <div className="race-control-list">
              {(insightsQuery.data?.teamRadio ?? []).map((radio) => (
                <div key={`${radio.date}-${radio.driverNumber}-${radio.recordingUrl}`} className="race-control-item">
                  <strong>Car {radio.driverNumber}</strong>
                  <small>{formatDate(radio.date)}</small>
                  <a href={radio.recordingUrl} target="_blank" rel="noreferrer" className="site-header__link contact-link">
                    Play Radio
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-copy">No team radio clips synced yet for this session.</p>
          )}
        </article>
      </section>
    </main>
  );
}

export default function RaceDetailPage() {
  const [queryClient] = useState(() => new QueryClient());
  const params = useParams<{ sessionKey: string }>();
  const sessionKey = Number(params.sessionKey);

  if (Number.isNaN(sessionKey)) {
    return (
      <main className="page-shell">
        <section className="panel">
          <p>Invalid session key.</p>
          <Link href="/races" className="site-header__link">
            Back to Races
          </Link>
        </section>
      </main>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RaceDetailPageContent sessionKey={sessionKey} />
    </QueryClientProvider>
  );
}
