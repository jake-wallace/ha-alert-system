import { LitElement, html, css } from "https://unpkg.com/lit@2.7.0?module";

class NtfyUserManager extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      _users: { type: Object },
      _newName: { type: String },
      _newTopic: { type: String },
      _saving: { type: Boolean },
    };
  }

  constructor() {
    super();
    this._newName = "";
    this._newTopic = "";
    this._saving = false;
  }

  get _users() {
    return this.hass?.config?.ntfy_alerts?.users || {};
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
      this.requestUpdate();
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
      this.requestUpdate();
    } catch (e) {
      alert("Failed to remove user: " + e.message);
    }
  }

  render() {
    return html`
      <ha-dialog
        open
        @closed=${() => this.dispatchEvent(new CustomEvent("close"))}
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
          @click=${() => this.dispatchEvent(new CustomEvent("close"))}
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
