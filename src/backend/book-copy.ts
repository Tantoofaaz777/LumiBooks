declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { WorldBookEntryDTO } from "lumiverse-spindle-types";
import type { LMBEntryMeta } from "../shared";
import { EXTENSION_KEY } from "../shared";
import type { LMBEntry } from "./world-book";
import { describeError, warn } from "./runtime";


export interface CopyOverride {
  msgIds: string[];
  firstMsgIdx?: number;
  lastMsgIdx?: number;
  extra?: Partial<LMBEntryMeta>;
  comment?: string;
}

export interface CopyCtx {
  idMap: Map<string, string>;
  clonedChapterMeta: Map<string, LMBEntryMeta>;
}

export type CopyTransform = (entry: LMBEntry, ctx: CopyCtx) => CopyOverride | null;

export async function copyLmbEntries(
  targetBookId: string,
  sourceEntries: LMBEntry[],
  userId: string,
  transform: CopyTransform,
): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();
  const clonedChapterMeta = new Map<string, LMBEntryMeta>();
  const ctx: CopyCtx = { idMap, clonedChapterMeta };
  const chapters = sourceEntries.filter((e) => e.meta.tier === 1);
  const arcs = sourceEntries.filter((e) => e.meta.tier === 2);

  for (const ch of chapters) {
    const o = transform(ch, ctx);
    if (!o) continue;
    const meta: LMBEntryMeta = {
      ...ch.meta,
      msgIds: o.msgIds,
      firstMsgIdx: o.firstMsgIdx,
      lastMsgIdx: o.lastMsgIdx,
      supersededByEntryId: null,
      ...o.extra,
    };
    const created = await createClone(targetBookId, ch.raw, meta, userId, o.comment);
    idMap.set(ch.raw.id, created.id);
    clonedChapterMeta.set(ch.raw.id, meta);
  }

  for (const arc of arcs) {
    const o = transform(arc, ctx);
    if (!o) continue;
    const sourceChapterEntryIds = (arc.meta.sourceChapterEntryIds ?? [])
      .map((oldId) => idMap.get(oldId))
      .filter((x): x is string => typeof x === "string");
    const meta: LMBEntryMeta = {
      ...arc.meta,
      msgIds: o.msgIds,
      sourceChapterEntryIds,
      firstMsgIdx: o.firstMsgIdx,
      lastMsgIdx: o.lastMsgIdx,
      supersededByEntryId: null,
      ...o.extra,
    };
    const created = await createClone(targetBookId, arc.raw, meta, userId, o.comment);
    idMap.set(arc.raw.id, created.id);
  }

  for (const ch of chapters) {
    const newChId = idMap.get(ch.raw.id);
    if (!newChId) continue;
    const oldArcId = ch.meta.supersededByEntryId;
    if (!oldArcId) continue;
    const newArcId = idMap.get(oldArcId);
    if (!newArcId) continue;
    const baseMeta = clonedChapterMeta.get(ch.raw.id);
    if (!baseMeta) continue;
    const ext = (ch.raw.extensions || {}) as Record<string, unknown>;
    try {
      await spindle.world_books.entries.update(
        newChId,
        { extensions: { ...ext, [EXTENSION_KEY]: { ...baseMeta, supersededByEntryId: newArcId } } },
        userId,
      );
    } catch (err) {
      warn(`copyLmbEntries: failed to re-point chapter ${newChId.slice(0, 8)}: ${describeError(err)}`);
    }
  }

  return idMap;
}

async function createClone(
  bookId: string,
  source: WorldBookEntryDTO,
  meta: LMBEntryMeta,
  userId: string,
  commentOverride?: string,
): Promise<WorldBookEntryDTO> {
  const ext = (source.extensions || {}) as Record<string, unknown>;
  return spindle.world_books.entries.create(
    bookId,
    {
      content: source.content,
      comment: commentOverride ?? source.comment,
      disabled: source.disabled,
      constant: source.constant,
      key: source.key ?? [],
      keysecondary: source.keysecondary ?? [],
      vectorized: source.vectorized ?? false,
      extensions: { ...ext, [EXTENSION_KEY]: meta },
    },
    userId,
  );
}
