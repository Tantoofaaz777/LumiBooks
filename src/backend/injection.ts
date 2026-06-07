declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { InterceptorResultDTO, LlmMessageDTO } from "lumiverse-spindle-types";
import { buildCoverage, type CoverageMap } from "./coverage";
import { listLmbEntries, type LMBEntry } from "./world-book";
import { error } from "./runtime";

function isAssembledHistory(lm: LlmMessageDTO): boolean {
  return (lm as unknown as Record<string, unknown>)["__isChatHistory"] === true;
}

function sourceMessageId(lm: LlmMessageDTO): string | undefined {
  const v = (lm as unknown as Record<string, unknown>)["sourceMessageId"];
  return typeof v === "string" && v ? v : undefined;
}

interface OrderedEntry {
  entry: LMBEntry;
  label: string;
  firstIdx: number;
  lastIdx: number;
  emitted: boolean;
}

function orderEntries(coverage: CoverageMap, msgIdToIdx: Map<string, number>): OrderedEntry[] {
  const ordered: OrderedEntry[] = [];
  for (const entry of coverage.activeEntries) {
    let firstIdx = Number.POSITIVE_INFINITY;
    let lastIdx = -1;
    for (const msgId of entry.meta.msgIds) {
      const idx = msgIdToIdx.get(msgId);
      if (typeof idx !== "number") continue;
      if (idx < firstIdx) firstIdx = idx;
      if (idx > lastIdx) lastIdx = idx;
    }
    const haveIdx = firstIdx !== Number.POSITIVE_INFINITY;
    const resolvedFirst = haveIdx
      ? firstIdx
      : typeof entry.meta.firstMsgIdx === "number"
        ? entry.meta.firstMsgIdx
        : 0;
    const resolvedLast = haveIdx
      ? lastIdx
      : typeof entry.meta.lastMsgIdx === "number"
        ? entry.meta.lastMsgIdx
        : resolvedFirst;
    const label =
      entry.raw.comment ||
      (entry.meta.tier === 2
        ? haveIdx ? `Arc msgs ${firstIdx + 1}-${lastIdx + 1}` : "Arc"
        : haveIdx ? `Chapter msgs ${firstIdx + 1}-${lastIdx + 1}` : "Chapter");
    ordered.push({ entry, label, firstIdx: resolvedFirst, lastIdx: resolvedLast, emitted: false });
  }
  ordered.sort((a, b) => a.firstIdx - b.firstIdx);
  return ordered;
}

export async function buildInjection(
  chatId: string,
  llmMessages: LlmMessageDTO[],
  userId: string,
): Promise<InterceptorResultDTO | null> {
  const [activated, allEntries] = await Promise.all([
    spindle.world_books.getActivated(chatId, userId).catch(() => null),
    listLmbEntries(chatId, userId),
  ]);
  let entriesForCoverage: LMBEntry[];
  if (activated) {
    const activatedIds = new Set(activated.map((a) => a.id));
    entriesForCoverage = allEntries.filter((e) => activatedIds.has(e.raw.id));
  } else {
    entriesForCoverage = allEntries.filter((e) => !e.raw.disabled);
  }
  const coverage = await buildCoverage(chatId, userId, entriesForCoverage);
  if (coverage.activeEntries.length === 0) return null;

  const chatMessages = await spindle.chat.getMessages(chatId).catch(() => null);
  if (!chatMessages || chatMessages.length === 0) return null;

  const msgIdToIdx = new Map<string, number>();
  for (let i = 0; i < chatMessages.length; i++) msgIdToIdx.set(chatMessages[i]!.id, i);

  const ordered = orderEntries(coverage, msgIdToIdx);
  if (ordered.length === 0) return null;

  const hasVisibleMessage = chatMessages.some(
    (m) => !(m.extra && (m.extra as Record<string, unknown>).hidden),
  );
  const historyMsgs = llmMessages.filter(isAssembledHistory);
  if (historyMsgs.length === 0) {
    if (hasVisibleMessage) {
      error(
        `injection: no "__isChatHistory" messages on ${llmMessages.length} assembled message(s) despite ` +
          `visible chat messages. Lumiverse's chat-history contract likely changed — skipping injection.`,
      );
    }
    return null;
  }

  const plan: { idx: number; covered: boolean }[] = [];
  for (const m of historyMsgs) {
    const id = sourceMessageId(m);
    if (id === undefined) {
      error(
        `injection: a "__isChatHistory" message is missing sourceMessageId. Host identity contract ` +
          `looks inconsistent — skipping injection.`,
      );
      return null;
    }
    const idx = msgIdToIdx.get(id);
    if (idx === undefined) {
      error(
        `injection: sourceMessageId "${id}" is not in the chat — skipping injection.`,
      );
      return null;
    }
    plan.push({ idx, covered: coverage.coveredBy.has(id) });
  }

  const out: LlmMessageDTO[] = [];
  const injectedLabels = new Map<LlmMessageDTO, string>();

  const flushAt = (index: number, beforePos: number): void => {
    const block: LlmMessageDTO[] = [];
    for (const o of ordered) {
      if (o.emitted || o.lastIdx >= beforePos) continue;
      o.emitted = true;
      const msg: LlmMessageDTO = { role: "assistant", content: formatEntryForInjection(o.entry) };
      injectedLabels.set(msg, o.label);
      block.push(msg);
    }
    if (block.length) out.splice(index, 0, ...block);
  };

  let hp = 0; // pointer into `plan`, advanced per chat-history message
  let histEnd = -1; // out index just past the last chat-history message
  for (const lm of llmMessages) {
    if (!isAssembledHistory(lm)) {
      out.push(lm);
      continue;
    }
    const { idx, covered } = plan[hp++]!;
    flushAt(out.length, idx);
    if (!covered) out.push(lm);
    histEnd = out.length;
  }

  flushAt(histEnd < 0 ? out.length : histEnd, Number.POSITIVE_INFINITY);

  if (injectedLabels.size === 0) return null;

  const breakdown: NonNullable<InterceptorResultDTO["breakdown"]> = [];
  for (let i = 0; i < out.length; i++) {
    const label = injectedLabels.get(out[i]!);
    if (label !== undefined) breakdown.push({ messageIndex: i, name: label });
  }

  return { messages: out, breakdown };
}

function formatEntryForInjection(entry: LMBEntry): string {
  return entry.raw.content;
}
