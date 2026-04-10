from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SyncResult:
    endpoint: str
    rows_written: int
    batch_id: int
