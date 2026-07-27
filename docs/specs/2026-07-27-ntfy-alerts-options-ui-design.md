# ntfy Alerts — Options & Card UI Design

## Goal
Make the ntfy Alerts integration usable through the UI: configure connection settings, manage users, and create notification rules — all without editing YAML.

## Changes

### 1. Bundle Frontend JS (fix card not appearing)
Merge 4 JS files into a single `ntfy-alerts-card.js`:
- `ntfy-alerts-card.js` (main card, ~207 lines)
- `ntfy-entity-picker.js` (~100 lines)
- `ntfy-rule-editor.js` (~200 lines)
- `ntfy-user-manager.js` (~150 lines)

Remove ES module `import` statements — they cause silent failure when loaded via `add_extra_js_url` (which injects as a regular `<script>`, not a module). All code becomes self-contained in one file. Delete the 3 sub-component files.

Total single file: ~650 lines.

### 2. Add `ntfy_server_url` Config Field
- New constant `CONF_NTFY_SERVER_URL = "ntfy_server_url"` in `const.py`
- Default value: `"https://ntfy.sh"`
- Replaces hardcoded `NTFY_API_URL` in dispatcher
- Added to config flow (initial setup) and options flow (edit later)
- Dispatcher reads from `config_data["ntfy_server_url"]` instead of importing `NTFY_API_URL`

### 3. Redesign Options Flow
Config entry schema:
| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `ntfy_server_url` | string | `"https://ntfy.sh"` | Change for self-hosted |
| `ntfy_base_topic` | string | `"ha_alerts"` | Already exists |
| `auth_token` | string | `""` | Already exists |
| `users` | dict | `{}` | Managed via card, not options |

New options flow form shows: server URL, base topic, auth token.

Remove `add_user_name` / `add_user_topic` from options flow (user management stays in the frontend card where it's more natural).

### 4. Config Flow Update
Include `ntfy_server_url` in initial setup form alongside existing fields.

### 5. Card Handles
- User management (add / remove users with name + ntfy topic)
- Rule management (create / edit / delete rules: entity → conditions → subscribers)

### Files Modified
- `custom_components/ntfy_alerts/const.py` — add CONF_NTFY_SERVER_URL
- `custom_components/ntfy_alerts/config_flow.py` — add ntfy_server_url to setup + options flow, remove user fields from options
- `custom_components/ntfy_alerts/__init__.py` — update schema, pass server_url through config
- `custom_components/ntfy_alerts/dispatcher.py` — read server_url from config instead of hardcoded constant
- `custom_components/ntfy_alerts/frontend/ntfy-alerts-card.js` — bundle all 4 files into 1
- Delete: `ntfy-entity-picker.js`, `ntfy-rule-editor.js`, `ntfy-user-manager.js`
