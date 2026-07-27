"""Tests for ntfy_alerts config flow."""

from unittest.mock import MagicMock
import pytest

from custom_components.ntfy_alerts.const import DOMAIN, CONF_NTFY_BASE_TOPIC, CONF_NTFY_SERVER_URL
from custom_components.ntfy_alerts.config_flow import NtfyAlertsConfigFlow


@pytest.mark.asyncio
async def test_config_flow_show_form():
    """Test that initial step shows form."""
    flow = NtfyAlertsConfigFlow()
    flow.hass = MagicMock()
    result = await flow.async_step_user(user_input=None)
    assert result["type"] == "form"
    assert result["step_id"] == "user"


@pytest.mark.asyncio
async def test_config_flow_create_entry():
    """Test that valid input creates config entry."""
    flow = NtfyAlertsConfigFlow()
    flow.hass = MagicMock()
    flow.hass.config_entries = MagicMock()
    result = await flow.async_step_user(user_input={
        CONF_NTFY_BASE_TOPIC: "ha_test",
        CONF_NTFY_SERVER_URL: "https://ntfy.sh",
        "auth_token": "",
    })
    assert result["type"] == "create_entry"
    assert result["data"][CONF_NTFY_BASE_TOPIC] == "ha_test"
    assert result["data"][CONF_NTFY_SERVER_URL] == "https://ntfy.sh"
    assert result["data"]["users"] == {}
