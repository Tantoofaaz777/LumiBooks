declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import { EXTENSION_ID } from "../shared";
import { describeError, warn } from "./runtime";

export interface ChapterCreatedEvent {
  chatId: string;
  chapterEntryId: string;
  bookId: string;
  sourceMessageIds: string[];
  summaryText: string;
  model: string;
  title?: string | undefined;
  createdAt: number;
}

export interface ArcCreatedEvent {
  chatId: string;
  arcEntryId: string;
  bookId: string;
  sourceChapterEntryIds: string[];
  sourceMessageIds: string[];
  summaryText: string;
  model: string;
  title?: string | undefined;
  createdAt: number;
}

const CHAPTER_KEY = `${EXTENSION_ID}.latest_chapter`;
const ARC_KEY = `${EXTENSION_ID}.latest_arc`;

let registered = false;

export function registerHookEndpoints(): void {
  if (registered) return;
  registered = true;
  try {
    spindle.rpcPool?.sync?.(CHAPTER_KEY, null, { requires: [] });
    spindle.rpcPool?.sync?.(ARC_KEY, null, { requires: [] });
  } catch (err) {
    warn(`rpcPool unavailable: ${describeError(err)}`);
  }
}

export function publishChapterCreated(userId: string, event: Omit<ChapterCreatedEvent, "createdAt">): void {
  const payload: ChapterCreatedEvent & { userId: string } = {
    ...event,
    createdAt: Date.now(),
    userId,
  };
  try {
    spindle.rpcPool?.sync?.(CHAPTER_KEY, payload, { requires: [] });
  } catch (err) {
    warn(`failed to publish chapter_created: ${describeError(err)}`);
  }
}

export function publishArcCreated(userId: string, event: Omit<ArcCreatedEvent, "createdAt">): void {
  const payload: ArcCreatedEvent & { userId: string } = {
    ...event,
    createdAt: Date.now(),
    userId,
  };
  try {
    spindle.rpcPool?.sync?.(ARC_KEY, payload, { requires: [] });
  } catch (err) {
    warn(`failed to publish arc_created: ${describeError(err)}`);
  }
}
