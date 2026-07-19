# Video Detail & Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show duration instead of aspect ratio on video cards, let a user rename and soft-delete a video, show its full settings on the detail screen, and reuse those settings for a new video.

**Architecture:** Three layers, bottom-up. Prisma gains a `deleted_at` column; the API gains two narrow routes (`PATCH /videos/:id/title`, `DELETE /videos/:id`) and returns the avatar/voice relations on the detail route; the web app extracts a shared `VideoCard`, adds detail sections, and seeds the composer from `?reuse=<id>` through pure, tested mapping functions.

**Tech Stack:** Next.js 15 (App Router, React 19), TanStack Query, Fastify 5, Prisma, Zod, Tailwind. Tests are standalone `node:assert` scripts run via `pnpm --filter @sentezy/api exec tsx` — no test framework is added.

## ⚠️ Blocked on the composer settings cleanup — read first

**Do not start this plan until `docs/superpowers/plans/2026-07-19-composer-settings-cleanup.md`
is complete.** That plan (executing in the worktree `.claude/worktrees/composer-settings-cleanup`)
rewrites the settings model this one reads, and this plan has been revised to target its
*post-cleanup* state. Running it first would encode a model that is being deleted.

| Contract | Post-cleanup value |
|---|---|
| `ComposerSettings` | `{ avatarPosition, captionPosition, voiceEmotion, transitionSfx }` — four fields |
| `DEFAULT_SETTINGS` | `{ avatarPosition: "right", captionPosition: "bottom", voiceEmotion: "", transitionSfx: true }` |
| `ReelOptions.layout` | `{ avatarPosition: "left"\|"center"\|"right"; captionPosition: "top"\|"bottom" }` |
| Legacy layout blobs | read forward by `readAvatarPosition(layout)`, exported from `@sentezy/types` |
| `aspectRatio` | **gone** from UI + payload (the DB column and enum stay) |
| AI sound effects | **deleted end to end** — no `options.sfx`, no cues, no UI |
| Music | lives in `MediaComposer` state (`selectedMusic: MusicTrack \| null`, `musicVolume`), **not** in `ComposerSettings`; still written as `options.music = { trackKey, volume }` |

**File collision warning.** That plan edits `apps/web/src/lib/queries.ts`,
`apps/web/src/components/MediaComposer.tsx` and `apps/web/src/components/composer/SettingsDrawer.tsx`
heavily. Tasks 6, 9 and 10 below touch the first two. Re-read those files before editing —
the line references here were taken from the pre-cleanup versions.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-19-video-detail-reuse-design.md`.
- **TS tests are standalone `node:assert` scripts.** There is no vitest or jest in this repo and
  none may be added — follow `packages/remotion/src/reel/timing.test.ts`: top-level asserts,
  **relative** imports (the `@/` alias does not resolve under bare `tsx`), and
  `console.log("<path> ok")` as the last line.
- **Run them with `pnpm --filter @sentezy/api exec tsx <ABSOLUTE path>`.** Verified 2026-07-19:
  plain `npx tsx` fails from the repo root with `tsx: command not found` — no root-level `tsx` bin
  exists, it is only a devDependency of `@sentezy/api`. `pnpm --filter … exec` runs in that
  package's directory, so the test path must be absolute.
- All user-facing copy is **Turkish**, matching existing strings (`Videolarım`, `İndir`, `Hazır`).
- Every API route is ownership-scoped by `req.user!.id`. Never trust an id from the client alone.
- The existing draft-gated `PATCH /videos/:id` (`apps/api/src/routes/videos.ts:189`) must keep its
  `409 not_a_draft` behaviour. Do not relax it.
- Reuse carries **settings only** — script and B-roll media stay empty.
- Duration renders **only** when `status === "ready"`; never an estimate, never a ratio fallback.
- Run `pnpm --filter @sentezy/web typecheck` and `pnpm --filter @sentezy/api typecheck` before every
  commit that touches those apps.
- Do not commit unless the plan step says to. (Berkan reviews before committing.)

## Deviation from the spec — read before Task 8

The spec (§4.4) says to write `captions.presetId` into `options` and fall back to matching
`style + font + color` for old videos. **This plan does not do that.** Preset ids are *deterministic*
— built as `` `${base}-${slug(font)}-${slug(color)}` `` for accent families and `` `${base}-${slug(font)}` ``
for non-accent ones (`apps/web/src/lib/captionStyles.ts:38-60`). The id is therefore derivable from
what `options.captions` already stores, so no new field and no legacy path is needed, and it works
for **every existing video** rather than only new ones. Colour hexes and font names slug uniquely, so
there is no collision risk. Task 8 implements the derivation.

## File Structure

**Create**
- `apps/web/src/lib/duration.ts` — `formatDuration`. One job: seconds → `m:ss`.
- `apps/web/src/lib/duration.test.ts`
- `apps/web/src/components/VideoCard.tsx` — the card markup shared by library + dashboard.
- `apps/web/src/lib/reuse.ts` — `presetIdFor`, `optionsToComposerState`. Pure, no React.
- `apps/web/src/lib/reuse.test.ts`

**Modify**
- `packages/db/prisma/schema.prisma` — `deletedAt` on `Video`.
- `apps/api/src/routes/videos.ts` — filtering, two new routes, detail relations.
- `apps/web/src/lib/types.ts` — `ApiVideo` gains `script`/`options`.
- `apps/web/src/lib/queries.ts` — `VideoDetailData` gains `avatar`/`voice`; two mutations.
- `apps/web/src/components/LibraryView.tsx`, `RecentVideos.tsx` — use `VideoCard`.
- `apps/web/src/components/VideoDetail.tsx` — title edit, delete, reuse, four sections.
- `apps/web/src/components/DashboardHome.tsx`, `MediaComposer.tsx` — reuse seeding.

---

### Task 1: `formatDuration`

**Files:**
- Create: `apps/web/src/lib/duration.ts`
- Test: `apps/web/src/lib/duration.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `formatDuration(seconds: number | null | undefined): string`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/duration.test.ts` — a standalone `node:assert` script, matching
`packages/remotion/src/reel/timing.test.ts`. Import **relatively**: bare `tsx` does not resolve the
`@/` alias.

```ts
import assert from "node:assert";
import { formatDuration } from "./duration";

// Nothing to show → an empty slot, never a placeholder or an invented value.
assert.strictEqual(formatDuration(null), "");
assert.strictEqual(formatDuration(undefined), "");
assert.strictEqual(formatDuration(0), "");

// Sub-minute durations keep a leading zero minute.
assert.strictEqual(formatDuration(28.4), "0:28");
assert.strictEqual(formatDuration(9), "0:09");

// Minutes unpadded, seconds padded to two digits.
assert.strictEqual(formatDuration(65), "1:05");
assert.strictEqual(formatDuration(600), "10:00");

// Rounds to the nearest second, carrying into the minute.
assert.strictEqual(formatDuration(59.6), "1:00");

// videos.duration_s is a Prisma Decimal and can arrive as a string over JSON.
assert.strictEqual(formatDuration("28.4" as unknown as number), "0:28");

console.log("apps/web/src/lib/duration.test.ts ok");
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @sentezy/api exec tsx /Users/berkan/Projects/sentezy/apps/web/src/lib/duration.test.ts`
Expected: FAIL — `Cannot find module './duration'`.

- [ ] **Step 3: Implement**

`apps/web/src/lib/duration.ts`:

```ts
/** Render a video's duration as m:ss. Empty string when there is nothing to show —
 *  the card leaves the slot blank rather than inventing a value.
 *  `durationS` is a Prisma Decimal, which can arrive as a string over JSON. */
export function formatDuration(seconds: number | null | undefined): string {
  const n = typeof seconds === "string" ? Number.parseFloat(seconds) : seconds;
  if (n === null || n === undefined || !Number.isFinite(n) || n <= 0) return "";
  const total = Math.round(n);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter @sentezy/api exec tsx /Users/berkan/Projects/sentezy/apps/web/src/lib/duration.test.ts`
Expected: `apps/web/src/lib/duration.test.ts ok`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/duration.ts apps/web/src/lib/duration.test.ts
git commit -m "feat(web): add formatDuration for video cards"
```

---

### Task 2: Shared `VideoCard` showing duration

`LibraryView.tsx:31-63` and `RecentVideos.tsx:36-66` contain byte-identical card markup. Extract it
once, then change the metadata row in one place.

**Files:**
- Create: `apps/web/src/components/VideoCard.tsx`
- Modify: `apps/web/src/components/LibraryView.tsx:31-63`
- Modify: `apps/web/src/components/RecentVideos.tsx:36-66`

**Interfaces:**
- Consumes: `formatDuration` from Task 1.
- Produces: `<VideoCard video={ApiVideo} />`.

- [ ] **Step 1: Create the component**

`apps/web/src/components/VideoCard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { formatDuration } from "@/lib/duration";
import { STATUS_LABEL, type ApiVideo } from "@/lib/types";
import { videoDisplayTitle } from "@/lib/videoTitle";

/** One video tile — used by both the library grid and the dashboard "son videolar" strip.
 *  The metadata row shows the duration only once a render is ready; while processing the
 *  slot stays empty (the date holds the row height, so nothing shifts when it lands). */
export function VideoCard({ video }: { video: ApiVideo }) {
  const [label, cls] = STATUS_LABEL[video.status];
  const duration = video.status === "ready" ? formatDuration(video.durationS) : "";

  return (
    <Link href={`/videos/${video.id}`} className="card overflow-hidden transition hover:-translate-y-0.5">
      <div className="ph-stripe relative aspect-[9/16]">
        {video.thumbnailUrl && (
          <img src={video.thumbnailUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <span className={`badge ${cls} absolute left-2.5 top-2.5`}>
          <span className="dot" />
          {label}
        </span>
      </div>
      <div className="p-3">
        <p className="truncate text-[13.5px] font-semibold text-ink">{videoDisplayTitle(video)}</p>
        <div className="mt-1 flex items-center justify-between text-[12px] text-muted">
          <span>{new Date(video.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</span>
          <span className="mono">{duration}</span>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Use it in the library grid**

In `apps/web/src/components/LibraryView.tsx`, replace the whole `{videos.map(...)}` block
(lines 33-61) with:

```tsx
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
```

Then fix the imports at the top — `formatRatio` and `STATUS_LABEL` and `videoDisplayTitle` are no
longer used there:

```tsx
import Link from "next/link";
import { VideoCard } from "@/components/VideoCard";
import { useVideos } from "@/lib/queries";
```

(`Link` stays — it is still used by the two "+ Yeni video" buttons.)

- [ ] **Step 3: Use it in the dashboard strip**

In `apps/web/src/components/RecentVideos.tsx`, replace the whole `{recent.map(...)}` block
(lines 38-65) with:

```tsx
      {recent.map((v) => (
        <VideoCard key={v.id} video={v} />
      ))}
```

and replace the imports with:

```tsx
import { VideoCard } from "@/components/VideoCard";
import { useVideos } from "@/lib/queries";
```

(`Link` is no longer used in this file — remove it.)

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @sentezy/web typecheck`
Expected: no errors. An "unused import" error means a leftover import in step 2 or 3.

- [ ] **Step 5: Verify in the browser**

Run the web app, open `/library`. A ready video shows e.g. `0:28` where `9:16` used to be; a
processing one shows nothing on the right. Both the library and the dashboard strip look identical
to before apart from that slot.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/VideoCard.tsx apps/web/src/components/LibraryView.tsx apps/web/src/components/RecentVideos.tsx
git commit -m "feat(web): show duration on video cards via a shared VideoCard"
```

---

### Task 3: `deletedAt` column and read filtering

Adding the column and hiding deleted rows is safe on its own — nothing can set `deletedAt` yet, so
behaviour is unchanged. The route that writes it comes in Task 4.

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (`Video` model, ~line 84-110)
- Modify: `apps/api/src/routes/videos.ts:40-56` (list), `:58-60` (detail)

**Interfaces:**
- Produces: `Video.deletedAt: DateTime | null`; both read routes exclude non-null rows.

- [ ] **Step 1: Add the column**

In `packages/db/prisma/schema.prisma`, inside `model Video`, directly after the `error` field:

```prisma
  deletedAt         DateTime? @map("deleted_at") @db.Timestamptz(6)
```

- [ ] **Step 2: Generate the migration**

```bash
cd packages/db && pnpm prisma migrate dev --name add_video_deleted_at
```

Expected: a new folder under `packages/db/prisma/migrations/` containing
`ALTER TABLE "videos" ADD COLUMN "deleted_at" TIMESTAMPTZ;` and a regenerated client. No backfill —
existing rows are `NULL`, meaning "not deleted".

- [ ] **Step 3: Filter the list route**

In `apps/api/src/routes/videos.ts`, in `GET /videos` (line ~41):

```ts
      where: { userId: req.user!.id, deletedAt: null },
```

- [ ] **Step 4: Filter the detail route**

In `GET /videos/:id` (line ~60):

```ts
    const video = await prisma.video.findFirst({ where: { id, userId: req.user!.id, deletedAt: null } });
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @sentezy/api typecheck`
Expected: no errors.

- [ ] **Step 6: Verify nothing changed**

Start the API, load `/library`. Every video still appears — no row has `deleted_at` set yet.

- [ ] **Step 7: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations apps/api/src/routes/videos.ts
git commit -m "feat(db): add videos.deleted_at and exclude deleted rows from reads"
```

---

### Task 4: Rename and soft-delete routes

**Files:**
- Modify: `apps/api/src/routes/videos.ts` (add after the existing `PATCH /videos/:id`, ~line 221)

**Interfaces:**
- Consumes: `deletedAt` from Task 3.
- Produces: `PATCH /videos/:id/title` → `{ video }`; `DELETE /videos/:id` → 204.

- [ ] **Step 1: Add the body schema**

Near the other local schemas at the top of `apps/api/src/routes/videos.ts` (after
`SuggestSfxBody`, ~line 19):

```ts
const UpdateVideoTitle = z.object({ title: z.string().trim().min(1).max(120) });
```

- [ ] **Step 2: Add the rename route**

Insert directly after the closing `});` of the existing `PATCH /videos/:id` handler:

```ts
  // Rename a video at ANY status. Deliberately separate from PATCH /videos/:id, which is
  // draft-only: a rendered video's script/avatar/options were already consumed by the
  // render, so a title-only route is the safe way to allow the one edit that stays valid.
  app.patch("/videos/:id/title", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = UpdateVideoTitle.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const existing = await prisma.video.findFirst({ where: { id, userId: req.user!.id, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    const video = await prisma.video.update({ where: { id }, data: { title: parsed.data.title } });
    return { video };
  });

  // Soft delete — the row is hidden from every read, the R2 objects are deliberately kept.
  // A repeat call 404s because the ownership lookup filters deletedAt like all other reads.
  app.delete("/videos/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.video.findFirst({ where: { id, userId: req.user!.id, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    await prisma.video.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.code(204).send();
  });
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @sentezy/api typecheck`
Expected: no errors.

- [ ] **Step 4: Verify by hand**

With the API running and a valid token in `$TOKEN` and a video id in `$VID`:

```bash
curl -s -X PATCH "http://localhost:8080/videos/$VID/title" \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"title":"Yeniden adlandırıldı"}' | head -c 200
```
Expected: JSON containing `"title":"Yeniden adlandırıldı"`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH "http://localhost:8080/videos/$VID/title" \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" -d '{"title":""}'
```
Expected: `400`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE "http://localhost:8080/videos/$VID" -H "authorization: Bearer $TOKEN"
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE "http://localhost:8080/videos/$VID" -H "authorization: Bearer $TOKEN"
```
Expected: `204` then `404`. Confirm the video no longer appears in `GET /videos`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/videos.ts
git commit -m "feat(api): add title rename and soft-delete routes for videos"
```

---

### Task 5: Return avatar and voice on the detail route

`Avatar.sourceImageId` holds the catalog avatar's **green-screen** key. Rendering it directly would
show a green rectangle, so resolve it to the matted thumbnail. Returning it already shaped like the
composer's `Avatar` type means Task 9 needs no client-side catalog matching.

**Files:**
- Modify: `apps/api/src/routes/videos.ts:58-102` (`GET /videos/:id`)

**Interfaces:**
- Produces: detail response gains `avatar` and `voice`, shaped to satisfy the composer's
  `Avatar` and `Voice` types verbatim (`apps/web/src/components/wizard/types.ts:6-20,35-46`) so
  Task 10 can assign them with no cast and no client-side catalog lookup:
  - `avatar: { id, slug, name, imageUrl, sector, sectorLabel, gender, age, hijab, ready } | null`
  - `voice: { id, label, gender, style } | null`

- [ ] **Step 1: Include the relations**

Change the lookup in `GET /videos/:id` (from Task 3's version) to:

```ts
    const video = await prisma.video.findFirst({
      where: { id, userId: req.user!.id, deletedAt: null },
      include: { avatar: true, voice: true },
    });
```

- [ ] **Step 2: Build the two payload fields**

Immediately before the route's `return {` statement, add:

```ts
    // avatar.sourceImageId is the green-screen source key — showing it raw renders a green
    // rectangle, so prefer the catalog's matted thumbnail. The catalog row also supplies the
    // sector/gender/age fields the composer's Avatar type requires, which is what lets the
    // reuse seeding assign this straight through. An uploaded avatar has no catalog row, so
    // fill neutral defaults and fall back to the source key for the image.
    let avatarPick: {
      id: string; slug: string; name: string; imageUrl: string; sector: string;
      sectorLabel: string; gender: string; age: string; hijab: boolean; ready: boolean;
    } | null = null;
    if (video.avatar) {
      const catalog = await prisma.catalogAvatar.findFirst({ where: { imageKey: video.avatar.sourceImageId } });
      const key = catalog?.displayImageKey || video.avatar.sourceImageId;
      avatarPick = {
        id: video.avatar.sourceImageId,
        slug: catalog?.slug ?? "",
        name: catalog?.name ?? video.avatar.name,
        imageUrl: key ? await signedDownloadUrl(key, 86400) : "",
        sector: catalog?.sector ?? "",
        sectorLabel: catalog?.sectorLabel ?? "",
        gender: catalog?.gender ?? "kadın",
        age: catalog?.age ?? "yetişkin",
        hijab: catalog?.hijab ?? false,
        ready: Boolean(video.avatar.sourceImageId),
      };
    }
    const voicePick = video.voice
      ? { id: video.voice.id, label: video.voice.label, gender: video.voice.gender, style: video.voice.style }
      : null;
```

- [ ] **Step 3: Add them to the response**

Add to the returned object literal:

```ts
      avatar: avatarPick,
      voice: voicePick,
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @sentezy/api typecheck`
Expected: no errors.

- [ ] **Step 5: Verify by hand**

```bash
curl -s "http://localhost:8080/videos/$VID" -H "authorization: Bearer $TOKEN" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("avatar")); print(d.get("voice"))'
```
Expected: an avatar object whose `imageUrl` is a signed URL, and a voice object with a label. Open
the `imageUrl` — it must be the **matted** cutout, not a green-background image.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/videos.ts
git commit -m "feat(api): return avatar and voice on the video detail route"
```

---

### Task 6: Web types and mutations

**Files:**
- Modify: `apps/web/src/lib/types.ts:4-16`
- Modify: `apps/web/src/lib/queries.ts:9-17` and the mutation section (~line 164)

**Interfaces:**
- Consumes: Tasks 4 and 5.
- Produces: `useRenameVideo()`, `useDeleteVideo()`, `VideoDetailData.avatar`, `.voice`,
  `ApiVideo.script`, `.options`.

- [ ] **Step 1: Extend `ApiVideo`**

In `apps/web/src/lib/types.ts`, add to the `ApiVideo` type (the API has always returned these; the
type simply never declared them):

```ts
  script: string;
  options: Record<string, unknown>;
  creditsCost: number;
```

- [ ] **Step 2: Extend `VideoDetailData`**

In `apps/web/src/lib/queries.ts`, add to the `VideoDetailData` type:

```ts
  avatar?: Avatar | null;
  voice?: Voice | null;
```

`Avatar` and `Voice` are already imported at the top of `queries.ts` from
`@/components/WizardSteps` — reuse those exact types so the seeding in Task 10 needs no cast.

- [ ] **Step 3: Add the mutations**

After `useGenerateVideo()` in `apps/web/src/lib/queries.ts`:

```ts
/** Rename a video at any status (the draft-only PATCH /videos/:id cannot do this). */
export function useRenameVideo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      apiFetch<{ video: ApiVideo }>(`/videos/${id}/title`, { method: "PATCH", body: JSON.stringify({ title }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.video(id) });
      qc.invalidateQueries({ queryKey: qk.videos });
    },
  });
}

/** Soft delete — the row is hidden everywhere; the caller navigates away on success. */
export function useDeleteVideo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>(`/videos/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.videos }),
  });
}
```

- [ ] **Step 4: Check `apiFetch` tolerates a 204**

Open `apps/web/src/lib/api.ts`. If it unconditionally calls `res.json()`, a 204 (empty body) throws.
If so, add an early return before the parse:

```ts
  if (res.status === 204) return undefined as T;
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @sentezy/web typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/queries.ts apps/web/src/lib/api.ts
git commit -m "feat(web): add rename/delete mutations and detail avatar+voice types"
```

---

### Task 7: Detail screen — rename, delete, reuse

**Files:**
- Modify: `apps/web/src/components/VideoDetail.tsx:49-58` (header) and imports

**Interfaces:**
- Consumes: `useRenameVideo`, `useDeleteVideo` from Task 6.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Add imports and state**

Add to the imports in `apps/web/src/components/VideoDetail.tsx`:

```tsx
import { useRouter } from "next/navigation";
import { qk, useDeleteVideo, useRenameVideo, useVideo } from "@/lib/queries";
```

(replacing the existing `qk, useVideo` import line), and inside the component after
`const [liveOverride, setLiveOverride] = useState<Live | null>(null);`:

```tsx
  const router = useRouter();
  const rename = useRenameVideo(id);
  const remove = useDeleteVideo(id);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
```

- [ ] **Step 2: Replace the header block**

Replace lines 52-58 (the `<h1>` and the status badge `<div>`) with:

```tsx
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditing(false);
                  if (e.key === "Enter" && draftTitle.trim()) {
                    rename.mutate(draftTitle.trim(), { onSuccess: () => setEditing(false) });
                  }
                }}
                maxLength={120}
                className="w-full rounded-lg border border-hairline bg-paper px-3 py-1.5 text-[20px] font-semibold text-ink outline-none focus:border-signal"
              />
              <button
                type="button"
                disabled={!draftTitle.trim() || rename.isPending}
                onClick={() => rename.mutate(draftTitle.trim(), { onSuccess: () => setEditing(false) })}
                className="btn btn-primary shrink-0"
              >
                Kaydet
              </button>
              <button type="button" onClick={() => setEditing(false)} className="shrink-0 text-[13.5px] text-muted">
                Vazgeç
              </button>
            </div>
            {rename.isError && (
              <p className="mt-1 text-[12.5px] text-red-600">Başlık kaydedilemedi — video silinmiş olabilir.</p>
            )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftTitle(title);
                setEditing(true);
              }}
              className="disp text-left text-[24px] font-semibold leading-tight text-ink hover:text-signal"
              title="Başlığı düzenle"
            >
              {title}
            </button>
          )}
          <div className="mt-2">
            <span className={`badge ${cls}`}>
              <span className="dot" />
              {label}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(`/dashboard?reuse=${v.id}`)}
            className="inline-flex items-center rounded-full border border-hairline bg-paper px-4 py-2 text-[14px] font-medium text-ink transition hover:bg-mist"
          >
            Yeniden kullan
          </button>
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                setTimeout(() => setConfirmDelete(false), 4000);
                return;
              }
              // A 404 means it is already gone (deleted in another tab) — the destination
              // is the same either way, so treat both outcomes as "leave".
              remove.mutate(undefined, { onSuccess: () => router.push("/library"), onError: () => router.push("/library") });
            }}
            className="inline-flex items-center rounded-full border border-hairline bg-paper px-4 py-2 text-[14px] font-medium text-red-600 transition hover:bg-mist"
          >
            {confirmDelete ? "Emin misiniz?" : "Sil"}
          </button>
        </div>
      </div>
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @sentezy/web typecheck`
Expected: no errors.

- [ ] **Step 4: Verify in the browser**

Open a video's detail page. Click the title → it becomes an input; type and press Enter → the
heading updates and the library shows the new name. Press Escape → the edit is abandoned. Click
`Sil` → it reads `Emin misiniz?`; wait 4s → it reverts to `Sil`. Click it twice → you land on
`/library` and the video is gone. Click `Yeniden kullan` → the URL becomes
`/dashboard?reuse=<id>` (it does nothing yet; Task 10 wires it up).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/VideoDetail.tsx
git commit -m "feat(web): rename, soft-delete and reuse actions on the video detail screen"
```

---

### Task 8: Detail screen — the four information sections

**Files:**
- Modify: `apps/web/src/components/VideoDetail.tsx` (the right-hand column, after the existing spec card)

**Interfaces:**
- Consumes: `detail.avatar`, `detail.voice` (Task 5), `detail.brollMedia` (already returned).
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Add imports**

```tsx
import { readAvatarPosition } from "@sentezy/types";
import { formatDuration } from "@/lib/duration";
import { CAPTION_FAMILIES } from "@/lib/captionStyles";
import { VOICE_EMOTIONS } from "@/components/wizard/constants";
```

- [ ] **Step 2: Derive the values**

After `const ratioClass = ...` in the component body:

```tsx
  const opts = (v.options ?? {}) as {
    captions?: { style?: string; font?: string; color?: string };
    layout?: { avatarPosition?: string; captionPosition?: string };
    music?: { trackKey?: string; volume?: number };
    voice?: { emotion?: string };
  };
  // Videos created before the settings cleanup stored avatarLayout+avatarSide; the shared
  // reader maps those forward, so old and new videos both display correctly.
  const AVATAR_POS_LABEL: Record<string, string> = { left: "Sol", center: "Orta", right: "Sağ" };
  const avatarPos = AVATAR_POS_LABEL[readAvatarPosition(opts.layout)];
  // The detail screen wants a human label, not a preset id — look the family up directly
  // and append the font, e.g. "Vurgu · Poppins".
  const fam = CAPTION_FAMILIES.find((f) => f.key === opts.captions?.style);
  const captionName = fam ? [fam.label, opts.captions?.font].filter(Boolean).join(" · ") : null;
  const emotionLabel = VOICE_EMOTIONS.find((e) => e.value === (opts.voice?.emotion ?? ""))?.label ?? null;
  const scriptText = (v.script ?? "").replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
```

- [ ] **Step 3: Replace the existing spec card**

Replace the `<div className="card p-5 text-[14px]">` block (the three-row list) with a version
that includes the new rows:

```tsx
          <div className="card p-5 text-[14px]">
            {(
              [
                ["Avatar", detail.avatar?.name ?? null],
                ["Ses", detail.voice?.label ?? null],
                ["Alt yazı", captionName],
                ["Duygu", emotionLabel],
                ["En-boy oranı", formatRatio(v.aspectRatio)],
                ["Süre", formatDuration(v.durationS) || "—"],
                ["Yerleşim", `Avatar ${avatarPos} · alt yazı ${opts.layout?.captionPosition === "top" ? "üstte" : "altta"}`],
                ["Müzik", opts.music?.trackKey ? `${opts.music.trackKey} · %${Math.round((opts.music.volume ?? 0) * 100)}` : null],
                ["Kredi", v.creditsCost ? String(v.creditsCost) : null],
                ["Oluşturuldu", new Date(v.createdAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })],
              ] as [string, string | null][]
            )
              .filter((row): row is [string, string] => row[1] !== null)
              .map(([k, val]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-hairline py-2 last:border-0">
                  <span className="shrink-0 text-muted">{k}</span>
                  <span className="truncate text-right font-semibold text-ink">{val}</span>
                </div>
              ))}
          </div>
```

- [ ] **Step 4: Add the avatar thumbnail, script and B-roll sections**

Directly after that card:

```tsx
          {detail.avatar?.imageUrl && (
            <div className="card flex items-center gap-3 p-4">
              <img src={detail.avatar.imageUrl} alt="" className="h-14 w-14 rounded-lg bg-mist object-cover" />
              <div className="min-w-0">
                <p className="text-[13px] text-muted">Avatar</p>
                <p className="truncate text-[14px] font-semibold text-ink">{detail.avatar.name}</p>
              </div>
            </div>
          )}

          {scriptText && (
            <div className="card p-5">
              <p className="mb-2 text-[13px] text-muted">Metin</p>
              <p className="text-[14px] leading-relaxed text-ink">{scriptText}</p>
            </div>
          )}

          {detail.brollMedia && detail.brollMedia.length > 0 && (
            <div className="card p-5">
              <p className="mb-2 text-[13px] text-muted">
                Görseller · {detail.brollMedia.filter((m) => m.kind === "image").length} görsel,{" "}
                {detail.brollMedia.filter((m) => m.kind === "video").length} video
              </p>
              <div className="flex flex-wrap gap-2">
                {detail.brollMedia.map((m) => (
                  <div key={m.ref} className="h-16 w-16 overflow-hidden rounded-lg bg-mist">
                    {m.kind === "image" ? (
                      <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <video src={m.url} muted className="h-full w-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @sentezy/web typecheck`
Expected: no errors.

- [ ] **Step 6: Verify in the browser**

Open a finished video created through the composer. Confirm avatar name + matted thumbnail, voice
label, caption family, emotion, layout, music, SFX and credits rows all render, the script shows
with no `[tags]`, and the B-roll thumbnails appear. Open a **draft** — the rows with no data are
absent rather than showing `—`, and nothing crashes.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/VideoDetail.tsx
git commit -m "feat(web): show avatar, voice, caption, script and B-roll on video detail"
```

---

### Task 9: Pure reuse mapping

The riskiest logic in the feature, so it is pure and tested. See "Deviation from the spec" above for
why the caption preset is derived rather than stored.

**Files:**
- Modify: `apps/web/src/lib/captionStyles.ts` (export `presetIdFor`)
- Create: `apps/web/src/lib/reuse.ts`
- Test: `apps/web/src/lib/reuse.test.ts`

**Interfaces:**
- Consumes: `CAPTION_FAMILIES`, `CAPTION_PRESETS`, `DEFAULT_PRESET_ID` from `captionStyles.ts`;
  the post-cleanup `ComposerSettings`, `DEFAULT_SETTINGS` from `composerSettings.ts`;
  `readAvatarPosition` from `@sentezy/types`.
- Produces:
  - `presetIdFor(base: string, font: string, color: string): string`
  - `optionsToComposerState(video: ApiVideo): { captionId: string; settings: ComposerSettings; music: { trackKey: string; volume: number } | null }`

Music is returned **separately** from `settings` because after the cleanup it lives in
`MediaComposer` state (`selectedMusic`, `musicVolume`), not in `ComposerSettings`.

- [ ] **Step 1: Export the id builder**

Add to the end of `apps/web/src/lib/captionStyles.ts` (it must live here — `slug` is module-private
and the id format is defined by `build()` just above):

```ts
/** Rebuild a preset id from the {style, font, color} an existing video stored in
 *  options.captions. Ids are deterministic (see build() above), so this recovers the exact
 *  preset for any video ever created — no extra field needed. Unknown input → the default. */
export function presetIdFor(base: string, font: string, color: string): string {
  const fam = CAPTION_FAMILIES.find((f) => f.key === base);
  if (!fam) return DEFAULT_PRESET_ID;
  const id = fam.accent ? `${base}-${slug(font)}-${slug(color)}` : `${base}-${slug(font)}`;
  return CAPTION_PRESETS.some((p) => p.id === id) ? id : DEFAULT_PRESET_ID;
}
```

- [ ] **Step 2: Write the failing test**

`apps/web/src/lib/reuse.test.ts` — standalone `node:assert`, relative imports:

```ts
import assert from "node:assert";
import { DEFAULT_PRESET, DEFAULT_PRESET_ID, presetIdFor } from "./captionStyles";
import { DEFAULT_SETTINGS } from "./composerSettings";
import { optionsToComposerState } from "./reuse";
import type { ApiVideo } from "./types";

const video = (options: Record<string, unknown>): ApiVideo =>
  ({ id: "v1", title: "t", status: "ready", stage: null, progress: 100, aspectRatio: "r9_16",
     outputKey: null, thumbnailImageId: null, thumbnailUrl: null, durationS: 10, creditsCost: 1,
     createdAt: "2026-07-19T00:00:00Z", script: "", options }) as unknown as ApiVideo;

// ── presetIdFor ─────────────────────────────────────────────────────────────
// Ids are deterministic, so a stored {style, font, color} rebuilds its own preset id.
assert.strictEqual(presetIdFor(DEFAULT_PRESET.base, DEFAULT_PRESET.font, DEFAULT_PRESET.color), DEFAULT_PRESET_ID);
// Non-accent families ignore colour entirely — their ids carry no colour segment.
assert.strictEqual(presetIdFor("clean", "Inter", "#FFD54A"), "clean-inter");
// Unknown family or font falls back rather than inventing an id.
assert.strictEqual(presetIdFor("nope", "Inter", "#FFFFFF"), DEFAULT_PRESET_ID);
assert.strictEqual(presetIdFor(DEFAULT_PRESET.base, "Comic Sans", DEFAULT_PRESET.color), DEFAULT_PRESET_ID);

// ── optionsToComposerState ──────────────────────────────────────────────────
// The caption preset a video was created with comes back exactly.
assert.strictEqual(
  optionsToComposerState(video({
    captions: { style: DEFAULT_PRESET.base, font: DEFAULT_PRESET.font, color: DEFAULT_PRESET.color },
  })).captionId,
  DEFAULT_PRESET_ID,
);

// New-shape options round-trip into the four-field settings object.
const fresh = optionsToComposerState(video({
  layout: { avatarPosition: "left", captionPosition: "top" },
  music: { trackKey: "upbeat", volume: 0.2 },
  voice: { emotion: "excited" },
  effects: { transitionSfx: false },
}));
assert.deepStrictEqual(fresh.settings, {
  avatarPosition: "left", captionPosition: "top", voiceEmotion: "excited", transitionSfx: false,
});
// Music is returned separately — it is MediaComposer state, not a setting.
assert.deepStrictEqual(fresh.music, { trackKey: "upbeat", volume: 0.2 });

// Legacy blobs (avatarLayout + avatarSide) map forward via readAvatarPosition.
assert.strictEqual(
  optionsToComposerState(video({ layout: { avatarLayout: "bottom", avatarSide: "left", captionPosition: "bottom" } })).settings.avatarPosition,
  "center",
);
assert.strictEqual(
  optionsToComposerState(video({ layout: { avatarLayout: "side", avatarSide: "left", captionPosition: "bottom" } })).settings.avatarPosition,
  "left",
);

// An empty options object yields the defaults and no music.
const empty = optionsToComposerState(video({}));
assert.strictEqual(empty.captionId, DEFAULT_PRESET_ID);
assert.deepStrictEqual(empty.settings, DEFAULT_SETTINGS);
assert.strictEqual(empty.music, null);

// A video from before the SFX feature was deleted must not resurrect any of it.
const legacySfx = optionsToComposerState(video({ sfx: { enabled: true, cues: [{ wordIndex: 3, sfxId: "pop" }] } }));
assert.deepStrictEqual(Object.keys(legacySfx.settings).sort(),
  ["avatarPosition", "captionPosition", "transitionSfx", "voiceEmotion"]);

console.log("apps/web/src/lib/reuse.test.ts ok");
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm --filter @sentezy/api exec tsx /Users/berkan/Projects/sentezy/apps/web/src/lib/reuse.test.ts`
Expected: FAIL — `Cannot find module './reuse'`.

- [ ] **Step 4: Implement**

`apps/web/src/lib/reuse.ts`:

```ts
import { readAvatarPosition } from "@sentezy/types";
import { DEFAULT_PRESET_ID, presetIdFor } from "@/lib/captionStyles";
import { type ComposerSettings, DEFAULT_SETTINGS } from "@/lib/composerSettings";
import type { ApiVideo } from "@/lib/types";

type StoredOptions = {
  captions?: { style?: string; font?: string; color?: string };
  layout?: unknown; // readAvatarPosition handles both the new and the legacy shape
  music?: { trackKey?: string; volume?: number };
  voice?: { emotion?: string };
  effects?: { transitionSfx?: boolean };
};

/** Map a stored video back to composer state for "Yeniden kullan".
 *  Settings only — the script and the B-roll media are deliberately dropped.
 *  Music comes back separately because it is MediaComposer state, not a setting.
 *  Anything a video stored under the deleted `sfx` key is ignored: the feature is gone,
 *  and its cues were anchored to the OLD script's word indices anyway. */
export function optionsToComposerState(video: ApiVideo): {
  captionId: string;
  settings: ComposerSettings;
  music: { trackKey: string; volume: number } | null;
} {
  const o = (video.options ?? {}) as StoredOptions;
  const captionId = o.captions?.style
    ? presetIdFor(o.captions.style, o.captions.font ?? "", o.captions.color ?? "")
    : DEFAULT_PRESET_ID;

  const layout = (o.layout ?? {}) as { captionPosition?: string };
  const settings: ComposerSettings = {
    avatarPosition: readAvatarPosition(o.layout),
    captionPosition: (layout.captionPosition as ComposerSettings["captionPosition"]) ?? DEFAULT_SETTINGS.captionPosition,
    voiceEmotion: o.voice?.emotion ?? DEFAULT_SETTINGS.voiceEmotion,
    transitionSfx: o.effects?.transitionSfx ?? DEFAULT_SETTINGS.transitionSfx,
  };

  const music = o.music?.trackKey
    ? { trackKey: o.music.trackKey, volume: o.music.volume ?? 0.15 }
    : null;

  return { captionId, settings, music };
}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `pnpm --filter @sentezy/api exec tsx /Users/berkan/Projects/sentezy/apps/web/src/lib/reuse.test.ts && pnpm --filter @sentezy/api exec tsx /Users/berkan/Projects/sentezy/apps/web/src/lib/duration.test.ts`
Expected: both files print `… ok`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/captionStyles.ts apps/web/src/lib/reuse.ts apps/web/src/lib/reuse.test.ts
git commit -m "feat(web): derive composer state from a stored video's options"
```

---

### Task 10: Wire reuse into the composer

`DashboardHome` owns `settings`; `MediaComposer` owns the avatar/voice/caption selections. Both need
seeding, each exactly once, so a later render never clobbers an edit the user has since made.

**Files:**
- Modify: `apps/web/src/components/DashboardHome.tsx`
- Modify: `apps/web/src/components/MediaComposer.tsx:36-41` (props) and the state block at `:50-71`

**Interfaces:**
- Consumes: `optionsToComposerState` (Task 9), `useVideo` + detail `avatar`/`voice` (Tasks 5-6).
- Produces: `MediaComposer` accepts `seed?: ComposerSeed`.

- [ ] **Step 1: Accept a seed prop in the composer**

In `apps/web/src/components/MediaComposer.tsx`, replace the component signature (lines 36-41):

```tsx
export type ComposerSeed = {
  key: string; // the source video id — changing it re-seeds
  selectedAvatar: Avatar | null;
  selectedVoice: Voice | null;
  selectedMusic: MusicTrack | null;
  musicVolume: number;
  captionId: string;
};

/** Upload-first hero composer: accepts multiple images + videos, uploads each to
 *  storage (with per-tile progress), then builds a draft and queues it for render. */
export function MediaComposer({
  extraSettings,
  seed,
}: {
  extraSettings?: ComposerSettings;
  seed?: ComposerSeed;
}) {
```

- [ ] **Step 2: Hydrate once**

Add directly after the `const settings = extraSettings ?? DEFAULT_SETTINGS;` line:

```tsx
  // "Yeniden kullan" seeding. Applied once per source video: the user may change any of
  // these straight after, and a re-render must not undo that. Script and media stay empty
  // by design — this reuses the look, not the content.
  const seededRef = useRef<string | null>(null);
  useEffect(() => {
    if (!seed || seededRef.current === seed.key) return;
    seededRef.current = seed.key;
    setSelectedAvatar(seed.selectedAvatar);
    setSelectedVoice(seed.selectedVoice);
    setSelectedMusic(seed.selectedMusic);
    setMusicVolume(seed.musicVolume);
    setCaptionId(seed.captionId);
    setMode("upload");
  }, [seed]);
```

- [ ] **Step 3: Read the param and seed from the dashboard**

Replace `apps/web/src/components/DashboardHome.tsx` entirely:

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { SettingsDrawer } from "@/components/composer/SettingsDrawer";
import { MediaComposer, type ComposerSeed } from "@/components/MediaComposer";
import { type ComposerSettings, DEFAULT_SETTINGS } from "@/lib/composerSettings";
import { useMusic, useVideo } from "@/lib/queries";
import { optionsToComposerState } from "@/lib/reuse";

/** Dashboard home: the import composer (hero). Owns the shared settings state, and — when
 *  arriving from a video's "Yeniden kullan" button (?reuse=<id>) — seeds it from that video. */
export function DashboardHome() {
  const [settings, setSettings] = useState<ComposerSettings>(DEFAULT_SETTINGS);
  const reuseId = useSearchParams().get("reuse") ?? "";
  const { data: source, isError: reuseFailed } = useVideo(reuseId);

  // Music is stored as a bare track key, so resolve it against the catalog to get the
  // MusicTrack object the picker needs. A track removed since the video was made simply
  // does not resolve, and reuse continues without music.
  const tracks = useMusic().data?.music ?? [];

  // No cast: the API returns `avatar`/`voice` already shaped as the composer's own types.
  const seed = useMemo<ComposerSeed | undefined>(() => {
    if (!reuseId || !source) return undefined;
    const { captionId, music } = optionsToComposerState(source.video);
    return {
      key: reuseId,
      selectedAvatar: source.avatar ?? null,
      selectedVoice: source.voice ?? null,
      selectedMusic: music ? (tracks.find((t) => t.key === music.trackKey) ?? null) : null,
      musicVolume: music?.volume ?? 0.15,
      captionId,
    };
  }, [reuseId, source, tracks]);

  // Settings live here, so seed them here — once per source video, for the same reason
  // the composer guards its own seeding.
  const seededRef = useRef<string | null>(null);
  useEffect(() => {
    if (!reuseId || !source || seededRef.current === reuseId) return;
    seededRef.current = reuseId;
    setSettings(optionsToComposerState(source.video).settings);
  }, [reuseId, source]);

  return (
    <div>
      <section className="hero-aurora -mx-5 -mt-6 px-5 pb-10 pt-10 sm:-mx-6 sm:px-6 sm:pt-12 md:-mx-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="disp text-[26px] font-semibold leading-tight text-ink sm:text-[34px]">Sentezy&apos;e hoş geldin</h1>
              {/* A deleted or missing source degrades to a plain new-video flow with a
                  notice — never an error screen, since the composer works fine without it. */}
              <p className="mt-1.5 text-[14px] text-slate sm:text-[15px]">
                {reuseFailed
                  ? "Önceki video bulunamadı — varsayılan ayarlarla başlıyorsun"
                  : reuseId
                    ? "Ayarlar önceki videodan alındı — yeni metnini yaz"
                    : "Medyanı içe aktar ve videonu oluştur"}
              </p>
            </div>
            <SettingsDrawer settings={settings} onChange={setSettings} />
          </div>
          <MediaComposer extraSettings={settings} seed={seed} />
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Confirm `useVideo` tolerates an empty id**

Open `apps/web/src/lib/queries.ts` and check `useVideo`. If it has no `enabled` guard it will fire a
request to `/videos/` on every normal dashboard visit. Add one:

```ts
export function useVideo(id: string) {
  return useQuery({ queryKey: qk.video(id), queryFn: () => apiFetch<VideoDetailData>(`/videos/${id}`), enabled: Boolean(id) });
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @sentezy/web typecheck`
Expected: no errors. `useSearchParams` requires the component to be a client component — it already
carries `"use client"`.

- [ ] **Step 6: Verify the round trip in the browser**

Open a finished video → `Yeniden kullan`. On the dashboard confirm: the avatar chip shows the same
avatar, the voice chip the same voice, the caption chip the same style, and the settings drawer the
same layout/music/emotion/SFX/ratio. The script box is **empty** and no media is attached. Change the
avatar, then let the page re-render — your change must stick. Finally visit `/dashboard` with no
query param: everything is back to defaults and no `/videos/` request is made.

Then check the failure path: visit `/dashboard?reuse=00000000-0000-0000-0000-000000000000`. The
composer must load with defaults and the subtitle must read
"Önceki video bulunamadı — varsayılan ayarlarla başlıyorsun" — not an error screen.

- [ ] **Step 7: Run the tests and typecheck**

```bash
pnpm --filter @sentezy/api exec tsx /Users/berkan/Projects/sentezy/apps/web/src/lib/duration.test.ts
pnpm --filter @sentezy/api exec tsx /Users/berkan/Projects/sentezy/apps/web/src/lib/reuse.test.ts
pnpm typecheck
```
Expected: both test files print `… ok`; every typecheck task succeeds.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/DashboardHome.tsx apps/web/src/components/MediaComposer.tsx apps/web/src/lib/queries.ts
git commit -m "feat(web): seed the composer from an existing video via ?reuse"
```

---

## Known gaps left open

- **Soft-deleted videos keep their R2 objects.** No purge job, no restore UI — recovery means
  clearing `deleted_at` by hand. Spec §7 records this as deliberate.
- **API routes have no automated tests.** Verified by the curl steps in Tasks 4 and 5.
- **Pre-existing bug, deliberately not fixed here:** `VideoDetail.tsx:46-47` compares
  `v.aspectRatio` against `"16:9"`/`"1:1"`, but the API returns the Prisma enum (`r9_16`), which is
  why the same line calls `formatRatio`. The comparison therefore never matches and every video
  renders in a 9:16 box. Out of scope for this plan — worth its own small fix.
