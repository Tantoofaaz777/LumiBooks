import type { FrontendState, FrontendToBackend } from "../../types";
import type { LMBSettings } from "../../shared";
import { checkbox, field, labelled, makeButton, section, select, textInput, textNode } from "../components";

export function renderAboutTab(
  host: HTMLElement,
  state: FrontendState | null,
  send: (msg: FrontendToBackend) => void,
): void {
  host.replaceChildren();

  if (state) {
    renderInjection(host, state, send);
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
    "Tail messages stay uncompressed until they pass the lag.",
    "Once the window fills, Memoria writes a chapter, hides those messages in the chat, and slices the chapter into the prompt at the same spot.",
    "Several chapters can be bound into a single arc that replaces them.",
    "Arcs can be pressed into a volume the same way, manually from the Make tab.",
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
    "Memoria thanks the original Memory Books authors for the inspiration.";
  ack.body.appendChild(a);
  host.appendChild(ack.wrap);
}

function renderInjection(
  host: HTMLElement,
  state: FrontendState,
  send: (msg: FrontendToBackend) => void,
): void {
  const sec = section("Injection");
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent = "Choose where active memories land in the assembled prompt.";
  sec.body.appendChild(help);

  sec.body.appendChild(
    labelled("Mode", select({
      value: state.settings.memoryInjectionMode,
      options: [
        { value: "chat_history", label: "Chat history" },
        { value: "outlet", label: "Outlet macro" },
      ],
      onChange: (v) => send({
        type: "save_settings",
        patch: { memoryInjectionMode: v === "outlet" ? "outlet" : "chat_history" },
        chatId: state.activeChatId,
      }),
    })),
  );

  const outletField = field("Outlet name");
  const outletInput = textInput({
    value: state.settings.memoryOutletName,
    placeholder: "lumibooks",
    onBlur: (v) => send({
      type: "save_settings",
      patch: { memoryOutletName: v },
      chatId: state.activeChatId,
    }),
  });
  outletInput.disabled = state.settings.memoryInjectionMode !== "outlet";
  outletField.body.appendChild(outletInput);
  const macro = document.createElement("div");
  macro.className = "lmb-field-hint";
  macro.textContent = state.settings.memoryInjectionMode === "outlet"
    ? `Place {{outlet::${state.settings.memoryOutletName || "lumibooks"}}} in your preset where memories should appear.`
    : "Outlet mode sends active LumiBooks entries through the configured outlet instead of injecting them into chat history.";
  outletField.body.appendChild(macro);
  sec.body.appendChild(outletField.wrap);

  host.appendChild(sec.wrap);
}

function renderNaming(
  host: HTMLElement,
  state: FrontendState,
  send: (msg: FrontendToBackend) => void,
): void {
  const sec = section("Naming");
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent = "Templates support Lumiverse macros like {{user}} and {{char}}, plus {{scene}}, {{sceneNumber}}, {{title}}, and {{chat}}.";
  sec.body.appendChild(help);

  const saveSetting = (patch: Partial<LMBSettings>): void => {
    send({ type: "save_settings", patch, chatId: state.activeChatId });
  };

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
  addTemplate("Chapter entry", "chapterNameTemplate", "#{{sceneNumber}} - {{title}} (msgs {{scene}})");
  addTemplate("Arc entry", "arcNameTemplate", "{{rootPrefix}}Arc #{{sceneNumber}} - {{title}} (msgs {{scene}})");
  addTemplate("Volume entry", "volumeNameTemplate", "{{rootPrefix}}Volume #{{sceneNumber}} - {{title}} (msgs {{scene}})");

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
    checked: state.settings.showAutomationToasts,
    label: "Automation toasts",
    hint: "When off, Memoria's background runs stay quiet. Errors and your own actions still toast.",
    onChange: (v) => send({ type: "save_settings", patch: { showAutomationToasts: v }, chatId: state.activeChatId }),
  }));

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
