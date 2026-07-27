const LitElement = Object.getPrototypeOf(customElements.get("hui-view"));
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

class NtfyRuleEditor extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
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
      _showEntityPicker: { type: Boolean },
    };
  }

  constructor() {
    super();
    this.rule = null;
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
    this._showEntityPicker = false;
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
    return this.hass?.config?.ntfy_alerts?.users || {};
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
      this.dispatchEvent(new CustomEvent("close"));
    } catch (e) {
      alert("Failed to save rule: " + e.message);
    }
    this._saving = false;
  }

  render() {
    return html`
      <ha-dialog
        open
        @closed=${() => this.dispatchEvent(new CustomEvent("close"))}
        .heading=${this._editMode ? "Edit Rule" : "New Rule"}
      >
        <div class="form">
          <ha-textfield
            label="Rule Name"
            .value=${this._name}
            @input=${(e) => (this._name = e.target.value)}
            required
          ></ha-textfield>

          <div class="entity-field">
            <ha-textfield
              label="Entity"
              .value=${this._entityId}
              @input=${(e) => (this._entityId = e.target.value)}
              required
            ></ha-textfield>
            <ha-button
              @click=${() => (this._showEntityPicker = !this._showEntityPicker)}
            >
              Browse
            </ha-button>
          </div>

          ${this._showEntityPicker
            ? html`
                <ntfy-entity-picker
                  .hass=${this.hass}
                  .selectedEntity=${this._entityId}
                  @entity-selected=${(e) => {
                    this._entityId = e.detail.entity_id;
                    this._showEntityPicker = false;
                  }}
                ></ntfy-entity-picker>
              `
            : ""}

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
          @click=${() => this.dispatchEvent(new CustomEvent("close"))}
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
      .entity-field {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .entity-field ha-textfield {
        flex: 1;
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
