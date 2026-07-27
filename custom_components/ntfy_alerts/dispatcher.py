"""Event dispatcher for ntfy_alerts — evaluates rules and sends notifications."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import aiohttp

from homeassistant.core import HomeAssistant, State
from homeassistant.helpers.template import Template as JinjaTemplate

from .const import (
    ATTR_BODY,
    ATTR_CONDITIONS,
    ATTR_COOLDOWN,
    ATTR_ENABLED,
    ATTR_ENTITY_ID,
    ATTR_FROM_STATE,
    ATTR_MESSAGE,
    ATTR_PRIORITY,
    ATTR_SUBSCRIBERS,
    ATTR_TAGS,
    ATTR_TITLE,
    ATTR_TO_STATE,
    ATTR_VALUE_TEMPLATE,
    CONF_AUTH_TOKEN,
    CONF_NTFY_BASE_TOPIC,
    CONF_NTFY_SERVER_URL,
    CONF_USERS,
    COOLDOWN_STORAGE_KEY,
    DEFAULT_COOLDOWN,
    DEFAULT_PRIORITY,
    DOMAIN,
    NTFY_API_URL,
)
from .rule_store import async_load_rules

_LOGGER = logging.getLogger(__name__)


def _condition_matches(
    rule_conditions: dict[str, Any] | None,
    old_state: State | None,
    new_state: State,
) -> bool:
    if not rule_conditions:
        return True
    from_state = rule_conditions.get(ATTR_FROM_STATE)
    to_state = rule_conditions.get(ATTR_TO_STATE)
    if from_state is not None and (old_state is None or old_state.state != from_state):
        return False
    if to_state is not None and new_state.state != to_state:
        return False
    return True


def _get_subscriber_topics(
    config_data: dict[str, Any], subscriber_ids: list[str]
) -> list[str]:
    users = config_data.get(CONF_USERS, {})
    topics = []
    for user_id in subscriber_ids:
        user = users.get(user_id)
        if user and user.get("topic"):
            topics.append(user["topic"])
    return topics


async def _send_ntfy_notification(
    session: aiohttp.ClientSession,
    server_url: str,
    topic: str,
    title: str,
    message: str,
    priority: int,
    tags: str,
    auth_token: str,
) -> bool:
    payload = {
        "topic": topic,
        "title": title,
        "message": message,
        "priority": priority,
        "tags": [tags] if tags else [],
    }
    headers = {"Content-Type": "application/json"}
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
    try:
        async with session.post(
            server_url,
            json=payload,
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            if resp.status not in (200, 201):
                _LOGGER.error(
                    "ntfy.sh returned %s for topic %s: %s",
                    resp.status,
                    topic,
                    await resp.text(),
                )
                return False
            return True
    except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
        _LOGGER.error("Failed to send ntfy.sh notification: %s", exc)
        return False


def _check_cooldown(
    hass: HomeAssistant, rule_id: str, cooldown_seconds: int
) -> bool:
    if cooldown_seconds <= 0:
        return True
    now = datetime.now(timezone.utc)
    cooldowns = hass.data.get(COOLDOWN_STORAGE_KEY, {})
    last_sent = cooldowns.get(rule_id)
    if last_sent:
        elapsed = (now - last_sent).total_seconds()
        if elapsed < cooldown_seconds:
            return False
    cooldowns[rule_id] = now
    hass.data[COOLDOWN_STORAGE_KEY] = cooldowns
    return True


async def async_handle_state_change(
    hass: HomeAssistant,
    old_state: State | None,
    new_state: State,
    entity_id: str,
) -> None:
    config_data = hass.data.get(DOMAIN, {}).get("config", {})
    if not config_data:
        return
    auth_token = config_data.get(CONF_AUTH_TOKEN, "")
    server_url = config_data.get(CONF_NTFY_SERVER_URL, NTFY_API_URL)
    rules = await async_load_rules(hass)
    matched_rules = [
        rule
        for rule in rules
        if rule.get(ATTR_ENABLED, True)
        and rule.get(ATTR_ENTITY_ID) == entity_id
        and _condition_matches(rule.get(ATTR_CONDITIONS), old_state, new_state)
    ]
    if not matched_rules:
        return
    async with aiohttp.ClientSession() as session:
        for rule in matched_rules:
            rule_id = rule.get("rule_id", "")
            cooldown = rule.get(ATTR_COOLDOWN, DEFAULT_COOLDOWN)
            if not _check_cooldown(hass, rule_id, cooldown):
                continue
            subscriber_ids = rule.get(ATTR_SUBSCRIBERS, [])
            topics = _get_subscriber_topics(config_data, subscriber_ids)
            if not topics:
                continue
            message = rule.get(ATTR_MESSAGE, {})
            title = message.get(ATTR_TITLE, "Alert")
            body = message.get(ATTR_BODY, f"{entity_id} changed to {new_state.state}")
            priority = message.get(ATTR_PRIORITY, DEFAULT_PRIORITY)
            tags = message.get(ATTR_TAGS, "")
            render_context = {
                "entity_id": entity_id,
                "old_state": old_state.state if old_state else None,
                "new_state": new_state.state,
                "now": datetime.now().isoformat(),
            }
            rendered_title = _render_template(hass, title, render_context)
            rendered_body = _render_template(hass, body, render_context)
            results = await asyncio.gather(
                *[
                    _send_ntfy_notification(
                        session, server_url, topic, rendered_title, rendered_body,
                        priority, tags, auth_token,
                    )
                    for topic in topics
                ],
                return_exceptions=True,
            )
            success_count = sum(1 for r in results if r is True)
            _update_sensor_data(hass, rule_id, success_count, len(topics))


def _render_template(
    hass: HomeAssistant, template_str: str, context: dict[str, Any]
) -> str:
    try:
        tmpl = JinjaTemplate(template_str, hass)
        return tmpl.async_render(context)
    except Exception as exc:
        _LOGGER.warning("Template rendering failed: %s", exc)
        return template_str


def _update_sensor_data(
    hass: HomeAssistant, rule_id: str, success_count: int, total_count: int
) -> None:
    sensor_data = hass.data.setdefault(f"{DOMAIN}_sensor", {})
    sensor_data.setdefault("total_sent", 0)
    sensor_data["total_sent"] += success_count
    sensor_data["last_sent"] = datetime.now(timezone.utc).isoformat()
    if success_count < total_count:
        sensor_data["last_error"] = (
            f"Failed to send {total_count - success_count}/{total_count} notifications"
        )
