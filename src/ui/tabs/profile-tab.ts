import type { FrontendState, FrontendToBackend } from "../../types";
import type { LMBProfile, SamplerSet } from "../../shared";
import { SAMPLER_DEFAULTS, makeDefaultProfile } from "../../shared";

const PROFILE_DEFAULTS = makeDefaultProfile("__defaults__", "Defaults");
import {
  checkbox,
  field,
  labelled,
  makeButton,
  multiSelect,
  numberInput,
  section,
  select,
  textInput,
  textNode,
} from "../components";
import { promptForString } from "../modals";
import type { SpindleFrontendContext } from "lumiverse-spindle-types";

export function renderProfileTab(
  host: HTMLElement,
  state: FrontendState,
  ctx: SpindleFrontendContext,
  send: (msg: FrontendToBackend) => void,
): void {
  host.replaceChildren();
  const profile = state.activeProfile;
  const patch = (p: Partial<LMBProfile>) =>
    send({ type: "save_profile", profile: { id: profile.id, ...p }, chatId: state.activeChatId });

  renderProfilePicker(host, state, ctx, send);

  const rest = document.createElement("div");
  rest.style.display = "flex";
  rest.style.flexDirection = "column";
  rest.style.gap = "12px";
  if (!state.settings.enabled) {
    rest.classList.add("lmb-greyed");
    rest.setAttribute("inert", "");
  }
  host.appendChild(rest);

  renderConnection(rest, state, profile, patch);
  renderSamplers(rest, state, profile, send);
  renderContext(rest, profile, patch);
  renderRegex(rest, state, profile, patch);
  renderBehavior(rest, profile, patch);
  renderResetSettings(rest, state, send);
}

function renderResetSettings(
  host: HTMLElement,
  state: FrontendState,
  send: (msg: FrontendToBackend) => void,
): void {
  const profile = state.activeProfile;
  const sec = section("Reset");
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent =
    "Resets this profile's settings to their defaults.";
  sec.body.appendChild(help);

  const IDLE = "Reset profile to defaults";
  const CONFIRM = "Click again to confirm";
  let btn: HTMLButtonElement;
  let armed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const disarm = (): void => {
    armed = false;
    if (timer) { clearTimeout(timer); timer = undefined; }
    btn.textContent = IDLE;
  };
  btn = makeButton(IDLE, () => {
    if (!armed) {
      armed = true;
      btn.textContent = CONFIRM;
      timer = setTimeout(disarm, 3000);
      return;
    }
    disarm();
    send({
      type: "save_profile",
      profile: makeDefaultProfile(profile.id, profile.name),
      chatId: state.activeChatId,
    });
  }, { danger: true });
  sec.body.appendChild(btn);

  host.appendChild(sec.wrap);
}

function renderProfilePicker(
  host: HTMLElement,
  state: FrontendState,
  ctx: SpindleFrontendContext,
  send: (msg: FrontendToBackend) => void,
): void {
  const sec = section("Profile");
  const row = document.createElement("div");
  row.className = "lmb-field-row";

  const grow = document.createElement("div");
  grow.className = "lmb-grow";
  grow.appendChild(
    select({
      value: state.activeProfile.id,
      options: state.settings.profiles.map((p) => ({ value: p.id, label: p.name })),
      onChange: (v) => send({ type: "set_active_profile", profileId: v, chatId: state.activeChatId }),
    }),
  );
  row.appendChild(grow);
  row.append(
    makeButton("New", async () => {
      const name = await promptForString(ctx, "New profile name", "");
      if (!name) return;
      send({ type: "create_profile", name, chatId: state.activeChatId });
    }, { small: true }),
    makeButton("Delete", () => {
      send({ type: "delete_profile", profileId: state.activeProfile.id, chatId: state.activeChatId });
    }, { small: true, danger: true, disabled: state.settings.profiles.length <= 1 }),
  );
  sec.body.appendChild(row);

  const profile = state.activeProfile;
  const nameField = field("Profile name");
  nameField.body.appendChild(
    textInput({
      value: profile.name,
      onBlur: (v) => send({ type: "save_profile", profile: { id: profile.id, name: v.slice(0, 60) }, chatId: state.activeChatId }),
    }),
  );
  sec.body.appendChild(nameField.wrap);

  const enableWrap = field("Extension");
  enableWrap.body.appendChild(
    checkbox({
      checked: state.settings.enabled,
      label: "Enabled",
      hint: "Master switch. When off, Memoria does nothing on this account.",
      onChange: (v) => send({ type: "save_settings", patch: { enabled: v }, chatId: state.activeChatId }),
    }),
  );
  sec.body.appendChild(enableWrap.wrap);

  host.appendChild(sec.wrap);
}

function renderConnection(
  host: HTMLElement,
  state: FrontendState,
  profile: LMBProfile,
  patch: (p: Partial<LMBProfile>) => void,
): void {
  const sec = section("Connection");
  const opts = [
    { value: "", label: state.connections.length ? "Default connection" : "No connections available" },
    ...state.connections.map((c) => ({
      value: c.id,
      label: `${c.name} - ${c.provider}${c.model ? "/" + c.model : ""}${c.isDefault ? " (default)" : ""}`,
    })),
  ];
  sec.body.appendChild(
    select({
      value: profile.connectionId ?? "",
      options: opts,
      onChange: (v) => patch({ connectionId: v || null }),
    }),
  );
  if (state.resolvedSidecarConnectionId) {
    const resolved = state.connections.find((c) => c.id === state.resolvedSidecarConnectionId);
    if (resolved) {
      const hint = document.createElement("div");
      hint.className = "lmb-field-hint";
      hint.textContent = `Memoria writes with ${resolved.name}`;
      sec.body.appendChild(hint);
    }
  }
  host.appendChild(sec.wrap);
}

function renderSamplers(
  host: HTMLElement,
  state: FrontendState,
  profile: LMBProfile,
  send: (msg: FrontendToBackend) => void,
): void {
  const sec = section("Samplers");
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent =
    "LumiBooks ships with its own sampler defaults tuned for summarization (low temperature, generous output budget). Empty fields use those defaults - placeholders show what will be sent. Temperature, max output, and max input are always sent on the wire; top_p / top_k / penalties are only sent when you set them.";
  sec.body.appendChild(help);

  const saveSampler = (key: keyof SamplerSet) => (v: number | null) => {
    const patch = { [key]: v } as Partial<SamplerSet>;
    send({ type: "save_samplers", profileId: profile.id, samplers: patch, chatId: state.activeChatId });
  };

  const grid = document.createElement("div");
  grid.className = "lmb-grid-2";
  grid.append(
    labelled("Max input tokens", numberInput({
      value: profile.samplers.max_input_tokens, min: 256, max: 4000000, step: 1024,
      placeholder: String(SAMPLER_DEFAULTS.max_input_tokens),
      onBlur: saveSampler("max_input_tokens"),
    })),
    labelled("Max output tokens", numberInput({
      value: profile.samplers.max_tokens, min: 1, max: 1000000, step: 256,
      placeholder: String(SAMPLER_DEFAULTS.max_tokens),
      onBlur: saveSampler("max_tokens"),
    })),
  );
  sec.body.appendChild(grid);

  const sampleGrid = document.createElement("div");
  sampleGrid.className = "lmb-grid-3";
  sampleGrid.append(
    labelled("Temperature", numberInput({
      value: profile.samplers.temperature, min: 0, max: 2, step: 0.05,
      placeholder: String(SAMPLER_DEFAULTS.temperature),
      onBlur: saveSampler("temperature"),
    })),
    labelled("Top P", numberInput({
      value: profile.samplers.top_p, min: 0, max: 1, step: 0.01,
      placeholder: String(SAMPLER_DEFAULTS.top_p),
      onBlur: saveSampler("top_p"),
    })),
    labelled("Top K", numberInput({
      value: profile.samplers.top_k, min: 0, max: 1000, step: 1,
      placeholder: String(SAMPLER_DEFAULTS.top_k),
      onBlur: saveSampler("top_k"),
    })),
    labelled("Freq penalty", numberInput({
      value: profile.samplers.frequency_penalty, min: -2, max: 2, step: 0.05,
      placeholder: String(SAMPLER_DEFAULTS.frequency_penalty),
      onBlur: saveSampler("frequency_penalty"),
    })),
    labelled("Pres penalty", numberInput({
      value: profile.samplers.presence_penalty, min: -2, max: 2, step: 0.05,
      placeholder: String(SAMPLER_DEFAULTS.presence_penalty),
      onBlur: saveSampler("presence_penalty"),
    })),
  );
  sec.body.appendChild(sampleGrid);
  host.appendChild(sec.wrap);
}

function renderRegex(
  host: HTMLElement,
  state: FrontendState,
  profile: LMBProfile,
  patch: (p: Partial<LMBProfile>) => void,
): void {
  const sec = section("Regex");
  if (state.regexScripts.length === 0) {
    sec.body.appendChild(textNode("No regex scripts found in Lumiverse", "lmb-empty"));
    host.appendChild(sec.wrap);
    return;
  }
  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent =
    "Outgoing runs on the prompt before Memoria reads it. Incoming runs on the result after Memoria writes.";
  sec.body.appendChild(help);

  const outgoing = field("Outgoing");
  outgoing.body.appendChild(
    multiSelect({
      options: state.regexScripts.map((s) => ({ value: s.id, label: s.name })),
      selected: profile.regexOutgoingScriptIds,
      onChange: (ids) => patch({ regexOutgoingScriptIds: ids }),
    }),
  );
  sec.body.appendChild(outgoing.wrap);

  const incoming = field("Incoming");
  incoming.body.appendChild(
    multiSelect({
      options: state.regexScripts.map((s) => ({ value: s.id, label: s.name })),
      selected: profile.regexIncomingScriptIds,
      onChange: (ids) => patch({ regexIncomingScriptIds: ids }),
    }),
  );
  sec.body.appendChild(incoming.wrap);

  host.appendChild(sec.wrap);
}

function renderContext(host: HTMLElement, profile: LMBProfile, patch: (p: Partial<LMBProfile>) => void): void {
  const sec = section("Context");
  const f = field("Chapter context");
  f.body.appendChild(
    numberInput({
      value: profile.previousMemoriesCount,
      min: 0,
      max: 20,
      defaultValue: PROFILE_DEFAULTS.previousMemoriesCount,
      onBlur: (v) => patch({ previousMemoriesCount: v ?? PROFILE_DEFAULTS.previousMemoriesCount }),
    }),
  );
  const hint = document.createElement("div");
  hint.className = "lmb-field-hint";
  hint.textContent = "How many recent chapters to feed Memoria as continuity context.";
  f.body.appendChild(hint);
  sec.body.appendChild(f.wrap);

  const retry = field("Retries");
  retry.body.appendChild(
    numberInput({
      value: profile.retryCount,
      min: 0,
      max: 10,
      defaultValue: PROFILE_DEFAULTS.retryCount,
      onBlur: (v) => patch({ retryCount: v ?? PROFILE_DEFAULTS.retryCount }),
    }),
  );
  const retryHint = document.createElement("div");
  retryHint.className = "lmb-field-hint";
  retryHint.textContent = "Tries per attempt. After the last try, Memoria will pick the same messages again next turn.";
  retry.body.appendChild(retryHint);
  sec.body.appendChild(retry.wrap);

  const ttft = field("First-token timeout (seconds)");
  ttft.body.appendChild(
    numberInput({
      value: profile.ttftTimeoutSecs,
      min: 10,
      max: 600,
      step: 5,
      defaultValue: PROFILE_DEFAULTS.ttftTimeoutSecs,
      onBlur: (v) => patch({ ttftTimeoutSecs: v ?? PROFILE_DEFAULTS.ttftTimeoutSecs }),
    }),
  );
  const ttftHint = document.createElement("div");
  ttftHint.className = "lmb-field-hint";
  ttftHint.textContent = "How long Memoria waits for the first streamed token before giving up. After the first token she lets the stream run.";
  ttft.body.appendChild(ttftHint);
  sec.body.appendChild(ttft.wrap);

  host.appendChild(sec.wrap);
}

function renderBehavior(host: HTMLElement, profile: LMBProfile, patch: (p: Partial<LMBProfile>) => void): void {
  const sec = section("Behavior");
  sec.body.appendChild(checkbox({
    checked: profile.showMemoryPreviews,
    label: "Preview before saving",
    hint: "Memoria stages new chapters and arcs in the Books tab for your approval.",
    onChange: (v) => patch({ showMemoryPreviews: v }),
  }));
  host.appendChild(sec.wrap);
}
