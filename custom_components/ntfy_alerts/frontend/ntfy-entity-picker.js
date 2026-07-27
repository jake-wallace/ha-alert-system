import { LitElement, html, css } from "https://unpkg.com/lit@2.7.0?module";

class NtfyEntityPicker extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      selectedEntity: { type: String },
      filter: { type: String },
    };
  }

  constructor() {
    super();
    this.selectedEntity = "";
    this.filter = "";
  }

  get _entities() {
    if (!this.hass?.states) return [];
    const all = Object.keys(this.hass.states).map((entityId) => ({
      entity_id: entityId,
      state: this.hass.states[entityId].state,
      friendly_name:
        this.hass.states[entityId].attributes?.friendly_name || entityId,
    }));
    if (!this.filter) return all;
    const f = this.filter.toLowerCase();
    return all.filter(
      (e) =>
        e.entity_id.toLowerCase().includes(f) ||
        e.friendly_name.toLowerCase().includes(f)
    );
  }

  render() {
    return html`
      <div class="picker">
        <ha-textfield
          label="Search entities…"
          .value=${this.filter}
          @input=${(e) => (this.filter = e.target.value)}
          class="search"
        ></ha-textfield>
        <div class="entity-list">
          ${this._entities.slice(0, 50).map(
            (entity) => html`
              <div
                class="entity-row ${this.selectedEntity === entity.entity_id
                  ? "selected"
                  : ""}"
                @click=${() => {
                  this.selectedEntity = entity.entity_id;
                  this.dispatchEvent(
                    new CustomEvent("entity-selected", {
                      detail: { entity_id: entity.entity_id },
                    })
                  );
                }}
              >
                <span class="entity-name">${entity.friendly_name}</span>
                <span class="entity-id">${entity.entity_id}</span>
                <span class="entity-state">${entity.state}</span>
              </div>
            `
          )}
        </div>
      </div>
    `;
  }

  static get styles() {
    return css`
      .picker {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 400px;
      }
      .search {
        width: 100%;
      }
      .entity-list {
        overflow-y: auto;
        max-height: 300px;
      }
      .entity-row {
        display: flex;
        justify-content: space-between;
        padding: 8px;
        cursor: pointer;
        border-radius: 4px;
      }
      .entity-row:hover {
        background: var(--primary-color, #03a9f4);
        color: white;
      }
      .entity-row.selected {
        background: var(--primary-color, #03a9f4);
        color: white;
      }
      .entity-name {
        font-weight: 500;
      }
      .entity-id {
        font-size: 12px;
        color: var(--secondary-text-color);
      }
      .entity-state {
        font-size: 12px;
      }
    `;
  }
}

customElements.define("ntfy-entity-picker", NtfyEntityPicker);
