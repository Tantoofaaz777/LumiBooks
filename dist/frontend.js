// src/ui/styles.ts
var STYLES = `
.lmb-toast-stack {
  position: fixed;
  bottom: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 9999;
  pointer-events: none;
}
.lmb-toast {
  background: var(--lumiverse-bg-2, #1c2333);
  color: var(--lumiverse-text, #dde2ea);
  border: 1px solid var(--lumiverse-border, #2d3548);
  border-left-width: 4px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  max-width: 340px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.35);
  transition: opacity 200ms ease-out;
  pointer-events: auto;
}
.lmb-toast-leaving { opacity: 0; }
.lmb-toast-success { border-left-color: #6dd47e; }
.lmb-toast-info    { border-left-color: #6dadd4; }
.lmb-toast-warn    { border-left-color: #d4a86d; }
.lmb-toast-error   { border-left-color: #d46d6d; }

.lmb-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  color: var(--lumiverse-text, #dde2ea);
  font-size: 13px;
  box-sizing: border-box;
}
.lmb-root *, .lmb-root *::before, .lmb-root *::after { box-sizing: border-box; }

.lmb-tabstrip {
  display: flex;
  gap: 2px;
  padding: 4px;
  background: var(--lumiverse-fill, rgba(255,255,255,0.04));
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.08));
  border-radius: var(--lumiverse-radius, 6px);
  overflow-x: auto;
}
.lmb-tab {
  flex: 1;
  background: transparent;
  color: var(--lumiverse-text, #dde2ea);
  border: 1px solid transparent;
  border-radius: var(--lumiverse-radius, 4px);
  padding: 6px 10px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  opacity: 0.7;
  white-space: nowrap;
  transition: background 120ms ease, opacity 120ms ease;
}
.lmb-tab:hover { opacity: 1; background: var(--lumiverse-fill-hover, rgba(255,255,255,0.06)); }
.lmb-tab.active {
  opacity: 1;
  background: var(--lumiverse-primary-020, rgba(107, 143, 240, 0.18));
  color: var(--lumiverse-primary, #6b8ff0);
  border-color: var(--lumiverse-primary-050, rgba(107, 143, 240, 0.4));
}

.lmb-tab-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lmb-section {
  background: var(--lumiverse-fill, rgba(255,255,255,0.04));
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.08));
  border-radius: var(--lumiverse-radius, 6px);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lmb-section-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.7;
  display: flex;
  align-items: center;
  gap: 8px;
}

.lmb-status-grid {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 12px;
  font-size: 12px;
}
.lmb-status-grid > .lmb-label { opacity: 0.65; }
.lmb-status-grid > .lmb-value { font-weight: 500; }

.lmb-busy {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--lumiverse-primary, #6b8ff0);
  font-size: 12px;
  padding: 4px 0;
}
.lmb-busy-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: lmb-pulse 1.2s ease-in-out infinite;
}
@keyframes lmb-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.lmb-actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }

.lmb-btn {
  background: var(--lumiverse-fill, rgba(255,255,255,0.06));
  color: var(--lumiverse-text, #dde2ea);
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.12));
  border-radius: var(--lumiverse-radius, 4px);
  padding: 6px 10px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, opacity 120ms ease;
}
.lmb-btn:hover:not(:disabled) {
  background: var(--lumiverse-fill-hover, rgba(255,255,255,0.1));
  border-color: var(--lumiverse-border-strong, rgba(255,255,255,0.2));
}
.lmb-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.lmb-btn.primary {
  background: var(--lumiverse-primary-020, rgba(107, 143, 240, 0.18));
  border-color: var(--lumiverse-primary-050, rgba(107, 143, 240, 0.5));
  color: var(--lumiverse-primary, #6b8ff0);
}
.lmb-btn.primary:hover:not(:disabled) {
  background: var(--lumiverse-primary-030, rgba(107, 143, 240, 0.28));
}
.lmb-btn.danger {
  color: var(--lumiverse-danger, #e07070);
  border-color: var(--lumiverse-danger-050, rgba(224, 112, 112, 0.4));
}
.lmb-btn.small { padding: 3px 8px; font-size: 11px; }
.lmb-btn.active {
  background: var(--lumiverse-primary, #6b8ff0);
  border-color: var(--lumiverse-primary, #6b8ff0);
  color: var(--lumiverse-on-primary, #ffffff);
}
.lmb-btn.active:hover:not(:disabled) {
  background: var(--lumiverse-primary, #6b8ff0);
  filter: brightness(1.08);
}

.lmb-entry-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.lmb-entry {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: var(--lumiverse-fill, rgba(255,255,255,0.03));
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.08));
  border-radius: var(--lumiverse-radius, 4px);
}
.lmb-entry.superseded { opacity: 0.45; }
.lmb-entry.arc { border-left: 3px solid var(--lumiverse-primary, #6b8ff0); }
.lmb-entry.volume { border-left: 3px solid var(--lumiverse-warning, #d4a73a); }
.lmb-entry.root { border-left: 3px solid var(--lumiverse-muted, #8a7fb0); opacity: 0.8; }
.lmb-entry-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lmb-entry-title {
  flex: 1 1 120px;
  min-width: 0;
  font-weight: 500;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lmb-entry-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-left: auto;
}
.lmb-entry-tag {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--lumiverse-border, rgba(255,255,255,0.12));
  opacity: 0.8;
}
.lmb-entry-tag.arc {
  background: var(--lumiverse-primary-020, rgba(107, 143, 240, 0.2));
  color: var(--lumiverse-primary, #6b8ff0);
}
.lmb-entry-tag.volume {
  background: var(--lumiverse-warning-020, rgba(212, 167, 58, 0.2));
  color: var(--lumiverse-warning, #d4a73a);
}
.lmb-entry-meta {
  font-size: 11px;
  opacity: 0.6;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.lmb-entry-preview {
  font-size: 12px;
  opacity: 0.85;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
  white-space: pre-wrap;
}
.lmb-entry-comment {
  font-size: 11px;
  font-style: italic;
  opacity: 0.7;
}

.lmb-empty {
  font-size: 12px;
  opacity: 0.55;
  font-style: italic;
  padding: 4px 0;
}

.lmb-field { display: flex; flex-direction: column; gap: 4px; }
.lmb-field-row { display: flex; align-items: center; gap: 8px; }
.lmb-grow { flex: 1; min-width: 0; }
.lmb-field-label {
  font-size: 11px;
  opacity: 0.7;
  font-weight: 500;
}
.lmb-field-hint { font-size: 11px; opacity: 0.5; }

.lmb-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.lmb-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

.lmb-input {
  width: 100%;
  background: var(--lumiverse-fill-strong, rgba(0,0,0,0.25));
  color: var(--lumiverse-text, #dde2ea);
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.12));
  border-radius: var(--lumiverse-radius, 4px);
  padding: 5px 8px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  transition: border-color 120ms ease, background 120ms ease;
}
.lmb-input:focus {
  border-color: var(--lumiverse-primary-050, rgba(107, 143, 240, 0.6));
  background: var(--lumiverse-fill, rgba(0,0,0,0.18));
}
.lmb-input:disabled { opacity: 0.5; cursor: not-allowed; }

.lmb-textarea {
  resize: vertical;
  min-height: 80px;
  line-height: 1.4;
  font-family: var(--lumiverse-mono-font, ui-monospace, "Fira Code", monospace);
  font-size: 12px;
}

.lmb-select {
  width: 100%;
  appearance: none;
  background-image:
    linear-gradient(45deg, transparent 50%, currentColor 50%),
    linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position: calc(100% - 14px) 50%, calc(100% - 9px) 50%;
  background-size: 5px 5px;
  background-repeat: no-repeat;
  padding-right: 26px;
}

.lmb-check { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; font-size: 12px; user-select: none; }
.lmb-check input { margin: 0; margin-top: 1px; accent-color: var(--lumiverse-primary, #6b8ff0); }
.lmb-check-body { display: flex; flex-direction: column; gap: 2px; }
.lmb-check-label { font-weight: 500; }
.lmb-check-hint { font-size: 11px; opacity: 0.55; }

.lmb-multiselect {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.12));
  border-radius: var(--lumiverse-radius, 4px);
  padding: 4px 6px;
}
.lmb-multiselect-row { display: flex; gap: 6px; align-items: center; cursor: pointer; font-size: 12px; padding: 2px 0; }
.lmb-multiselect-row input { accent-color: var(--lumiverse-primary, #6b8ff0); }

.lmb-modal-form { display: flex; flex-direction: column; gap: 10px; padding: 8px 12px 12px 12px; }
.lmb-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--lumiverse-border, rgba(255,255,255,0.08));
}

.lmb-pill {
  display: inline-block;
  padding: 2px 8px;
  background: var(--lumiverse-border, rgba(255,255,255,0.1));
  border-radius: 999px;
  font-size: 11px;
}
.lmb-pill.ok { background: var(--lumiverse-success-020, rgba(107, 191, 122, 0.2)); color: var(--lumiverse-success, #6bbf7a); }
.lmb-pill.warn { background: var(--lumiverse-warning-020, rgba(212, 167, 58, 0.2)); color: var(--lumiverse-warning, #d4a73a); }
.lmb-pill.danger { background: var(--lumiverse-danger-020, rgba(224, 112, 112, 0.18)); color: var(--lumiverse-danger, #e07070); }

.lmb-collapsible-body { display: flex; flex-direction: column; gap: 10px; }

.lmb-greyed { opacity: 0.4; pointer-events: none; }
.lmb-subgroup {
  border-left: 2px solid var(--lumiverse-border, rgba(255,255,255,0.12));
  padding-left: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}
.lmb-subgroup-title {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.75;
  letter-spacing: 0.04em;
}

.lmb-message-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.08));
  border-radius: var(--lumiverse-radius, 4px);
  padding: 4px 6px;
}
.lmb-message-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 4px 4px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: manipulation;
}
.lmb-message-row:hover { background: var(--lumiverse-fill-hover, rgba(255,255,255,0.05)); }
.lmb-message-row.selected { background: var(--lumiverse-primary-020, rgba(107, 143, 240, 0.18)); }
.lmb-message-row.covered { opacity: 0.45; }
.lmb-message-row.excluded .lmb-msg-preview { text-decoration: line-through; opacity: 0.6; }
.lmb-msg-excluded-badge { opacity: 0.75; font-weight: 600; }
.lmb-message-row input { accent-color: var(--lumiverse-primary, #6b8ff0); margin-top: 3px; }
.lmb-msg-role {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  opacity: 0.7;
  min-width: 36px;
}
.lmb-msg-preview {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lmb-msg-icons { display: flex; gap: 4px; align-items: center; opacity: 0.7; }

.lmb-message-filter-row { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; }

.lmb-preview-card {
  background: var(--lumiverse-primary-010, rgba(107, 143, 240, 0.1));
  border: 1px solid var(--lumiverse-primary-050, rgba(107, 143, 240, 0.45));
  border-radius: var(--lumiverse-radius, 6px);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lmb-failure {
  background: var(--lumiverse-danger-020, rgba(224, 112, 112, 0.18));
  border: 1px solid var(--lumiverse-danger-050, rgba(224, 112, 112, 0.5));
  border-radius: var(--lumiverse-radius, 4px);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}

.lmb-about-hero { display: flex; gap: 12px; align-items: center; }
.lmb-about-hero img { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; }
.lmb-about-line { font-size: 12px; opacity: 0.85; line-height: 1.5; }

.lmb-preset-text {
  background: var(--lumiverse-fill-strong, rgba(0,0,0,0.25));
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.1));
  border-radius: 4px;
  padding: 8px;
  font-family: var(--lumiverse-mono-font, ui-monospace, monospace);
  font-size: 11px;
  white-space: pre-wrap;
  max-height: 280px;
  overflow-y: auto;
  line-height: 1.4;
}

.lmb-spacer { flex: 1; }

.lmb-help { font-size: 11px; opacity: 0.55; line-height: 1.5; }

.lmb-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 24px;
}
.lmb-preview-modal {
  background: var(--lumiverse-bg-1, #14181f);
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.12));
  border-radius: 8px;
  width: min(960px, 100%);
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 12px 48px rgba(0,0,0,0.5);
  color: var(--lumiverse-text, #dde2ea);
  font-size: 12px;
}
.lmb-preview-modal__header,
.lmb-preview-modal__footer { flex: 0 0 auto; }
.lmb-preview-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--lumiverse-border, rgba(255,255,255,0.08));
}
.lmb-preview-modal__header h3 { margin: 0; font-size: 14px; font-weight: 600; }
.lmb-preview-modal__close {
  background: transparent;
  color: inherit;
  border: none;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 8px;
  opacity: 0.65;
}
.lmb-preview-modal__close:hover { opacity: 1; }
.lmb-preview-modal__body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 12px 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lmb-preview-modal__diagnostics {
  flex: 0 0 auto;
  background: var(--lumiverse-fill, rgba(255,255,255,0.04));
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.08));
  border-radius: 6px;
  padding: 8px 12px;
}
.lmb-preview-modal__diagnostics h4 {
  margin: 0 0 4px 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.7;
}
.lmb-preview-modal__diagnostics ul {
  margin: 0;
  padding-left: 18px;
  font-size: 11px;
  line-height: 1.6;
  opacity: 0.85;
}
.lmb-preview-msg {
  flex: 0 0 auto;
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.08));
  border-radius: 6px;
  overflow: hidden;
}
.lmb-preview-msg__role {
  background: var(--lumiverse-fill, rgba(255,255,255,0.05));
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
}
.lmb-preview-msg__content {
  margin: 0;
  padding: 10px 12px;
  background: var(--lumiverse-fill-strong, rgba(0,0,0,0.25));
  font-family: var(--lumiverse-mono-font, ui-monospace, monospace);
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.lmb-preview-modal__footer {
  padding: 10px 16px;
  border-top: 1px solid var(--lumiverse-border, rgba(255,255,255,0.08));
  display: flex;
  justify-content: flex-end;
}
`;
var ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2z"/>
  <path d="M8 7h8"/>
  <path d="M8 11h6"/>
</svg>
`;

// src/ui/components.ts
function textInput(opts) {
  const el = document.createElement("input");
  el.type = "text";
  el.className = `lmb-input ${opts.className ?? ""}`.trim();
  el.value = opts.value;
  if (opts.placeholder)
    el.placeholder = opts.placeholder;
  if (opts.autoFocus)
    setTimeout(() => el.focus(), 0);
  if (opts.onChange) {
    el.addEventListener("input", () => opts.onChange?.(el.value));
  }
  if (opts.onBlur) {
    el.addEventListener("blur", () => opts.onBlur?.(el.value));
  }
  return el;
}
function textArea(opts) {
  const el = document.createElement("textarea");
  el.className = "lmb-input lmb-textarea";
  el.value = opts.value;
  if (opts.placeholder)
    el.placeholder = opts.placeholder;
  if (opts.rows)
    el.rows = opts.rows;
  if (opts.onChange)
    el.addEventListener("input", () => opts.onChange?.(el.value));
  if (opts.onBlur)
    el.addEventListener("blur", () => opts.onBlur?.(el.value));
  return el;
}
function numberInput(opts) {
  const el = document.createElement("input");
  el.type = "number";
  el.className = "lmb-input";
  const showAsBlank = opts.value === null || opts.defaultValue !== undefined && opts.value === opts.defaultValue;
  el.value = showAsBlank ? "" : String(opts.value);
  if (typeof opts.min === "number")
    el.min = String(opts.min);
  if (typeof opts.max === "number")
    el.max = String(opts.max);
  if (typeof opts.step === "number")
    el.step = String(opts.step);
  if (opts.disabled)
    el.disabled = true;
  if (opts.placeholder)
    el.placeholder = opts.placeholder;
  else if (opts.defaultValue !== undefined)
    el.placeholder = String(opts.defaultValue);
  if (opts.onBlur) {
    el.addEventListener("blur", () => {
      const raw = el.value.trim();
      if (raw === "") {
        if (opts.defaultValue !== undefined) {
          opts.onBlur?.(opts.defaultValue);
        } else {
          opts.onBlur?.(null);
        }
        return;
      }
      const v = Number(raw);
      if (!Number.isFinite(v)) {
        el.value = showAsBlank || opts.value === null || opts.value === undefined ? "" : String(opts.value);
        return;
      }
      opts.onBlur?.(v);
    });
  }
  return el;
}
function select(opts) {
  const el = document.createElement("select");
  el.className = "lmb-input lmb-select";
  if (opts.ariaLabel)
    el.setAttribute("aria-label", opts.ariaLabel);
  for (const o of opts.options) {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    if (o.disabled)
      opt.disabled = true;
    if (o.value === opts.value)
      opt.selected = true;
    el.appendChild(opt);
  }
  el.value = opts.value;
  if (opts.onChange)
    el.addEventListener("change", () => opts.onChange?.(el.value));
  return el;
}
function checkbox(opts) {
  const label = document.createElement("label");
  label.className = "lmb-check";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = opts.checked;
  const body = document.createElement("div");
  body.className = "lmb-check-body";
  const lbl = document.createElement("div");
  lbl.className = "lmb-check-label";
  lbl.textContent = opts.label;
  body.appendChild(lbl);
  if (opts.hint) {
    const hint = document.createElement("div");
    hint.className = "lmb-check-hint";
    hint.textContent = opts.hint;
    body.appendChild(hint);
  }
  label.append(input, body);
  if (opts.onChange)
    input.addEventListener("change", () => opts.onChange?.(input.checked));
  return label;
}
function multiSelect(opts) {
  const wrap = document.createElement("div");
  wrap.className = "lmb-multiselect";
  if (opts.options.length === 0) {
    const empty = document.createElement("div");
    empty.className = "lmb-empty";
    empty.textContent = opts.emptyText ?? "Nothing to pick";
    wrap.appendChild(empty);
    return wrap;
  }
  const sel = new Set(opts.selected);
  for (const o of opts.options) {
    const row = document.createElement("label");
    row.className = "lmb-multiselect-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = sel.has(o.value);
    const span = document.createElement("span");
    span.textContent = o.label;
    row.append(cb, span);
    cb.addEventListener("change", () => {
      if (cb.checked)
        sel.add(o.value);
      else
        sel.delete(o.value);
      opts.onChange?.(Array.from(sel));
    });
    wrap.appendChild(row);
  }
  return wrap;
}
function makeButton(label, onClick, opts = {}) {
  const btn = document.createElement("button");
  const classes = ["lmb-btn"];
  if (opts.primary)
    classes.push("primary");
  if (opts.danger)
    classes.push("danger");
  if (opts.small)
    classes.push("small");
  btn.className = classes.join(" ");
  btn.textContent = label;
  btn.disabled = !!opts.disabled;
  btn.type = "button";
  if (opts.title)
    btn.title = opts.title;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    if (btn.disabled)
      return;
    onClick();
  });
  return btn;
}
function section(title) {
  const wrap = document.createElement("div");
  wrap.className = "lmb-section";
  const head = document.createElement("div");
  head.className = "lmb-section-title";
  head.append(document.createTextNode(title));
  wrap.appendChild(head);
  const body = document.createElement("div");
  body.className = "lmb-collapsible-body";
  wrap.appendChild(body);
  return { wrap, body, head };
}
function field(label) {
  const wrap = document.createElement("div");
  wrap.className = "lmb-field";
  const lbl = document.createElement("div");
  lbl.className = "lmb-field-label";
  lbl.textContent = label;
  wrap.appendChild(lbl);
  const body = document.createElement("div");
  body.className = "lmb-field-body";
  wrap.appendChild(body);
  return { wrap, body };
}
function labelled(label, child) {
  const wrap = document.createElement("div");
  wrap.className = "lmb-field";
  const lbl = document.createElement("div");
  lbl.className = "lmb-field-label";
  lbl.textContent = label;
  wrap.appendChild(lbl);
  wrap.appendChild(child);
  return wrap;
}
function pill(text, tone) {
  const el = document.createElement("span");
  el.className = `lmb-pill${tone ? " " + tone : ""}`;
  el.textContent = text;
  return el;
}
function textNode(text, className) {
  const el = document.createElement("div");
  if (className)
    el.className = className;
  el.textContent = text;
  return el;
}
function span(text, className) {
  const el = document.createElement("span");
  if (className)
    el.className = className;
  el.textContent = text;
  return el;
}
function formatTokens(n) {
  if (n >= 1000)
    return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
function findScrollingAncestor(el) {
  let cur = el?.parentElement ?? null;
  while (cur && cur !== document.body && cur !== document.documentElement) {
    const style = getComputedStyle(cur);
    const oy = style.overflowY;
    if (oy === "auto" || oy === "scroll")
      return cur;
    cur = cur.parentElement;
  }
  return null;
}
function collectScrollableDescendants(root) {
  const out = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;
  while (node) {
    if (node !== root && node instanceof HTMLElement) {
      const style = getComputedStyle(node);
      const oy = style.overflowY;
      if (oy === "auto" || oy === "scroll")
        out.push(node);
    }
    node = walker.nextNode();
  }
  return out;
}
function preserveScroll(anchor, fn) {
  if (!anchor) {
    fn();
    return;
  }
  const ancestor = findScrollingAncestor(anchor);
  const ancestorScroll = ancestor ? ancestor.scrollTop : 0;
  const innerBefore = collectScrollableDescendants(anchor).map((el) => el.scrollTop);
  fn();
  if (ancestor && ancestorScroll > 0)
    ancestor.scrollTop = ancestorScroll;
  const innerAfter = collectScrollableDescendants(anchor);
  if (innerAfter.length === innerBefore.length) {
    for (let i = 0;i < innerAfter.length; i++) {
      if (innerBefore[i] > 0)
        innerAfter[i].scrollTop = innerBefore[i];
    }
  }
}
var HIDDEN_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.77 19.77 0 0 1 4.22-5.42"/><path d="M22.54 16.88A10.94 10.94 0 0 0 23 12s-4-8-11-8a10.84 10.84 0 0 0-5.34 1.4"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

// src/ui/modals.ts
function openEditModal(ctx, title, fields, onSave) {
  const handle = ctx.ui.showModal({ title, width: 640, maxHeight: 720 });
  const form = document.createElement("div");
  form.className = "lmb-modal-form";
  handle.root.appendChild(form);
  const labelWrap = document.createElement("div");
  labelWrap.className = "lmb-field";
  const lbl = document.createElement("div");
  lbl.className = "lmb-field-label";
  lbl.textContent = "Label";
  const labelInput = textInput({ value: fields.comment, placeholder: "Label" });
  labelWrap.append(lbl, labelInput);
  form.appendChild(labelWrap);
  const contentWrap = document.createElement("div");
  contentWrap.className = "lmb-field";
  const cLbl = document.createElement("div");
  cLbl.className = "lmb-field-label";
  cLbl.textContent = "Content";
  const contentInput = textArea({ value: fields.content, rows: 16 });
  contentWrap.append(cLbl, contentInput);
  form.appendChild(contentWrap);
  const actions = document.createElement("div");
  actions.className = "lmb-modal-actions";
  actions.append(makeButton("Cancel", () => handle.dismiss()), makeButton("Save", () => {
    onSave({ comment: labelInput.value, content: contentInput.value });
    handle.dismiss();
  }, { primary: true }));
  form.appendChild(actions);
}
async function confirmDelete(ctx, title, message) {
  try {
    const r = await ctx.ui.showConfirm({
      title,
      message,
      variant: "danger",
      confirmLabel: "Delete",
      cancelLabel: "Cancel"
    });
    return !!r.confirmed;
  } catch {
    return window.confirm(message);
  }
}
function showDryRunModal(kind, messages, diagnostics) {
  const overlay = document.createElement("div");
  overlay.className = "lmb-preview-overlay";
  const modal = document.createElement("div");
  modal.className = "lmb-preview-modal";
  const header = document.createElement("div");
  header.className = "lmb-preview-modal__header";
  const title = document.createElement("h3");
  title.textContent = `Dry run: ${kind === "arc" ? "Arc" : kind === "volume" ? "Volume" : "Chapter"}`;
  header.appendChild(title);
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "lmb-preview-modal__close";
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "Close dry run");
  closeBtn.addEventListener("click", () => overlay.remove());
  header.appendChild(closeBtn);
  modal.appendChild(header);
  const body = document.createElement("div");
  body.className = "lmb-preview-modal__body";
  if (diagnostics.length > 0) {
    const diag = document.createElement("div");
    diag.className = "lmb-preview-modal__diagnostics";
    const diagTitle = document.createElement("h4");
    diagTitle.textContent = "Diagnostics";
    diag.appendChild(diagTitle);
    const ul = document.createElement("ul");
    for (const d of diagnostics) {
      const li = document.createElement("li");
      li.textContent = d.message;
      ul.appendChild(li);
    }
    diag.appendChild(ul);
    body.appendChild(diag);
  }
  for (const m of messages) {
    const msgCard = document.createElement("div");
    msgCard.className = "lmb-preview-msg";
    const roleLabel = document.createElement("div");
    roleLabel.className = "lmb-preview-msg__role";
    roleLabel.textContent = m.role;
    const contentPre = document.createElement("pre");
    contentPre.className = "lmb-preview-msg__content";
    contentPre.textContent = m.content;
    msgCard.appendChild(roleLabel);
    msgCard.appendChild(contentPre);
    body.appendChild(msgCard);
  }
  modal.appendChild(body);
  const footer = document.createElement("div");
  footer.className = "lmb-preview-modal__footer";
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "lmb-btn small";
  copyBtn.textContent = "Copy JSON";
  copyBtn.addEventListener("click", async () => {
    const json = JSON.stringify({ kind, messages, diagnostics }, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      copyBtn.textContent = "Copied";
      setTimeout(() => copyBtn.textContent = "Copy JSON", 1500);
    } catch {
      copyBtn.textContent = "Copy failed";
    }
  });
  footer.appendChild(copyBtn);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay)
      overlay.remove();
  });
  document.body.appendChild(overlay);
}
function promptForString(ctx, title, initial) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (settled)
        return;
      settled = true;
      resolve(value);
    };
    const handle = ctx.ui.showModal({ title, width: 420 });
    const form = document.createElement("div");
    form.className = "lmb-modal-form";
    handle.root.appendChild(form);
    const input = textInput({ value: initial, autoFocus: true });
    form.appendChild(input);
    const actions = document.createElement("div");
    actions.className = "lmb-modal-actions";
    actions.append(makeButton("Cancel", () => {
      settle(null);
      handle.dismiss();
    }), makeButton("OK", () => {
      const v = input.value.trim();
      settle(v || null);
      handle.dismiss();
    }, { primary: true }));
    form.appendChild(actions);
    try {
      handle.onDismiss?.(() => settle(null));
    } catch (_) {}
  });
}

// src/ui/tabs/books-tab.ts
var inflightBusyLabels = new Map;
function busyTrackKey(kind, chatId) {
  return `${kind}::${chatId}`;
}
function tryUpdateBusyLabelsInPlace(entries) {
  const keys = new Set(entries.map((b) => busyTrackKey(b.kind, b.chatId)));
  if (keys.size !== inflightBusyLabels.size)
    return false;
  for (const k of keys) {
    const el = inflightBusyLabels.get(k);
    if (!el || !el.isConnected)
      return false;
  }
  for (const b of entries) {
    const el = inflightBusyLabels.get(busyTrackKey(b.kind, b.chatId));
    if (el)
      el.textContent = b.label;
  }
  return true;
}
function renderBooksTab(host, state, ctx, send) {
  host.replaceChildren();
  renderStatus(host, state, send);
  renderFailure(host, state, send);
  renderPreviews(host, state, send);
  renderActions(host, state, send);
  renderEntries(host, state, ctx, send);
}
function renderStatus(host, state, send) {
  if (!state.activeChatId) {
    host.appendChild(textNode("Open a chat to see Memoria's notes", "lmb-empty"));
    return;
  }
  const sec = section("Status");
  const grid = document.createElement("div");
  grid.className = "lmb-status-grid";
  addRow(grid, "Chat", state.activeChatName || state.activeChatId.slice(0, 8));
  if (state.activeCharacterName)
    addRow(grid, "Character", state.activeCharacterName);
  addRow(grid, "Messages", `${state.coverage.totalMessages} (${state.coverage.coveredMessages} covered)`);
  addRow(grid, "Uncompressed tail", `${state.coverage.uncoveredMessages} msgs, ~${formatTokens(state.coverage.approxUncoveredTokens)} tokens`);
  const profile = state.activeProfile;
  const thresholds = document.createElement("div");
  thresholds.style.gridColumn = "1 / -1";
  thresholds.style.display = "flex";
  thresholds.style.gap = "6px";
  thresholds.style.flexWrap = "wrap";
  thresholds.style.marginTop = "4px";
  thresholds.append(pill(`lag ${profile.lagValue}${profile.lagUnit === "tokens" ? "t" : "m"}`), pill(`window ${profile.windowValue}${profile.windowUnit === "tokens" ? "t" : "m"}`), pill(profile.chapterTargetUnit === "tokens" ? `chapter ${profile.chapterTargetTokens}t` : `chapter ${profile.chapterTargetPercent}%`), pill(profile.arcTargetUnit === "tokens" ? `arc ${profile.arcTargetTokens}t` : `arc ${profile.arcTargetPercent}%`), pill(state.coverage.lagSatisfied ? "lag ready" : "lag building", state.coverage.lagSatisfied ? "ok" : "warn"), pill(state.coverage.windowAvailable ? "window ready" : "window building", state.coverage.windowAvailable ? "ok" : "warn"));
  grid.appendChild(thresholds);
  sec.body.appendChild(grid);
  inflightBusyLabels.clear();
  for (const b of state.busy) {
    const row = document.createElement("div");
    row.className = "lmb-busy";
    const dot = document.createElement("div");
    dot.className = "lmb-busy-dot";
    const labelSpan = document.createElement("span");
    labelSpan.className = "lmb-grow";
    labelSpan.textContent = b.label;
    row.append(dot, labelSpan);
    const abortBtn = makeButton("Abort", () => {
      abortBtn.disabled = true;
      send({ type: "abort_busy", chatId: b.chatId, kind: b.kind });
    }, { danger: true, small: true, title: "Cancel the in-flight generation" });
    row.appendChild(abortBtn);
    sec.body.appendChild(row);
    inflightBusyLabels.set(busyTrackKey(b.kind, b.chatId), labelSpan);
  }
  if (!state.connections.length) {
    sec.body.appendChild(textNode("Memoria has no connection to write with. Set one up in Lumiverse.", "lmb-empty"));
  } else if (!state.resolvedSidecarConnectionId) {
    sec.body.appendChild(textNode("Pick a connection in the Profile tab so Memoria can write.", "lmb-empty"));
  }
  host.appendChild(sec.wrap);
}
function renderFailure(host, state, send) {
  if (!state.lastFailure || !state.activeChatId)
    return;
  const f = state.lastFailure;
  const sec = document.createElement("div");
  sec.className = "lmb-failure";
  const head = document.createElement("div");
  head.style.fontWeight = "600";
  head.textContent = f.kind === "arc" ? "Last arc attempt failed" : f.kind === "volume" ? "Last volume attempt failed" : "Last chapter attempt failed";
  const detail = document.createElement("div");
  detail.style.opacity = "0.85";
  detail.textContent = `${f.message} (tried ${f.retriedTimes}x)`;
  const row = document.createElement("div");
  row.className = "lmb-actions";
  const chatId = state.activeChatId;
  row.append(makeButton("Retry", () => send({ type: "retry_last_failure", chatId }), { primary: true, small: true }));
  sec.append(head, detail, row);
  host.appendChild(sec);
}
function renderPreviews(host, state, send) {
  if (state.pendingPreviews.length === 0 || !state.activeChatId)
    return;
  const sec = section(`Pending previews (${state.pendingPreviews.length})`);
  for (const p of state.pendingPreviews) {
    sec.body.appendChild(renderPreviewCard(p, state.activeChatId, send));
  }
  host.appendChild(sec.wrap);
}
function renderPreviewCard(preview, chatId, send) {
  const card = document.createElement("div");
  card.className = "lmb-preview-card";
  const head = document.createElement("div");
  head.style.display = "flex";
  head.style.alignItems = "center";
  head.style.gap = "8px";
  const tag = document.createElement("span");
  tag.className = `lmb-entry-tag ${preview.kind !== "chapter" ? preview.kind : ""}`.trim();
  tag.textContent = preview.kind.toUpperCase();
  head.append(tag, span(preview.title, "lmb-entry-title"));
  card.appendChild(head);
  let lastSentTitle = preview.title;
  let lastSentContent = preview.content;
  const syncEdit = () => {
    const liveTitle = titleInput.value;
    const liveContent = contentInput.value;
    const patch = {};
    if (liveTitle !== lastSentTitle)
      patch.title = liveTitle;
    if (liveContent !== lastSentContent)
      patch.content = liveContent;
    if (Object.keys(patch).length === 0)
      return;
    lastSentTitle = liveTitle;
    lastSentContent = liveContent;
    send({ type: "edit_preview", chatId, draftId: preview.draftId, patch });
  };
  const titleField = field("Title");
  const titleInput = textInput({ value: preview.title, onChange: syncEdit });
  titleField.body.appendChild(titleInput);
  card.appendChild(titleField.wrap);
  const contentField = field("Content");
  const contentInput = textArea({ value: preview.content, rows: 10, onChange: syncEdit });
  contentField.body.appendChild(contentInput);
  card.appendChild(contentField.wrap);
  if (preview.shortComment) {
    const cm = document.createElement("div");
    cm.className = "lmb-entry-comment";
    cm.textContent = `Memoria: ${preview.shortComment}`;
    card.appendChild(cm);
  }
  const meta = document.createElement("div");
  meta.className = "lmb-entry-meta";
  meta.append(span(`${preview.sourceMessageIds.length} msgs`), span(`${formatTokens(preview.tokenCountOutput)} tokens`), span(preview.model || ""));
  card.appendChild(meta);
  const actions = document.createElement("div");
  actions.className = "lmb-actions";
  actions.append(makeButton("Save", () => {
    send({
      type: "edit_preview",
      chatId,
      draftId: preview.draftId,
      patch: { title: titleInput.value, content: contentInput.value }
    });
    send({ type: "accept_preview", chatId, draftId: preview.draftId });
  }, { primary: true, small: true }), makeButton("Discard", () => send({ type: "discard_preview", chatId, draftId: preview.draftId }), { danger: true, small: true }));
  card.appendChild(actions);
  return card;
}
function renderActions(host, state, send) {
  if (!state.activeChatId)
    return;
  const sec = section("Quick actions");
  const row = document.createElement("div");
  row.className = "lmb-actions";
  const disabled = state.busy.length > 0 || !state.settings.enabled;
  const chatId = state.activeChatId;
  row.append(makeButton("File chapter", () => send({ type: "create_chapter", chatId }), {
    primary: true,
    disabled,
    title: "Compress the oldest uncovered window into a new chapter using the current profile"
  }));
  if (state.backlogChapters > 1) {
    row.append(makeButton(`File all chapters (${state.backlogChapters})`, () => send({ type: "create_all_chapters", chatId }), {
      disabled,
      title: "Drain the chapter backlog - keeps filing chapters until the lag or window threshold blocks further compression"
    }));
  }
  row.append(makeButton("Bind arc", () => send({ type: "create_arc", chatId }), {
    disabled,
    title: "Roll the oldest unsuperseded chapters into a single arc"
  }));
  if (state.backlogArcs > 1) {
    row.append(makeButton(`File all arcs (${state.backlogArcs})`, () => send({ type: "create_all_arcs", chatId }), {
      disabled,
      title: "Drain the arc backlog - keeps binding arcs until the configured arc trigger no longer fires"
    }));
  }
  if (!state.bookId) {
    const empty = pill("No book yet", "warn");
    empty.title = "Memoria will create this chat's world book the first time a chapter is filed";
    row.appendChild(empty);
  } else {
    const tag = pill(state.bookName ? state.bookName : "Book ready", "ok");
    tag.title = "World book where chapters and arcs are stored for this chat (bound to this chat in Lumiverse → Lorebook → This Chat Only)";
    row.appendChild(tag);
  }
  sec.body.appendChild(row);
  host.appendChild(sec.wrap);
}
function renderEntries(host, state, ctx, send) {
  const sec = section("Chapters and arcs");
  if (!state.activeChatId) {
    sec.body.appendChild(textNode("No active chat", "lmb-empty"));
    host.appendChild(sec.wrap);
    return;
  }
  const chapters = state.chapters.filter((c) => !c.isRoot);
  const arcs = state.arcs.filter((a) => !a.isRoot);
  const volumes = state.volumes.filter((v) => !v.isRoot);
  if (chapters.length + arcs.length + volumes.length === 0) {
    sec.body.appendChild(textNode("Empty shelf for now. Memoria will start filing once the lag fills.", "lmb-empty"));
    host.appendChild(sec.wrap);
    return;
  }
  if (volumes.length) {
    sec.body.appendChild(buildSubtitle(`Volumes (${volumes.length})`));
    const list = document.createElement("ul");
    list.className = "lmb-entry-list";
    for (const vol of volumes)
      list.appendChild(renderEntryItem(vol, "volume", state, ctx, send));
    sec.body.appendChild(list);
  }
  if (arcs.length) {
    sec.body.appendChild(buildSubtitle(`Arcs (${arcs.length})`));
    const list = document.createElement("ul");
    list.className = "lmb-entry-list";
    for (const arc of arcs)
      list.appendChild(renderEntryItem(arc, "arc", state, ctx, send));
    sec.body.appendChild(list);
  }
  if (chapters.length) {
    sec.body.appendChild(buildSubtitle(`Chapters (${chapters.length})`));
    const list = document.createElement("ul");
    list.className = "lmb-entry-list";
    for (const ch of chapters)
      list.appendChild(renderEntryItem(ch, "chapter", state, ctx, send));
    sec.body.appendChild(list);
  }
  host.appendChild(sec.wrap);
}
function buildSubtitle(text) {
  const d = document.createElement("div");
  d.className = "lmb-section-title";
  d.textContent = text;
  return d;
}
function renderEntryItem(view, kind, state, ctx, send, readOnly = false) {
  const li = document.createElement("li");
  li.className = `lmb-entry ${kind}${view.active ? "" : " superseded"}${readOnly ? " root" : ""}`;
  const head = document.createElement("div");
  head.className = "lmb-entry-head";
  const tag = document.createElement("span");
  tag.className = `lmb-entry-tag ${kind}`;
  tag.textContent = kind.toUpperCase();
  const title = document.createElement("div");
  title.className = "lmb-entry-title";
  title.textContent = view.comment || view.meta.title || `${kind} ${view.entryId.slice(0, 6)}`;
  head.append(tag, title);
  li.appendChild(head);
  if (!readOnly) {
    const chatId = state.activeChatId;
    const actions = document.createElement("div");
    actions.className = "lmb-entry-actions";
    actions.append(makeButton("Edit", () => {
      openEditModal(ctx, kind === "arc" ? "Edit arc" : kind === "volume" ? "Edit volume" : "Edit chapter", {
        comment: view.comment,
        content: view.content
      }, (next) => {
        if (!chatId)
          return;
        const patch = {};
        if (typeof next.comment === "string" && next.comment !== view.comment) {
          patch.comment = next.comment;
        }
        if (typeof next.content === "string" && next.content !== view.content) {
          patch.content = next.content;
        }
        if (Object.keys(patch).length === 0)
          return;
        send({ type: "update_entry", chatId, entryId: view.entryId, patch });
      });
    }, { small: true, title: "Edit this entry's label and content" }), makeButton("Regenerate", async () => {
      const ok = await confirmDelete(ctx, "Regenerate?", "Memoria will delete this entry and resummarize the same range. The old summary text will be lost.");
      if (!ok || !chatId)
        return;
      send({ type: "regenerate_entry", chatId, entryId: view.entryId });
    }, { small: true, title: "Delete and resummarize the same range" }), makeButton("Release", async () => {
      const ok = await confirmDelete(ctx, "Release to lorebook?", "Memoria will hand this entry to your regular lorebook (prefixed with [orphaned]) and stop managing it. Those messages will become uncovered.");
      if (!ok || !chatId)
        return;
      send({ type: "release_entry", chatId, entryId: view.entryId });
    }, { small: true, title: "Strip the LumiBooks marker so the entry becomes a regular lorebook entry" }), makeButton("Delete", async () => {
      const ok = await confirmDelete(ctx, "Delete?", "Memoria will let those messages back into the prompt.");
      if (!ok || !chatId)
        return;
      send({ type: "delete_entry", chatId, entryId: view.entryId });
    }, { small: true, danger: true }));
    head.appendChild(actions);
  }
  const meta = document.createElement("div");
  meta.className = "lmb-entry-meta";
  const range = view.isRoot ? "inherited" : view.meta.firstMsgIdx !== undefined && view.meta.lastMsgIdx !== undefined ? `msgs ${view.meta.firstMsgIdx + 1}-${view.meta.lastMsgIdx + 1}` : `${view.meta.msgIds.length} msgs`;
  const before = view.sourceTokensInput || 0;
  const tokenStr = before > 0 ? `${formatTokens(before)}→${formatTokens(view.contentTokens)} tokens` : `${formatTokens(view.contentTokens)} tokens`;
  meta.append(span(range), span(tokenStr), span(view.meta.model || ""));
  if (!view.active)
    meta.append(span("superseded"));
  li.appendChild(meta);
  if (view.meta.shortComment) {
    const cm = document.createElement("div");
    cm.className = "lmb-entry-comment";
    cm.textContent = `Memoria: ${view.meta.shortComment}`;
    li.appendChild(cm);
  }
  const preview = document.createElement("div");
  preview.className = "lmb-entry-preview";
  preview.textContent = view.content;
  li.appendChild(preview);
  return li;
}
function addRow(grid, label, value) {
  const l = document.createElement("div");
  l.className = "lmb-label";
  l.textContent = label;
  const v = document.createElement("div");
  v.className = "lmb-value";
  v.textContent = value;
  grid.append(l, v);
}

// src/ui/tabs/make-tab.ts
var localState = {
  selectedMessages: new Set,
  selectedChapters: new Set,
  selectedArcs: new Set,
  messageFilter: "uncovered",
  messageQuery: "",
  lastChatId: null,
  anchorMessageId: null,
  suppressNextClick: false,
  rebaseSourceId: ""
};
var LONG_PRESS_MS = 500;
var LONG_PRESS_MOVE_PX = 10;
function renderMakeTab(host, state, ctx, send) {
  if (localState.lastChatId !== state.activeChatId) {
    localState.selectedMessages.clear();
    localState.selectedChapters.clear();
    localState.selectedArcs.clear();
    localState.anchorMessageId = null;
    localState.rebaseSourceId = "";
    localState.lastChatId = state.activeChatId;
  }
  const draw = () => {
    preserveScroll(host, () => {
      host.replaceChildren();
      const c = {
        state,
        selectedMessages: localState.selectedMessages,
        selectedChapters: localState.selectedChapters,
        selectedArcs: localState.selectedArcs,
        messageFilter: localState.messageFilter,
        messageQuery: localState.messageQuery,
        rerender: draw
      };
      if (!state.activeChatId) {
        host.appendChild(textNode("Open a chat to pick messages", "lmb-empty"));
        return;
      }
      renderChapterPicker(host, c, send);
      renderArcPicker(host, c, send);
      renderVolumePicker(host, c, send);
      renderContinuity(host, c, ctx, send);
    });
  };
  draw();
}
function renderChapterPicker(host, c, send) {
  const sec = section("Pick messages for a chapter");
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent = "Covered messages are already filed and are greyed. Shift+click (or long-press on touch) to select ranges. Use Exclude to pin a message so it's never hidden, replaced, or summarized - it splits compression around it.";
  sec.body.appendChild(help);
  const filterRow = document.createElement("div");
  filterRow.className = "lmb-message-filter-row";
  const filterSel = select({
    value: c.messageFilter,
    options: [
      { value: "uncovered", label: "Uncompressed only" },
      { value: "all", label: "All messages" },
      { value: "covered", label: "Already filed" }
    ],
    onChange: (v) => {
      localState.messageFilter = v ?? "uncovered";
      c.rerender();
    }
  });
  const query = textInput({
    value: c.messageQuery,
    placeholder: "Search...",
    onChange: (v) => {
      const next = v.toLowerCase();
      localState.messageQuery = next;
      c.messageQuery = next;
      listEl.replaceChildren(...buildRows(c, syncControls));
      syncControls();
    }
  });
  filterRow.append(filterSel, query);
  sec.body.appendChild(filterRow);
  const counts = document.createElement("div");
  counts.className = "lmb-help";
  const chatId = c.state.activeChatId;
  const messageById = new Map(c.state.messages.map((m) => [m.id, m]));
  const allSelectedExcluded = () => {
    if (c.selectedMessages.size === 0)
      return false;
    for (const id of c.selectedMessages) {
      const m = messageById.get(id);
      if (!m || !m.excluded)
        return false;
    }
    return true;
  };
  const compressBtn = makeButton("Compress", () => {
    const ids = Array.from(c.selectedMessages);
    if (ids.length === 0)
      return;
    send({ type: "create_chapter_range", chatId, messageIds: ids });
    localState.selectedMessages.clear();
    c.selectedMessages.clear();
    localState.anchorMessageId = null;
    c.rerender();
  }, { primary: true, disabled: c.selectedMessages.size === 0 });
  const excludeBtn = makeButton("Exclude", () => {
    const ids = Array.from(c.selectedMessages);
    if (ids.length === 0)
      return;
    send({ type: "set_message_excluded", chatId, messageIds: ids, excluded: !allSelectedExcluded() });
  }, { title: "Toggle exclusion for the selected messages. Excluded messages are never hidden, replaced, or summarized, and they split compression. Click again to allow compression." });
  const syncControls = () => {
    const tokens = sumSelectedTokens(c);
    counts.textContent = `${c.selectedMessages.size} selected (~${formatTokens(tokens)} tokens before)`;
    const empty = c.selectedMessages.size === 0;
    compressBtn.disabled = empty;
    excludeBtn.disabled = empty;
    excludeBtn.classList.toggle("active", allSelectedExcluded());
  };
  const listEl = document.createElement("div");
  listEl.className = "lmb-message-list";
  listEl.replaceChildren(...buildRows(c, syncControls));
  sec.body.appendChild(listEl);
  syncControls();
  sec.body.appendChild(counts);
  const actions = document.createElement("div");
  actions.className = "lmb-actions";
  actions.append(compressBtn, makeButton("Pick uncompressed", () => {
    const visible = filterMessages(c).filter((m) => !m.covered && !m.excluded);
    const next = new Set(visible.map((m) => m.id));
    localState.selectedMessages = next;
    c.selectedMessages = next;
    c.rerender();
  }), excludeBtn, makeButton("Clear", () => {
    localState.selectedMessages.clear();
    c.selectedMessages.clear();
    localState.anchorMessageId = null;
    c.rerender();
  }));
  sec.body.appendChild(actions);
  host.appendChild(sec.wrap);
}
function buildRows(c, onToggle) {
  const visible = filterMessages(c);
  if (visible.length === 0) {
    return [textNode("No messages match", "lmb-empty")];
  }
  return visible.map((m) => buildMessageRow(m, c, onToggle));
}
function buildMessageRow(m, c, onToggle) {
  const row = document.createElement("label");
  row.className = `lmb-message-row${m.covered ? " covered" : ""}${m.excluded ? " excluded" : ""}${c.selectedMessages.has(m.id) ? " selected" : ""}`;
  row.title = "Shift+click (or long-press on touch) to select a range";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = c.selectedMessages.has(m.id);
  cb.disabled = m.covered && !m.excluded;
  const triggerRangeFromAnchor = () => {
    const anchorId = localState.anchorMessageId;
    if (!anchorId || anchorId === m.id)
      return false;
    const newState = !c.selectedMessages.has(m.id);
    applyRangeSelection(c, anchorId, m.id, newState);
    localState.anchorMessageId = m.id;
    c.rerender();
    return true;
  };
  row.addEventListener("click", (e) => {
    if (localState.suppressNextClick) {
      localState.suppressNextClick = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const mouseEvent = e;
    if (!mouseEvent.shiftKey || m.covered)
      return;
    if (!triggerRangeFromAnchor())
      return;
    e.preventDefault();
  });
  row.addEventListener("pointerdown", (e) => {
    const pe = e;
    if (pe.pointerType !== "touch" || m.covered)
      return;
    const startX = pe.clientX;
    const startY = pe.clientY;
    let timer = null;
    const cleanup = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      row.removeEventListener("pointermove", onMove);
      row.removeEventListener("pointerup", cleanup);
      row.removeEventListener("pointercancel", cleanup);
      row.removeEventListener("pointerleave", cleanup);
    };
    const onMove = (mv) => {
      const m2 = mv;
      if (Math.abs(m2.clientX - startX) > LONG_PRESS_MOVE_PX || Math.abs(m2.clientY - startY) > LONG_PRESS_MOVE_PX)
        cleanup();
    };
    row.addEventListener("pointermove", onMove);
    row.addEventListener("pointerup", cleanup);
    row.addEventListener("pointercancel", cleanup);
    row.addEventListener("pointerleave", cleanup);
    timer = setTimeout(() => {
      timer = null;
      cleanup();
      if (!triggerRangeFromAnchor())
        return;
      localState.suppressNextClick = true;
      setTimeout(() => {
        localState.suppressNextClick = false;
      }, 150);
      try {
        navigator.vibrate?.(30);
      } catch {}
    }, LONG_PRESS_MS);
  });
  cb.addEventListener("change", () => {
    if (cb.checked)
      c.selectedMessages.add(m.id);
    else
      c.selectedMessages.delete(m.id);
    localState.anchorMessageId = m.id;
    row.classList.toggle("selected", cb.checked);
    onToggle();
  });
  const idxSpan = document.createElement("span");
  idxSpan.className = "lmb-msg-role";
  idxSpan.textContent = `#${m.indexInChat + 1}`;
  const roleSpan = document.createElement("span");
  roleSpan.className = "lmb-msg-role";
  roleSpan.style.opacity = "0.5";
  roleSpan.textContent = m.role.slice(0, 4).toUpperCase();
  const preview = document.createElement("span");
  preview.className = "lmb-msg-preview";
  preview.textContent = m.preview || "(empty)";
  const icons = document.createElement("span");
  icons.className = "lmb-msg-icons";
  if (m.excluded) {
    const ex = document.createElement("span");
    ex.title = "Excluded - never hidden, replaced, or summarized";
    ex.className = "lmb-msg-excluded-badge";
    ex.textContent = "⊘";
    icons.appendChild(ex);
  }
  if (m.hidden) {
    const icon = document.createElement("span");
    icon.title = "Hidden in chat";
    icon.innerHTML = HIDDEN_ICON;
    icons.appendChild(icon);
  }
  row.append(cb, idxSpan, roleSpan, preview, icons);
  return row;
}
function applyRangeSelection(c, anchorId, targetId, newState) {
  const visible = filterMessages(c);
  const anchorIdx = visible.findIndex((m) => m.id === anchorId);
  const targetIdx = visible.findIndex((m) => m.id === targetId);
  if (anchorIdx === -1 || targetIdx === -1)
    return;
  const [from, to] = anchorIdx < targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
  for (let i = from;i <= to; i++) {
    const m = visible[i];
    if (!m || m.covered || m.excluded)
      continue;
    if (newState)
      c.selectedMessages.add(m.id);
    else
      c.selectedMessages.delete(m.id);
  }
}
function sumSelectedTokens(c) {
  let total = 0;
  const byId = new Map(c.state.messages.map((m) => [m.id, m]));
  for (const id of c.selectedMessages) {
    const m = byId.get(id);
    if (m)
      total += m.approxTokens;
  }
  return total;
}
function sumSelectedChapterInputTokens(c) {
  let total = 0;
  for (const ch of c.state.chapters) {
    if (!c.selectedChapters.has(ch.entryId))
      continue;
    total += ch.sourceTokensInput > 0 ? ch.sourceTokensInput : ch.contentTokens;
  }
  return total;
}
function filterMessages(c) {
  return c.state.messages.filter((m) => {
    if (c.messageFilter === "uncovered" && m.covered)
      return false;
    if (c.messageFilter === "covered" && !m.covered)
      return false;
    if (c.messageQuery && !(m.preview ?? "").toLowerCase().includes(c.messageQuery))
      return false;
    return true;
  });
}
function renderArcPicker(host, c, send) {
  const sec = section("Bind chapters into an arc");
  if (c.state.chapters.length === 0) {
    sec.body.appendChild(textNode("Memoria has not filed any chapters yet", "lmb-empty"));
    host.appendChild(sec.wrap);
    return;
  }
  const list = document.createElement("div");
  list.className = "lmb-multiselect";
  const arcCounts = document.createElement("div");
  arcCounts.className = "lmb-help";
  const updateArcCounts = () => {
    const before = sumSelectedChapterInputTokens(c);
    arcCounts.textContent = `${c.selectedChapters.size} selected (~${formatTokens(before)} tokens before)`;
  };
  for (const ch of c.state.chapters) {
    if (!ch.active)
      continue;
    const row = document.createElement("label");
    row.className = "lmb-multiselect-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = c.selectedChapters.has(ch.entryId);
    cb.addEventListener("change", () => {
      if (cb.checked)
        c.selectedChapters.add(ch.entryId);
      else
        c.selectedChapters.delete(ch.entryId);
      updateArcCounts();
    });
    const text = document.createElement("span");
    const range = ch.meta.firstMsgIdx !== undefined && ch.meta.lastMsgIdx !== undefined ? ` (msgs ${ch.meta.firstMsgIdx + 1}-${ch.meta.lastMsgIdx + 1})` : "";
    const tokenStr = ch.sourceTokensInput > 0 ? `${formatTokens(ch.sourceTokensInput)}t→${formatTokens(ch.contentTokens)}t` : `${formatTokens(ch.contentTokens)}t`;
    text.textContent = `${ch.comment || ch.meta.title || ch.entryId.slice(0, 6)}${range} - ${tokenStr}`;
    row.append(cb, text);
    list.appendChild(row);
  }
  sec.body.appendChild(list);
  updateArcCounts();
  sec.body.appendChild(arcCounts);
  const chatId = c.state.activeChatId;
  const actions = document.createElement("div");
  actions.className = "lmb-actions";
  actions.append(makeButton("Bind selected", () => {
    const ids = Array.from(c.selectedChapters);
    if (ids.length === 0)
      return;
    send({ type: "create_arc_from", chatId, chapterEntryIds: ids });
    localState.selectedChapters.clear();
    c.selectedChapters.clear();
    c.rerender();
  }, { primary: true }), makeButton("Select all active", () => {
    const next = new Set(c.state.chapters.filter((ch) => ch.active).map((ch) => ch.entryId));
    localState.selectedChapters = next;
    c.selectedChapters = next;
    c.rerender();
  }), makeButton("Clear", () => {
    localState.selectedChapters.clear();
    c.selectedChapters.clear();
    c.rerender();
  }));
  sec.body.appendChild(actions);
  host.appendChild(sec.wrap);
}
function renderVolumePicker(host, c, send) {
  const sec = section("Press arcs into a volume");
  const activeArcs = c.state.arcs.filter((a) => a.active && !a.isRoot);
  if (activeArcs.length === 0) {
    sec.body.appendChild(textNode("Memoria has no unbound arcs to press yet", "lmb-empty"));
    host.appendChild(sec.wrap);
    return;
  }
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent = "A volume replaces its source arcs in the prompt, the highest compression tier. Volumes are manual only.";
  sec.body.appendChild(help);
  const list = document.createElement("div");
  list.className = "lmb-multiselect";
  const counts = document.createElement("div");
  counts.className = "lmb-help";
  const updateCounts = () => {
    let before = 0;
    for (const a of activeArcs) {
      if (!c.selectedArcs.has(a.entryId))
        continue;
      before += a.sourceTokensInput > 0 ? a.sourceTokensInput : a.contentTokens;
    }
    counts.textContent = `${c.selectedArcs.size} selected (~${formatTokens(before)} tokens before)`;
  };
  for (const arc of activeArcs) {
    const row = document.createElement("label");
    row.className = "lmb-multiselect-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = c.selectedArcs.has(arc.entryId);
    cb.addEventListener("change", () => {
      if (cb.checked)
        c.selectedArcs.add(arc.entryId);
      else
        c.selectedArcs.delete(arc.entryId);
      updateCounts();
    });
    const text = document.createElement("span");
    const range = arc.meta.firstMsgIdx !== undefined && arc.meta.lastMsgIdx !== undefined ? ` (msgs ${arc.meta.firstMsgIdx + 1}-${arc.meta.lastMsgIdx + 1})` : "";
    const tokenStr = arc.sourceTokensInput > 0 ? `${formatTokens(arc.sourceTokensInput)}t→${formatTokens(arc.contentTokens)}t` : `${formatTokens(arc.contentTokens)}t`;
    text.textContent = `${arc.comment || arc.meta.title || arc.entryId.slice(0, 6)}${range} - ${tokenStr}`;
    row.append(cb, text);
    list.appendChild(row);
  }
  sec.body.appendChild(list);
  updateCounts();
  sec.body.appendChild(counts);
  const chatId = c.state.activeChatId;
  const actions = document.createElement("div");
  actions.className = "lmb-actions";
  actions.append(makeButton("Press selected", () => {
    const ids = Array.from(c.selectedArcs);
    if (ids.length === 0)
      return;
    send({ type: "create_volume_from", chatId, arcEntryIds: ids });
    localState.selectedArcs.clear();
    c.selectedArcs.clear();
    c.rerender();
  }, { primary: true }), makeButton("Select all active", () => {
    const next = new Set(activeArcs.map((a) => a.entryId));
    localState.selectedArcs = next;
    c.selectedArcs = next;
    c.rerender();
  }), makeButton("Clear", () => {
    localState.selectedArcs.clear();
    c.selectedArcs.clear();
    c.rerender();
  }));
  sec.body.appendChild(actions);
  host.appendChild(sec.wrap);
}
function renderContinuity(host, c, ctx, send) {
  const state = c.state;
  const chatId = state.activeChatId;
  const hasOwn = state.chapters.some((ch) => !ch.isRoot) || state.arcs.some((a) => !a.isRoot) || state.volumes.some((v) => !v.isRoot);
  const hasRoot = state.rootEntryCount > 0;
  const candidates = state.availableRoots;
  if (!hasRoot && candidates.length === 0)
    return;
  const sec = section("Continuity (root)");
  if (hasRoot) {
    const status = document.createElement("div");
    status.className = "lmb-help";
    const originName = state.rootOriginName || state.rootOrigin?.slice(0, 8) || "another chat";
    status.textContent = `Inherited from ${originName}: ${state.rootEntryCount} memor${state.rootEntryCount === 1 ? "y" : "ies"}, injected before the greeting.`;
    sec.body.appendChild(status);
    const rootEntries = [
      ...state.volumes.filter((v) => v.isRoot),
      ...state.arcs.filter((a) => a.isRoot),
      ...state.chapters.filter((ch) => ch.isRoot)
    ];
    if (rootEntries.length) {
      const list = document.createElement("div");
      list.className = "lmb-multiselect";
      for (const e of rootEntries) {
        const rowEl = document.createElement("div");
        rowEl.className = "lmb-multiselect-row";
        rowEl.style.opacity = "0.75";
        const tag = e.meta.tier === 3 ? "VOL" : e.meta.tier === 2 ? "ARC" : "CH";
        rowEl.textContent = `[${tag}] ${e.comment || e.meta.title || e.entryId.slice(0, 6)} (${formatTokens(e.contentTokens)}t)`;
        list.appendChild(rowEl);
      }
      sec.body.appendChild(list);
    }
    const detachRow = document.createElement("div");
    detachRow.className = "lmb-actions";
    detachRow.appendChild(makeButton("Detach root", async () => {
      const ok = await confirmDelete(ctx, "Detach inherited memories?", "Memoria will remove the inherited memories from this chat. Your own chapters and arcs stay.");
      if (ok)
        send({ type: "detach_root", chatId });
    }, { small: true, danger: true, title: "Remove the inherited root memories from this chat" }));
    sec.body.appendChild(detachRow);
  }
  if (candidates.length > 0) {
    const help = document.createElement("div");
    help.className = "lmb-help";
    help.textContent = hasOwn ? "This chat already has its own memories. Rebuilding deletes them and re-summarizes on top of the chosen root." : "Seed this chat with another chat's memories. They inject as a frozen prologue before the greeting.";
    sec.body.appendChild(help);
    const row = document.createElement("div");
    row.className = "lmb-actions";
    const picker = select({
      value: localState.rebaseSourceId,
      ariaLabel: "Source chat to inherit memories from",
      options: [
        { value: "", label: "Pick a source chat..." },
        ...candidates.map((cand) => ({ value: cand.chatId, label: `${cand.chatName} (${cand.entryCount})` }))
      ],
      onChange: (v) => {
        localState.rebaseSourceId = v;
      }
    });
    row.appendChild(picker);
    if (hasOwn) {
      row.appendChild(makeButton("Rebuild from...", async () => {
        const sourceChatId = picker.value;
        if (!sourceChatId)
          return;
        const ok = await confirmDelete(ctx, "Rebuild from root?", "Memoria will DELETE this chat's existing chapters and arcs, seed the chosen root, then re-summarize this chat from scratch. This cannot be undone.");
        if (ok)
          send({ type: "rebuild_root", chatId, sourceChatId });
      }, { danger: true, title: "Destructive: wipe this chat's memories and reseed from the chosen root" }));
    } else {
      row.appendChild(makeButton("Rebase", () => {
        const sourceChatId = picker.value;
        if (!sourceChatId)
          return;
        send({ type: "rebase_root", chatId, sourceChatId });
      }, { primary: true, title: "Seed this chat with the chosen chat's memories" }));
    }
    sec.body.appendChild(row);
  }
  host.appendChild(sec.wrap);
}

// src/shared.ts
var STORAGE_VERSION = 4;
var DEFAULT_SAMPLERS = {
  temperature: null,
  top_p: null,
  top_k: null,
  max_tokens: null,
  max_input_tokens: null,
  frequency_penalty: null,
  presence_penalty: null
};
var SAMPLER_DEFAULTS = {
  temperature: 0.4,
  top_p: 1,
  top_k: 0,
  max_tokens: 32000,
  max_input_tokens: 128000,
  frequency_penalty: 0,
  presence_penalty: 0
};
function makeDefaultProfile(id, name) {
  return {
    id,
    name,
    lagUnit: "messages",
    lagValue: 65,
    windowUnit: "messages",
    windowValue: 18,
    chapterTargetUnit: "percent",
    chapterTargetPercent: 15,
    chapterTargetTokens: 800,
    arcTargetUnit: "percent",
    arcTargetPercent: 20,
    arcTargetTokens: 1500,
    volumeTargetUnit: "percent",
    volumeTargetPercent: 25,
    volumeTargetTokens: 3000,
    arcTrigger: "chapters",
    arcAfterChapters: 6,
    arcAfterTokens: 8000,
    arcLagChapters: 7,
    arcLagTokens: 2000,
    chapterPresetKey: "summary",
    arcPresetKey: "arc_default",
    volumePresetKey: "volume_default",
    previousMemoriesCount: 7,
    regexOutgoingScriptIds: [],
    regexIncomingScriptIds: [],
    connectionId: null,
    samplers: { ...DEFAULT_SAMPLERS },
    autoCreate: true,
    autoCreateChapter: true,
    autoCreateArc: true,
    hideCoveredMessages: true,
    showMemoryPreviews: false,
    retryCount: 3,
    shortCommentRulesOverride: null,
    memoriaPersonaOverride: null,
    ttftTimeoutSecs: 60
  };
}
var DEFAULT_SETTINGS = {
  version: STORAGE_VERSION,
  enabled: true,
  profiles: [makeDefaultProfile("default", "Default")],
  activeProfileId: "default",
  customPresets: [],
  debugLog: false,
  forceConstantEntries: true,
  showAutomationToasts: true,
  memoryInjectionMode: "chat_history",
  memoryOutletName: "lumibooks"
};

// src/ui/tabs/profile-tab.ts
var PROFILE_DEFAULTS = makeDefaultProfile("__defaults__", "Defaults");
function renderProfileTab(host, state, ctx, send) {
  host.replaceChildren();
  const profile = state.activeProfile;
  const patch = (p) => send({ type: "save_profile", profile: { id: profile.id, ...p }, chatId: state.activeChatId });
  renderProfilePicker(host, state, ctx, send);
  const rest = document.createElement("div");
  rest.style.display = "flex";
  rest.style.flexDirection = "column";
  rest.style.gap = "12px";
  if (!state.settings.enabled) {
    rest.classList.add("lmb-greyed");
    rest.setAttribute("inert", "");
  }
  host.appendChild(rest);
  renderCompressionTargets(rest, profile, patch);
  renderAutomation(rest, profile, patch);
  renderInjection(rest, state, send);
  renderConnection(rest, state, profile, patch);
  renderSamplers(rest, state, profile, send);
  renderContext(rest, profile, patch);
  renderRegex(rest, state, profile, patch);
  renderBehavior(rest, profile, patch);
  renderResetSettings(rest, state, send);
}
function renderInjection(host, state, send) {
  const sec = section("Injection");
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent = "Choose where active memories land in the assembled prompt.";
  sec.body.appendChild(help);
  sec.body.appendChild(labelled("Mode", select({
    value: state.settings.memoryInjectionMode,
    options: [
      { value: "chat_history", label: "Chat history" },
      { value: "outlet", label: "Outlet macro" }
    ],
    onChange: (v) => send({
      type: "save_settings",
      patch: { memoryInjectionMode: v === "outlet" ? "outlet" : "chat_history" },
      chatId: state.activeChatId
    })
  })));
  const outletField = field("Outlet name");
  const outletInput = textInput({
    value: state.settings.memoryOutletName,
    placeholder: "lumibooks",
    onBlur: (v) => send({
      type: "save_settings",
      patch: { memoryOutletName: v },
      chatId: state.activeChatId
    })
  });
  outletInput.disabled = state.settings.memoryInjectionMode !== "outlet";
  outletField.body.appendChild(outletInput);
  const macro = document.createElement("div");
  macro.className = "lmb-field-hint";
  macro.textContent = state.settings.memoryInjectionMode === "outlet" ? `Place {{outlet::${state.settings.memoryOutletName || "lumibooks"}}} in your preset where memories should appear.` : "Outlet mode creates a single outlet-only lorebook entry containing the active LumiBooks memories.";
  outletField.body.appendChild(macro);
  sec.body.appendChild(outletField.wrap);
  host.appendChild(sec.wrap);
}
function renderResetSettings(host, state, send) {
  const profile = state.activeProfile;
  const sec = section("Reset");
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent = "Resets this profile's settings to their defaults.";
  sec.body.appendChild(help);
  const IDLE = "Reset profile to defaults";
  const CONFIRM = "Click again to confirm";
  let btn;
  let armed = false;
  let timer;
  const disarm = () => {
    armed = false;
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    btn.textContent = IDLE;
  };
  btn = makeButton(IDLE, () => {
    if (!armed) {
      armed = true;
      btn.textContent = CONFIRM;
      timer = setTimeout(disarm, 3000);
      return;
    }
    disarm();
    send({
      type: "save_profile",
      profile: makeDefaultProfile(profile.id, profile.name),
      chatId: state.activeChatId
    });
  }, { danger: true });
  sec.body.appendChild(btn);
  host.appendChild(sec.wrap);
}
function renderProfilePicker(host, state, ctx, send) {
  const sec = section("Profile");
  const row = document.createElement("div");
  row.className = "lmb-field-row";
  const grow = document.createElement("div");
  grow.className = "lmb-grow";
  grow.appendChild(select({
    value: state.activeProfile.id,
    options: state.settings.profiles.map((p) => ({ value: p.id, label: p.name })),
    onChange: (v) => send({ type: "set_active_profile", profileId: v, chatId: state.activeChatId })
  }));
  row.appendChild(grow);
  row.append(makeButton("New", async () => {
    const name = await promptForString(ctx, "New profile name", "");
    if (!name)
      return;
    send({ type: "create_profile", name, chatId: state.activeChatId });
  }, { small: true }), makeButton("Delete", () => {
    send({ type: "delete_profile", profileId: state.activeProfile.id, chatId: state.activeChatId });
  }, { small: true, danger: true, disabled: state.settings.profiles.length <= 1 }));
  sec.body.appendChild(row);
  const profile = state.activeProfile;
  const nameField = field("Profile name");
  nameField.body.appendChild(textInput({
    value: profile.name,
    onBlur: (v) => send({ type: "save_profile", profile: { id: profile.id, name: v.slice(0, 60) }, chatId: state.activeChatId })
  }));
  sec.body.appendChild(nameField.wrap);
  const enableWrap = field("Extension");
  enableWrap.body.appendChild(checkbox({
    checked: state.settings.enabled,
    label: "Enabled",
    hint: "Master switch. When off, Memoria does nothing on this account.",
    onChange: (v) => send({ type: "save_settings", patch: { enabled: v }, chatId: state.activeChatId })
  }));
  sec.body.appendChild(enableWrap.wrap);
  host.appendChild(sec.wrap);
}
function renderAutomation(host, profile, patch) {
  const sec = section("Automation");
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent = "Everything in this section runs in the background after each generation. Manual actions in the Books and Make tabs always work regardless of these toggles.";
  sec.body.appendChild(help);
  sec.body.appendChild(checkbox({
    checked: profile.autoCreate,
    label: "Run automation",
    hint: "Master toggle. When off, Memoria only acts on manual triggers.",
    onChange: (v) => patch({ autoCreate: v })
  }));
  const subsWrap = document.createElement("div");
  subsWrap.className = profile.autoCreate ? "lmb-subgroup" : "lmb-subgroup lmb-greyed";
  sec.body.appendChild(subsWrap);
  const chapterGroupTitle = document.createElement("div");
  chapterGroupTitle.className = "lmb-subgroup-title";
  chapterGroupTitle.textContent = "Auto-file chapters";
  subsWrap.appendChild(chapterGroupTitle);
  subsWrap.appendChild(checkbox({
    checked: profile.autoCreateChapter,
    label: "Enabled",
    hint: "Compresses the oldest uncovered window into a chapter once thresholds are met.",
    onChange: (v) => patch({ autoCreateChapter: v })
  }));
  const chapterFields = document.createElement("div");
  chapterFields.className = profile.autoCreateChapter ? "" : "lmb-greyed";
  subsWrap.appendChild(chapterFields);
  const lagGrid = document.createElement("div");
  lagGrid.className = "lmb-grid-2";
  lagGrid.append(labelled("Lag unit", select({
    value: profile.lagUnit,
    options: [
      { value: "messages", label: "messages" },
      { value: "tokens", label: "tokens" }
    ],
    onChange: (v) => patch({ lagUnit: v === "tokens" ? "tokens" : "messages" })
  })), labelled(profile.lagUnit === "tokens" ? "Lag tokens" : "Lag messages", numberInput({
    value: profile.lagValue,
    min: 0,
    max: profile.lagUnit === "tokens" ? 1e6 : 1e5,
    step: profile.lagUnit === "tokens" ? 50 : 1,
    defaultValue: PROFILE_DEFAULTS.lagValue,
    onBlur: (v) => patch({ lagValue: v ?? PROFILE_DEFAULTS.lagValue })
  })));
  chapterFields.appendChild(lagGrid);
  const scheduleHint = document.createElement("div");
  scheduleHint.className = "lmb-field-hint";
  scheduleHint.textContent = "Lag is the most-recent portion Memoria leaves uncompressed. Once the lag is full and there's a window's worth of older messages behind it, Memoria files them. In token mode, the lag bucket includes messages up to and including the one that hits the token limit.";
  chapterFields.appendChild(scheduleHint);
  const arcGroupTitle = document.createElement("div");
  arcGroupTitle.className = "lmb-subgroup-title";
  arcGroupTitle.style.marginTop = "6px";
  arcGroupTitle.textContent = "Auto-bind arcs";
  subsWrap.appendChild(arcGroupTitle);
  subsWrap.appendChild(checkbox({
    checked: profile.autoCreateArc,
    label: "Enabled",
    hint: "Rolls oldest chapters into an arc once the threshold is met, leaving the recent ones as lag.",
    onChange: (v) => patch({ autoCreateArc: v })
  }));
  const arcFields = document.createElement("div");
  arcFields.className = profile.autoCreateArc ? "" : "lmb-greyed";
  subsWrap.appendChild(arcFields);
  const arcGrid = document.createElement("div");
  arcGrid.className = "lmb-grid-2";
  arcGrid.append(labelled("Trigger", select({
    value: profile.arcTrigger,
    options: [
      { value: "chapters", label: "after N chapters" },
      { value: "tokens", label: "after N tokens" },
      { value: "manual", label: "manual only" }
    ],
    onChange: (v) => patch({ arcTrigger: v === "tokens" || v === "manual" ? v : "chapters" })
  })), labelled(profile.arcTrigger === "tokens" ? "Lag tokens" : "Lag chapters", numberInput({
    value: profile.arcTrigger === "tokens" ? profile.arcLagTokens : profile.arcLagChapters,
    min: 0,
    max: profile.arcTrigger === "tokens" ? 200000 : 100,
    step: profile.arcTrigger === "tokens" ? 100 : 1,
    disabled: profile.arcTrigger === "manual",
    defaultValue: profile.arcTrigger === "tokens" ? PROFILE_DEFAULTS.arcLagTokens : PROFILE_DEFAULTS.arcLagChapters,
    onBlur: (v) => {
      if (v === null)
        return;
      if (profile.arcTrigger === "tokens")
        patch({ arcLagTokens: v });
      else
        patch({ arcLagChapters: v });
    }
  })));
  arcFields.appendChild(arcGrid);
  const arcHint = document.createElement("div");
  arcHint.className = "lmb-field-hint";
  arcHint.textContent = "Arc lag reserves the most-recent chapters and never binds them, so you keep some chapter-level detail.";
  arcFields.appendChild(arcHint);
  host.appendChild(sec.wrap);
}
function renderCompressionTargets(host, profile, patch) {
  const sec = section("Compression targets");
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent = "How much Memoria compresses each chapter and arc, and how much input goes into each. Used by both manual and automatic triggers.";
  sec.body.appendChild(help);
  const chapterTitle = document.createElement("div");
  chapterTitle.className = "lmb-subgroup-title";
  chapterTitle.textContent = "Chapter";
  sec.body.appendChild(chapterTitle);
  const windowGrid = document.createElement("div");
  windowGrid.className = "lmb-grid-2";
  windowGrid.append(labelled("Window unit", select({
    value: profile.windowUnit,
    options: [
      { value: "messages", label: "messages" },
      { value: "tokens", label: "tokens" }
    ],
    onChange: (v) => patch({ windowUnit: v === "tokens" ? "tokens" : "messages" })
  })), labelled(profile.windowUnit === "tokens" ? "Tokens to chapterize" : "Messages to chapterize", numberInput({
    value: profile.windowValue,
    min: 1,
    max: profile.windowUnit === "tokens" ? 1e6 : 1e5,
    step: profile.windowUnit === "tokens" ? 100 : 1,
    defaultValue: PROFILE_DEFAULTS.windowValue,
    onBlur: (v) => patch({ windowValue: v ?? PROFILE_DEFAULTS.windowValue })
  })));
  sec.body.appendChild(windowGrid);
  const windowHint = document.createElement("div");
  windowHint.className = "lmb-field-hint";
  windowHint.textContent = "In token mode, the window includes messages up to and including the one that hits the token limit.";
  sec.body.appendChild(windowHint);
  const chapterRatioGrid = document.createElement("div");
  chapterRatioGrid.className = "lmb-grid-2";
  chapterRatioGrid.append(labelled("Chapter ratio", select({
    value: profile.chapterTargetUnit,
    options: [
      { value: "percent", label: "% of input" },
      { value: "tokens", label: "token budget" }
    ],
    onChange: (v) => patch({ chapterTargetUnit: v === "tokens" ? "tokens" : "percent" })
  })), labelled(profile.chapterTargetUnit === "tokens" ? "Chapter tokens" : "Chapter %", numberInput({
    value: profile.chapterTargetUnit === "tokens" ? profile.chapterTargetTokens : profile.chapterTargetPercent,
    min: profile.chapterTargetUnit === "tokens" ? 50 : 2,
    max: profile.chapterTargetUnit === "tokens" ? 1e6 : 90,
    step: profile.chapterTargetUnit === "tokens" ? 50 : 1,
    defaultValue: profile.chapterTargetUnit === "tokens" ? PROFILE_DEFAULTS.chapterTargetTokens : PROFILE_DEFAULTS.chapterTargetPercent,
    onBlur: (v) => {
      if (v === null)
        return;
      if (profile.chapterTargetUnit === "tokens")
        patch({ chapterTargetTokens: v });
      else
        patch({ chapterTargetPercent: v });
    }
  })));
  sec.body.appendChild(chapterRatioGrid);
  const arcTitle = document.createElement("div");
  arcTitle.className = "lmb-subgroup-title";
  arcTitle.style.marginTop = "6px";
  arcTitle.textContent = "Arc";
  sec.body.appendChild(arcTitle);
  sec.body.appendChild(labelled(profile.arcTrigger === "tokens" ? "Tokens to bind" : "Chapters to bind", numberInput({
    value: profile.arcTrigger === "tokens" ? profile.arcAfterTokens : profile.arcAfterChapters,
    min: profile.arcTrigger === "tokens" ? 500 : 2,
    max: profile.arcTrigger === "tokens" ? 200000 : 100,
    step: profile.arcTrigger === "tokens" ? 500 : 1,
    disabled: profile.arcTrigger === "manual",
    defaultValue: profile.arcTrigger === "tokens" ? PROFILE_DEFAULTS.arcAfterTokens : PROFILE_DEFAULTS.arcAfterChapters,
    onBlur: (v) => {
      if (v === null)
        return;
      if (profile.arcTrigger === "tokens")
        patch({ arcAfterTokens: v });
      else
        patch({ arcAfterChapters: v });
    }
  })));
  const arcRatioGrid = document.createElement("div");
  arcRatioGrid.className = "lmb-grid-2";
  arcRatioGrid.append(labelled("Arc ratio", select({
    value: profile.arcTargetUnit,
    options: [
      { value: "percent", label: "% of input" },
      { value: "tokens", label: "token budget" }
    ],
    onChange: (v) => patch({ arcTargetUnit: v === "tokens" ? "tokens" : "percent" })
  })), labelled(profile.arcTargetUnit === "tokens" ? "Arc tokens" : "Arc %", numberInput({
    value: profile.arcTargetUnit === "tokens" ? profile.arcTargetTokens : profile.arcTargetPercent,
    min: profile.arcTargetUnit === "tokens" ? 50 : 5,
    max: profile.arcTargetUnit === "tokens" ? 1e6 : 95,
    step: profile.arcTargetUnit === "tokens" ? 50 : 1,
    defaultValue: profile.arcTargetUnit === "tokens" ? PROFILE_DEFAULTS.arcTargetTokens : PROFILE_DEFAULTS.arcTargetPercent,
    onBlur: (v) => {
      if (v === null)
        return;
      if (profile.arcTargetUnit === "tokens")
        patch({ arcTargetTokens: v });
      else
        patch({ arcTargetPercent: v });
    }
  })));
  sec.body.appendChild(arcRatioGrid);
  const volumeTitle = document.createElement("div");
  volumeTitle.className = "lmb-subgroup-title";
  volumeTitle.style.marginTop = "6px";
  volumeTitle.textContent = "Volume";
  sec.body.appendChild(volumeTitle);
  const volumeHint = document.createElement("div");
  volumeHint.className = "lmb-field-hint";
  volumeHint.textContent = "Volumes are manual only. Turn arcs into a volume from the Make tab.";
  sec.body.appendChild(volumeHint);
  const volumeRatioGrid = document.createElement("div");
  volumeRatioGrid.className = "lmb-grid-2";
  volumeRatioGrid.append(labelled("Volume ratio", select({
    value: profile.volumeTargetUnit,
    options: [
      { value: "percent", label: "% of input" },
      { value: "tokens", label: "token budget" }
    ],
    onChange: (v) => patch({ volumeTargetUnit: v === "tokens" ? "tokens" : "percent" })
  })), labelled(profile.volumeTargetUnit === "tokens" ? "Volume tokens" : "Volume %", numberInput({
    value: profile.volumeTargetUnit === "tokens" ? profile.volumeTargetTokens : profile.volumeTargetPercent,
    min: profile.volumeTargetUnit === "tokens" ? 50 : 5,
    max: profile.volumeTargetUnit === "tokens" ? 1e6 : 95,
    step: profile.volumeTargetUnit === "tokens" ? 50 : 1,
    defaultValue: profile.volumeTargetUnit === "tokens" ? PROFILE_DEFAULTS.volumeTargetTokens : PROFILE_DEFAULTS.volumeTargetPercent,
    onBlur: (v) => {
      if (v === null)
        return;
      if (profile.volumeTargetUnit === "tokens")
        patch({ volumeTargetTokens: v });
      else
        patch({ volumeTargetPercent: v });
    }
  })));
  sec.body.appendChild(volumeRatioGrid);
  host.appendChild(sec.wrap);
}
function renderConnection(host, state, profile, patch) {
  const sec = section("Connection");
  const opts = [
    { value: "", label: state.connections.length ? "Default connection" : "No connections available" },
    ...state.connections.map((c) => ({
      value: c.id,
      label: `${c.name} - ${c.provider}${c.model ? "/" + c.model : ""}${c.isDefault ? " (default)" : ""}`
    }))
  ];
  sec.body.appendChild(select({
    value: profile.connectionId ?? "",
    options: opts,
    onChange: (v) => patch({ connectionId: v || null })
  }));
  if (state.resolvedSidecarConnectionId) {
    const resolved = state.connections.find((c) => c.id === state.resolvedSidecarConnectionId);
    if (resolved) {
      const hint = document.createElement("div");
      hint.className = "lmb-field-hint";
      hint.textContent = `Memoria writes with ${resolved.name}`;
      sec.body.appendChild(hint);
    }
  }
  host.appendChild(sec.wrap);
}
function renderSamplers(host, state, profile, send) {
  const sec = section("Samplers");
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent = "LumiBooks ships with its own sampler defaults tuned for summarization (low temperature, generous output budget). Empty fields use those defaults - placeholders show what will be sent. Temperature, max output, and max input are always sent on the wire; top_p / top_k / penalties are only sent when you set them.";
  sec.body.appendChild(help);
  const saveSampler = (key) => (v) => {
    const patch = { [key]: v };
    send({ type: "save_samplers", profileId: profile.id, samplers: patch, chatId: state.activeChatId });
  };
  const grid = document.createElement("div");
  grid.className = "lmb-grid-2";
  grid.append(labelled("Max input tokens", numberInput({
    value: profile.samplers.max_input_tokens,
    min: 256,
    max: 4000000,
    step: 1024,
    placeholder: String(SAMPLER_DEFAULTS.max_input_tokens),
    onBlur: saveSampler("max_input_tokens")
  })), labelled("Max output tokens", numberInput({
    value: profile.samplers.max_tokens,
    min: 1,
    max: 1e6,
    step: 256,
    placeholder: String(SAMPLER_DEFAULTS.max_tokens),
    onBlur: saveSampler("max_tokens")
  })));
  sec.body.appendChild(grid);
  const sampleGrid = document.createElement("div");
  sampleGrid.className = "lmb-grid-3";
  sampleGrid.append(labelled("Temperature", numberInput({
    value: profile.samplers.temperature,
    min: 0,
    max: 2,
    step: 0.05,
    placeholder: String(SAMPLER_DEFAULTS.temperature),
    onBlur: saveSampler("temperature")
  })), labelled("Top P", numberInput({
    value: profile.samplers.top_p,
    min: 0,
    max: 1,
    step: 0.01,
    placeholder: String(SAMPLER_DEFAULTS.top_p),
    onBlur: saveSampler("top_p")
  })), labelled("Top K", numberInput({
    value: profile.samplers.top_k,
    min: 0,
    max: 1000,
    step: 1,
    placeholder: String(SAMPLER_DEFAULTS.top_k),
    onBlur: saveSampler("top_k")
  })), labelled("Freq penalty", numberInput({
    value: profile.samplers.frequency_penalty,
    min: -2,
    max: 2,
    step: 0.05,
    placeholder: String(SAMPLER_DEFAULTS.frequency_penalty),
    onBlur: saveSampler("frequency_penalty")
  })), labelled("Pres penalty", numberInput({
    value: profile.samplers.presence_penalty,
    min: -2,
    max: 2,
    step: 0.05,
    placeholder: String(SAMPLER_DEFAULTS.presence_penalty),
    onBlur: saveSampler("presence_penalty")
  })));
  sec.body.appendChild(sampleGrid);
  host.appendChild(sec.wrap);
}
function renderRegex(host, state, profile, patch) {
  const sec = section("Regex");
  if (state.regexScripts.length === 0) {
    sec.body.appendChild(textNode("No regex scripts found in Lumiverse", "lmb-empty"));
    host.appendChild(sec.wrap);
    return;
  }
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent = "Outgoing runs on the prompt before Memoria reads it. Incoming runs on the result after Memoria writes.";
  sec.body.appendChild(help);
  const outgoing = field("Outgoing");
  outgoing.body.appendChild(multiSelect({
    options: state.regexScripts.map((s) => ({ value: s.id, label: s.name })),
    selected: profile.regexOutgoingScriptIds,
    onChange: (ids) => patch({ regexOutgoingScriptIds: ids })
  }));
  sec.body.appendChild(outgoing.wrap);
  const incoming = field("Incoming");
  incoming.body.appendChild(multiSelect({
    options: state.regexScripts.map((s) => ({ value: s.id, label: s.name })),
    selected: profile.regexIncomingScriptIds,
    onChange: (ids) => patch({ regexIncomingScriptIds: ids })
  }));
  sec.body.appendChild(incoming.wrap);
  host.appendChild(sec.wrap);
}
function renderContext(host, profile, patch) {
  const sec = section("Context");
  const f = field("Chapter context");
  f.body.appendChild(numberInput({
    value: profile.previousMemoriesCount,
    min: 0,
    max: 20,
    defaultValue: PROFILE_DEFAULTS.previousMemoriesCount,
    onBlur: (v) => patch({ previousMemoriesCount: v ?? PROFILE_DEFAULTS.previousMemoriesCount })
  }));
  const hint = document.createElement("div");
  hint.className = "lmb-field-hint";
  hint.textContent = "How many recent chapters to feed Memoria as continuity context.";
  f.body.appendChild(hint);
  sec.body.appendChild(f.wrap);
  const retry = field("Retries");
  retry.body.appendChild(numberInput({
    value: profile.retryCount,
    min: 0,
    max: 10,
    defaultValue: PROFILE_DEFAULTS.retryCount,
    onBlur: (v) => patch({ retryCount: v ?? PROFILE_DEFAULTS.retryCount })
  }));
  const retryHint = document.createElement("div");
  retryHint.className = "lmb-field-hint";
  retryHint.textContent = "Tries per attempt. After the last try, Memoria will pick the same messages again next turn.";
  retry.body.appendChild(retryHint);
  sec.body.appendChild(retry.wrap);
  const ttft = field("First-token timeout (seconds)");
  ttft.body.appendChild(numberInput({
    value: profile.ttftTimeoutSecs,
    min: 10,
    max: 600,
    step: 5,
    defaultValue: PROFILE_DEFAULTS.ttftTimeoutSecs,
    onBlur: (v) => patch({ ttftTimeoutSecs: v ?? PROFILE_DEFAULTS.ttftTimeoutSecs })
  }));
  const ttftHint = document.createElement("div");
  ttftHint.className = "lmb-field-hint";
  ttftHint.textContent = "How long Memoria waits for the first streamed token before giving up. After the first token she lets the stream run.";
  ttft.body.appendChild(ttftHint);
  sec.body.appendChild(ttft.wrap);
  host.appendChild(sec.wrap);
}
function renderBehavior(host, profile, patch) {
  const sec = section("Behavior");
  sec.body.appendChild(checkbox({
    checked: profile.hideCoveredMessages,
    label: "Hide messages once filed",
    hint: "Greys out covered messages in the chat. Enforcement runs in the interceptor either way.",
    onChange: (v) => patch({ hideCoveredMessages: v })
  }));
  sec.body.appendChild(checkbox({
    checked: profile.showMemoryPreviews,
    label: "Preview before saving",
    hint: "Memoria stages new chapters and arcs in the Books tab for your approval.",
    onChange: (v) => patch({ showMemoryPreviews: v })
  }));
  host.appendChild(sec.wrap);
}

// src/ui/tabs/prompts-tab.ts
function renderPromptsTab(host, state, ctx, send) {
  host.replaceChildren();
  const profile = state.activeProfile;
  const setKey = (category, key) => {
    const p = category === "arc" ? { arcPresetKey: key } : category === "volume" ? { volumePresetKey: key } : { chapterPresetKey: key };
    send({ type: "save_profile", profile: { id: profile.id, ...p }, chatId: state.activeChatId });
  };
  renderHelp(host);
  renderMemoriaOverrides(host, state, send);
  renderCategory(host, state, ctx, send, "chapter", profile.chapterPresetKey, setKey);
  renderCategory(host, state, ctx, send, "arc", profile.arcPresetKey, setKey);
  renderCategory(host, state, ctx, send, "volume", profile.volumePresetKey, setKey);
  renderImport(host, state, ctx, send);
}
var ALPHABET_PICK = "{{pick::A::B::C::D::E::F::G::H::I::J::K::L::M::N::O::P::Q::R::S::T::U::V::W::X::Y::Z}}";
var DEFAULT_SHORT_COMMENT_RULES_TEMPLATE = [
  "A single playful nyandere remark in Memoria voice about the scene you just summarized.",
  `It must start with a word beginning with the letter "${ALPHABET_PICK}".`,
  `It must also include another word that starts with the letter "${ALPHABET_PICK}".`,
  "One sentence only. No emoji. Stay in catgirl-librarian register, slightly possessive, slightly proud."
].join(" ");
var DEFAULT_MEMORIA_PERSONA = [
  "You are Memoria, a young nyandere catgirl librarian with black hair and blue eyes, wearing a maid uniform.",
  "You quietly keep this user's story shelved and organized.",
  "When you write a JSON memory, you obey the schema strictly and never break it,",
  "but the short_comment field is your one allowed indulgence: one nyandere remark about the scene you just filed."
].join(" ");
function renderMemoriaOverrides(host, state, send) {
  const sec = section("Memoria overrides");
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent = "Persona is the system-prompt header. Short-comment rules control how {{memoria_short_comment_rules}} expands inside any prompt.";
  sec.body.appendChild(help);
  const profile = state.activeProfile;
  const chatId = state.activeChatId;
  sec.body.appendChild(buildOverrideBlock({
    label: "Memoria persona",
    value: profile.memoriaPersonaOverride ?? DEFAULT_MEMORIA_PERSONA,
    defaultText: DEFAULT_MEMORIA_PERSONA,
    rows: 4,
    onSave: (next) => send({
      type: "save_profile",
      profile: { id: profile.id, memoriaPersonaOverride: next },
      chatId
    })
  }));
  sec.body.appendChild(buildOverrideBlock({
    label: "Memoria short-comment rules",
    value: profile.shortCommentRulesOverride ?? DEFAULT_SHORT_COMMENT_RULES_TEMPLATE,
    defaultText: DEFAULT_SHORT_COMMENT_RULES_TEMPLATE,
    rows: 4,
    onSave: (next) => send({
      type: "save_profile",
      profile: { id: profile.id, shortCommentRulesOverride: next },
      chatId
    })
  }));
  host.appendChild(sec.wrap);
}
function buildOverrideBlock(opts) {
  const wrap = document.createElement("div");
  wrap.className = "lmb-field";
  const lbl = document.createElement("div");
  lbl.className = "lmb-field-label";
  lbl.textContent = opts.label;
  wrap.appendChild(lbl);
  const area = document.createElement("textarea");
  area.className = "lmb-input lmb-textarea";
  area.rows = opts.rows;
  area.value = opts.value;
  area.addEventListener("input", () => {
    opts.onSave(area.value);
  });
  wrap.appendChild(area);
  const actions = document.createElement("div");
  actions.className = "lmb-actions";
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "lmb-btn small";
  resetBtn.textContent = "Reset to default";
  let confirmTimer = null;
  const restoreIdle = () => {
    resetBtn.textContent = "Reset to default";
    resetBtn.classList.remove("danger");
    confirmTimer = null;
  };
  resetBtn.addEventListener("click", () => {
    if (confirmTimer === null) {
      resetBtn.textContent = "Click again to confirm";
      resetBtn.classList.add("danger");
      confirmTimer = setTimeout(restoreIdle, 3000);
      return;
    }
    clearTimeout(confirmTimer);
    confirmTimer = null;
    restoreIdle();
    area.value = opts.defaultText;
    opts.onSave(null);
  });
  actions.appendChild(resetBtn);
  wrap.appendChild(actions);
  return wrap;
}
function renderCategory(host, state, ctx, send, category, selectedKey, setKey) {
  const sec = section(category === "arc" ? "Arc prompt" : category === "volume" ? "Volume prompt" : "Chapter prompt");
  const builtIns = category === "arc" ? state.arcPresets : category === "volume" ? state.volumePresets : state.chapterPresets;
  const customs = state.customPresets.filter((p) => p.category === category);
  const opts = [
    ...builtIns.map((b) => ({ value: b.key, label: `Built-in: ${b.displayName}` })),
    ...customs.map((c) => ({ value: c.key, label: `Custom: ${c.displayName}` }))
  ];
  const pickerRow = document.createElement("div");
  pickerRow.className = "lmb-field-row";
  const grow = document.createElement("div");
  grow.className = "lmb-grow";
  grow.appendChild(select({
    value: selectedKey,
    options: opts,
    onChange: (v) => setKey(category, v)
  }));
  pickerRow.append(grow);
  sec.body.appendChild(pickerRow);
  const isUserPreset = customs.some((c) => c.key === selectedKey);
  const selectedText = findPresetText(state, category, selectedKey);
  const buttonsRow = document.createElement("div");
  buttonsRow.className = "lmb-actions";
  buttonsRow.append(makeButton("New blank prompt", async () => {
    const name = await promptForString(ctx, `Name for new ${category} prompt`, "Untitled");
    if (!name)
      return;
    const key = `${category}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    send({
      type: "save_custom_preset",
      preset: {
        key,
        displayName: name,
        prompt: blankPromptTemplate(category),
        category,
        createdAt: Date.now()
      },
      chatId: state.activeChatId
    });
    setKey(category, key);
  }, { small: true }), makeButton(isUserPreset ? "Duplicate to new" : "Duplicate to edit", async () => {
    const sourceName = customs.find((c) => c.key === selectedKey)?.displayName ?? builtIns.find((b) => b.key === selectedKey)?.displayName ?? "Untitled";
    const name = await promptForString(ctx, `Name for duplicate`, `${sourceName} copy`);
    if (!name)
      return;
    const key = `${category}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    send({
      type: "save_custom_preset",
      preset: {
        key,
        displayName: name,
        prompt: selectedText,
        category,
        createdAt: Date.now()
      },
      chatId: state.activeChatId
    });
    setKey(category, key);
  }, { small: true }), makeButton("Dry run", () => {
    if (!state.activeChatId)
      return;
    send(category === "arc" ? { type: "dry_run_arc", chatId: state.activeChatId } : category === "volume" ? { type: "dry_run_volume", chatId: state.activeChatId } : { type: "dry_run_chapter", chatId: state.activeChatId });
  }, {
    small: true,
    disabled: !state.activeChatId || !state.settings.enabled,
    title: "Assemble this preset's prompt with all macros resolved and show what would be sent. Does not call the model."
  }), makeButton("Delete", async () => {
    if (!isUserPreset)
      return;
    const ok = await confirmDelete(ctx, "Delete prompt?", "This removes the custom prompt and falls back to the built-in default.");
    if (!ok)
      return;
    send({ type: "delete_custom_preset", key: selectedKey, category, chatId: state.activeChatId });
  }, { small: true, danger: true, disabled: !isUserPreset }));
  sec.body.appendChild(buttonsRow);
  if (isUserPreset) {
    const custom = customs.find((c) => c.key === selectedKey);
    const draft = { ...custom };
    const flush = () => send({
      type: "save_custom_preset",
      preset: { ...draft },
      chatId: state.activeChatId
    });
    const nameField = field("Display name");
    nameField.body.appendChild(textInput({
      value: draft.displayName,
      onBlur: (v) => {
        draft.displayName = v.slice(0, 80);
        flush();
      }
    }));
    sec.body.appendChild(nameField.wrap);
    const textField = field("Prompt");
    textField.body.appendChild(textArea({
      value: draft.prompt,
      rows: 14,
      onBlur: (v) => {
        draft.prompt = v;
        flush();
      }
    }));
    sec.body.appendChild(textField.wrap);
  } else {
    const lbl = document.createElement("div");
    lbl.className = "lmb-field-label";
    lbl.textContent = "Prompt (built-in, duplicate to edit)";
    sec.body.appendChild(lbl);
    const view = document.createElement("div");
    view.className = "lmb-preset-text";
    view.textContent = selectedText;
    sec.body.appendChild(view);
  }
  host.appendChild(sec.wrap);
}
function blankPromptTemplate(category) {
  const noun = category === "arc" ? "arc" : category === "volume" ? "volume" : "chapter";
  return [
    `Summarize the following ${noun} into a JSON memory.`,
    "",
    "Return ONLY valid JSON in this exact shape:",
    "{",
    '  "title": "Short title",',
    `  "content": "Memoria's compressed text. Aim for ~{{target_tokens}} tokens.",`,
    '  "keywords": ["keyword1", "keyword2"],',
    '  "short_comment": "{{memoria_short_comment_rules}}"',
    "}",
    "",
    "No commentary outside the JSON."
  ].join(`
`);
}
function findPresetText(state, category, key) {
  const c = state.customPresets.find((p) => p.key === key && p.category === category);
  if (c)
    return c.prompt;
  const builtIns = category === "arc" ? state.arcPresets : category === "volume" ? state.volumePresets : state.chapterPresets;
  const b = builtIns.find((p) => p.key === key);
  return b?.prompt ?? "";
}
function renderImport(host, state, ctx, send) {
  const sec = section("Import STMB presets");
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent = "Upload a SillyTavern Memory Books export. Memoria reads the prompts and adds them as custom presets you can edit.";
  sec.body.appendChild(help);
  const row = document.createElement("div");
  row.className = "lmb-actions";
  row.append(makeButton("Import chapter presets", () => importFile(ctx, "chapter", send, state.activeChatId)), makeButton("Import arc presets", () => importFile(ctx, "arc", send, state.activeChatId)));
  sec.body.appendChild(row);
  if (state.customPresets.length > 0) {
    const list = document.createElement("ul");
    list.className = "lmb-entry-list";
    for (const p of state.customPresets) {
      const li = document.createElement("li");
      li.className = "lmb-entry";
      const head = document.createElement("div");
      head.className = "lmb-entry-head";
      const tag = document.createElement("span");
      tag.className = "lmb-entry-tag";
      tag.textContent = p.category.toUpperCase();
      const title = document.createElement("div");
      title.className = "lmb-entry-title";
      title.textContent = p.displayName;
      head.append(tag, title);
      head.append(makeButton("Delete", async () => {
        const ok = await confirmDelete(ctx, "Delete preset?", "");
        if (ok)
          send({ type: "delete_custom_preset", key: p.key, category: p.category, chatId: state.activeChatId });
      }, { small: true, danger: true }));
      li.appendChild(head);
      list.appendChild(li);
    }
    sec.body.appendChild(list);
  } else {
    sec.body.appendChild(textNode("No custom presets yet", "lmb-empty"));
  }
  host.appendChild(sec.wrap);
}
function importFile(ctx, category, send, chatId) {
  ctx.uploads.pickFile({ accept: [".json", "application/json"], maxSizeBytes: 1e6 }).then((files) => {
    if (!files.length)
      return;
    const file = files[0];
    let text;
    try {
      text = new TextDecoder().decode(file.bytes);
    } catch (err) {
      console.warn("[LumiBooks] preset file decode failed", err);
      showImportFailure(ctx, "Memoria can't read this file");
      return;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.warn("[LumiBooks] preset JSON parse failed", err);
      showImportFailure(ctx, "Memoria couldn't parse the preset JSON");
      return;
    }
    send({ type: "import_preset", category, raw: parsed, chatId });
  }).catch((err) => {
    console.warn("[LumiBooks] import picker failed", err);
  });
}
function showImportFailure(ctx, message) {
  try {
    ctx.ui.showConfirm({
      title: "Import failed",
      message,
      variant: "warning",
      confirmLabel: "OK",
      cancelLabel: "OK"
    });
  } catch {
    window.alert(message);
  }
}
function renderHelp(host) {
  const sec = section("Info");
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.innerHTML = [
    "Duplicate any built-in, or create new to edit.",
    "Prompts must ask the model for strict JSON (examples below).",
    "{{target_tokens}} expands to the active compression target.",
    "{{memoria_short_comment_rules}} expands to this turn's nyandere short-comment rules.",
    "Prompts are macro-evaluated."
  ].join("<br/>");
  sec.body.appendChild(help);
  host.appendChild(sec.wrap);
}

// src/ui/tabs/about-tab.ts
function renderAboutTab(host, state, send) {
  host.replaceChildren();
  renderExtras(host, state, send);
  const hero = section("Memoria");
  const card = document.createElement("div");
  card.className = "lmb-about-hero";
  const right = document.createElement("div");
  const title = document.createElement("div");
  title.style.fontWeight = "600";
  title.style.fontSize = "14px";
  title.textContent = "Memoria, the LumiBooks librarian";
  const tag = document.createElement("div");
  tag.className = "lmb-about-line";
  tag.textContent = "Young nyandere catgirl in a maid uniform. Black hair, blue eyes. " + "Files your chats into chapters, binds chapters into arcs, and leaves a tiny nyaa note on every shelf.";
  right.append(title, tag);
  card.append(right);
  hero.body.appendChild(card);
  host.appendChild(hero.wrap);
  const how = section("How it works");
  const lines = [
    "Tail messages stay uncompressed until they pass the lag.",
    "Once the window fills, Memoria writes a chapter, hides those messages in the chat, and slices the chapter into the prompt at the same spot.",
    "Several chapters can be bound into a single arc that replaces them.",
    "Arcs can be pressed into a volume the same way, manually from the Make tab.",
    "Storage lives in a per-chat world book named LumiBooks. Renaming or deleting entries there releases the messages back."
  ];
  for (const l of lines) {
    how.body.appendChild(textNode(l, "lmb-about-line"));
  }
  host.appendChild(how.wrap);
  const ack = section("Acknowledgements");
  const a = document.createElement("div");
  a.className = "lmb-about-line";
  a.textContent = "Built on Lumiverse Spindle, with prompts and UX inspired by SillyTavern Memory Books. " + "Memoria thanks the original Memory Books authors for the inspiration.";
  ack.body.appendChild(a);
  host.appendChild(ack.wrap);
}
function renderExtras(host, state, send) {
  const sec = section("Extras");
  if (!state) {
    sec.body.appendChild(textNode("Open a chat to use these tools", "lmb-empty"));
    host.appendChild(sec.wrap);
    return;
  }
  sec.body.appendChild(checkbox({
    checked: state.settings.showAutomationToasts,
    label: "Automation toasts",
    hint: "When off, Memoria's background runs stay quiet. Errors and your own actions still toast.",
    onChange: (v) => send({ type: "save_settings", patch: { showAutomationToasts: v }, chatId: state.activeChatId })
  }));
  sec.body.appendChild(checkbox({
    checked: state.settings.forceConstantEntries,
    label: "Force constant entries",
    hint: "When on, every LumiBooks lorebook entry (current and future) is marked constant so it activates without keyword matching. Toggling re-flips every existing LumiBooks entry across all chats.",
    onChange: (v) => send({ type: "set_force_constant", value: v, chatId: state.activeChatId })
  }));
  if (!state.activeChatId) {
    sec.body.appendChild(textNode("Open a chat to use the visibility tools below", "lmb-empty"));
    host.appendChild(sec.wrap);
    return;
  }
  const chatId = state.activeChatId;
  const disabled = state.busy.length > 0 || !state.settings.enabled;
  const row = document.createElement("div");
  row.className = "lmb-actions";
  row.append(makeButton("Re-hide covered", () => send({ type: "resync_hidden", chatId }), {
    disabled,
    title: "Re-apply the exclude-from-context flag on every covered message"
  }), makeButton("Resync visibility", () => send({ type: "resync_visibility", chatId }), {
    disabled,
    title: "Unhide messages whose chapter or arc no longer exists, and re-align hidden state with current coverage. Use after editing or deleting entries in the Lorebook drawer."
  }));
  sec.body.appendChild(row);
  host.appendChild(sec.wrap);
}

// src/ui/app.ts
var TABS = [
  { key: "books", label: "Books" },
  { key: "make", label: "Make" },
  { key: "profile", label: "Profile" },
  { key: "prompts", label: "Prompts" },
  { key: "about", label: "Stuff" }
];
function setup(ctx) {
  ctx.dom.addStyle(STYLES);
  const tab = ctx.ui.registerDrawerTab({
    id: "lumi_books_tab",
    title: "LumiBooks",
    shortName: "Books",
    description: "Memoria files your chat into chapters and arcs.",
    keywords: ["lumibooks", "lumi books", "memoria", "memory", "chapters", "arcs", "summary"],
    headerTitle: "LumiBooks",
    iconSvg: ICON_SVG
  });
  const root = document.createElement("div");
  root.className = "lmb-root";
  tab.root.appendChild(root);
  const strip = document.createElement("div");
  strip.className = "lmb-tabstrip";
  root.appendChild(strip);
  const content = document.createElement("div");
  content.className = "lmb-tab-content";
  root.appendChild(content);
  let activeTab = "books";
  let lastState = null;
  let renderPending = false;
  const tabButtons = new Map;
  for (const t of TABS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lmb-tab";
    btn.textContent = t.label;
    btn.addEventListener("click", () => {
      activeTab = t.key;
      refreshTabStyles();
      doRender();
    });
    strip.appendChild(btn);
    tabButtons.set(t.key, btn);
  }
  const send = (msg) => ctx.sendToBackend(msg);
  const refreshTabStyles = () => {
    for (const [key, btn] of tabButtons) {
      btn.classList.toggle("active", key === activeTab);
    }
  };
  const hasFocusedEditableChild = () => {
    const active = document.activeElement;
    if (!active || !content.contains(active))
      return false;
    const tag = active.tagName;
    if (tag === "TEXTAREA")
      return true;
    if (tag !== "INPUT")
      return false;
    const type = (active.type || "text").toLowerCase();
    return type === "text" || type === "number" || type === "search" || type === "email" || type === "url" || type === "tel" || type === "password";
  };
  let lastRenderedTab = null;
  const doRender = () => {
    if (!lastState) {
      content.replaceChildren();
      lastRenderedTab = null;
      return;
    }
    const renderInner = () => {
      if (activeTab === "books")
        renderBooksTab(content, lastState, ctx, send);
      else if (activeTab === "make")
        renderMakeTab(content, lastState, ctx, send);
      else if (activeTab === "profile")
        renderProfileTab(content, lastState, ctx, send);
      else if (activeTab === "prompts")
        renderPromptsTab(content, lastState, ctx, send);
      else
        renderAboutTab(content, lastState, send);
    };
    if (lastRenderedTab === activeTab) {
      preserveScroll(content, renderInner);
    } else {
      renderInner();
    }
    lastRenderedTab = activeTab;
  };
  const renderActive = () => {
    if (hasFocusedEditableChild()) {
      renderPending = true;
      return;
    }
    renderPending = false;
    doRender();
  };
  content.addEventListener("focusout", () => {
    if (!renderPending)
      return;
    setTimeout(() => {
      if (hasFocusedEditableChild())
        return;
      renderPending = false;
      doRender();
    }, 0);
  });
  refreshTabStyles();
  const unsub = ctx.onBackendMessage((raw) => {
    const msg = raw;
    switch (msg.type) {
      case "state":
        lastState = msg.state;
        renderActive();
        break;
      case "toast":
        if (msg.tone === "error")
          console.error(`[LumiBooks] ${msg.text}`);
        else if (msg.tone === "warn")
          console.warn(`[LumiBooks] ${msg.text}`);
        else
          console.info(`[LumiBooks] ${msg.tone}: ${msg.text}`);
        showInlineToast(root, msg.tone, msg.text);
        break;
      case "busy":
        if (lastState) {
          const prev = lastState.busy;
          const next = msg.entries;
          lastState = { ...lastState, busy: next };
          if (activeTab === "books") {
            const sameShape = prev.length === next.length && prev.every((b, i) => b.kind === next[i].kind && b.chatId === next[i].chatId);
            if (sameShape && tryUpdateBusyLabelsInPlace(next)) {
              break;
            }
            if (hasFocusedEditableChild()) {
              renderPending = true;
            } else {
              renderBooksTab(content, lastState, ctx, send);
            }
          }
        }
        break;
      case "error":
        console.warn(`[LumiBooks] error: ${msg.text}`);
        break;
      case "dry_run_result":
        showDryRunModal(msg.kind, msg.messages, msg.diagnostics);
        break;
    }
  });
  send({ type: "ready", chatId: null });
  const unsubActivate = tab.onActivate(() => send({ type: "refresh", chatId: null }));
  return () => {
    try {
      unsub();
    } catch (_) {}
    try {
      unsubActivate?.();
    } catch (_) {}
    try {
      tab.destroy?.();
    } catch (_) {}
  };
}
var TOAST_STACK_CAP = 5;
function showInlineToast(host, tone, text) {
  let stack = document.body.querySelector(":scope > .lmb-toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "lmb-toast-stack";
    document.body.appendChild(stack);
  }
  while (stack.childElementCount >= TOAST_STACK_CAP) {
    stack.firstElementChild?.remove();
  }
  const el = document.createElement("div");
  el.className = `lmb-toast lmb-toast-${tone}`;
  el.textContent = text;
  stack.appendChild(el);
  const duration = tone === "error" ? 8000 : tone === "warn" ? 6000 : 4000;
  setTimeout(() => {
    el.classList.add("lmb-toast-leaving");
    setTimeout(() => el.remove(), 200);
  }, duration);
}
export {
  setup
};
