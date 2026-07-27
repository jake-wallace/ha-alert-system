const LitElement = Object.getPrototypeOf(customElements.get("hui-view"));
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

class NtfyAlertsCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      rules: { type: Array },
      loading: { type: Boolean },
      _showNewRuleDialog: { type: Boolean },
      _showUserManager: { type: Boolean },
    };
  }

  constructor() {
    super();
    this.rules = [];
    this.loading = true;
    this._showNewRuleDialog = false;
    this._showUserManager = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this._loadRules();
  }

  async _loadRules() {
    if (!this.hass) return;
    this.loading = true;
    try {
      const result = await this.hass.callWS({
        type: "ntfy_alerts/get_rules",
      });
      this.rules = result.rules || [];
    } catch (e) {
      console.error("Failed to load ntfy rules:", e);
      this.rules = [];
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
    const users = this.hass?.config?.ntfy_alerts?.users || {};
    return (userId) => users[userId]?.name || userId;
  }

  render() {
    return html`
      <ha-card>
        <div class="card-header">
          <span>ntfy Alerts</span>
          <div class="header-actions">
            <ha-button @click=${() => (this._showUserManager = true)}>
              👥 Users
            </ha-button>
            <ha-button @click=${() => (this._showNewRuleDialog = true)}>
              ＋ New Rule
            </ha-button>
          </div>
        </div>

        ${this.loading
          ? html`<ha-circular-progress active></ha-circular-progress>`
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
                            <ha-button
                              @click=${() => this._deleteRule(rule.rule_id)}
                              class="delete-btn"
                            >
                              ✕
                            </ha-button>
                          </div>
                        </div>
                      `
                    )}
              </div>
            `}

        ${this._showNewRuleDialog
          ? html`
              <ntfy-rule-editor
                .hass=${this.hass}
                @close=${() => {
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
                @close=${() => (this._showUserManager = false)}
              ></ntfy-user-manager>
            `
          : ""}
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        font-size: 18px;
        font-weight: 500;
      }
      .header-actions {
        display: flex;
        gap: 8px;
      }
      .rules-list {
        padding: 0 16px 16px;
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
      .empty {
        text-align: center;
        color: var(--secondary-text-color);
        padding: 32px;
      }
    `;
  }
}

customElements.define("ntfy-alerts-card", NtfyAlertsCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "ntfy-alerts-card",
  name: "ntfy Alerts",
  description: "Manage ntfy alert rules for entity state changes",
});
