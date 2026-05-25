declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { ChatMessageDTO, InterceptorResultDTO, LlmMessageDTO } from "lumiverse-spindle-types";
import { buildCoverage, type CoverageMap } from "./coverage";
import { listLmbEntries, type LMBEntry } from "./world-book";

interface InjectionPlan {
  insertions: { atOriginalIdx: number; entry: LMBEntry; label: string }[];
  removeMessageIds: Set<string>;
}

function buildPlan(coverage: CoverageMap, messages: ChatMessageDTO[]): InjectionPlan {
  const msgIdToIdx = new Map<string, number>();
  for (let i = 0; i < messages.length; i++) msgIdToIdx.set(messages[i]!.id, i);

  const byEntry = new Map<string, { entry: LMBEntry; firstIdx: number; lastIdx: number }>();
  for (const entry of coverage.activeEntries) {
    let firstIdx = Number.POSITIVE_INFINITY;
    let lastIdx = -1;
    for (const msgId of entry.meta.msgIds) {
      const idx = msgIdToIdx.get(msgId);
      if (typeof idx !== "number") continue;
      if (idx < firstIdx) firstIdx = idx;
      if (idx > lastIdx) lastIdx = idx;
    }
    if (firstIdx === Number.POSITIVE_INFINITY) continue;
    byEntry.set(entry.raw.id, { entry, firstIdx, lastIdx });
  }

  const removeMessageIds = new Set<string>();
  for (const m of messages) if (coverage.coveredBy.has(m.id)) removeMessageIds.add(m.id);

  const insertions: InjectionPlan["insertions"] = [];
  for (const { entry, firstIdx, lastIdx } of byEntry.values()) {
    const label =
      entry.raw.comment ||
      (entry.meta.tier === 2
        ? `Arc msgs ${firstIdx + 1}-${lastIdx + 1}`
        : `Chapter msgs ${firstIdx + 1}-${lastIdx + 1}`);
    insertions.push({ atOriginalIdx: firstIdx, entry, label });
  }
  insertions.sort((a, b) => a.atOriginalIdx - b.atOriginalIdx);

  return { insertions, removeMessageIds };
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

  const plan = buildPlan(coverage, chatMessages);
  if (plan.insertions.length === 0 && plan.removeMessageIds.size === 0) return null;

  const queueByFingerprint = new Map<string, string[]>();
  for (const m of chatMessages) {
    const ent = coverage.coveredBy.get(m.id);
    if (!ent) continue;
    const fp = fingerprint(m.role, (m.content || "").trim());
    const existing = queueByFingerprint.get(fp);
    if (existing) existing.push(ent);
    else queueByFingerprint.set(fp, [ent]);
  }

  const out: LlmMessageDTO[] = [];
  const breakdown: NonNullable<InterceptorResultDTO["breakdown"]> = [];
  const emittedEntryIds = new Set<string>();

  for (const lm of llmMessages) {
    const fp = typeof lm.content === "string" ? fingerprint(lm.role, lm.content.trim()) : "";
    const queue = fp ? queueByFingerprint.get(fp) : undefined;
    const entryId = queue && queue.length > 0 ? queue.shift() : undefined;
    if (entryId) {
      if (!emittedEntryIds.has(entryId)) {
        emittedEntryIds.add(entryId);
        const meta = plan.insertions.find((i) => i.entry.raw.id === entryId);
        if (meta) {
          const insertedIdx = out.length;
          out.push({
            role: "system",
            content: formatEntryForInjection(meta.entry),
          });
          breakdown.push({ messageIndex: insertedIdx, name: meta.label });
        }
        continue;
      }
      continue;
    }
    out.push(lm);
  }

  const fallbackEntries = plan.insertions.filter((i) => !emittedEntryIds.has(i.entry.raw.id));
  if (fallbackEntries.length) {
    const fallbackBlock: LlmMessageDTO[] = fallbackEntries.map((meta) => ({
      role: "system" as const,
      content: formatEntryForInjection(meta.entry),
    }));
    let insertAt = 0;
    while (insertAt < out.length && out[insertAt]?.role === "system") insertAt++;
    out.splice(insertAt, 0, ...fallbackBlock);
    for (let i = 0; i < fallbackBlock.length; i++) {
      breakdown.push({ messageIndex: insertAt + i, name: fallbackEntries[i]!.label });
    }
  }

  return { messages: out, breakdown };
}

function fingerprint(role: string, trimmedContent: string): string {
  return `${role}::${trimmedContent}`;
}

function formatEntryForInjection(entry: LMBEntry): string {
  return entry.raw.content;
}
