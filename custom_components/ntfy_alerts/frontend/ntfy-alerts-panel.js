import { LitElement, html, css } from "https://cdn.jsdelivr.net/npm/lit@3/+esm";

class NtfyRuleEditor extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      users: { type: Object },
      rule: { type: Object },
      _name: { type: String },
      _entityId: { type: String },
      _fromState: { type: String },
      _toState: { type: String },
      _subscribers: { type: Array },
      _title: { type: String },
      _body: { type: String },
      _priority: { type: Number },
      _tags: { type: String },
      _cooldown: { type: Number },
      _saving: { type: Boolean },
    };
  }

  constructor() {
    super();
    this.rule = null;
    this.users = {};
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
    this._editMode = false;
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.rule) {
      this._editMode = true;
      this._name = this.rule.name || "";
      this._entityId = this.rule.entity_id || "";
      this._fromState = this.rule.conditions?.from_state || "";
      this._toState = this.rule.conditions?.to_state || "";
      this._subscribers = this.rule.subscribers || [];
      this._title = this.rule.message?.title || "";
      this._body = this.rule.message?.body || "";
      this._priority = this.rule.message?.priority || 3;
      this._tags = this.rule.message?.tags || "";
      this._cooldown = this.rule.cooldown_seconds || 60;
    }
  }

  get _users() {
    return this.users || {};
  }

  _toggleSubscriber(userId) {
    if (this._subscribers.includes(userId)) {
      this._subscribers = this._subscribers.filter((id) => id !== userId);
    } else {
      this._subscribers = [...this._subscribers, userId];
    }
  }

  async _save() {
    this._saving = true;
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
        await this.hass.callWS({
          type: "ntfy_alerts/update_rule",
          rule_id: this.rule.rule_id,
          updates: ruleData,
        });
      } else {
        await this.hass.callWS({
          type: "ntfy_alerts/save_rule",
          rule: ruleData,
        });
      }
      this.dispatchEvent(new CustomEvent("dialog-closed"));
    } catch (e) {
      alert("Failed to save rule: " + e.message);
    }
    this._saving = false;
  }

  render() {
    return html`
      <ha-dialog
        open
        @closed=${() => this.dispatchEvent(new CustomEvent("dialog-closed"))}
        .heading=${this._editMode ? "Edit Rule" : "New Rule"}
      >
        <div class="form">
          <ha-textfield
            label="Rule Name"
            .value=${this._name}
            @input=${(e) => (this._name = e.target.value)}
            required
          ></ha-textfield>

          <ha-entity-picker
            .hass=${this.hass}
            .value=${this._entityId}
            @value-changed=${(e) => {
              if (e.detail.value) this._entityId = e.detail.value;
            }}
          ></ha-entity-picker>

          <div class="conditions-row">
            <ha-textfield
              label="From State (optional)"
              .value=${this._fromState}
              @input=${(e) => (this._fromState = e.target.value)}
            ></ha-textfield>
            <ha-textfield
              label="To State (optional)"
              .value=${this._toState}
              @input=${(e) => (this._toState = e.target.value)}
            ></ha-textfield>
          </div>

          <div class="section-label">Subscribers</div>
          <div class="subscribers-list">
            ${Object.entries(this._users).map(
              ([userId, user]) => html`
                <ha-formfield .label=${user.name || userId}>
                  <ha-checkbox
                    ?checked=${this._subscribers.includes(userId)}
                    @change=${() => this._toggleSubscriber(userId)}
                  ></ha-checkbox>
                </ha-formfield>
              `
            )}
          </div>

          <div class="section-label">Message</div>
          <ha-textfield
            label="Title (supports templates)"
            .value=${this._title}
            @input=${(e) => (this._title = e.target.value)}
          ></ha-textfield>
          <ha-textarea
            label="Body (supports templates)"
            .value=${this._body}
            @input=${(e) => (this._body = e.target.value)}
          ></ha-textarea>

          <div class="section-label">Options</div>
          <div class="options-row">
            <ha-slider
              .value=${this._priority}
              @change=${(e) => (this._priority = parseInt(e.target.value))}
              min="1"
              max="5"
              step="1"
              pin
            ></ha-slider>
            <span>Priority: ${this._priority}</span>
          </div>
          <ha-textfield
            label="Tags (comma separated)"
            .value=${this._tags}
            @input=${(e) => (this._tags = e.target.value)}
          ></ha-textfield>
          <ha-textfield
            label="Cooldown (seconds)"
            type="number"
            .value=${this._cooldown}
            @input=${(e) => (this._cooldown = parseInt(e.target.value) || 0)}
          ></ha-textfield>
        </div>

        <ha-button
          slot="primaryAction"
          @click=${this._save}
          ?disabled=${this._saving || !this._name || !this._entityId}
        >
          ${this._saving ? "Saving\u2026" : "Save"}
        </ha-button>
        <ha-button
          slot="secondaryAction"
          @click=${() => this.dispatchEvent(new CustomEvent("dialog-closed"))}
        >
          Cancel
        </ha-button>
      </ha-dialog>
    `;
  }

  static get styles() {
    return css`
      .form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 400px;
      }
      .conditions-row {
        display: flex;
        gap: 8px;
      }
      .conditions-row ha-textfield {
        flex: 1;
      }
      .section-label {
        font-weight: 500;
        margin-top: 8px;
        border-top: 1px solid var(--divider-color);
        padding-top: 8px;
      }
      .subscribers-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .options-row {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .options-row ha-slider {
        flex: 1;
      }
    `;
  }
}

customElements.define("ntfy-rule-editor", NtfyRuleEditor);

class NtfyUserManager extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      users: { type: Object },
      _newName: { type: String },
      _newTopic: { type: String },
      _saving: { type: Boolean },
    };
  }

  constructor() {
    super();
    this.users = {};
    this._newName = "";
    this._newTopic = "";
    this._saving = false;
  }

  get _users() {
    return this.users || {};
  }

  async _addUser() {
    if (!this._newName || !this._newTopic) return;
    this._saving = true;
    try {
      await this.hass.callWS({
        type: "ntfy_alerts/add_user",
        name: this._newName,
        topic: this._newTopic,
      });
      this._newName = "";
      this._newTopic = "";
      this.dispatchEvent(new CustomEvent("users-changed"));
    } catch (e) {
      alert("Failed to add user: " + e.message);
    }
    this._saving = false;
  }

  async _removeUser(userId) {
    if (!confirm("Remove this user?")) return;
    try {
      await this.hass.callWS({
        type: "ntfy_alerts/remove_user",
        user_id: userId,
      });
      this.dispatchEvent(new CustomEvent("users-changed"));
    } catch (e) {
      alert("Failed to remove user: " + e.message);
    }
  }

  render() {
    return html`
      <ha-dialog
        open
        @closed=${() => this.dispatchEvent(new CustomEvent("dialog-closed"))}
        .heading=${"User ntfy Topics"}
      >
        <div class="user-list">
          ${Object.entries(this._users).map(
            ([userId, user]) => html`
              <div class="user-row">
                <div class="user-info">
                  <span class="user-name">${user.name}</span>
                  <span class="user-topic">${user.topic}</span>
                </div>
                <ha-button
                  @click=${() => this._removeUser(userId)}
                  class="remove-btn"
                >
                  ✕
                </ha-button>
              </div>
            `
          )}
          <div class="add-row">
            <ha-textfield
              label="Name"
              .value=${this._newName}
              @input=${(e) => (this._newName = e.target.value)}
            ></ha-textfield>
            <ha-textfield
              label="ntfy Topic"
              .value=${this._newTopic}
              @input=${(e) => (this._newTopic = e.target.value)}
            ></ha-textfield>
            <ha-button
              @click=${this._addUser}
              ?disabled=${this._saving || !this._newName || !this._newTopic}
            >
              ${this._saving ? "Adding\u2026" : "Add"}
            </ha-button>
          </div>
        </div>

        <ha-button
          slot="primaryAction"
          @click=${() => this.dispatchEvent(new CustomEvent("dialog-closed"))}
        >
          Done
        </ha-button>
      </ha-dialog>
    `;
  }

  static get styles() {
    return css`
      .user-list {
        min-width: 400px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .user-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        background: var(--secondary-background-color);
        border-radius: 4px;
      }
      .user-info {
        display: flex;
        flex-direction: column;
      }
      .user-name {
        font-weight: 500;
      }
      .user-topic {
        font-size: 12px;
        color: var(--secondary-text-color);
      }
      .remove-btn {
        color: var(--error-color);
      }
      .add-row {
        display: flex;
        gap: 8px;
        margin-top: 12px;
        align-items: center;
      }
      .add-row ha-textfield {
        flex: 1;
      }
    `;
  }
}

customElements.define("ntfy-user-manager", NtfyUserManager);

class NtfyAlertsPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      rules: { type: Array },
      users: { type: Object },
      loading: { type: Boolean },
      _showNewRuleDialog: { type: Boolean },
      _showUserManager: { type: Boolean },
    };
  }

  constructor() {
    super();
    this.rules = [];
    this.users = {};
    this.loading = true;
    this._showNewRuleDialog = false;
    this._showUserManager = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this._retryCount = 0;
    this._retryTimer = null;
    this._loadError = false;
    this._loadRules();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
  }

  updated(changedProps) {
    super.updated(changedProps);
    if (changedProps.has("hass") && this.hass) {
      this._loadRules();
    }
  }

  async _loadRules() {
    if (!this.hass) return;
    this.loading = true;
    this._loadError = false;
    try {
      const result = await this.hass.callWS({
        type: "ntfy_alerts/get_rules",
      });
      this.rules = result.rules || [];
      this.users = result.users || {};
      this._retryCount = 0;
      this._loadError = false;
    } catch (e) {
      console.error("Failed to load ntfy rules:", e);
      this.rules = [];
      if (e.code === "unknown_command" && this._retryCount < 5) {
        this._retryCount++;
        const delay = Math.min(1000 * 2 ** (this._retryCount - 1), 16000);
        this._retryTimer = setTimeout(() => this._loadRules(), delay);
      } else {
        this._loadError = true;
      }
    }
    this.loading = false;
  }

  _toggleRule(ruleId, enabled) {
    this.hass.callWS({
      type: "ntfy_alerts/update_rule",
      rule_id: ruleId,
      updates: { enabled },
    });
    const rule = this.rules.find((r) => r.rule_id === ruleId);
    if (rule) rule.enabled = enabled;
    this.requestUpdate();
  }

  _deleteRule(ruleId) {
    if (!confirm("Delete this rule?")) return;
    this.hass.callWS({
      type: "ntfy_alerts/delete_rule",
      rule_id: ruleId,
    });
    this.rules = this.rules.filter((r) => r.rule_id !== ruleId);
  }

  _getSubscriberNames() {
    return (userId) => this.users[userId]?.name || userId;
  }

  _handleUserManagerDialogClosed() {
    this._showUserManager = false;
    this._loadRules();
  }

  render() {
    return html`
      <ha-app-layout>
        <app-header fixed slot="header">
          <app-toolbar>
            <ha-menu-button .hass=${this.hass}></ha-menu-button>
            <div main-title>ntfy Alerts</div>
            <span flex></span>
            <ha-icon-button
              icon="mdi:account-group"
              @click=${() => (this._showUserManager = true)}
              label="Users"
            ></ha-icon-button>
            <ha-icon-button
              icon="mdi:plus"
              @click=${() => (this._showNewRuleDialog = true)}
              label="New Rule"
            ></ha-icon-button>
          </app-toolbar>
        </app-header>
        <div class="content">
          ${this.loading
            ? html`<div class="center"><ha-circular-progress active></ha-circular-progress></div>`
            : this._loadError
              ? html`<div class="error">
                  Unable to connect to the ntfy Alerts integration.
                  Make sure it is installed and configured.
                </div>`
              : html`
                  <div class="rules-list">
                    ${this.rules.length === 0
                      ? html`<div class="empty">No rules yet. Create one!</div>`
                      : this.rules.map(
                          (rule) => html`
                            <div class="rule-row">
                              <div class="rule-info">
                                <div class="rule-name">${rule.name}</div>
                                <div class="rule-entity">${rule.entity_id}</div>
                                <div class="rule-subscribers">
                                  → ${(rule.subscribers || [])
                                    .map(this._getSubscriberNames())
                                    .join(", ")}
                                </div>
                              </div>
                              <div class="rule-actions">
                                <ha-switch
                                  ?checked=${rule.enabled}
                                  @change=${(e) =>
                                    this._toggleRule(rule.rule_id, e.target.checked)}
                                ></ha-switch>
                                <ha-icon-button
                                  icon="mdi:delete"
                                  @click=${() => this._deleteRule(rule.rule_id)}
                                  class="delete-btn"
                                ></ha-icon-button>
                              </div>
                            </div>
                          `
                        )}
                  </div>
                `}
        </div>
      </ha-app-layout>

      ${this._showNewRuleDialog
        ? html`
            <ntfy-rule-editor
              .hass=${this.hass}
              .users=${this.users}
              @dialog-closed=${() => {
                this._showNewRuleDialog = false;
                this._loadRules();
              }}
            ></ntfy-rule-editor>
          `
        : ""}
      ${this._showUserManager
        ? html`
            <ntfy-user-manager
              .hass=${this.hass}
              .users=${this.users}
              @dialog-closed=${this._handleUserManagerDialogClosed}
              @users-changed=${this._loadRules}
            ></ntfy-user-manager>
          `
        : ""}
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
        height: 100%;
      }
      ha-app-layout {
        height: 100%;
      }
      .content {
        padding: 16px;
      }
      .center {
        display: flex;
        justify-content: center;
        padding: 48px;
      }
      .rules-list {
        max-width: 800px;
      }
      .rule-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid var(--divider-color);
      }
      .rule-row:last-child {
        border-bottom: none;
      }
      .rule-name {
        font-weight: 500;
      }
      .rule-entity {
        font-size: 12px;
        color: var(--secondary-text-color);
      }
      .rule-subscribers {
        font-size: 12px;
        color: var(--secondary-text-color);
      }
      .rule-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .delete-btn {
        color: var(--error-color);
      }
      .empty, .error {
        text-align: center;
        padding: 48px;
      }
      .empty {
        color: var(--secondary-text-color);
      }
      .error {
        color: var(--error-color, #db4437);
      }
    `;
  }
}

customElements.define("ntfy-alerts-panel", NtfyAlertsPanel);
