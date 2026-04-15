"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fetchRaceAnalysis, fetchSessionByKey } from "../../../../lib/api";
import type { RaceAnalysisDriver, RaceAnalysisStint } from "../../../../lib/api";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3).padStart(6, "0");
  return mins > 0 ? `${mins}:${secs}` : `${secs}s`;
}

const COMPOUND_COLOUR: Record<string, string> = {
  SOFT: "#e63946",
  MEDIUM: "#f4a261",
  HARD: "#e9ecef",
  INTERMEDIATE: "#2a9d8f",
  WET: "#457b9d",
  UNKNOWN: "#adb5bd"
};

function compoundColour(compound: string | null): string {
  return COMPOUND_COLOUR[(compound ?? "UNKNOWN").toUpperCase()] ?? "#adb5bd";
}

const DRIVER_PALETTE = [
  "#45aaf2", "#ff6b6b", "#ffd43b", "#51cf66", "#cc5de8",
  "#ff922b", "#20c997", "#f06595", "#a9e34b", "#339af0"
];

function StrategyTimeline({
  drivers,
  stints,
  totalLaps
}: {
  drivers: RaceAnalysisDriver[];
  stints: RaceAnalysisStint[];
  totalLaps: number;
}) {
  const byDriver = useMemo(() => {
    const map = new Map<number, RaceAnalysisStint[]>();
    for (const stint of stints) {
      const arr = map.get(stint.driverNumber) ?? [];
      arr.push(stint);
      map.set(stint.driverNumber, arr);
    }
    return map;
  }, [stints]);

  if (totalLaps === 0) {
    return <p className="empty-copy">No stint data has been synced for this session yet.</p>;
  }

  return (
    <div className="strategy-timeline">
      {drivers.map((driver) => {
        const driverStints = byDriver.get(driver.driverNumber) ?? [];
        if (driverStints.length === 0) return null;

        return (
          <div key={driver.driverNumber} className="strategy-row">
            <span className="strategy-label">{driver.nameAcronym ?? driver.fullName}</span>
            <div className="strategy-track">
              {driverStints.map((stint) => {
                const lapStart = stint.lapStart ?? 1;
                const lapEnd = stint.lapEnd ?? totalLaps;
                const left = ((lapStart - 1) / totalLaps) * 100;
                const width = ((lapEnd - lapStart + 1) / totalLaps) * 100;
                const bg = compoundColour(stint.compound);
                return (
                  <div
                    key={stint.stintNumber}
                    className="strategy-segment"
                    style={{ left: `${left}%`, width: `${width}%`, background: bg }}
                    title={`${stint.compound ?? "??"} • Laps ${lapStart}–${lapEnd}${stint.tyreAgeAtStart !== null ? ` • ${stint.tyreAgeAtStart} lap tyre age` : ""}`}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="strategy-compound-legend">
        {Object.entries(COMPOUND_COLOUR).map(([name, colour]) => (
          <span key={name} className="strategy-compound-chip" style={{ background: colour }}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

function RaceAnalysisContent({ sessionKey }: { sessionKey: number }) {
  const [selectedDrivers, setSelectedDrivers] = useState<Set<number>>(new Set());

  const sessionQuery = useQuery({
    queryKey: ["race-analysis-session", sessionKey],
    queryFn: () => fetchSessionByKey(sessionKey),
    refetchInterval: 60000
  });

  const analysisQuery = useQuery({
    queryKey: ["race-analysis", sessionKey],
    queryFn: () => fetchRaceAnalysis(sessionKey),
    refetchInterval: 30000
  });

  const data = analysisQuery.data;

  const totalLaps = useMemo(() => {
    if (!data?.laps.length) return 0;
    return Math.max(...data.laps.map((l) => l.lapNumber));
  }, [data]);

  // Initialise driver selection to first 5 when data loads
  const allDriverNumbers = useMemo(() => data?.drivers.map((d) => d.driverNumber) ?? [], [data]);
  const effectiveSelected = useMemo(() => {
    if (selectedDrivers.size > 0) return selectedDrivers;
    return new Set(allDriverNumbers.slice(0, 5));
  }, [selectedDrivers, allDriverNumbers]);

  // Build lap time chart data: one entry per lap number, one key per driver
  const lapChartData = useMemo(() => {
    if (!data) return [];
    const selectedList = Array.from(effectiveSelected);
    const byLap = new Map<number, Record<string, number | null>>();

    for (const lap of data.laps) {
      if (!effectiveSelected.has(lap.driverNumber)) continue;
      if (lap.isPitOutLap) continue; // skip out-laps — they skew the chart
      if (lap.lapDuration === null) continue;

      const acronym =
        data.drivers.find((d) => d.driverNumber === lap.driverNumber)?.nameAcronym ??
        String(lap.driverNumber);

      const entry = byLap.get(lap.lapNumber) ?? { lap: lap.lapNumber };
      entry[acronym] = lap.lapDuration;
      byLap.set(lap.lapNumber, entry);
    }

    return Array.from(byLap.values()).sort((a, b) => (a.lap as number) - (b.lap as number));
  }, [data, effectiveSelected]);

  const selectedDriverObjects = useMemo(
    () => (data?.drivers ?? []).filter((d) => effectiveSelected.has(d.driverNumber)),
    [data, effectiveSelected]
  );

  function toggleDriver(driverNumber: number) {
    setSelectedDrivers((prev) => {
      const next = new Set(prev.size ? prev : allDriverNumbers.slice(0, 5));
      if (next.has(driverNumber)) {
        next.delete(driverNumber);
      } else {
        next.add(driverNumber);
      }
      return next;
    });
  }

  return (
    <main className="page-shell">
      <header className="hero hero--compact">
        <p className="eyebrow">Race Analysis</p>
        <h1>{sessionQuery.data?.item?.meetingName ?? `Session ${sessionKey}`}</h1>
        <p className="hero-subtitle">
          {sessionQuery.data?.item
            ? `${sessionQuery.data.item.sessionName} • Lap times, tyre strategy, and pit stop data`
            : "Lap times, tyre strategy, and pit stop breakdown."}
        </p>
      </header>

      <section className="panel controls-panel">
        <div className="filters-row">
          <Link href={`/races/${sessionKey}`} className="site-header__link">
            Back to Race
          </Link>
          <span className="api-link">/v1/race-analysis?sessionKey={sessionKey}</span>
        </div>
      </section>

      {sessionQuery.isSuccess && sessionQuery.data.item === null ? (
        <section className="panel">
          <p className="empty-copy">Session {sessionKey} was not found. Analysis is unavailable until the session exists in the database.</p>
        </section>
      ) : null}

      {/* Driver toggle pills */}
      {(data?.drivers ?? []).length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2>Driver Selection</h2>
            <span className="race-meta-item">Select drivers to highlight in the lap time chart</span>
          </div>
          <div className="driver-toggle-row">
            {(data?.drivers ?? []).map((driver, index) => {
              const active = effectiveSelected.has(driver.driverNumber);
              return (
                <button
                  key={driver.driverNumber}
                  className={`driver-pill${active ? " driver-pill--active" : ""}`}
                  style={active ? { borderColor: DRIVER_PALETTE[index % DRIVER_PALETTE.length], color: DRIVER_PALETTE[index % DRIVER_PALETTE.length] } : undefined}
                  onClick={() => toggleDriver(driver.driverNumber)}
                >
                  {driver.nameAcronym ?? driver.fullName}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Lap time chart */}
      <section className="panel">
        <div className="panel-head">
          <h2>Lap Times</h2>
          {totalLaps > 0 && <span className="race-meta-item">{totalLaps} laps • pit-out laps excluded</span>}
        </div>
        {lapChartData.length > 0 ? (
          <div className="chart-wrap chart-wrap--tall">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lapChartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="lap" stroke="rgba(255,255,255,0.7)" label={{ value: "Lap", position: "insideBottomRight", offset: -4, fill: "rgba(255,255,255,0.5)" }} />
                <YAxis
                  stroke="rgba(255,255,255,0.7)"
                  tickFormatter={(value: number) => formatDuration(value)}
                  width={65}
                />
                <Tooltip formatter={(value: number) => formatDuration(value)} labelFormatter={(label) => `Lap ${label}`} />
                <Legend />
                {selectedDriverObjects.map((driver, index) => (
                  <Line
                    key={driver.driverNumber}
                    type="monotone"
                    dataKey={driver.nameAcronym ?? String(driver.driverNumber)}
                    stroke={DRIVER_PALETTE[index % DRIVER_PALETTE.length]}
                    dot={false}
                    strokeWidth={2}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="empty-copy">No lap time data has been synced for this session yet.</p>
        )}
      </section>

      {/* Tyre strategy */}
      <section className="panel">
        <div className="panel-head">
          <h2>Tyre Strategy</h2>
          {totalLaps > 0 && <span className="race-meta-item">{totalLaps} laps total</span>}
        </div>
        <StrategyTimeline drivers={data?.drivers ?? []} stints={data?.stints ?? []} totalLaps={totalLaps} />
      </section>

      {/* Pit stops table */}
      {(data?.pitStops ?? []).length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2>Pit Stops</h2>
          </div>
          <div className="table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Lap</th>
                  <th>Stop Duration</th>
                  <th>Pit Lane Duration</th>
                </tr>
              </thead>
              <tbody>
                {(data?.pitStops ?? []).map((stop) => {
                  const driver = data?.drivers.find((d) => d.driverNumber === stop.driverNumber);
                  return (
                    <tr key={`${stop.driverNumber}-${stop.lapNumber}`}>
                      <td>{driver?.nameAcronym ?? `#${stop.driverNumber}`}</td>
                      <td>{stop.lapNumber}</td>
                      <td>{stop.stopDuration !== null ? `${stop.stopDuration.toFixed(1)}s` : "-"}</td>
                      <td>{stop.laneDuration !== null ? `${stop.laneDuration.toFixed(1)}s` : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(data?.telemetry ?? []).length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2>Telemetry Summary</h2>
          </div>
          <div className="table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Top Speed</th>
                  <th>Avg Speed</th>
                  <th>Avg Throttle</th>
                  <th>Avg RPM</th>
                  <th>Car Samples</th>
                  <th>Location Samples</th>
                </tr>
              </thead>
              <tbody>
                {(data?.telemetry ?? []).map((item) => {
                  const driver = data?.drivers.find((d) => d.driverNumber === item.driverNumber);
                  return (
                    <tr key={item.driverNumber}>
                      <td>{driver?.nameAcronym ?? driver?.fullName ?? `#${item.driverNumber}`}</td>
                      <td>{item.topSpeed !== null ? `${item.topSpeed} km/h` : "-"}</td>
                      <td>{item.avgSpeed !== null ? `${item.avgSpeed.toFixed(1)} km/h` : "-"}</td>
                      <td>{item.avgThrottle !== null ? `${item.avgThrottle.toFixed(1)}%` : "-"}</td>
                      <td>{item.avgRpm !== null ? `${Math.round(item.avgRpm)}` : "-"}</td>
                      <td>{item.carSamples}</td>
                      <td>{item.locationSamples}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

export default function RaceAnalysisPage() {
  const [queryClient] = useState(() => new QueryClient());
  const params = useParams<{ sessionKey: string }>();
  const sessionKey = Number(params.sessionKey);

  if (Number.isNaN(sessionKey)) {
    return (
      <main className="page-shell">
        <section className="panel">
          <p>Invalid session key.</p>
        </section>
      </main>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RaceAnalysisContent sessionKey={sessionKey} />
    </QueryClientProvider>
  );
}
