"""Tests for ntfy_alerts dispatcher."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from custom_components.ntfy_alerts.dispatcher import (
    _condition_matches,
    _get_subscriber_topics,
    _check_cooldown,
    _render_template,
)


class FakeState:
    def __init__(self, state):
        self.state = state


def test_condition_matches_no_conditions():
    assert _condition_matches(None, None, FakeState("on")) is True
    assert _condition_matches({}, None, FakeState("on")) is True


def test_condition_matches_from_state():
    conditions = {"from_state": "off", "to_state": None}
    assert _condition_matches(conditions, FakeState("off"), FakeState("on")) is True
    assert _condition_matches(conditions, FakeState("closed"), FakeState("on")) is False


def test_condition_matches_to_state():
    conditions = {"from_state": None, "to_state": "on"}
    assert _condition_matches(conditions, FakeState("off"), FakeState("on")) is True
    assert _condition_matches(conditions, FakeState("off"), FakeState("off")) is False


def test_condition_matches_both():
    conditions = {"from_state": "off", "to_state": "on"}
    assert _condition_matches(conditions, FakeState("off"), FakeState("on")) is True
    assert _condition_matches(conditions, FakeState("off"), FakeState("off")) is False
    assert _condition_matches(conditions, FakeState("on"), FakeState("off")) is False


def test_get_subscriber_topics():
    config_data = {
        "users": {
            "user_1": {"name": "Jane", "topic": "ha_jane_test"},
            "user_2": {"name": "John", "topic": "ha_john_test"},
        }
    }
    topics = _get_subscriber_topics(config_data, ["user_1", "user_2"])
    assert topics == ["ha_jane_test", "ha_john_test"]


def test_get_subscriber_topics_empty_user():
    config_data = {"users": {"user_1": {"name": "Jane", "topic": ""}}}
    topics = _get_subscriber_topics(config_data, ["user_1"])
    assert topics == []


def test_get_subscriber_topics_missing_user():
    config_data = {"users": {}}
    topics = _get_subscriber_topics(config_data, ["nonexistent"])
    assert topics == []


def test_check_cooldown_first_time():
    hass = MagicMock()
    hass.data = {}
    assert _check_cooldown(hass, "rule_1", 60) is True


def test_check_cooldown_active():
    from datetime import datetime, timedelta, timezone
    hass = MagicMock()
    hass.data = {
        "ntfy_alerts.cooldowns": {
            "rule_1": datetime.now(timezone.utc) - timedelta(seconds=5),
        }
    }
    assert _check_cooldown(hass, "rule_1", 60) is False


def test_check_cooldown_expired():
    from datetime import datetime, timedelta, timezone
    hass = MagicMock()
    hass.data = {
        "ntfy_alerts.cooldowns": {
            "rule_1": datetime.now(timezone.utc) - timedelta(seconds=120),
        }
    }
    assert _check_cooldown(hass, "rule_1", 60) is True


def test_check_cooldown_disabled():
    hass = MagicMock()
    hass.data = {}
    assert _check_cooldown(hass, "rule_1", 0) is True


def test_render_template_simple(hass):
    result = _render_template(hass, "Hello {{ name }}", {"name": "World"})
    assert result == "Hello World"


def test_render_template_fallback(hass):
    result = _render_template(hass, "Hello {{ bad", {"name": "World"})
    assert result == "Hello {{ bad"
