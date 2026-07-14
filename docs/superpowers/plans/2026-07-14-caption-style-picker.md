# Caption Style Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Altyazı" caption-style picker (chip + modal) to the Home `MediaComposer`, showing hundreds of presets over the worker's caption engine, plus 3 new worker render kinds.

**Architecture:** A generated preset catalog (engine × font × color) drives a modal that mirrors the Avatar/Ses/Geçiş pickers. Each preset maps to the already-plumbed `{captionStyle, captionFont, captionColor}`. A shared `CaptionSample` component renders both the picker tiles and the live `ReelPreview`. The worker gains 3 new caption `kind`s.

**Tech Stack:** Next.js (App Router) + React + Tailwind (web); Python + ffmpeg/libass (worker). No JS/py test harness in repo — verification is `typecheck` + `py_compile` + an ad-hoc ASS-assertion script + manual UI checks.

## Global Constraints

- **No git commits** — Berkan's rule: no branches/commits unless explicitly asked. Each task ends with a verification checkpoint instead of a commit. (Ignore the plan-template's commit steps.)
- **Node 24**, pnpm workspace. Web app is **light-only**, Turkish UI copy.
- **Show-but-disable** rule: controls are always visible, disabled (not hidden) until `hasScript`.
- Presets may use **only the 13 bundled fonts** (`apps/worker/fonts`): Anton, Archivo Black, Bebas Neue, Fredoka, General Sans, Inter, Kanit, Montserrat, Oswald, Poppins, Rubik, Sora, Teko.
- Worker falls back to `karaoke` for unknown `style`; web falls back to the default preset for an unresolved id.
- Verify web with: `pnpm --filter @sentezy/web typecheck`. Verify worker with: `python -m py_compile apps/worker/sentezy_worker/compose.py`.

---

## File Structure

- `apps/worker/sentezy_worker/compose.py` — **modify**: add `bubble`/`highlight`/`typewriter` to `_CAPTION_STYLES` + render branches in `build_captions_ass`.
- `apps/web/public/fonts/*` — **create**: copies of the 13 font files.
- `apps/web/src/app/globals.css` — **modify**: `@font-face` for the 13 families.
- `apps/web/src/lib/schemas.ts` — **modify**: extend `captionStyle` enum.
- `apps/web/src/lib/captionStyles.ts` — **create**: preset catalog + palette + helpers.
- `apps/web/src/components/CaptionSample.tsx` — **create**: shared caption renderer.
- `apps/web/src/components/ReelPreview.tsx` — **modify**: extend `captionStyle` union; render via `CaptionSample`.
- `apps/web/src/components/WizardSteps.tsx` — **modify**: extend caption style union(s) if present.
- `apps/web/src/components/MediaComposer.tsx` — **modify**: chip + modal + payload stash.
- `apps/web/src/components/CreateWizard.tsx` — **modify**: seed caption fields from pending-create.

---

## Task 1: Worker — 3 new caption engine kinds

**Files:**
- Modify: `apps/worker/sentezy_worker/compose.py` (`_CAPTION_STYLES` ~line 118; `build_captions_ass` render loop ~line 197-245)

**Interfaces:**
- Produces: three new `_CAPTION_STYLES` keys `"bubble"`, `"highlight"`, `"typewriter"` with `kind` values `"bubble"`, `"highlight"`, `"typewriter"`, consumed by web as valid `captionStyle` values.

- [ ] **Step 1: Read the current render loop** in `build_captions_ass` (lines ~197-250) to see how existing `kind`s (`karaoke`, `wordpop`, `phrase`, `box`, `keyword`) emit `Dialogue:` lines and use `chunk`, `primary`, `secondary`, `accent`, `_ass_time`, `border_style`.

- [ ] **Step 2: Add the 3 style specs** to `_CAPTION_STYLES` (after the `keyword` entry, before the closing brace):

```python
    # Bubble — each word in its own rounded pill; the spoken word's pill is accent.
    "bubble":     {"chunk": 3, "scale": 0.046, "min_size": 36, "bold": 1, "outline": 4, "shadow": 0, "kind": "bubble"},
    # Highlight — plain white phrase; the spoken word gets a filled accent marker.
    "highlight":  {"chunk": 4, "scale": 0.048, "min_size": 38, "bold": 1, "outline": 5, "shadow": 0, "kind": "highlight"},
    # Typewriter — words appear one-by-one, cumulative, no dimmed upcoming preview.
    "typewriter": {"chunk": 5, "scale": 0.044, "min_size": 34, "bold": 1, "outline": 5, "shadow": 0, "kind": "typewriter"},
```

- [ ] **Step 3: Add render branches** in the Dialogue-emission loop. For each chunk, after the existing `kind` branches, add:

```python
        elif kind == "bubble":
            # One event per word timing-window; the active word's pill uses the accent
            # colour (BorderStyle 3 = opaque box behind the glyphs).
            for j, w in enumerate(chunk):
                start = _ass_time(w.start)
                end = _ass_time(chunk[j + 1].start if j + 1 < len(chunk) else chunk[-1].end)
                parts = []
                for k, cw in enumerate(chunk):
                    box = accent if k == j else "&H80000000"  # active = accent, others = translucent black
                    parts.append(f"{{\\bord0\\shad0\\3a&H00&\\4a&HFF&\\1c&HFFFFFF&\\3c{box}\\p0}}{_ass_text(cw.text)}{{\\r}}")
                events.append(f"Dialogue: 0,{start},{end},Cap,,0,0,0,,{' '.join(parts)}")
        elif kind == "highlight":
            # Whole phrase white; the spoken word gets a filled accent highlighter box.
            for j, w in enumerate(chunk):
                start = _ass_time(w.start)
                end = _ass_time(chunk[j + 1].start if j + 1 < len(chunk) else chunk[-1].end)
                parts = []
                for k, cw in enumerate(chunk):
                    if k == j:
                        parts.append(f"{{\\bord0\\shad0\\3a&H10&\\1c&H000000&\\3c{accent}}}{_ass_text(cw.text)}{{\\r}}")
                    else:
                        parts.append(_ass_text(cw.text))
                events.append(f"Dialogue: 0,{start},{end},Cap,,0,0,0,,{' '.join(parts)}")
        elif kind == "typewriter":
            # Cumulative reveal: at word j, show words 0..j only.
            for j, w in enumerate(chunk):
                start = _ass_time(w.start)
                end = _ass_time(chunk[j + 1].start if j + 1 < len(chunk) else chunk[-1].end)
                shown = " ".join(_ass_text(cw.text) for cw in chunk[: j + 1])
                events.append(f"Dialogue: 0,{start},{end},Cap,,0,0,0,,{shown}")
```

> Note: use whatever the file already uses to append events / escape text. If there is no `_ass_text` helper, inline the same text-escaping the existing branches use (check the `keyword`/`phrase` branches). Match the existing variable names for the event list (`events`/`lines`) and the `Style` name (`Cap`).

- [ ] **Step 4: Verify the module compiles**

Run: `python -m py_compile apps/worker/sentezy_worker/compose.py`
Expected: no output (success).

- [ ] **Step 5: ASS-output smoke check** — create `apps/worker/.scratch/check_caption_kinds.py`:

```python
from sentezy_worker.compose import build_captions_ass, Word
words = [Word(text=w, start=i * 0.4, end=i * 0.4 + 0.4) for i, w in enumerate("bunu mutlaka gormen lazim simdi".split())]
for style in ("bubble", "highlight", "typewriter"):
    out = f"/tmp/caps_{style}.ass"
    build_captions_ass(words, out, color="#FFD54A", style=style)
    txt = open(out).read()
    assert "Dialogue:" in txt, style
    print(style, "OK", txt.count("Dialogue:"), "events")
```

Run: `cd apps/worker && .venv/bin/python -m check_caption_kinds` (or `PYTHONPATH=. .venv/bin/python .scratch/check_caption_kinds.py`)
Expected: `bubble OK …`, `highlight OK …`, `typewriter OK …` — each with ≥1 event.

- [ ] **Step 6: Checkpoint** — confirm the 3 kinds produce well-formed ASS. (No commit.)

---

## Task 2: Web — self-host the 13 fonts

**Files:**
- Create: `apps/web/public/fonts/` (13 files copied from `apps/worker/fonts`)
- Modify: `apps/web/src/app/globals.css` (append `@font-face` block)

**Interfaces:**
- Produces: 13 CSS font-family names available app-wide: `Anton`, `Archivo Black`, `Bebas Neue`, `Fredoka`, `General Sans`, `Inter`, `Kanit`, `Montserrat`, `Oswald`, `Poppins`, `Rubik`, `Sora`, `Teko`.

- [ ] **Step 1: Copy the font files**

```bash
mkdir -p apps/web/public/fonts
cp apps/worker/fonts/Anton.ttf apps/worker/fonts/ArchivoBlack.ttf apps/worker/fonts/BebasNeue.ttf \
   apps/worker/fonts/Fredoka.ttf apps/worker/fonts/Inter.ttf apps/worker/fonts/Kanit.ttf \
   apps/worker/fonts/Montserrat.ttf apps/worker/fonts/Oswald.ttf apps/worker/fonts/Poppins.ttf \
   apps/worker/fonts/Rubik.ttf apps/worker/fonts/Sora.ttf apps/worker/fonts/Teko.ttf \
   apps/worker/fonts/GeneralSans-Bold.otf \
   apps/web/public/fonts/
```

- [ ] **Step 2: Check whether General Sans is already declared** in `globals.css` (it's the app's brand font — it likely already has `@font-face`). If so, do NOT redeclare it; only add the other 12.

Run: `grep -n "General Sans\|@font-face" apps/web/src/app/globals.css`

- [ ] **Step 3: Append `@font-face` declarations** to `globals.css` for the 12 display fonts (skip General Sans if already present). Use `font-display: swap` and `local()` fallback:

```css
/* Caption preview fonts — mirror apps/worker/fonts so picker previews match burn-in. */
@font-face { font-family: "Anton"; src: local("Anton"), url("/fonts/Anton.ttf") format("truetype"); font-display: swap; }
@font-face { font-family: "Archivo Black"; src: local("Archivo Black"), url("/fonts/ArchivoBlack.ttf") format("truetype"); font-display: swap; }
@font-face { font-family: "Bebas Neue"; src: local("Bebas Neue"), url("/fonts/BebasNeue.ttf") format("truetype"); font-display: swap; }
@font-face { font-family: "Fredoka"; src: local("Fredoka"), url("/fonts/Fredoka.ttf") format("truetype"); font-display: swap; }
@font-face { font-family: "Inter"; src: local("Inter"), url("/fonts/Inter.ttf") format("truetype"); font-display: swap; }
@font-face { font-family: "Kanit"; src: local("Kanit"), url("/fonts/Kanit.ttf") format("truetype"); font-display: swap; }
@font-face { font-family: "Montserrat"; src: local("Montserrat"), url("/fonts/Montserrat.ttf") format("truetype"); font-display: swap; }
@font-face { font-family: "Oswald"; src: local("Oswald"), url("/fonts/Oswald.ttf") format("truetype"); font-display: swap; }
@font-face { font-family: "Poppins"; src: local("Poppins"), url("/fonts/Poppins.ttf") format("truetype"); font-display: swap; }
@font-face { font-family: "Rubik"; src: local("Rubik"), url("/fonts/Rubik.ttf") format("truetype"); font-display: swap; }
@font-face { font-family: "Sora"; src: local("Sora"), url("/fonts/Sora.ttf") format("truetype"); font-display: swap; }
@font-face { font-family: "Teko"; src: local("Teko"), url("/fonts/Teko.ttf") format("truetype"); font-display: swap; }
```

- [ ] **Step 4: Verify** the app still builds types

Run: `pnpm --filter @sentezy/web typecheck`
Expected: no errors (CSS doesn't affect types; this just confirms nothing else broke).

- [ ] **Step 5: Checkpoint** — fonts served from `/fonts/*`.

---

## Task 3: Web — extend the captionStyle enum

**Files:**
- Modify: `apps/web/src/lib/schemas.ts:29`

**Interfaces:**
- Produces: `captionStyle` enum now includes `"bubble" | "highlight" | "typewriter"`.

- [ ] **Step 1: Edit the enum** at `schemas.ts:29`:

```ts
  captionStyle: z.enum(["karaoke", "tiktok", "beast", "hormozi", "boxed", "clean", "keyword", "bubble", "highlight", "typewriter"]).default("karaoke"),
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @sentezy/web typecheck`
Expected: type errors may appear in `ReelPreview.tsx`/`CreateWizard.tsx`/`WizardSteps.tsx` where the union is hard-coded — those are fixed in Tasks 4/6/7. If the only errors are in those files, that's expected; otherwise fix here.

- [ ] **Step 3: Checkpoint.**

---

## Task 4: Web — `CaptionSample` component + `ReelPreview` refactor

**Files:**
- Create: `apps/web/src/components/CaptionSample.tsx`
- Modify: `apps/web/src/components/ReelPreview.tsx:15` (union) and the caption render block (~lines 232-296)

**Interfaces:**
- Produces:
  ```ts
  export type CaptionEngine =
    | "karaoke" | "tiktok" | "beast" | "hormozi" | "boxed" | "clean" | "keyword"
    | "bubble" | "highlight" | "typewriter";
  export function CaptionSample(props: {
    base: CaptionEngine; font: string; color: string;
    words: string[]; activeIndex: number; // -1 = all shown static
  }): JSX.Element;
  ```
- Consumes (from ReelPreview): existing `keywordIndex(words: string[]): number` helper — export it from `ReelPreview` or move it into `CaptionSample`. Move it into `CaptionSample.tsx` and re-import in `ReelPreview`.

- [ ] **Step 1: Create `CaptionSample.tsx`** porting the render logic from `ReelPreview.tsx` (lines 232-296), generalized over `base/font/color/words/activeIndex`, and add the 3 new kinds:

```tsx
"use client";

export type CaptionEngine =
  | "karaoke" | "tiktok" | "beast" | "hormozi" | "boxed" | "clean" | "keyword"
  | "bubble" | "highlight" | "typewriter";

const STOPWORDS = new Set([
  "ve","ile","bir","bu","şu","o","da","de","ki","mi","mı","için","ama","the","a","an","to","of","and","is","in","on","for","your","you",
]);

/** Pick a phrase's accent keyword — the longest non-stopword — mirroring the worker. */
export function keywordIndex(words: string[]): number {
  let best = -1, bestLen = 0;
  words.forEach((w, i) => {
    const t = w.toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]/gu, "");
    if (!t || STOPWORDS.has(t)) return;
    if (t.length > bestLen) { bestLen = t.length; best = i; }
  });
  return best;
}

export function CaptionSample({ base, font, color, words, activeIndex }: {
  base: CaptionEngine; font: string; color: string; words: string[]; activeIndex: number;
}) {
  if (words.length === 0) return null;
  const upper = base === "hormozi" || base === "beast";
  const wordAccent = base === "hormozi" || base === "tiktok" || base === "beast";
  const keyword = base === "keyword";
  const kwIndex = keyword ? keywordIndex(words) : -1;
  const active = activeIndex < 0 ? words.length - 1 : activeIndex; // static tile = last word active
  const sizeClass =
    base === "beast" ? "text-[22px] font-extrabold tracking-tight" :
    base === "hormozi" ? "text-[19px] font-extrabold tracking-tight" :
    base === "clean" || base === "typewriter" ? "text-[14px] font-semibold" :
    "text-[15px] font-bold";
  const family = `"${font}", sans-serif`;
  const shadowStrong = "0 0 4px rgba(0,0,0,0.95), 0 2px 3px rgba(0,0,0,0.9)";
  const shadowSoft = "0 0 3px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.85)";

  // boxed: one box hugging the whole phrase.
  if (base === "boxed") {
    return (
      <p className={`text-center leading-relaxed ${sizeClass}`} style={{ fontFamily: family }}>
        <span style={{ color: "#fff", background: "rgba(0,0,0,0.85)", padding: "2px 9px", borderRadius: 7, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
          {words.join(" ")}
        </span>
      </p>
    );
  }
  // typewriter: cumulative reveal up to the active word.
  if (base === "typewriter") {
    return (
      <p className={`text-center leading-snug ${sizeClass}`} style={{ fontFamily: family }}>
        <span style={{ color: "#fff", textShadow: shadowSoft }}>{words.slice(0, active + 1).join(" ")}</span>
      </p>
    );
  }
  return (
    <p className={`text-center leading-snug ${sizeClass}`} style={{ fontFamily: family }}>
      {words.map((word, i) => {
        const shown = activeIndex < 0 || i <= active;
        const isActive = i === active;
        // bubble: every word in a pill; active pill = accent, others translucent black.
        if (base === "bubble") {
          return (
            <span key={i} className="mx-0.5 inline-block rounded-md px-1.5 py-0.5" style={{ background: isActive ? color : "rgba(0,0,0,0.5)", color: isActive ? "#111" : "#fff", textShadow: isActive ? undefined : shadowSoft }}>
              {upper ? word.toLocaleUpperCase("tr") : word}
            </span>
          );
        }
        // highlight: white phrase; active word gets a filled accent marker.
        if (base === "highlight") {
          return (
            <span key={i} className="inline-block px-0.5" style={{ background: isActive ? color : "transparent", color: isActive ? "#111" : "#fff", borderRadius: 3, textShadow: isActive ? undefined : shadowSoft }}>
              {word}&nbsp;
            </span>
          );
        }
        const clr = keyword
          ? i === kwIndex ? color : "#fff"
          : wordAccent
            ? isActive ? color : "#fff"
            : base === "clean"
              ? "#fff"
              : shown ? "#fff" : "rgba(255,255,255,0.5)"; // karaoke: upcoming dimmed
        return (
          <span key={i} className="inline-block transition-colors duration-150" style={{ color: clr, textShadow: wordAccent || keyword ? shadowStrong : shadowSoft, transform: (wordAccent || keyword) && isActive ? "scale(1.07)" : undefined }}>
            {upper ? word.toLocaleUpperCase("tr") : word}&nbsp;
          </span>
        );
      })}
    </p>
  );
}
```

- [ ] **Step 2: Refactor `ReelPreview.tsx`** — extend its `captionStyle` union (line 15) to include the 3 new values, delete the local `STOPWORDS`/`keywordIndex` (now imported), and replace the inline caption block (lines ~232-296) with:

```tsx
{curWords.length > 0 ? (
  <CaptionSample base={captionStyle} font={captionFont} color={captionColor} words={curWords} activeIndex={localActive} />
) : (
  <p className="text-center text-[12.5px] font-medium text-white/45">Senaryo buraya gelecek</p>
)}
```
Add `import { CaptionSample } from "./CaptionSample";` and remove the now-unused `keywordIndex` local (or import it if still referenced elsewhere).

- [ ] **Step 3: Verify**

Run: `pnpm --filter @sentezy/web typecheck`
Expected: no errors in `ReelPreview.tsx` / `CaptionSample.tsx`.

- [ ] **Step 4: Manual sanity** — the existing draft preview still renders captions identically for the 7 original styles (run the app, open a draft with captions). No visual regression.

- [ ] **Step 5: Checkpoint.**

---

## Task 5: Web — preset catalog

**Files:**
- Create: `apps/web/src/lib/captionStyles.ts`

**Interfaces:**
- Consumes: `CaptionEngine` from `../components/CaptionSample`.
- Produces:
  ```ts
  export type CaptionPreset = { id: string; name: string; base: CaptionEngine; font: string; color: string; family: string };
  export const CAPTION_FONTS: string[];
  export const CAPTION_COLORS: { name: string; hex: string }[];
  export const CAPTION_FAMILIES: { key: CaptionEngine; label: string; accent: boolean }[];
  export const CAPTION_PRESETS: CaptionPreset[];
  export const DEFAULT_PRESET_ID: string;
  export function presetById(id: string): CaptionPreset;
  ```

- [ ] **Step 1: Create `captionStyles.ts`**:

```ts
import type { CaptionEngine } from "../components/CaptionSample";

export type CaptionPreset = { id: string; name: string; base: CaptionEngine; font: string; color: string; family: string };

export const CAPTION_FONTS = [
  "General Sans", "Anton", "Archivo Black", "Bebas Neue", "Fredoka",
  "Inter", "Kanit", "Montserrat", "Oswald", "Poppins", "Rubik", "Sora", "Teko",
];

export const CAPTION_COLORS = [
  { name: "Sarı", hex: "#FFD54A" }, { name: "Beyaz", hex: "#FFFFFF" }, { name: "Yeşil", hex: "#34D399" },
  { name: "Mavi", hex: "#38BDF8" }, { name: "Mor", hex: "#A78BFA" }, { name: "Pembe", hex: "#F472B6" },
  { name: "Kırmızı", hex: "#F87171" }, { name: "Turuncu", hex: "#FB923C" }, { name: "Lime", hex: "#A3E635" },
  { name: "Turkuaz", hex: "#22D3EE" }, { name: "Altın", hex: "#FBBF24" }, { name: "Menekşe", hex: "#C084FC" },
];

// accent=false families ignore colour (clean/typewriter) → generated white-only.
export const CAPTION_FAMILIES: { key: CaptionEngine; label: string; accent: boolean }[] = [
  { key: "karaoke", label: "Karaoke", accent: true },
  { key: "tiktok", label: "TikTok", accent: true },
  { key: "beast", label: "Beast", accent: true },
  { key: "hormozi", label: "Hormozi", accent: true },
  { key: "boxed", label: "Kutu", accent: false },
  { key: "keyword", label: "Anahtar", accent: true },
  { key: "bubble", label: "Baloncuk", accent: true },
  { key: "highlight", label: "Vurgu", accent: true },
  { key: "clean", label: "Sade", accent: false },
  { key: "typewriter", label: "Daktilo", accent: false },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

function build(): CaptionPreset[] {
  const out: CaptionPreset[] = [];
  for (const fam of CAPTION_FAMILIES) {
    for (const font of CAPTION_FONTS) {
      if (fam.accent) {
        for (const c of CAPTION_COLORS) {
          out.push({
            id: `${fam.key}-${slug(font)}-${slug(c.name)}`,
            name: `${fam.label} · ${font} · ${c.name}`,
            base: fam.key, font, color: c.hex, family: fam.label,
          });
        }
      } else {
        out.push({
          id: `${fam.key}-${slug(font)}`,
          name: `${fam.label} · ${font}`,
          base: fam.key, font, color: "#FFFFFF", family: fam.label,
        });
      }
    }
  }
  return out;
}

export const CAPTION_PRESETS = build();
export const DEFAULT_PRESET_ID = "karaoke-generalsans-sarı".normalize();
// slug() strips the Turkish "ı"? No — keep the real generated id:
export const DEFAULT_PRESET = CAPTION_PRESETS.find(
  (p) => p.base === "karaoke" && p.font === "General Sans" && p.color === "#FFD54A",
)!;
export function presetById(id: string): CaptionPreset {
  return CAPTION_PRESETS.find((p) => p.id === id) ?? DEFAULT_PRESET;
}
```

> Count sanity: 8 accent families × 13 fonts × 12 colors + 2 plain families × 13 fonts = 1248 + 26 = **1274 presets**. (Well past "hundreds".) If that feels too large for scroll, the modal's incremental reveal (Task 6) handles it; no need to trim here.

- [ ] **Step 2: Fix the `DEFAULT_PRESET_ID` line** — remove the broken `.normalize()` placeholder; export the real id from `DEFAULT_PRESET`:

```ts
export const DEFAULT_PRESET_ID = DEFAULT_PRESET.id;
```
(Delete the earlier `DEFAULT_PRESET_ID` line that used `.normalize()`.)

- [ ] **Step 3: Verify**

Run: `pnpm --filter @sentezy/web typecheck`
Expected: no errors.

- [ ] **Step 4: Count check** — `node -e "console.log(require('./apps/web/src/lib/captionStyles.ts'))"` won't work on TS; instead confirm via a temporary `console.log(CAPTION_PRESETS.length)` in the modal during Task 6, or trust the arithmetic (1274). Checkpoint.

---

## Task 6: Web — chip + modal in MediaComposer

**Files:**
- Modify: `apps/web/src/components/MediaComposer.tsx`

**Interfaces:**
- Consumes: `CAPTION_PRESETS`, `CAPTION_FAMILIES`, `CAPTION_FONTS`, `CAPTION_COLORS`, `DEFAULT_PRESET`, `presetById` from `@/lib/captionStyles`; `CaptionSample` from `./CaptionSample`.
- Produces: `pending-create` payload gains `caption: { style, font, color }`.

- [ ] **Step 1: Add imports** near the other imports:

```ts
import { CAPTION_PRESETS, CAPTION_FAMILIES, CAPTION_FONTS, CAPTION_COLORS, DEFAULT_PRESET, presetById } from "@/lib/captionStyles";
import { CaptionSample } from "./CaptionSample";
```

- [ ] **Step 2: Add state** (near the other `useState` hooks ~line 205):

```ts
  const [captionOpen, setCaptionOpen] = useState(false);
  const [captionId, setCaptionId] = useState(DEFAULT_PRESET.id);
  const [captionQ, setCaptionQ] = useState("");
  const [captionFamily, setCaptionFamily] = useState<string>("");   // "" = all
  const [captionFontF, setCaptionFontF] = useState<string>("");
  const [captionColorF, setCaptionColorF] = useState<string>("");
  const [captionFiltersOpen, setCaptionFiltersOpen] = useState(false);
  const [captionShown, setCaptionShown] = useState(60);             // incremental reveal
  const captionSentinelRef = useRef<HTMLDivElement>(null);
  const selectedCaption = presetById(captionId);
```

- [ ] **Step 3: Add the filtered list + sentinel effect** (near the other derived values):

```ts
  const SAMPLE_WORDS = ["Bunu", "MUTLAKA", "görmelisin"];
  const filteredCaptions = CAPTION_PRESETS.filter(
    (p) =>
      (!captionFamily || p.family === captionFamily) &&
      (!captionFontF || p.font === captionFontF) &&
      (!captionColorF || p.color === captionColorF) &&
      (!captionQ.trim() || p.name.toLocaleLowerCase("tr").includes(captionQ.trim().toLocaleLowerCase("tr"))),
  );
  const activeCaptionFilters = [captionFamily, captionFontF, captionColorF].filter(Boolean).length;
  useEffect(() => { setCaptionShown(60); }, [captionQ, captionFamily, captionFontF, captionColorF]);
  useEffect(() => {
    if (!captionOpen) return;
    const el = captionSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => { if (es[0]?.isIntersecting) setCaptionShown((n) => n + 60); });
    io.observe(el);
    return () => io.disconnect();
  }, [captionOpen, filteredCaptions.length]);
```

- [ ] **Step 4: Add the chip** after the voice chip (~line 553, before the effect chip):

```tsx
          {/* caption style chip */}
          <button
            type="button"
            onClick={() => setCaptionOpen(true)}
            disabled={!hasScript}
            title={!hasScript ? "Önce konuşma metnini yaz" : undefined}
            className="flex items-center gap-2 rounded-full border border-hairline bg-paper py-1 pl-1 pr-3 text-[13px] font-medium text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="flex h-7 w-11 flex-none items-center justify-center overflow-hidden rounded-full bg-black text-[8px]">
              <span style={{ color: selectedCaption.color, fontFamily: `"${selectedCaption.font}", sans-serif`, fontWeight: 800 }}>Aa</span>
            </span>
            {selectedCaption.family}
            <Icon.chevronDown width={14} height={14} className="text-muted" />
          </button>
```

- [ ] **Step 5: Add the modal** after the voice picker modal block (find the voice picker's closing `)}` and insert after it):

```tsx
      {/* caption style picker */}
      {captionOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <button type="button" aria-label="Kapat" onClick={() => setCaptionOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
          <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
            <div className="flex-none px-5 pt-5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
              <div className="mb-1 flex items-start justify-between gap-3">
                <h3 className="disp mt-0.5 text-[18px] font-semibold text-ink">Altyazı stili</h3>
                <button type="button" onClick={() => setCaptionOpen(false)} aria-label="Kapat" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
                  <Icon.close width={18} height={18} className="block" />
                </button>
              </div>
              <div className="mb-3 mt-2 flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Icon.search width={15} height={15} /></span>
                  <input value={captionQ} onChange={(e) => setCaptionQ(e.target.value)} placeholder="Stil ara…" className="w-full rounded-full border border-hairline bg-paper py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition focus:border-signal" />
                </div>
                <button type="button" onClick={() => setCaptionFiltersOpen(true)} className="flex flex-none items-center gap-1.5 rounded-full border border-hairline bg-paper px-3.5 py-2 text-[13px] font-medium text-slate transition hover:bg-mist">
                  <Icon.filter width={16} height={16} />
                  Filtrele
                  {activeCaptionFilters > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-paper">{activeCaptionFilters}</span>}
                </button>
              </div>
            </div>

            <div className="no-scrollbar overflow-y-auto px-5 py-4">
              {filteredCaptions.length === 0 ? (
                <div className="py-10 text-center text-[14px] text-muted">Stil bulunamadı</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {filteredCaptions.slice(0, captionShown).map((p) => {
                      const sel = captionId === p.id;
                      return (
                        <button key={p.id} type="button" onClick={() => setCaptionId(p.id)} className="group text-left">
                          <div className={`relative grid aspect-video place-items-center overflow-hidden rounded-lg border bg-black px-2 transition ${sel ? "border-ink ring-2 ring-ink" : "border-hairline hover:border-slate"}`}>
                            <CaptionSample base={p.base} font={p.font} color={p.color} words={SAMPLE_WORDS} activeIndex={-1} />
                            {sel && (
                              <span className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-paper">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
                              </span>
                            )}
                          </div>
                          <div className={`mt-1.5 truncate px-0.5 text-[11px] font-medium ${sel ? "text-ink" : "text-slate"}`}>{p.family} · {p.font}</div>
                        </button>
                      );
                    })}
                  </div>
                  {captionShown < filteredCaptions.length && <div ref={captionSentinelRef} className="h-8" />}
                </>
              )}
            </div>

            <div className="flex flex-none justify-end px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3">
              <button type="button" onClick={() => setCaptionOpen(false)} className="btn btn-primary min-w-28">Tamam</button>
            </div>
          </div>

          {/* nested filters sheet */}
          {captionFiltersOpen && (
            <div className="absolute inset-0 z-20 flex items-end justify-center sm:items-center sm:p-4">
              <button type="button" aria-label="Kapat" onClick={() => setCaptionFiltersOpen(false)} className="absolute inset-0 bg-black/40" />
              <div className="sheet-in relative z-10 w-full max-w-md rounded-t-3xl bg-paper p-5 shadow-2xl sm:rounded-[22px] sm:border sm:border-hairline">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-[15px] font-semibold text-ink">Filtrele</h4>
                  <button type="button" onClick={() => { setCaptionFamily(""); setCaptionFontF(""); setCaptionColorF(""); }} className="text-[12.5px] font-medium text-slate hover:text-ink">Temizle</button>
                </div>
                <div className="mb-4">
                  <div className="mb-2 text-[12px] font-semibold text-muted">Tür</div>
                  <div className="flex flex-wrap gap-1.5">
                    {CAPTION_FAMILIES.map((f) => (
                      <button key={f.key} type="button" onClick={() => setCaptionFamily(captionFamily === f.label ? "" : f.label)} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition ${captionFamily === f.label ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist"}`}>{f.label}</button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <div className="mb-2 text-[12px] font-semibold text-muted">Yazı tipi</div>
                  <div className="flex flex-wrap gap-1.5">
                    {CAPTION_FONTS.map((f) => (
                      <button key={f} type="button" onClick={() => setCaptionFontF(captionFontF === f ? "" : f)} style={{ fontFamily: `"${f}", sans-serif` }} className={`rounded-full border px-3 py-1 text-[13px] transition ${captionFontF === f ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist"}`}>{f}</button>
                    ))}
                  </div>
                </div>
                <div className="mb-2">
                  <div className="mb-2 text-[12px] font-semibold text-muted">Renk</div>
                  <div className="flex flex-wrap gap-2">
                    {CAPTION_COLORS.map((c) => (
                      <button key={c.hex} type="button" onClick={() => setCaptionColorF(captionColorF === c.hex ? "" : c.hex)} aria-label={c.name} className={`h-7 w-7 rounded-full border-2 transition ${captionColorF === c.hex ? "border-ink" : "border-hairline"}`} style={{ background: c.hex }} />
                    ))}
                  </div>
                </div>
                <button type="button" onClick={() => setCaptionFiltersOpen(false)} className="btn btn-primary mt-5 w-full justify-center">Uygula</button>
              </div>
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 6: Stash caption in the payload** — edit `create()` (line 396-401):

```ts
    const preset = presetById(captionId);
    const payload = {
      media: ready.map((i) => ({ ref: i.ref, url: i.serverUrl, kind: i.kind, transition: tr })),
      script: script.trim() || undefined,
      avatar: selectedAvatar ? { id: selectedAvatar.id, name: selectedAvatar.name } : undefined,
      voice: selectedVoice ? { id: selectedVoice.id } : undefined,
      caption: { style: preset.base, font: preset.font, color: preset.color },
    };
```

- [ ] **Step 7: Verify**

Run: `pnpm --filter @sentezy/web typecheck`
Expected: no errors.

- [ ] **Step 8: Manual** — run the app, upload media, type a script, open "Altyazı", confirm: hundreds of tiles, search narrows, Filtrele (Tür/Yazı tipi/Renk) narrows, selecting shows the ring + updates the chip, scrolling loads more.

- [ ] **Step 9: Checkpoint.**

---

## Task 7: Web — seed caption fields in CreateWizard

**Files:**
- Modify: `apps/web/src/components/CreateWizard.tsx` (pending-create effect, ~lines 277-289)

**Interfaces:**
- Consumes: `pending-create` payload's new `caption: { style, font, color }`.

- [ ] **Step 1: Extend the payload type** (line ~277):

```ts
      const p = JSON.parse(raw) as {
        media?: { ref: string; url?: string; kind: "image" | "video"; transition?: string }[];
        script?: string;
        avatar?: { id: string; name: string };
        voice?: { id: string };
        caption?: { style?: string; font?: string; color?: string };
      };
```

- [ ] **Step 2: Seed the values** (after the `if (p.avatar?.id) setPendingAvatar(p.avatar);` line):

```ts
      if (p.caption?.style) setValue("captionStyle", p.caption.style as CreateReelValues["captionStyle"]);
      if (p.caption?.font) setValue("captionFont", p.caption.font);
      if (p.caption?.color) setValue("captionColor", p.caption.color);
```
> If `CreateReelValues` isn't imported, cast to the existing type used by `setValue` for `captionStyle`, mirroring how the draft-restore block at lines 216-218 does it.

- [ ] **Step 3: Verify**

Run: `pnpm --filter @sentezy/web typecheck`
Expected: no errors.

- [ ] **Step 4: End-to-end manual** — from Home: upload → script → pick a non-default caption style (e.g. "Baloncuk · Bebas · Mavi") → Video oluştur → on `/create`, confirm the preview shows that caption style/font/color. Then generate and confirm the burned video matches (or defer to the render follow-up).

- [ ] **Step 5: Checkpoint.**

---

## Self-Review

**Spec coverage:**
- New worker kinds → Task 1. ✓
- Bundled-font preview parity → Task 2. ✓
- Enum extension → Task 3. ✓
- Reusable `CaptionSample` + ReelPreview refactor → Task 4. ✓
- Preset catalog (hundreds) → Task 5. ✓
- Chip + modal + search + Filtrele + incremental reveal + payload → Task 6. ✓
- Wizard seeding → Task 7. ✓

**Placeholder scan:** Task 5 intentionally flags & fixes the `DEFAULT_PRESET_ID`/`.normalize()` misstep inline (Step 2). No other placeholders.

**Type consistency:** `CaptionEngine` defined in Task 4, imported by Tasks 5/6. `captionStyle` enum (Task 3) values match `CaptionEngine` members and worker `_CAPTION_STYLES` keys (Task 1). `presetById`/`DEFAULT_PRESET` names consistent across Tasks 5/6/7.

**Known follow-up (non-blocking):** full ffmpeg/libass render test of `bubble`/`highlight`/`typewriter` on the Docker image — the ASS uses per-word `\3c`/BorderStyle tricks validated only by string output locally.
