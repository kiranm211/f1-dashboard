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
  sessionType: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

const paramsSchema = z.object({
  sessionKey: z.coerce.number().int().positive()
});

const SESSION_WARMUP_MINUTES = 60;
const SESSION_COOLDOWN_MINUTES = 30;

type SessionState = z.infer<typeof querySchema>["state"];

function isRaceSessionType(sessionType: string): boolean {
  const normalized = sessionType.trim().toLowerCase();
  return normalized === "race" || normalized === "sprint race";
}

function matchesSessionTypeFilter(sessionType: string, sessionTypeFilter?: string): boolean {
  if (!sessionTypeFilter) {
    return true;
  }

  const normalizedFilter = sessionTypeFilter.trim().toLowerCase();
  const normalizedSessionType = sessionType.trim().toLowerCase();

  if (normalizedFilter === "race") {
    return isRaceSessionType(normalizedSessionType);
  }

  return normalizedSessionType === normalizedFilter;
}

function computeEffectiveState(now: Date, dateStart: Date, dateEnd: Date): NonNullable<SessionState> {
  const warmupStartsAt = new Date(dateStart.getTime() - SESSION_WARMUP_MINUTES * 60 * 1000);
  const closedAt = new Date(dateEnd.getTime() + SESSION_COOLDOWN_MINUTES * 60 * 1000);

  if (now < warmupStartsAt) {
    return "scheduled";
  }
  if (now >= warmupStartsAt && now < dateStart) {
    return "warmup";
  }
  if (now >= dateStart && now <= dateEnd) {
    return "live";
  }
  if (now > dateEnd && now <= closedAt) {
    return "cooldown";
  }
  return "closed";
}

export const sessionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/sessions/:sessionKey", async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid session key", details: parsedParams.error.flatten() });
      return;
    }

    const { sessionKey } = parsedParams.data;
    const cacheKey = buildCacheKey("session-detail", { sessionKey });
    const cached = await getCachedJson<{ item: unknown | null; meta: ApiMeta }>(cacheKey);
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

    const row = await db
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
      .where(eq(sessions.sessionKey, sessionKey))
      .limit(1);

    if (row.length === 0) {
      reply.code(404).send({ error: "Session not found", sessionKey });
      return;
    }

    const now = new Date();
    const item = {
      ...row[0],
      currentState: computeEffectiveState(now, row[0].dateStart, row[0].dateEnd)
    };

    const generatedAt = new Date();
    const stalenessMs = Math.max(generatedAt.getTime() - item.updatedAt.getTime(), 0);

    const response = {
      item,
      meta: {
        cache: {
          hit: false,
          key: cacheKey,
          ttlSeconds: config.CACHE_TTL_SESSIONS_SECONDS
        },
        freshness: {
          generatedAt: generatedAt.toISOString(),
          lastSyncAt: item.updatedAt.toISOString(),
          stalenessMs
        }
      }
    };

    await setCachedJson(cacheKey, config.CACHE_TTL_SESSIONS_SECONDS, response);
    return response;
  });

  app.get("/v1/sessions", async (request, reply) => {
    const parsedQuery = querySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      reply.code(400).send({ error: "Invalid query parameters", details: parsedQuery.error.flatten() });
      return;
    }

    const query = parsedQuery.data;
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

    const needsPostFilter = Boolean(query.state || query.sessionType);
    const candidateLimit = needsPostFilter ? Math.max(query.limit * 5, 200) : query.limit;

    const rawItems = await db
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
      .limit(candidateLimit);

    const now = new Date();
    const items = rawItems
      .map((item) => ({
        ...item,
        currentState: computeEffectiveState(now, item.dateStart, item.dateEnd)
      }))
      .filter((item) => (query.state ? item.currentState === query.state : true))
      .filter((item) => matchesSessionTypeFilter(item.sessionType, query.sessionType))
      .slice(0, query.limit);

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
