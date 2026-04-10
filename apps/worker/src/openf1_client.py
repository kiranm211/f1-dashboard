from __future__ import annotations

import asyncio
import random
from typing import Any

import httpx

from .config import settings


class OpenF1Client:
    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=settings.openf1_base_url,
            timeout=settings.openf1_request_timeout_seconds,
            limits=httpx.Limits(max_connections=settings.openf1_max_concurrency)
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def fetch(self, endpoint: str, params: dict[str, Any] | None = None) -> tuple[list[dict[str, Any]], str]:
        attempts = max(1, settings.openf1_retry_max_attempts)

        for attempt in range(1, attempts + 1):
            response = await self._client.get(f"/{endpoint}", params=params)

            if response.status_code in (429, 500, 502, 503, 504) and attempt < attempts:
                delay = self._compute_retry_delay(response, attempt)
                await asyncio.sleep(delay)
                continue

            response.raise_for_status()
            payload = response.json()

            if not isinstance(payload, list):
                raise ValueError(f"Unexpected response type for {endpoint}: {type(payload)!r}")

            return payload, str(response.request.url)

        raise RuntimeError(f"failed to fetch endpoint {endpoint} after retries")

    def _compute_retry_delay(self, response: httpx.Response, attempt: int) -> float:
        retry_after_header = response.headers.get("Retry-After")
        if retry_after_header:
            try:
                retry_after_seconds = float(retry_after_header)
                return min(retry_after_seconds, settings.openf1_retry_max_delay_seconds)
            except ValueError:
                pass

        exponential = settings.openf1_retry_base_delay_seconds * (2 ** (attempt - 1))
        jitter = random.uniform(0, 0.25 * settings.openf1_retry_base_delay_seconds)
        return min(exponential + jitter, settings.openf1_retry_max_delay_seconds)
