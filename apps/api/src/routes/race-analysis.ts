import type { FastifyPluginAsync } from "fastify";

import { sql } from "drizzle-orm";
import { z } from "zod";

import { buildCacheKey, getCachedJson, setCachedJson } from "../cache.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import type { ApiMeta } from "../types.js";

const querySchema = z.object({
  sessionKey: z.coerce.number().int().positive()
});

type LapRow = {
  driverNumber: number;
  lapNumber: number;
  lapDuration: number | null;
  durationSector1: number | null;
  durationSector2: number | null;
  durationSector3: number | null;
  isPitOutLap: boolean | null;
  i1Speed: number | null;
  i2Speed: number | null;
  stSpeed: number | null;
};

type StintRow = {
  driverNumber: number;
  stintNumber: number;
  compound: string | null;
  lapStart: number | null;
  lapEnd: number | null;
  tyreAgeAtStart: number | null;
};

type PitStopRow = {
  driverNumber: number;
  lapNumber: number;
  stopDuration: number | null;
  laneDuration: number | null;
};

type DriverRow = {
  driverNumber: number;
  nameAcronym: string | null;
  fullName: string;
  teamName: string | null;
  teamColour: string | null;
};

type TelemetrySummaryRow = {
  driverNumber: number;
  topSpeed: number | null;
  avgSpeed: number | null;
  avgThrottle: number | null;
  avgRpm: number | null;
  carSamples: number;
  locationSamples: number;
};

type RaceAnalysisResponse = {
  sessionKey: number;
  drivers: DriverRow[];
  laps: LapRow[];
  stints: StintRow[];
  pitStops: PitStopRow[];
  telemetry: TelemetrySummaryRow[];
  meta: ApiMeta;
};

export const raceAnalysisRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/race-analysis", async (request, reply) => {
    const query = querySchema.safeParse(request.query);
    if (!query.success) {
      reply.code(400).send({ error: "sessionKey is required and must be a positive integer." });
      return;
    }

    const { sessionKey } = query.data;

    const sessionExists = await db.execute<{ sessionKey: number }>(sql`
      select session_key as "sessionKey"
      from sessions
      where session_key = ${sessionKey}
      limit 1
    `);
    if (sessionExists.rows.length === 0) {
      reply.code(404).send({ error: "Session not found", sessionKey });
      return;
    }

    const cacheKey = buildCacheKey("race-analysis", { sessionKey });
    const cached = await getCachedJson<RaceAnalysisResponse>(cacheKey);
    if (cached) {
      return {
        ...cached,
        meta: { ...cached.meta, cache: { ...cached.meta.cache, hit: true } }
      };
    }

    const [driverRows, lapRows, stintRows, pitStopRows, telemetryRows] = await Promise.all([
      db.execute<{
        driver_number: number;
        name_acronym: string | null;
        full_name: string;
        team_name: string | null;
        team_colour: string | null;
      }>(sql`
        SELECT DISTINCT ON (driver_number)
          driver_number,
          name_acronym,
          full_name,
          team_name,
          team_colour
        FROM session_drivers
        WHERE session_key = ${sessionKey}
        ORDER BY driver_number
      `),

      db.execute<{
        driver_number: number;
        lap_number: number;
        lap_duration: number | null;
        duration_sector_1: number | null;
        duration_sector_2: number | null;
        duration_sector_3: number | null;
        is_pit_out_lap: boolean | null;
        i1_speed: number | null;
        i2_speed: number | null;
        st_speed: number | null;
      }>(sql`
        SELECT
          driver_number,
          lap_number,
          lap_duration,
          duration_sector_1,
          duration_sector_2,
          duration_sector_3,
          is_pit_out_lap,
          i1_speed,
          i2_speed,
          st_speed
        FROM laps
        WHERE session_key = ${sessionKey}
        ORDER BY driver_number, lap_number
      `),

      db.execute<{
        driver_number: number;
        stint_number: number;
        compound: string | null;
        lap_start: number | null;
        lap_end: number | null;
        tyre_age_at_start: number | null;
      }>(sql`
        SELECT
          driver_number,
          stint_number,
          compound,
          lap_start,
          lap_end,
          tyre_age_at_start
        FROM stints
        WHERE session_key = ${sessionKey}
        ORDER BY driver_number, stint_number
      `),

      db.execute<{
        driver_number: number;
        lap_number: number;
        stop_duration: number | null;
        lane_duration: number | null;
      }>(sql`
        SELECT
          driver_number,
          lap_number,
          stop_duration,
          lane_duration
        FROM pit_stops
        WHERE session_key = ${sessionKey}
        ORDER BY driver_number, lap_number
      `),

      db.execute<{
        driverNumber: number;
        topSpeed: number | null;
        avgSpeed: number | null;
        avgThrottle: number | null;
        avgRpm: number | null;
        carSamples: number;
        locationSamples: number;
      }>(sql`
        select
          c.driver_number as "driverNumber",
          max(c.speed)::int as "topSpeed",
          avg(c.speed) as "avgSpeed",
          avg(c.throttle) as "avgThrottle",
          avg(c.rpm) as "avgRpm",
          count(*)::int as "carSamples",
          coalesce(l.location_samples, 0)::int as "locationSamples"
        from car_data_samples c
        left join (
          select
            ls.driver_number,
            count(*)::int as location_samples
          from location_samples ls
          where ls.session_key = ${sessionKey}
          group by ls.driver_number
        ) l on l.driver_number = c.driver_number
        where c.session_key = ${sessionKey}
        group by c.driver_number, l.location_samples
        order by max(c.speed) desc nulls last, c.driver_number asc
      `)
    ]);

    const drivers: DriverRow[] = driverRows.rows.map((row: (typeof driverRows.rows)[number]) => ({
      driverNumber: row.driver_number,
      nameAcronym: row.name_acronym,
      fullName: row.full_name,
      teamName: row.team_name,
      teamColour: row.team_colour
    }));

    const laps: LapRow[] = lapRows.rows.map((row: (typeof lapRows.rows)[number]) => ({
      driverNumber: row.driver_number,
      lapNumber: row.lap_number,
      lapDuration: row.lap_duration,
      durationSector1: row.duration_sector_1,
      durationSector2: row.duration_sector_2,
      durationSector3: row.duration_sector_3,
      isPitOutLap: row.is_pit_out_lap,
      i1Speed: row.i1_speed,
      i2Speed: row.i2_speed,
      stSpeed: row.st_speed
    }));

    const stints: StintRow[] = stintRows.rows.map((row: (typeof stintRows.rows)[number]) => ({
      driverNumber: row.driver_number,
      stintNumber: row.stint_number,
      compound: row.compound,
      lapStart: row.lap_start,
      lapEnd: row.lap_end,
      tyreAgeAtStart: row.tyre_age_at_start
    }));

    const pitStops: PitStopRow[] = pitStopRows.rows.map((row: (typeof pitStopRows.rows)[number]) => ({
      driverNumber: row.driver_number,
      lapNumber: row.lap_number,
      stopDuration: row.stop_duration,
      laneDuration: row.lane_duration
    }));

    const telemetry: TelemetrySummaryRow[] = telemetryRows.rows.map((row: (typeof telemetryRows.rows)[number]) => ({
      driverNumber: row.driverNumber,
      topSpeed: row.topSpeed,
      avgSpeed: row.avgSpeed,
      avgThrottle: row.avgThrottle,
      avgRpm: row.avgRpm,
      carSamples: row.carSamples,
      locationSamples: row.locationSamples
    }));

    const generatedAt = new Date();
    const response: RaceAnalysisResponse = {
      sessionKey,
      drivers,
      laps,
      stints,
      pitStops,
      telemetry,
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

    await setCachedJson(cacheKey, config.CACHE_TTL_LEADERBOARD_SECONDS, response);
    return response;
  });
};
