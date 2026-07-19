# Video list & detail: duration, rename, soft delete, richer detail, reuse

**Date:** 2026-07-19
**Status:** approved, ready for planning

## Problem

Four gaps in the video list and detail screens:

1. The list card shows the aspect ratio (`9:16`) — the same value on every card, so it carries no
   information. Duration is what distinguishes one video from another.
2. A video's title is derived automatically at creation and can never be corrected. There is no way
   to remove a video at all.
3. The detail screen shows only ratio, duration and created-at. It cannot answer "which avatar and
   voice did I use for this one?" — the question you ask right before making a similar video.
4. Making a follow-up video means re-picking the avatar, voice, caption style, layout, music and SFX
   from scratch, even when the only thing changing is the script.

## Decisions

| Question | Decision |
|---|---|
| Duration while processing/failed | Show nothing. No estimates, no fallback to ratio. |
| Reuse scope | Settings only — script and media start empty. |
| Delete semantics | Soft delete (`deleted_at`), hidden from list and detail. |
| Delete confirmation | Second tap on the button, not a modal. |
| Detail sections | All four: settings, script, B-roll, layout/music/SFX/credits. |
| Reuse mechanism | URL param `?reuse=<id>`, server as source of truth. |
| Rename/delete API | Two narrow routes; the draft-gated `PATCH /videos/:id` is untouched. |

## Existing code this builds on

- `videos.duration_s` is **already computed and persisted** — `_ffprobe_duration()` at
  `apps/worker/sentezy_worker/pipeline.py:23-32`, written via `db.set_ready()`
  (`apps/worker/sentezy_worker/db.py:72-77`). It is already returned by `GET /videos`. Showing it on
  the card needs no backend change.
- `GET /videos/:id` already returns `brollMedia` with signed URLs
  (`apps/api/src/routes/videos.ts:76-99`); `queries.ts` types it and the UI never renders it.
- `Video.avatar` and `Video.voice` relations exist (`schema.prisma:103-104`) but no route includes
  them.
- `options` round-trips 1:1 with composer state — `background.media`, `captions`, `layout`, `music`,
  `voice.emotion`, `effects`, `sfx` map back to the exact state
  `MediaComposer.create()` builds them from (`MediaComposer.tsx:255-290`).
- Catalog avatars expose `id = imageKey` (`apps/api/src/routes/avatars.ts:37`), and that same key is
  stored as `Avatar.sourceImageId`. This is what makes avatar reuse resolvable.

## 1. Data model

Add to `Video` in `packages/db/prisma/schema.prisma`:

```prisma
deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)
```

Migration adds the nullable column. No backfill — existing rows are `NULL`, i.e. not deleted.

## 2. API — `apps/api/src/routes/videos.ts`

**Modified**

- `GET /videos` — add `deletedAt: null` to the `where`.
- `GET /videos/:id` — add `deletedAt: null`; add `include: { avatar: true, voice: true }`.
  Return an `avatar` object `{ id, name, imageUrl }` and a `voice` object
  `{ id, label, gender, style }`.
  `Avatar.sourceImageId` is the **green-screen** key — rendering it directly shows a green
  rectangle. Resolve it to the matted thumbnail:
  `catalogAvatar.findFirst({ where: { imageKey: avatar.sourceImageId } })` → sign `displayImageKey`,
  falling back to the source key when no catalog row matches (uploaded avatars).

**New**

- `PATCH /videos/:id/title` — body `{ title: string }`, 1–120 chars, trimmed. Works at any status.
  Ownership-scoped `findFirst({ id, userId, deletedAt: null })` → 404. Returns the updated video.
- `DELETE /videos/:id` — sets `deletedAt = now()`. Ownership-scoped. Returns 204 on success; an
  unknown id, another user's video, or an already-deleted one returns 404. This is deliberately
  *not* idempotent — a repeat call 404s, because the ownership lookup filters `deletedAt: null`
  like every other read. The UI never issues a second delete (it navigates away on success), and
  a 404 is the correct answer to "delete a video that isn't there".

The existing `PATCH /videos/:id` keeps its `409 not_a_draft` gate (`videos.ts:197`). A title-only
route cannot mutate `script`, `avatarId`, `aspectRatio` or `options` on a video whose render already
consumed them; relaxing the shared endpoint's gate could.

## 3. Web data layer — `apps/web/src/lib/queries.ts`

- `useRenameVideo()` → `PATCH /videos/:id/title`; invalidates `qk.video(id)` and `qk.videos`.
- `useDeleteVideo()` → `DELETE /videos/:id`; invalidates `qk.videos`; caller navigates to
  `/library`.
- `VideoDetailData` gains `avatar` and `voice`.
- `ApiVideo` (`lib/types.ts:4-16`) gains `script` and `options`, which the API already returns but
  the type never declared — `videoTitle.ts:21` currently reads `options` untyped.

## 4. UI

### 4.1 Shared `VideoCard`

`LibraryView.tsx:31-63` and `RecentVideos.tsx:36-66` contain the same card markup. Extract
`apps/web/src/components/VideoCard.tsx` and use it in both.

The metadata row keeps the date on the left. The right slot shows
`formatDuration(v.durationS)` when `status === "ready"`, and renders nothing otherwise — the date
holds the row height, so there is no layout shift when a render completes.

New helper beside `formatRatio` in `lib/types.ts`:

```
formatDuration(null)  === ""
formatDuration(0)     === ""
formatDuration(28.4)  === "0:28"
formatDuration(65)    === "1:05"
formatDuration(600)   === "10:00"
```

Seconds round to nearest; minutes are unpadded, seconds zero-padded to 2.
`durationS` is a Prisma `Decimal` — verify the JSON shape reaching the client is a number and
coerce defensively.

### 4.2 Detail screen — `VideoDetail.tsx`

Header gains inline title editing (pencil → input → save/cancel, optimistic) and a `Sil` button that
becomes `Emin misiniz?` on first tap and performs the delete on second, reverting after ~4s.

Four sections below the player:

- **Ayarlar** — avatar thumbnail + name, voice label, caption preset name, emotion label.
- **Metin** — `video.script` with `[tag]` markers stripped for readability.
- **Görseller** — `brollMedia` thumbnails, with a count of images vs videos.
- **Detaylar** — existing ratio / duration / created, plus layout (avatar placement, caption
  position), music track and volume, SFX on/off and cue count, and credits cost.

A `Yeniden kullan` button routes to `/dashboard?reuse=<id>`.

Sections render only when their data exists, so drafts and failed videos degrade cleanly.

### 4.3 Reuse seeding — `MediaComposer.tsx`

The composer currently initialises every field to a hardcoded constant (`MediaComposer.tsx:50-70`)
and has no prefill path.

`DashboardHome` reads `useSearchParams()`. When `reuse` is present it fetches the video with the
existing `useVideo` hook and hydrates the composer **once**, behind a ref guard so later renders
don't clobber user edits.

Carried over: avatar, voice, caption preset, emotion, layout, music, SFX enabled, transition SFX,
aspect ratio. Left empty: script, B-roll media, SFX cues.

Mapping runs through a pure function so it is testable without React:

```ts
optionsToComposerState(video, catalogAvatars) →
  { selectedAvatar, selectedVoice, captionId, settings }
```

- **Avatar** — `video.avatar.sourceImageId` matched against catalog `imageKey`. No match (deleted
  from catalog, or an uploaded avatar) → leave unselected rather than guess.
- **Voice** — `{ id: video.voiceId, label: video.voice.label }`. `POST /voices/adopt` accepts a DB
  uuid and passes it through (`lib/voices.ts` `resolveVoice`), so no re-adoption is needed.
- **Caption preset** — see below.

Not affected: the `useEffect` at `MediaComposer.tsx:95-97` clears `sfxCues` when `script` changes.
Because reuse leaves the script empty, it never fires against seeded state.

### 4.4 Caption preset round-trip

`options.captions` stores `{ style, font, color }`; the composer keys presets by `id`. Reuse must
map back.

Write `captions.presetId` into `options` at creation going forward. For videos created before this
change, fall back to matching `style + font + color` against the preset table. If neither resolves,
fall back to `DEFAULT_PRESET`.

Without this, reuse silently applies the wrong caption style to every existing video.

## 5. Error handling

- Rename with an empty or whitespace-only title → disable save; do not send.
- Rename/delete on a video owned by someone else or already deleted → 404; the UI invalidates
  `qk.videos` and returns to `/library`.
- Deleting the video currently open → navigate to `/library` after success.
- Reuse of a missing/deleted video → composer loads with defaults and shows a non-blocking notice
  rather than an error screen.
- Avatar catalog lookup failure → avatar renders as a name without a thumbnail.

## 6. Testing

The repo has no JS test runner — a single `packages/remotion/src/reel/timing.test.ts` and no `test`
script in any `package.json`. This adds vitest to `apps/web` for pure functions only:

- `formatDuration` — the table in 4.1, including `null`, `0`, sub-minute, and ≥10 minutes.
- Caption preset reverse-lookup — new `presetId` path, legacy `style+font+color` path, and the
  unresolvable fallback.
- `optionsToComposerState` — a full round-trip: take an `options` object built by
  `MediaComposer.create()`, map it back, and assert the settings match; plus the
  avatar-not-in-catalog and voice-missing cases.

API routes are verified by hand. Standing up API integration tests is larger infrastructure than
this feature justifies, and is called out here as a known gap rather than silently skipped.

## 7. Known follow-up work

**Soft-deleted videos keep their R2 objects forever.** This design deliberately trades storage for
recoverability, and there is no purge job and no restore UI — recovering a video means clearing
`deleted_at` by hand. A purge job (delete R2 objects for rows soft-deleted more than N days ago)
should be a separate piece of work. The same class of problem already exists in this repo: 66
orphaned avatar portraits sit in R2 with nothing pointing at them.

## Out of scope

- Restore-from-deleted UI.
- Editing anything other than the title after render.
- Per-card actions in the list (the whole card is a `<Link>`; adding buttons means restructuring it).
- Pagination for `GET /videos`.
