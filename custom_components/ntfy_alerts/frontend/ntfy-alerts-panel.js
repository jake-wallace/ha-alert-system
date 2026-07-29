class NtfyAlertsPanel extends HTMLElement {
  constructor() {
    super();
    this._init();
  }

  _init() {
    this._hass = null;
    this._rules = [];
    this._users = {};
    this._loading = true;
    this._loadError = false;
    this._retryCount = 0;
    this._retryTimer = null;
    this._haUsersCache = null;
    this._ntfyBaseTopic = "";
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this._retryCount = 0;
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
    this._loadRules();
  }

  disconnectedCallback() {
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
  }

  render() {
    this.innerHTML = `
      <style>
        .ntfy-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          border-bottom: 1px solid var(--divider-color);
          background: var(--card-background-color, #fff);
        }
        .ntfy-toolbar-title {
          font-size: 20px;
          font-weight: 500;
        }
        .ntfy-toolbar-actions {
          display: flex;
          gap: 8px;
        }
        .ntfy-content {
          padding: 24px;
          max-width: 900px;
          margin: 0 auto;
        }
        .ntfy-center {
          display: flex;
          justify-content: center;
          padding: 64px;
        }
        .ntfy-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid var(--divider-color, #ddd);
          border-top-color: var(--primary-color, #03a9f4);
          border-radius: 50%;
          animation: ntfy-spin 0.8s linear infinite;
        }
        @keyframes ntfy-spin {
          to { transform: rotate(360deg); }
        }
        .ntfy-rule-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 0;
          border-bottom: 1px solid var(--divider-color);
        }
        .ntfy-rule-row:last-child {
          border-bottom: none;
        }
        .ntfy-rule-info {
          flex: 1;
          min-width: 0;
        }
        .ntfy-rule-name {
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 4px;
        }
        .ntfy-rule-entity {
          font-size: 13px;
          color: var(--secondary-text-color);
          margin-bottom: 2px;
        }
        .ntfy-rule-subscribers {
          font-size: 13px;
          color: var(--secondary-text-color);
        }
        .ntfy-rule-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
          margin-left: 16px;
        }
        .ntfy-rule-toggle {
          position: relative;
          width: 36px;
          height: 20px;
        }
        .ntfy-rule-toggle input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .ntfy-rule-toggle .ntfy-slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background: var(--secondary-color, #ccc);
          border-radius: 20px;
          transition: 0.3s;
        }
        .ntfy-rule-toggle .ntfy-slider:before {
          content: "";
          position: absolute;
          height: 16px; width: 16px;
          left: 2px; bottom: 2px;
          background: white;
          border-radius: 50%;
          transition: 0.3s;
        }
        .ntfy-rule-toggle input:checked + .ntfy-slider {
          background: var(--primary-color, #03a9f4);
        }
        .ntfy-rule-toggle input:checked + .ntfy-slider:before {
          transform: translateX(16px);
        }
        .ntfy-delete-btn {
          color: var(--error-color, #db4437);
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          padding: 4px 8px;
          border-radius: 4px;
        }
        .ntfy-delete-btn:hover, .ntfy-edit-btn:hover {
          background: var(--secondary-color, rgba(0,0,0,0.05));
        }
        .ntfy-edit-btn {
          color: var(--primary-color, #03a9f4);
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          padding: 4px 8px;
          border-radius: 4px;
        }
        .ntfy-empty, .ntfy-error {
          text-align: center;
          padding: 64px;
          font-size: 16px;
        }
        .ntfy-empty {
          color: var(--secondary-text-color);
        }
        .ntfy-error {
          color: var(--error-color, #db4437);
        }
        .ntfy-btn {
          font-family: var(--paper-font-common-base_-_font-family, inherit);
          font-size: 14px;
          font-weight: 500;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          border: none;
        }
        .ntfy-btn.ntfy-primary {
          background: var(--primary-color, #03a9f4);
          color: var(--primary-text-color, #fff);
        }
        .ntfy-btn.ntfy-secondary {
          background: transparent;
          border: 1px solid var(--primary-color, #03a9f4);
          color: var(--primary-color, #03a9f4);
        }
        .ntfy-btn.ntfy-unelevated {
          background: var(--primary-color, #03a9f4);
          color: var(--primary-text-color, #fff);
        }
        .ntfy-dialog-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .ntfy-dialog {
          background: var(--card-background-color, #fff);
          border-radius: 16px;
          padding: 24px;
          min-width: 400px;
          max-width: 500px;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }
        .ntfy-dialog h2 {
          margin: 0 0 16px 0;
          font-size: 20px;
          font-weight: 500;
        }
        .ntfy-dialog .ntfy-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .ntfy-dialog .ntfy-field-row {
          display: flex;
          gap: 8px;
        }
        .ntfy-dialog .ntfy-field-row > * {
          flex: 1;
        }
        .ntfy-dialog label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
          color: var(--secondary-text-color);
        }
        .ntfy-dialog input, .ntfy-dialog textarea, .ntfy-dialog select {
          font-family: var(--paper-font-common-base_-_font-family, inherit);
          font-size: 14px;
          padding: 8px 12px;
          border: 1px solid var(--divider-color, #ddd);
          border-radius: 4px;
          background: var(--input-background-color, #f5f5f5);
          color: var(--primary-text-color, #333);
          width: 100%;
          box-sizing: border-box;
        }
        .ntfy-dialog select option {
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #333);
        }
        .ntfy-dialog input:focus, .ntfy-dialog textarea:focus, .ntfy-dialog select:focus {
          outline: none;
          border-color: var(--primary-color, #03a9f4);
        }
        .ntfy-dialog textarea {
          min-height: 60px;
          resize: vertical;
        }
        .ntfy-dialog .ntfy-checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .ntfy-dialog .ntfy-checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 14px;
          color: var(--primary-text-color);
        }
        .ntfy-dialog .ntfy-checkbox-label input[type="checkbox"] {
          width: auto;
          cursor: pointer;
        }
        .ntfy-dialog .ntfy-section-label {
          font-weight: 500;
          margin-top: 8px;
          border-top: 1px solid var(--divider-color);
          padding-top: 8px;
          font-size: 14px;
          color: var(--primary-text-color);
        }
        .ntfy-dialog .ntfy-dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 16px;
        }
        .ntfy-user-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ntfy-user-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px;
          border: 1px solid var(--divider-color);
          border-radius: 8px;
        }
        .ntfy-user-info {
          display: flex;
          flex-direction: column;
        }
        .ntfy-user-name {
          font-weight: 500;
        }
        .ntfy-user-topic {
          font-size: 13px;
          color: var(--secondary-text-color);
        }
      </style>
      <div class="ntfy-toolbar">
        <div class="ntfy-toolbar-title">ntfy Alerts</div>
        <div class="ntfy-toolbar-actions">
          <button class="ntfy-btn ntfy-secondary" id="test-btn">Test</button>
          <button class="ntfy-btn ntfy-secondary" id="users-btn">Users</button>
          <button class="ntfy-btn ntfy-unelevated" id="new-rule-btn">＋ New Rule</button>
        </div>
      </div>
      <div class="ntfy-content" id="content"></div>
    `;

    this.querySelector("#test-btn").onclick = () => this._openTestDialog();
    this.querySelector("#users-btn").onclick = () => this._openUserManager();
    this.querySelector("#new-rule-btn").onclick = () => this._openNewRuleDialog();
    this._renderContent();
  }

  _renderLoading() {
    return '<div class="ntfy-center"><div class="ntfy-spinner"></div></div>';
  }

  _renderError() {
    return '<div class="ntfy-error">Unable to connect to the ntfy Alerts integration. Make sure it is installed and configured.</div>';
  }

  _renderEmpty() {
    return '<div class="ntfy-empty">No rules yet. Create one!</div>';
  }

  _renderRules() {
    return this._rules.map((rule) => `
      <div class="ntfy-rule-row">
        <div class="ntfy-rule-info">
          <div class="ntfy-rule-name">${this._escapeHtml(rule.name)}</div>
          <div class="ntfy-rule-entity">${this._escapeHtml(rule.entity_id)}</div>
          <div class="ntfy-rule-subscribers">→ ${this._escapeHtml(this._getSubscriberNames(rule.subscribers || []).join(", "))}</div>
        </div>
        <div class="ntfy-rule-actions">
          <label class="ntfy-rule-toggle">
            <input type="checkbox" ${rule.enabled !== false ? "checked" : ""} data-rule-id="${this._escapeHtml(rule.rule_id)}">
            <span class="ntfy-slider"></span>
          </label>
          <button class="ntfy-edit-btn" data-rule-id="${this._escapeHtml(rule.rule_id)}">✎</button>
          <button class="ntfy-delete-btn" data-rule-id="${this._escapeHtml(rule.rule_id)}">✕</button>
        </div>
      </div>
    `).join("");
  }

  _escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  _getFilteredEntities(prefix) {
    if (!this._hass || !this._hass.states) return [];
    var ids = Object.keys(this._hass.states);
    if (prefix) {
      var lower = prefix.toLowerCase();
      ids = ids.filter(function (id) { return id.indexOf(lower) !== -1; });
    }
    ids = ids.slice(0, 50);
    var self = this;
    return ids.map(function (id) {
      var state = self._hass.states[id];
      var name = (state && state.attributes && state.attributes.friendly_name) || id;
      return { id: id, name: name };
    });
  }

  _renderEntityAutocomplete(input) {
    var container = document.createElement("div");
    container.style.cssText = "position:relative;display:block;width:100%";
    input.parentNode.insertBefore(container, input);
    container.appendChild(input);

    var list = document.createElement("div");
    list.style.cssText =
      "position:absolute;top:100%;left:0;right:0;z-index:100;" +
      "max-height:200px;overflow-y:auto;" +
      "background:var(--card-background-color,#fff);" +
      "border:1px solid var(--divider-color,#ddd);" +
      "border-radius:4px;display:none;box-shadow:0 4px 12px rgba(0,0,0,0.15)";
    container.appendChild(list);

    var selectedIndex = -1;

    function render(prefix) {
      var entities = this._getFilteredEntities(prefix);
      list.innerHTML = "";
      selectedIndex = -1;
      if (entities.length === 0) { list.style.display = "none"; return; }
      entities.forEach(function (entity, i) {
        var item = document.createElement("div");
        item.dataset.id = entity.id;
        item.style.cssText =
          "padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--divider-color,#eee)";
        var idLine = document.createElement("div");
        idLine.textContent = entity.id;
        idLine.style.fontSize = "13px";
        idLine.style.color = "var(--primary-text-color,#333)";
        var nameLine = document.createElement("div");
        nameLine.textContent = entity.name;
        nameLine.style.fontSize = "11px";
        nameLine.style.color = "var(--secondary-text-color)";
        item.appendChild(idLine);
        item.appendChild(nameLine);
        item.onmouseover = function () { item.style.background = "var(--secondary-color,rgba(0,0,0,0.05))"; };
        item.onmouseout = function () { item.style.background = ""; };
        item.onclick = function () {
          input.value = entity.id;
          list.style.display = "none";
          input.dispatchEvent(new Event("input", { bubbles: true }));
        };
        list.appendChild(item);
      });
      list.style.display = "block";
    }

    var self = this;
    input.addEventListener("focus", function () { render.call(self, input.value); });
    input.addEventListener("input", function () { render.call(self, input.value); });
    input.addEventListener("blur", function () {
      setTimeout(function () { list.style.display = "none"; }, 150);
    });
    input.addEventListener("keydown", function (e) {
      var items = list.querySelectorAll("div[data-id]");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        items.forEach(function (el, i) { el.style.background = i === selectedIndex ? "var(--primary-color,#03a9f4)" : ""; });
        if (items[selectedIndex]) items[selectedIndex].scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        items.forEach(function (el, i) { el.style.background = i === selectedIndex ? "var(--primary-color,#03a9f4)" : ""; });
        if (items[selectedIndex]) items[selectedIndex].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && selectedIndex >= 0 && items[selectedIndex]) {
        e.preventDefault();
        input.value = items[selectedIndex].dataset.id;
        list.style.display = "none";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (e.key === "Escape") {
        list.style.display = "none";
      }
    });
  }

  async _fetchHAUsers() {
    if (this._haUsersCache) return this._haUsersCache;
    try {
      var result = await this._ws({ type: "config/auth/list" });
      this._haUsersCache = result || [];
      return this._haUsersCache;
    } catch (e) {
      console.warn("Failed to fetch HA users:", e);
      return [];
    }
  }

  _renderUserAutocomplete(input, onSelect) {
    var container = document.createElement("div");
    container.style.cssText = "position:relative;display:block;width:100%";
    input.parentNode.insertBefore(container, input);
    container.appendChild(input);

    var list = document.createElement("div");
    list.style.cssText =
      "position:absolute;top:100%;left:0;right:0;z-index:100;" +
      "max-height:200px;overflow-y:auto;" +
      "background:var(--card-background-color,#fff);" +
      "border:1px solid var(--divider-color,#ddd);" +
      "border-radius:4px;display:none;box-shadow:0 4px 12px rgba(0,0,0,0.15)";
    container.appendChild(list);

    var haUsers = [];
    var selectedIndex = -1;

    function render(prefix) {
      list.innerHTML = "";
      selectedIndex = -1;
      var filtered = haUsers;
      if (prefix) {
        var lower = prefix.toLowerCase();
        filtered = haUsers.filter(function (u) { return u.name && u.name.toLowerCase().indexOf(lower) !== -1; });
      }
      if (filtered.length === 0) { list.style.display = "none"; return; }
      filtered.forEach(function (user, i) {
        var item = document.createElement("div");
        item.textContent = user.name;
        item.title = "HA user";
        item.style.cssText =
          "padding:8px 12px;cursor:pointer;font-size:14px;" +
          "color:var(--primary-text-color,#333)";
        item.onmouseover = function () { item.style.background = "var(--secondary-color,rgba(0,0,0,0.05))"; };
        item.onmouseout = function () { item.style.background = ""; };
        item.onclick = function () {
          input.value = user.name;
          list.style.display = "none";
          if (onSelect) onSelect(user);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        };
        list.appendChild(item);
      });
      list.style.display = "block";
    }

    var self = this;
    input.addEventListener("focus", function () {
      if (haUsers.length === 0) {
        self._fetchHAUsers().then(function (users) {
          haUsers = users;
          render.call(self, input.value);
        });
      } else {
        render.call(self, input.value);
      }
    });
    input.addEventListener("input", function () { render.call(self, input.value); });
    input.addEventListener("blur", function () {
      setTimeout(function () { list.style.display = "none"; }, 150);
    });
    input.addEventListener("keydown", function (e) {
      var items = list.querySelectorAll("div");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        items.forEach(function (el, i) { el.style.background = i === selectedIndex ? "var(--primary-color,#03a9f4)" : ""; });
        if (items[selectedIndex]) items[selectedIndex].scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        items.forEach(function (el, i) { el.style.background = i === selectedIndex ? "var(--primary-color,#03a9f4)" : ""; });
        if (items[selectedIndex]) items[selectedIndex].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && selectedIndex >= 0 && items[selectedIndex]) {
        e.preventDefault();
        var selectedName = items[selectedIndex].textContent;
        input.value = selectedName;
        list.style.display = "none";
        var user = haUsers.find(function (u) { return u.name === selectedName; });
        if (user && onSelect) onSelect(user);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (e.key === "Escape") {
        list.style.display = "none";
      }
    });
  }

  _renderContent() {
    const content = this.querySelector("#content");
    if (!content) return;
    if (this._loading) {
      content.innerHTML = this._renderLoading();
    } else if (this._loadError) {
      content.innerHTML = this._renderError();
    } else if (this._rules.length === 0) {
      content.innerHTML = this._renderEmpty();
    } else {
      content.innerHTML = this._renderRules();
      content.querySelectorAll('.ntfy-rule-toggle input[type="checkbox"]').forEach((cb) => {
        cb.onchange = () => {
          this._toggleRule(cb.dataset.ruleId, cb.checked);
        };
      });
      content.querySelectorAll(".ntfy-edit-btn").forEach((btn) => {
        btn.onclick = () => this._openEditRuleDialog(btn.dataset.ruleId);
      });
      content.querySelectorAll(".ntfy-delete-btn").forEach((btn) => {
        btn.onclick = () => this._deleteRule(btn.dataset.ruleId);
      });
    }
  }

  _getSubscriberNames(subscriberIds) {
    return subscriberIds.map((id) => {
      const user = this._users[id];
      return user ? user.name || id : id;
    });
  }

  _ws(msg) {
    var promise;
    if (this._hass.callWS) {
      promise = this._hass.callWS(msg);
    } else if (this._hass.connection && this._hass.connection.sendMessagePromise) {
      promise = this._hass.connection.sendMessagePromise(msg);
    } else {
      return Promise.reject(new Error("WebSocket not available"));
    }
    return promise.catch(function (err) {
      if (err instanceof Error) throw err;
      throw new Error("WS error: " + (err && err.message ? err.message : JSON.stringify(err)));
    });
  }

  async _loadRules() {
    if (!this._hass) return;
    this._loading = true;
    this._loadError = false;
    this._renderContent();
    try {
      const result = await this._ws({
        type: "ntfy_alerts/get_rules",
      });
      this._rules = result.rules || [];
      this._users = result.users || {};
      this._ntfyBaseTopic = (result.config && result.config.ntfy_base_topic) || "";
      this._retryCount = 0;
      this._loadError = false;
      this._loading = false;
      this._renderContent();
    } catch (e) {
      console.error("Failed to load ntfy rules:", e.message || e);
      this._rules = [];
      if (this._retryCount < 10) {
        this._retryCount++;
        const delay = Math.min(1000 * 2 ** (this._retryCount - 1), 16000);
        this._retryTimer = setTimeout(() => this._loadRules(), delay);
        return;
      }
      this._loadError = true;
      this._loading = false;
      this._renderContent();
    }
  }

  _toggleRule(ruleId, enabled) {
    if (!this._hass) return;
    this._ws({
      type: "ntfy_alerts/update_rule",
      rule_id: ruleId,
      updates: { enabled },
    });
    const rule = this._rules.find((r) => r.rule_id === ruleId);
    if (rule) rule.enabled = enabled;
  }

  async _deleteRule(ruleId) {
    if (!this._hass) return;
    await this._ws({
      type: "ntfy_alerts/delete_rule",
      rule_id: ruleId,
    });
    this._rules = this._rules.filter((r) => r.rule_id !== ruleId);
    this._renderContent();
  }

  _openNewRuleDialog() {
    if (this._dialog) return;
    this._dialog = this._createDialog(null, null);
  }

  _openEditRuleDialog(ruleId) {
    if (this._dialog) return;
    var rule = this._rules.find(function (r) { return r.rule_id === ruleId; });
    if (!rule) return;
    this._dialog = this._createDialog("edit", rule);
  }

  _openTestDialog() {
    if (this._dialog) return;
    this._dialog = this._createDialog("test", null);
  }

  _openUserManager() {
    if (this._dialog) return;
    this._dialog = this._createDialog("users", null);
  }

  _closeDialog() {
    if (this._dialog) {
      this._dialog.remove();
      this._dialog = null;
    }
  }

  _createDialog(type, rule) {
    const overlay = document.createElement("div");
    overlay.className = "ntfy-dialog-overlay";
    overlay.onclick = (e) => {
      if (e.target === overlay) this._closeDialog();
    };
    this.appendChild(overlay);

    if (type === "test") {
      this._renderTestDialog(overlay);
    } else if (type === "users") {
      this._renderUserManager(overlay);
    } else if (type === "edit") {
      this._renderRuleEditor(overlay, rule);
    } else {
      this._renderRuleEditor(overlay, null);
    }

    return overlay;
  }

  _renderRuleEditor(overlay, rule) {
    var isEdit = rule ? true : false;

    var defaults = {
      name: isEdit ? rule.name : "",
      entity_id: isEdit ? rule.entity_id : "",
      from_state: (isEdit && rule.conditions && rule.conditions.from_state) || "",
      to_state: (isEdit && rule.conditions && rule.conditions.to_state) || "",
      subscribers: isEdit ? (rule.subscribers || []) : [],
      title: (isEdit && rule.message && rule.message.title) || "",
      body: (isEdit && rule.message && rule.message.body) || "",
      priority: (isEdit && rule.message && rule.message.priority) || 3,
      tags: (isEdit && rule.message && rule.message.tags) || "",
      cooldown: isEdit ? (rule.cooldown_seconds || 60) : 60,
    };

    var dialog = document.createElement("div");
    dialog.className = "ntfy-dialog";

    dialog.innerHTML =
      "<h2>" + (isEdit ? "Edit Rule" : "New Rule") + "</h2>" +
      '<div class="ntfy-form">' +
      '  <label>Rule Name <input type="text" id="rule-name" value="' + this._escapeHtml(defaults.name) + '" required></label>' +
      '  <label>Entity ID <input type="text" id="rule-entity" value="' + this._escapeHtml(defaults.entity_id) + '" placeholder="e.g. sensor.temperature" required></label>' +
      '  <div class="ntfy-field-row">' +
      '    <label>From State (optional) <input type="text" id="rule-from" value="' + this._escapeHtml(defaults.from_state) + '"></label>' +
      '    <label>To State (optional) <input type="text" id="rule-to" value="' + this._escapeHtml(defaults.to_state) + '"></label>' +
      '  </div>' +
      '  <div class="ntfy-section-label">Subscribers</div>' +
      '  <div class="ntfy-checkbox-group" id="subscribers-list"></div>' +
      '  <div class="ntfy-section-label">Message</div>' +
      '  <label>Title (supports templates) <input type="text" id="rule-title" value="' + this._escapeHtml(defaults.title) + '"></label>' +
      '  <label>Body (supports templates) <textarea id="rule-body">' + this._escapeHtml(defaults.body) + '</textarea></label>' +
      '  <div class="ntfy-section-label">Options</div>' +
      '  <label>Priority (1-5) <input type="range" id="rule-priority" min="1" max="5" value="' + defaults.priority + '"></label>' +
      '  <label>Tags (comma separated) <input type="text" id="rule-tags" value="' + this._escapeHtml(defaults.tags) + '"></label>' +
      '  <label>Cooldown (seconds) <input type="number" id="rule-cooldown" value="' + defaults.cooldown + '"></label>' +
      '</div>' +
      '<div class="ntfy-dialog-actions">' +
      '  <button class="ntfy-btn ntfy-secondary" id="cancel-btn">Cancel</button>' +
      '  <button class="ntfy-btn ntfy-primary" id="save-btn" disabled>' + (isEdit ? "Save Changes" : "Save") + '</button>' +
      '</div>';

    overlay.appendChild(dialog);

    var subsList = dialog.querySelector("#subscribers-list");
    Object.entries(this._users).forEach(function (entry) {
      var userId = entry[0], user = entry[1];
      var label = document.createElement("label");
      label.className = "ntfy-checkbox-label";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = defaults.subscribers.indexOf(userId) !== -1;
      cb.onchange = function () {
        var idx = defaults.subscribers.indexOf(userId);
        if (cb.checked && idx === -1) defaults.subscribers.push(userId);
        else if (!cb.checked && idx !== -1) defaults.subscribers.splice(idx, 1);
      };
      label.appendChild(cb);
      label.appendChild(document.createTextNode(user.name || userId));
      subsList.appendChild(label);
    });

    var saveBtn = dialog.querySelector("#save-btn");
    var nameInput = dialog.querySelector("#rule-name");
    var entityInput = dialog.querySelector("#rule-entity");
    this._renderEntityAutocomplete(entityInput);
    var priorityInput = dialog.querySelector("#rule-priority");
    var priorityDisplay = document.createElement("span");
    priorityInput.parentNode.appendChild(priorityDisplay);

    var updateSaveBtn = function () {
      saveBtn.disabled = !nameInput.value || !entityInput.value;
    };
    var updatePriority = function () {
      priorityDisplay.textContent = " " + priorityInput.value;
    };

    nameInput.oninput = updateSaveBtn;
    entityInput.oninput = updateSaveBtn;
    priorityInput.oninput = updatePriority;
    updatePriority();
    updateSaveBtn();

    var self = this;
    saveBtn.onclick = async function () {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving\u2026";
      try {
        var payload = {
          name: nameInput.value,
          entity_id: entityInput.value,
          conditions: {
            from_state: dialog.querySelector("#rule-from").value || null,
            to_state: dialog.querySelector("#rule-to").value || null,
          },
          subscribers: defaults.subscribers,
          message: {
            title: dialog.querySelector("#rule-title").value,
            body: dialog.querySelector("#rule-body").value,
            priority: parseInt(priorityInput.value),
            tags: dialog.querySelector("#rule-tags").value,
          },
          cooldown_seconds: parseInt(dialog.querySelector("#rule-cooldown").value) || 60,
        };
        if (isEdit) {
          payload.enabled = rule.enabled !== false;
          await self._ws({
            type: "ntfy_alerts/update_rule",
            rule_id: rule.rule_id,
            updates: payload,
          });
        } else {
          payload.enabled = true;
          await self._ws({
            type: "ntfy_alerts/save_rule",
            rule: payload,
          });
        }
        self._closeDialog();
        self._loadRules();
      } catch (e) {
        alert("Failed to save rule: " + (e && e.message ? e.message : e));
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? "Save Changes" : "Save";
      }
    };

    dialog.querySelector("#cancel-btn").onclick = () => this._closeDialog();
  }

  _renderTestDialog(overlay) {
    var dialog = document.createElement("div");
    dialog.className = "ntfy-dialog";

    var userIds = Object.keys(this._users);
    var userOptions = userIds.map(function (uid) {
      var u = this._users[uid];
      return '<option value="' + this._escapeHtml(uid) + '">' + this._escapeHtml(u.name) + " (" + this._escapeHtml(u.topic) + ")</option>";
    }, this).join("");

    dialog.innerHTML =
      "<h2>Test Notification</h2>" +
      '<div class="ntfy-form">' +
      '  <label>Send to <select id="test-user">' + (userOptions || '<option value="">No users configured</option>') + '</select></label>' +
      '  <label>Message <textarea id="test-message">This is a test notification from ntfy Alerts.</textarea></label>' +
      '</div>' +
      '<div id="test-result" style="margin-top:8px;font-size:13px"></div>' +
      '<div class="ntfy-dialog-actions">' +
      '  <button class="ntfy-btn ntfy-secondary" id="cancel-btn">Close</button>' +
      '  <button class="ntfy-btn ntfy-primary" id="test-send-btn"' + (userIds.length === 0 ? ' disabled' : '') + '>Send Test</button>' +
      '</div>';

    overlay.appendChild(dialog);

    var sendBtn = dialog.querySelector("#test-send-btn");
    var resultDiv = dialog.querySelector("#test-result");

    var self = this;
    sendBtn.onclick = async function () {
      var selected = dialog.querySelector("#test-user").value;
      if (!selected) return;
      sendBtn.disabled = true;
      sendBtn.textContent = "Sending\u2026";
      resultDiv.textContent = "";
      resultDiv.style.color = "";
      try {
        var res = await self._ws({
          type: "ntfy_alerts/send_test",
          topic: self._users[selected].topic,
        });
        if (res && res.success) {
          resultDiv.textContent = "Notification sent successfully!";
          resultDiv.style.color = "green";
        } else {
          resultDiv.textContent = "Failed to send notification. Check the topic and server.";
          resultDiv.style.color = "red";
        }
      } catch (e) {
        resultDiv.textContent = "Error: " + (e && e.message ? e.message : e);
        resultDiv.style.color = "red";
      }
      sendBtn.disabled = false;
      sendBtn.textContent = "Send Test";
    };

    dialog.querySelector("#cancel-btn").onclick = function () { self._closeDialog(); };
  }

  _renderUserManager(overlay) {
    const dialog = document.createElement("div");
    dialog.className = "ntfy-dialog";

    let newName = "", newTopic = "";

    dialog.innerHTML = `
      <h2>Manage Users</h2>
      <div class="ntfy-user-list" id="user-list"></div>
      <div class="ntfy-section-label">Add User</div>
      <div class="ntfy-field-row">
        <label>Name <input type="text" id="new-name" value=""></label>
        <label>Topic <input type="text" id="new-topic" value=""></label>
        <button class="ntfy-btn ntfy-primary" id="add-btn" style="margin-top:18px" disabled>Add</button>
      </div>
      <div class="ntfy-dialog-actions">
        <button class="ntfy-btn ntfy-secondary" id="close-btn">Close</button>
      </div>
    `;

    overlay.appendChild(dialog);

    const renderUsers = () => {
      const userList = dialog.querySelector("#user-list");
      userList.innerHTML = Object.entries(this._users).map(([userId, user]) => `
        <div class="ntfy-user-row">
          <div class="ntfy-user-info">
            <span class="ntfy-user-name">${this._escapeHtml(user.name)}</span>
            <span class="ntfy-user-topic">${this._escapeHtml(user.topic)}</span>
          </div>
          <button class="ntfy-delete-btn" data-user-id="${this._escapeHtml(userId)}">✕</button>
        </div>
      `).join("");
      userList.querySelectorAll(".ntfy-delete-btn").forEach((btn) => {
        btn.onclick = () => this._removeUser(btn.dataset.userId);
      });
    };

    renderUsers();

    const nameInput = dialog.querySelector("#new-name");
    const topicInput = dialog.querySelector("#new-topic");
    const addBtn = dialog.querySelector("#add-btn");

    const updateAddBtn = () => {
      addBtn.disabled = !nameInput.value || !topicInput.value;
    };
    nameInput.oninput = updateAddBtn;
    topicInput.oninput = updateAddBtn;

    var self = this;
    this._renderUserAutocomplete(nameInput, function (user) {
      for (var uid in self._users) {
        if (self._users[uid].name === user.name) {
          topicInput.value = self._users[uid].topic || "";
          break;
        }
      }
      updateAddBtn();
    });

    var topicList = document.createElement("datalist");
    topicList.id = "topic-list";
    var seen = {};
    if (this._ntfyBaseTopic) {
      seen[this._ntfyBaseTopic] = true;
      var baseOpt = document.createElement("option");
      baseOpt.value = this._ntfyBaseTopic;
      topicList.appendChild(baseOpt);
    }
    Object.keys(this._users).forEach(function (uid) {
      var topic = this._users[uid].topic;
      if (topic && !seen[topic]) {
        seen[topic] = true;
        var opt = document.createElement("option");
        opt.value = topic;
        topicList.appendChild(opt);
      }
    }, this);
    topicInput.setAttribute("list", "topic-list");
    topicInput.parentNode.appendChild(topicList);

    addBtn.onclick = async () => {
      const name = nameInput.value;
      const topic = topicInput.value;
      nameInput.value = "";
      topicInput.value = "";
      updateAddBtn();
      try {
        const result = await this._ws({
          type: "ntfy_alerts/add_user",
          name,
          topic,
        });
        this._users[result.user_id] = { name, topic };
        renderUsers();
        this._loadRules();
      } catch (e) {
        alert("Failed to add user: " + (e?.message || e));
      }
    };

    dialog.querySelector("#close-btn").onclick = () => this._closeDialog();
  }

  async _removeUser(userId) {
    try {
      await this._ws({
        type: "ntfy_alerts/remove_user",
        user_id: userId,
      });
      delete this._users[userId];
      this._loadRules();
      // Re-render user manager if open
      if (this._dialog && this._dialog.querySelector("#user-list")) {
        this._renderUserManager(this._dialog);
      }
    } catch (e) {
      alert("Failed to remove user: " + (e?.message || e));
    }
  }
}

function createNtfyPanel() {
  var el = document.createElement("div");
  Object.setPrototypeOf(el, NtfyAlertsPanel.prototype);
  el._init();
  return el;
}

try {
  if (!customElements.get("ntfy-alerts-panel")) {
    customElements.define("ntfy-alerts-panel", NtfyAlertsPanel);
  }
} catch (e) {
}

var origCE = Document.prototype.createElement;
Document.prototype.createElement = function (tagName, options) {
  if (tagName === "ntfy-alerts-panel") {
    return createNtfyPanel();
  }
  return origCE.call(this, tagName, options);
};
