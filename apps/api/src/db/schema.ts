import { pgEnum, pgTable, pgView, text, integer, timestamp, doublePrecision, boolean } from "drizzle-orm/pg-core";

export const sessionStateEnum = pgEnum("session_state", ["scheduled", "warmup", "live", "cooldown", "closed"]);

export const meetings = pgTable("meetings", {
  meetingKey: integer("meeting_key").primaryKey(),
  meetingName: text("meeting_name").notNull(),
  meetingOfficialName: text("meeting_official_name"),
  countryName: text("country_name").notNull(),
  location: text("location"),
  circuitShortName: text("circuit_short_name"),
  circuitKey: integer("circuit_key"),
  circuitImage: text("circuit_image"),
  dateStart: timestamp("date_start", { withTimezone: true }).notNull(),
  dateEnd: timestamp("date_end", { withTimezone: true }).notNull(),
  gmtOffset: text("gmt_offset"),
  year: integer("year").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const sessions = pgTable("sessions", {
  sessionKey: integer("session_key").primaryKey(),
  meetingKey: integer("meeting_key").notNull(),
  sessionName: text("session_name").notNull(),
  sessionType: text("session_type").notNull(),
  countryName: text("country_name").notNull(),
  location: text("location"),
  circuitShortName: text("circuit_short_name"),
  dateStart: timestamp("date_start", { withTimezone: true }).notNull(),
  dateEnd: timestamp("date_end", { withTimezone: true }).notNull(),
  gmtOffset: text("gmt_offset"),
  currentState: sessionStateEnum("current_state").notNull(),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const sessionDrivers = pgTable("session_drivers", {
  sessionKey: integer("session_key").notNull(),
  driverNumber: integer("driver_number").notNull(),
  broadcastName: text("broadcast_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  fullName: text("full_name").notNull(),
  nameAcronym: text("name_acronym"),
  teamName: text("team_name"),
  teamColour: text("team_colour"),
  headshotUrl: text("headshot_url"),
  countryCode: text("country_code"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const sessionResults = pgTable("session_results", {
  sessionKey: integer("session_key").notNull(),
  driverNumber: integer("driver_number").notNull(),
  position: integer("position"),
  numberOfLaps: integer("number_of_laps"),
  dnf: boolean("dnf"),
  dns: boolean("dns"),
  dsq: boolean("dsq"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull()
});

export const circuitFacts = pgTable("circuit_facts", {
  circuitKey: integer("circuit_key"),
  circuitShortName: text("circuit_short_name").primaryKey(),
  canonicalName: text("canonical_name").notNull(),
  trackLengthKm: text("track_length_km").notNull(),
  raceDistanceKm: text("race_distance_km").notNull(),
  laps: integer("laps").notNull(),
  turns: integer("turns").notNull(),
  firstGrandPrix: integer("first_grand_prix").notNull(),
  direction: text("direction").notNull(),
  drsZones: integer("drs_zones").notNull(),
  lapRecord: text("lap_record").notNull(),
  lapRecordHolder: text("lap_record_holder").notNull(),
  lapRecordYear: integer("lap_record_year").notNull(),
  overtakingHotspot: text("overtaking_hotspot").notNull(),
  quickFact: text("quick_fact").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const driverFacts = pgTable("driver_facts", {
  driverNumber: integer("driver_number").primaryKey(),
  fullName: text("full_name").notNull(),
  nationality: text("nationality").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  placeOfBirth: text("place_of_birth").notNull(),
  debutSeason: integer("debut_season").notNull(),
  juniorCareerHighlight: text("junior_career_highlight").notNull(),
  factHeadline: text("fact_headline").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const currentLeaderboard = pgView("current_leaderboard", {
  sessionKey: integer("session_key"),
  driverNumber: integer("driver_number"),
  position: integer("position"),
  date: timestamp("date", { withTimezone: true }),
  fullName: text("full_name"),
  nameAcronym: text("name_acronym"),
  teamName: text("team_name"),
  teamColour: text("team_colour"),
  interval: doublePrecision("interval"),
  gapToLeader: text("gap_to_leader")
}).existing();
