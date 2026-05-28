import type { FrontendState, FrontendToBackend, MessageStub } from "../../types";
import {
  HIDDEN_ICON,
  formatTokens,
  makeButton,
  preserveScroll,
  section,
  select,
  textInput,
  textNode,
} from "../components";

interface MakeTabContext {
  state: FrontendState;
  selectedMessages: Set<string>;
  selectedChapters: Set<string>;
  messageFilter: "all" | "uncovered" | "covered";
  messageQuery: string;
  rerender: () => void;
}

const localState = {
  selectedMessages: new Set<string>(),
  selectedChapters: new Set<string>(),
  messageFilter: "uncovered" as "all" | "uncovered" | "covered",
  messageQuery: "",
  lastChatId: null as string | null,
  anchorMessageId: null as string | null,
};

export function renderMakeTab(
  host: HTMLElement,
  state: FrontendState,
  send: (msg: FrontendToBackend) => void,
): void {
  if (localState.lastChatId !== state.activeChatId) {
    localState.selectedMessages.clear();
    localState.selectedChapters.clear();
    localState.anchorMessageId = null;
    localState.lastChatId = state.activeChatId;
  }
  const draw = () => {
    preserveScroll(host, () => {
      host.replaceChildren();
      const c: MakeTabContext = {
        state,
        selectedMessages: localState.selectedMessages,
        selectedChapters: localState.selectedChapters,
        messageFilter: localState.messageFilter,
        messageQuery: localState.messageQuery,
        rerender: draw,
      };
      if (!state.activeChatId) {
        host.appendChild(textNode("Open a chat to pick messages", "lmb-empty"));
        return;
      }
      renderChapterPicker(host, c, send);
      renderArcPicker(host, c, send);
    });
  };
  draw();
}

function renderChapterPicker(
  host: HTMLElement,
  c: MakeTabContext,
  send: (msg: FrontendToBackend) => void,
): void {
  const sec = section("Pick messages for a chapter");
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent =
    "Covered messages are already filed and are greyed. Shift+click to select ranges.";
  sec.body.appendChild(help);

  const filterRow = document.createElement("div");
  filterRow.className = "lmb-message-filter-row";
  const filterSel = select({
    value: c.messageFilter,
    options: [
      { value: "uncovered", label: "Uncompressed only" },
      { value: "all", label: "All messages" },
      { value: "covered", label: "Already filed" },
    ],
    onChange: (v) => {
      localState.messageFilter = (v as typeof localState.messageFilter) ?? "uncovered";
      c.rerender();
    },
  });
  const query = textInput({
    value: c.messageQuery,
    placeholder: "Search...",
    onChange: (v) => {
      const next = v.toLowerCase();
      localState.messageQuery = next;
      c.messageQuery = next;
      listEl.replaceChildren(...buildRows(c, send, counts, compressBtn));
      compressBtn.disabled = c.selectedMessages.size === 0;
    },
  });
  filterRow.append(filterSel, query);
  sec.body.appendChild(filterRow);

  const counts = document.createElement("div");
  counts.className = "lmb-help";
  const updateCounts = () => {
    const tokens = sumSelectedTokens(c);
    counts.textContent = `${c.selectedMessages.size} selected (~${formatTokens(tokens)} tokens before)`;
  };

  const chatId = c.state.activeChatId!;
  const compressBtn = makeButton("Compress selected", () => {
    const ids = Array.from(c.selectedMessages);
    if (ids.length === 0) return;
    send({ type: "create_chapter_range", chatId, messageIds: ids });
    localState.selectedMessages.clear();
    c.selectedMessages.clear();
    localState.anchorMessageId = null;
    c.rerender();
  }, { primary: true, disabled: c.selectedMessages.size === 0 });

  const listEl = document.createElement("div");
  listEl.className = "lmb-message-list";
  listEl.replaceChildren(...buildRows(c, send, counts, compressBtn));
  sec.body.appendChild(listEl);
  updateCounts();
  sec.body.appendChild(counts);

  const actions = document.createElement("div");
  actions.className = "lmb-actions";
  actions.append(
    compressBtn,
    makeButton("Select uncompressed tail", () => {
      const visible = filterMessages(c).filter((m) => !m.covered);
      const next = new Set(visible.map((m) => m.id));
      localState.selectedMessages = next;
      c.selectedMessages = next;
      c.rerender();
    }),
    makeButton("Clear", () => {
      localState.selectedMessages.clear();
      c.selectedMessages.clear();
      localState.anchorMessageId = null;
      c.rerender();
    }),
  );
  sec.body.appendChild(actions);

  host.appendChild(sec.wrap);
}

function buildRows(
  c: MakeTabContext,
  _send: (msg: FrontendToBackend) => void,
  countsEl: HTMLElement,
  compressBtn: HTMLButtonElement,
): HTMLElement[] {
  const visible = filterMessages(c);
  if (visible.length === 0) {
    return [textNode("No messages match", "lmb-empty")];
  }
  return visible.map((m, idx) => buildMessageRow(m, idx, c, countsEl, compressBtn));
}

function buildMessageRow(
  m: MessageStub,
  idx: number,
  c: MakeTabContext,
  countsEl: HTMLElement,
  compressBtn: HTMLButtonElement,
): HTMLElement {
  const row = document.createElement("label");
  row.className = `lmb-message-row${m.covered ? " covered" : ""}${c.selectedMessages.has(m.id) ? " selected" : ""}`;
  row.title = "Shift+click to select a range";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = c.selectedMessages.has(m.id);
  cb.disabled = m.covered;
  row.addEventListener("click", (e) => {
    const mouseEvent = e as MouseEvent;
    if (!mouseEvent.shiftKey || m.covered) return;
    const anchorId = localState.anchorMessageId;
    if (!anchorId || anchorId === m.id) return;
    e.preventDefault();
    const newState = !c.selectedMessages.has(m.id);
    applyRangeSelection(c, anchorId, m.id, newState);
    localState.anchorMessageId = m.id;
    c.rerender();
  });
  cb.addEventListener("change", () => {
    if (cb.checked) c.selectedMessages.add(m.id);
    else c.selectedMessages.delete(m.id);
    localState.anchorMessageId = m.id;
    row.classList.toggle("selected", cb.checked);
    const tokens = sumSelectedTokens(c);
    countsEl.textContent = `${c.selectedMessages.size} selected (~${formatTokens(tokens)} tokens before)`;
    compressBtn.disabled = c.selectedMessages.size === 0;
  });
  const idxSpan = document.createElement("span");
  idxSpan.className = "lmb-msg-role";
  idxSpan.textContent = `#${idx + 1}`;
  const roleSpan = document.createElement("span");
  roleSpan.className = "lmb-msg-role";
  roleSpan.style.opacity = "0.5";
  roleSpan.textContent = m.role.slice(0, 4).toUpperCase();
  const preview = document.createElement("span");
  preview.className = "lmb-msg-preview";
  preview.textContent = m.preview || "(empty)";
  const icons = document.createElement("span");
  icons.className = "lmb-msg-icons";
  if (m.hidden) {
    const icon = document.createElement("span");
    icon.title = "Hidden in chat";
    icon.innerHTML = HIDDEN_ICON;
    icons.appendChild(icon);
  }
  row.append(cb, idxSpan, roleSpan, preview, icons);
  return row;
}

function applyRangeSelection(
  c: MakeTabContext,
  anchorId: string,
  targetId: string,
  newState: boolean,
): void {
  const visible = filterMessages(c);
  const anchorIdx = visible.findIndex((m) => m.id === anchorId);
  const targetIdx = visible.findIndex((m) => m.id === targetId);
  if (anchorIdx === -1 || targetIdx === -1) return;
  const [from, to] = anchorIdx < targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
  for (let i = from; i <= to; i++) {
    const m = visible[i];
    if (!m || m.covered) continue;
    if (newState) c.selectedMessages.add(m.id);
    else c.selectedMessages.delete(m.id);
  }
}

function sumSelectedTokens(c: MakeTabContext): number {
  let total = 0;
  const byId = new Map(c.state.messages.map((m) => [m.id, m] as const));
  for (const id of c.selectedMessages) {
    const m = byId.get(id);
    if (m) total += m.approxTokens;
  }
  return total;
}

function sumSelectedChapterInputTokens(c: MakeTabContext): number {
  let total = 0;
  for (const ch of c.state.chapters) {
    if (!c.selectedChapters.has(ch.entryId)) continue;
    total += ch.sourceTokensInput > 0 ? ch.sourceTokensInput : ch.contentTokens;
  }
  return total;
}

function filterMessages(c: MakeTabContext): MessageStub[] {
  return c.state.messages.filter((m) => {
    if (c.messageFilter === "uncovered" && m.covered) return false;
    if (c.messageFilter === "covered" && !m.covered) return false;
    if (c.messageQuery && !(m.preview ?? "").toLowerCase().includes(c.messageQuery)) return false;
    return true;
  });
}

function renderArcPicker(
  host: HTMLElement,
  c: MakeTabContext,
  send: (msg: FrontendToBackend) => void,
): void {
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
    if (!ch.active) continue;
    const row = document.createElement("label");
    row.className = "lmb-multiselect-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = c.selectedChapters.has(ch.entryId);
    cb.addEventListener("change", () => {
      if (cb.checked) c.selectedChapters.add(ch.entryId);
      else c.selectedChapters.delete(ch.entryId);
      updateArcCounts();
    });
    const text = document.createElement("span");
    const range =
      ch.meta.firstMsgIdx !== undefined && ch.meta.lastMsgIdx !== undefined
        ? ` (msgs ${ch.meta.firstMsgIdx + 1}-${ch.meta.lastMsgIdx + 1})`
        : "";
    const tokenStr = ch.sourceTokensInput > 0
      ? `${formatTokens(ch.sourceTokensInput)}t→${formatTokens(ch.contentTokens)}t`
      : `${formatTokens(ch.contentTokens)}t`;
    text.textContent = `${ch.comment || ch.meta.title || ch.entryId.slice(0, 6)}${range} - ${tokenStr}`;
    row.append(cb, text);
    list.appendChild(row);
  }
  sec.body.appendChild(list);
  updateArcCounts();
  sec.body.appendChild(arcCounts);

  const chatId = c.state.activeChatId!;
  const actions = document.createElement("div");
  actions.className = "lmb-actions";
  actions.append(
    makeButton("Bind selected", () => {
      const ids = Array.from(c.selectedChapters);
      if (ids.length === 0) return;
      send({ type: "create_arc_from", chatId, chapterEntryIds: ids });
      localState.selectedChapters.clear();
      c.selectedChapters.clear();
      c.rerender();
    }, { primary: true }),
    makeButton("Select all active", () => {
      const next = new Set(c.state.chapters.filter((ch) => ch.active).map((ch) => ch.entryId));
      localState.selectedChapters = next;
      c.selectedChapters = next;
      c.rerender();
    }),
    makeButton("Clear", () => {
      localState.selectedChapters.clear();
      c.selectedChapters.clear();
      c.rerender();
    }),
  );
  sec.body.appendChild(actions);
  host.appendChild(sec.wrap);
}
