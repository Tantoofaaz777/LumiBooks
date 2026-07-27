import { storyOrderOf } from "./story-order";
import type { LMBEntry } from "./world-book";

function compareChronologically(left: LMBEntry, right: LMBEntry): number {
  const orderDifference = storyOrderOf(left) - storyOrderOf(right);
  if (orderDifference !== 0) return orderDifference;

  const createdDifference = left.meta.createdAt - right.meta.createdAt;
  if (createdDifference !== 0) return createdDifference;

  return left.raw.id.localeCompare(right.raw.id);
}

export function selectPreviousContextEntries(
  allEntries: LMBEntry[],
  activeEntries: LMBEntry[],
  limit: number,
  replacesEntryId?: string,
): LMBEntry[] {
  const count = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  if (count === 0) return [];

  let anchorOrder = Number.POSITIVE_INFINITY;
  if (replacesEntryId) {
    const replacedEntry = allEntries.find((entry) => entry.raw.id === replacesEntryId);
    if (!replacedEntry) return [];
    anchorOrder = storyOrderOf(replacedEntry);
  }

  return activeEntries
    .filter((entry) => entry.raw.id !== replacesEntryId)
    .filter((entry) => storyOrderOf(entry) < anchorOrder)
    .filter((entry) => (entry.raw.content || "").trim().length > 0)
    .slice()
    .sort(compareChronologically)
    .slice(-count);
}
