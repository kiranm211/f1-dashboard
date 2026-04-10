import type { FastifyPluginAsync } from "fastify";

import { and, desc, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";

import { buildCacheKey, getCachedJson, setCachedJson } from "../cache.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { meetings, sessions } from "../db/schema.js";
import type { ApiMeta } from "../types.js";

const querySchema = z.object({
  year: z.coerce.number().int().optional(),
  state: z.enum(["scheduled", "warmup", "live", "cooldown", "closed"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export const sessionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/sessions", async (request) => {
    const query = querySchema.parse(request.query);
    const cacheKey = buildCacheKey("sessions", query);
    const cached = await getCachedJson<{ items: unknown[]; meta: ApiMeta }>(cacheKey);
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

    const filters = [];

    if (query.year) {
      const startOfYear = new Date(Date.UTC(query.year, 0, 1));
      const startOfNextYear = new Date(Date.UTC(query.year + 1, 0, 1));
      filters.push(gte(sessions.dateStart, startOfYear));
      filters.push(lt(sessions.dateStart, startOfNextYear));
    }

    if (query.state) {
      filters.push(eq(sessions.currentState, query.state));
    }

    const items = await db
      .select({
        sessionKey: sessions.sessionKey,
        sessionName: sessions.sessionName,
        sessionType: sessions.sessionType,
        currentState: sessions.currentState,
        dateStart: sessions.dateStart,
        dateEnd: sessions.dateEnd,
        countryName: sessions.countryName,
        location: sessions.location,
        circuitShortName: sessions.circuitShortName,
        updatedAt: sessions.updatedAt,
        meetingKey: meetings.meetingKey,
        meetingName: meetings.meetingName
      })
      .from(sessions)
      .innerJoin(meetings, eq(meetings.meetingKey, sessions.meetingKey))
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(sessions.dateStart))
      .limit(query.limit);

    const lastSyncAt = items.length > 0 ? new Date(Math.max(...items.map((item) => item.updatedAt.getTime()))) : null;
    const generatedAt = new Date();
    const stalenessMs = lastSyncAt ? Math.max(generatedAt.getTime() - lastSyncAt.getTime(), 0) : null;

    const response = {
      items,
      meta: {
        cache: {
          hit: false,
          key: cacheKey,
          ttlSeconds: config.CACHE_TTL_SESSIONS_SECONDS
        },
        freshness: {
          generatedAt: generatedAt.toISOString(),
          lastSyncAt: lastSyncAt?.toISOString() ?? null,
          stalenessMs
        }
      }
    };

    await setCachedJson(cacheKey, config.CACHE_TTL_SESSIONS_SECONDS, response);

    return response;
  });
};
