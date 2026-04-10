from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from .database import Database
from .openf1_client import OpenF1Client
from .types import SyncResult


class SyncService:
    def __init__(self, database: Database, client: OpenF1Client) -> None:
        self.database = database
        self.client = client

    async def upsert_meetings_and_sessions(self, year: int) -> None:
        meetings, meetings_url = await self.client.fetch("meetings", {"year": year})
        meetings_batch_id = await self._store_raw_batch("meetings", None, meetings_url, meetings)
        await self.database.upsert_meetings(
            [
                {
                    "meeting_key": row["meeting_key"],
                    "meeting_name": row["meeting_name"],
                    "meeting_official_name": row.get("meeting_official_name"),
                    "country_name": row["country_name"],
                    "location": row.get("location"),
                    "circuit_short_name": row.get("circuit_short_name"),
                    "circuit_key": row.get("circuit_key"),
                    "circuit_image": row.get("circuit_image"),
                    "date_start": self._parse_datetime(row["date_start"]),
                    "date_end": self._parse_datetime(row["date_end"]),
                    "gmt_offset": row.get("gmt_offset"),
                    "year": row["year"],
                    "updated_at": datetime.now(UTC),
                }
                for row in meetings
            ]
        )
        await self._mark_batch_complete(meetings_batch_id, len(meetings))

        sessions, sessions_url = await self.client.fetch("sessions", {"year": year})
        sessions_batch_id = await self._store_raw_batch("sessions", None, sessions_url, sessions)
        await self.database.upsert_sessions(
            [
                {
                    "session_key": row["session_key"],
                    "meeting_key": row["meeting_key"],
                    "session_name": row["session_name"],
                    "session_type": row["session_type"],
                    "country_name": row["country_name"],
                    "location": row.get("location"),
                    "circuit_short_name": row.get("circuit_short_name"),
                    "date_start": self._parse_datetime(row["date_start"]),
                    "date_end": self._parse_datetime(row["date_end"]),
                    "gmt_offset": row.get("gmt_offset"),
                    "source_updated_at": datetime.now(UTC),
                    "updated_at": datetime.now(UTC),
                }
                for row in sessions
            ]
        )
        await self._mark_batch_complete(sessions_batch_id, len(sessions))

    async def sync_session_drivers(self, session_key: int) -> SyncResult:
        rows, request_url = await self.client.fetch("drivers", {"session_key": session_key})
        batch_id = await self._store_raw_batch("drivers", session_key, request_url, rows)
        await self.database.upsert_session_drivers(
            [
                {
                    "session_key": session_key,
                    "driver_number": row["driver_number"],
                    "broadcast_name": row.get("broadcast_name"),
                    "first_name": row.get("first_name"),
                    "last_name": row.get("last_name"),
                    "full_name": row["full_name"],
                    "name_acronym": row.get("name_acronym"),
                    "team_name": row.get("team_name"),
                    "team_colour": row.get("team_colour"),
                    "headshot_url": row.get("headshot_url"),
                    "country_code": row.get("country_code"),
                    "updated_at": datetime.now(UTC),
                }
                for row in rows
            ]
        )
        await self._mark_batch_complete(batch_id, len(rows))
        return SyncResult(endpoint="drivers", rows_written=len(rows), batch_id=batch_id)

    async def sync_weather(self, session_key: int) -> SyncResult:
        params = await self._watermark_params("weather", session_key)
        rows, request_url = await self.client.fetch("weather", {"session_key": session_key, **params})
        batch_id = await self._store_raw_batch("weather", session_key, request_url, rows)
        await self.database.upsert_weather_snapshots(
            [
                {
                    "session_key": session_key,
                    "date": self._parse_datetime(row["date"]),
                    "air_temperature": row.get("air_temperature"),
                    "track_temperature": row.get("track_temperature"),
                    "humidity": row.get("humidity"),
                    "rainfall": row.get("rainfall"),
                    "pressure": row.get("pressure"),
                    "wind_direction": row.get("wind_direction"),
                    "wind_speed": row.get("wind_speed"),
                    "fetched_at": datetime.now(UTC),
                }
                for row in rows
            ]
        )
        await self._finish_time_series_batch("weather", session_key, batch_id, rows)
        return SyncResult(endpoint="weather", rows_written=len(rows), batch_id=batch_id)

    async def sync_positions(self, session_key: int) -> SyncResult:
        params = await self._watermark_params("position", session_key)
        rows, request_url = await self.client.fetch("position", {"session_key": session_key, **params})
        batch_id = await self._store_raw_batch("position", session_key, request_url, rows)
        await self.database.upsert_position_snapshots(
            [
                {
                    "session_key": session_key,
                    "driver_number": row["driver_number"],
                    "position": row["position"],
                    "date": self._parse_datetime(row["date"]),
                    "fetched_at": datetime.now(UTC),
                }
                for row in rows
            ]
        )
        await self._finish_time_series_batch("position", session_key, batch_id, rows)
        return SyncResult(endpoint="position", rows_written=len(rows), batch_id=batch_id)

    async def sync_intervals(self, session_key: int) -> SyncResult:
        params = await self._watermark_params("intervals", session_key)
        rows, request_url = await self.client.fetch("intervals", {"session_key": session_key, **params})
        batch_id = await self._store_raw_batch("intervals", session_key, request_url, rows)
        await self.database.upsert_interval_snapshots(
            [
                {
                    "session_key": session_key,
                    "driver_number": row["driver_number"],
                    "interval": row.get("interval"),
                    "gap_to_leader": row.get("gap_to_leader"),
                    "date": self._parse_datetime(row["date"]),
                    "fetched_at": datetime.now(UTC),
                }
                for row in rows
            ]
        )
        await self._finish_time_series_batch("intervals", session_key, batch_id, rows)
        return SyncResult(endpoint="intervals", rows_written=len(rows), batch_id=batch_id)

    async def sync_race_control(self, session_key: int) -> SyncResult:
        params = await self._watermark_params("race_control", session_key)
        rows, request_url = await self.client.fetch("race_control", {"session_key": session_key, **params})
        batch_id = await self._store_raw_batch("race_control", session_key, request_url, rows)
        await self.database.upsert_race_control_events(
            [
                {
                    "session_key": session_key,
                    "date": self._parse_datetime(row["date"]),
                    "category": row["category"],
                    "flag": row.get("flag"),
                    "scope": row.get("scope"),
                    "message": row["message"],
                    "lap_number": row.get("lap_number"),
                    "driver_number": row.get("driver_number"),
                    "sector": row.get("sector"),
                    "fetched_at": datetime.now(UTC),
                }
                for row in rows
            ]
        )
        await self._finish_time_series_batch("race_control", session_key, batch_id, rows)
        return SyncResult(endpoint="race_control", rows_written=len(rows), batch_id=batch_id)

    async def sync_laps(self, session_key: int) -> SyncResult:
        rows, request_url = await self.client.fetch("laps", {"session_key": session_key})
        batch_id = await self._store_raw_batch("laps", session_key, request_url, rows)
        await self.database.upsert_laps(
            [
                {
                    "session_key": session_key,
                    "driver_number": row["driver_number"],
                    "lap_number": row["lap_number"],
                    "date_start": self._parse_datetime(row["date_start"]) if row.get("date_start") else None,
                    "lap_duration": row.get("lap_duration"),
                    "duration_sector_1": row.get("duration_sector_1"),
                    "duration_sector_2": row.get("duration_sector_2"),
                    "duration_sector_3": row.get("duration_sector_3"),
                    "i1_speed": row.get("i1_speed"),
                    "i2_speed": row.get("i2_speed"),
                    "st_speed": row.get("st_speed"),
                    "is_pit_out_lap": row.get("is_pit_out_lap"),
                    "fetched_at": datetime.now(UTC),
                }
                for row in rows
            ]
        )
        await self._mark_batch_complete(batch_id, len(rows))
        return SyncResult(endpoint="laps", rows_written=len(rows), batch_id=batch_id)

    async def sync_stints(self, session_key: int) -> SyncResult:
        rows, request_url = await self.client.fetch("stints", {"session_key": session_key})
        batch_id = await self._store_raw_batch("stints", session_key, request_url, rows)
        await self.database.upsert_stints(
            [
                {
                    "session_key": session_key,
                    "driver_number": row["driver_number"],
                    "stint_number": row["stint_number"],
                    "compound": row.get("compound"),
                    "lap_start": row.get("lap_start"),
                    "lap_end": row.get("lap_end"),
                    "tyre_age_at_start": row.get("tyre_age_at_start"),
                    "fetched_at": datetime.now(UTC),
                }
                for row in rows
            ]
        )
        await self._mark_batch_complete(batch_id, len(rows))
        return SyncResult(endpoint="stints", rows_written=len(rows), batch_id=batch_id)

    async def sync_pit(self, session_key: int) -> SyncResult:
        rows, request_url = await self.client.fetch("pit", {"session_key": session_key})
        batch_id = await self._store_raw_batch("pit", session_key, request_url, rows)
        await self.database.upsert_pit_stops(
            [
                {
                    "session_key": session_key,
                    "driver_number": row["driver_number"],
                    "lap_number": row["lap_number"],
                    "date": self._parse_datetime(row["date"]),
                    "lane_duration": row.get("lane_duration"),
                    "stop_duration": row.get("stop_duration"),
                    "fetched_at": datetime.now(UTC),
                }
                for row in rows
            ]
        )
        await self._finish_time_series_batch("pit", session_key, batch_id, rows)
        return SyncResult(endpoint="pit", rows_written=len(rows), batch_id=batch_id)

    async def sync_session_results(self, session_key: int) -> SyncResult:
        rows, request_url = await self.client.fetch("session_result", {"session_key": session_key})
        batch_id = await self._store_raw_batch("session_result", session_key, request_url, rows)
        await self.database.upsert_session_results(
            [
                {
                    "session_key": session_key,
                    "driver_number": row["driver_number"],
                    "position": row.get("position"),
                    "duration": row.get("duration"),
                    "gap_to_leader": row.get("gap_to_leader"),
                    "number_of_laps": row.get("number_of_laps"),
                    "dnf": row.get("dnf"),
                    "dns": row.get("dns"),
                    "dsq": row.get("dsq"),
                    "fetched_at": datetime.now(UTC),
                }
                for row in rows
            ]
        )
        await self._mark_batch_complete(batch_id, len(rows))
        return SyncResult(endpoint="session_result", rows_written=len(rows), batch_id=batch_id)

    async def _watermark_params(self, endpoint: str, session_key: int) -> dict[str, str]:
        watermark = await self.database.get_watermark(endpoint, session_key)
        if watermark is None:
            return {}
        return {"date>": watermark.isoformat()}

    async def _finish_time_series_batch(
        self,
        endpoint: str,
        session_key: int,
        batch_id: int,
        rows: list[dict[str, Any]]
    ) -> None:
        await self._mark_batch_complete(batch_id, len(rows))
        latest = None
        for row in rows:
            if row.get("date"):
                candidate = self._parse_datetime(row["date"])
                latest = candidate if latest is None or candidate > latest else latest
        await self.database.upsert_watermark(endpoint, session_key, latest, batch_id)

    async def _store_raw_batch(
        self,
        endpoint: str,
        session_key: int | None,
        request_url: str,
        rows: list[dict[str, Any]]
    ) -> int:
        payload_hash = str(hash(json.dumps(rows, sort_keys=True, default=str)))
        return await self.database.store_raw_batch(endpoint, session_key, request_url, payload_hash, rows)

    async def _mark_batch_complete(self, batch_id: int, item_count: int) -> None:
        await self.database.mark_batch_complete(batch_id, item_count)

    @staticmethod
    def _parse_datetime(value: str) -> datetime:
        normalized = value.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized).astimezone(UTC)
