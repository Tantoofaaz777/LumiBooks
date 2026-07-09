import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type {
  AdoptLorebookCandidate,
  AdoptLorebookPlanEntry,
  ChapterView,
  DryRunDiagnostic,
  DryRunMessage,
  FrontendToBackend,
} from "../types";
import { makeButton, numberInput, select, textArea, textInput } from "./components";

export interface EditEntryFields {
  comment: string;
  content: string;
}

export function openEditModal(
  ctx: SpindleFrontendContext,
  title: string,
  fields: EditEntryFields,
  onSave: (next: EditEntryFields) => void,
): void {
  const handle = ctx.ui.showModal({ title, width: 640, maxHeight: 720 });
  const form = document.createElement("div");
  form.className = "lmb-modal-form";
  handle.root.appendChild(form);

  const labelWrap = document.createElement("div");
  labelWrap.className = "lmb-field";
  const lbl = document.createElement("div");
  lbl.className = "lmb-field-label";
  lbl.textContent = "Label";
  const labelInput = textInput({ value: fields.comment, placeholder: "Label" });
  labelWrap.append(lbl, labelInput);
  form.appendChild(labelWrap);

  const contentWrap = document.createElement("div");
  contentWrap.className = "lmb-field";
  const cLbl = document.createElement("div");
  cLbl.className = "lmb-field-label";
  cLbl.textContent = "Content";
  const contentInput = textArea({ value: fields.content, rows: 16 });
  contentWrap.append(cLbl, contentInput);
  form.appendChild(contentWrap);

  const actions = document.createElement("div");
  actions.className = "lmb-modal-actions";
  actions.append(
    makeButton("Cancel", () => handle.dismiss()),
    makeButton("Save", () => {
      onSave({ comment: labelInput.value, content: contentInput.value });
      handle.dismiss();
    }, { primary: true }),
  );
  form.appendChild(actions);
}

export async function confirmDelete(
  ctx: SpindleFrontendContext,
  title: string,
  message: string,
): Promise<boolean> {
  try {
    const r = await ctx.ui.showConfirm({
      title,
      message,
      variant: "danger",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    return !!r.confirmed;
  } catch {
    return window.confirm(message);
  }
}

export function showDryRunModal(
  kind: "chapter" | "arc" | "volume",
  messages: DryRunMessage[],
  diagnostics: DryRunDiagnostic[],
): void {
  const overlay = document.createElement("div");
  overlay.className = "lmb-preview-overlay";

  const modal = document.createElement("div");
  modal.className = "lmb-preview-modal";

  const header = document.createElement("div");
  header.className = "lmb-preview-modal__header";
  const title = document.createElement("h3");
  title.textContent = `Dry run: ${kind === "arc" ? "Arc" : kind === "volume" ? "Volume" : "Chapter"}`;
  header.appendChild(title);
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "lmb-preview-modal__close";
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "Close dry run");
  closeBtn.addEventListener("click", () => overlay.remove());
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const body = document.createElement("div");
  body.className = "lmb-preview-modal__body";

  if (diagnostics.length > 0) {
    const diag = document.createElement("div");
    diag.className = "lmb-preview-modal__diagnostics";
    const diagTitle = document.createElement("h4");
    diagTitle.textContent = "Diagnostics";
    diag.appendChild(diagTitle);
    const ul = document.createElement("ul");
    for (const d of diagnostics) {
      const li = document.createElement("li");
      li.textContent = d.message;
      ul.appendChild(li);
    }
    diag.appendChild(ul);
    body.appendChild(diag);
  }

  for (const m of messages) {
    const msgCard = document.createElement("div");
    msgCard.className = "lmb-preview-msg";
    const roleLabel = document.createElement("div");
    roleLabel.className = "lmb-preview-msg__role";
    roleLabel.textContent = m.role;
    const contentPre = document.createElement("pre");
    contentPre.className = "lmb-preview-msg__content";
    contentPre.textContent = m.content;
    msgCard.appendChild(roleLabel);
    msgCard.appendChild(contentPre);
    body.appendChild(msgCard);
  }

  modal.appendChild(body);

  const footer = document.createElement("div");
  footer.className = "lmb-preview-modal__footer";
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "lmb-btn small";
  copyBtn.textContent = "Copy JSON";
  copyBtn.addEventListener("click", async () => {
    const json = JSON.stringify({ kind, messages, diagnostics }, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      copyBtn.textContent = "Copied";
      setTimeout(() => (copyBtn.textContent = "Copy JSON"), 1500);
    } catch {
      copyBtn.textContent = "Copy failed";
    }
  });
  footer.appendChild(copyBtn);
  modal.appendChild(footer);

  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

export function openAdoptLorebookModal(
  ctx: SpindleFrontendContext,
  chatId: string,
  books: AdoptLorebookCandidate[],
  send: (msg: FrontendToBackend) => void,
): void {
  const handle = ctx.ui.showModal({ title: "Adopt existing lorebook", width: 780, maxHeight: 760 });
  const root = document.createElement("div");
  root.className = "lmb-modal-form";
  handle.root.appendChild(root);

  if (books.length === 0) {
    const empty = document.createElement("div");
    empty.className = "lmb-empty";
    empty.textContent = "No attached lorebooks with entries were found.";
    const actions = document.createElement("div");
    actions.className = "lmb-modal-actions";
    actions.appendChild(makeButton("Close", () => handle.dismiss(), { primary: true }));
    root.append(empty, actions);
    return;
  }

  let selectedBookId = books[0]!.bookId;
  const rows = new Map<string, { tier: HTMLSelectElement; order: HTMLInputElement }>();

  const bookSelect = select({
    value: selectedBookId,
    options: books.map((book) => ({ value: book.bookId, label: `${book.name} (${book.entries.length})` })),
    onChange: (v) => {
      selectedBookId = v;
      renderEntries();
    },
  });
  const bookField = document.createElement("div");
  bookField.className = "lmb-field";
  const bookLabel = document.createElement("div");
  bookLabel.className = "lmb-field-label";
  bookLabel.textContent = "Lorebook";
  bookField.append(bookLabel, bookSelect);

  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent = "This modifies the selected lorebook in-place and adds LumiBooks metadata to the chosen entries.";

  const list = document.createElement("div");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "8px";

  function selectedBook(): AdoptLorebookCandidate {
    return books.find((book) => book.bookId === selectedBookId) ?? books[0]!;
  }

  function renderEntries(): void {
    rows.clear();
    list.replaceChildren();
    const book = selectedBook();
    book.entries.forEach((entry, index) => {
      const card = document.createElement("div");
      card.className = "lmb-preview-card";
      const head = document.createElement("div");
      head.style.display = "grid";
      head.style.gridTemplateColumns = "minmax(0, 1fr) 130px 90px";
      head.style.gap = "8px";
      head.style.alignItems = "center";

      const title = document.createElement("div");
      title.className = "lmb-entry-title";
      title.textContent = entry.comment;
      if (entry.alreadyManaged) title.textContent += " (already managed)";

      const tier = select({
        value: entry.alreadyManaged ? "0" : "1",
        options: [
          { value: "1", label: "Chapter" },
          { value: "2", label: "Arc" },
          { value: "3", label: "Volume" },
          { value: "0", label: "Skip" },
        ],
      });
      if (entry.alreadyManaged) tier.disabled = true;
      const order = numberInput({
        value: index + 1,
        min: 1,
        step: 1,
        disabled: entry.alreadyManaged,
      });

      head.append(title, tier, order);
      card.appendChild(head);
      if (entry.preview) {
        const preview = document.createElement("div");
        preview.className = "lmb-field-hint";
        preview.textContent = entry.preview;
        card.appendChild(preview);
      }
      list.appendChild(card);
      rows.set(entry.entryId, { tier, order });
    });
  }

  const actions = document.createElement("div");
  actions.className = "lmb-modal-actions";
  actions.append(
    makeButton("Cancel", () => handle.dismiss()),
    makeButton("Adopt", () => {
      const entries: AdoptLorebookPlanEntry[] = [];
      for (const entry of selectedBook().entries) {
        const row = rows.get(entry.entryId);
        if (!row) continue;
        const tier = Number(row.tier.value);
        const storyOrder = Number(row.order.value);
        entries.push({
          entryId: entry.entryId,
          tier: tier === 1 || tier === 2 || tier === 3 ? tier : 0,
          storyOrder: Number.isFinite(storyOrder) && storyOrder > 0 ? Math.floor(storyOrder) : entries.length + 1,
        });
      }
      send({ type: "confirm_adopt_lorebook", chatId, bookId: selectedBookId, entries });
      handle.dismiss();
    }, { primary: true }),
  );

  root.append(bookField, help, list, actions);
  renderEntries();
}

export function openBindMessagesModal(
  ctx: SpindleFrontendContext,
  chatId: string,
  chapters: ChapterView[],
  messageIds: string[],
  send: (msg: FrontendToBackend) => void,
  onBound?: () => void,
): void {
  const bindable = chapters.filter((chapter) => !chapter.isRoot);
  const handle = ctx.ui.showModal({ title: "Bind messages to chapter", width: 520, maxHeight: 520 });
  const root = document.createElement("div");
  root.className = "lmb-modal-form";
  handle.root.appendChild(root);

  if (bindable.length === 0) {
    const empty = document.createElement("div");
    empty.className = "lmb-empty";
    empty.textContent = "No local chapters are available.";
    const actions = document.createElement("div");
    actions.className = "lmb-modal-actions";
    actions.appendChild(makeButton("Close", () => handle.dismiss(), { primary: true }));
    root.append(empty, actions);
    return;
  }

  const sorted = bindable.slice().sort((a, b) => {
    const ao = a.meta.storyOrder ?? a.meta.sceneNumber ?? 0;
    const bo = b.meta.storyOrder ?? b.meta.sceneNumber ?? 0;
    return ao - bo;
  });
  let selectedEntryId = sorted.find((chapter) => chapter.meta.msgIds.length === 0)?.entryId ?? sorted[0]!.entryId;

  const chapterSelect = select({
    value: selectedEntryId,
    options: sorted.map((chapter) => {
      const title = chapter.comment || chapter.meta.title || chapter.entryId.slice(0, 8);
      return { value: chapter.entryId, label: `${title} (${chapter.meta.msgIds.length} msgs)` };
    }),
    onChange: (v) => { selectedEntryId = v; },
  });

  const field = document.createElement("div");
  field.className = "lmb-field";
  const label = document.createElement("div");
  label.className = "lmb-field-label";
  label.textContent = "Chapter";
  field.append(label, chapterSelect);

  const help = document.createElement("div");
  help.className = "lmb-help";
  help.textContent = `This will mark ${messageIds.length} selected message${messageIds.length === 1 ? "" : "s"} as covered by the chosen chapter.`;

  const actions = document.createElement("div");
  actions.className = "lmb-modal-actions";
  actions.append(
    makeButton("Cancel", () => handle.dismiss()),
    makeButton("Bind", () => {
      send({ type: "bind_messages_to_entry", chatId, entryId: selectedEntryId, messageIds });
      onBound?.();
      handle.dismiss();
    }, { primary: true }),
  );

  root.append(field, help, actions);
}

export function promptForString(
  ctx: SpindleFrontendContext,
  title: string,
  initial: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const handle = ctx.ui.showModal({ title, width: 420 });
    const form = document.createElement("div");
    form.className = "lmb-modal-form";
    handle.root.appendChild(form);
    const input = textInput({ value: initial, autoFocus: true });
    form.appendChild(input);
    const actions = document.createElement("div");
    actions.className = "lmb-modal-actions";
    actions.append(
      makeButton("Cancel", () => { settle(null); handle.dismiss(); }),
      makeButton("OK", () => {
        const v = input.value.trim();
        settle(v || null);
        handle.dismiss();
      }, { primary: true }),
    );
    form.appendChild(actions);
    try { handle.onDismiss?.(() => settle(null)); } catch (_) { void _; }
  });
}
