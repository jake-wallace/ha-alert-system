class NtfyAlertsPanel extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._rules = [];
    this._users = {};
    this._loading = true;
    this._loadError = false;
    this._retryCount = 0;
    this._retryTimer = null;
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
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
        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          border-bottom: 1px solid var(--divider-color);
          background: var(--card-background-color, #fff);
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .toolbar-title {
          font-size: 20px;
          font-weight: 500;
        }
        .toolbar-actions {
          display: flex;
          gap: 8px;
        }
        .content {
          padding: 24px;
          max-width: 900px;
          margin: 0 auto;
        }
        .center {
          display: flex;
          justify-content: center;
          padding: 64px;
        }
        .rules-list {
          width: 100%;
        }
        .rule-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 0;
          border-bottom: 1px solid var(--divider-color);
        }
        .rule-row:last-child {
          border-bottom: none;
        }
        .rule-info {
          flex: 1;
          min-width: 0;
        }
        .rule-name {
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 4px;
        }
        .rule-entity {
          font-size: 13px;
          color: var(--secondary-text-color);
          margin-bottom: 2px;
        }
        .rule-subscribers {
          font-size: 13px;
          color: var(--secondary-text-color);
        }
        .rule-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
          margin-left: 16px;
        }
        .rule-toggle {
          position: relative;
          width: 36px;
          height: 20px;
        }
        .rule-toggle input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .rule-toggle .slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background: var(--secondary-color, #ccc);
          border-radius: 20px;
          transition: 0.3s;
        }
        .rule-toggle .slider:before {
          content: "";
          position: absolute;
          height: 16px; width: 16px;
          left: 2px; bottom: 2px;
          background: white;
          border-radius: 50%;
          transition: 0.3s;
        }
        .rule-toggle input:checked + .slider {
          background: var(--primary-color, #03a9f4);
        }
        .rule-toggle input:checked + .slider:before {
          transform: translateX(16px);
        }
        .delete-btn {
          color: var(--error-color, #db4437);
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          padding: 4px 8px;
          border-radius: 4px;
        }
        .delete-btn:hover {
          background: var(--secondary-color, rgba(0,0,0,0.05));
        }
        .empty, .error {
          text-align: center;
          padding: 64px;
          font-size: 16px;
        }
        .empty {
          color: var(--secondary-text-color);
        }
        .error {
          color: var(--error-color, #db4437);
        }
        button {
          font-family: var(--paper-font-common-base_-_font-family, inherit);
          font-size: 14px;
          font-weight: 500;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          border: none;
        }
        button.primary {
          background: var(--primary-color, #03a9f4);
          color: var(--primary-text-color, #fff);
        }
        button.secondary {
          background: transparent;
          border: 1px solid var(--primary-color, #03a9f4);
          color: var(--primary-color, #03a9f4);
        }
        button.unelevated {
          background: var(--primary-color, #03a9f4);
          color: var(--primary-text-color, #fff);
        }
        .dialog-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .dialog {
          background: var(--card-background-color, #fff);
          border-radius: 16px;
          padding: 24px;
          min-width: 400px;
          max-width: 500px;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }
        .dialog h2 {
          margin: 0 0 16px 0;
          font-size: 20px;
          font-weight: 500;
        }
        .dialog .form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .dialog .field-row {
          display: flex;
          gap: 8px;
        }
        .dialog .field-row > * {
          flex: 1;
        }
        .dialog label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
          color: var(--secondary-text-color);
        }
        .dialog input, .dialog textarea, .dialog select {
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
        .dialog input:focus, .dialog textarea:focus {
          outline: none;
          border-color: var(--primary-color, #03a9f4);
        }
        .dialog textarea {
          min-height: 60px;
          resize: vertical;
        }
        .dialog .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .dialog .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 14px;
          color: var(--primary-text-color);
        }
        .dialog .checkbox-label input[type="checkbox"] {
          width: auto;
          cursor: pointer;
        }
        .dialog .section-label {
          font-weight: 500;
          margin-top: 8px;
          border-top: 1px solid var(--divider-color);
          padding-top: 8px;
          font-size: 14px;
          color: var(--primary-text-color);
        }
        .dialog .dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 16px;
        }
        .user-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .user-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px;
          border: 1px solid var(--divider-color);
          border-radius: 8px;
        }
        .user-info {
          display: flex;
          flex-direction: column;
        }
        .user-name {
          font-weight: 500;
        }
        .user-topic {
          font-size: 13px;
          color: var(--secondary-text-color);
        }
        .section-label {
          font-weight: 500;
          margin-top: 8px;
          border-top: 1px solid var(--divider-color);
          padding-top: 8px;
          font-size: 14px;
          color: var(--primary-text-color);
        }
      </style>
      <div class="toolbar">
        <div class="toolbar-title">ntfy Alerts</div>
        <div class="toolbar-actions">
          <button class="secondary" id="users-btn">Users</button>
          <button class="unelevated" id="new-rule-btn">＋ New Rule</button>
        </div>
      </div>
      <div class="content" id="content"></div>
    `;

    this.querySelector("#users-btn").onclick = () => this._openUserManager();
    this.querySelector("#new-rule-btn").onclick = () => this._openNewRuleDialog();
    this._renderContent();
  }

  _renderLoading() {
    return '<div class="center"><ha-circular-progress active></ha-circular-progress></div>';
  }

  _renderError() {
    return '<div class="error">Unable to connect to the ntfy Alerts integration. Make sure it is installed and configured.</div>';
  }

  _renderEmpty() {
    return '<div class="empty">No rules yet. Create one!</div>';
  }

  _renderRules() {
    return this._rules.map((rule) => `
      <div class="rule-row">
        <div class="rule-info">
          <div class="rule-name">${this._escapeHtml(rule.name)}</div>
          <div class="rule-entity">${this._escapeHtml(rule.entity_id)}</div>
          <div class="rule-subscribers">→ ${this._escapeHtml(this._getSubscriberNames(rule.subscribers || []).join(", "))}</div>
        </div>
        <div class="rule-actions">
          <label class="rule-toggle">
            <input type="checkbox" ${rule.enabled !== false ? "checked" : ""} data-rule-id="${this._escapeHtml(rule.rule_id)}">
            <span class="slider"></span>
          </label>
          <button class="delete-btn" data-rule-id="${this._escapeHtml(rule.rule_id)}">✕</button>
        </div>
      </div>
    `).join("");
  }

  _escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
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
      content.querySelectorAll('.rule-toggle input[type="checkbox"]').forEach((cb) => {
        cb.onchange = () => {
          this._toggleRule(cb.dataset.ruleId, cb.checked);
        };
      });
      content.querySelectorAll(".delete-btn").forEach((btn) => {
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

  async _loadRules() {
    if (!this._hass) return;
    this._loading = true;
    this._loadError = false;
    this._renderContent();
    try {
      const result = await this._hass.callWS({
        type: "ntfy_alerts/get_rules",
      });
      this._rules = result.rules || [];
      this._users = result.users || {};
      this._retryCount = 0;
      this._loadError = false;
      this._loading = false;
      this._renderContent();
    } catch (e) {
      const code = e?.code || e;
      console.error("Failed to load ntfy rules:", { code, error: e });
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
    this._hass.callWS({
      type: "ntfy_alerts/update_rule",
      rule_id: ruleId,
      updates: { enabled },
    });
    const rule = this._rules.find((r) => r.rule_id === ruleId);
    if (rule) rule.enabled = enabled;
  }

  async _deleteRule(ruleId) {
    if (!this._hass) return;
    await this._hass.callWS({
      type: "ntfy_alerts/delete_rule",
      rule_id: ruleId,
    });
    this._rules = this._rules.filter((r) => r.rule_id !== ruleId);
    this._renderContent();
  }

  _openNewRuleDialog() {
    if (this._dialog) return;
    this._dialog = this._createDialog(null);
  }

  _openUserManager() {
    if (this._dialog) return;
    this._dialog = this._createDialog("users");
  }

  _closeDialog() {
    if (this._dialog) {
      this._dialog.remove();
      this._dialog = null;
    }
  }

  _createDialog(type) {
    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";
    overlay.onclick = (e) => {
      if (e.target === overlay) this._closeDialog();
    };
    document.body.appendChild(overlay);

    if (type === "users") {
      this._renderUserManager(overlay);
    } else {
      this._renderRuleEditor(overlay);
    }

    return overlay;
  }

  _renderRuleEditor(overlay) {
    const dialog = document.createElement("div");
    dialog.className = "dialog";

    let name = "", entityId = "", fromState = "", toState = "";
    let subscribers = [];
    let title = "", body = "", priority = 3, tags = "", cooldown = 60;

    dialog.innerHTML = `
      <h2>New Rule</h2>
      <div class="form">
        <label>Rule Name <input type="text" id="rule-name" value="" required></label>
        <label>Entity ID <input type="text" id="rule-entity" value="" placeholder="e.g. sensor.temperature" required></label>
        <div class="field-row">
          <label>From State (optional) <input type="text" id="rule-from" value=""></label>
          <label>To State (optional) <input type="text" id="rule-to" value=""></label>
        </div>
        <div class="section-label">Subscribers</div>
        <div class="checkbox-group" id="subscribers-list"></div>
        <div class="section-label">Message</div>
        <label>Title (supports templates) <input type="text" id="rule-title" value=""></label>
        <label>Body (supports templates) <textarea id="rule-body"></textarea></label>
        <div class="section-label">Options</div>
        <label>Priority (1-5) <input type="range" id="rule-priority" min="1" max="5" value="3"></label>
        <label>Tags (comma separated) <input type="text" id="rule-tags" value=""></label>
        <label>Cooldown (seconds) <input type="number" id="rule-cooldown" value="60"></label>
      </div>
      <div class="dialog-actions">
        <button class="secondary" id="cancel-btn">Cancel</button>
        <button class="primary" id="save-btn" disabled>Save</button>
      </div>
    `;

    overlay.appendChild(dialog);

    // Subscribers
    const subsList = dialog.querySelector("#subscribers-list");
    Object.entries(this._users).forEach(([userId, user]) => {
      const label = document.createElement("label");
      label.className = "checkbox-label";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = subscribers.includes(userId);
      cb.onchange = () => {
        if (cb.checked) subscribers.push(userId);
        else subscribers = subscribers.filter((id) => id !== userId);
      };
      label.appendChild(cb);
      label.appendChild(document.createTextNode(user.name || userId));
      subsList.appendChild(label);
    });

    const saveBtn = dialog.querySelector("#save-btn");
    const nameInput = dialog.querySelector("#rule-name");
    const entityInput = dialog.querySelector("#rule-entity");
    const priorityInput = dialog.querySelector("#rule-priority");
    const priorityDisplay = document.createElement("span");
    priorityInput.parentNode.appendChild(priorityDisplay);

    const updateSaveBtn = () => {
      saveBtn.disabled = !nameInput.value || !entityInput.value;
    };

    const updatePriority = () => {
      priorityDisplay.textContent = ` ${priorityInput.value}`;
    };

    nameInput.oninput = updateSaveBtn;
    entityInput.oninput = updateSaveBtn;
    priorityInput.oninput = updatePriority;
    updatePriority();

    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving\u2026";
      try {
        await this._hass.callWS({
          type: "ntfy_alerts/save_rule",
          rule: {
            name: nameInput.value,
            entity_id: entityInput.value,
            conditions: {
              from_state: dialog.querySelector("#rule-from").value || null,
              to_state: dialog.querySelector("#rule-to").value || null,
            },
            subscribers,
            message: {
              title: dialog.querySelector("#rule-title").value,
              body: dialog.querySelector("#rule-body").value,
              priority: parseInt(priorityInput.value),
              tags: dialog.querySelector("#rule-tags").value,
            },
            cooldown_seconds: parseInt(dialog.querySelector("#rule-cooldown").value) || 60,
            enabled: true,
          },
        });
        this._closeDialog();
        this._loadRules();
      } catch (e) {
        alert("Failed to save rule: " + (e?.message || e));
        saveBtn.disabled = false;
        saveBtn.textContent = "Save";
      }
    };

    dialog.querySelector("#cancel-btn").onclick = () => this._closeDialog();
  }

  _renderUserManager(overlay) {
    const dialog = document.createElement("div");
    dialog.className = "dialog";

    let newName = "", newTopic = "";

    dialog.innerHTML = `
      <h2>Manage Users</h2>
      <div class="user-list" id="user-list"></div>
      <div class="section-label">Add User</div>
      <div class="field-row">
        <label>Name <input type="text" id="new-name" value=""></label>
        <label>Topic <input type="text" id="new-topic" value=""></label>
        <button class="primary" id="add-btn" style="margin-top:18px" disabled>Add</button>
      </div>
      <div class="dialog-actions">
        <button class="secondary" id="close-btn">Close</button>
      </div>
    `;

    overlay.appendChild(dialog);

    const renderUsers = () => {
      const userList = dialog.querySelector("#user-list");
      userList.innerHTML = Object.entries(this._users).map(([userId, user]) => `
        <div class="user-row">
          <div class="user-info">
            <span class="user-name">${this._escapeHtml(user.name)}</span>
            <span class="user-topic">${this._escapeHtml(user.topic)}</span>
          </div>
          <button class="delete-btn" data-user-id="${this._escapeHtml(userId)}">✕</button>
        </div>
      `).join("");
      userList.querySelectorAll(".delete-btn").forEach((btn) => {
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

    addBtn.onclick = async () => {
      const name = nameInput.value;
      const topic = topicInput.value;
      nameInput.value = "";
      topicInput.value = "";
      updateAddBtn();
      try {
        const result = await this._hass.callWS({
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
      await this._hass.callWS({
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

customElements.define("ntfy-alerts-panel", NtfyAlertsPanel);
