# LumiBooks - quirks and learnings

Hard-won facts about the Spindle surface and the LumiBooks architecture. Read
this before you change anything that looks load-bearing.

## 1. `spindle.chat.*` does NOT take userId positionally

`spindle.chat.getMessages(chatId)`, `setMessageHidden`, and `setMessagesHidden`
are typed with three or fewer args. Only `chats.*`, `connections.*`,
`world_books.*`, `characters.*`, and `userStorage.*` accept userId. The host
resolves userId from the chat record for the `chat.*` family.

Lesson: do not paste a `userId` argument into a chat-mutation call. Verify the
signature in `node_modules/lumiverse-spindle-types/src/spindle-api.ts` before
adding a new spindle call.

## 2. The interceptor `context` has no userId

The interceptor receives `(messages, context)` where `context` is `unknown` and
does not carry user identity. We populate a `chatId -> userId` map from every
inbound frontend message and from every event we successfully handle, then
`resolveUserId(chatId)` reads from it. If the map is empty we pass through
without injection rather than guess.

## 3. `hidden` flag does NOT exclude from prompt assembly

The `hidden` flag on messages only excludes them from chat-memory embeddings.
It is the same field the chat UI's "exclude from context" toggle controls.
Splicing covered messages out of the assembled prompt has to happen inside the
interceptor. We sync both flags so the user has a visual signal that the
message has been compressed.

## 4. `generate.raw()` returns `Promise<unknown>` in 0.4.74

The current type for `spindle.generate.raw` is untyped. We cast the result to
a local `GenerationRawResult` shape so we can read `content` and `usage`.
There is also no `reasoning` field on the request DTO in this version, so we
drop it. When the types ship newer fields we can opt back in.

## 5. `ctx.components` does NOT exist in 0.4.74

`SpindleComponentsHelper` (the shared form-component mount API) is only on the
local dev fork in `G:\mousepad_git\lumiverse-spindle-types`. The npm-published
0.4.74 doesn't expose it. We build all form controls as raw HTML inputs styled
with Lumiverse CSS variables, matching how Hone and LoreRecall ship.

## 6. World book entries are the source of truth

We do not maintain a separate database of which chapters/arcs exist. Deleting
or renaming an entry in the world book editor removes it from LumiBooks' world
view on the next state read. Coverage is recomputed from entries every time,
so renaming an arc puts its source chapters back in the "Make" tab
automatically.

## 7. Arcs supersede chapters via two redundant signals

When an arc is created, we both set `supersededByEntryId` on each source
chapter's `extensions.lumibooks` meta, and we keep the arc's
`sourceChapterEntryIds` list intact. Coverage walks both signals. The redundant
encoding makes the world book robust to manual edits and tolerant of partial
state when a chapter is moved between books.

## 8. Retry policy is stateless

There is no retry queue. The pipeline retries N times inline. If all N fail,
the last failure is recorded, a toast fires, the user sees a "Retry" button in
the Books tab, and the next `MESSAGE_SENT` (assistant) event re-attempts the
oldest uncompressed window automatically. The same chat window keeps trying
until it succeeds, then the queue moves on. No tracking required because the
"work to do" is implicit in the uncompressed tail length.

## 9. Toast surface is undocumented in the installed types

`spindle.toast.{success,warning,error,info}` exists at runtime in current
Lumiverse but is not on the typed `SpindleAPI`. We cast it via
`(spindle as unknown as ...).toast` and degrade silently if missing. The
frontend mirrors the same toasts through `BackendToFrontend` so the message is
never lost even when the host surface isn't available.

## 10. Memoria's short comment has random-letter constraints per turn

To get diversity under a stateless prompt we ask Memoria for a one-sentence
nyandere short comment whose first word starts with a random letter X and
which contains a word starting with a different random letter Y. The letters
are picked fresh each LLM call and substituted into the prompt via
`{{memoria_short_comment_rules}}`.

## 11. STMB preset import is forgiving

The STMB export format `{ version, overrides: { key: { displayName?, prompt } } }`
is read leniently. Missing `displayName` falls back to the key. Missing
`prompt` rejects the entry. Keys are sanitized and prefixed with the import
category so chapter and arc presets do not collide.

## 12. Splice fingerprint matches by role + trimmed content

The assembled LLM messages do not carry chat message IDs, so the interceptor
matches host-assembled messages to chat history by `role::trim(content)`.
Preset blocks that radically rewrite a message body will break this match. The
fallback is to prepend the entry as a system block after the leading system
section, so the chapter never silently vanishes.

## 13. Built-in presets ship verbatim from STMB

The chapter and arc prompts in `src/backend/presets.ts` are STMB's text. Keep
them in sync if STMB updates. The only structural change LumiBooks adds is a
`short_comment` field in the requested JSON for Memoria's per-scene remark.

## 14. Pending previews live in memory only

When `showMemoryPreviews` is on, drafts live in a per-user, per-chat in-memory
map. They are not persisted. A backend reload drops any in-flight previews and
the user has to re-trigger. This is intentional: previews are cheap to
regenerate and persisting half-finished memories invites stale state.

## 15. Sampler set persists with the profile, not the connection

Samplers are saved on the profile via the dedicated `save_samplers` IPC
message, fired on blur. Switching the connection does not reset them. This
mirrors how Hone treats its sampler block.
