import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { BackendToFrontend, FrontendState, FrontendToBackend } from "../types";
import { ICON_SVG, STYLES } from "./styles";
import { preserveScroll } from "./components";
import { openAdoptLorebookModal, showDryRunModal } from "./modals";
import { renderBooksTab, tryUpdateBusyLabelsInPlace } from "./tabs/books-tab";
import { renderMakeTab } from "./tabs/make-tab";
import { renderProfileTab } from "./tabs/profile-tab";
import { renderPromptsTab } from "./tabs/prompts-tab";
import { renderAboutTab } from "./tabs/about-tab";

type TabKey = "books" | "make" | "profile" | "prompts" | "about";

const TABS: { key: TabKey; label: string }[] = [
  { key: "books", label: "Books" },
  { key: "make", label: "Make" },
  { key: "profile", label: "Profile" },
  { key: "prompts", label: "Prompts" },
  { key: "about", label: "Stuff" },
];

export function setup(ctx: SpindleFrontendContext): () => void {
  ctx.dom.addStyle(STYLES);

  const tab = ctx.ui.registerDrawerTab({
    id: "lumi_books_tab",
    title: "LumiBooks",
    shortName: "Books",
    description: "Memoria files your chat into chapters and arcs.",
    keywords: ["lumibooks", "lumi books", "memoria", "memory", "chapters", "arcs", "summary"],
    headerTitle: "LumiBooks",
    iconSvg: ICON_SVG,
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

  let activeTab: TabKey = "books";
  let lastState: FrontendState | null = null;
  let renderPending = false;
  const tabButtons = new Map<TabKey, HTMLButtonElement>();

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

  const send = (msg: FrontendToBackend) => ctx.sendToBackend(msg);

  const refreshTabStyles = () => {
    for (const [key, btn] of tabButtons) {
      btn.classList.toggle("active", key === activeTab);
    }
  };

  const hasFocusedEditableChild = () => {
    const active = document.activeElement;
    if (!active || !content.contains(active)) return false;
    const tag = active.tagName;
    if (tag === "TEXTAREA") return true;
    if (tag !== "INPUT") return false;
    const type = ((active as HTMLInputElement).type || "text").toLowerCase();
    return type === "text" || type === "number" || type === "search"
      || type === "email" || type === "url" || type === "tel"
      || type === "password";
  };

  let lastRenderedTab: TabKey | null = null;
  const doRender = () => {
    if (!lastState) {
      content.replaceChildren();
      lastRenderedTab = null;
      return;
    }
    const renderInner = () => {
      if (activeTab === "books") renderBooksTab(content, lastState!, ctx, send);
      else if (activeTab === "make") renderMakeTab(content, lastState!, ctx, send);
      else if (activeTab === "profile") renderProfileTab(content, lastState!, ctx, send);
      else if (activeTab === "prompts") renderPromptsTab(content, lastState!, ctx, send);
      else renderAboutTab(content, lastState!, send);
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
    if (!renderPending) return;
    setTimeout(() => {
      if (hasFocusedEditableChild()) return;
      renderPending = false;
      doRender();
    }, 0);
  });

  refreshTabStyles();

  const unsub = ctx.onBackendMessage((raw) => {
    const msg = raw as BackendToFrontend;
    switch (msg.type) {
      case "state":
        lastState = msg.state;
        renderActive();
        break;
      case "toast":
        if (msg.tone === "error") console.error(`[LumiBooks] ${msg.text}`);
        else if (msg.tone === "warn") console.warn(`[LumiBooks] ${msg.text}`);
        else console.info(`[LumiBooks] ${msg.tone}: ${msg.text}`);
        showInlineToast(root, msg.tone, msg.text);
        break;
      case "busy":
        if (lastState) {
          const prev = lastState.busy;
          const next = msg.entries;
          lastState = { ...lastState, busy: next };
          if (activeTab === "books") {
            const sameShape =
              prev.length === next.length
              && prev.every((b, i) => b.kind === next[i]!.kind && b.chatId === next[i]!.chatId);
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
      case "adopt_lorebook_candidates":
        openAdoptLorebookModal(ctx, msg.chatId, msg.books, send);
        break;
    }
  });

  send({ type: "ready", chatId: null });
  const unsubActivate = tab.onActivate(() => send({ type: "refresh", chatId: null }));

  return () => {
    try { unsub(); } catch (_) { void _; }
    try { unsubActivate?.(); } catch (_) { void _; }
    try { tab.destroy?.(); } catch (_) { void _; }
  };
}

const TOAST_STACK_CAP = 5;
function showInlineToast(host: HTMLElement, tone: "success" | "info" | "warn" | "error", text: string): void {
  void host;
  let stack = document.body.querySelector(":scope > .lmb-toast-stack") as HTMLDivElement | null;
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
