# Avatars Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `/avatars` a real screen — browse the rendered avatar catalog, preview one, and start a video with it already selected.

**Architecture:** The grid and its filters are extracted out of the composer's `AvatarPicker` into a shared `AvatarGrid` used by both the sheet and the new page. Clicking a tile on the page opens a preview modal whose action routes to `/dashboard?avatar=<id>`. `ComposerSeed`'s value fields become optional so an avatar seed sets one field while a reuse seed sets all of them, and both flow through the one existing seeding path.

**Tech Stack:** Next.js 15 (App Router, React 19), TanStack Query, Tailwind. Tests are standalone `node:assert` scripts — no test framework exists in this repo.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-20-avatars-screen-design.md` — read it before Task 1.
- **All user-facing copy is Turkish**, matching the existing tone (`Avatarlar`, `Avatar ara…`, `Avatar bulunamadı`, `Tamam`, `Kapat`).
- **Only 12 of 126 catalog avatars have portraits.** `GET /avatars` returns all 126 with `ready: Boolean(imageKey)`; every surface filters to `a.ready && a.id`. **Do not add a sector filter** — ten sectors hold 1–2 avatars and fourteen hold none.
- **Run tests with `pnpm --filter @sentezy/api exec tsx <ABSOLUTE path>`.** Plain `npx tsx` fails from the repo root — `tsx` is only a devDependency of `@sentezy/api`, and `pnpm --filter … exec` runs in that package's directory, so the path must be absolute. Test files use **relative** imports (the `@/` alias does not resolve under bare tsx) and end with `console.log("<path> ok")`.
- **Loading states must be announced.** Every skeleton gets `role="status" aria-live="polite"` with a visually-hidden `Yükleniyor…`, matching `AvatarPicker`, `LibraryView` and `VideoDetail`.
- Do not commit unless a step says to.

## File Structure

**Create**
- `apps/web/src/lib/composerSeed.ts` — the `ComposerSeed` type plus the pure seed helpers. No React.
- `apps/web/src/lib/composerSeed.test.ts`
- `apps/web/src/components/composer/AvatarGrid.tsx` — query + search + filters + tiles, shared.
- `apps/web/src/components/AvatarPreview.tsx` — the preview modal.
- `apps/web/src/components/AvatarsView.tsx` — the page body.
- `apps/web/src/app/(app)/avatars/page.tsx` — the route.

**Modify**
- `apps/web/src/components/composer/AvatarPicker.tsx` — use `AvatarGrid`.
- `apps/web/src/components/MediaComposer.tsx` — import the seed type; apply only present keys.
- `apps/web/src/components/DashboardHome.tsx` — read `?avatar=`, pick between seeds, third subtitle.
- `apps/web/src/components/Sidebar.tsx:15`, `apps/web/src/components/BottomNav.tsx:13` — `ready: true`.

---

### Task 1: Optional-field `ComposerSeed` and the pure seed helpers

The dangerous part of this feature: an avatar seed must set ONE field and leave voice, music and captions untouched, while a reuse seed sets all of them — including clearing one to `null`. "Absent" and "present and null" must mean different things.

**Files:**
- Create: `apps/web/src/lib/composerSeed.ts`
- Test: `apps/web/src/lib/composerSeed.test.ts`
- Modify: `apps/web/src/components/MediaComposer.tsx`

**Interfaces:**
- Consumes: `Avatar`, `Voice` from `@/components/wizard/types`; `MusicTrack` from `@/lib/queries`.
- Produces:
  - `type ComposerSeedValues` — the five optional value fields.
  - `type ComposerSeed = ComposerSeedValues & { key: string }`.
  - `avatarSeed(avatarId: string, avatars: Avatar[]): ComposerSeed | undefined`
  - `pickSeed(reuse: ComposerSeed | undefined, avatar: ComposerSeed | undefined): ComposerSeed | undefined`
  - `seedKeys(seed: ComposerSeed): (keyof ComposerSeedValues)[]`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/composerSeed.test.ts`:

```ts
import assert from "node:assert";
import { avatarSeed, pickSeed, seedKeys } from "./composerSeed";
import type { Avatar } from "../components/wizard/types";

const avatar = (id: string, name: string, ready = true): Avatar =>
  ({ id, slug: name.toLowerCase(), name, imageUrl: `https://x/${id}`, sector: "ecommerce",
     sectorLabel: "E-ticaret Markası", gender: "kadın", age: "genç", hijab: false, ready }) as Avatar;

const CATALOG = [avatar("avatars/beyza.png", "Beyza"), avatar("avatars/anna.png", "Anna")];

// ── avatarSeed ──────────────────────────────────────────────────────────────
const found = avatarSeed("avatars/beyza.png", CATALOG);
assert.ok(found, "a catalogued avatar must produce a seed");
assert.strictEqual(found.selectedAvatar?.name, "Beyza");
// The key is namespaced so an avatar seed and a reuse seed can never collide in the
// composer's seed-once ref (a video id and an avatar id could otherwise coincide).
assert.strictEqual(found.key, "avatar:avatars/beyza.png");

// An avatar seed carries EXACTLY one field. This is the whole point: voice, music and
// captions must be left alone, not cleared.
assert.deepStrictEqual(seedKeys(found), ["selectedAvatar"]);

// Unknown / unrendered / deleted id → no seed, so the caller can show its notice.
assert.strictEqual(avatarSeed("avatars/nope.png", CATALOG), undefined);
assert.strictEqual(avatarSeed("", CATALOG), undefined);
assert.strictEqual(avatarSeed("avatars/beyza.png", []), undefined);

// ── seedKeys: absent vs present-and-null ────────────────────────────────────
// A reuse seed sets every field, and `null` is a real value meaning "clear it".
const reuse: ReturnType<typeof pickSeed> = {
  key: "video-1", selectedAvatar: null, selectedVoice: null,
  selectedMusic: null, musicVolume: 0.15, captionId: null,
};
assert.deepStrictEqual(
  seedKeys(reuse!).sort(),
  ["captionId", "musicVolume", "selectedAvatar", "selectedMusic", "selectedVoice"],
);
// A field that is absent must NOT appear, even though a present `null` does.
assert.deepStrictEqual(seedKeys({ key: "k", captionId: null }), ["captionId"]);
assert.deepStrictEqual(seedKeys({ key: "k" }), []);

// ── pickSeed: reuse wins ────────────────────────────────────────────────────
// A reuse carries a whole configuration; letting a lone avatar override part of it
// would be surprising.
assert.strictEqual(pickSeed(reuse, found)?.key, "video-1");
assert.strictEqual(pickSeed(undefined, found)?.key, "avatar:avatars/beyza.png");
assert.strictEqual(pickSeed(reuse, undefined)?.key, "video-1");
assert.strictEqual(pickSeed(undefined, undefined), undefined);

console.log("apps/web/src/lib/composerSeed.test.ts ok");
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @sentezy/api exec tsx /Users/berkan/Projects/sentezy/apps/web/src/lib/composerSeed.test.ts`
Expected: FAIL — `Cannot find module './composerSeed'`.

- [ ] **Step 3: Implement**

Create `apps/web/src/lib/composerSeed.ts`:

```ts
import type { Avatar, Voice } from "@/components/wizard/types";
import type { MusicTrack } from "@/lib/queries";

/** The composer state a seed can set. Every field is OPTIONAL, and the distinction
 *  matters: an ABSENT key means "leave this alone", while a key present with `null`
 *  means "clear it". `?reuse=` sets all five; `?avatar=` sets only the avatar. */
export type ComposerSeedValues = {
  selectedAvatar?: Avatar | null;
  selectedVoice?: Voice | null;
  selectedMusic?: MusicTrack | null;
  musicVolume?: number;
  /** null = no caption style selected (captions are opt-in). */
  captionId?: string | null;
};

/** `key` identifies the seed's source; the composer seeds once per key. */
export type ComposerSeed = ComposerSeedValues & { key: string };

const VALUE_KEYS: (keyof ComposerSeedValues)[] = [
  "selectedAvatar", "selectedVoice", "selectedMusic", "musicVolume", "captionId",
];

/** The value keys this seed actually carries — i.e. the ones the composer should write.
 *  Uses `in` rather than a truthiness check so a deliberate `null` still counts. */
export function seedKeys(seed: ComposerSeed): (keyof ComposerSeedValues)[] {
  return VALUE_KEYS.filter((k) => k in seed);
}

/** The seed for `/dashboard?avatar=<id>`: sets the avatar and nothing else.
 *  Returns undefined when the id is empty or not in the catalog (never rendered, or
 *  removed), so the caller can degrade to a normal new-video flow with a notice. */
export function avatarSeed(avatarId: string, avatars: Avatar[]): ComposerSeed | undefined {
  if (!avatarId) return undefined;
  const match = avatars.find((a) => a.id === avatarId);
  if (!match) return undefined;
  return { key: `avatar:${avatarId}`, selectedAvatar: match };
}

/** `?reuse=` wins over `?avatar=` — a reuse carries a whole configuration, so letting a
 *  lone avatar override part of it would be surprising. */
export function pickSeed(
  reuse: ComposerSeed | undefined,
  avatar: ComposerSeed | undefined,
): ComposerSeed | undefined {
  return reuse ?? avatar;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter @sentezy/api exec tsx /Users/berkan/Projects/sentezy/apps/web/src/lib/composerSeed.test.ts`
Expected: `apps/web/src/lib/composerSeed.test.ts ok`

- [ ] **Step 5: Move the type out of `MediaComposer` and apply only present keys**

In `apps/web/src/components/MediaComposer.tsx`, DELETE the local `export type ComposerSeed = {...}` block and re-export from the new module so existing importers keep working:

```tsx
export type { ComposerSeed } from "@/lib/composerSeed";
```

Add `import { seedKeys } from "@/lib/composerSeed";` to the imports, then replace the seeding effect's body so it writes only the keys the seed carries:

```tsx
  // "Yeniden kullan" / avatar seeding. Applied once per seed key: the user may change any
  // of these straight after, and a re-render must not undo that. Script and media stay
  // empty by design. Only the keys the seed actually carries are written — an avatar-only
  // seed must not clear the voice, music or caption the user already has.
  const seededRef = useRef<string | null>(null);
  useEffect(() => {
    if (!seed || seededRef.current === seed.key) return;
    seededRef.current = seed.key;
    for (const k of seedKeys(seed)) {
      if (k === "selectedAvatar") setSelectedAvatar(seed.selectedAvatar ?? null);
      if (k === "selectedVoice") setSelectedVoice(seed.selectedVoice ?? null);
      if (k === "selectedMusic") setSelectedMusic(seed.selectedMusic ?? null);
      if (k === "musicVolume" && seed.musicVolume !== undefined) setMusicVolume(seed.musicVolume);
      if (k === "captionId") setCaptionId(seed.captionId ?? null);
    }
    setMode("upload");
  }, [seed]);
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @sentezy/web typecheck`
Expected: no errors. `DashboardHome.tsx` still builds its reuse seed with all five fields, which satisfies the now-optional type unchanged.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/composerSeed.ts apps/web/src/lib/composerSeed.test.ts apps/web/src/components/MediaComposer.tsx
git commit -m "refactor(web): optional-field ComposerSeed with pure seed helpers"
```

---

### Task 2: Extract `AvatarGrid` from the picker

Pure refactor — the picker must look and behave exactly as it does now.

**Files:**
- Create: `apps/web/src/components/composer/AvatarGrid.tsx`
- Modify: `apps/web/src/components/composer/AvatarPicker.tsx`

**Interfaces:**
- Produces: `<AvatarGrid onSelect selectedId? showNoneOption? columns? />` where
  `onSelect: (a: Avatar | null) => void`, `selectedId?: string | null`,
  `showNoneOption?: boolean`, `columns?: "sheet" | "page"`.

- [ ] **Step 1: Create the shared grid**

Create `apps/web/src/components/composer/AvatarGrid.tsx`:

```tsx
"use client";

import { useState } from "react";
import { type Avatar } from "@/components/wizard/types";
import { Icon } from "@/components/icons";
import { AGE_OPTS, type Age, GENDER_OPTS, type Gender, HIJAB_OPTS, type Hijab } from "@/lib/composer/avatarFilters";
import { useAvatars } from "@/lib/queries";
import { Dropdown } from "./Dropdown";

/** The avatar catalog browser — owns the query, the search box and the gender/age/hijab
 *  filters, and renders the tiles. Shared by the composer's picker sheet and the /avatars
 *  page so the two can never drift.
 *
 *  Only ~12 of the 126 catalogued personas have a rendered portrait, so tiles are filtered
 *  to `ready && id`. There is deliberately NO sector filter: ten sectors hold one or two
 *  ready avatars and fourteen hold none, so it would mostly return an empty grid. */
export function AvatarGrid({
  onSelect,
  selectedId = null,
  showNoneOption = false,
  columns = "sheet",
}: {
  onSelect: (a: Avatar | null) => void;
  selectedId?: string | null;
  showNoneOption?: boolean;
  columns?: "sheet" | "page";
}) {
  const [q, setQ] = useState("");
  const [gender, setGender] = useState<Gender>("all");
  const [age, setAge] = useState<Age>("all");
  const [hijab, setHijab] = useState<Hijab>("all");

  const avatarsQ = useAvatars({ gender, age, hijab });
  const ready = (avatarsQ.data ?? []).filter((a) => a.ready && a.id);
  const filtered = ready.filter(
    (a) => !q.trim() || `${a.name} ${a.sectorLabel ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const hasFilters = Boolean(q.trim()) || gender !== "all" || age !== "all" || hijab !== "all";
  const clearFilters = () => {
    setQ("");
    setGender("all");
    setAge("all");
    setHijab("all");
  };

  const gridCls =
    columns === "page"
      ? "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
      : "grid grid-cols-3 gap-3 sm:grid-cols-4";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <Icon.search width={15} height={15} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Avatar ara…"
            className="w-full rounded-full border border-hairline bg-paper py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition focus:border-signal"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Dropdown value={gender} onChange={(v) => setGender(v as Gender)} options={GENDER_OPTS} />
          <Dropdown value={age} onChange={(v) => setAge(v as Age)} options={AGE_OPTS} />
          <Dropdown value={hijab} onChange={(v) => setHijab(v as Hijab)} options={HIJAB_OPTS} />
        </div>
      </div>

      {avatarsQ.isLoading ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Yükleniyor…</span>
          <div className={gridCls}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <div className="ph-stripe aspect-[3/4] rounded-xl border border-hairline" />
                <div className="mt-1.5 h-3 w-3/4 rounded bg-black/5" />
              </div>
            ))}
          </div>
        </div>
      ) : avatarsQ.isError ? (
        /* A failed request is NOT an empty result — never blame the user's filters for it. */
        <div className="py-10 text-center">
          <p className="text-[14px] text-muted">Avatarlar yüklenemedi</p>
          <button type="button" onClick={() => avatarsQ.refetch()} className="mt-2 text-[13px] font-medium text-signal">
            Tekrar dene
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[14px] text-muted">Avatar bulunamadı</p>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="mt-2 text-[13px] font-medium text-signal">
              Filtreleri temizle
            </button>
          )}
        </div>
      ) : (
        <div className={gridCls}>
          {showNoneOption && (
            /* Faceless option — no avatar; the reel is B-roll + captions + voice only. */
            <button type="button" onClick={() => onSelect(null)} className="text-left">
              <div className={`relative flex aspect-[3/4] flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border bg-mist px-2 text-center transition ${selectedId === null ? "border-ink ring-2 ring-ink" : "border-hairline hover:border-slate"}`}>
                <span className="disp text-[15px] font-semibold text-ink">Avatarsız</span>
                <span className="text-[10px] leading-tight text-muted">yüzsüz video</span>
              </div>
              <div className="mt-1.5 truncate px-0.5 text-[12px] font-medium text-slate">İsimsiz</div>
            </button>
          )}
          {filtered.map((a) => {
            const sel = selectedId === a.id;
            return (
              <button key={a.id} type="button" onClick={() => onSelect(sel ? null : a)} className="text-left">
                <div className={`relative aspect-[3/4] overflow-hidden rounded-xl border bg-mist transition ${sel ? "border-ink ring-2 ring-ink" : "border-hairline hover:border-slate"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.imageUrl} alt={a.name} className="h-full w-full object-cover" />
                  {sel && (
                    <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-paper">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                    </span>
                  )}
                </div>
                <div className={`mt-1.5 truncate px-0.5 text-[12px] font-medium ${sel ? "text-ink" : "text-slate"}`}>{a.name}</div>
                {columns === "page" && a.sectorLabel && (
                  <div className="truncate px-0.5 text-[11px] text-muted">{a.sectorLabel}</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `AvatarPicker` to use it**

Replace the whole body of `apps/web/src/components/composer/AvatarPicker.tsx` with:

```tsx
"use client";

import { type Avatar } from "@/components/wizard/types";
import { Icon } from "@/components/icons";
import { AvatarGrid } from "./AvatarGrid";

/** Avatar picker sheet — the catalog browser in a modal. Selecting closes it.
 *  The grid itself lives in AvatarGrid, shared with the /avatars page. */
export function AvatarPicker({ open, onClose, selectedId, onSelect }: { open: boolean; onClose: () => void; selectedId: string | null; onSelect: (a: Avatar | null) => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
        <div className="flex-none px-5 pt-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
          <div className="mb-1 flex items-start justify-between gap-3">
            <h3 className="disp mt-0.5 text-[18px] font-semibold text-ink">Avatar seç</h3>
            <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
              <Icon.close width={18} height={18} className="block" />
            </button>
          </div>
        </div>

        <div className="no-scrollbar overflow-y-auto px-5 py-4">
          <AvatarGrid
            selectedId={selectedId}
            showNoneOption
            onSelect={(a) => {
              onSelect(a);
              onClose();
            }}
          />
        </div>

        <div className="flex flex-none justify-end px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3">
          <button type="button" onClick={onClose} className="btn btn-primary min-w-28">
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}
```

Note the behaviour change this makes explicit: previously the "Avatarsız" tile closed the sheet but selecting a real avatar did not. Both now close, which is the consistent behaviour.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @sentezy/web typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/composer/AvatarGrid.tsx apps/web/src/components/composer/AvatarPicker.tsx
git commit -m "refactor(web): extract AvatarGrid so the picker and the page share one grid"
```

---

### Task 3: The `/avatars` route and page

**Files:**
- Create: `apps/web/src/app/(app)/avatars/page.tsx`, `apps/web/src/components/AvatarsView.tsx`
- Modify: `apps/web/src/components/Sidebar.tsx` (~line 15), `apps/web/src/components/BottomNav.tsx` (~line 13)

**Interfaces:**
- Consumes: `AvatarGrid` from Task 2.
- Produces: `<AvatarsView />`; the route `/avatars`.

- [ ] **Step 1: Create the page body**

Create `apps/web/src/components/AvatarsView.tsx`. The preview modal arrives in Task 4 — for now a click does nothing but record the selection:

```tsx
"use client";

import { useState } from "react";
import { AvatarGrid } from "@/components/composer/AvatarGrid";
import { type Avatar } from "@/components/wizard/types";

/** The avatar catalog as a full page: browse, then start a video with one.
 *  The grid is shared with the composer's picker sheet. */
export function AvatarsView() {
  const [previewing, setPreviewing] = useState<Avatar | null>(null);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="disp text-[28px] font-semibold text-ink">Avatarlar</h1>
        <p className="mt-1 text-[14.5px] text-slate">Videon için bir sunucu seç.</p>
      </div>

      <AvatarGrid columns="page" onSelect={(a) => setPreviewing(a)} />
    </div>
  );
}
```

- [ ] **Step 2: Create the route**

Create `apps/web/src/app/(app)/avatars/page.tsx`, mirroring `app/(app)/library/page.tsx`:

```tsx
import { AvatarsView } from "@/components/AvatarsView";

export default function AvatarsPage() {
  return <AvatarsView />;
}
```

- [ ] **Step 3: Enable the nav entries**

In `apps/web/src/components/Sidebar.tsx`, find the nav entry for `/avatars` and change `ready: false` to `ready: true`:

```tsx
  { href: "/avatars", label: "Avatarlar", icon: Icon.users, ready: true },
```

In `apps/web/src/components/BottomNav.tsx`, the same:

```tsx
  { href: "/avatars", label: "Avatar", icon: Icon.users, ready: true },
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @sentezy/web typecheck`
Expected: no errors. `previewing` is set but unused at this point — if the linter rejects an unused variable, leave a `void previewing;` line with a comment that Task 4 consumes it, rather than removing the state.

- [ ] **Step 5: Verify in the browser**

Start the web app, open `/avatars`. The nav entry is now clickable in both the sidebar and the bottom nav, the page shows the heading and a grid of the ready avatars with their sector labels, and the filters and search work. Clicking a tile does nothing yet.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(app\)/avatars/page.tsx apps/web/src/components/AvatarsView.tsx apps/web/src/components/Sidebar.tsx apps/web/src/components/BottomNav.tsx
git commit -m "feat(web): add the /avatars page and enable its nav entry"
```

---

### Task 4: The preview modal

**Files:**
- Create: `apps/web/src/components/AvatarPreview.tsx`
- Modify: `apps/web/src/components/AvatarsView.tsx`

**Interfaces:**
- Consumes: `Avatar` from `@/components/wizard/types`.
- Produces: `<AvatarPreview avatar onClose />` where `avatar: Avatar | null` (null = closed).

- [ ] **Step 1: Create the modal**

Create `apps/web/src/components/AvatarPreview.tsx`, matching the house shell used by `composer/CaptionPicker.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "@/components/icons";
import { type Avatar } from "@/components/wizard/types";

/** A closer look at one avatar before committing to it — the grid tile is too small to
 *  judge a face. The action seeds the composer with this avatar via ?avatar=<id>. */
export function AvatarPreview({ avatar, onClose }: { avatar: Avatar | null; onClose: () => void }) {
  const router = useRouter();

  useEffect(() => {
    if (!avatar) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [avatar, onClose]);

  if (!avatar) return null;
  const meta = [avatar.sectorLabel, avatar.age, avatar.hijab ? "Başörtülü" : null].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="sheet-in relative z-10 flex w-full max-w-sm flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
        <div className="flex flex-none items-start justify-between gap-3 px-5 pt-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
          <button type="button" onClick={onClose} aria-label="Kapat" className="ml-auto grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
            <Icon.close width={18} height={18} className="block" />
          </button>
        </div>

        <div className="px-5">
          <div className="overflow-hidden rounded-2xl border border-hairline bg-mist">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar.imageUrl} alt={avatar.name} className="aspect-[3/4] w-full object-cover" />
          </div>
          <h3 className="disp mt-3 text-[19px] font-semibold text-ink">{avatar.name}</h3>
          {meta && <p className="mt-0.5 text-[13px] text-muted">{meta}</p>}
        </div>

        <div className="flex flex-none justify-end px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:pb-4">
          <button
            type="button"
            onClick={() => router.push(`/dashboard?avatar=${encodeURIComponent(avatar.id)}`)}
            className="btn btn-primary w-full justify-center"
          >
            Bu avatarla video oluştur
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the page**

In `apps/web/src/components/AvatarsView.tsx`, add the import and render the modal below the grid:

```tsx
import { AvatarPreview } from "@/components/AvatarPreview";
```

and immediately after `<AvatarGrid … />`:

```tsx
      <AvatarPreview avatar={previewing} onClose={() => setPreviewing(null)} />
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @sentezy/web typecheck`
Expected: no errors.

- [ ] **Step 4: Verify in the browser**

Open `/avatars`, click a tile: the preview opens with a large portrait, the name, and a line like `E-ticaret Markası · genç · Başörtülü`. Escape closes it, the backdrop closes it, the `Kapat` button closes it. `Bu avatarla video oluştur` navigates to `/dashboard?avatar=…` — the composer will not react to that parameter until Task 5.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/AvatarPreview.tsx apps/web/src/components/AvatarsView.tsx
git commit -m "feat(web): preview an avatar before starting a video with it"
```

---

### Task 5: Seed the composer from `?avatar=`

**Files:**
- Modify: `apps/web/src/components/DashboardHome.tsx`

**Interfaces:**
- Consumes: `avatarSeed`, `pickSeed` from Task 1; `AvatarGrid`'s catalog via `useAvatars`.

- [ ] **Step 1: Read the parameter and build the avatar seed**

In `apps/web/src/components/DashboardHome.tsx`, add to the imports:

```tsx
import { avatarSeed, pickSeed } from "@/lib/composerSeed";
import { useAvatars, useMusic, useVideo } from "@/lib/queries";
```

(the existing `useMusic, useVideo` import line gains `useAvatars`).

After the existing `const reuseId = …` line, add:

```tsx
  // ?avatar=<id> — a single avatar chosen on /avatars. Only consulted when there is no
  // ?reuse=, which carries a whole configuration and therefore wins.
  const avatarId = useSearchParams().get("avatar") ?? "";
  const avatarsQ = useAvatars({}, Boolean(avatarId) && !reuseId);
  const avatarSeeded = avatarSeed(avatarId, avatarsQ.data ?? []);
  // The id is real but not in the catalog (removed, or never rendered) — degrade to a
  // plain new-video flow with a notice, exactly as a missing ?reuse= video does.
  const avatarFailed = Boolean(avatarId) && !reuseId && !avatarsQ.isFetching && !avatarSeeded;
```

- [ ] **Step 2: Combine the two seeds**

Rename the existing `useMemo` result from `seed` to `reuseSeed` (change only the `const` name; the memo body is unchanged), then immediately after it add:

```tsx
  const seed = pickSeed(reuseSeed, avatarSeeded);
```

and change the `<MediaComposer … seed={seed} />` prop to pass this combined `seed` (the JSX line already reads `seed={seed}`, so it needs no edit once the names line up).

- [ ] **Step 3: Add the third subtitle state**

Replace the subtitle paragraph's expression so the avatar cases are covered, keeping the existing two exactly as they are:

```tsx
            <p className="mt-1.5 text-[14px] text-slate sm:text-[15px]">
              {reuseFailed
                ? "Önceki video bulunamadı — varsayılan ayarlarla başlıyorsun"
                : reuseId
                  ? "Ayarlar önceki videodan alındı — yeni metnini yaz"
                  : avatarFailed
                    ? "Avatar bulunamadı — varsayılan ayarlarla başlıyorsun"
                    : avatarSeeded
                      ? `${avatarSeeded.selectedAvatar?.name} seçildi — metnini yaz`
                      : "Medyanı içe aktar ve videonu oluştur"}
            </p>
```

- [ ] **Step 4: No change needed to `useAvatars`**

Verified 2026-07-20 — `apps/web/src/lib/queries.ts:82` already reads
`export function useAvatars(filters: Record<string, string> = {}, enabled = true)`, so the
`enabled` argument used in Step 1 works as written and the catalog is NOT fetched on a normal
dashboard visit with no `?avatar=`. Nothing to edit; confirm the line still matches and move on.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @sentezy/web typecheck`
Expected: no errors.

- [ ] **Step 6: Run every test**

```bash
pnpm --filter @sentezy/api exec tsx /Users/berkan/Projects/sentezy/apps/web/src/lib/composerSeed.test.ts
pnpm --filter @sentezy/api exec tsx /Users/berkan/Projects/sentezy/apps/web/src/lib/reuse.test.ts
pnpm --filter @sentezy/api exec tsx /Users/berkan/Projects/sentezy/apps/web/src/lib/duration.test.ts
pnpm --filter @sentezy/api exec tsx /Users/berkan/Projects/sentezy/apps/web/src/lib/videoGroups.test.ts
```
Expected: each prints `… ok`.

- [ ] **Step 7: Verify the whole flow in the browser**

1. `/avatars` → click an avatar → `Bu avatarla video oluştur`.
2. The composer opens with that avatar selected, the subtitle reads `<name> seçildi — metnini yaz`, and the `+` menu's `Avatar` row shows the name.
3. **The important check:** before navigating, set a voice and a caption style in the composer, then go to `/avatars` and pick an avatar. The voice and caption must SURVIVE — an avatar seed sets only the avatar. (Note they will not survive a full page reload; this checks the seed does not clear them.)
4. `/dashboard?avatar=avatars/nope.png` → composer loads with defaults and the notice `Avatar bulunamadı — varsayılan ayarlarla başlıyorsun`, not an error screen.
5. `/dashboard` with no parameters → defaults, and no `/avatars` request is made.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/DashboardHome.tsx apps/web/src/lib/queries.ts
git commit -m "feat(web): seed the composer from ?avatar= chosen on the avatars page"
```

---

## Known gaps left open

- **The seed can still clobber an edit made while it loads.** `?avatar=` needs the catalog to
  resolve before it can seed, so an edit made in that window is overwritten — the same defect the
  whole-branch review found for `?reuse=`. Both now share one guard, so a single fix covers both.
  Out of scope here; it needs dirty-tracking per field or gating interaction until the seed lands.
- **114 of 126 personas have no portrait**, so the page shows 12. Generating the rest, and
  reconciling the 58 orphaned R2 images from the older `gpt-image-1` run, is separate work.
- No sector filter until the catalog is populated.
- No focus trap in `AvatarPreview` — it matches the app's other modals, none of which have
  `role="dialog"` or trap focus. Fixing that properly is an app-wide change.
