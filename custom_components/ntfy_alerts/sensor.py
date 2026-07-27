"""Status sensor for ntfy_alerts integration."""

from __future__ import annotations

import logging
from datetime import datetime

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, SENSOR_UNIQUE_ID
from .rule_store import async_load_rules

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    async_add_entities([NtfyAlertsStatusSensor(hass, config_entry)])


class NtfyAlertsStatusSensor(SensorEntity):
    _attr_has_entity_name = True
    _attr_icon = "mdi:bell-ring"

    def __init__(self, hass: HomeAssistant, config_entry: ConfigEntry) -> None:
        self.hass = hass
        self._config_entry = config_entry
        self._attr_unique_id = f"{SENSOR_UNIQUE_ID}_{config_entry.entry_id}"
        self._attr_name = "ntfy Alerts Status"
        self._attr_native_value = "active"

    async def async_update(self) -> None:
        sensor_data = self.hass.data.get(f"{DOMAIN}_sensor", {})
        rules = await async_load_rules(self.hass)
        enabled_rules = [r for r in rules if r.get("enabled", True)]
        self._attr_native_value = "active"
        self._attr_extra_state_attributes = {
            "total_sent": sensor_data.get("total_sent", 0),
            "last_sent": sensor_data.get("last_sent"),
            "last_error": sensor_data.get("last_error"),
            "rules_count": len(rules),
            "enabled_rules_count": len(enabled_rules),
        }
