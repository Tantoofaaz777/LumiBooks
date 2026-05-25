import type { FrontendState, FrontendToBackend } from "../../types";
import { checkbox, makeButton, section, textNode } from "../components";

export function renderAboutTab(
  host: HTMLElement,
  state: FrontendState | null,
  send: (msg: FrontendToBackend) => void,
): void {
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
  tag.textContent =
    "Young nyandere catgirl in a maid uniform. Black hair, blue eyes. " +
    "Files your chats into chapters, binds chapters into arcs, and leaves a tiny nyaa note on every shelf.";
  right.append(title, tag);
  card.append(right);
  hero.body.appendChild(card);
  host.appendChild(hero.wrap);

  const how = section("How it works");
  const lines = [
    "Tail messages stay uncompressed until they pass the lag.",
    "Once the window fills, Memoria writes a chapter, hides those messages in the chat, and slices the chapter into the prompt at the same spot.",
    "Several chapters can be bound into a single arc that replaces them.",
    "Storage lives in a per-chat world book named LumiBooks. Renaming or deleting entries there releases the messages back.",
  ];
  for (const l of lines) {
    how.body.appendChild(textNode(l, "lmb-about-line"));
  }
  host.appendChild(how.wrap);

  const ack = section("Acknowledgements");
  const a = document.createElement("div");
  a.className = "lmb-about-line";
  a.textContent =
    "Built on Lumiverse Spindle, with prompts and UX inspired by SillyTavern Memory Books. " +
    "Memoria thanks the original Memory Books authors for the trail.";
  ack.body.appendChild(a);
  host.appendChild(ack.wrap);
}

function renderExtras(
  host: HTMLElement,
  state: FrontendState | null,
  send: (msg: FrontendToBackend) => void,
): void {
  const sec = section("Extras");
  if (!state) {
    sec.body.appendChild(textNode("Open a chat to use these tools", "lmb-empty"));
    host.appendChild(sec.wrap);
    return;
  }

  sec.body.appendChild(checkbox({
    checked: state.settings.forceConstantEntries,
    label: "Force constant entries",
    hint: "When on, every LumiBooks lorebook entry (current and future) is marked constant so it activates without keyword matching. Toggling re-flips every existing LumiBooks entry across all chats.",
    onChange: (v) => send({ type: "set_force_constant", value: v, chatId: state.activeChatId }),
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
  row.append(
    makeButton("Re-hide covered", () => send({ type: "resync_hidden", chatId }), {
      disabled,
      title: "Re-apply the exclude-from-context flag on every covered message",
    }),
    makeButton("Resync visibility", () => send({ type: "resync_visibility", chatId }), {
      disabled,
      title: "Unhide messages whose chapter or arc no longer exists, and re-align hidden state with current coverage. Use after editing or deleting entries in the Lorebook drawer.",
    }),
  );
  sec.body.appendChild(row);
  host.appendChild(sec.wrap);
}
