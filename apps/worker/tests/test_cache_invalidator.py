from __future__ import annotations

from src.cache_invalidator import CacheInvalidator


def test_patterns_for_sessions_related_endpoint() -> None:
    patterns = CacheInvalidator._patterns_for("drivers", 9159)

    assert "f1-dashboard:sessions:*" in patterns
    assert "f1-dashboard:leaderboard:*sessionKey=9159*" in patterns


def test_patterns_for_leaderboard_only_endpoint() -> None:
    patterns = CacheInvalidator._patterns_for("position", 9159)

    assert "f1-dashboard:sessions:*" not in patterns
    assert "f1-dashboard:leaderboard:*sessionKey=9159*" in patterns


def test_patterns_for_unrelated_endpoint() -> None:
    patterns = CacheInvalidator._patterns_for("weather", 9159)

    assert patterns == []
