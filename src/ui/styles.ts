export const STYLES = `
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

export const ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2z"/>
  <path d="M8 7h8"/>
  <path d="M8 11h6"/>
</svg>
`;
