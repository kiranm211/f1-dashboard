from __future__ import annotations

import logging

from redis.asyncio import Redis

from .config import settings

logger = logging.getLogger("f1-dashboard-worker.cache")

SESSIONS_RELATED_ENDPOINTS = {"meetings", "sessions", "drivers"}
LEADERBOARD_RELATED_ENDPOINTS = {
    "drivers",
    "position",
    "intervals",
    "pit",
    "stints",
    "laps",
    "session_result",
    "car_data",
    "location",
    "team_radio",
    "overtakes",
    "starting_grid",
    "championship_drivers",
    "championship_teams",
}


class CacheInvalidator:
    def __init__(self) -> None:
        self.enabled = settings.worker_cache_invalidation_enabled
        self.redis: Redis | None = None
        self._connected = False

    async def connect(self) -> None:
        if not self.enabled:
            return
        try:
            self.redis = Redis.from_url(settings.redis_url, decode_responses=True)
            await self.redis.ping()
            self._connected = True
        except Exception as error:
            logger.warning("cache invalidator disabled, redis unavailable: %s", error)
            self.redis = None
            self._connected = False

    async def close(self) -> None:
        if self.redis is not None:
            await self.redis.aclose()
        self.redis = None
        self._connected = False

    async def invalidate_after_sync(self, endpoint: str, session_key: int) -> None:
        if not self.enabled or not self._connected or self.redis is None:
            return

        patterns = self._patterns_for(endpoint, session_key)
        for pattern in patterns:
            try:
                async for key in self.redis.scan_iter(match=pattern):
                    await self.redis.delete(key)
            except Exception as error:
                logger.warning("cache invalidation error for pattern %s: %s", pattern, error)

    @staticmethod
    def _patterns_for(endpoint: str, session_key: int) -> list[str]:
        patterns: list[str] = []

        if endpoint in SESSIONS_RELATED_ENDPOINTS:
            patterns.append("f1-dashboard:sessions:*")

        if endpoint in LEADERBOARD_RELATED_ENDPOINTS:
            patterns.append(f"f1-dashboard:leaderboard:*sessionKey={session_key}*")

        return patterns
