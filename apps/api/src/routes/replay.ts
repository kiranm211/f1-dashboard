import type { FastifyPluginAsync } from "fastify";

import { sql } from "drizzle-orm";
import { z } from "zod";

import { buildCacheKey, getCachedJson, setCachedJson } from "../cache.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import type { ApiMeta } from "../types.js";

const querySchema = z.object({
  sessionKey: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(10).max(180).default(60)
});

type ReplayFrameItem = {
  driverNumber: number;
  position: number;
  fullName: string | null;
  nameAcronym: string | null;
  teamName: string | null;
  interval: number | null;
  gapToLeader: string | null;
};

type ReplayFrame = {
  timestamp: string;
  items: ReplayFrameItem[];
};

export const replayRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/replay", async (request, reply) => {
    const query = querySchema.parse(request.query);

    const sessionExists = await db.execute<{ sessionKey: number }>(sql`
      select session_key as "sessionKey"
      from sessions
      where session_key = ${query.sessionKey}
      limit 1
    `);
    if (sessionExists.rows.length === 0) {
      reply.code(404).send({ error: "Session not found", sessionKey: query.sessionKey });
      return;
    }

    const cacheKey = buildCacheKey("replay", query);
    const cached = await getCachedJson<{ sessionKey: number; frames: ReplayFrame[]; meta: ApiMeta }>(cacheKey);
    if (cached) {
      return {
        ...cached,
        meta: {
          ...cached.meta,
          cache: {
            ...cached.meta.cache,
            hit: true
          }
        }
      };
    }

    const timestampRows = await db.execute<{ timestamp: Date }>(sql`
      select snapshot_date as timestamp
      from (
        select distinct p.date as snapshot_date
        from position_snapshots p
        where p.session_key = ${query.sessionKey}
        order by p.date desc
        limit ${query.limit}
      ) timeline
      order by snapshot_date asc
    `);

    const timestamps = timestampRows.rows
      .map((row: (typeof timestampRows.rows)[number]) => row.timestamp)
      .filter((value: Date): value is Date => value instanceof Date);

    if (timestamps.length === 0) {
      const generatedAt = new Date();
      const emptyResponse = {
        sessionKey: query.sessionKey,
        frames: [],
        meta: {
          cache: {
            hit: false,
            key: cacheKey,
            ttlSeconds: config.CACHE_TTL_LEADERBOARD_SECONDS
          },
          freshness: {
            generatedAt: generatedAt.toISOString(),
            lastSyncAt: null,
            stalenessMs: null
          }
        }
      };

      await setCachedJson(cacheKey, config.CACHE_TTL_LEADERBOARD_SECONDS, emptyResponse);
      return emptyResponse;
    }

    const frameRows = await db.execute<{
      timestamp: Date;
      driverNumber: number;
      position: number;
      fullName: string | null;
      nameAcronym: string | null;
      teamName: string | null;
      interval: number | null;
      gapToLeader: string | null;
    }>(sql`
      select
        p.date as timestamp,
        p.driver_number as "driverNumber",
        p.position,
        d.full_name as "fullName",
        d.name_acronym as "nameAcronym",
        d.team_name as "teamName",
        i.interval,
        i.gap_to_leader as "gapToLeader"
      from position_snapshots p
      left join session_drivers d
        on d.session_key = p.session_key
       and d.driver_number = p.driver_number
      left join interval_snapshots i
        on i.session_key = p.session_key
       and i.driver_number = p.driver_number
       and i.date = p.date
      where p.session_key = ${query.sessionKey}
        and p.date in ${sql.raw(`(${timestamps.map((timestamp: Date) => `'${timestamp.toISOString()}'`).join(",")})`)}
      order by p.date asc, p.position asc
    `);

    const frameMap = new Map<string, ReplayFrame>();

    for (const timestamp of timestamps) {
      frameMap.set(timestamp.toISOString(), {
        timestamp: timestamp.toISOString(),
        items: []
      });
    }

    for (const row of frameRows.rows) {
      const key = row.timestamp.toISOString();
      const frame = frameMap.get(key);
      if (!frame) {
        continue;
      }
      if (frame.items.length >= 10) {
        continue;
      }
      frame.items.push({
        driverNumber: row.driverNumber,
        position: row.position,
        fullName: row.fullName,
        nameAcronym: row.nameAcronym,
        teamName: row.teamName,
        interval: row.interval,
        gapToLeader: row.gapToLeader
      });
    }

    const frames = Array.from(frameMap.values());
    const generatedAt = new Date();
    const latestSyncAt = timestamps[timestamps.length - 1] ?? null;
    const stalenessMs = latestSyncAt ? Math.max(generatedAt.getTime() - latestSyncAt.getTime(), 0) : null;

    const response = {
      sessionKey: query.sessionKey,
      frames,
      meta: {
        cache: {
          hit: false,
          key: cacheKey,
          ttlSeconds: config.CACHE_TTL_LEADERBOARD_SECONDS
        },
        freshness: {
          generatedAt: generatedAt.toISOString(),
          lastSyncAt: latestSyncAt?.toISOString() ?? null,
          stalenessMs
        }
      }
    };

    await setCachedJson(cacheKey, config.CACHE_TTL_LEADERBOARD_SECONDS, response);
    return response;
  });
};
