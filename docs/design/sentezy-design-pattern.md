# Sentezy Design Pattern

A **light, fully monochrome** adaptation of the "Captions" studio. Sentezy copies Captions' shell
structure and interactions closely — inset floating workspace, team switcher, ambient hero, hero
composer, upgrade chip, 9:16 gallery — but renders everything in grayscale on a light canvas. **No
color anywhere.**

---

## 1. Philosophy

- **Monochrome controls, aurora accent.** Controls, chips, cards and text stay ink/paper/grays —
  no brand hue anywhere. Color lives only in the ambient gradients: the hero aurora and a faint
  echo on the dark frame. That containment is the brand.
- **Inset floating workspace.** The app is a **soft-dark frame** (`--frame`) — a deep base with a
  cool-blue glow top-left and a warm hint on the right — with the sidebar sitting on it and a white,
  rounded content **panel** floating inside (rounded 24, hairline border). Mirrors Captions'
  dark-frame / light-panel inset.
- **Aurora hero.** The top of the Home panel carries a Captions-style aurora (`--hero`): cool
  blue/teal on the left easing into warm amber/pink on the right, fading down into the white panel.
  It bleeds to the panel edges, behind the floating upgrade chip.
- **Upload-first, wizard-backed.** Home opens with an import/drag composer ("Videonu sürükle ya da
  yükle"). It's a friendly on-ramp; the real engine is the 4-step create wizard. "Videomu oluştur"
  always routes into the wizard.
- **Turkish copy**, always. General Sans display, Inter body/UI, JetBrains Mono numerics.

---

## 2. Foundations

### Color tokens (light, monochrome — `apps/web/src/app/globals.css`)

| Token | Value | Use |
|---|---|---|
| `--frame` | `#e6e6ea` | outer canvas behind the floating panel + sidebar |
| `--color-paper` | `#ffffff` | the panel, cards, chips |
| `--color-mist` | `#f4f4f5` | hover fills, icon tiles |
| `--color-ink` | `#0a0a0b` | headings, primary button bg, high-emphasis text |
| `--color-slate` | `#52525b` | body text |
| `--color-muted` | `#a1a1aa` | captions, meta, placeholders |
| `--color-hairline` | `#e4e4e7` | borders, dividers |
| `--color-signal` | `#18181b` | active nav / link accent (near-black, not a hue) |
| `--wash` | `rgba(24,24,27,0.06)` | subtle tint |
| `--beam` | `linear-gradient(135deg,#3f3f46,#18181b)` | `.grad` — avatar/team tiles only |
| `--hero` | grayscale halo on `#fff` | **`.hero-aurora`** — the colorless ambient hero |

The only literal color anywhere is error red (`#dc2626`, `.badge-fail`). Nothing else is colored.

### Type scale
- Display (`.disp`, General Sans 600/700): `34px` hero H1 · `28px` page H1 · `18px` section H2 · `15px` card sub-head.
- Body (Inter): `15px` hero lead · `14px` · `13.5px` card title · `13px` controls · `12px` meta.
- Numerics: JetBrains Mono (`.mono`) — ratios, counts, dates-as-data.

### Radii / motion / elevation
- Radii: `999px` pills · `24px` panel · `22px` composer · `18px` card · `16px` dropzone · `12px` nav.
- Motion: `0.15–0.2s`; primary buttons lift `translateY(-1px)` on hover; sidebar width animates `0.2s`.
- Elevation: borders over shadows; panel and composer carry only a faint `shadow-sm`.

---

## 3. Shell & patterns

### App shell (`(app)/layout.tsx`)
`flex h-screen bg-[--frame]` → **Sidebar** (transparent, on the frame) + a padded region holding the
white **panel** (`rounded-[24px] border bg-paper overflow-hidden`, `relative`). The panel stacks the
transparent **Topbar** (absolute overlay) over the scrolling `main`.

### Sidebar (`components/Sidebar.tsx`)
Collapsible `248px ↔ 74px` (persisted to `localStorage: sentezy:sidebar-collapsed`); collapsed shows
centered icons + tooltips. Top-to-bottom: logo + collapse toggle → **TeamSwitcher** → nav
(Ana sayfa, Videolarım, Avatarlar, Ara) → divider → Yeni klasör → pinned footer (**50 kredi** pill +
**?** help). Active nav = raised **white** pill (`.nav-item[data-active]`) so it pops on the frame.

### TeamSwitcher (`components/TeamSwitcher.tsx`)
Workspace button (avatar tile + name + chevron) that opens the account menu (email, Ayarlar, Çıkış
yap). Replaces the old user-card/settings footer so nothing is lost.

### Topbar (`components/Topbar.tsx`)
Transparent overlay pinned to the panel's top: a mobile menu button (left) and the **MAX Al** upgrade
chip (right, `Icon.grid` + label, `bg-paper/80 backdrop-blur`). No title, no search, no theme toggle.

### Ambient hero
Home's hero is a **full-bleed** `.hero-aurora` band (negative margins cancel `main` padding) with the
grayscale halo bleeding to the panel edges behind the Topbar chip. Holds the welcome H1
("Sentezy'e hoş geldin"), a supporting line, a **Stil ⌄** dropdown (top-right), and the composer.

### Media composer (`components/MediaComposer.tsx`)
Upload-first card: a dashed **dropzone** (`+` tile, "Videonu sürükle ya da yükle", `(.mp4, .mov)`,
drag-highlight), then a toolbar — "Stil ekle" (`btn btn-ghost`) left, **"Videomu oluştur →"**
(`btn btn-primary`, ink) right. Picking a file is optional; the button always proceeds to `/create`.

### 9:16 card grid
`grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]` keeps thumbnails phone-sized.
Each `.card overflow-hidden` = `ph-stripe aspect-[9/16]` thumbnail + top-left status `.badge` + `p-3`
footer (title + `.mono` ratio). Used on Home ("Son videoların") and Library.

---

## 4. Reference → Sentezy mapping

| Captions (dark, colored) | Sentezy (light, monochrome) |
|---|---|
| Dark frame + lighter inset panel | Gray `--frame` + white floating panel |
| Aurora gradient hero (blue→amber) | Colorless `--hero` grayscale halo |
| Vivid cyan primary CTA | Solid ink pill CTA |
| "Import or drag your video" dropzone | `MediaComposer` — "Videonu sürükle ya da yükle" |
| "Edit / Captions ⇅" mode dropdown | "Stil ⌄" dropdown pill |
| "Berkan's Team ⌄" switcher | `TeamSwitcher` (name + account menu) |
| "Get MAX" gold chip | "MAX Al" hairline chip (grayscale) |
| Home/Avatars/Search nav, New folder | Ana sayfa/Videolarım/Avatarlar/Ara, Yeni klasör |
| Credits + help pinned bottom | 50 kredi pill + ? help pinned bottom |
| 9:16 template gallery | 9:16 `.card` grid ("Son videoların") |

**Deviation from the reference:** Sentezy keeps **Videolarım** in the nav (Captions has only
Home/Avatars/Search) because the video library is core. Avatarlar / Ara / Yeni klasör are
placeholders ("yakında") until their pages exist.

---

## 5. Do / Don't

**Do**
- Keep everything grayscale — ink/paper/slate/muted only.
- Reserve **ink** for the single primary action per view.
- Keep numerics in **mono**; prefer borders to shadows; hold the radius scale above.
- Keep the panel inset and the hero halo subtle.

**Don't**
- Add any brand hue or gradient color (error red excepted) — not even in the hero.
- Reintroduce a topbar search or theme toggle — the app is light-only.
- Put more than one hero or more than one primary CTA on a screen.
