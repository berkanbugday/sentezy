# Avatars screen

**Date:** 2026-07-20
**Status:** approved, ready for planning

## Problem

`/avatars` exists in the sidebar and the bottom nav as a disabled link (`ready: false` in
`Sidebar.tsx:15` and `BottomNav.tsx:13`) — there is no route behind it. The only way to see the
avatar catalog is the picker sheet inside the composer, which shows tiles at sheet size and offers
no way to browse before you have decided to make a video.

The screen gives the catalog a home and a second entry point into creating: browse, look closely,
then start a video with that avatar already chosen.

## Decisions

| Question | Decision |
|---|---|
| What the screen is for | Browse, then start a video with the chosen avatar. |
| Sparse catalog (12 of 126 rendered) | Build for the 12 that exist. No sector filter. |
| Clicking a tile | Opens a preview, which has the "create a video" action. |
| Getting the avatar to the composer | `?avatar=<id>`, flowing through the existing `ComposerSeed`. |
| `?reuse=` and `?avatar=` together | `?reuse=` wins; `?avatar=` is ignored. |
| Grid code | Extracted and shared between the picker sheet and the page. |

## The catalog is mostly unrendered — this shapes the screen

Measured against the live database on 2026-07-20:

```
catalog total: 126 | with a portrait: 12
ready by sector: finance=1, education=1, realestate=1, automotive=2, optics=1,
                 dental=1, influencer=1, ecommerce=2, pharmacy=1, health=1
```

`GET /avatars` returns all 126 with `ready: Boolean(imageKey)`; the picker already filters to
`a.ready && a.id`, so it has been showing 12 all along.

Consequences, and why the design is what it is:

- **No sector filter.** The API supports one and returns the 24 sector labels, but ten sectors hold
  one or two avatars each and fourteen hold none. A filter whose options mostly return an empty grid
  is worse than no filter. Sector appears as a **label on each tile** instead.
- **The header shows the real count** — the number of avatars actually shown, never 126.
- Adding the sector filter later is a small change to one shared component, once the catalog fills.

**Out of scope, but the reason this matters:** the other 114 personas have prompts and no portraits,
and R2 holds 58 orphaned images from an older `gpt-image-1` run whose `imageId`s were dropped when
the catalog was rebuilt. Generating the remainder is separate work.

## 1. Route and page

- `apps/web/src/app/(app)/avatars/page.tsx` — server component, renders `<AvatarsView />`. Mirrors
  `app/(app)/library/page.tsx`.
- `apps/web/src/components/AvatarsView.tsx` — client component, owns the preview modal's open state.
- `Sidebar.tsx:15` and `BottomNav.tsx:13`: `ready: false` → `true`.

Page furniture copies `LibraryView`: a `disp` heading `Avatarlar`, a muted subtitle, the count on the
right, then the filter row, then the grid.

## 2. Shared `AvatarGrid`

New `apps/web/src/components/composer/AvatarGrid.tsx`, extracted from `AvatarPicker`. It owns the
`useAvatars()` query, the search input, the three `Dropdown` filters (gender / age / hijab), the
`ready && id` rule, the tiles, and the loading and empty states.

```ts
{
  onSelect: (avatar: Avatar) => void;
  selectedId?: string | null;
  showNoneOption?: boolean;   // the picker's "Avatarsız" tile; the page passes false
  columns?: "sheet" | "page"; // tile density — see below
}
```

`columns` is a named density, not a raw class string, so both callers stay on one scale:
`"sheet"` keeps the picker's current density; `"page"` is roomier so a face is legible without
opening the preview — 2 columns on mobile, 3 at `md`, 4 at `lg`, matching the library grid's cap.

- `AvatarPicker` passes `showNoneOption`, `selectedId`, and an `onSelect` that sets and closes.
- `AvatarsView` passes neither, and an `onSelect` that opens the preview.

Both surfaces then share one filtering implementation and one tile treatment, and cannot drift.

## 3. Preview modal

`apps/web/src/components/AvatarPreview.tsx`, using the house modal shell (`fixed inset-0`,
`bg-black/45 backdrop-blur-sm` backdrop, `sheet-in`, bottom sheet under `sm`, centred above) —
read `composer/CaptionPicker.tsx` and match it.

Contents: the portrait at a size where the face is legible, the name, `sectorLabel`, age, a hijab
indicator when true, and a primary action **`Bu avatarla video oluştur`** routing to
`/dashboard?avatar=<id>`. Closing returns to the grid with no side effects.

## 4. Seeding — `ComposerSeed` fields become optional

This is the part most likely to go wrong.

`ComposerSeed` currently declares every field as required, because its only producer (`?reuse=`)
replaces a whole configuration. `?avatar=` must set **one** field and leave voice, music and
captions exactly as the user has them. With the current shape it would null them.

- Make `ComposerSeed`'s value fields optional; `key` stays required.
- `MediaComposer`'s seeding effect applies **only the keys present** on the seed. A key that is
  absent must not be written — note this is distinct from a key present and `null`, which means
  "clear it".
- `DashboardHome` reads both params. `?reuse=` takes precedence; `?avatar=` is used only when
  `reuse` is absent. It resolves the id against `useAvatars()` and emits
  `{ key: \`avatar:${id}\`, selectedAvatar }`.
- The `key` namespace prevents an avatar seed and a reuse seed colliding in the seed-once ref.
- The subtitle gains a third state for the avatar case, in Turkish, matching the existing two.

**The clobbering risk applies here too.** `?avatar=` needs `useAvatars()` to resolve before it can
seed, so a user edit made in that window can be overwritten — the same defect the whole-branch
review found for `?reuse=`. Both paths share one guard, so a fix applies to both.

An unresolvable `?avatar=` id (deleted from the catalog, or never rendered) degrades to a normal
new-video flow with a non-blocking notice, exactly as a missing `?reuse=` video does.

## 5. States

- **Loading:** a skeleton grid at the page's column count, wrapped in `role="status"`
  `aria-live="polite"` with a visually-hidden `Yükleniyor…` — matching the accessibility fix applied
  to `LibraryView`, `VideoDetail` and `AvatarPicker`.
- **Empty because filters match nothing:** a `card` explaining so, with an action that clears the
  filters. Distinct from the catalog being empty.
- **Error:** the page renders the filters and an inline message rather than an error screen.

## 6. Testing

`GET /avatars` needs no change, so there is no API work and no new route test.

The seed-merge logic goes in a pure exported function with a `node:assert` test
(`pnpm --filter @sentezy/api exec tsx <ABSOLUTE path>`, relative imports, no framework):

- an avatar-only seed leaves `selectedVoice`, `selectedMusic` and `captionId` untouched;
- a reuse seed still sets all of them, including clearing a field to `null`;
- both params present resolves to the reuse seed;
- an absent key and a `null` key are treated differently.

## Out of scope

- Generating the remaining 114 portraits, and reconciling the 58 orphaned R2 images.
- A sector filter (revisit once the catalog is populated).
- Uploading a custom avatar — no web upload path exists today.
- "My avatars" (`/avatars/mine`); this screen is the catalog, not a management surface.
- Favouriting, sorting, or pagination — 12 items need none of it.
