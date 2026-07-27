"""Config flow for ntfy_alerts integration."""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback

from .const import DOMAIN, CONF_NTFY_BASE_TOPIC, CONF_AUTH_TOKEN, CONF_USERS

_LOGGER = logging.getLogger(__name__)

STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_NTFY_BASE_TOPIC, default="ha_alerts"): str,
        vol.Optional(CONF_AUTH_TOKEN, default=""): str,
    }
)


class NtfyAlertsConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for ntfy Alerts."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step."""
        if user_input is None:
            return self.async_show_form(
                step_id="user", data_schema=STEP_USER_DATA_SCHEMA
            )
        user_input[CONF_USERS] = {}
        return self.async_create_entry(title="ntfy Alerts", data=user_input)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return NtfyAlertsOptionsFlow(config_entry)


class NtfyAlertsOptionsFlow(config_entries.OptionsFlow):
    """Handle options flow for ntfy Alerts."""

    def __init__(self, config_entry):
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        """Manage options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        current = self.config_entry.data.get(CONF_USERS, {})
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Optional("add_user_name"): str,
                    vol.Optional("add_user_topic"): str,
                }
            ),
            description_placeholders={"current_users": str(current)},
        )
