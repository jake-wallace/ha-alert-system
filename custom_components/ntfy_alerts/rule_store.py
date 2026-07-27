"""Rule storage for ntfy_alerts."""

from __future__ import annotations

import uuid
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN, STORAGE_KEY, STORAGE_VERSION


async def get_store(hass: HomeAssistant) -> Store:
    """Get the rule storage object."""
    store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    return store


async def async_load_rules(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Load all rules from storage."""
    store = await get_store(hass)
    data = await store.async_load()
    if data is None:
        return []
    return data.get("rules", [])


async def async_save_rules(hass: HomeAssistant, rules: list[dict[str, Any]]) -> None:
    """Save all rules to storage."""
    store = await get_store(hass)
    await store.async_save({"rules": rules})


async def async_get_rule(
    hass: HomeAssistant, rule_id: str
) -> dict[str, Any] | None:
    """Get a single rule by ID."""
    rules = await async_load_rules(hass)
    for rule in rules:
        if rule.get("rule_id") == rule_id:
            return rule
    return None


async def async_add_rule(hass: HomeAssistant, rule: dict[str, Any]) -> str:
    """Add a new rule and return its ID."""
    rule_id = str(uuid.uuid4())
    rule["rule_id"] = rule_id
    rules = await async_load_rules(hass)
    rules.append(rule)
    await async_save_rules(hass, rules)
    return rule_id


async def async_update_rule(
    hass: HomeAssistant, rule_id: str, updates: dict[str, Any]
) -> bool:
    """Update an existing rule. Returns True if found and updated."""
    rules = await async_load_rules(hass)
    for i, rule in enumerate(rules):
        if rule.get("rule_id") == rule_id:
            rules[i].update(updates)
            await async_save_rules(hass, rules)
            return True
    return False


async def async_delete_rule(hass: HomeAssistant, rule_id: str) -> bool:
    """Delete a rule by ID. Returns True if found and deleted."""
    rules = await async_load_rules(hass)
    filtered = [r for r in rules if r.get("rule_id") != rule_id]
    if len(filtered) == len(rules):
        return False
    await async_save_rules(hass, filtered)
    return True
