import type { FastifyPluginAsync } from "fastify";

import { and, desc, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";

import { buildCacheKey, getCachedJson, setCachedJson } from "../cache.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { circuitFacts, meetings, sessions } from "../db/schema.js";
import type { ApiMeta } from "../types.js";

const listQuerySchema = z.object({
  year: z.coerce.number().int().optional()
});

const detailParamsSchema = z.object({
  circuitKey: z.coerce.number().int().positive()
});

const detailQuerySchema = z.object({
  year: z.coerce.number().int().optional()
});

type CircuitFactData = {
  canonicalName: string;
  trackLengthKm: string;
  raceDistanceKm: string;
  laps: number;
  turns: number;
  firstGrandPrix: number;
  direction: string;
  drsZones: number;
  lapRecord: string;
  lapRecordHolder: string;
  lapRecordYear: number;
  overtakingHotspot: string;
  quickFact: string;
} | null;

type CircuitItem = {
  circuitKey: number;
  circuitShortName: string;
  countryName: string;
  location: string | null;
  circuitImage: string | null;
  meetingCount: number;
  latestMeetingName: string;
  latestDateStart: string;
  facts: CircuitFactData;
};

type CircuitSessionItem = {
  sessionKey: number;
  sessionName: string;
  sessionType: string;
  currentState: string;
  dateStart: string;
  dateEnd: string;
  meetingKey: number;
  meetingName: string;
};

function buildCircuitFact(row: {
  canonicalName: string | null;
  trackLengthKm: string | null;
  raceDistanceKm: string | null;
  laps: number | null;
  turns: number | null;
  firstGrandPrix: number | null;
  direction: string | null;
  drsZones: number | null;
  lapRecord: string | null;
  lapRecordHolder: string | null;
  lapRecordYear: number | null;
  overtakingHotspot: string | null;
  quickFact: string | null;
}): CircuitFactData {
  if (
    row.canonicalName === null ||
    row.trackLengthKm === null ||
    row.raceDistanceKm === null ||
    row.laps === null ||
    row.turns === null ||
    row.firstGrandPrix === null ||
    row.direction === null ||
    row.drsZones === null ||
    row.lapRecord === null ||
    row.lapRecordHolder === null ||
    row.lapRecordYear === null ||
    row.overtakingHotspot === null ||
    row.quickFact === null
  ) {
    return null;
  }

  return {
    canonicalName: row.canonicalName,
    trackLengthKm: row.trackLengthKm,
    raceDistanceKm: row.raceDistanceKm,
    laps: row.laps,
    turns: row.turns,
    firstGrandPrix: row.firstGrandPrix,
    direction: row.direction,
    drsZones: row.drsZones,
    lapRecord: row.lapRecord,
    lapRecordHolder: row.lapRecordHolder,
    lapRecordYear: row.lapRecordYear,
    overtakingHotspot: row.overtakingHotspot,
    quickFact: row.quickFact
  };
}

function getSeasonWindow(year?: number) {
  const effectiveYear = year ?? new Date().getUTCFullYear();
  return {
    year: effectiveYear,
    startOfYear: new Date(Date.UTC(effectiveYear, 0, 1)),
    startOfNextYear: new Date(Date.UTC(effectiveYear + 1, 0, 1))
  };
}

export const circuitRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/circuits", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const { year, startOfYear, startOfNextYear } = getSeasonWindow(query.year);
    const cacheKey = buildCacheKey("circuits", { year });
    const cached = await getCachedJson<{ year: number; items: CircuitItem[]; meta: ApiMeta }>(cacheKey);
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
        circuitKey: meetings.circuitKey,
        circuitShortName: meetings.circuitShortName,
        countryName: meetings.countryName,
        location: meetings.location,
        circuitImage: meetings.circuitImage,
        meetingName: meetings.meetingName,
        dateStart: meetings.dateStart,
        updatedAt: meetings.updatedAt,
        factCanonicalName: circuitFacts.canonicalName,
        factTrackLengthKm: circuitFacts.trackLengthKm,
        factRaceDistanceKm: circuitFacts.raceDistanceKm,
        factLaps: circuitFacts.laps,
        factTurns: circuitFacts.turns,
        factFirstGrandPrix: circuitFacts.firstGrandPrix,
        factDirection: circuitFacts.direction,
        factDrsZones: circuitFacts.drsZones,
        factLapRecord: circuitFacts.lapRecord,
        factLapRecordHolder: circuitFacts.lapRecordHolder,
        factLapRecordYear: circuitFacts.lapRecordYear,
        factOvertakingHotspot: circuitFacts.overtakingHotspot,
        factQuickFact: circuitFacts.quickFact
      })
      .from(meetings)
      .leftJoin(circuitFacts, eq(meetings.circuitKey, circuitFacts.circuitKey))
      .where(and(gte(meetings.dateStart, startOfYear), lt(meetings.dateStart, startOfNextYear)))
      .orderBy(desc(meetings.dateStart));

    const circuitMap = new Map<number, CircuitItem>();

    for (const row of rows) {
      if (row.circuitKey === null || row.circuitShortName === null) {
        continue;
      }

      const existing = circuitMap.get(row.circuitKey);
      if (existing) {
        existing.meetingCount += 1;
        continue;
      }

      circuitMap.set(row.circuitKey, {
        circuitKey: row.circuitKey,
        circuitShortName: row.circuitShortName,
        countryName: row.countryName,
        location: row.location,
        circuitImage: row.circuitImage,
        meetingCount: 1,
        latestMeetingName: row.meetingName,
        latestDateStart: row.dateStart.toISOString(),
        facts: buildCircuitFact({
          canonicalName: row.factCanonicalName,
          trackLengthKm: row.factTrackLengthKm,
          raceDistanceKm: row.factRaceDistanceKm,
          laps: row.factLaps,
          turns: row.factTurns,
          firstGrandPrix: row.factFirstGrandPrix,
          direction: row.factDirection,
          drsZones: row.factDrsZones,
          lapRecord: row.factLapRecord,
          lapRecordHolder: row.factLapRecordHolder,
          lapRecordYear: row.factLapRecordYear,
          overtakingHotspot: row.factOvertakingHotspot,
          quickFact: row.factQuickFact
        })
      });
    }

    const items = Array.from(circuitMap.values()).sort(
      (left, right) => new Date(right.latestDateStart).getTime() - new Date(left.latestDateStart).getTime()
    );

    const generatedAt = new Date();
    const latestSyncAt = rows[0]?.updatedAt ?? null;
    const stalenessMs = latestSyncAt ? Math.max(generatedAt.getTime() - latestSyncAt.getTime(), 0) : null;

    const response = {
      year,
      items,
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

  app.get("/v1/circuits/:circuitKey", async (request) => {
    const params = detailParamsSchema.parse(request.params);
    const query = detailQuerySchema.parse(request.query);
    const { year, startOfYear, startOfNextYear } = getSeasonWindow(query.year);
    const cacheKey = buildCacheKey("circuit-detail", { year, circuitKey: params.circuitKey });
    const cached = await getCachedJson<{ year: number; circuit: CircuitItem | null; sessions: CircuitSessionItem[]; meta: ApiMeta }>(cacheKey);
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

    const circuitRows = await db
      .select({
        circuitKey: meetings.circuitKey,
        circuitShortName: meetings.circuitShortName,
        countryName: meetings.countryName,
        location: meetings.location,
        circuitImage: meetings.circuitImage,
        meetingName: meetings.meetingName,
        dateStart: meetings.dateStart,
        updatedAt: meetings.updatedAt,
        factCanonicalName: circuitFacts.canonicalName,
        factTrackLengthKm: circuitFacts.trackLengthKm,
        factRaceDistanceKm: circuitFacts.raceDistanceKm,
        factLaps: circuitFacts.laps,
        factTurns: circuitFacts.turns,
        factFirstGrandPrix: circuitFacts.firstGrandPrix,
        factDirection: circuitFacts.direction,
        factDrsZones: circuitFacts.drsZones,
        factLapRecord: circuitFacts.lapRecord,
        factLapRecordHolder: circuitFacts.lapRecordHolder,
        factLapRecordYear: circuitFacts.lapRecordYear,
        factOvertakingHotspot: circuitFacts.overtakingHotspot,
        factQuickFact: circuitFacts.quickFact
      })
      .from(meetings)
      .leftJoin(circuitFacts, eq(meetings.circuitKey, circuitFacts.circuitKey))
      .where(
        and(
          eq(meetings.circuitKey, params.circuitKey),
          gte(meetings.dateStart, startOfYear),
          lt(meetings.dateStart, startOfNextYear)
        )
      )
      .orderBy(desc(meetings.dateStart));

    const circuit = circuitRows[0]
      ? {
          circuitKey: circuitRows[0].circuitKey ?? params.circuitKey,
          circuitShortName: circuitRows[0].circuitShortName ?? `Circuit ${params.circuitKey}`,
          countryName: circuitRows[0].countryName,
          location: circuitRows[0].location,
          circuitImage: circuitRows[0].circuitImage,
          meetingCount: circuitRows.length,
          latestMeetingName: circuitRows[0].meetingName,
          latestDateStart: circuitRows[0].dateStart.toISOString(),
          facts: buildCircuitFact({
            canonicalName: circuitRows[0].factCanonicalName,
            trackLengthKm: circuitRows[0].factTrackLengthKm,
            raceDistanceKm: circuitRows[0].factRaceDistanceKm,
            laps: circuitRows[0].factLaps,
            turns: circuitRows[0].factTurns,
            firstGrandPrix: circuitRows[0].factFirstGrandPrix,
            direction: circuitRows[0].factDirection,
            drsZones: circuitRows[0].factDrsZones,
            lapRecord: circuitRows[0].factLapRecord,
            lapRecordHolder: circuitRows[0].factLapRecordHolder,
            lapRecordYear: circuitRows[0].factLapRecordYear,
            overtakingHotspot: circuitRows[0].factOvertakingHotspot,
            quickFact: circuitRows[0].factQuickFact
          })
        }
      : null;

    const sessionRows = await db
      .select({
        sessionKey: sessions.sessionKey,
        sessionName: sessions.sessionName,
        sessionType: sessions.sessionType,
        currentState: sessions.currentState,
        dateStart: sessions.dateStart,
        dateEnd: sessions.dateEnd,
        meetingKey: meetings.meetingKey,
        meetingName: meetings.meetingName,
        updatedAt: sessions.updatedAt
      })
      .from(sessions)
      .innerJoin(meetings, eq(meetings.meetingKey, sessions.meetingKey))
      .where(
        and(
          eq(meetings.circuitKey, params.circuitKey),
          gte(sessions.dateStart, startOfYear),
          lt(sessions.dateStart, startOfNextYear)
        )
      )
      .orderBy(desc(sessions.dateStart));

    const detailSessions = sessionRows.map((row) => ({
      sessionKey: row.sessionKey,
      sessionName: row.sessionName,
      sessionType: row.sessionType,
      currentState: row.currentState,
      dateStart: row.dateStart.toISOString(),
      dateEnd: row.dateEnd.toISOString(),
      meetingKey: row.meetingKey,
      meetingName: row.meetingName
    }));

    const generatedAt = new Date();
    const latestSyncAt = sessionRows[0]?.updatedAt ?? circuitRows[0]?.updatedAt ?? null;
    const stalenessMs = latestSyncAt ? Math.max(generatedAt.getTime() - latestSyncAt.getTime(), 0) : null;

    const response = {
      year,
      circuit,
      sessions: detailSessions,
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
