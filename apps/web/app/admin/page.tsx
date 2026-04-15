"use client";

import { useMemo, useState } from "react";

import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { MetricCard } from "../../components/MetricCard";
import { fetchAdminSyncOverview, retriggerFailedRun, triggerSessionPrioritySync, type AdminRunStatusFilter } from "../../lib/api";

function formatDate(value: string | null): string {
  if (!value) {
    return "n/a";
  }
  return new Date(value).toLocaleString();
}

function formatDuration(ms: number | null): string {
  if (ms === null) {
    return "n/a";
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function statusTone(status: string): string {
  if (status === "running" || status === "succeeded") {
    return "good";
  }
  if (status === "failed") {
    return "bad";
  }
  if (status === "pending") {
    return "warn";
  }
  return "neutral";
}

function AdminPageContent() {
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [runStatusFilter, setRunStatusFilter] = useState<AdminRunStatusFilter>("all");
  const queryClient = useQueryClient();

  const overviewQuery = useQuery({
    queryKey: ["admin-sync-overview", runStatusFilter],
    queryFn: () => fetchAdminSyncOverview(runStatusFilter),
    refetchInterval: 5000
  });

  const retriggerMutation = useMutation({
    mutationFn: retriggerFailedRun,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-sync-overview"] });
    }
  });

  const triggerSessionSyncMutation = useMutation({
    mutationFn: triggerSessionPrioritySync,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-sync-overview"] });
    }
  });

  const data = overviewQuery.data;

  const effectiveSession = useMemo(() => {
    if (!data) {
      return null;
    }
    return selectedSession ?? data.allSessions[0]?.sessionKey ?? null;
  }, [data, selectedSession]);

  const selectedSessionItem = useMemo(() => {
    if (!data || effectiveSession === null) {
      return null;
    }
    return data.allSessions.find((item) => item.sessionKey === effectiveSession) ?? null;
  }, [data, effectiveSession]);

  const selectedPlan = useMemo(() => {
    if (!data || effectiveSession === null) {
      return null;
    }
    return data.syncPlan.find((item) => item.sessionKey === effectiveSession) ?? null;
  }, [data, effectiveSession]);

  const selectedRemaining = useMemo(() => {
    if (!data || effectiveSession === null) {
      return null;
    }
    return data.remainingSyncs.find((item) => item.sessionKey === effectiveSession) ?? null;
  }, [data, effectiveSession]);

  const selectedWatermarks = useMemo(() => {
    if (!data || effectiveSession === null) {
      return [];
    }
    return data.watermarks.filter((item) => item.sessionKey === effectiveSession).sort((a, b) => (b.lagMs ?? -1) - (a.lagMs ?? -1));
  }, [data, effectiveSession]);

  return (
    <main className="page-shell">
      <header className="hero hero--compact">
        <p className="eyebrow">Admin Ops</p>
        <h1>Sync Orchestrator Console</h1>
        <p className="hero-subtitle">Live visibility into planner windows, bootstrap progress, job execution, and ingestion throughput. Auto-refreshes every 5 seconds.</p>
      </header>

      <section className="metrics-grid">
        <MetricCard label="Tracked Sessions" value={data ? String(data.summary.trackedSessions) : "--"} accent="#45aaf2" />
        <MetricCard label="Live Sessions" value={data ? String(data.summary.liveSessions) : "--"} accent="#20bf6b" />
        <MetricCard label="Running Jobs" value={data ? String(data.summary.jobs.running) : "--"} accent="#f7b731" />
        <MetricCard label="Failed Jobs" value={data ? String(data.summary.jobs.failed) : "--"} accent="#ff6b6b" />
      </section>

      <section className="metrics-grid admin-metrics-grid">
        <MetricCard label="Due Now" value={data ? String(data.summary.jobs.dueNow) : "--"} accent="#9b59b6" />
        <MetricCard label="Pending Bootstrap Sessions" value={data ? String(data.summary.pendingBootstrapSessions) : "--"} accent="#eb3b5a" />
        <MetricCard label="Remaining Bootstrap Endpoints" value={data ? String(data.summary.remainingBootstrapEndpoints) : "--"} accent="#2d98da" />
        <MetricCard label="Freshness" value={formatDuration(data?.meta.freshness.stalenessMs ?? null)} accent="#26de81" />
      </section>

      {overviewQuery.isLoading ? (
        <section className="panel">
          <p className="empty-copy">Loading admin sync data...</p>
        </section>
      ) : null}

      {overviewQuery.isError ? (
        <section className="panel">
          <p className="empty-copy">Failed to load /v1/admin/sync. Check API logs and ensure the API process restarted after recent changes.</p>
        </section>
      ) : null}

      <section className="dashboard-grid admin-layout-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>All Sessions</h2>
            <span className="api-link">/v1/admin/sync</span>
          </div>
          <div className="session-list admin-session-list">
            {(data?.allSessions ?? []).map((session) => (
              <button
                key={session.sessionKey}
                className={`session-item ${effectiveSession === session.sessionKey ? "active" : ""}`}
                onClick={() => setSelectedSession(session.sessionKey)}
              >
                <span>{session.meetingName}</span>
                <small>
                  {session.sessionName} • {session.currentState.toUpperCase()} • {session.sessionType}
                </small>
                <small>
                  {session.tracked ? "Tracked" : "Untracked"} • Bootstrap {session.bootstrapCompleted ? "Completed" : "In Progress"}
                </small>
                {session.manualSync ? (
                  <small>
                    Manual Sync: Running {session.manualSync.runningJobs} • Pending {session.manualSync.pendingJobs} • Failed {session.manualSync.failedJobs}
                  </small>
                ) : null}
              </button>
            ))}
          </div>
        </article>

        <article className="panel panel--wide">
          <div className="panel-head">
            <h2>Selected Session Plan</h2>
            {selectedPlan ? <span className="api-link">Session #{selectedPlan.sessionKey}</span> : null}
          </div>
          {selectedPlan ? (
            <>
              <div className="details-grid">
                <div>
                  <strong>Session</strong>
                  <p>
                    {selectedPlan.meetingName} • {selectedPlan.sessionName}
                  </p>
                </div>
                <div>
                  <strong>State</strong>
                  <p>{selectedPlan.currentState}</p>
                </div>
                <div>
                  <strong>Paused</strong>
                  <p>{selectedPlan.paused ? "Yes" : "No"}</p>
                </div>
              </div>

              <div className="table-wrap">
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Endpoint</th>
                      <th>Cadence</th>
                      <th>Next Run</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPlan.endpointCadence.map((item) => (
                      <tr key={item.endpoint}>
                        <td>{item.endpoint}</td>
                        <td>{item.cadenceSeconds === null ? "n/a" : `${item.cadenceSeconds}s`}</td>
                        <td>{formatDate(item.nextRunAt)}</td>
                        <td>
                          <span className={`status-pill status-pill--${statusTone(item.status)}`}>{item.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="empty-copy">No active tracked sync plan for this session yet. You can still trigger a full manual priority sync.</p>
          )}

          <div className="details-grid" style={{ marginTop: 16 }}>
            <div>
              <strong>Manual Priority Sync</strong>
              <p>
                {selectedSessionItem ? `${selectedSessionItem.meetingName} • ${selectedSessionItem.sessionName}` : "No session selected"}
              </p>
            </div>
            <div>
              <strong>Manual Status</strong>
              <p>
                {selectedSessionItem?.manualSync
                  ? `Running ${selectedSessionItem.manualSync.runningJobs} • Pending ${selectedSessionItem.manualSync.pendingJobs} • Failed ${selectedSessionItem.manualSync.failedJobs}`
                  : "Idle"}
              </p>
            </div>
            <div>
              <strong>Action</strong>
              <p>
                <button
                  type="button"
                  className="site-header__link replay-button"
                  disabled={effectiveSession === null || triggerSessionSyncMutation.isPending}
                  onClick={() => {
                    if (effectiveSession !== null) {
                      triggerSessionSyncMutation.mutate(effectiveSession);
                    }
                  }}
                >
                  {triggerSessionSyncMutation.isPending ? "Queueing..." : "Sync Selected Session (Priority)"}
                </button>
              </p>
            </div>
          </div>
          {triggerSessionSyncMutation.isError ? <p className="empty-copy">Failed to queue manual priority sync. Check API logs.</p> : null}
          {triggerSessionSyncMutation.isSuccess ? <p className="empty-copy">Manual priority sync queued for selected session.</p> : null}
        </article>
      </section>

      <section className="dashboard-grid admin-layout-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Remaining Bootstrap Syncs</h2>
          </div>
          {selectedRemaining ? (
            <div className="admin-chip-list-wrap">
              <p className="empty-copy">
                Synced {selectedRemaining.syncedCount}/{selectedRemaining.requiredCount} • Remaining {selectedRemaining.remainingCount}
              </p>
              <div className="admin-chip-list">
                {selectedRemaining.remainingEndpoints.length > 0 ? (
                  selectedRemaining.remainingEndpoints.map((endpoint) => (
                    <span key={endpoint} className="admin-chip admin-chip--warn">
                      {endpoint}
                    </span>
                  ))
                ) : (
                  <span className="admin-chip admin-chip--good">No remaining endpoints</span>
                )}
              </div>
            </div>
          ) : (
            <p className="empty-copy">No bootstrap progress available.</p>
          )}
        </article>

        <article className="panel panel--wide">
          <div className="panel-head">
            <h2>Watermark Lag (Selected Session)</h2>
          </div>
          <div className="table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Watermark</th>
                  <th>Lag</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {selectedWatermarks.length > 0 ? (
                  selectedWatermarks.map((item) => (
                    <tr key={`${item.sessionKey}:${item.endpoint}`}>
                      <td>{item.endpoint}</td>
                      <td>{formatDate(item.watermark)}</td>
                      <td>{formatDuration(item.lagMs)}</td>
                      <td>{formatDate(item.updatedAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>No watermark records for selected session.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="dashboard-grid admin-layout-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Live Sync Sessions</h2>
          </div>
          <div className="admin-stack-list">
            {(data?.liveSyncStatus ?? []).map((item) => (
              <div key={item.sessionKey} className="admin-stack-item">
                <strong>
                  {item.meetingName} • {item.sessionName}
                </strong>
                <small>
                  Running {item.runningJobs} • Failed {item.failedJobs}
                </small>
                <small>Next Run {formatDate(item.nextRunAt)} • Last Finish {formatDate(item.lastFinishedAt)}</small>
              </div>
            ))}
            {(data?.liveSyncStatus ?? []).length === 0 ? <p className="empty-copy">No live sessions currently.</p> : null}
          </div>
        </article>

        <article className="panel panel--wide">
          <div className="panel-head">
            <h2>Recent Job Runs</h2>
            <div className="filters-row">
              <label htmlFor="run-status-filter">Filter</label>
              <select
                id="run-status-filter"
                value={runStatusFilter}
                onChange={(event) => setRunStatusFilter(event.target.value as AdminRunStatusFilter)}
              >
                <option value="all">All</option>
                <option value="failed">Failed</option>
                <option value="running">Running</option>
                <option value="pending">Pending</option>
                <option value="succeeded">Succeeded</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Job</th>
                  <th>Session</th>
                  <th>Status</th>
                  <th>Rows</th>
                  <th>Error</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentRuns ?? []).slice(0, 25).map((run) => (
                  <tr key={run.runId}>
                    <td>{formatDate(run.startedAt)}</td>
                    <td>{run.jobName}</td>
                    <td>{run.sessionKey ?? "global"}</td>
                    <td>
                      <span className={`status-pill status-pill--${statusTone(run.status)}`}>{run.status}</span>
                    </td>
                    <td>{run.rowsWritten}</td>
                    <td>{run.errorMessage ?? "-"}</td>
                    <td>
                      {run.status === "failed" ? (
                        <button
                          type="button"
                          className="site-header__link replay-button"
                          disabled={retriggerMutation.isPending}
                          onClick={() => retriggerMutation.mutate(run.runId)}
                        >
                          Retrigger
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {retriggerMutation.isError ? <p className="empty-copy">Failed to retrigger run. Check API logs.</p> : null}
          {retriggerMutation.isSuccess ? <p className="empty-copy">Failed run retriggered and queued for execution.</p> : null}
        </article>
      </section>

      <section className="dashboard-grid admin-layout-grid">
        <article className="panel panel--wide">
          <div className="panel-head">
            <h2>Due And Running Jobs</h2>
          </div>
          <div className="table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Session</th>
                  <th>Enabled</th>
                  <th>Status</th>
                  <th>Next Run</th>
                  <th>Cadence</th>
                </tr>
              </thead>
              <tbody>
                {(data?.jobs ?? [])
                  .filter((job) => job.status === "running" || new Date(job.nextRunAt).getTime() <= Date.now() + 60_000)
                  .slice(0, 40)
                  .map((job) => (
                    <tr key={job.jobId}>
                      <td>{job.jobName}</td>
                      <td>{job.sessionKey ?? "global"}</td>
                      <td>{job.enabled ? "yes" : "no"}</td>
                      <td>
                        <span className={`status-pill status-pill--${statusTone(job.status)}`}>{job.status}</span>
                      </td>
                      <td>{formatDate(job.nextRunAt)}</td>
                      <td>{job.cadenceSeconds}s</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>Ingestion 24h</h2>
          </div>
          <div className="admin-stack-list">
            <div className="admin-stack-item">
              <strong>Total Batches</strong>
              <small>{data?.summary.ingestion24h.totalBatches ?? 0}</small>
            </div>
            <div className="admin-stack-item">
              <strong>Total Rows</strong>
              <small>{data?.summary.ingestion24h.totalRowsIngested ?? 0}</small>
            </div>
            {(data?.summary.ingestion24h.byStatus ?? []).map((item) => (
              <div key={item.status} className="admin-stack-item">
                <strong>{item.status}</strong>
                <small>
                  Batches {item.batches} • Rows {item.rowsIngested}
                </small>
                <small>Last Completed {formatDate(item.lastCompletedAt)}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Recent Raw Batches</h2>
        </div>
        <div className="table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Requested</th>
                <th>Endpoint</th>
                <th>Session</th>
                <th>Status</th>
                <th>Items</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentBatches ?? []).slice(0, 30).map((batch) => (
                <tr key={batch.batchId}>
                  <td>{formatDate(batch.requestedAt)}</td>
                  <td>{batch.endpoint}</td>
                  <td>{batch.sessionKey ?? "global"}</td>
                  <td>
                    <span className={`status-pill status-pill--${statusTone(batch.status === "succeeded" ? "succeeded" : batch.status === "failed" ? "failed" : "pending")}`}>
                      {batch.status}
                    </span>
                  </td>
                  <td>{batch.itemCount}</td>
                  <td>{batch.errorMessage ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default function AdminPage() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AdminPageContent />
    </QueryClientProvider>
  );
}
