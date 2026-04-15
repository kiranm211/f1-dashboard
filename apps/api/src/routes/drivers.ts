import type { FastifyPluginAsync } from "fastify";

import { and, desc, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";

import { buildCacheKey, getCachedJson, setCachedJson } from "../cache.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { driverFacts, meetings, sessionDrivers, sessionResults, sessions } from "../db/schema.js";
import type { ApiMeta } from "../types.js";

const listQuerySchema = z.object({
  year: z.coerce.number().int().optional()
});

const detailParamsSchema = z.object({
  driverNumber: z.coerce.number().int().positive()
});

const detailQuerySchema = z.object({
  year: z.coerce.number().int().optional()
});

const POINTS_BY_POSITION: Record<number, number> = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1
};

type DriverListItem = {
  rank: number;
  driverNumber: number;
  broadcastName: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  nameAcronym: string | null;
  teamName: string | null;
  teamColour: string | null;
  headshotUrl: string | null;
  countryCode: string | null;
  points: number;
  wins: number;
  podiums: number;
  racesCount: number;
  facts: DriverFactData | null;
};

type DriverFactData = {
  nationality: string;
  dateOfBirth: string;
  placeOfBirth: string;
  debutSeason: number;
  juniorCareerHighlight: string;
  factHeadline: string;
};

type DriverMetadata = {
  driverNumber: number;
  broadcastName: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  nameAcronym: string | null;
  teamName: string | null;
  teamColour: string | null;
  headshotUrl: string | null;
  countryCode: string | null;
  updatedAt: Date;
};

type DriverFactRow = DriverFactData & {
  driverNumber: number;
  fullName: string;
  updatedAt: Date;
};

type DriverRaceResult = {
  sessionKey: number;
  meetingName: string;
  sessionName: string;
  dateStart: string;
  teamName: string | null;
  position: number | null;
  points: number;
  dnf: boolean | null;
  dns: boolean | null;
  dsq: boolean | null;
};

type DriverAggregationRow = {
  driverNumber: number;
  position: number | null;
  dnf: boolean | null;
  dns: boolean | null;
  dsq: boolean | null;
  fullName: string | null;
  nameAcronym: string | null;
  teamName: string | null;
  sessionType: string;
};

function getSeasonWindow(year?: number) {
  const effectiveYear = year ?? new Date().getUTCFullYear();
  return {
    year: effectiveYear,
    startOfYear: new Date(Date.UTC(effectiveYear, 0, 1)),
    startOfNextYear: new Date(Date.UTC(effectiveYear + 1, 0, 1))
  };
}

function buildDriverMetadataMap(rows: DriverMetadata[]): Map<number, DriverMetadata> {
  const metadataMap = new Map<number, DriverMetadata>();

  for (const row of rows) {
    if (!metadataMap.has(row.driverNumber)) {
      metadataMap.set(row.driverNumber, row);
    }
  }

  return metadataMap;
}

function buildDriverFactsMap(rows: DriverFactRow[]): Map<number, DriverFactData> {
  const factsMap = new Map<number, DriverFactData>();

  for (const row of rows) {
    if (!factsMap.has(row.driverNumber)) {
      factsMap.set(row.driverNumber, {
        nationality: row.nationality,
        dateOfBirth: row.dateOfBirth,
        placeOfBirth: row.placeOfBirth,
        debutSeason: row.debutSeason,
        juniorCareerHighlight: row.juniorCareerHighlight,
        factHeadline: row.factHeadline
      });
    }
  }

  return factsMap;
}

function buildDriverItems(rows: DriverAggregationRow[], metadataMap: Map<number, DriverMetadata>, factsMap: Map<number, DriverFactData>): DriverListItem[] {
  const driverMap = new Map<number, Omit<DriverListItem, "rank">>();

  for (const metadata of metadataMap.values()) {
    driverMap.set(metadata.driverNumber, {
      driverNumber: metadata.driverNumber,
      broadcastName: metadata.broadcastName,
      firstName: metadata.firstName,
      lastName: metadata.lastName,
      fullName: metadata.fullName ?? `Driver ${metadata.driverNumber}`,
      nameAcronym: metadata.nameAcronym,
      teamName: metadata.teamName,
      teamColour: metadata.teamColour,
      headshotUrl: metadata.headshotUrl,
      countryCode: metadata.countryCode,
      points: 0,
      wins: 0,
      podiums: 0,
      racesCount: 0,
      facts: factsMap.get(metadata.driverNumber) ?? null
    });
  }

  for (const row of rows) {
    if (row.sessionType.toLowerCase() !== "race") {
      continue;
    }
    if (row.dns || row.dsq || row.position === null) {
      continue;
    }

    const existing = driverMap.get(row.driverNumber) ?? {
      driverNumber: row.driverNumber,
      broadcastName: metadataMap.get(row.driverNumber)?.broadcastName ?? null,
      firstName: metadataMap.get(row.driverNumber)?.firstName ?? null,
      lastName: metadataMap.get(row.driverNumber)?.lastName ?? null,
      fullName: metadataMap.get(row.driverNumber)?.fullName ?? row.fullName ?? `Driver ${row.driverNumber}`,
      nameAcronym: metadataMap.get(row.driverNumber)?.nameAcronym ?? row.nameAcronym ?? null,
      teamName: metadataMap.get(row.driverNumber)?.teamName ?? row.teamName ?? null,
      teamColour: metadataMap.get(row.driverNumber)?.teamColour ?? null,
      headshotUrl: metadataMap.get(row.driverNumber)?.headshotUrl ?? null,
      countryCode: metadataMap.get(row.driverNumber)?.countryCode ?? null,
      points: 0,
      wins: 0,
      podiums: 0,
      racesCount: 0,
      facts: factsMap.get(row.driverNumber) ?? null
    };

    existing.points += POINTS_BY_POSITION[row.position] ?? 0;
    existing.wins += row.position === 1 ? 1 : 0;
    existing.podiums += row.position <= 3 ? 1 : 0;
    existing.racesCount += 1;
    if (!existing.teamName && row.teamName) {
      existing.teamName = row.teamName;
    }
    if (!existing.nameAcronym && row.nameAcronym) {
      existing.nameAcronym = row.nameAcronym;
    }

    driverMap.set(row.driverNumber, existing);
  }

  return Array.from(driverMap.values())
    .sort((left, right) => right.points - left.points || right.wins - left.wins || right.podiums - left.podiums || left.fullName.localeCompare(right.fullName))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

export const driverRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/drivers", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const { year, startOfYear, startOfNextYear } = getSeasonWindow(query.year);
    const cacheKey = buildCacheKey("drivers", { year });
    const cached = await getCachedJson<{ year: number; items: DriverListItem[]; meta: ApiMeta }>(cacheKey);
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
        driverNumber: sessionResults.driverNumber,
        position: sessionResults.position,
        dnf: sessionResults.dnf,
        dns: sessionResults.dns,
        dsq: sessionResults.dsq,
        fetchedAt: sessionResults.fetchedAt,
        fullName: sessionDrivers.fullName,
        nameAcronym: sessionDrivers.nameAcronym,
        teamName: sessionDrivers.teamName,
        sessionType: sessions.sessionType
      })
      .from(sessionResults)
      .innerJoin(sessions, eq(sessions.sessionKey, sessionResults.sessionKey))
      .leftJoin(
        sessionDrivers,
        and(eq(sessionDrivers.sessionKey, sessionResults.sessionKey), eq(sessionDrivers.driverNumber, sessionResults.driverNumber))
      )
      .where(and(gte(sessions.dateStart, startOfYear), lt(sessions.dateStart, startOfNextYear)))
      .orderBy(desc(sessions.dateStart));

    const metadataRows = await db
      .select({
        driverNumber: sessionDrivers.driverNumber,
        broadcastName: sessionDrivers.broadcastName,
        firstName: sessionDrivers.firstName,
        lastName: sessionDrivers.lastName,
        fullName: sessionDrivers.fullName,
        nameAcronym: sessionDrivers.nameAcronym,
        teamName: sessionDrivers.teamName,
        teamColour: sessionDrivers.teamColour,
        headshotUrl: sessionDrivers.headshotUrl,
        countryCode: sessionDrivers.countryCode,
        updatedAt: sessionDrivers.updatedAt
      })
      .from(sessionDrivers)
      .innerJoin(sessions, eq(sessions.sessionKey, sessionDrivers.sessionKey))
      .where(and(gte(sessions.dateStart, startOfYear), lt(sessions.dateStart, startOfNextYear)))
      .orderBy(desc(sessions.dateStart), desc(sessionDrivers.updatedAt));

    const metadataMap = buildDriverMetadataMap(metadataRows);
    const factsRows = await db
      .select({
        driverNumber: driverFacts.driverNumber,
        fullName: driverFacts.fullName,
        nationality: driverFacts.nationality,
        dateOfBirth: driverFacts.dateOfBirth,
        placeOfBirth: driverFacts.placeOfBirth,
        debutSeason: driverFacts.debutSeason,
        juniorCareerHighlight: driverFacts.juniorCareerHighlight,
        factHeadline: driverFacts.factHeadline,
        updatedAt: driverFacts.updatedAt
      })
      .from(driverFacts)
      .orderBy(desc(driverFacts.updatedAt));

    const factsMap = buildDriverFactsMap(factsRows);
    const items = buildDriverItems(rows, metadataMap, factsMap);

    const generatedAt = new Date();
    const latestSyncAt = rows[0]?.fetchedAt ?? metadataRows[0]?.updatedAt ?? factsRows[0]?.updatedAt ?? null;
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

  app.get("/v1/drivers/:driverNumber", async (request) => {
    const params = detailParamsSchema.parse(request.params);
    const query = detailQuerySchema.parse(request.query);
    const { year, startOfYear, startOfNextYear } = getSeasonWindow(query.year);
    const cacheKey = buildCacheKey("driver-detail", { year, driverNumber: params.driverNumber });
    const cached = await getCachedJson<{ year: number; driverNumber: number; profile: DriverListItem | null; recentResults: DriverRaceResult[]; meta: ApiMeta }>(cacheKey);
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
        sessionKey: sessionResults.sessionKey,
        driverNumber: sessionResults.driverNumber,
        position: sessionResults.position,
        dnf: sessionResults.dnf,
        dns: sessionResults.dns,
        dsq: sessionResults.dsq,
        fetchedAt: sessionResults.fetchedAt,
        fullName: sessionDrivers.fullName,
        nameAcronym: sessionDrivers.nameAcronym,
        teamName: sessionDrivers.teamName,
        sessionName: sessions.sessionName,
        sessionType: sessions.sessionType,
        dateStart: sessions.dateStart,
        meetingName: meetings.meetingName
      })
      .from(sessionResults)
      .innerJoin(sessions, eq(sessions.sessionKey, sessionResults.sessionKey))
      .innerJoin(meetings, eq(meetings.meetingKey, sessions.meetingKey))
      .leftJoin(
        sessionDrivers,
        and(eq(sessionDrivers.sessionKey, sessionResults.sessionKey), eq(sessionDrivers.driverNumber, sessionResults.driverNumber))
      )
      .where(
        and(
          eq(sessionResults.driverNumber, params.driverNumber),
          gte(sessions.dateStart, startOfYear),
          lt(sessions.dateStart, startOfNextYear)
        )
      )
      .orderBy(desc(sessions.dateStart));

    const metadataRows = await db
      .select({
        driverNumber: sessionDrivers.driverNumber,
        broadcastName: sessionDrivers.broadcastName,
        firstName: sessionDrivers.firstName,
        lastName: sessionDrivers.lastName,
        fullName: sessionDrivers.fullName,
        nameAcronym: sessionDrivers.nameAcronym,
        teamName: sessionDrivers.teamName,
        teamColour: sessionDrivers.teamColour,
        headshotUrl: sessionDrivers.headshotUrl,
        countryCode: sessionDrivers.countryCode,
        updatedAt: sessionDrivers.updatedAt
      })
      .from(sessionDrivers)
      .innerJoin(sessions, eq(sessions.sessionKey, sessionDrivers.sessionKey))
      .where(
        and(
          eq(sessionDrivers.driverNumber, params.driverNumber),
          gte(sessions.dateStart, startOfYear),
          lt(sessions.dateStart, startOfNextYear)
        )
      )
      .orderBy(desc(sessions.dateStart), desc(sessionDrivers.updatedAt));

    const metadataMap = buildDriverMetadataMap(metadataRows);
    const latestMetadata = metadataMap.get(params.driverNumber) ?? null;
    const factsRows = await db
      .select({
        driverNumber: driverFacts.driverNumber,
        fullName: driverFacts.fullName,
        nationality: driverFacts.nationality,
        dateOfBirth: driverFacts.dateOfBirth,
        placeOfBirth: driverFacts.placeOfBirth,
        debutSeason: driverFacts.debutSeason,
        juniorCareerHighlight: driverFacts.juniorCareerHighlight,
        factHeadline: driverFacts.factHeadline,
        updatedAt: driverFacts.updatedAt
      })
      .from(driverFacts)
      .orderBy(desc(driverFacts.updatedAt));
    const factsMap = buildDriverFactsMap(factsRows);
    const latestFacts = factsMap.get(params.driverNumber) ?? null;

    let profileBase: Omit<DriverListItem, "rank"> | null = null;
    const recentResults: DriverRaceResult[] = [];

    for (const row of rows) {
      if (row.sessionType.toLowerCase() !== "race") {
        continue;
      }

      if (profileBase === null) {
        profileBase = {
          driverNumber: row.driverNumber,
          broadcastName: latestMetadata?.broadcastName ?? null,
          firstName: latestMetadata?.firstName ?? null,
          lastName: latestMetadata?.lastName ?? null,
          fullName: latestMetadata?.fullName ?? row.fullName ?? `Driver ${row.driverNumber}`,
          nameAcronym: latestMetadata?.nameAcronym ?? row.nameAcronym ?? null,
          teamName: latestMetadata?.teamName ?? row.teamName ?? null,
          teamColour: latestMetadata?.teamColour ?? null,
          headshotUrl: latestMetadata?.headshotUrl ?? null,
          countryCode: latestMetadata?.countryCode ?? null,
          points: 0,
          wins: 0,
          podiums: 0,
          racesCount: 0,
          facts: latestFacts
        };
      }

      const points = row.position !== null && !row.dns && !row.dsq ? POINTS_BY_POSITION[row.position] ?? 0 : 0;
      if (!row.dns && !row.dsq && row.position !== null) {
        profileBase.points += points;
        profileBase.wins += row.position === 1 ? 1 : 0;
        profileBase.podiums += row.position <= 3 ? 1 : 0;
        profileBase.racesCount += 1;
      }

      recentResults.push({
        sessionKey: row.sessionKey,
        meetingName: row.meetingName,
        sessionName: row.sessionName,
        dateStart: row.dateStart.toISOString(),
        teamName: row.teamName ?? null,
        position: row.position,
        points,
        dnf: row.dnf,
        dns: row.dns,
        dsq: row.dsq
      });
    }

    const rankingRows = await db
      .select({
        driverNumber: sessionResults.driverNumber,
        position: sessionResults.position,
        dnf: sessionResults.dnf,
        dns: sessionResults.dns,
        dsq: sessionResults.dsq,
        fullName: sessionDrivers.fullName,
        nameAcronym: sessionDrivers.nameAcronym,
        teamName: sessionDrivers.teamName,
        sessionType: sessions.sessionType
      })
      .from(sessionResults)
      .innerJoin(sessions, eq(sessions.sessionKey, sessionResults.sessionKey))
      .leftJoin(
        sessionDrivers,
        and(eq(sessionDrivers.sessionKey, sessionResults.sessionKey), eq(sessionDrivers.driverNumber, sessionResults.driverNumber))
      )
      .where(and(gte(sessions.dateStart, startOfYear), lt(sessions.dateStart, startOfNextYear)));

    const rankingMetadataRows = await db
      .select({
        driverNumber: sessionDrivers.driverNumber,
        broadcastName: sessionDrivers.broadcastName,
        firstName: sessionDrivers.firstName,
        lastName: sessionDrivers.lastName,
        fullName: sessionDrivers.fullName,
        nameAcronym: sessionDrivers.nameAcronym,
        teamName: sessionDrivers.teamName,
        teamColour: sessionDrivers.teamColour,
        headshotUrl: sessionDrivers.headshotUrl,
        countryCode: sessionDrivers.countryCode,
        updatedAt: sessionDrivers.updatedAt
      })
      .from(sessionDrivers)
      .innerJoin(sessions, eq(sessions.sessionKey, sessionDrivers.sessionKey))
      .where(and(gte(sessions.dateStart, startOfYear), lt(sessions.dateStart, startOfNextYear)))
      .orderBy(desc(sessions.dateStart), desc(sessionDrivers.updatedAt));

    const rankedProfile = buildDriverItems(rankingRows, buildDriverMetadataMap(rankingMetadataRows), factsMap).find((item) => item.driverNumber === params.driverNumber) ?? null;

    const generatedAt = new Date();
    const latestSyncAt = rows[0]?.fetchedAt ?? metadataRows[0]?.updatedAt ?? factsRows[0]?.updatedAt ?? null;
    const stalenessMs = latestSyncAt ? Math.max(generatedAt.getTime() - latestSyncAt.getTime(), 0) : null;

    const response = {
      year,
      driverNumber: params.driverNumber,
      profile:
        rankedProfile ??
        (profileBase
          ? { ...profileBase, rank: 0 }
          : latestMetadata
            ? {
                rank: 0,
                driverNumber: latestMetadata.driverNumber,
                broadcastName: latestMetadata.broadcastName,
                firstName: latestMetadata.firstName,
                lastName: latestMetadata.lastName,
                fullName: latestMetadata.fullName ?? `Driver ${latestMetadata.driverNumber}`,
                nameAcronym: latestMetadata.nameAcronym,
                teamName: latestMetadata.teamName,
                teamColour: latestMetadata.teamColour,
                headshotUrl: latestMetadata.headshotUrl,
                countryCode: latestMetadata.countryCode,
                points: 0,
                wins: 0,
                podiums: 0,
                racesCount: 0,
                facts: latestFacts
              }
            : latestFacts
              ? {
                  rank: 0,
                  driverNumber: params.driverNumber,
                  broadcastName: null,
                  firstName: null,
                  lastName: null,
                  fullName: factsRows.find((row) => row.driverNumber === params.driverNumber)?.fullName ?? `Driver ${params.driverNumber}`,
                  nameAcronym: null,
                  teamName: null,
                  teamColour: null,
                  headshotUrl: null,
                  countryCode: null,
                  points: 0,
                  wins: 0,
                  podiums: 0,
                  racesCount: 0,
                  facts: latestFacts
                }
            : null),
      recentResults,
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
