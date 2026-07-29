"""ntfy Alerts integration for Home Assistant."""

from __future__ import annotations

import logging
import os
from typing import Any

import voluptuous as vol

from homeassistant.components import panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.components.websocket_api import (
    async_register_command,
    async_response,
    websocket_command,
)
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
from .dispatcher import (
    async_handle_state_change,
    async_send_test_notification,
    send_ntfy_notification,
)
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
WS_TYPE_SEND_TEST = "ntfy_alerts/send_test"


@websocket_command({vol.Required("type"): WS_TYPE_GET_RULES})
@async_response
async def async_get_rules(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    try:
        rules = await async_load_rules(hass)
        config = hass.data.get(DOMAIN, {}).get("config", {})
        users = config.get("users", {})
        connection.send_result(msg["id"], {"rules": rules, "users": users, "config": {"ntfy_base_topic": config.get("ntfy_base_topic", "")}})
    except Exception as err:
        _LOGGER.exception("Error in async_get_rules: %s", err)
        connection.send_error(msg["id"], "internal_error", str(err))


@websocket_command({vol.Required("type"): WS_TYPE_SAVE_RULE, vol.Required("rule"): RULE_SCHEMA})
@async_response
async def async_save_rule(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    rule_id = await async_add_rule(hass, msg["rule"])
    connection.send_result(msg["id"], {"rule_id": rule_id})


@websocket_command({
    vol.Required("type"): WS_TYPE_UPDATE_RULE,
    vol.Required("rule_id"): str,
    vol.Required("updates"): dict,
})
@async_response
async def async_handle_update_rule(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    result = await async_update_rule(hass, msg["rule_id"], msg["updates"])
    connection.send_result(msg["id"], {"success": result})


@websocket_command({vol.Required("type"): WS_TYPE_DELETE_RULE, vol.Required("rule_id"): str})
@async_response
async def async_handle_delete_rule(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    result = await async_delete_rule(hass, msg["rule_id"])
    connection.send_result(msg["id"], {"success": result})


@websocket_command({vol.Required("type"): WS_TYPE_ADD_USER, vol.Required("name"): str, vol.Required("topic"): str})
@async_response
async def async_add_user(
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


@websocket_command({vol.Required("type"): WS_TYPE_REMOVE_USER, vol.Required("user_id"): str})
@async_response
async def async_remove_user(
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


@websocket_command({vol.Required("type"): WS_TYPE_SEND_TEST, vol.Required("topic"): str})
@async_response
async def async_send_test(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    try:
        result = await async_send_test_notification(hass, msg["topic"])
        connection.send_result(msg["id"], {"success": result})
    except Exception as err:
        _LOGGER.exception("Error in async_send_test: %s", err)
        connection.send_error(msg["id"], "internal_error", str(err))


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})
    config = dict(entry.data)
    if entry.options:
        config.update(entry.options)
    hass.data[DOMAIN] = {
        "config": config,
        "entry_id": entry.entry_id,
    }

    @callback
    def _async_state_changed_listener(event: Event[EventStateChangedData]) -> None:
        entity_id = event.data.get("entity_id")
        old_state = event.data.get("old_state")
        new_state = event.data.get("new_state")
        if new_state is None:
            return
        hass.async_create_task(
            async_handle_state_change(hass, old_state, new_state, entity_id)
        )

    listener = hass.bus.async_listen(
        EVENT_STATE_CHANGED,
        _async_state_changed_listener,
    )
    hass.data[DOMAIN][EVENT_LISTENER_KEY] = listener

    async def _handle_reload_rules(call: ServiceCall) -> None:
        await async_load_rules(hass)

    hass.services.async_register(
        DOMAIN, SERVICE_RELOAD_RULES, _handle_reload_rules
    )

    async_register_command(hass, async_get_rules)
    async_register_command(hass, async_save_rule)
    async_register_command(hass, async_handle_update_rule)
    async_register_command(hass, async_handle_delete_rule)
    async_register_command(hass, async_add_user)
    async_register_command(hass, async_remove_user)
    async_register_command(hass, async_send_test)

    try:
        await hass.http.async_register_static_paths(
            [StaticPathConfig("/ntfy_alerts_panel", hass.config.path("custom_components/ntfy_alerts/frontend"), cache_headers=False)]
        )
    except AttributeError:
        hass.http.register_static_path(
            "/ntfy_alerts_panel", hass.config.path("custom_components/ntfy_alerts/frontend"), cache_headers=False
        )
    await panel_custom.async_register_panel(
        hass=hass,
        frontend_url_path="ntfy-alerts",
        webcomponent_name="ntfy-alerts-panel",
        sidebar_title="ntfy Alerts",
        sidebar_icon="mdi:bell-ring",
        js_url=os.environ.get("NTFY_DEV_URL", "/ntfy_alerts_panel/ntfy-alerts-panel.js"),
        require_admin=True,
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
            WS_TYPE_SEND_TEST,
        ]:
            hass.components.websocket_api.async_unregister_command(ws_type)
        try:
            hass.components.frontend.async_remove_panel("ntfy-alerts")
        except (AttributeError, KeyError):
            pass
        hass.data.pop(DOMAIN, None)
    return unload_ok


async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    _LOGGER.debug("Migrating from version %s", entry.version)
    return True
