"use client";

import { useEffect, useMemo, useState } from "react";

import { QueryClient, QueryClientProvider, useQueries, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fetchLeaderboard, fetchSessions } from "../../lib/api";

function ComparePageContent() {
  const [leftSession, setLeftSession] = useState<number | null>(null);
  const [rightSession, setRightSession] = useState<number | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["compare-sessions"],
    queryFn: () => fetchSessions({ limit: 80 }),
    refetchInterval: 30000
  });

  useEffect(() => {
    const first = sessionsQuery.data?.items[0]?.sessionKey ?? null;
    const second = sessionsQuery.data?.items[1]?.sessionKey ?? null;

    if (leftSession === null && first !== null) {
      setLeftSession(first);
    }
    if (rightSession === null && second !== null) {
      setRightSession(second);
    }
  }, [sessionsQuery.data, leftSession, rightSession]);

  const [leftLeaderboard, rightLeaderboard] = useQueries({
    queries: [
      {
        queryKey: ["compare-left", leftSession],
        queryFn: () => fetchLeaderboard(leftSession as number),
        enabled: leftSession !== null,
        refetchInterval: 10000
      },
      {
        queryKey: ["compare-right", rightSession],
        queryFn: () => fetchLeaderboard(rightSession as number),
        enabled: rightSession !== null,
        refetchInterval: 10000
      }
    ]
  });

  const leftName = useMemo(
    () => sessionsQuery.data?.items.find((item) => item.sessionKey === leftSession)?.meetingName ?? "Left Session",
    [sessionsQuery.data, leftSession]
  );
  const rightName = useMemo(
    () => sessionsQuery.data?.items.find((item) => item.sessionKey === rightSession)?.meetingName ?? "Right Session",
    [sessionsQuery.data, rightSession]
  );

  const chartData = useMemo(() => {
    const leftItems = (leftLeaderboard.data?.items ?? []).slice(0, 10);
    const rightByDriver = new Map((rightLeaderboard.data?.items ?? []).map((item) => [item.driverNumber, item]));

    return leftItems.map((leftItem) => {
      const rightItem = rightByDriver.get(leftItem.driverNumber);
      return {
        driver: leftItem.nameAcronym ?? String(leftItem.driverNumber),
        leftGap: leftItem.interval ?? 0,
        rightGap: rightItem?.interval ?? 0
      };
    });
  }, [leftLeaderboard.data, rightLeaderboard.data]);

  return (
    <main className="page-shell">
      <header className="hero hero--compact">
        <p className="eyebrow">Analysis Workspace</p>
        <h1>Compare Sessions</h1>
        <p className="hero-subtitle">Compare top-10 interval profiles for two sessions using current leaderboard snapshots.</p>
      </header>

      <section className="panel controls-panel">
        <div className="panel-head">
          <h2>Session Selectors</h2>
        </div>
        <div className="filters-row">
          <label htmlFor="left-session">Left</label>
          <select id="left-session" value={leftSession ?? ""} onChange={(event) => setLeftSession(Number(event.target.value))}>
            {(sessionsQuery.data?.items ?? []).map((session) => (
              <option key={`left-${session.sessionKey}`} value={session.sessionKey}>
                {session.meetingName} • {session.sessionName}
              </option>
            ))}
          </select>

          <label htmlFor="right-session">Right</label>
          <select id="right-session" value={rightSession ?? ""} onChange={(event) => setRightSession(Number(event.target.value))}>
            {(sessionsQuery.data?.items ?? []).map((session) => (
              <option key={`right-${session.sessionKey}`} value={session.sessionKey}>
                {session.meetingName} • {session.sessionName}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Top 10 Gap Comparison</h2>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="driver" stroke="rgba(255,255,255,0.7)" />
              <YAxis stroke="rgba(255,255,255,0.7)" />
              <Tooltip />
              <Legend />
              <Bar dataKey="leftGap" name={leftName} fill="#45aaf2" radius={[4, 4, 0, 0]} />
              <Bar dataKey="rightGap" name={rightName} fill="#ff6b6b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}

export default function ComparePage() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ComparePageContent />
    </QueryClientProvider>
  );
}
