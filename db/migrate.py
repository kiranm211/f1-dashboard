from __future__ import annotations

import asyncio
from pathlib import Path
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = ROOT / "db" / "migrations"
sys.path.insert(0, str(ROOT))

from apps.worker.src.config import settings


def split_sql_statements(sql_text: str) -> list[str]:
    statements: list[str] = []
    buffer: list[str] = []
    in_single_quote = False
    in_double_quote = False

    for char in sql_text:
        if char == "'" and not in_double_quote:
            in_single_quote = not in_single_quote
        elif char == '"' and not in_single_quote:
            in_double_quote = not in_double_quote

        if char == ";" and not in_single_quote and not in_double_quote:
            statement = "".join(buffer).strip()
            if statement:
                statements.append(statement)
            buffer = []
            continue

        buffer.append(char)

    tail = "".join(buffer).strip()
    if tail:
        statements.append(tail)
    return statements


async def run() -> None:
    engine = create_async_engine(
        settings.postgres_dsn.replace("postgresql://", "postgresql+asyncpg://"),
        future=True,
    )

    async with engine.begin() as connection:
        await connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version TEXT PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        )

        result = await connection.execute(text("SELECT version FROM schema_migrations"))
        applied_versions = {row[0] for row in result.fetchall()}

        for migration_path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            version = migration_path.name
            if version in applied_versions:
                continue

            sql_text = migration_path.read_text(encoding="utf-8")
            for statement in split_sql_statements(sql_text):
                await connection.execute(text(statement))

            await connection.execute(
                text("INSERT INTO schema_migrations (version) VALUES (:version)"),
                {"version": version},
            )
            print(f"applied {version}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
