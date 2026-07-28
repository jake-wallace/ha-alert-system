class NtfyAlertsPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._rules = [];
    this._users = {};
    this._loading = true;
    this._loadError = false;
    this._retryCount = 0;
    this._retryTimer = null;
    this._showNewRuleDialog = false;
    this._showUserManager = false;
    this._dialogContainer = null;
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
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .panel {
          padding: 0;
        }
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
        .delete-btn {
          color: var(--error-color);
          min-width: 0;
          padding: 0 8px;
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
      </style>
      <div class="panel">
        <div class="toolbar">
          <div class="toolbar-title">ntfy Alerts</div>
          <div class="toolbar-actions"></div>
        </div>
        <div class="content"></div>
      </div>
    `;
    this._renderToolbar();
    this._renderContent();
  }

  _renderToolbar() {
    const actions = this.shadowRoot.querySelector(".toolbar-actions");
    actions.innerHTML = "";

    const usersBtn = document.createElement("ha-button");
    usersBtn.setAttribute("outlined", "");
    usersBtn.textContent = "Users";
    usersBtn.addEventListener("click", () => this._openUserManager());
    actions.appendChild(usersBtn);

    const newRuleBtn = document.createElement("ha-button");
    newRuleBtn.setAttribute("unelevated", "");
    newRuleBtn.textContent = "＋ New Rule";
    newRuleBtn.addEventListener("click", () => this._openNewRuleDialog());
    actions.appendChild(newRuleBtn);
  }

  _renderContent() {
    const content = this.shadowRoot.querySelector(".content");
    content.innerHTML = "";

    if (this._loading) {
      const center = document.createElement("div");
      center.className = "center";
      const spinner = document.createElement("ha-circular-progress");
      spinner.setAttribute("active", "");
      center.appendChild(spinner);
      content.appendChild(center);
    } else if (this._loadError) {
      const error = document.createElement("div");
      error.className = "error";
      error.textContent =
        "Unable to connect to the ntfy Alerts integration. Make sure it is installed and configured.";
      content.appendChild(error);
    } else if (this._rules.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No rules yet. Create one!";
      content.appendChild(empty);
    } else {
      const list = document.createElement("div");
      list.className = "rules-list";
      this._rules.forEach((rule) => {
        const row = this._createRuleRow(rule);
        list.appendChild(row);
      });
      content.appendChild(list);
    }
  }

  _createRuleRow(rule) {
    const row = document.createElement("div");
    row.className = "rule-row";

    const info = document.createElement("div");
    info.className = "rule-info";

    const name = document.createElement("div");
    name.className = "rule-name";
    name.textContent = rule.name;
    info.appendChild(name);

    const entity = document.createElement("div");
    entity.className = "rule-entity";
    entity.textContent = rule.entity_id;
    info.appendChild(entity);

    const subs = document.createElement("div");
    subs.className = "rule-subscribers";
    subs.textContent = `→ ${this._getSubscriberNames(rule.subscribers || []).join(", ")}`;
    info.appendChild(subs);

    row.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const toggle = document.createElement("ha-switch");
    toggle.checked = rule.enabled !== false;
    toggle.addEventListener("change", () => {
      this._toggleRule(rule.rule_id, toggle.checked);
    });
    actions.appendChild(toggle);

    const deleteBtn = document.createElement("ha-button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", () => {
      this._deleteRule(rule.rule_id);
    });
    actions.appendChild(deleteBtn);

    row.appendChild(actions);
    return row;
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
    this._hass.callWS({
      type: "ntfy_alerts/update_rule",
      rule_id: ruleId,
      updates: { enabled },
    });
    const rule = this._rules.find((r) => r.rule_id === ruleId);
    if (rule) rule.enabled = enabled;
  }

  async _deleteRule(ruleId) {
    await this._hass.callWS({
      type: "ntfy_alerts/delete_rule",
      rule_id: ruleId,
    });
    this._rules = this._rules.filter((r) => r.rule_id !== ruleId);
    this._renderContent();
  }

  _openNewRuleDialog() {
    if (this._dialogContainer) return;
    this._dialogContainer = document.createElement("div");
    this.appendChild(this._dialogContainer);

    const editor = document.createElement("ntfy-rule-editor");
    editor._hass = this._hass;
    editor._users = this._users;
    editor.addEventListener("dialog-closed", () => {
      this._dialogContainer.remove();
      this._dialogContainer = null;
      this._loadRules();
    });
    this._dialogContainer.appendChild(editor);
  }

  _openUserManager() {
    if (this._dialogContainer) return;
    this._dialogContainer = document.createElement("div");
    this.appendChild(this._dialogContainer);

    const mgr = document.createElement("ntfy-user-manager");
    mgr._hass = this._hass;
    mgr._users = this._users;
    mgr.addEventListener("dialog-closed", () => {
      this._dialogContainer.remove();
      this._dialogContainer = null;
    });
    mgr.addEventListener("users-changed", () => {
      this._loadRules();
    });
    this._dialogContainer.appendChild(mgr);
  }
}

customElements.define("ntfy-alerts-panel", NtfyAlertsPanel);

class NtfyRuleEditor extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._users = {};
    this._editMode = false;
    this._rule = null;
    this._name = "";
    this._entityId = "";
    this._fromState = "";
    this._toState = "";
    this._subscribers = [];
    this._title = "";
    this._body = "";
    this._priority = 3;
    this._tags = "";
    this._cooldown = 60;
    this._saving = false;
    this._dialog = null;
  }

  set _rule(rule) {
    this._editMode = !!rule;
    this._ruleValue = rule;
    if (rule) {
      this._name = rule.name || "";
      this._entityId = rule.entity_id || "";
      this._fromState = rule.conditions?.from_state || "";
      this._toState = rule.conditions?.to_state || "";
      this._subscribers = rule.subscribers || [];
      this._title = rule.message?.title || "";
      this._body = rule.message?.body || "";
      this._priority = rule.message?.priority || 3;
      this._tags = rule.message?.tags || "";
      this._cooldown = rule.cooldown_seconds || 60;
    }
  }

  get _rule() {
    return this._ruleValue;
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    if (this._dialog) {
      this._dialog.remove();
      this._dialog = null;
    }
  }

  render() {
    this.innerHTML = "";

    this._dialog = document.createElement("ha-dialog");
    this._dialog.setAttribute("open", "");
    this._dialog.heading = this._editMode ? "Edit Rule" : "New Rule";
    this._dialog.addEventListener("closed", () => {
      this.dispatchEvent(new CustomEvent("dialog-closed"));
    });

    const form = document.createElement("div");
    form.style.cssText =
      "display:flex;flex-direction:column;gap:12px;min-width:400px;";

    // Rule Name
    const nameField = this._createTextField("Rule Name", this._name, (v) => {
      this._name = v;
    });
    nameField.setAttribute("required", "");
    form.appendChild(nameField);

    // Entity Picker
    const picker = document.createElement("ha-entity-picker");
    picker.hass = this._hass;
    picker.value = this._entityId;
    picker.addEventListener("value-changed", (e) => {
      if (e.detail.value) this._entityId = e.detail.value;
    });
    form.appendChild(picker);

    // Conditions Row
    const conditionsRow = document.createElement("div");
    conditionsRow.style.cssText = "display:flex;gap:8px;";

    const fromField = this._createTextField(
      "From State (optional)",
      this._fromState,
      (v) => { this._fromState = v; }
    );
    conditionsRow.appendChild(fromField);

    const toField = this._createTextField(
      "To State (optional)",
      this._toState,
      (v) => { this._toState = v; }
    );
    conditionsRow.appendChild(toField);
    form.appendChild(conditionsRow);

    // Subscribers section
    const subsLabel = document.createElement("div");
    subsLabel.className = "section-label";
    subsLabel.style.cssText =
      "font-weight:500;margin-top:8px;border-top:1px solid var(--divider-color);padding-top:8px;";
    subsLabel.textContent = "Subscribers";
    form.appendChild(subsLabel);

    const subsList = document.createElement("div");
    subsList.style.cssText = "display:flex;flex-direction:column;gap:4px;";
    Object.entries(this._users).forEach(([userId, user]) => {
      const formField = document.createElement("ha-formfield");
      formField.label = user.name || userId;

      const checkbox = document.createElement("ha-checkbox");
      checkbox.checked = this._subscribers.includes(userId);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          this._subscribers = [...this._subscribers, userId];
        } else {
          this._subscribers = this._subscribers.filter((id) => id !== userId);
        }
      });
      formField.appendChild(checkbox);
      subsList.appendChild(formField);
    });
    form.appendChild(subsList);

    // Message section
    const msgLabel = document.createElement("div");
    msgLabel.className = "section-label";
    msgLabel.style.cssText =
      "font-weight:500;margin-top:8px;border-top:1px solid var(--divider-color);padding-top:8px;";
    msgLabel.textContent = "Message";
    form.appendChild(msgLabel);

    const titleField = this._createTextField(
      "Title (supports templates)",
      this._title,
      (v) => { this._title = v; }
    );
    form.appendChild(titleField);

    const bodyArea = document.createElement("ha-textarea");
    bodyArea.label = "Body (supports templates)";
    bodyArea.value = this._body;
    bodyArea.addEventListener("input", (e) => {
      this._body = e.target.value;
    });
    form.appendChild(bodyArea);

    // Options section
    const optsLabel = document.createElement("div");
    optsLabel.className = "section-label";
    optsLabel.style.cssText =
      "font-weight:500;margin-top:8px;border-top:1px solid var(--divider-color);padding-top:8px;";
    optsLabel.textContent = "Options";
    form.appendChild(optsLabel);

    const optionsRow = document.createElement("div");
    optionsRow.style.cssText = "display:flex;align-items:center;gap:16px;";

    const slider = document.createElement("ha-slider");
    slider.value = this._priority;
    slider.min = 1;
    slider.max = 5;
    slider.step = 1;
    slider.setAttribute("pin", "");
    slider.addEventListener("change", (e) => {
      this._priority = parseInt(e.target.value);
      priorityLabel.textContent = `Priority: ${this._priority}`;
    });
    optionsRow.appendChild(slider);

    const priorityLabel = document.createElement("span");
    priorityLabel.textContent = `Priority: ${this._priority}`;
    optionsRow.appendChild(priorityLabel);
    form.appendChild(optionsRow);

    const tagsField = this._createTextField(
      "Tags (comma separated)",
      this._tags,
      (v) => { this._tags = v; }
    );
    form.appendChild(tagsField);

    const cooldownField = this._createTextField("Cooldown (seconds)", String(this._cooldown), (v) => {
      this._cooldown = parseInt(v) || 0;
    });
    cooldownField.type = "number";
    form.appendChild(cooldownField);

    this._dialog.appendChild(form);

    // Save button
    const saveBtn = document.createElement("ha-button");
    saveBtn.setAttribute("slot", "primaryAction");
    saveBtn.textContent = this._saving ? "Saving\u2026" : "Save";
    saveBtn.disabled = this._saving || !this._name || !this._entityId;
    saveBtn.addEventListener("click", () => this._save());
    this._dialog.appendChild(saveBtn);

    // Cancel button
    const cancelBtn = document.createElement("ha-button");
    cancelBtn.setAttribute("slot", "secondaryAction");
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("dialog-closed"));
    });
    this._dialog.appendChild(cancelBtn);

    this.appendChild(this._dialog);
  }

  _createTextField(label, value, onChange) {
    const field = document.createElement("ha-textfield");
    field.label = label;
    field.value = value;
    field.addEventListener("input", (e) => {
      onChange(e.target.value);
      this._updateSaveButton();
    });
    return field;
  }

  _updateSaveButton() {
    if (!this._dialog) return;
    const btns = this._dialog.querySelectorAll('ha-button[slot="primaryAction"]');
    btns.forEach((btn) => {
      btn.disabled = this._saving || !this._name || !this._entityId;
    });
  }

  async _save() {
    this._saving = true;
    this._updateSaveButton();
    const ruleData = {
      name: this._name,
      entity_id: this._entityId,
      conditions: {
        from_state: this._fromState || null,
        to_state: this._toState || null,
      },
      subscribers: this._subscribers,
      message: {
        title: this._title,
        body: this._body,
        priority: this._priority,
        tags: this._tags,
      },
      cooldown_seconds: this._cooldown,
      enabled: true,
    };

    try {
      if (this._editMode) {
        await this._hass.callWS({
          type: "ntfy_alerts/update_rule",
          rule_id: this._rule.rule_id,
          updates: ruleData,
        });
      } else {
        await this._hass.callWS({
          type: "ntfy_alerts/save_rule",
          rule: ruleData,
        });
      }
      this.dispatchEvent(new CustomEvent("dialog-closed"));
    } catch (e) {
      alert("Failed to save rule: " + (e.message || e));
    }
    this._saving = false;
  }
}

customElements.define("ntfy-rule-editor", NtfyRuleEditor);

class NtfyUserManager extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._users = {};
    this._newName = "";
    this._newTopic = "";
    this._dialog = null;
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    if (this._dialog) {
      this._dialog.remove();
      this._dialog = null;
    }
  }

  render() {
    this.innerHTML = "";

    this._dialog = document.createElement("ha-dialog");
    this._dialog.setAttribute("open", "");
    this._dialog.heading = "Manage Users";
    this._dialog.addEventListener("closed", () => {
      this.dispatchEvent(new CustomEvent("dialog-closed"));
    });

    const container = document.createElement("div");
    container.style.cssText = "display:flex;flex-direction:column;gap:16px;min-width:400px;";

    // Existing users
    const userList = document.createElement("div");
    userList.className = "user-list";
    userList.style.cssText = "display:flex;flex-direction:column;gap:8px;";

    Object.entries(this._users).forEach(([userId, user]) => {
      const userRow = document.createElement("div");
      userRow.className = "user-row";
      userRow.style.cssText =
        "display:flex;align-items:center;justify-content:space-between;padding:8px;border:1px solid var(--divider-color);border-radius:8px;";

      const userInfo = document.createElement("div");
      userInfo.className = "user-info";
      userInfo.style.cssText = "display:flex;flex-direction:column;";

      const userName = document.createElement("span");
      userName.className = "user-name";
      userName.style.cssText = "font-weight:500;";
      userName.textContent = user.name;
      userInfo.appendChild(userName);

      const userTopic = document.createElement("span");
      userTopic.className = "user-topic";
      userTopic.style.cssText = "font-size:13px;color:var(--secondary-text-color);";
      userTopic.textContent = user.topic;
      userInfo.appendChild(userTopic);

      userRow.appendChild(userInfo);

      const removeBtn = document.createElement("ha-button");
      removeBtn.className = "remove-btn";
      removeBtn.style.cssText = "color:var(--error-color);min-width:0;padding:0 8px;";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", () => this._removeUser(userId));
      userRow.appendChild(removeBtn);

      userList.appendChild(userRow);
    });

    container.appendChild(userList);

    // Add user form
    const addRow = document.createElement("div");
    addRow.className = "add-row";
    addRow.style.cssText = "display:flex;gap:8px;align-items:flex-start;";

    const nameField = document.createElement("ha-textfield");
    nameField.label = "Name";
    nameField.value = this._newName;
    nameField.addEventListener("input", (e) => { this._newName = e.target.value; });
    nameField.style.cssText = "flex:1;";
    addRow.appendChild(nameField);

    const topicField = document.createElement("ha-textfield");
    topicField.label = "Topic";
    topicField.value = this._newTopic;
    topicField.addEventListener("input", (e) => { this._newTopic = e.target.value; });
    topicField.style.cssText = "flex:1;";
    addRow.appendChild(topicField);

    const addBtn = document.createElement("ha-button");
    addBtn.setAttribute("unelevated", "");
    addBtn.textContent = "Add";
    addBtn.addEventListener("click", () => this._addUser());
    addRow.appendChild(addBtn);

    container.appendChild(addRow);

    this._dialog.appendChild(container);

    // Close button
    const closeBtn = document.createElement("ha-button");
    closeBtn.setAttribute("slot", "primaryAction");
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("dialog-closed"));
    });
    this._dialog.appendChild(closeBtn);

    this.appendChild(this._dialog);
  }

  async _addUser() {
    if (!this._newName || !this._newTopic) return;
    const name = this._newName;
    const topic = this._newTopic;
    this._newName = "";
    this._newTopic = "";
    try {
      const result = await this._hass.callWS({
        type: "ntfy_alerts/add_user",
        name: name,
        topic: topic,
      });
      this._users[result.user_id] = { name, topic };
      this.dispatchEvent(new CustomEvent("users-changed"));
      this.render();
    } catch (e) {
      alert("Failed to add user: " + (e.message || e));
    }
  }

  async _removeUser(userId) {
    try {
      await this._hass.callWS({
        type: "ntfy_alerts/remove_user",
        user_id: userId,
      });
      delete this._users[userId];
      this.dispatchEvent(new CustomEvent("users-changed"));
      this.render();
    } catch (e) {
      alert("Failed to remove user: " + (e.message || e));
    }
  }
}

customElements.define("ntfy-user-manager", NtfyUserManager);
