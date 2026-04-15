import type { FastifyPluginAsync } from "fastify";

import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";

import { buildCacheKey, getCachedJson, setCachedJson } from "../cache.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { meetings, sessionDrivers, sessionResults, sessions } from "../db/schema.js";
import type { ApiMeta } from "../types.js";

const querySchema = z.object({
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

type DriverStandingItem = {
  rank: number;
  driverNumber: number;
  fullName: string;
  nameAcronym: string | null;
  teamName: string | null;
  points: number;
  wins: number;
  podiums: number;
  classifiedFinishes: number;
  racesCount: number;
};

type TeamStandingItem = {
  rank: number;
  teamName: string;
  points: number;
  wins: number;
  podiums: number;
  driversCount: number;
};

type ChampionshipDriverItem = {
  driverNumber: number;
  fullName: string | null;
  nameAcronym: string | null;
  teamName: string | null;
  positionCurrent: number | null;
  positionStart: number | null;
  pointsCurrent: number | null;
  pointsStart: number | null;
};

type ChampionshipTeamItem = {
  teamName: string;
  positionCurrent: number | null;
  positionStart: number | null;
  pointsCurrent: number | null;
  pointsStart: number | null;
};

export const standingsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/standings", async (request) => {
    const query = querySchema.parse(request.query);
    const year = query.year ?? new Date().getUTCFullYear();
    const cacheKey = buildCacheKey("standings", { year });
    const cached = await getCachedJson<{
      year: number;
      drivers: DriverStandingItem[];
      teams: TeamStandingItem[];
      championship: {
        sessionKey: number | null;
        drivers: ChampionshipDriverItem[];
        teams: ChampionshipTeamItem[];
      };
      meta: ApiMeta;
    }>(cacheKey);
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

    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const startOfNextYear = new Date(Date.UTC(year + 1, 0, 1));

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
      .where(and(gte(sessions.dateStart, startOfYear), lt(sessions.dateStart, startOfNextYear)))
      .orderBy(desc(sessions.dateStart));

    const driverMap = new Map<number, Omit<DriverStandingItem, "rank">>();
    const teamMap = new Map<string, Omit<TeamStandingItem, "rank"> & { drivers: Set<number> }>();

    for (const row of rows) {
      if (row.sessionType.toLowerCase() !== "race") {
        continue;
      }
      if (row.dns || row.dsq || row.position === null) {
        continue;
      }

      const points = POINTS_BY_POSITION[row.position] ?? 0;
      const existingDriver = driverMap.get(row.driverNumber) ?? {
        driverNumber: row.driverNumber,
        fullName: row.fullName ?? `Driver ${row.driverNumber}`,
        nameAcronym: row.nameAcronym ?? null,
        teamName: row.teamName ?? null,
        points: 0,
        wins: 0,
        podiums: 0,
        classifiedFinishes: 0,
        racesCount: 0
      };

      existingDriver.points += points;
      existingDriver.racesCount += 1;
      existingDriver.classifiedFinishes += row.dnf ? 0 : 1;
      existingDriver.wins += row.position === 1 ? 1 : 0;
      existingDriver.podiums += row.position <= 3 ? 1 : 0;
      if (!existingDriver.teamName && row.teamName) {
        existingDriver.teamName = row.teamName;
      }
      if (!existingDriver.nameAcronym && row.nameAcronym) {
        existingDriver.nameAcronym = row.nameAcronym;
      }
      driverMap.set(row.driverNumber, existingDriver);

      const teamName = row.teamName ?? "Unknown Team";
      const existingTeam = teamMap.get(teamName) ?? {
        teamName,
        points: 0,
        wins: 0,
        podiums: 0,
        driversCount: 0,
        drivers: new Set<number>()
      };
      existingTeam.points += points;
      existingTeam.wins += row.position === 1 ? 1 : 0;
      existingTeam.podiums += row.position <= 3 ? 1 : 0;
      existingTeam.drivers.add(row.driverNumber);
      existingTeam.driversCount = existingTeam.drivers.size;
      teamMap.set(teamName, existingTeam);
    }

    const drivers = Array.from(driverMap.values())
      .sort((left, right) => right.points - left.points || right.wins - left.wins || right.podiums - left.podiums || left.fullName.localeCompare(right.fullName))
      .map((item, index) => ({ ...item, rank: index + 1 }));

    const teams = Array.from(teamMap.values())
      .sort((left, right) => right.points - left.points || right.wins - left.wins || right.podiums - left.podiums || left.teamName.localeCompare(right.teamName))
      .map((item, index) => ({
        rank: index + 1,
        teamName: item.teamName,
        points: item.points,
        wins: item.wins,
        podiums: item.podiums,
        driversCount: item.driversCount
      }));

    const latestRaceSession = await db.execute<{ sessionKey: number }>(sql`
      select s.session_key as "sessionKey"
      from sessions s
      where s.date_start >= ${startOfYear}
        and s.date_start < ${startOfNextYear}
        and lower(s.session_type) = 'race'
      order by s.date_start desc
      limit 1
    `);

    const championshipSessionKey = latestRaceSession.rows[0]?.sessionKey ?? null;

    const [championshipDriverRows, championshipTeamRows] = championshipSessionKey
      ? await Promise.all([
          db.execute<{
            driverNumber: number;
            fullName: string | null;
            nameAcronym: string | null;
            teamName: string | null;
            positionCurrent: number | null;
            positionStart: number | null;
            pointsCurrent: number | null;
            pointsStart: number | null;
          }>(sql`
            select
              cds.driver_number as "driverNumber",
              sd.full_name as "fullName",
              sd.name_acronym as "nameAcronym",
              sd.team_name as "teamName",
              cds.position_current as "positionCurrent",
              cds.position_start as "positionStart",
              cds.points_current as "pointsCurrent",
              cds.points_start as "pointsStart"
            from championship_driver_standings cds
            left join session_drivers sd
              on sd.session_key = cds.session_key
             and sd.driver_number = cds.driver_number
            where cds.session_key = ${championshipSessionKey}
            order by cds.position_current asc nulls last, cds.driver_number asc
          `),
          db.execute<{
            teamName: string;
            positionCurrent: number | null;
            positionStart: number | null;
            pointsCurrent: number | null;
            pointsStart: number | null;
          }>(sql`
            select
              team_name as "teamName",
              position_current as "positionCurrent",
              position_start as "positionStart",
              points_current as "pointsCurrent",
              points_start as "pointsStart"
            from championship_team_standings
            where session_key = ${championshipSessionKey}
            order by position_current asc nulls last, team_name asc
          `)
        ])
      : [{ rows: [] }, { rows: [] }];

    const championship = {
      sessionKey: championshipSessionKey,
      drivers: championshipDriverRows.rows.map((row: (typeof championshipDriverRows.rows)[number]) => ({
        driverNumber: row.driverNumber,
        fullName: row.fullName,
        nameAcronym: row.nameAcronym,
        teamName: row.teamName,
        positionCurrent: row.positionCurrent,
        positionStart: row.positionStart,
        pointsCurrent: row.pointsCurrent,
        pointsStart: row.pointsStart
      })),
      teams: championshipTeamRows.rows.map((row: (typeof championshipTeamRows.rows)[number]) => ({
        teamName: row.teamName,
        positionCurrent: row.positionCurrent,
        positionStart: row.positionStart,
        pointsCurrent: row.pointsCurrent,
        pointsStart: row.pointsStart
      }))
    };

    const generatedAt = new Date();
    const latestSyncAt = rows[0]?.fetchedAt ?? null;
    const stalenessMs = latestSyncAt ? Math.max(generatedAt.getTime() - latestSyncAt.getTime(), 0) : null;

    const response = {
      year,
      drivers,
      teams,
      championship,
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
