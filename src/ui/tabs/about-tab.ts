import type { FrontendState, FrontendToBackend } from "../../types";
import type { LMBSettings } from "../../shared";
import { checkbox, field, makeButton, section, textInput, textNode } from "../components";

export function renderAboutTab(
  host: HTMLElement,
  state: FrontendState | null,
  send: (msg: FrontendToBackend) => void,
): void {
  host.replaceChildren();

  if (state) {
    renderNaming(host, state, send);
  }
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
    "You choose message ranges manually, then Memoria writes or binds them into chapters.",
    "Filed chapters hide the older chat history through that range and send active memories through your outlet.",
    "Several chapters can be bound into a single arc that replaces them.",
    "Arcs can be pressed into a volume the same way, manually from the Make tab.",
    "Storage lives in a world book bound to the chat. Adopted books keep their original names.",
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
    "Memoria thanks the original Memory Books authors for the inspiration.";
  ack.body.appendChild(a);
  host.appendChild(ack.wrap);
}

function renderNaming(
  host: HTMLElement,
  state: FrontendState,
  send: (msg: FrontendToBackend) => void,
): void {
  const sec = section("Naming");
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent = "Templates support Lumiverse macros like {{user}} and {{char}}, plus {{scene}}, {{storyOrder}}, {{sceneNumberPadded}}, {{title}}, and {{chat}}.";
  sec.body.appendChild(help);

  const saveSetting = (patch: Partial<LMBSettings>): void => {
    send({ type: "save_settings", patch, chatId: state.activeChatId });
  };

  const outletField = field("Outlet name");
  const outletInput = textInput({
    value: state.settings.memoryOutletName,
    placeholder: "lumibooks",
    onBlur: (v) => saveSetting({ memoryOutletName: v }),
  });
  outletField.body.appendChild(outletInput);
  const macro = document.createElement("div");
  macro.className = "lmb-field-hint";
  macro.textContent = `Place {{outlet::${state.settings.memoryOutletName || "lumibooks"}}} in your preset where memories should appear.`;
  outletField.body.appendChild(macro);
  sec.body.appendChild(outletField.wrap);

  const addTemplate = (
    label: string,
    key: "bookNameTemplate" | "chapterNameTemplate" | "arcNameTemplate" | "volumeNameTemplate",
    placeholder: string,
  ): void => {
    const row = field(label);
    row.body.appendChild(textInput({
      value: state.settings[key],
      placeholder,
      onBlur: (v) => saveSetting({ [key]: v } as Partial<LMBSettings>),
    }));
    sec.body.appendChild(row.wrap);
  };

  addTemplate("Lorebook name", "bookNameTemplate", "LumiBooks - {{chat}}");
  addTemplate("Chapter entry", "chapterNameTemplate", "#{{storyOrder}} - {{title}} (msgs {{scene}})");
  addTemplate("Arc entry", "arcNameTemplate", "{{rootPrefix}}Arc {{sceneNumberPadded}} - {{title}}");
  addTemplate("Volume entry", "volumeNameTemplate", "{{rootPrefix}}Volume {{sceneNumberPadded}} - {{title}}");

  sec.body.appendChild(checkbox({
    checked: state.settings.includeContentHeaders,
    label: "Save generated headers in memory content",
    hint: "When off, entries save only the actual memory text, without the generated Chapter/ARC/VOLUME header.",
    onChange: (v) => saveSetting({ includeContentHeaders: v }),
  }));

  host.appendChild(sec.wrap);
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
    sec.body.appendChild(textNode("Open a chat to use lorebook tools", "lmb-empty"));
    host.appendChild(sec.wrap);
    return;
  }
  const chatId = state.activeChatId;
  const disabled = state.busy.length > 0 || !state.settings.enabled;
  const row = document.createElement("div");
  row.className = "lmb-actions";
  row.append(
    makeButton("Adopt existing lorebook", () => send({ type: "prepare_adopt_lorebook", chatId }), {
      disabled,
      title: "Add LumiBooks metadata to entries in an attached lorebook in-place.",
    }),
  );
  sec.body.appendChild(row);
  host.appendChild(sec.wrap);
}
