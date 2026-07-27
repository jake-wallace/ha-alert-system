"""Pytest fixtures for ntfy_alerts tests."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture
def hass():
    """Provide a mock HomeAssistant instance."""
    hass = MagicMock()
    hass.data = {}
    hass.config_entries = MagicMock()
    return hass


@pytest.fixture
def config_entry():
    """Provide a mock ConfigEntry."""
    entry = MagicMock()
    entry.entry_id = "test_entry_id"
    entry.data = {
        "ntfy_base_topic": "ha_test",
        "auth_token": "",
        "users": {
            "user_1": {"name": "Jane", "topic": "ha_jane_test"},
            "user_2": {"name": "John", "topic": "ha_john_test"},
        },
    }
    return entry
