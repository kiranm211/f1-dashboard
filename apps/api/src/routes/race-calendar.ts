import type { FastifyPluginAsync } from "fastify";

import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { z } from "zod";

import { buildCacheKey, getCachedJson, setCachedJson } from "../cache.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { currentLeaderboard, meetings, sessions } from "../db/schema.js";
import type { ApiMeta } from "../types.js";

const querySchema = z.object({
  year: z.coerce.number().int().optional(),
  state: z.enum(["scheduled", "warmup", "live", "cooldown", "closed"]).optional(),
  raceOnly: z
    .preprocess((value) => {
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") {
          return true;
        }
        if (normalized === "false") {
          return false;
        }
      }
      return value;
    }, z.boolean())
    .default(true)
});

const SESSION_WARMUP_MINUTES = 60;
const SESSION_COOLDOWN_MINUTES = 30;

type SessionState = z.infer<typeof querySchema>["state"];

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

function isRaceSessionType(sessionType: string): boolean {
  const normalized = sessionType.trim().toLowerCase();
  return normalized === "race" || normalized === "sprint race";
}

function getSeasonWindow(year?: number) {
  const effectiveYear = year ?? new Date().getUTCFullYear();
  return {
    year: effectiveYear,
    startOfYear: new Date(Date.UTC(effectiveYear, 0, 1)),
    startOfNextYear: new Date(Date.UTC(effectiveYear + 1, 0, 1))
  };
}

type CalendarSessionItem = {
  sessionKey: number;
  sessionName: string;
  sessionType: string;
  currentState: NonNullable<SessionState>;
  dataReady: boolean;
  dateStart: string;
  dateEnd: string;
};

type CalendarWeekendItem = {
  meetingKey: number;
  meetingName: string;
  countryName: string;
  location: string | null;
  circuitShortName: string | null;
  dateStart: string;
  dateEnd: string;
  sessions: CalendarSessionItem[];
};

type CalendarMonthBucket = {
  month: number;
  monthLabel: string;
  weekends: CalendarWeekendItem[];
};

export const raceCalendarRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/races/calendar", async (request, reply) => {
    const parsedQuery = querySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      reply.code(400).send({ error: "Invalid query parameters", details: parsedQuery.error.flatten() });
      return;
    }

    const query = parsedQuery.data;
    const { year, startOfYear, startOfNextYear } = getSeasonWindow(query.year);
    const cacheKey = buildCacheKey("races-calendar", { year, state: query.state, raceOnly: query.raceOnly });
    const cached = await getCachedJson<{ year: number; availableYears: number[]; months: CalendarMonthBucket[]; meta: ApiMeta }>(cacheKey);
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

    const rows = await db
      .select({
        meetingKey: meetings.meetingKey,
        meetingName: meetings.meetingName,
        meetingCountryName: meetings.countryName,
        meetingLocation: meetings.location,
        meetingCircuitShortName: meetings.circuitShortName,
        meetingDateStart: meetings.dateStart,
        meetingDateEnd: meetings.dateEnd,
        meetingUpdatedAt: meetings.updatedAt,
        sessionKey: sessions.sessionKey,
        sessionName: sessions.sessionName,
        sessionType: sessions.sessionType,
        sessionDateStart: sessions.dateStart,
        sessionDateEnd: sessions.dateEnd,
        sessionUpdatedAt: sessions.updatedAt
      })
      .from(meetings)
      .innerJoin(sessions, eq(meetings.meetingKey, sessions.meetingKey))
      .where(and(gte(meetings.dateStart, startOfYear), lt(meetings.dateStart, startOfNextYear)))
      .orderBy(desc(meetings.dateStart), asc(sessions.dateStart));

    const yearRows = await db
      .select({
        year: meetings.year
      })
      .from(meetings)
      .groupBy(meetings.year)
      .orderBy(desc(meetings.year));

    const sessionKeys = Array.from(new Set(rows.map((row) => row.sessionKey)));
    const readySessionKeys = new Set<number>();

    if (sessionKeys.length > 0) {
      const readyRows = await db
        .select({
          sessionKey: currentLeaderboard.sessionKey
        })
        .from(currentLeaderboard)
        .where(inArray(currentLeaderboard.sessionKey, sessionKeys))
        .groupBy(currentLeaderboard.sessionKey);

      for (const readyRow of readyRows) {
        if (readyRow.sessionKey !== null) {
          readySessionKeys.add(readyRow.sessionKey);
        }
      }
    }

    const now = new Date();
    const weekendMap = new Map<number, CalendarWeekendItem>();

    for (const row of rows) {
      if (query.raceOnly && !isRaceSessionType(row.sessionType)) {
        continue;
      }

      const effectiveState = computeEffectiveState(now, row.sessionDateStart, row.sessionDateEnd);
      if (query.state && effectiveState !== query.state) {
        continue;
      }

      const existingWeekend = weekendMap.get(row.meetingKey);
      const sessionItem: CalendarSessionItem = {
        sessionKey: row.sessionKey,
        sessionName: row.sessionName,
        sessionType: row.sessionType,
        currentState: effectiveState,
        dataReady: readySessionKeys.has(row.sessionKey),
        dateStart: row.sessionDateStart.toISOString(),
        dateEnd: row.sessionDateEnd.toISOString()
      };

      if (existingWeekend) {
        existingWeekend.sessions.push(sessionItem);
        continue;
      }

      weekendMap.set(row.meetingKey, {
        meetingKey: row.meetingKey,
        meetingName: row.meetingName,
        countryName: row.meetingCountryName,
        location: row.meetingLocation,
        circuitShortName: row.meetingCircuitShortName,
        dateStart: row.meetingDateStart.toISOString(),
        dateEnd: row.meetingDateEnd.toISOString(),
        sessions: [sessionItem]
      });
    }

    const monthMap = new Map<number, CalendarMonthBucket>();
    const formatter = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });

    for (const weekend of weekendMap.values()) {
      weekend.sessions.sort((left, right) => left.dateStart.localeCompare(right.dateStart));
      const month = new Date(weekend.dateStart).getUTCMonth() + 1;
      const existingMonth = monthMap.get(month);
      if (existingMonth) {
        existingMonth.weekends.push(weekend);
      } else {
        monthMap.set(month, {
          month,
          monthLabel: formatter.format(new Date(Date.UTC(year, month - 1, 1))),
          weekends: [weekend]
        });
      }
    }

    const months = Array.from(monthMap.values())
      .sort((left, right) => left.month - right.month)
      .map((bucket) => ({
        ...bucket,
        weekends: bucket.weekends.sort((left, right) => left.dateStart.localeCompare(right.dateStart))
      }));

    const latestSyncAt = rows.reduce<Date | null>((latest, row) => {
      const candidate = row.sessionUpdatedAt > row.meetingUpdatedAt ? row.sessionUpdatedAt : row.meetingUpdatedAt;
      if (!latest || candidate > latest) {
        return candidate;
      }
      return latest;
    }, null);

    const generatedAt = new Date();
    const stalenessMs = latestSyncAt ? Math.max(generatedAt.getTime() - latestSyncAt.getTime(), 0) : null;

    const response = {
      year,
      availableYears: yearRows.map((row) => row.year),
      months,
      meta: {
        cache: {
          hit: false,
          key: cacheKey,
          ttlSeconds: config.CACHE_TTL_SESSIONS_SECONDS
        },
        freshness: {
          generatedAt: generatedAt.toISOString(),
          lastSyncAt: latestSyncAt?.toISOString() ?? null,
          stalenessMs
        }
      }
    };

    await setCachedJson(cacheKey, config.CACHE_TTL_SESSIONS_SECONDS, response);

    return response;
  });
};
