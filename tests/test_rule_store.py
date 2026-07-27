"""Tests for ntfy_alerts rule_store."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from custom_components.ntfy_alerts.rule_store import (
    async_load_rules,
    async_save_rules,
    async_add_rule,
    async_get_rule,
    async_update_rule,
    async_delete_rule,
)


@pytest.fixture
def mock_store():
    """Mock the Store to use in-memory storage."""
    with patch("custom_components.ntfy_alerts.rule_store.Store") as mock:
        instance = MagicMock()
        instance.async_load = AsyncMock(return_value=None)
        instance.async_save = AsyncMock()
        mock.return_value = instance
        yield instance


@pytest.mark.asyncio
async def test_load_rules_empty(hass, mock_store):
    """Test loading rules returns empty list when no storage."""
    mock_store.async_load.return_value = None
    rules = await async_load_rules(hass)
    assert rules == []


@pytest.mark.asyncio
async def test_add_and_get_rule(hass, mock_store):
    """Test adding a rule and retrieving it."""
    mock_store.async_load.return_value = None

    rule_data = {
        "name": "Front Door",
        "entity_id": "binary_sensor.front_door",
        "conditions": {"to_state": "on"},
        "subscribers": ["user_1"],
        "message": {"title": "Door", "body": "Door opened"},
        "enabled": True,
        "cooldown_seconds": 60,
    }
    rule_id = await async_add_rule(hass, rule_data)
    assert rule_id is not None
    assert len(rule_id) == 36  # UUID length

    saved = mock_store.async_save.call_args[0][0]
    assert len(saved["rules"]) == 1
    assert saved["rules"][0]["rule_id"] == rule_id


@pytest.mark.asyncio
async def test_update_rule(hass, mock_store):
    """Test updating an existing rule."""
    mock_store.async_load.return_value = {
        "rules": [{"rule_id": "abc-123", "name": "Old", "enabled": True}]
    }

    result = await async_update_rule(hass, "abc-123", {"name": "New", "enabled": False})
    assert result is True

    saved = mock_store.async_save.call_args[0][0]
    assert saved["rules"][0]["name"] == "New"
    assert saved["rules"][0]["enabled"] is False


@pytest.mark.asyncio
async def test_update_rule_not_found(hass, mock_store):
    """Test updating a non-existent rule returns False."""
    mock_store.async_load.return_value = {"rules": []}
    result = await async_update_rule(hass, "nonexistent", {"name": "Nope"})
    assert result is False


@pytest.mark.asyncio
async def test_delete_rule(hass, mock_store):
    """Test deleting a rule."""
    mock_store.async_load.return_value = {
        "rules": [
            {"rule_id": "abc-123", "name": "Rule 1"},
            {"rule_id": "def-456", "name": "Rule 2"},
        ]
    }
    result = await async_delete_rule(hass, "abc-123")
    assert result is True

    saved = mock_store.async_save.call_args[0][0]
    assert len(saved["rules"]) == 1
    assert saved["rules"][0]["rule_id"] == "def-456"


@pytest.mark.asyncio
async def test_delete_rule_not_found(hass, mock_store):
    """Test deleting a non-existent rule returns False."""
    mock_store.async_load.return_value = {"rules": []}
    result = await async_delete_rule(hass, "nonexistent")
    assert result is False
