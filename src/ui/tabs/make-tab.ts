import type { SpindleFrontendContext } from "lumiverse-spindle-types";
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
import { confirmDelete } from "../modals";

interface MakeTabContext {
  state: FrontendState;
  selectedMessages: Set<string>;
  selectedChapters: Set<string>;
  selectedArcs: Set<string>;
  messageFilter: "all" | "uncovered" | "covered";
  messageQuery: string;
  rerender: () => void;
}

const localState = {
  selectedMessages: new Set<string>(),
  selectedChapters: new Set<string>(),
  selectedArcs: new Set<string>(),
  messageFilter: "uncovered" as "all" | "uncovered" | "covered",
  messageQuery: "",
  lastChatId: null as string | null,
  anchorMessageId: null as string | null,
  suppressNextClick: false,
  rebaseSourceId: "",
};

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_PX = 10;

export function renderMakeTab(
  host: HTMLElement,
  state: FrontendState,
  ctx: SpindleFrontendContext,
  send: (msg: FrontendToBackend) => void,
): void {
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
      const c: MakeTabContext = {
        state,
        selectedMessages: localState.selectedMessages,
        selectedChapters: localState.selectedChapters,
        selectedArcs: localState.selectedArcs,
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
      renderVolumePicker(host, c, send);
      renderContinuity(host, c, ctx, send);
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
    "Covered messages are already filed and are greyed. Shift+click (or long-press on touch) to select ranges. Use Exclude to pin a message so it's never hidden, replaced, or summarized - it splits compression around it.";
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
      listEl.replaceChildren(...buildRows(c, syncControls));
      syncControls();
    },
  });
  filterRow.append(filterSel, query);
  sec.body.appendChild(filterRow);

  const counts = document.createElement("div");
  counts.className = "lmb-help";

  const chatId = c.state.activeChatId!;
  const messageById = new Map(c.state.messages.map((m) => [m.id, m] as const));
  const allSelectedExcluded = (): boolean => {
    if (c.selectedMessages.size === 0) return false;
    for (const id of c.selectedMessages) {
      const m = messageById.get(id);
      if (!m || !m.excluded) return false;
    }
    return true;
  };

  const compressBtn = makeButton("Compress", () => {
    const ids = Array.from(c.selectedMessages);
    if (ids.length === 0) return;
    send({ type: "create_chapter_range", chatId, messageIds: ids });
    localState.selectedMessages.clear();
    c.selectedMessages.clear();
    localState.anchorMessageId = null;
    c.rerender();
  }, { primary: true, disabled: c.selectedMessages.size === 0 });

  const excludeBtn = makeButton("Exclude", () => {
    const ids = Array.from(c.selectedMessages);
    if (ids.length === 0) return;
    send({ type: "set_message_excluded", chatId, messageIds: ids, excluded: !allSelectedExcluded() });
  }, { title: "Toggle exclusion for the selected messages. Excluded messages are never hidden, replaced, or summarized, and they split compression. Click again to allow compression." });

  const syncControls = (): void => {
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
  actions.append(
    compressBtn,
    makeButton("Pick uncompressed", () => {
      const visible = filterMessages(c).filter((m) => !m.covered && !m.excluded);
      const next = new Set(visible.map((m) => m.id));
      localState.selectedMessages = next;
      c.selectedMessages = next;
      c.rerender();
    }),
    excludeBtn,
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
  onToggle: () => void,
): HTMLElement[] {
  const visible = filterMessages(c);
  if (visible.length === 0) {
    return [textNode("No messages match", "lmb-empty")];
  }
  return visible.map((m) => buildMessageRow(m, c, onToggle));
}

function buildMessageRow(
  m: MessageStub,
  c: MakeTabContext,
  onToggle: () => void,
): HTMLElement {
  const row = document.createElement("label");
  row.className = `lmb-message-row${m.covered ? " covered" : ""}${m.excluded ? " excluded" : ""}${c.selectedMessages.has(m.id) ? " selected" : ""}`;
  row.title = "Shift+click (or long-press on touch) to select a range";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = c.selectedMessages.has(m.id);
  cb.disabled = m.covered && !m.excluded;
  const triggerRangeFromAnchor = (): boolean => {
    const anchorId = localState.anchorMessageId;
    if (!anchorId || anchorId === m.id) return false;
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
    const mouseEvent = e as MouseEvent;
    if (!mouseEvent.shiftKey || m.covered) return;
    if (!triggerRangeFromAnchor()) return;
    e.preventDefault();
  });
  row.addEventListener("pointerdown", (e) => {
    const pe = e as PointerEvent;
    if (pe.pointerType !== "touch" || m.covered) return;
    const startX = pe.clientX;
    const startY = pe.clientY;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      if (timer !== null) { clearTimeout(timer); timer = null; }
      row.removeEventListener("pointermove", onMove);
      row.removeEventListener("pointerup", cleanup);
      row.removeEventListener("pointercancel", cleanup);
      row.removeEventListener("pointerleave", cleanup);
    };
    const onMove = (mv: Event) => {
      const m2 = mv as PointerEvent;
      if (Math.abs(m2.clientX - startX) > LONG_PRESS_MOVE_PX
        || Math.abs(m2.clientY - startY) > LONG_PRESS_MOVE_PX) cleanup();
    };
    row.addEventListener("pointermove", onMove);
    row.addEventListener("pointerup", cleanup);
    row.addEventListener("pointercancel", cleanup);
    row.addEventListener("pointerleave", cleanup);
    timer = setTimeout(() => {
      timer = null;
      cleanup();
      if (!triggerRangeFromAnchor()) return;
      localState.suppressNextClick = true;
      setTimeout(() => { localState.suppressNextClick = false; }, 150);
      try { navigator.vibrate?.(30); } catch { void 0; }
    }, LONG_PRESS_MS);
  });
  cb.addEventListener("change", () => {
    if (cb.checked) c.selectedMessages.add(m.id);
    else c.selectedMessages.delete(m.id);
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
    if (!m || m.covered || m.excluded) continue;
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

function renderVolumePicker(
  host: HTMLElement,
  c: MakeTabContext,
  send: (msg: FrontendToBackend) => void,
): void {
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
      if (!c.selectedArcs.has(a.entryId)) continue;
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
      if (cb.checked) c.selectedArcs.add(arc.entryId);
      else c.selectedArcs.delete(arc.entryId);
      updateCounts();
    });
    const text = document.createElement("span");
    const range =
      arc.meta.firstMsgIdx !== undefined && arc.meta.lastMsgIdx !== undefined
        ? ` (msgs ${arc.meta.firstMsgIdx + 1}-${arc.meta.lastMsgIdx + 1})`
        : "";
    const tokenStr = arc.sourceTokensInput > 0
      ? `${formatTokens(arc.sourceTokensInput)}t→${formatTokens(arc.contentTokens)}t`
      : `${formatTokens(arc.contentTokens)}t`;
    text.textContent = `${arc.comment || arc.meta.title || arc.entryId.slice(0, 6)}${range} - ${tokenStr}`;
    row.append(cb, text);
    list.appendChild(row);
  }
  sec.body.appendChild(list);
  updateCounts();
  sec.body.appendChild(counts);

  const chatId = c.state.activeChatId!;
  const actions = document.createElement("div");
  actions.className = "lmb-actions";
  actions.append(
    makeButton("Press selected", () => {
      const ids = Array.from(c.selectedArcs);
      if (ids.length === 0) return;
      send({ type: "create_volume_from", chatId, arcEntryIds: ids });
      localState.selectedArcs.clear();
      c.selectedArcs.clear();
      c.rerender();
    }, { primary: true }),
    makeButton("Select all active", () => {
      const next = new Set(activeArcs.map((a) => a.entryId));
      localState.selectedArcs = next;
      c.selectedArcs = next;
      c.rerender();
    }),
    makeButton("Clear", () => {
      localState.selectedArcs.clear();
      c.selectedArcs.clear();
      c.rerender();
    }),
  );
  sec.body.appendChild(actions);
  host.appendChild(sec.wrap);
}

function renderContinuity(
  host: HTMLElement,
  c: MakeTabContext,
  ctx: SpindleFrontendContext,
  send: (msg: FrontendToBackend) => void,
): void {
  const state = c.state;
  const chatId = state.activeChatId!;
  const hasOwn = state.chapters.some((ch) => !ch.isRoot)
    || state.arcs.some((a) => !a.isRoot)
    || state.volumes.some((v) => !v.isRoot);
  const hasRoot = state.rootEntryCount > 0;
  const candidates = state.availableRoots;
  if (!hasRoot && candidates.length === 0) return;

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
      ...state.chapters.filter((ch) => ch.isRoot),
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
    detachRow.appendChild(
      makeButton("Detach root", async () => {
        const ok = await confirmDelete(ctx, "Detach inherited memories?", "Memoria will remove the inherited memories from this chat. Your own chapters and arcs stay.");
        if (ok) send({ type: "detach_root", chatId });
      }, { small: true, danger: true, title: "Remove the inherited root memories from this chat" }),
    );
    sec.body.appendChild(detachRow);
  }

  if (candidates.length > 0) {
    const help = document.createElement("div");
    help.className = "lmb-help";
    help.textContent = hasOwn
      ? "This chat already has its own memories. Rebuilding deletes them and re-summarizes on top of the chosen root."
      : "Seed this chat with another chat's memories. They inject as a frozen prologue before the greeting.";
    sec.body.appendChild(help);

    const row = document.createElement("div");
    row.className = "lmb-actions";
    const picker = select({
      value: localState.rebaseSourceId,
      ariaLabel: "Source chat to inherit memories from",
      options: [
        { value: "", label: "Pick a source chat..." },
        ...candidates.map((cand) => ({ value: cand.chatId, label: `${cand.chatName} (${cand.entryCount})` })),
      ],
      onChange: (v) => { localState.rebaseSourceId = v; },
    });
    row.appendChild(picker);

    if (hasOwn) {
      row.appendChild(
        makeButton("Rebuild from...", async () => {
          const sourceChatId = picker.value;
          if (!sourceChatId) return;
          const ok = await confirmDelete(ctx, "Rebuild from root?", "Memoria will DELETE this chat's existing chapters and arcs, seed the chosen root, then re-summarize this chat from scratch. This cannot be undone.");
          if (ok) send({ type: "rebuild_root", chatId, sourceChatId });
        }, { danger: true, title: "Destructive: wipe this chat's memories and reseed from the chosen root" }),
      );
    } else {
      row.appendChild(
        makeButton("Rebase", () => {
          const sourceChatId = picker.value;
          if (!sourceChatId) return;
          send({ type: "rebase_root", chatId, sourceChatId });
        }, { primary: true, title: "Seed this chat with the chosen chat's memories" }),
      );
    }
    sec.body.appendChild(row);
  }

  host.appendChild(sec.wrap);
}
