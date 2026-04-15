import type { FastifyPluginAsync } from "fastify";

import { sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db/client.js";

type SessionConfigRow = {
  sessionKey: number;
  meetingName: string;
  sessionName: string;
  sessionType: string;
  currentState: "scheduled" | "warmup" | "live" | "cooldown" | "closed";
  dateStart: unknown;
  dateEnd: unknown;
  warmupStartsAt: unknown;
  liveStartsAt: unknown;
  cooldownStartsAt: unknown;
  closedAt: unknown;
  paused: boolean;
  enabledEndpoints: unknown;
  cadenceOverrides: unknown;
  updatedAt: unknown;
  bootstrapCompleted: boolean | null;
  bootstrapCompletedAt: unknown;
};

type AllSessionRow = {
  sessionKey: number;
  meetingName: string;
  sessionName: string;
  sessionType: string;
  currentState: "scheduled" | "warmup" | "live" | "cooldown" | "closed";
  dateStart: unknown;
  dateEnd: unknown;
  tracked: boolean;
  paused: boolean | null;
  bootstrapCompleted: boolean | null;
};

type ManualSyncRow = {
  sessionKey: number;
  totalJobs: number;
  runningJobs: number;
  failedJobs: number;
  pendingJobs: number;
  earliestNextRunAt: unknown;
};

type BootstrapSyncRow = {
  sessionKey: number;
  endpoint: string;
  syncedAt: unknown;
};

type JobRow = {
  jobId: number;
  jobName: string;
  endpoint: string;
  sessionKey: number | null;
  cadenceSeconds: number;
  nextRunAt: unknown;
  enabled: boolean;
  status: "pending" | "running" | "succeeded" | "failed" | "paused";
  lastStartedAt: unknown;
  lastFinishedAt: unknown;
  lastError: string | null;
  updatedAt: unknown;
};

type JobRunRow = {
  runId: number;
  jobId: number;
  jobName: string;
  endpoint: string;
  sessionKey: number | null;
  startedAt: unknown;
  finishedAt: unknown;
  status: "pending" | "running" | "succeeded" | "failed" | "paused";
  rowsWritten: number;
  errorMessage: string | null;
  batchId: number | null;
};

type WatermarkRow = {
  endpoint: string;
  sessionKey: number;
  watermark: unknown;
  lastBatchId: number | null;
  updatedAt: unknown;
};

type BatchRow = {
  batchId: number;
  endpoint: string;
  sessionKey: number | null;
  requestedAt: unknown;
  completedAt: unknown;
  status: string;
  itemCount: number;
  errorMessage: string | null;
};

type BatchStatusStatsRow = {
  status: string;
  batches: number;
  rowsIngested: number | null;
  lastCompletedAt: unknown;
};

const syncOverviewQuerySchema = z.object({
  runStatus: z.enum(["all", "failed", "succeeded", "running", "pending", "paused"]).default("all")
});

const retriggerParamsSchema = z.object({
  runId: z.coerce.number().int().positive()
});

const triggerSessionParamsSchema = z.object({
  sessionKey: z.coerce.number().int().positive()
});

function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toMillisOrNull(value: unknown): number | null {
  const iso = toIsoOrNull(value);
  return iso ? new Date(iso).getTime() : null;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function parseTextArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((value): value is string => typeof value === "string");
}

function parseCadenceOverrides(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      result[key] = Math.floor(value);
    }
  }
  return result;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function bootstrapFallbackEndpoints(sessionType: string): string[] {
  const base = ["drivers", "weather", "race_control", "laps", "pit", "stints", "session_result", "car_data", "location", "team_radio", "starting_grid"];
  if (sessionType.toLowerCase() === "race") {
    return [...base, "position", "intervals", "overtakes", "championship_drivers", "championship_teams"];
  }
  return base;
}

export const adminSyncRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/admin/sync", async (request) => {
    const query = syncOverviewQuerySchema.parse(request.query);
    const now = new Date();

    const [configResult, allSessionsResult, manualSyncResult, bootstrapSyncResult, jobsResult, recentRunsResult, watermarkResult, recentBatchesResult, batchStatsResult] = await Promise.all([
      db.execute<SessionConfigRow>(sql`
        select
          c.session_key as "sessionKey",
          m.meeting_name as "meetingName",
          s.session_name as "sessionName",
          s.session_type as "sessionType",
          c.current_state as "currentState",
          s.date_start as "dateStart",
          s.date_end as "dateEnd",
          c.warmup_starts_at as "warmupStartsAt",
          c.live_starts_at as "liveStartsAt",
          c.cooldown_starts_at as "cooldownStartsAt",
          c.closed_at as "closedAt",
          c.paused,
          c.enabled_endpoints as "enabledEndpoints",
          c.cadence_overrides as "cadenceOverrides",
          c.updated_at as "updatedAt",
          bs.completed as "bootstrapCompleted",
          bs.completed_at as "bootstrapCompletedAt"
        from session_sync_config c
        inner join sessions s on s.session_key = c.session_key
        inner join meetings m on m.meeting_key = s.meeting_key
        left join session_bootstrap_status bs on bs.session_key = c.session_key
        order by s.date_start desc
      `),
      db.execute<AllSessionRow>(sql`
        select
          s.session_key as "sessionKey",
          m.meeting_name as "meetingName",
          s.session_name as "sessionName",
          s.session_type as "sessionType",
          s.current_state as "currentState",
          s.date_start as "dateStart",
          s.date_end as "dateEnd",
          (c.session_key is not null) as tracked,
          c.paused,
          bs.completed as "bootstrapCompleted"
        from sessions s
        inner join meetings m on m.meeting_key = s.meeting_key
        left join session_sync_config c on c.session_key = s.session_key
        left join session_bootstrap_status bs on bs.session_key = s.session_key
        order by s.date_start desc
        limit 500
      `),
      db.execute<ManualSyncRow>(sql`
        select
          session_key as "sessionKey",
          count(*)::int as "totalJobs",
          count(*) filter (where status = 'running')::int as "runningJobs",
          count(*) filter (where status = 'failed')::int as "failedJobs",
          count(*) filter (where status = 'pending')::int as "pendingJobs",
          min(next_run_at) as "earliestNextRunAt"
        from sync_jobs
        where enabled = true
          and session_key is not null
          and job_name like 'manual:%'
        group by session_key
      `),
      db.execute<BootstrapSyncRow>(sql`
        select
          session_key as "sessionKey",
          endpoint,
          synced_at as "syncedAt"
        from session_bootstrap_syncs
      `),
      db.execute<JobRow>(sql`
        select
          job_id as "jobId",
          job_name as "jobName",
          endpoint,
          session_key as "sessionKey",
          cadence_seconds as "cadenceSeconds",
          next_run_at as "nextRunAt",
          enabled,
          status,
          last_started_at as "lastStartedAt",
          last_finished_at as "lastFinishedAt",
          last_error as "lastError",
          updated_at as "updatedAt"
        from sync_jobs
        order by enabled desc, next_run_at asc
        limit 500
      `),
      db.execute<JobRunRow>(sql`
        select
          r.run_id as "runId",
          r.job_id as "jobId",
          j.job_name as "jobName",
          j.endpoint,
          j.session_key as "sessionKey",
          r.started_at as "startedAt",
          r.finished_at as "finishedAt",
          r.status,
          r.rows_written as "rowsWritten",
          r.error_message as "errorMessage",
          r.batch_id as "batchId"
        from sync_job_runs r
        inner join sync_jobs j on j.job_id = r.job_id
        order by r.started_at desc
        limit 80
      `),
      db.execute<WatermarkRow>(sql`
        select
          endpoint,
          session_key as "sessionKey",
          watermark,
          last_batch_id as "lastBatchId",
          updated_at as "updatedAt"
        from sync_watermarks
        order by updated_at desc
        limit 500
      `),
      db.execute<BatchRow>(sql`
        select
          batch_id as "batchId",
          endpoint,
          session_key as "sessionKey",
          requested_at as "requestedAt",
          completed_at as "completedAt",
          status,
          item_count as "itemCount",
          error_message as "errorMessage"
        from raw_ingestion_batches
        order by requested_at desc
        limit 50
      `),
      db.execute<BatchStatusStatsRow>(sql`
        select
          status,
          count(*)::int as batches,
          sum(item_count)::int as "rowsIngested",
          max(completed_at) as "lastCompletedAt"
        from raw_ingestion_batches
        where requested_at >= now() - interval '24 hours'
        group by status
      `)
    ]);

    const sessions = configResult.rows.map((row: SessionConfigRow) => ({
      sessionKey: row.sessionKey,
      meetingName: row.meetingName,
      sessionName: row.sessionName,
      sessionType: row.sessionType,
      currentState: row.currentState,
      dateStart: toIsoOrNull(row.dateStart) ?? now.toISOString(),
      dateEnd: toIsoOrNull(row.dateEnd) ?? now.toISOString(),
      windows: {
        warmupStartsAt: toIsoOrNull(row.warmupStartsAt) ?? now.toISOString(),
        liveStartsAt: toIsoOrNull(row.liveStartsAt) ?? now.toISOString(),
        cooldownStartsAt: toIsoOrNull(row.cooldownStartsAt) ?? now.toISOString(),
        closedAt: toIsoOrNull(row.closedAt) ?? now.toISOString()
      },
      paused: row.paused,
      enabledEndpoints: unique(parseTextArray(row.enabledEndpoints)),
      cadenceOverrides: parseCadenceOverrides(row.cadenceOverrides),
      bootstrapCompleted: Boolean(row.bootstrapCompleted),
      bootstrapCompletedAt: toIsoOrNull(row.bootstrapCompletedAt),
      updatedAt: toIsoOrNull(row.updatedAt) ?? now.toISOString()
    }));

    const manualSyncBySession = new Map<number, {
      totalJobs: number;
      runningJobs: number;
      failedJobs: number;
      pendingJobs: number;
      earliestNextRunAt: string | null;
    }>();

    for (const row of manualSyncResult.rows) {
      manualSyncBySession.set(row.sessionKey, {
        totalJobs: toNumber(row.totalJobs),
        runningJobs: toNumber(row.runningJobs),
        failedJobs: toNumber(row.failedJobs),
        pendingJobs: toNumber(row.pendingJobs),
        earliestNextRunAt: toIsoOrNull(row.earliestNextRunAt)
      });
    }

    const allSessions = allSessionsResult.rows.map((row: AllSessionRow) => ({
      sessionKey: row.sessionKey,
      meetingName: row.meetingName,
      sessionName: row.sessionName,
      sessionType: row.sessionType,
      currentState: row.currentState,
      dateStart: toIsoOrNull(row.dateStart) ?? now.toISOString(),
      dateEnd: toIsoOrNull(row.dateEnd) ?? now.toISOString(),
      tracked: row.tracked,
      paused: Boolean(row.paused),
      bootstrapCompleted: Boolean(row.bootstrapCompleted),
      manualSync: manualSyncBySession.get(row.sessionKey) ?? null
    }));

    const syncsBySession = new Map<number, Set<string>>();
    for (const row of bootstrapSyncResult.rows) {
      const endpoints = syncsBySession.get(row.sessionKey) ?? new Set<string>();
      endpoints.add(row.endpoint);
      syncsBySession.set(row.sessionKey, endpoints);
    }

    const bootstrapRequiredBySession = new Map<number, Set<string>>();
    for (const job of jobsResult.rows) {
      if (!job.jobName.startsWith("bootstrap:") || job.sessionKey === null) {
        continue;
      }
      const endpoints = bootstrapRequiredBySession.get(job.sessionKey) ?? new Set<string>();
      endpoints.add(job.endpoint);
      bootstrapRequiredBySession.set(job.sessionKey, endpoints);
    }

    const remainingSyncs = sessions.map((session: (typeof sessions)[number]) => {
      const required = bootstrapRequiredBySession.get(session.sessionKey);
      const requiredEndpoints = required ? Array.from(required) : bootstrapFallbackEndpoints(session.sessionType);
      const syncedEndpoints = Array.from(syncsBySession.get(session.sessionKey) ?? new Set<string>());
      const syncedSet = new Set(syncedEndpoints);
      const remainingEndpoints = requiredEndpoints.filter((endpoint) => !syncedSet.has(endpoint));

      return {
        sessionKey: session.sessionKey,
        meetingName: session.meetingName,
        sessionName: session.sessionName,
        sessionType: session.sessionType,
        bootstrapCompleted: session.bootstrapCompleted,
        requiredCount: requiredEndpoints.length,
        syncedCount: syncedEndpoints.length,
        remainingCount: remainingEndpoints.length,
        requiredEndpoints,
        syncedEndpoints,
        remainingEndpoints
      };
    });

    const dueThreshold = now.getTime() + 15_000;
    const jobs = jobsResult.rows.map((job: JobRow) => ({
      jobId: job.jobId,
      jobName: job.jobName,
      endpoint: job.endpoint,
      sessionKey: job.sessionKey,
      cadenceSeconds: job.cadenceSeconds,
      nextRunAt: toIsoOrNull(job.nextRunAt) ?? now.toISOString(),
      enabled: job.enabled,
      status: job.status,
      lastStartedAt: toIsoOrNull(job.lastStartedAt),
      lastFinishedAt: toIsoOrNull(job.lastFinishedAt),
      lastError: job.lastError,
      updatedAt: toIsoOrNull(job.updatedAt) ?? now.toISOString()
    }));

    const jobsSummary = {
      total: jobs.length,
      enabled: jobs.filter((job: (typeof jobs)[number]) => job.enabled).length,
      running: jobs.filter((job: (typeof jobs)[number]) => job.status === "running").length,
      failed: jobs.filter((job: (typeof jobs)[number]) => job.status === "failed").length,
      dueNow: jobs.filter((job: (typeof jobs)[number]) => job.enabled && new Date(job.nextRunAt).getTime() <= now.getTime()).length,
      dueSoon: jobs.filter((job: (typeof jobs)[number]) => job.enabled && new Date(job.nextRunAt).getTime() > now.getTime() && new Date(job.nextRunAt).getTime() <= dueThreshold).length
    };

    const liveSessions = sessions.filter((session: (typeof sessions)[number]) => session.currentState === "live");
    const liveSessionKeys = new Set(liveSessions.map((session: (typeof liveSessions)[number]) => session.sessionKey));

    const liveSyncStatus = liveSessions.map((session: (typeof liveSessions)[number]) => {
      const sessionJobs = jobs.filter((job: (typeof jobs)[number]) => job.sessionKey === session.sessionKey && job.enabled && !job.jobName.startsWith("bootstrap:"));
      const nextRunAt =
        sessionJobs.length > 0
          ? sessionJobs.reduce(
              (earliest: (typeof sessionJobs)[number], job: (typeof sessionJobs)[number]) =>
                new Date(job.nextRunAt).getTime() < new Date(earliest.nextRunAt).getTime() ? job : earliest,
              sessionJobs[0]
            ).nextRunAt
          : null;
      const lastFinishedAt = sessionJobs
        .map((job: (typeof sessionJobs)[number]) => job.lastFinishedAt)
        .filter((value: string | null): value is string => value !== null)
        .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

      return {
        sessionKey: session.sessionKey,
        meetingName: session.meetingName,
        sessionName: session.sessionName,
        enabledEndpoints: session.enabledEndpoints,
        runningJobs: sessionJobs.filter((job: (typeof sessionJobs)[number]) => job.status === "running").length,
        failedJobs: sessionJobs.filter((job: (typeof sessionJobs)[number]) => job.status === "failed").length,
        nextRunAt,
        lastFinishedAt
      };
    });

    const syncPlan = sessions.map((session: (typeof sessions)[number]) => {
      const sessionJobs = jobs.filter((job: (typeof jobs)[number]) => job.sessionKey === session.sessionKey && !job.jobName.startsWith("bootstrap:"));
      const endpointCadence = session.enabledEndpoints
        .map((endpoint: string) => {
          const matching = sessionJobs.find((job: (typeof sessionJobs)[number]) => job.endpoint === endpoint && job.enabled);
          return {
            endpoint,
            cadenceSeconds: matching?.cadenceSeconds ?? session.cadenceOverrides[endpoint] ?? null,
            nextRunAt: matching?.nextRunAt ?? null,
            status: matching?.status ?? "pending"
          };
        })
        .sort((a: { endpoint: string }, b: { endpoint: string }) => a.endpoint.localeCompare(b.endpoint));

      return {
        sessionKey: session.sessionKey,
        meetingName: session.meetingName,
        sessionName: session.sessionName,
        currentState: session.currentState,
        paused: session.paused,
        endpointCadence
      };
    });

    const recentRuns = recentRunsResult.rows
      .map((run: JobRunRow) => ({
      runId: run.runId,
      jobId: run.jobId,
      jobName: run.jobName,
      endpoint: run.endpoint,
      sessionKey: run.sessionKey,
      startedAt: toIsoOrNull(run.startedAt) ?? now.toISOString(),
      finishedAt: toIsoOrNull(run.finishedAt),
      status: run.status,
      rowsWritten: toNumber(run.rowsWritten),
      errorMessage: run.errorMessage,
      batchId: run.batchId
      }))
      .filter((run: (typeof recentRunsResult.rows)[number]) => (query.runStatus === "all" ? true : run.status === query.runStatus));

    const watermarks = watermarkResult.rows.map((row: WatermarkRow) => ({
      endpoint: row.endpoint,
      sessionKey: row.sessionKey,
      watermark: toIsoOrNull(row.watermark),
      lastBatchId: row.lastBatchId,
      updatedAt: toIsoOrNull(row.updatedAt) ?? now.toISOString(),
      lagMs: toMillisOrNull(row.watermark) ? Math.max(now.getTime() - (toMillisOrNull(row.watermark) as number), 0) : null
    }));

    const liveWatermarks = watermarks.filter((row: (typeof watermarks)[number]) => liveSessionKeys.has(row.sessionKey));

    const recentBatches = recentBatchesResult.rows.map((batch: BatchRow) => ({
      batchId: batch.batchId,
      endpoint: batch.endpoint,
      sessionKey: batch.sessionKey,
      requestedAt: toIsoOrNull(batch.requestedAt) ?? now.toISOString(),
      completedAt: toIsoOrNull(batch.completedAt),
      status: batch.status,
      itemCount: toNumber(batch.itemCount),
      errorMessage: batch.errorMessage
    }));

    const ingestion24h = {
      byStatus: batchStatsResult.rows.map((row: BatchStatusStatsRow) => ({
        status: row.status,
        batches: toNumber(row.batches),
        rowsIngested: toNumber(row.rowsIngested),
        lastCompletedAt: toIsoOrNull(row.lastCompletedAt)
      })),
      totalBatches: batchStatsResult.rows.reduce((sum: number, row: BatchStatusStatsRow) => sum + toNumber(row.batches), 0),
      totalRowsIngested: batchStatsResult.rows.reduce((sum: number, row: BatchStatusStatsRow) => sum + toNumber(row.rowsIngested), 0)
    };

    const lastSyncAtCandidates = [
      ...recentRuns.filter((run: (typeof recentRuns)[number]) => run.finishedAt !== null).map((run: (typeof recentRuns)[number]) => new Date(run.finishedAt as string).getTime()),
      ...recentBatches
        .filter((batch: (typeof recentBatches)[number]) => batch.completedAt !== null)
        .map((batch: (typeof recentBatches)[number]) => new Date(batch.completedAt as string).getTime()),
      ...watermarks
        .filter((row: (typeof watermarks)[number]) => row.watermark !== null)
        .map((row: (typeof watermarks)[number]) => new Date(row.watermark as string).getTime())
    ];

    const lastSyncAtMs = lastSyncAtCandidates.length > 0 ? Math.max(...lastSyncAtCandidates) : null;

    return {
      summary: {
        trackedSessions: sessions.length,
        liveSessions: liveSessions.length,
        pausedSessions: sessions.filter((session: (typeof sessions)[number]) => session.paused).length,
        pendingBootstrapSessions: remainingSyncs.filter((item: (typeof remainingSyncs)[number]) => item.remainingCount > 0 && !item.bootstrapCompleted).length,
        remainingBootstrapEndpoints: remainingSyncs.reduce((sum: number, item: (typeof remainingSyncs)[number]) => sum + item.remainingCount, 0),
        jobs: jobsSummary,
        ingestion24h
      },
      allSessions,
      sessions,
      liveSyncStatus,
      remainingSyncs,
      syncPlan,
      jobs,
      recentRuns,
      watermarks,
      liveWatermarks,
      recentBatches,
      meta: {
        freshness: {
          generatedAt: now.toISOString(),
          lastSyncAt: lastSyncAtMs ? new Date(lastSyncAtMs).toISOString() : null,
          stalenessMs: lastSyncAtMs ? Math.max(now.getTime() - lastSyncAtMs, 0) : null
        }
      }
    };
  });

  app.post("/v1/admin/sync/sessions/:sessionKey/trigger", async (request, reply) => {
    const params = triggerSessionParamsSchema.parse(request.params);
    const now = new Date();

    const sessionResult = await db.execute<{
      sessionKey: number;
      sessionType: string;
      meetingName: string;
      sessionName: string;
    }>(sql`
      select
        s.session_key as "sessionKey",
        s.session_type as "sessionType",
        m.meeting_name as "meetingName",
        s.session_name as "sessionName"
      from sessions s
      inner join meetings m on m.meeting_key = s.meeting_key
      where s.session_key = ${params.sessionKey}
      limit 1
    `);

    const selectedSession = sessionResult.rows[0];
    if (!selectedSession) {
      reply.code(404).send({ error: `Session ${params.sessionKey} was not found.` });
      return;
    }

    const endpoints = unique(bootstrapFallbackEndpoints(selectedSession.sessionType));

    await db.execute(sql`
      update sync_jobs
      set
        enabled = false,
        updated_at = ${now}
      where job_name like 'manual:%'
        and session_key <> ${params.sessionKey}
    `);

    await db.execute(sql`
      delete from sync_watermarks
      where session_key = ${params.sessionKey}
    `);

    await db.execute(sql`
      delete from session_bootstrap_syncs
      where session_key = ${params.sessionKey}
    `);

    await db.execute(sql`
      insert into session_bootstrap_status (session_key, completed, completed_at, updated_at)
      values (${params.sessionKey}, false, null, ${now})
      on conflict (session_key)
      do update
      set
        completed = false,
        completed_at = null,
        updated_at = ${now}
    `);

    for (const endpoint of endpoints) {
      await db.execute(sql`
        insert into sync_jobs (
          job_name,
          endpoint,
          session_key,
          cadence_seconds,
          next_run_at,
          enabled,
          status,
          last_error,
          created_at,
          updated_at
        )
        values (
          ${`manual:${endpoint}`},
          ${endpoint},
          ${params.sessionKey},
          86400,
          ${now},
          true,
          'pending',
          null,
          ${now},
          ${now}
        )
        on conflict (job_name, endpoint, session_key)
        do update
        set
          cadence_seconds = excluded.cadence_seconds,
          next_run_at = excluded.next_run_at,
          enabled = true,
          status = 'pending',
          last_error = null,
          updated_at = excluded.updated_at
      `);
    }

    reply.code(202).send({
      ok: true,
      sessionKey: params.sessionKey,
      meetingName: selectedSession.meetingName,
      sessionName: selectedSession.sessionName,
      endpointsQueued: endpoints,
      queuedAt: now.toISOString(),
      message: "Manual priority sync queued. This session will be processed before other due jobs until manual sync jobs complete."
    });
  });

  app.post("/v1/admin/sync/runs/:runId/retrigger", async (request, reply) => {
    const params = retriggerParamsSchema.parse(request.params);
    const now = new Date();

    const runResult = await db.execute<{ runId: number; jobId: number; status: string }>(sql`
      select
        run_id as "runId",
        job_id as "jobId",
        status
      from sync_job_runs
      where run_id = ${params.runId}
      limit 1
    `);

    const run = runResult.rows[0];
    if (!run) {
      reply.code(404).send({ error: `Run ${params.runId} was not found.` });
      return;
    }

    if (run.status !== "failed") {
      reply.code(400).send({ error: `Only failed runs can be retriggered. Run ${params.runId} is ${run.status}.` });
      return;
    }

    const updatedJobResult = await db.execute<{ jobId: number }>(sql`
      update sync_jobs
      set
        enabled = true,
        status = 'pending',
        next_run_at = ${now},
        last_error = null,
        updated_at = ${now}
      where job_id = ${run.jobId}
      returning job_id as "jobId"
    `);

    if (updatedJobResult.rows.length === 0) {
      reply.code(404).send({ error: `Job ${run.jobId} for run ${params.runId} was not found.` });
      return;
    }

    reply.code(202).send({
      ok: true,
      runId: params.runId,
      jobId: run.jobId,
      queuedAt: now.toISOString()
    });
  });
};
