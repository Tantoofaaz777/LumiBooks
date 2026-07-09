declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { LMBSettings } from "../shared";
import { bookNameFor } from "../shared";
import { describeError, warn } from "./runtime";

export type EntryNameTier = "chapter" | "arc" | "volume";

export interface EntryNameContext {
  chatId: string;
  userId: string;
  tier: EntryNameTier;
  title: string;
  sceneNumber: number;
  storyOrder?: number;
  firstMsgIdx?: number;
  lastMsgIdx?: number;
  sourceCount?: number;
  turnCount?: number;
  isRoot?: boolean;
}

interface TemplateContext extends EntryNameContext {
  chatName?: string | null;
}

const LOCAL_MACRO_RE = /\{\{\s*([a-zA-Z][\w-]*)\s*\}\}/g;

export function sceneRange(firstMsgIdx?: number, lastMsgIdx?: number): string {
  if (typeof firstMsgIdx === "number" && typeof lastMsgIdx === "number" && lastMsgIdx >= firstMsgIdx) {
    return `${firstMsgIdx + 1}-${lastMsgIdx + 1}`;
  }
  if (typeof firstMsgIdx === "number") return String(firstMsgIdx + 1);
  return "";
}

export function savedMemoryContent(content: string): string {
  return content.trim();
}

export async function formatEntryName(settings: LMBSettings, ctx: EntryNameContext): Promise<string> {
  const template = ctx.tier === "volume"
    ? settings.volumeNameTemplate
    : ctx.tier === "arc"
      ? settings.arcNameTemplate
      : settings.chapterNameTemplate;
  const fallback = fallbackEntryName(ctx);
  return resolveTemplate(template, ctx, fallback);
}

export async function formatBookName(
  settings: LMBSettings,
  chatId: string,
  userId: string,
  chatName: string | null | undefined,
): Promise<string> {
  return resolveTemplate(
    settings.bookNameTemplate,
    {
      chatId,
      userId,
      tier: "chapter",
      title: chatName?.trim() || chatId.slice(0, 8),
      sceneNumber: 1,
      chatName,
    },
    bookNameFor(chatName, chatId),
  );
}

async function resolveTemplate(template: string, ctx: TemplateContext, fallback: string): Promise<string> {
  const local = applyLocalMacros(template, ctx).trim();
  const candidate = local || fallback;
  try {
    const resolved = await spindle.macros.resolve(candidate, {
      chatId: ctx.chatId,
      userId: ctx.userId,
      commit: false,
    });
    return resolved.text.trim() || fallback;
  } catch (err) {
    warn(`name macro resolve failed: ${describeError(err)}`);
    return candidate;
  }
}

function applyLocalMacros(template: string, ctx: TemplateContext): string {
  const range = sceneRange(ctx.firstMsgIdx, ctx.lastMsgIdx);
  const chatLabel = ctx.chatName?.trim() || ctx.chatId.slice(0, 8);
  const values: Record<string, string> = {
    scene: range || String(ctx.sceneNumber),
    scenenumber: String(ctx.sceneNumber),
    scenenumberpadded: pad3(ctx.sceneNumber),
    padded: pad3(ctx.sceneNumber),
    storyorder: typeof ctx.storyOrder === "number" ? String(ctx.storyOrder) : String(ctx.sceneNumber),
    storyorderpadded: pad3(typeof ctx.storyOrder === "number" ? ctx.storyOrder : ctx.sceneNumber),
    title: ctx.title.trim() || fallbackTitle(ctx),
    tier: ctx.tier,
    chat: chatLabel,
    chatname: chatLabel,
    rootprefix: ctx.isRoot ? "[Root] " : "",
    turns: typeof ctx.turnCount === "number" ? String(ctx.turnCount) : "",
    sources: typeof ctx.sourceCount === "number" ? String(ctx.sourceCount) : "",
  };
  return template.replace(LOCAL_MACRO_RE, (match, key: string) => {
    const value = values[key.toLowerCase()];
    return value === undefined ? match : value;
  });
}

function fallbackEntryName(ctx: EntryNameContext): string {
  const prefix = ctx.isRoot ? "[Root] " : "";
  const title = ctx.title.trim() || fallbackTitle(ctx);
  const range = sceneRange(ctx.firstMsgIdx, ctx.lastMsgIdx);
  const suffix = range ? ` (msgs ${range})` : "";
  if (ctx.tier === "chapter") return `#${ctx.sceneNumber} - ${title}${suffix}`;
  if (ctx.tier === "arc") return `${prefix}Arc #${ctx.sceneNumber} - ${title}${suffix}`;
  return `${prefix}Volume #${ctx.sceneNumber} - ${title}${suffix}`;
}

function fallbackTitle(ctx: Pick<EntryNameContext, "tier">): string {
  if (ctx.tier === "volume") return "Volume";
  if (ctx.tier === "arc") return "Arc";
  return "Chapter";
}

function pad3(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(3, "0");
}
