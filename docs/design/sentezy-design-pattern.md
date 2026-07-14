# Sentezy Design Pattern

A light-theme, monochrome adaptation of the "Captions" studio feel. This is the reference for how
Sentezy's app screens should look and behave. It borrows Captions' *composition and interaction*
patterns — ambient hero, conversational composer, suggestion chips, 9:16 gallery, floating
workspace — while staying true to Sentezy's own identity.

---

## 1. Philosophy

- **Premium monochrome, light.** Ink on paper. Cool neutral grays. **No brand color** on controls,
  chips, cards, or text. This restraint is the brand.
- **Exactly one color moment.** The only place color appears is a **soft light aurora** behind the
  Home hero. Everything else stays neutral so that moment reads as intentional, not decorative.
- **Prompt-first, wizard-backed.** The Home screen opens with a conversational composer ("Ne
  tanıtmak istiyorsun?"). It is a friendly on-ramp; the real engine remains the 4-step create
  wizard. The composer seeds the wizard via `?prompt=`, it does not replace it.
- **Turkish copy**, always. General Sans for display, Inter for body/UI, JetBrains Mono for numerics.

---

## 2. Foundations

### Color tokens (light — the effective app palette in `apps/web/src/app/globals.css`)

| Token | Value | Use |
|---|---|---|
| `--color-paper` | `#ffffff` | surfaces, cards |
| `--color-mist` | `#f4f4f5` | app background, hover fills |
| `--color-ink` | `#0a0a0b` | headings, primary button bg, high-emphasis text |
| `--color-slate` | `#52525b` | body text |
| `--color-muted` | `#a1a1aa` | captions, meta, placeholders |
| `--color-hairline` | `#e4e4e7` | borders, dividers |
| `--color-signal` | `#18181b` | active nav / link accent (near-black, not a hue) |
| `--wash` | `rgba(24,24,27,0.06)` | subtle active/hover tint, icon chips |
| `--beam` | `linear-gradient(135deg,#3f3f46,#18181b)` | `.grad` (avatar, usage bar) |
| `--aurora` | peach→lilac→sky radial stack on `#fff` | **`.hero-aurora`** — the one color moment |

The only literal color anywhere else is error red (`#dc2626`, `.badge-fail`). Do not add others.

### Type scale
- Display (`.disp`, General Sans 600/700): `28px` page H1 · `22px` hero sub-head · `18px` section H2 · `15px` card sub-head.
- Body (Inter): `14.5px` lead · `13.5px` card title · `13px` controls/chips · `12px` meta.
- Numerics: JetBrains Mono (`.mono`, `.eyebrow`) — ratios, counts, step numbers, dates-as-data.

### Radii / motion / elevation
- Radii: `999px` pills (buttons, chips, badges) · `22px` hero · `20px` composer · `18px` card (`.card`) · `12px` nav item.
- Motion: `0.15–0.2s` transitions; primary buttons lift `translateY(-1px)` on hover.
- Elevation: borders over shadows. A faint `shadow-sm` is allowed on the composer only.

---

## 3. Patterns

### Aurora hero
A rounded `section.hero-aurora` (radius 22, hairline border) at the top of a screen. Holds the
greeting (`h1.disp text-[28px]`) + one supporting line + the primary entry action (composer on Home).
The aurora is deliberately faint — ink text must keep AA contrast on top. **One per screen, top only.**

### Prompt composer (`components/PromptComposer.tsx`)
The conversational on-ramp. A `.card rounded-[20px]` with:
- an auto-growing `<textarea>` (placeholder "Ne tanıtmak istiyorsun? …"),
- a toolbar: circular 📎 attach + "Stil ekle" (`btn btn-ghost`) on the left, **"Oluştur →"**
  (`btn btn-primary`, ink) on the right, disabled until there's text. `⌘/Ctrl+Enter` submits.
- Submitting routes to `/create?prompt=…`; the wizard seeds its script field from that param.

### Suggestion chips
Monochrome pills under the composer:
`rounded-full border border-hairline bg-paper px-3.5 py-1.5 text-[13px] font-medium text-slate hover:bg-mist`.
Clicking a chip fills the composer and focuses it. Never colored, never the primary action.

### 9:16 card grid
Video/template cards: `grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4`; each `.card
overflow-hidden` with a `ph-stripe relative aspect-[9/16]` thumbnail, a top-left status `.badge`,
and a `p-3` footer (title `text-[13.5px] font-semibold text-ink` + meta row with `.mono` ratio).
Used identically on Home ("Son videoların") and Library.

### Nav shell
- **Sidebar** (`components/Sidebar.tsx`): collapsible `264px ↔ 76px` (persisted to
  `localStorage: sentezy:sidebar-collapsed`); when collapsed, only centered icons + tooltips show.
  Icon+label nav; active item = `.nav-item[data-active]` (wash fill + signal text). Usage card +
  user menu pinned at the bottom.
- **Topbar** (`components/Topbar.tsx`): minimal — page title left; credits pill, notifications, and
  avatar right. **No search field, no theme toggle** (the app is light-only).

### Premium upsell (documented; use sparingly)
A single restrained upsell — a hairline chip with a faint amber edge (echoing Captions' "Get MAX")
or the sidebar's "Yükselt →". At most one per view; never competes with the primary ink CTA.

---

## 4. Reference → Sentezy mapping

| Captions (dark) | Sentezy (light, monochrome) |
|---|---|
| Aurora gradient hero (blue→amber→dark) | Soft light aurora (`--aurora`) behind the Home hero |
| Vivid cyan primary CTA | Solid ink (`--color-ink`) pill CTA |
| "How do you want to edit your video?" composer | `PromptComposer` — "Ne tanıtmak istiyorsun?" |
| Suggestion chips | Monochrome chips that pre-fill the composer |
| 9:16 template gallery | `.card` 9:16 grid ("Son videoların" / Library) |
| Inset floating workspace | Hero card + `bg-mist` body (full shell inset deferred) |
| "Get MAX" gold upsell | Restrained hairline/amber upsell (sparing) |
| Icon+label nav, credits pinned | Already matches — collapsible sidebar |

---

## 5. Do / Don't

**Do**
- Reserve **ink** for the single primary action per view.
- Keep all numerics in **mono**.
- Let the aurora be the only color, and only in the hero.
- Prefer **borders** to shadows; keep radii on the scale above.

**Don't**
- Add a brand hue to buttons, chips, cards, or text.
- Use color anywhere outside the hero aurora (error red excepted).
- Put more than one aurora hero or more than one primary CTA on a screen.
- Reintroduce a topbar search or theme toggle — the app is light-only.
