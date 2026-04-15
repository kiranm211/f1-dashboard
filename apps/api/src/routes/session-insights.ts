import type { FastifyPluginAsync } from "fastify";

import { sql } from "drizzle-orm";
import { z } from "zod";

import { buildCacheKey, getCachedJson, setCachedJson } from "../cache.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import type { ApiMeta } from "../types.js";

const querySchema = z.object({
  sessionKey: z.coerce.number().int().positive(),
  eventsLimit: z.coerce.number().int().min(1).max(5000).default(500)
});

type WeatherSnapshot = {
  date: string;
  airTemperature: number | null;
  trackTemperature: number | null;
  humidity: number | null;
  rainfall: number | null;
  pressure: number | null;
  windDirection: number | null;
  windSpeed: number | null;
};

type SessionResultEntry = {
  driverNumber: number;
  position: number | null;
  numberOfLaps: number | null;
  dnf: boolean | null;
  dns: boolean | null;
  dsq: boolean | null;
  fullName: string | null;
  nameAcronym: string | null;
  teamName: string | null;
};

type RaceControlEvent = {
  date: string;
  category: string;
  flag: string | null;
  scope: string | null;
  message: string;
  lapNumber: number | null;
  driverNumber: number | null;
  sector: number | null;
};

type TeamRadioEvent = {
  date: string;
  driverNumber: number;
  recordingUrl: string;
};

type OvertakeEvent = {
  date: string;
  overtakingDriverNumber: number;
  overtakenDriverNumber: number;
  position: number;
};

type StartingGridEntry = {
  driverNumber: number;
  position: number | null;
  lapDuration: number | null;
  fullName: string | null;
  nameAcronym: string | null;
  teamName: string | null;
};

type PitStopEvent = {
  date: string;
  driverNumber: number;
  lapNumber: number;
  laneDuration: number | null;
  stopDuration: number | null;
};

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

function toMsOrNull(value: unknown): number | null {
  const iso = toIsoOrNull(value);
  return iso ? new Date(iso).getTime() : null;
}

export const sessionInsightsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/session-insights", async (request, reply) => {
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

    const cacheKey = buildCacheKey("session-insights", query);
    const cached = await getCachedJson<{
      sessionKey: number;
      weather: WeatherSnapshot | null;
      weatherHistory: WeatherSnapshot[];
      raceControl: RaceControlEvent[];
      pitStops: PitStopEvent[];
      teamRadio: TeamRadioEvent[];
      overtakes: OvertakeEvent[];
      startingGrid: StartingGridEntry[];
      sessionResults: SessionResultEntry[];
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

    const [weatherRows, raceControlRows, pitStopRows, teamRadioRows, overtakeRows, startingGridRows, sessionResultRows] = await Promise.all([
      db.execute<{
        date: unknown;
        airTemperature: number | null;
        trackTemperature: number | null;
        humidity: number | null;
        rainfall: number | null;
        pressure: number | null;
        windDirection: number | null;
        windSpeed: number | null;
        fetchedAt: unknown;
      }>(sql`
      select
        date,
        air_temperature as "airTemperature",
        track_temperature as "trackTemperature",
        humidity,
        rainfall,
        pressure,
        wind_direction as "windDirection",
        wind_speed as "windSpeed",
        fetched_at as "fetchedAt"
      from weather_snapshots
      where session_key = ${query.sessionKey}
      order by date desc
      limit ${query.eventsLimit}
      `),
      db.execute<{
        date: unknown;
        category: string;
        flag: string | null;
        scope: string | null;
        message: string;
        lapNumber: number | null;
        driverNumber: number | null;
        sector: number | null;
        fetchedAt: unknown;
      }>(sql`
      select
        date,
        category,
        flag,
        scope,
        message,
        lap_number as "lapNumber",
        driver_number as "driverNumber",
        sector,
        fetched_at as "fetchedAt"
      from race_control_events
      where session_key = ${query.sessionKey}
      order by date desc
      limit ${query.eventsLimit}
      `),
      db.execute<{
        date: unknown;
        driverNumber: number;
        lapNumber: number;
        laneDuration: number | null;
        stopDuration: number | null;
        fetchedAt: unknown;
      }>(sql`
      select
        date,
        driver_number as "driverNumber",
        lap_number as "lapNumber",
        lane_duration as "laneDuration",
        stop_duration as "stopDuration",
        fetched_at as "fetchedAt"
      from pit_stops
      where session_key = ${query.sessionKey}
      order by date desc
      limit ${query.eventsLimit}
      `),
      db.execute<{
        date: unknown;
        driverNumber: number;
        recordingUrl: string;
        fetchedAt: unknown;
      }>(sql`
      select
        date,
        driver_number as "driverNumber",
        recording_url as "recordingUrl",
        fetched_at as "fetchedAt"
      from team_radio_messages
      where session_key = ${query.sessionKey}
      order by date desc
      limit ${query.eventsLimit}
      `),
      db.execute<{
        date: unknown;
        overtakingDriverNumber: number;
        overtakenDriverNumber: number;
        position: number;
        fetchedAt: unknown;
      }>(sql`
      select
        date,
        overtaking_driver_number as "overtakingDriverNumber",
        overtaken_driver_number as "overtakenDriverNumber",
        position,
        fetched_at as "fetchedAt"
      from overtakes
      where session_key = ${query.sessionKey}
      order by date desc
      limit ${query.eventsLimit}
      `),
      db.execute<{
        driverNumber: number;
        position: number | null;
        lapDuration: number | null;
        fullName: string | null;
        nameAcronym: string | null;
        teamName: string | null;
        fetchedAt: unknown;
      }>(sql`
      select
        sg.driver_number as "driverNumber",
        sg.position,
        sg.lap_duration as "lapDuration",
        sd.full_name as "fullName",
        sd.name_acronym as "nameAcronym",
        sd.team_name as "teamName",
        sg.fetched_at as "fetchedAt"
      from starting_grid sg
      left join session_drivers sd
        on sd.session_key = sg.session_key
       and sd.driver_number = sg.driver_number
      where sg.session_key = ${query.sessionKey}
      order by sg.position asc nulls last, sg.driver_number asc
      `),
      db.execute<{
        driverNumber: number;
        position: number | null;
        numberOfLaps: number | null;
        dnf: boolean | null;
        dns: boolean | null;
        dsq: boolean | null;
        fullName: string | null;
        nameAcronym: string | null;
        teamName: string | null;
      }>(sql`
      select
        sr.driver_number as "driverNumber",
        sr.position,
        sr.number_of_laps as "numberOfLaps",
        sr.dnf,
        sr.dns,
        sr.dsq,
        sd.full_name as "fullName",
        sd.name_acronym as "nameAcronym",
        sd.team_name as "teamName"
      from session_results sr
      left join session_drivers sd
        on sd.session_key = sr.session_key
       and sd.driver_number = sr.driver_number
      where sr.session_key = ${query.sessionKey}
      order by sr.position asc nulls last, sr.driver_number asc
      `)
    ]);

    const weather = weatherRows.rows[0]
      ? {
          date: toIsoOrNull(weatherRows.rows[0].date) ?? new Date().toISOString(),
          airTemperature: weatherRows.rows[0].airTemperature,
          trackTemperature: weatherRows.rows[0].trackTemperature,
          humidity: weatherRows.rows[0].humidity,
          rainfall: weatherRows.rows[0].rainfall,
          pressure: weatherRows.rows[0].pressure,
          windDirection: weatherRows.rows[0].windDirection,
          windSpeed: weatherRows.rows[0].windSpeed
        }
      : null;

    const weatherHistory = weatherRows.rows.map((row: (typeof weatherRows.rows)[number]) => ({
      date: toIsoOrNull(row.date) ?? new Date().toISOString(),
      airTemperature: row.airTemperature,
      trackTemperature: row.trackTemperature,
      humidity: row.humidity,
      rainfall: row.rainfall,
      pressure: row.pressure,
      windDirection: row.windDirection,
      windSpeed: row.windSpeed
    }));

    const raceControl = raceControlRows.rows.map((row: (typeof raceControlRows.rows)[number]) => ({
      date: toIsoOrNull(row.date) ?? new Date().toISOString(),
      category: row.category,
      flag: row.flag,
      scope: row.scope,
      message: row.message,
      lapNumber: row.lapNumber,
      driverNumber: row.driverNumber,
      sector: row.sector
    }));

    const pitStops = pitStopRows.rows.map((row: (typeof pitStopRows.rows)[number]) => ({
      date: toIsoOrNull(row.date) ?? new Date().toISOString(),
      driverNumber: row.driverNumber,
      lapNumber: row.lapNumber,
      laneDuration: row.laneDuration,
      stopDuration: row.stopDuration
    }));

    const teamRadio = teamRadioRows.rows.map((row: (typeof teamRadioRows.rows)[number]) => ({
      date: toIsoOrNull(row.date) ?? new Date().toISOString(),
      driverNumber: row.driverNumber,
      recordingUrl: row.recordingUrl
    }));

    const overtakes = overtakeRows.rows.map((row: (typeof overtakeRows.rows)[number]) => ({
      date: toIsoOrNull(row.date) ?? new Date().toISOString(),
      overtakingDriverNumber: row.overtakingDriverNumber,
      overtakenDriverNumber: row.overtakenDriverNumber,
      position: row.position
    }));

    const startingGrid = startingGridRows.rows.map((row: (typeof startingGridRows.rows)[number]) => ({
      driverNumber: row.driverNumber,
      position: row.position,
      lapDuration: row.lapDuration,
      fullName: row.fullName,
      nameAcronym: row.nameAcronym,
      teamName: row.teamName
    }));

    const sessionResults = sessionResultRows.rows.map((row: (typeof sessionResultRows.rows)[number]) => ({
      driverNumber: row.driverNumber,
      position: row.position,
      numberOfLaps: row.numberOfLaps,
      dnf: row.dnf,
      dns: row.dns,
      dsq: row.dsq,
      fullName: row.fullName,
      nameAcronym: row.nameAcronym,
      teamName: row.teamName
    }));

    const generatedAt = new Date();
    const weatherSyncAt = weatherRows.rows[0]?.fetchedAt ?? null;
    const controlSyncAt = raceControlRows.rows[0]?.fetchedAt ?? null;
    const pitStopSyncAt = pitStopRows.rows[0]?.fetchedAt ?? null;
    const teamRadioSyncAt = teamRadioRows.rows[0]?.fetchedAt ?? null;
    const overtakeSyncAt = overtakeRows.rows[0]?.fetchedAt ?? null;
    const startingGridSyncAt = startingGridRows.rows[0]?.fetchedAt ?? null;
    const latestSyncAtCandidates = [weatherSyncAt, controlSyncAt, pitStopSyncAt, teamRadioSyncAt, overtakeSyncAt, startingGridSyncAt]
      .map((value: unknown) => toMsOrNull(value))
      .filter((value: number | null): value is number => value !== null);
    const latestSyncAt = latestSyncAtCandidates.length > 0 ? new Date(Math.max(...latestSyncAtCandidates)) : null;
    const stalenessMs = latestSyncAt ? Math.max(generatedAt.getTime() - latestSyncAt.getTime(), 0) : null;

    const response = {
      sessionKey: query.sessionKey,
      weather,
      weatherHistory,
      raceControl,
      pitStops,
      teamRadio,
      overtakes,
      startingGrid,
      sessionResults,
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
