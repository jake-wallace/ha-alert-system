# ntfy Alerts Options & Card UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ntfy Alerts fully configurable from the UI — connection settings in options flow, user/rule management in the Lovelace card.

**Architecture:** Single-file JS bundle (fixes card not loading), options flow with 3 connection fields, dispatcher reads server URL from config entry instead of hardcoded constant.

**Tech Stack:** Python 3.14, Home Assistant 2026.7.4, LitElement (HA built-in), Voluptuous

## Global Constraints

- HA 2026.7.4 compatibility: `async_register_static_paths` exists, `register_static_path` removed
- No new dependencies or npm packages
- `add_extra_js_url` loads scripts as regular `<script>` tags (not modules)
- JS files use LitElement from HA via `Object.getPrototypeOf(customElements.get("hui-view"))`
- All existing tests must pass

---

### Task 1: Bundle Frontend JS Into Single File

**Files:**
- Modify: `custom_components/ntfy_alerts/frontend/ntfy-alerts-card.js`
- Delete: `custom_components/ntfy_alerts/frontend/ntfy-entity-picker.js`
- Delete: `custom_components/ntfy_alerts/frontend/ntfy-rule-editor.js`
- Delete: `custom_components/ntfy_alerts/frontend/ntfy-user-manager.js`

**Interfaces:**
- Consumes: no earlier tasks
- Produces: single bundled JS file with 4 custom elements: `ntfy-alerts-card`, `ntfy-entity-picker`, `ntfy-rule-editor`, `ntfy-user-manager`

- [ ] **Step 1: Concatenate all 4 JS files into ntfy-alerts-card.js**

The final file must contain all 4 class definitions in order, with each class's `LitElement`/`html`/`css` declarations preserved since they use separate closures. Remove the `import` lines from the main card file.

Content order:
1. NtfyEntityPicker class + `customElements.define("ntfy-entity-picker", NtfyEntityPicker)`
2. NtfyRuleEditor class + `customElements.define("ntfy-rule-editor", NtfyRuleEditor)`
3. NtfyUserManager class + `customElements.define("ntfy-user-manager", NtfyUserManager)`
4. NtfyAlertsCard class + `customElements.define("ntfy-alerts-card", NtfyAlertsCard) + window.customCards.push(...)`

Each class keeps its own `const LitElement = ...` lines (they're scoped to the module/script).

Remove from the existing ntfy-alerts-card.js:
```javascript
import './ntfy-entity-picker.js';
import './ntfy-rule-editor.js';
import './ntfy-user-manager.js';
```

- [ ] **Step 2: Verify bundle is valid JS**

Run: `node --check custom_components/ntfy_alerts/frontend/ntfy-alerts-card.js`
Expected: no output (exit code 0)

- [ ] **Step 3: Delete sub-component files**

```bash
rm custom_components/ntfy_alerts/frontend/ntfy-entity-picker.js custom_components/ntfy_alerts/frontend/ntfy-rule-editor.js custom_components/ntfy_alerts/frontend/ntfy-user-manager.js
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "fix: bundle frontend JS into single file to fix module loading"
```

---

### Task 2: Add ntfy_server_url Config Field

**Files:**
- Modify: `custom_components/ntfy_alerts/const.py`
- Modify: `custom_components/ntfy_alerts/dispatcher.py`
- Modify: `custom_components/ntfy_alerts/__init__.py`

**Interfaces:**
- Consumes: no earlier tasks
- Produces: `CONF_NTFY_SERVER_URL` constant, config entry key `ntfy_server_url`, dispatcher reads from config

- [ ] **Step 1: Add CONF_NTFY_SERVER_URL constant to const.py**

After line 5 (`CONF_AUTH_TOKEN = "auth_token"`), add:
```python
CONF_NTFY_SERVER_URL = "ntfy_server_url"
```

- [ ] **Step 2: Update dispatcher.py to read server_url from config**

In `async_handle_state_change`, add `CONF_NTFY_SERVER_URL` to the imports from `.const`:
```python
from .const import (
    ...
    CONF_NTFY_SERVER_URL,
    ...
)
```

In the `_send_ntfy_notification` function, add a `server_url` parameter:
```python
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
```
And replace the hardcoded `NTFY_API_URL` in the POST URL with `server_url`:
```python
async with session.post(
    f"{server_url}",
    json=payload,
    ...
```

In `async_handle_state_change`, read server_url from config:
```python
server_url = config_data.get(CONF_NTFY_SERVER_URL, NTFY_API_URL)
```

And pass it to `_send_ntfy_notification`:
```python
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
```

- [ ] **Step 3: Update __init__.py imports**

Add `CONF_NTFY_SERVER_URL` to the import from `.const`:
```python
from .const import (
    ...
    CONF_NTFY_SERVER_URL,
    ...
)
```

- [ ] **Step 4: Run tests to verify nothing broke**

Run: `python -m pytest tests/ -v`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add ntfy_server_url config field, pass through dispatcher"
```

---

### Task 3: Update Config Flow & Options Flow

**Files:**
- Modify: `custom_components/ntfy_alerts/config_flow.py`
- Modify: `tests/test_config_flow.py`

**Interfaces:**
- Consumes: `CONF_NTFY_SERVER_URL` from const.py (Task 2)
- Produces: options flow with 3 connection fields, initial setup with server URL

- [ ] **Step 1: Update config flow schema and imports**

In `config_flow.py`, add `CONF_NTFY_SERVER_URL` to the import:
```python
from .const import DOMAIN, CONF_NTFY_BASE_TOPIC, CONF_AUTH_TOKEN, CONF_USERS, CONF_NTFY_SERVER_URL
```

Update the setup schema to include `ntfy_server_url`:
```python
STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_NTFY_BASE_TOPIC, default="ha_alerts"): str,
        vol.Optional(CONF_NTFY_SERVER_URL, default="https://ntfy.sh"): str,
        vol.Optional(CONF_AUTH_TOKEN, default=""): str,
    }
)
```

- [ ] **Step 2: Replace options flow with connection settings**

Replace the entire `NtfyAlertsOptionsFlow` class:
```python
class NtfyAlertsOptionsFlow(config_entries.OptionsFlow):
    def __init__(self, config_entry):
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        CONF_NTFY_SERVER_URL,
                        default=self.config_entry.data.get(CONF_NTFY_SERVER_URL, "https://ntfy.sh"),
                    ): str,
                    vol.Optional(
                        CONF_NTFY_BASE_TOPIC,
                        default=self.config_entry.data.get(CONF_NTFY_BASE_TOPIC, "ha_alerts"),
                    ): str,
                    vol.Optional(
                        CONF_AUTH_TOKEN,
                        default=self.config_entry.data.get(CONF_AUTH_TOKEN, ""),
                    ): str,
                }
            ),
        )
```

- [ ] **Step 3: Update config flow test**

In `tests/test_config_flow.py`, update `test_config_flow_create_entry` to include the new field:
```python
async def test_config_flow_create_entry():
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
```

- [ ] **Step 4: Run tests**

Run: `python -m pytest tests/ -v`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add ntfy_server_url to config flow, redesign options flow"
```

---

### Task 4: Update __init__.py — Merge Config with Options

**Files:**
- Modify: `custom_components/ntfy_alerts/__init__.py`

**Interfaces:**
- Consumes: all earlier tasks (bundle done, const/dispatcher updated, config_flow updated)
- Produces: working integration with merged config → options → defaults

- [ ] **Step 1: Merge entry.data and entry.options on setup**

In `async_setup_entry`, update config merging to include options:
```python
config = dict(entry.data)
if entry.options:
    config.update(entry.options)
```

This ensures options overrides base config when set, and falls back to base config for options not yet configured.

- [ ] **Step 2: Run all tests**

Run: `python -m pytest tests/ -v`
Expected: all 21 tests pass

- [ ] **Step 3: Push all commits**

```bash
git push origin main
```

- [ ] **Step 4: Final verification — list files changed**

Run: `git diff --stat origin/main..HEAD`
Expected: ~5 files modified, 3 files deleted
