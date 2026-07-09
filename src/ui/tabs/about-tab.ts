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
