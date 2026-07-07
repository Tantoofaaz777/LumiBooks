import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { ArcView, ChapterView, FrontendState, FrontendToBackend, PendingPreview } from "../../types";
import {
  field,
  formatTokens,
  makeButton,
  pill,
  section,
  span,
  textArea,
  textInput,
  textNode,
} from "../components";
import { confirmDelete, openEditModal } from "../modals";

const inflightBusyLabels = new Map<string, HTMLSpanElement>();

function busyTrackKey(kind: string, chatId: string): string {
  return `${kind}::${chatId}`;
}

export function tryUpdateBusyLabelsInPlace(entries: { kind: string; chatId: string; label: string }[]): boolean {
  const keys = new Set(entries.map((b) => busyTrackKey(b.kind, b.chatId)));
  if (keys.size !== inflightBusyLabels.size) return false;
  for (const k of keys) {
    const el = inflightBusyLabels.get(k);
    if (!el || !el.isConnected) return false;
  }
  for (const b of entries) {
    const el = inflightBusyLabels.get(busyTrackKey(b.kind, b.chatId));
    if (el) el.textContent = b.label;
  }
  return true;
}

export function renderBooksTab(
  host: HTMLElement,
  state: FrontendState,
  ctx: SpindleFrontendContext,
  send: (msg: FrontendToBackend) => void,
): void {
  host.replaceChildren();

  renderStatus(host, state, send);
  renderFailure(host, state, send);
  renderPreviews(host, state, send);
  renderActions(host, state, send);
  renderEntries(host, state, ctx, send);
}

function renderStatus(host: HTMLElement, state: FrontendState, send: (m: FrontendToBackend) => void): void {
  if (!state.activeChatId) {
    host.appendChild(textNode("Open a chat to see Memoria's notes", "lmb-empty"));
    return;
  }
  const sec = section("Status");
  const grid = document.createElement("div");
  grid.className = "lmb-status-grid";
  addRow(grid, "Chat", state.activeChatName || state.activeChatId.slice(0, 8));
  if (state.activeCharacterName) addRow(grid, "Character", state.activeCharacterName);
  addRow(grid, "Messages", `${state.coverage.totalMessages} (${state.coverage.coveredMessages} covered)`);
  addRow(
    grid,
    "Uncompressed tail",
    `${state.coverage.uncoveredMessages} msgs, ~${formatTokens(state.coverage.approxUncoveredTokens)} tokens`,
  );
  const profile = state.activeProfile;
  const thresholds = document.createElement("div");
  thresholds.style.gridColumn = "1 / -1";
  thresholds.style.display = "flex";
  thresholds.style.gap = "6px";
  thresholds.style.flexWrap = "wrap";
  thresholds.style.marginTop = "4px";
  thresholds.append(
    pill(`lag ${profile.lagValue}${profile.lagUnit === "tokens" ? "t" : "m"}`),
    pill(`window ${profile.windowValue}${profile.windowUnit === "tokens" ? "t" : "m"}`),
    pill(profile.chapterTargetUnit === "tokens"
      ? `chapter ${profile.chapterTargetTokens}t`
      : `chapter ${profile.chapterTargetPercent}%`),
    pill(profile.arcTargetUnit === "tokens"
      ? `arc ${profile.arcTargetTokens}t`
      : `arc ${profile.arcTargetPercent}%`),
    pill(state.coverage.lagSatisfied ? "lag ready" : "lag building", state.coverage.lagSatisfied ? "ok" : "warn"),
    pill(state.coverage.windowAvailable ? "window ready" : "window building", state.coverage.windowAvailable ? "ok" : "warn"),
  );
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

function renderFailure(host: HTMLElement, state: FrontendState, send: (m: FrontendToBackend) => void): void {
  if (!state.lastFailure || !state.activeChatId) return;
  const f = state.lastFailure;
  const sec = document.createElement("div");
  sec.className = "lmb-failure";
  const head = document.createElement("div");
  head.style.fontWeight = "600";
  head.textContent = f.kind === "arc" ? "Last arc attempt failed"
    : f.kind === "volume" ? "Last volume attempt failed"
    : "Last chapter attempt failed";
  const detail = document.createElement("div");
  detail.style.opacity = "0.85";
  detail.textContent = `${f.message} (tried ${f.retriedTimes}x)`;
  const row = document.createElement("div");
  row.className = "lmb-actions";
  const chatId = state.activeChatId;
  row.append(
    makeButton("Retry", () => send({ type: "retry_last_failure", chatId }), { primary: true, small: true }),
  );
  sec.append(head, detail, row);
  host.appendChild(sec);
}

function renderPreviews(host: HTMLElement, state: FrontendState, send: (m: FrontendToBackend) => void): void {
  if (state.pendingPreviews.length === 0 || !state.activeChatId) return;
  const sec = section(`Pending previews (${state.pendingPreviews.length})`);
  for (const p of state.pendingPreviews) {
    sec.body.appendChild(renderPreviewCard(p, state.activeChatId, send));
  }
  host.appendChild(sec.wrap);
}

function renderPreviewCard(preview: PendingPreview, chatId: string, send: (m: FrontendToBackend) => void): HTMLElement {
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
    const patch: { title?: string; content?: string } = {};
    if (liveTitle !== lastSentTitle) patch.title = liveTitle;
    if (liveContent !== lastSentContent) patch.content = liveContent;
    if (Object.keys(patch).length === 0) return;
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
  meta.append(
    span(`${preview.sourceMessageIds.length} msgs`),
    span(`${formatTokens(preview.tokenCountOutput)} tokens`),
    span(preview.model || ""),
  );
  card.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "lmb-actions";
  actions.append(
    makeButton("Save", () => {
      send({
        type: "edit_preview",
        chatId,
        draftId: preview.draftId,
        patch: { title: titleInput.value, content: contentInput.value },
      });
      send({ type: "accept_preview", chatId, draftId: preview.draftId });
    }, { primary: true, small: true }),
    makeButton("Discard", () => send({ type: "discard_preview", chatId, draftId: preview.draftId }), { danger: true, small: true }),
  );
  card.appendChild(actions);
  return card;
}

function renderActions(host: HTMLElement, state: FrontendState, send: (m: FrontendToBackend) => void): void {
  if (!state.activeChatId) return;
  const sec = section("Quick actions");
  const row = document.createElement("div");
  row.className = "lmb-actions";
  const disabled = state.busy.length > 0 || !state.settings.enabled;
  const chatId = state.activeChatId;
  row.append(
    makeButton("File chapter", () => send({ type: "create_chapter", chatId }), {
      primary: true,
      disabled,
      title: "Compress the oldest uncovered window into a new chapter using the current profile",
    }),
  );
  if (state.backlogChapters > 1) {
    row.append(
      makeButton(`File all chapters (${state.backlogChapters})`, () => send({ type: "create_all_chapters", chatId }), {
        disabled,
        title: "Drain the chapter backlog - keeps filing chapters until the lag or window threshold blocks further compression",
      }),
    );
  }
  row.append(
    makeButton("Bind arc", () => send({ type: "create_arc", chatId }), {
      disabled,
      title: "Roll the oldest unsuperseded chapters into a single arc",
    }),
  );
  if (state.backlogArcs > 1) {
    row.append(
      makeButton(`File all arcs (${state.backlogArcs})`, () => send({ type: "create_all_arcs", chatId }), {
        disabled,
        title: "Drain the arc backlog - keeps binding arcs until the configured arc trigger no longer fires",
      }),
    );
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

function renderEntries(
  host: HTMLElement,
  state: FrontendState,
  ctx: SpindleFrontendContext,
  send: (m: FrontendToBackend) => void,
): void {
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
    for (const vol of volumes) list.appendChild(renderEntryItem(vol, "volume", state, ctx, send));
    sec.body.appendChild(list);
  }
  if (arcs.length) {
    sec.body.appendChild(buildSubtitle(`Arcs (${arcs.length})`));
    const list = document.createElement("ul");
    list.className = "lmb-entry-list";
    for (const arc of arcs) list.appendChild(renderEntryItem(arc, "arc", state, ctx, send));
    sec.body.appendChild(list);
  }
  if (chapters.length) {
    sec.body.appendChild(buildSubtitle(`Chapters (${chapters.length})`));
    const list = document.createElement("ul");
    list.className = "lmb-entry-list";
    for (const ch of chapters) list.appendChild(renderEntryItem(ch, "chapter", state, ctx, send));
    sec.body.appendChild(list);
  }
  host.appendChild(sec.wrap);
}

function buildSubtitle(text: string): HTMLElement {
  const d = document.createElement("div");
  d.className = "lmb-section-title";
  d.textContent = text;
  return d;
}

function renderEntryItem(
  view: ChapterView | ArcView,
  kind: "chapter" | "arc" | "volume",
  state: FrontendState,
  ctx: SpindleFrontendContext,
  send: (m: FrontendToBackend) => void,
  readOnly = false,
): HTMLLIElement {
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
  actions.append(
    makeButton("Edit", () => {
      openEditModal(ctx, kind === "arc" ? "Edit arc" : kind === "volume" ? "Edit volume" : "Edit chapter", {
        comment: view.comment,
        content: view.content,
      }, (next) => {
        if (!chatId) return;
        const patch: { comment?: string; content?: string } = {};
        if (typeof next.comment === "string" && next.comment !== view.comment) {
          patch.comment = next.comment;
        }
        if (typeof next.content === "string" && next.content !== view.content) {
          patch.content = next.content;
        }
        if (Object.keys(patch).length === 0) return;
        send({ type: "update_entry", chatId, entryId: view.entryId, patch });
      });
    }, { small: true, title: "Edit this entry's label and content" }),
    makeButton("Regenerate", async () => {
      const ok = await confirmDelete(ctx, "Regenerate?", "Memoria will delete this entry and resummarize the same range. The old summary text will be lost.");
      if (!ok || !chatId) return;
      send({ type: "regenerate_entry", chatId, entryId: view.entryId });
    }, { small: true, title: "Delete and resummarize the same range" }),
    makeButton("Release", async () => {
      const ok = await confirmDelete(ctx, "Release to lorebook?", "Memoria will hand this entry to your regular lorebook (prefixed with [orphaned]) and stop managing it. Those messages will become uncovered.");
      if (!ok || !chatId) return;
      send({ type: "release_entry", chatId, entryId: view.entryId });
    }, { small: true, title: "Strip the LumiBooks marker so the entry becomes a regular lorebook entry" }),
    makeButton("Delete", async () => {
      const ok = await confirmDelete(ctx, "Delete?", "Memoria will let those messages back into the prompt.");
      if (!ok || !chatId) return;
      send({ type: "delete_entry", chatId, entryId: view.entryId });
    }, { small: true, danger: true }),
  );
  head.appendChild(actions);
  }

  const meta = document.createElement("div");
  meta.className = "lmb-entry-meta";
  const range =
    view.isRoot
      ? "inherited"
      : view.meta.firstMsgIdx !== undefined && view.meta.lastMsgIdx !== undefined
        ? `msgs ${view.meta.firstMsgIdx + 1}-${view.meta.lastMsgIdx + 1}`
        : `${view.meta.msgIds.length} msgs`;
  const before = view.sourceTokensInput || 0;
  const tokenStr = before > 0
    ? `${formatTokens(before)}→${formatTokens(view.contentTokens)} tokens`
    : `${formatTokens(view.contentTokens)} tokens`;
  meta.append(
    span(range),
    span(tokenStr),
    span(view.meta.model || ""),
  );
  if (!view.active) meta.append(span("superseded"));
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

function addRow(grid: HTMLElement, label: string, value: string): void {
  const l = document.createElement("div");
  l.className = "lmb-label";
  l.textContent = label;
  const v = document.createElement("div");
  v.className = "lmb-value";
  v.textContent = value;
  grid.append(l, v);
}
