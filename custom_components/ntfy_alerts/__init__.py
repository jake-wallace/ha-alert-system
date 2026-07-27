"""ntfy Alerts integration for Home Assistant."""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.components.websocket_api import decorators, async_register_command
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_STATE_CHANGED
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, ServiceCall, callback
from homeassistant.helpers import config_validation as cv

from .const import (
    ATTR_CONDITIONS,
    ATTR_COOLDOWN,
    ATTR_ENABLED,
    ATTR_ENTITY_ID,
    ATTR_MESSAGE,
    ATTR_NAME,
    ATTR_SUBSCRIBERS,
    DOMAIN,
    EVENT_LISTENER_KEY,
)
from .dispatcher import async_handle_state_change
from .rule_store import (
    async_add_rule,
    async_delete_rule,
    async_get_rule,
    async_load_rules,
    async_update_rule,
)

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor"]

SERVICE_RELOAD_RULES = "reload_rules"

RULE_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_NAME): str,
        vol.Required(ATTR_ENTITY_ID): str,
        vol.Optional(ATTR_CONDITIONS, default={}): dict,
        vol.Optional(ATTR_SUBSCRIBERS, default=[]): list,
        vol.Optional(ATTR_MESSAGE, default={}): dict,
        vol.Optional(ATTR_ENABLED, default=True): bool,
        vol.Optional(ATTR_COOLDOWN, default=60): int,
    }
)

WS_TYPE_GET_RULES = "ntfy_alerts/get_rules"
WS_TYPE_SAVE_RULE = "ntfy_alerts/save_rule"
WS_TYPE_UPDATE_RULE = "ntfy_alerts/update_rule"
WS_TYPE_DELETE_RULE = "ntfy_alerts/delete_rule"
WS_TYPE_ADD_USER = "ntfy_alerts/add_user"
WS_TYPE_REMOVE_USER = "ntfy_alerts/remove_user"

SCHEMA_WS_GET_RULES = websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend(
    {vol.Required("type"): WS_TYPE_GET_RULES}
)
SCHEMA_WS_SAVE_RULE = websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend(
    {vol.Required("type"): WS_TYPE_SAVE_RULE, vol.Required("rule"): RULE_SCHEMA}
)
SCHEMA_WS_UPDATE_RULE = websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend(
    {
        vol.Required("type"): WS_TYPE_UPDATE_RULE,
        vol.Required("rule_id"): str,
        vol.Required("updates"): dict,
    }
)
SCHEMA_WS_DELETE_RULE = websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend(
    {vol.Required("type"): WS_TYPE_DELETE_RULE, vol.Required("rule_id"): str}
)
SCHEMA_WS_ADD_USER = websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend(
    {
        vol.Required("type"): WS_TYPE_ADD_USER,
        vol.Required("name"): str,
        vol.Required("topic"): str,
    }
)
SCHEMA_WS_REMOVE_USER = websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend(
    {
        vol.Required("type"): WS_TYPE_REMOVE_USER,
        vol.Required("user_id"): str,
    }
)


@callback
def _async_get_rules(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    hass.async_create_task(
        _async_handle_get_rules(hass, connection, msg)
    )


async def _async_handle_get_rules(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    rules = await async_load_rules(hass)
    connection.send_result(msg["id"], {"rules": rules})


@callback
def _async_save_rule(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    hass.async_create_task(
        _async_handle_save_rule(hass, connection, msg)
    )


async def _async_handle_save_rule(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    rule_id = await async_add_rule(hass, msg["rule"])
    connection.send_result(msg["id"], {"rule_id": rule_id})


@callback
def _async_update_rule(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    hass.async_create_task(
        _async_handle_update_rule(hass, connection, msg)
    )


async def _async_handle_update_rule(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    result = await async_update_rule(hass, msg["rule_id"], msg["updates"])
    connection.send_result(msg["id"], {"success": result})


@callback
def _async_delete_rule(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    hass.async_create_task(
        _async_handle_delete_rule(hass, connection, msg)
    )


async def _async_handle_delete_rule(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    result = await async_delete_rule(hass, msg["rule_id"])
    connection.send_result(msg["id"], {"success": result})


@callback
def _async_add_user(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    config = hass.data.get(DOMAIN, {}).get("config", {})
    users = dict(config.get("users", {}))
    user_id = f"user_{len(users) + 1}"
    users[user_id] = {"name": msg["name"], "topic": msg["topic"]}
    config["users"] = users
    entry_id = hass.data[DOMAIN]["entry_id"]
    entry = hass.config_entries.async_get_entry(entry_id)
    if entry:
        hass.config_entries.async_update_entry(
            entry, data=dict(entry.data, users=users)
        )
    connection.send_result(msg["id"], {"user_id": user_id})


@callback
def _async_remove_user(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    config = hass.data.get(DOMAIN, {}).get("config", {})
    users = dict(config.get("users", {}))
    users.pop(msg["user_id"], None)
    config["users"] = users
    entry_id = hass.data[DOMAIN]["entry_id"]
    entry = hass.config_entries.async_get_entry(entry_id)
    if entry:
        hass.config_entries.async_update_entry(
            entry, data=dict(entry.data, users=users)
        )
    connection.send_result(msg["id"], {"success": True})


@callback
def _async_state_changed_listener(
    hass: HomeAssistant,
    event: Event[EventStateChangedData],
) -> None:
    entity_id = event.data.get("entity_id")
    old_state = event.data.get("old_state")
    new_state = event.data.get("new_state")
    if new_state is None:
        return
    hass.async_create_task(
        async_handle_state_change(hass, old_state, new_state, entity_id)
    )


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})
    config = dict(entry.data)
    hass.data[DOMAIN] = {
        "config": config,
        "entry_id": entry.entry_id,
    }

    listener = hass.bus.async_listen(
        EVENT_STATE_CHANGED,
        lambda event: _async_state_changed_listener(hass, event),
    )
    hass.data[DOMAIN][EVENT_LISTENER_KEY] = listener

    async def _handle_reload_rules(call: ServiceCall) -> None:
        await async_load_rules(hass)

    hass.services.async_register(
        DOMAIN, SERVICE_RELOAD_RULES, _handle_reload_rules
    )

    async_register_command(hass, _async_get_rules, SCHEMA_WS_GET_RULES)
    async_register_command(hass, _async_save_rule, SCHEMA_WS_SAVE_RULE)
    async_register_command(hass, _async_update_rule, SCHEMA_WS_UPDATE_RULE)
    async_register_command(hass, _async_delete_rule, SCHEMA_WS_DELETE_RULE)
    async_register_command(hass, _async_add_user, SCHEMA_WS_ADD_USER)
    async_register_command(hass, _async_remove_user, SCHEMA_WS_REMOVE_USER)

    hass.http.register_static_path(
        "/ntfy_alerts_card",
        hass.config.path("custom_components/ntfy_alerts/frontend"),
        cache_headers=False,
    )
    add_extra_js_url(
        hass,
        "/ntfy_alerts_card/ntfy-alerts-card.js",
    )

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        data = hass.data.get(DOMAIN, {})
        listener = data.get(EVENT_LISTENER_KEY)
        if listener:
            listener()
        hass.services.async_remove(DOMAIN, SERVICE_RELOAD_RULES)
        for ws_type in [
            WS_TYPE_GET_RULES,
            WS_TYPE_SAVE_RULE,
            WS_TYPE_UPDATE_RULE,
            WS_TYPE_DELETE_RULE,
            WS_TYPE_ADD_USER,
            WS_TYPE_REMOVE_USER,
        ]:
            hass.components.websocket_api.async_unregister_command(ws_type)
        hass.data.pop(DOMAIN, None)
    return unload_ok


async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    _LOGGER.debug("Migrating from version %s", entry.version)
    return True
