"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fetchReplay, fetchSessionByKey } from "../../../../lib/api";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function RaceReplayContent({ sessionKey }: { sessionKey: number }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ["replay-session", sessionKey],
    queryFn: () => fetchSessionByKey(sessionKey),
    refetchInterval: 60000
  });

  const replayQuery = useQuery({
    queryKey: ["replay", sessionKey],
    queryFn: () => fetchReplay(sessionKey, 90),
    refetchInterval: 60000
  });

  const frames = replayQuery.data?.frames ?? [];
  const currentFrame = frames[frameIndex] ?? null;

  useEffect(() => {
    if (!isPlaying || frames.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setFrameIndex((current) => {
        if (current >= frames.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPlaying, frames.length]);

  useEffect(() => {
    if (frameIndex >= frames.length && frames.length > 0) {
      setFrameIndex(0);
    }
  }, [frameIndex, frames.length]);

  const chartData = useMemo(
    () =>
      (currentFrame?.items ?? []).map((item) => ({
        driver: item.nameAcronym ?? String(item.driverNumber),
        gap: item.interval ?? 0
      })),
    [currentFrame]
  );

  return (
    <main className="page-shell">
      <header className="hero hero--compact">
        <p className="eyebrow">Historic Replay</p>
        <h1>{sessionQuery.data?.item?.meetingName ?? `Session ${sessionKey}`}</h1>
        <p className="hero-subtitle">
          {sessionQuery.data?.item
            ? `${sessionQuery.data.item.sessionName} replay using stored position and interval snapshots.`
            : "Replay stored snapshots for this session."}
        </p>
      </header>

      <section className="panel controls-panel">
        <div className="filters-row">
          <Link href={`/races/${sessionKey}`} className="site-header__link">
            Back to Race Detail
          </Link>
          <button type="button" className="site-header__link replay-button" onClick={() => setIsPlaying((value) => !value)}>
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button type="button" className="site-header__link replay-button" onClick={() => setFrameIndex(0)}>
            Reset
          </button>
          <span className="api-link">/v1/replay?sessionKey={sessionKey}</span>
        </div>
      </section>

      {sessionQuery.isSuccess && sessionQuery.data.item === null ? (
        <section className="panel">
          <p className="empty-copy">Session {sessionKey} was not found. Replay is unavailable until this session is present in the database.</p>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h2>Timeline</h2>
          <span className="api-link">{currentFrame ? formatDate(currentFrame.timestamp) : "No frames"}</span>
        </div>
        <div className="replay-slider-wrap">
          <input
            type="range"
            min={0}
            max={Math.max(frames.length - 1, 0)}
            step={1}
            value={Math.min(frameIndex, Math.max(frames.length - 1, 0))}
            onChange={(event) => setFrameIndex(Number(event.target.value))}
            className="replay-slider"
            disabled={frames.length === 0}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Top 10 Gap Snapshot</h2>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="driver" stroke="rgba(255,255,255,0.7)" />
              <YAxis stroke="rgba(255,255,255,0.7)" />
              <Tooltip />
              <Bar dataKey="gap" fill="#f7b731" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Replay Frame</h2>
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
              {(currentFrame?.items ?? []).map((item) => (
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
    </main>
  );
}

export default function RaceReplayPage() {
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
      <RaceReplayContent sessionKey={sessionKey} />
    </QueryClientProvider>
  );
}
