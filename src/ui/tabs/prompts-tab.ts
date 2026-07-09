import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { FrontendState, FrontendToBackend } from "../../types";
import type { CustomPreset, LMBProfile } from "../../shared";
import {
  field,
  makeButton,
  section,
  select,
  textArea,
  textInput,
  textNode,
} from "../components";
import { confirmDelete, promptForString } from "../modals";

export function renderPromptsTab(
  host: HTMLElement,
  state: FrontendState,
  ctx: SpindleFrontendContext,
  send: (msg: FrontendToBackend) => void,
): void {
  host.replaceChildren();
  const profile = state.activeProfile;
  const setKey = (category: PresetCategory, key: string) => {
    const p: Partial<LMBProfile> = category === "arc"
      ? { arcPresetKey: key }
      : category === "volume"
        ? { volumePresetKey: key }
        : { chapterPresetKey: key };
    send({ type: "save_profile", profile: { id: profile.id, ...p }, chatId: state.activeChatId });
  };

  renderCategory(host, state, ctx, send, "chapter", profile.chapterPresetKey, setKey);
  renderCategory(host, state, ctx, send, "arc", profile.arcPresetKey, setKey);
  renderCategory(host, state, ctx, send, "volume", profile.volumePresetKey, setKey);
  renderImport(host, state, ctx, send);
}

type PresetCategory = "chapter" | "arc" | "volume";

function renderCategory(
  host: HTMLElement,
  state: FrontendState,
  ctx: SpindleFrontendContext,
  send: (msg: FrontendToBackend) => void,
  category: PresetCategory,
  selectedKey: string,
  setKey: (cat: PresetCategory, key: string) => void,
): void {
  const sec = section(category === "arc" ? "Arc prompt" : category === "volume" ? "Volume prompt" : "Chapter prompt");

  const builtIns = category === "arc" ? state.arcPresets : category === "volume" ? state.volumePresets : state.chapterPresets;
  const customs = state.customPresets.filter((p) => p.category === category);
  const opts = [
    ...builtIns.map((b) => ({ value: b.key, label: `Built-in: ${b.displayName}` })),
    ...customs.map((c) => ({ value: c.key, label: `Custom: ${c.displayName}` })),
  ];

  const pickerRow = document.createElement("div");
  pickerRow.className = "lmb-field-row";
  const grow = document.createElement("div");
  grow.className = "lmb-grow";
  grow.appendChild(
    select({
      value: selectedKey,
      options: opts,
      onChange: (v) => setKey(category, v),
    }),
  );
  pickerRow.append(grow);
  sec.body.appendChild(pickerRow);

  const isUserPreset = customs.some((c) => c.key === selectedKey);
  const selectedText = findPresetText(state, category, selectedKey);

  const buttonsRow = document.createElement("div");
  buttonsRow.className = "lmb-actions";
  buttonsRow.append(
    makeButton("New blank prompt", async () => {
      const name = await promptForString(ctx, `Name for new ${category} prompt`, "Untitled");
      if (!name) return;
      const key = `${category}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      send({
        type: "save_custom_preset",
        preset: {
          key,
          displayName: name,
          prompt: blankPromptTemplate(category),
          category,
          createdAt: Date.now(),
        },
        chatId: state.activeChatId,
      });
      setKey(category, key);
    }, { small: true }),
    makeButton(isUserPreset ? "Duplicate to new" : "Duplicate to edit", async () => {
      const sourceName = customs.find((c) => c.key === selectedKey)?.displayName
        ?? builtIns.find((b) => b.key === selectedKey)?.displayName
        ?? "Untitled";
      const name = await promptForString(ctx, `Name for duplicate`, `${sourceName} copy`);
      if (!name) return;
      const key = `${category}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      send({
        type: "save_custom_preset",
        preset: {
          key,
          displayName: name,
          prompt: selectedText,
          category,
          createdAt: Date.now(),
        },
        chatId: state.activeChatId,
      });
      setKey(category, key);
    }, { small: true }),
    makeButton("Dry run", () => {
      if (!state.activeChatId) return;
      if (category === "arc") send({ type: "dry_run_arc", chatId: state.activeChatId });
      else if (category === "volume") send({ type: "dry_run_volume", chatId: state.activeChatId });
    }, {
      small: true,
      disabled: category === "chapter" || !state.activeChatId || !state.settings.enabled,
      title: category === "chapter"
        ? "Chapter dry run needs a selected message range, so use Compress from the Make tab."
        : "Assemble this preset's prompt with all macros resolved and show what would be sent. Does not call the model.",
    }),
    makeButton("Delete", async () => {
      if (!isUserPreset) return;
      const ok = await confirmDelete(ctx, "Delete prompt?", "This removes the custom prompt and falls back to the built-in default.");
      if (!ok) return;
      send({ type: "delete_custom_preset", key: selectedKey, category, chatId: state.activeChatId });
    }, { small: true, danger: true, disabled: !isUserPreset }),
  );
  sec.body.appendChild(buttonsRow);

  if (isUserPreset) {
    const custom = customs.find((c) => c.key === selectedKey)!;
    const draft = { ...custom };
    const flush = () => send({
      type: "save_custom_preset",
      preset: { ...draft },
      chatId: state.activeChatId,
    });
    const nameField = field("Display name");
    nameField.body.appendChild(
      textInput({
        value: draft.displayName,
        onBlur: (v) => { draft.displayName = v.slice(0, 80); flush(); },
      }),
    );
    sec.body.appendChild(nameField.wrap);

    const textField = field("Prompt");
    textField.body.appendChild(
      textArea({
        value: draft.prompt,
        rows: 14,
        onBlur: (v) => { draft.prompt = v; flush(); },
      }),
    );
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

function blankPromptTemplate(category: PresetCategory): string {
  const noun = category === "arc" ? "arc" : category === "volume" ? "volume" : "chapter";
  return [
    `Summarize the following ${noun} into a JSON memory.`,
    "",
    "Return ONLY valid JSON in this exact shape:",
    "{",
    "  \"title\": \"Short title\",",
    "  \"content\": \"Compressed memory text\"",
    "}",
    "",
    "No commentary outside the JSON.",
  ].join("\n");
}

function findPresetText(state: FrontendState, category: PresetCategory, key: string): string {
  const c = state.customPresets.find((p) => p.key === key && p.category === category);
  if (c) return c.prompt;
  const builtIns = category === "arc" ? state.arcPresets : category === "volume" ? state.volumePresets : state.chapterPresets;
  const b = builtIns.find((p) => p.key === key);
  return b?.prompt ?? "";
}

function renderImport(
  host: HTMLElement,
  state: FrontendState,
  ctx: SpindleFrontendContext,
  send: (msg: FrontendToBackend) => void,
): void {
  const sec = section("Import STMB presets");
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent =
    "Upload a SillyTavern Memory Books export. Memoria reads the prompts and adds them as custom presets you can edit.";
  sec.body.appendChild(help);

  const row = document.createElement("div");
  row.className = "lmb-actions";
  row.append(
    makeButton("Import chapter presets", () => importFile(ctx, "chapter", send, state.activeChatId)),
    makeButton("Import arc presets", () => importFile(ctx, "arc", send, state.activeChatId)),
  );
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
        if (ok) send({ type: "delete_custom_preset", key: p.key, category: p.category, chatId: state.activeChatId });
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

function importFile(
  ctx: SpindleFrontendContext,
  category: "chapter" | "arc",
  send: (msg: FrontendToBackend) => void,
  chatId: string | null,
): void {
  ctx.uploads.pickFile({ accept: [".json", "application/json"], maxSizeBytes: 1_000_000 })
    .then((files) => {
      if (!files.length) return;
      const file = files[0]!;
      let text: string;
      try {
        text = new TextDecoder().decode(file.bytes);
      } catch (err) {
        console.warn("[LumiBooks] preset file decode failed", err);
        showImportFailure(ctx, "Memoria can't read this file");
        return;
      }
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        console.warn("[LumiBooks] preset JSON parse failed", err);
        showImportFailure(ctx, "Memoria couldn't parse the preset JSON");
        return;
      }
      send({ type: "import_preset", category, raw: parsed, chatId });
    })
    .catch((err) => {
      console.warn("[LumiBooks] import picker failed", err);
    });
}

function showImportFailure(ctx: SpindleFrontendContext, message: string): void {
  try {
    void ctx.ui.showConfirm({
      title: "Import failed",
      message,
      variant: "warning",
      confirmLabel: "OK",
      cancelLabel: "OK",
    });
  } catch {
    window.alert(message);
  }
}

