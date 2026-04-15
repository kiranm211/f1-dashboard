import type { FastifyPluginAsync } from "fastify";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { buildCacheKey, getCachedJson, setCachedJson } from "../cache.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { currentLeaderboard, sessions } from "../db/schema.js";
import type { ApiMeta } from "../types.js";

const querySchema = z.object({
  sessionKey: z.coerce.number().int().positive()
});

export const leaderboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/leaderboard", async (request, reply) => {
    const query = querySchema.parse(request.query);

    const sessionExists = await db
      .select({ sessionKey: sessions.sessionKey })
      .from(sessions)
      .where(eq(sessions.sessionKey, query.sessionKey))
      .limit(1);

    if (sessionExists.length === 0) {
      reply.code(404).send({ error: "Session not found", sessionKey: query.sessionKey });
      return;
    }

    const cacheKey = buildCacheKey("leaderboard", query);
    const cached = await getCachedJson<{ sessionKey: number; items: unknown[]; meta: ApiMeta }>(cacheKey);
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

    const items = await db
      .select()
      .from(currentLeaderboard)
      .where(eq(currentLeaderboard.sessionKey, query.sessionKey))
      .orderBy(asc(currentLeaderboard.position));

    const generatedAt = new Date();
    const latestSampleAt = items
      .map((item) => item.date)
      .filter((value): value is Date => value instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const stalenessMs = latestSampleAt ? Math.max(generatedAt.getTime() - latestSampleAt.getTime(), 0) : null;

    const response = {
      sessionKey: query.sessionKey,
      items,
      meta: {
        cache: {
          hit: false,
          key: cacheKey,
          ttlSeconds: config.CACHE_TTL_LEADERBOARD_SECONDS
        },
        freshness: {
          generatedAt: generatedAt.toISOString(),
          lastSyncAt: latestSampleAt?.toISOString() ?? null,
          stalenessMs
        }
      }
    };

    await setCachedJson(cacheKey, config.CACHE_TTL_LEADERBOARD_SECONDS, response);

    return response;
  });
};
