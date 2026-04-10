import { pgEnum, pgTable, pgView, text, integer, timestamp, doublePrecision } from "drizzle-orm/pg-core";

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
