# AI Sound Effects (Remotion preview + ffmpeg final) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An AI reads the script, picks sound effects and places them at specific words (voice-timed) and at slide transitions (slide-synced); the user hears them in a Remotion preview, and they are baked into the final ffmpeg-rendered video.

**Architecture:** A free OpenRouter model (compose-time, in the API) returns SFX cues anchored to a word index. The cue's word index is resolved to seconds by each environment using its own word timings — the web preview uses estimated timings (`tokenizeScript`), the worker uses real ElevenLabs timings. The web preview is a new preview-only Remotion `<Player>` composition; the final video stays on the existing ffmpeg `compose_reel`, extended to inject the cue audio into its audio bed. **No Remotion final-render / compositor rebuild.**

**Tech Stack:** TypeScript (Fastify 5 API, Next.js web, `@remotion/player`), Python worker (ffmpeg), `@sentezy/types` (zod, shared), OpenRouter (OpenAI-compatible free models).

## Global Constraints

- **Node/tooling:** repo uses `pnpm` workspaces + `tsx`; the API is ESM Fastify 5. TS gate is `pnpm typecheck` (no vitest/jest anywhere — do not add one).
- **Worker:** Python managed by `uv`; lint is `ruff`. Tests: add `pytest` as a dev dep (`uv add --dev pytest`) for the worker helpers only.
- **Shared tokenization contract (MUST be identical in TS and Python):** strip bracketed emotion tags matching `\[[a-zA-Z][^\]]*\]`, then `trim()` and split on `\s+`, dropping empty tokens. This defines `wordIndex`.
- **SFX id contract:** `SFX_META` in `@sentezy/types` is the single source of truth. SFX files are named `{id}.mp3`. Web serves them from `apps/web/public/sfx/`; the worker reads them from `apps/worker/sfx/library/`.
- **Free-model env:** reuse existing `OPENROUTER_API_KEY`; add `OPENROUTER_SFX_MODEL` with a comma-separated free-model fallback chain (mirror `OPENROUTER_VISION_MODEL`).
- **Degradation:** any AI/parse/asset failure → drop SFX (empty cues / skipped cue); never break generation. The final render is the existing ffmpeg path — this feature only adds inputs to its audio bed.
- **Turkish UI copy** (the app UI is Turkish).
- **Distinct toggles:** `effects.transitionSfx` (existing, slide whooshes) is separate from the new `sfx.enabled` (AI voice-timed SFX). Do not merge them.

### v1 scope cut (explicit, not a placeholder)

The preview's **B-roll visual** is the first uploaded image as a static backdrop (plus avatar still + live captions). **Multi-clip slide-transition *visuals* in the preview are deferred.** The **slide-synced SFX audio still plays** in the preview (whoosh cues placed at computed slide times), so both "voice-timed" and "slide-synced" SFX are audible. The final ffmpeg video keeps its real B-roll slideshow + whooshes unchanged.

---

## Contracts (names/types used across tasks)

```ts
// @sentezy/types
SfxId               // union of SFX_META[].id
SfxCue = { sfxId: SfxId; wordIndex: number; gain: number }
ReelOptions.sfx = { enabled: boolean; cues: SfxCue[] }
tokenizeScript(script: string): string[]
```
```ts
// apps/api/src/lib/sfx.ts
sfxEnabled(): boolean
suggestSfxCues(script: string): Promise<SfxCue[]>   // guarded, returns [] on any failure
```
```ts
// packages/remotion (preview-only)
type ResolvedSfxCue = { src: string; time: number; gain: number }
SfxTrack(props: { cues: ResolvedSfxCue[]; fps: number })
ReelPreview(props: {
  words: CaptionWord[]; avatarImageUrl?: string | null;
  backdropUrl?: string | null; captionStyle: {...}; layout: {...};
  captions: boolean; sfxCues: ResolvedSfxCue[];
})
```
```python
# apps/worker
tokenize_script(script: str) -> list[str]
sfx_file(sfx_id: str) -> str | None            # path in sfx/library/, or None
resolve_sfx_cues(cues: list[dict], words: list[Word], tokens: list[str]) -> list[dict]
    # -> [{"path": str, "time": float, "gain": float}]
compose_reel(..., sfx_cues: list[dict] | None = None)
_append_audio_bed(..., sfx_gains: list[float] | None = None)
```

---

## Task 1: SFX types + tokenizer in `@sentezy/types`

**Files:**
- Modify: `packages/types/src/index.ts` (add SFX section near the old templates location ~line 57; extend `ReelOptions`)

**Interfaces:**
- Produces: `SFX_META`, `SfxId`, `SFX_IDS`, `Sfx`, `SfxCue`, `tokenizeScript`, `ReelOptions.sfx`.

- [ ] **Step 1: Add the SFX registry + cue schema + tokenizer.** Insert after the `CaptionStyle` block (~line 55), before the B-roll section:

```ts
// ── Sound effects ───────────────────────────────────────────────────────────
// CANONICAL SFX registry — the single source of truth for the AI-placed sound
// effects. The AI (POST /videos/suggest-sfx) chooses from these ids; files are
// named {id}.mp3 and live in apps/web/public/sfx (preview) + apps/worker/sfx/library (render).
export const SFX_META = [
  { id: "whoosh",   label: "Whoosh",   tags: ["transition", "swipe", "scene change"] },
  { id: "ding",     label: "Ding",     tags: ["highlight", "correct", "notify", "point"] },
  { id: "pop",      label: "Pop",      tags: ["appear", "bubble", "reveal small"] },
  { id: "boom",     label: "Boom",     tags: ["impact", "big reveal", "emphasis"] },
  { id: "applause", label: "Applause", tags: ["success", "celebrate", "win"] },
  { id: "cash",     label: "Cash",     tags: ["money", "sale", "price", "discount"] },
  { id: "riser",    label: "Riser",    tags: ["buildup", "tension", "anticipation"] },
  { id: "click",    label: "Click",    tags: ["tap", "select", "ui"] },
  { id: "swoosh",   label: "Swoosh",   tags: ["fast", "motion", "swipe"] },
  { id: "sparkle",  label: "Sparkle",  tags: ["magic", "shine", "premium"] },
  { id: "airhorn",  label: "Airhorn",  tags: ["hype", "attention", "drop"] },
  { id: "thud",     label: "Thud",     tags: ["drop", "land", "heavy"] },
  { id: "bell",     label: "Bell",     tags: ["notify", "alert", "correct"] },
  { id: "record_scratch", label: "Record scratch", tags: ["stop", "wait", "twist"] },
  { id: "whistle",  label: "Whistle",  tags: ["rise", "fall", "cartoon"] },
  { id: "camera",   label: "Camera",   tags: ["photo", "snapshot", "capture"] },
] as const;

export type SfxId = (typeof SFX_META)[number]["id"];
export const SFX_IDS = SFX_META.map((s) => s.id) as unknown as [SfxId, ...SfxId[]];
export const Sfx = z.enum(SFX_IDS);

/** One placed sound effect: which SFX, anchored to which tokenizeScript() word index. */
export const SfxCue = z.object({
  sfxId: Sfx,
  wordIndex: z.number().int().min(0),
  gain: z.number().min(0).max(1).default(0.7),
});
export type SfxCue = z.infer<typeof SfxCue>;

/**
 * Canonical script tokenization — the contract that makes SfxCue.wordIndex mean the
 * same thing on the web (estimated timing) and in the worker (real TTS timing).
 * MUST match apps/worker tokenize_script: strip [emotion] tags, split on whitespace.
 */
export function tokenizeScript(script: string): string[] {
  return script
    .replace(/\[[a-zA-Z][^\]]*\]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}
```

- [ ] **Step 2: Extend `ReelOptions` with the `sfx` field.** In the `ReelOptions = z.object({ ... })` block, add (near `effects`):

```ts
  // AI voice-timed sound effects (POST /videos/suggest-sfx). Separate from
  // effects.transitionSfx (the automatic slide whooshes).
  sfx: z
    .object({
      enabled: z.boolean().default(false),
      cues: z.array(SfxCue).default([]),
    })
    .default({ enabled: false, cues: [] }),
```

- [ ] **Step 3: Verify it typechecks.**

Run: `pnpm --filter @sentezy/types typecheck` (or `cd packages/types && pnpm typecheck`)
Expected: PASS, no errors.

- [ ] **Step 4: Smoke-test the tokenizer** (no test runner — use `tsx`, already a dev dep):

Run:
```bash
cd packages/types && npx tsx -e "import {tokenizeScript} from './src/index.ts'; const t=tokenizeScript('[excited] Bu  hafta   indirim!'); console.log(JSON.stringify(t)); if(t.length!==3||t[0]!=='Bu'){process.exit(1)}"
```
Expected: prints `["Bu","hafta","indirim!"]` and exits 0.

- [ ] **Step 5: Commit.**
```bash
git add packages/types/src/index.ts
git commit -m "feat(types): add SFX registry, SfxCue schema, tokenizeScript, ReelOptions.sfx"
```

---

## Task 2: OpenRouter SFX client in the API

**Files:**
- Modify: `apps/api/src/env.ts` (add `OPENROUTER_SFX_MODEL`)
- Create: `apps/api/src/lib/sfx.ts`

**Interfaces:**
- Consumes: `SFX_META`, `SfxCue`, `tokenizeScript` from `@sentezy/types`; `env` from `../env`.
- Produces: `sfxEnabled(): boolean`, `suggestSfxCues(script: string): Promise<SfxCue[]>`.

- [ ] **Step 1: Add the env var.** In `apps/api/src/env.ts`, next to `OPENROUTER_VISION_MODEL`:

```ts
  // Text-only "suggest sound effects" pass (lib/sfx.ts). Comma-separated free-model
  // fallback chain (free models 429 often). Empty OPENROUTER_API_KEY = endpoint no-ops.
  OPENROUTER_SFX_MODEL: z
    .string()
    .default("google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,google/gemini-2.5-flash"),
```

- [ ] **Step 2: Create `apps/api/src/lib/sfx.ts`** (mirrors `lib/emotion.ts` OpenRouter call, JSON output):

```ts
import { SFX_META, SfxCue, type SfxId, tokenizeScript } from "@sentezy/types";
import { env } from "../env";

const VALID_IDS = new Set<string>(SFX_META.map((s) => s.id));
const MAX_CUES = 12;

/** True when the endpoint can run (an OpenRouter key is configured). */
export function sfxEnabled(): boolean {
  return Boolean(env.OPENROUTER_API_KEY);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callModel(key: string, model: string, messages: unknown): Promise<string | null> {
  for (const wait of [0, 1500]) {
    if (wait) await sleep(wait);
    let res: Response;
    try {
      res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://sentezy.app",
          "X-Title": "Sentezy",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.4,
          max_tokens: 1200,
          response_format: { type: "json_object" },
        }),
      });
    } catch {
      continue;
    }
    if (res.status === 429 || res.status >= 500) continue;
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }> }
      | null;
    return (json?.choices?.[0]?.message?.content ?? "").trim();
  }
  return null;
}

const SYSTEM = `You place short sound effects into a Turkish short-video script.
You are given the script split into NUMBERED WORDS and a PALETTE of allowed sound effects.
Return ONLY JSON: {"cues":[{"sfxId":"<palette id>","wordIndex":<int>,"gain":0.7}]}.
RULES:
1. Use ONLY sfxId values from the palette. Anchor each cue to the wordIndex where the sound should hit.
2. Be sparing: about 3 to 8 cues total for a normal script; fewer is fine. Never more than ${MAX_CUES}.
3. Match meaning: price/indirim -> cash, success/win -> applause, big reveal -> boom, scene change -> whoosh, etc.
4. gain is 0..1 (default 0.7; louder hits up to ~0.85, subtle ones ~0.5).
5. Do not place two cues on the same word. Output nothing but the JSON object.`;

/** Ask the free model to place SFX. Returns validated cues; [] on any failure. */
export async function suggestSfxCues(script: string): Promise<SfxCue[]> {
  const key = env.OPENROUTER_API_KEY;
  if (!key) return [];
  const tokens = tokenizeScript(script);
  if (tokens.length === 0) return [];

  const palette = SFX_META.map((s) => `${s.id} (${s.tags.join(", ")})`).join("\n");
  const numbered = tokens.map((t, i) => `${i}:${t}`).join(" ");
  const user = `PALETTE:\n${palette}\n\nWORDS (index:word):\n${numbered}`;
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ];

  for (const model of env.OPENROUTER_SFX_MODEL.split(",").map((m) => m.trim()).filter(Boolean)) {
    const raw = await callModel(key, model, messages);
    if (!raw) continue;
    const cues = parseCues(raw, tokens.length);
    if (cues.length > 0) return cues;
  }
  return [];
}

/** Parse + hard-validate model JSON into safe cues (drop anything invalid). */
export function parseCues(raw: string, tokenCount: number): SfxCue[] {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    // tolerate code fences / stray prose around the JSON
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return [];
    try {
      obj = JSON.parse(m[0]);
    } catch {
      return [];
    }
  }
  const arr = (obj as { cues?: unknown })?.cues;
  if (!Array.isArray(arr)) return [];
  const seen = new Set<number>();
  const out: SfxCue[] = [];
  for (const item of arr) {
    const parsed = SfxCue.safeParse(item);
    if (!parsed.success) continue;
    const { sfxId, wordIndex } = parsed.data;
    if (!VALID_IDS.has(sfxId as SfxId)) continue;
    if (wordIndex < 0 || wordIndex >= tokenCount) continue;
    if (seen.has(wordIndex)) continue;
    seen.add(wordIndex);
    out.push(parsed.data);
    if (out.length >= MAX_CUES) break;
  }
  return out;
}
```

- [ ] **Step 3: Verify typecheck.**

Run: `cd apps/api && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Smoke-test `parseCues` guards** (pure function, via `tsx`):

Run:
```bash
cd apps/api && npx tsx -e "import {parseCues} from './src/lib/sfx.ts'; \
const a=parseCues('{\"cues\":[{\"sfxId\":\"cash\",\"wordIndex\":2,\"gain\":0.7},{\"sfxId\":\"nope\",\"wordIndex\":1},{\"sfxId\":\"ding\",\"wordIndex\":999}]}',5); \
console.log(JSON.stringify(a)); if(a.length!==1||a[0].sfxId!=='cash'){process.exit(1)}"
```
Expected: prints one cue (`cash@2`); unknown id + out-of-range dropped; exit 0.

- [ ] **Step 5: Commit.**
```bash
git add apps/api/src/env.ts apps/api/src/lib/sfx.ts
git commit -m "feat(api): OpenRouter SFX suggestion client with hard-validated cue parsing"
```

---

## Task 3: `POST /videos/suggest-sfx` route

**Files:**
- Modify: `apps/api/src/routes/videos.ts` (imports + one new handler; mirror `enhance-emotion`)

**Interfaces:**
- Consumes: `suggestSfxCues`, `sfxEnabled` from `../lib/sfx`.
- Produces: HTTP `POST /videos/suggest-sfx { script } -> { cues: SfxCue[]; enabled: boolean }`.

- [ ] **Step 1: Add imports + local body schema.** At the top of `videos.ts`, add to the import block and near `EnhanceEmotionBody`:

```ts
import { sfxEnabled, suggestSfxCues } from "../lib/sfx";
// ...
const SuggestSfxBody = z.object({ script: z.string().min(1).max(5000) });
```

- [ ] **Step 2: Add the handler** inside `videoRoutes`, next to `enhance-emotion`:

```ts
  app.post("/videos/suggest-sfx", { preHandler: app.authenticate }, async (req, reply) => {
    const parsed = SuggestSfxBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    if (!sfxEnabled()) {
      return reply.send({ cues: [], enabled: false });
    }
    const cues = await suggestSfxCues(parsed.data.script);
    return reply.send({ cues, enabled: true });
  });
```

- [ ] **Step 3: Verify typecheck.**

Run: `cd apps/api && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Manual run check.** Start the API (`pnpm --filter @sentezy/api dev`) and, with a valid bearer token, POST `{"script":"Bu hafta büyük indirim başladı"}` to `/videos/suggest-sfx`. Expected: `200` with `{ "cues": [...], "enabled": true }` (or `enabled:false` if `OPENROUTER_API_KEY` unset). If unauthenticated → `401`.

- [ ] **Step 5: Commit.**
```bash
git add apps/api/src/routes/videos.ts
git commit -m "feat(api): POST /videos/suggest-sfx endpoint"
```

---

## Task 4: Worker SFX library mapping + tokenizer + alignment (pytest)

**Files:**
- Create: `apps/worker/sentezy_worker/sfx.py`
- Create: `apps/worker/tests/test_sfx.py`
- Modify: `apps/worker/pyproject.toml` (add `pytest` dev dep — via `uv add --dev pytest`)

**Interfaces:**
- Consumes: `Word` from `.compose`.
- Produces: `tokenize_script`, `sfx_file`, `resolve_sfx_cues`.

- [ ] **Step 1: Add pytest.**
```bash
cd apps/worker && uv add --dev pytest
```

- [ ] **Step 2: Write the failing test** `apps/worker/tests/test_sfx.py`:

```python
from sentezy_worker.compose import Word
from sentezy_worker.sfx import tokenize_script, resolve_sfx_cues


def test_tokenize_matches_ts_contract():
    assert tokenize_script("[excited] Bu  hafta   indirim!") == ["Bu", "hafta", "indirim!"]
    assert tokenize_script("") == []


def _words(n):
    return [Word(text=str(i), start=float(i), end=float(i) + 0.5) for i in range(n)]


def test_resolve_one_to_one_when_counts_match(monkeypatch):
    monkeypatch.setattr("sentezy_worker.sfx.sfx_file", lambda sid: f"/lib/{sid}.mp3")
    tokens = ["a", "b", "c", "d"]
    words = _words(4)
    cues = [{"sfxId": "cash", "wordIndex": 2, "gain": 0.7}]
    out = resolve_sfx_cues(cues, words, tokens)
    assert out == [{"path": "/lib/cash.mp3", "time": 2.0, "gain": 0.7}]


def test_resolve_proportional_when_counts_differ(monkeypatch):
    monkeypatch.setattr("sentezy_worker.sfx.sfx_file", lambda sid: f"/lib/{sid}.mp3")
    tokens = ["a", "b", "c", "d"]      # 4 canonical tokens
    words = _words(8)                  # 8 real TTS words
    cues = [{"sfxId": "ding", "wordIndex": 3, "gain": 0.6}]
    out = resolve_sfx_cues(cues, words, tokens)
    # 3/4 * (8-1) = 5.25 -> round 5 -> words[5].start == 5.0
    assert out == [{"path": "/lib/ding.mp3", "time": 5.0, "gain": 0.6}]


def test_missing_file_skips_cue(monkeypatch):
    monkeypatch.setattr("sentezy_worker.sfx.sfx_file", lambda sid: None)
    out = resolve_sfx_cues([{"sfxId": "cash", "wordIndex": 0, "gain": 0.7}], _words(2), ["a", "b"])
    assert out == []
```

- [ ] **Step 3: Run it to confirm it fails.**

Run: `cd apps/worker && uv run pytest tests/test_sfx.py -q`
Expected: FAIL (`ModuleNotFoundError: sentezy_worker.sfx`).

- [ ] **Step 4: Implement `apps/worker/sentezy_worker/sfx.py`:**

```python
from __future__ import annotations

import os
import re

from .compose import Word

_SFX_LIB_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "sfx", "library"))
_TAG_RE = re.compile(r"\[[a-zA-Z][^\]]*\]")


def tokenize_script(script: str) -> list[str]:
    """Canonical tokenization — MUST match @sentezy/types tokenizeScript:
    strip [emotion] tags, split on whitespace, drop empties."""
    stripped = _TAG_RE.sub(" ", script).strip()
    return [t for t in re.split(r"\s+", stripped) if t]


def sfx_file(sfx_id: str) -> str | None:
    """Absolute path to the bundled {id}.mp3, or None if not present."""
    path = os.path.join(_SFX_LIB_DIR, f"{sfx_id}.mp3")
    return path if os.path.isfile(path) else None


def resolve_sfx_cues(cues: list[dict], words: list[Word], tokens: list[str]) -> list[dict]:
    """Map word-anchored cues to concrete audio: [{path, time, gain}].

    time = start of the ElevenLabs word aligned to cue.wordIndex. 1:1 by index when the
    canonical token count equals the TTS word count (the norm — emotion tagging preserves
    words); otherwise proportional. Cues with no bundled file are skipped."""
    if not cues or not words or not tokens:
        return []
    n_tok = len(tokens)
    n_word = len(words)
    out: list[dict] = []
    for cue in cues:
        idx = int(cue.get("wordIndex", -1))
        if idx < 0 or idx >= n_tok:
            continue
        path = sfx_file(str(cue.get("sfxId", "")))
        if not path:
            continue
        if n_tok == n_word:
            w = words[idx]
        else:
            w = words[min(n_word - 1, max(0, round(idx / n_tok * (n_word - 1))))]
        gain = float(cue.get("gain", 0.7))
        out.append({"path": path, "time": float(w.start), "gain": max(0.0, min(1.0, gain))})
    return out
```

- [ ] **Step 5: Run the tests to verify they pass.**

Run: `cd apps/worker && uv run pytest tests/test_sfx.py -q`
Expected: PASS (4 passed).

- [ ] **Step 6: Commit.**
```bash
git add apps/worker/sentezy_worker/sfx.py apps/worker/tests/test_sfx.py apps/worker/pyproject.toml apps/worker/uv.lock
git commit -m "feat(worker): SFX library mapping, tokenizer, cue->time alignment (+pytest)"
```

---

## Task 5: Inject SFX cues into `compose_reel`'s audio bed

**Files:**
- Modify: `apps/worker/sentezy_worker/compose.py` (`_append_audio_bed` gains param; `compose_reel` `sfx_cues` param + input wiring)

**Interfaces:**
- Consumes: resolved cues `[{path, time, gain}]`.
- Produces: `compose_reel(..., sfx_cues=...)`, `_append_audio_bed(..., sfx_gains=...)`.

- [ ] **Step 1: Add per-cue gains to `_append_audio_bed`.** Change its signature and the SFX volume line:

Signature — add after `sfx_times`:
```python
    sfx_times: list[float],
    sfx_gains: list[float] | None = None,
) -> list[str]:
```
Inside the `if sfx_input_idxs:` loop, replace the `volume={SFX_VOLUME}` line with a per-index gain:
```python
        delayed = []
        for k, in_idx in enumerate(sfx_input_idxs):
            ms = max(0, int(round(sfx_times[k] * 1000)))
            vol = (sfx_gains[k] if sfx_gains is not None and k < len(sfx_gains) else SFX_VOLUME)
            fc.append(f"[{in_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,silenceremove=start_periods=1:start_threshold=-50dB,volume={vol},adelay={ms}|{ms}[wd{k}]")
            delayed.append(f"[wd{k}]")
```
(The transition whooshes call this without `sfx_gains`, so they keep `SFX_VOLUME` — unchanged behaviour.)

- [ ] **Step 2: Add `sfx_cues` to `compose_reel`.** Add the parameter (near `transition_sfx`):
```python
    transition_sfx: bool = True,  # whoosh SFX at each photo transition
    sfx_cues: list[dict] | None = None,  # AI voice-timed SFX: [{path, time, gain}]
) -> None:
```

- [ ] **Step 3: Feed the cues through as extra SFX inputs.** **Insertion point is critical:** add this immediately after the transition-SFX `for k in range(len(sfx_times))` loop and **BEFORE the caption-overlay input block** (`caption_idx = idx; if caption_overlay: inputs += [...]`). The caption overlay is added "last so no index shifts" and computes `caption_idx = idx` dynamically — inserting AI-cue inputs before it keeps `caption_idx` correct; inserting after it would corrupt the video filtergraph. Add:

```python
    # AI voice-timed SFX: one input per cue, mixed like the whooshes but at per-cue gain.
    sfx_gains: list[float] = [SFX_VOLUME] * len(sfx_input_idxs)
    for cue in (sfx_cues or []):
        inputs += ["-i", cue["path"]]
        sfx_input_idxs.append(idx)
        sfx_times.append(float(cue["time"]))
        sfx_gains.append(float(cue["gain"]))
        idx += 1
```

- [ ] **Step 4: Pass `sfx_gains` into the audio-bed call.** Find the `_append_audio_bed(` call inside `compose_reel` and add the argument:
```python
    audio_map = _append_audio_bed(
        fc,
        voice_idx=avatar_idx,
        music_idx=music_idx,
        music_volume=music_volume,
        sfx_input_idxs=sfx_input_idxs,
        sfx_times=sfx_times,
        sfx_gains=sfx_gains,
    )
```
(Confirm the exact existing kwargs match this call site; only add `sfx_gains=sfx_gains`.)

- [ ] **Step 5: Verify the module imports and the filtergraph builds** (no test runner for ffmpeg output — syntax + import check):

Run: `cd apps/worker && uv run python -c "import sentezy_worker.compose as c; print('ok')"`
Expected: prints `ok`.
Run: `cd apps/worker && uv run ruff check sentezy_worker/compose.py`
Expected: no errors.

- [ ] **Step 6: Commit.**
```bash
git add apps/worker/sentezy_worker/compose.py
git commit -m "feat(worker): inject AI SFX cues into compose_reel audio bed (per-cue gain)"
```

---

## Task 6: Wire resolved cues through `pipeline.py`

**Files:**
- Modify: `apps/worker/sentezy_worker/pipeline.py` (imports; resolve cues; pass to `compose_reel`)

**Interfaces:**
- Consumes: `tokenize_script`, `resolve_sfx_cues` from `.sfx`; `options.sfx`.

- [ ] **Step 1: Import the helpers.** Add near the other provider imports:
```python
from .sfx import resolve_sfx_cues, tokenize_script
```

- [ ] **Step 2: Resolve cues before the `compose_reel(` call.** In `process_video`, just before `compose_reel(` is invoked, add:
```python
    sfx_opt = options.get("sfx") or {}
    sfx_cues_resolved: list[dict] = []
    if sfx_opt.get("enabled") and sfx_opt.get("cues"):
        try:
            sfx_cues_resolved = resolve_sfx_cues(sfx_opt["cues"], words, tokenize_script(script))
        except Exception as e:  # noqa: BLE001 — SFX are optional; never fail the job
            print(f"pipeline: sfx cue resolution failed ({e}); continuing without AI SFX")
            sfx_cues_resolved = []
```
(`words` is the ElevenLabs word list already produced by TTS earlier in `process_video`; `script` is the script variable used for TTS. Confirm both names at the call site.)

- [ ] **Step 3: Pass into `compose_reel`.** Add `sfx_cues=sfx_cues_resolved,` to the `compose_reel(` call args.

- [ ] **Step 4: Verify import + lint.**

Run: `cd apps/worker && uv run python -c "import sentezy_worker.pipeline; print('ok')"`
Expected: `ok`.
Run: `cd apps/worker && uv run ruff check sentezy_worker/pipeline.py`
Expected: no errors.

- [ ] **Step 5: Commit.**
```bash
git add apps/worker/sentezy_worker/pipeline.py
git commit -m "feat(worker): resolve options.sfx cues and pass to compose_reel"
```

---

## Task 7: Remotion preview component (`SfxTrack` + `ReelPreview`)

**Files:**
- Create: `packages/remotion/src/preview/SfxTrack.tsx`
- Create: `packages/remotion/src/preview/ReelPreview.tsx`
- Modify: `packages/remotion/src/index.ts` (export both + `ResolvedSfxCue` type)

**Interfaces:**
- Consumes: `CaptionOverlay`, `CaptionWord` (existing exports).
- Produces: `ReelPreview`, `SfxTrack`, type `ResolvedSfxCue`. Preview-only (never registered in `Root.tsx`).

- [ ] **Step 1: Create `SfxTrack.tsx`:**

```tsx
import React from "react";
import { Audio, Sequence } from "remotion";

export type ResolvedSfxCue = { src: string; time: number; gain: number };

/** Plays each resolved SFX cue at its frame. Used only in the web <Player> preview. */
export const SfxTrack: React.FC<{ cues: ResolvedSfxCue[]; fps: number }> = ({ cues, fps }) => (
  <>
    {cues.map((c, i) => (
      <Sequence key={i} from={Math.max(0, Math.round(c.time * fps))}>
        <Audio src={c.src} volume={Math.max(0, Math.min(1, c.gain))} />
      </Sequence>
    ))}
  </>
);
```

- [ ] **Step 2: Create `ReelPreview.tsx`** (avatar still + backdrop + captions + SFX):

```tsx
import React from "react";
import { AbsoluteFill, Img, useVideoConfig } from "remotion";
import { CaptionOverlay } from "../CaptionOverlay";
import type { CaptionOverlayProps, CaptionWord } from "../types";
import { type ResolvedSfxCue, SfxTrack } from "./SfxTrack";

export type ReelPreviewProps = {
  words: CaptionWord[];
  avatarImageUrl?: string | null;
  backdropUrl?: string | null;
  captionStyle: { styleId: CaptionOverlayProps["styleId"]; font: string; color: string };
  layout: CaptionOverlayProps["layout"];
  position: CaptionOverlayProps["position"];
  avatarSide: CaptionOverlayProps["avatarSide"];
  captions: boolean;
  sfxCues: ResolvedSfxCue[];
};

/**
 * Preview-only reel: static B-roll backdrop + avatar still + live captions + SFX audio.
 * Renders in the web <Player> only (NOT registerRoot / renderMedia). v1 shows the first
 * B-roll image as a static backdrop; slide-transition visuals are deferred (SFX audio still plays).
 */
export const ReelPreview: React.FC<ReelPreviewProps> = ({
  words,
  avatarImageUrl,
  backdropUrl,
  captionStyle,
  layout,
  position,
  avatarSide,
  captions,
  sfxCues,
}) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b0d" }}>
      {backdropUrl && (
        <Img src={backdropUrl} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.8)" }} />
      )}
      {avatarImageUrl && (
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: avatarSide === "left" ? "flex-start" : "flex-end" }}>
          <Img src={avatarImageUrl} style={{ height: "58%", objectFit: "contain" }} />
        </AbsoluteFill>
      )}
      {captions && (
        <CaptionOverlay
          words={words}
          styleId={captionStyle.styleId}
          font={captionStyle.font}
          color={captionStyle.color}
          layout={layout}
          position={position}
          avatarSide={avatarSide}
        />
      )}
      <SfxTrack cues={sfxCues} fps={fps} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Export from `packages/remotion/src/index.ts`:**
```ts
export { ReelPreview } from "./preview/ReelPreview";
export type { ReelPreviewProps } from "./preview/ReelPreview";
export { SfxTrack, type ResolvedSfxCue } from "./preview/SfxTrack";
```

- [ ] **Step 4: Verify typecheck.** (Confirm the `CaptionOverlayProps` field names — `styleId`, `layout`, `position`, `avatarSide` — match `types.ts`; adjust if the real prop names differ.)

Run: `cd packages/remotion && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add packages/remotion/src/preview packages/remotion/src/index.ts
git commit -m "feat(remotion): preview-only ReelPreview + SfxTrack (captions + SFX audio)"
```

---

## Task 8: SFX assets + web cue-resolution helper

**Files:**
- Create: `apps/web/public/sfx/` (the {id}.mp3 files — see Task 11) + `apps/web/public/sfx/LICENSES.md`
- Create: `apps/web/src/lib/sfxPreview.ts`

**Interfaces:**
- Consumes: `SFX_META`, `SfxCue`, `tokenizeScript` from `@sentezy/types`; `ResolvedSfxCue` from `@sentezy/remotion`.
- Produces: `resolvePreviewSfx(script, cues): ResolvedSfxCue[]`, `sfxSrc(id): string`.

> Note: Task 11 sources the actual audio files. This task can proceed with a couple of placeholder mp3s so the code path is exercised; Task 11 fills the full library.

- [ ] **Step 1: Create `apps/web/src/lib/sfxPreview.ts`:**

```ts
import { staticFile } from "remotion";
import type { ResolvedSfxCue } from "@sentezy/remotion";
import { type SfxCue, tokenizeScript } from "@sentezy/types";

const PER_WORD = 0.42; // MUST match captionPreview.ts estimated timing

/** Public URL for a bundled SFX id (served from apps/web/public/sfx). */
export function sfxSrc(id: string): string {
  return staticFile(`sfx/${id}.mp3`);
}

/**
 * Resolve word-anchored cues to preview times using the SAME estimated timing the caption
 * preview uses (PER_WORD per token). Independent of captionPreview's 14-word display cap so
 * later cues still play.
 */
export function resolvePreviewSfx(script: string, cues: SfxCue[]): ResolvedSfxCue[] {
  const nTokens = tokenizeScript(script).length;
  return cues
    .filter((c) => c.wordIndex >= 0 && c.wordIndex < nTokens)
    .map((c) => ({ src: sfxSrc(c.sfxId), time: c.wordIndex * PER_WORD, gain: c.gain }));
}
```

- [ ] **Step 2: Add a temporary `whoosh.mp3` + `cash.mp3`** to `apps/web/public/sfx/` (any short royalty-free mp3) so the import path resolves during dev. Full set arrives in Task 11.

- [ ] **Step 3: Verify typecheck.**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit.**
```bash
git add apps/web/src/lib/sfxPreview.ts apps/web/public/sfx
git commit -m "feat(web): SFX asset dir + preview cue-time resolver"
```

---

## Task 9: `useSuggestSfx` hook + settings toggle

**Files:**
- Modify: `apps/web/src/lib/queries.ts` (add `useSuggestSfx`)
- Modify: `apps/web/src/lib/composerSettings.ts` (add `sfxEnabled`)
- Modify: `apps/web/src/components/composer/SettingsDrawer.tsx` (add the toggle)

**Interfaces:**
- Produces: `useSuggestSfx()` mutation → `{ cues: SfxCue[]; enabled: boolean }`; `ComposerSettings.sfxEnabled`.

- [ ] **Step 1: Add the hook** to `queries.ts` (mirrors `useVoicePreview`):
```ts
import type { SfxCue } from "@sentezy/types";
// ...
/** Ask the API to place AI sound effects for a script. */
export function useSuggestSfx() {
  return useMutation({
    mutationFn: (script: string) =>
      apiFetch<{ cues: SfxCue[]; enabled: boolean }>("/videos/suggest-sfx", {
        method: "POST",
        body: JSON.stringify({ script }),
      }),
  });
}
```

- [ ] **Step 2: Add the setting.** In `composerSettings.ts`, add `sfxEnabled: boolean;` to `ComposerSettings` and `sfxEnabled: false,` to `DEFAULT_SETTINGS`. Keep `src/lib/schemas.ts` in sync if it mirrors these fields.

- [ ] **Step 3: Add the toggle** to `SettingsDrawer.tsx` (copy the "Geçiş efekti sesi" `<Field>` block, swapping `transitionSfx` → `sfxEnabled`):
```tsx
<Field label="Yapay zekâ ses efektleri">
  <button
    type="button"
    role="switch"
    aria-checked={settings.sfxEnabled}
    onClick={() => set("sfxEnabled", !settings.sfxEnabled)}
    className="flex items-center gap-2.5 text-[12.5px] font-medium text-ink"
  >
    <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${settings.sfxEnabled ? "bg-ink" : "bg-hairline"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${settings.sfxEnabled ? "left-[18px]" : "left-0.5"}`} />
    </span>
    {settings.sfxEnabled ? "Açık" : "Kapalı"}
  </button>
</Field>
```

- [ ] **Step 4: Verify typecheck.**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add apps/web/src/lib/queries.ts apps/web/src/lib/composerSettings.ts apps/web/src/components/composer/SettingsDrawer.tsx
git commit -m "feat(web): useSuggestSfx hook + AI-SFX settings toggle"
```

---

## Task 10: Preview modal/player + MediaComposer wiring

**Files:**
- Create: `apps/web/src/components/composer/SfxPreviewModal.tsx`
- Modify: `apps/web/src/components/MediaComposer.tsx` (Önizle button, cue fetch, `options.sfx`)

**Interfaces:**
- Consumes: `ReelPreview` (`@sentezy/remotion`), `LoopingPreview`, `resolvePreviewSfx`, `sfxSrc`, `useSuggestSfx`, `previewWords`.

- [ ] **Step 1: Create `SfxPreviewModal.tsx`** — a modal that renders `ReelPreview` in `LoopingPreview`, computing SFX cues (voice-timed from `resolvePreviewSfx` + slide whooshes at backdrop time 0 for v1):

```tsx
"use client";

import { ReelPreview } from "@sentezy/remotion";
import type { SfxCue } from "@sentezy/types";
import { useMemo } from "react";
import { previewWords } from "@/lib/captionPreview";
import { resolvePreviewSfx, sfxSrc } from "@/lib/sfxPreview";
import { LoopingPreview } from "./LoopingPreview";

const FPS = 30;
const W = 1080;
const H = 1920;

export function SfxPreviewModal({
  open,
  onClose,
  script,
  cues,
  captionStyle,
  layout,
  avatarImageUrl,
  backdropUrl,
  captions,
}: {
  open: boolean;
  onClose: () => void;
  script: string;
  cues: SfxCue[];
  captionStyle: { styleId: string; font: string; color: string };
  layout: { avatarLayout: "side" | "bottom"; avatarSide: "left" | "right"; captionPosition: "top" | "bottom" };
  avatarImageUrl?: string | null;
  backdropUrl?: string | null;
  captions: boolean;
}) {
  const words = useMemo(() => previewWords(script), [script]);
  const sfxCues = useMemo(() => resolvePreviewSfx(script, cues), [script, cues]);
  const durationInFrames = useMemo(() => {
    const last = words.length > 0 ? words[words.length - 1]!.end : 5;
    return Math.max(1, Math.ceil((last + 0.6) * FPS));
  }, [words]);

  if (!open) return null;
  const inputProps = {
    words,
    avatarImageUrl: avatarImageUrl ?? null,
    backdropUrl: backdropUrl ?? null,
    captionStyle: { styleId: captionStyle.styleId as never, font: captionStyle.font, color: captionStyle.color },
    layout: layout.avatarLayout,
    position: layout.captionPosition,
    avatarSide: layout.avatarSide,
    captions,
    sfxCues,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px]">
        <div className="flex items-center justify-between px-5 pt-5">
          <h3 className="disp text-[18px] font-semibold text-ink">Önizleme</h3>
          <button type="button" onClick={onClose} className="text-[13px] text-muted">Kapat</button>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-hidden px-5 py-4">
          <div className="overflow-hidden rounded-[26px] bg-black shadow-xl" style={{ aspectRatio: "9 / 16", height: "min(64vh, 560px)" }}>
            <LoopingPreview
              component={ReelPreview}
              inputProps={inputProps}
              durationInFrames={durationInFrames}
              fps={FPS}
              compositionWidth={W}
              compositionHeight={H}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>
        <div className="px-5 py-3 text-[12px] text-muted">Örnek zamanlama — ses efektleri gerçek seslendirmeye göre hizalanır</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `MediaComposer.tsx`.** Add state + the hook, an "Önizle" button, cue fetch on open, the modal, and `sfx` in `options`. Specifically:

Add near the other hooks:
```tsx
import { useSuggestSfx } from "@/lib/queries";
import { SfxPreviewModal } from "./composer/SfxPreviewModal";
// ...
const suggestSfx = useSuggestSfx();
const [previewOpen, setPreviewOpen] = useState(false);
const [sfxCues, setSfxCues] = useState<import("@sentezy/types").SfxCue[]>([]);

async function openPreview() {
  setPreviewOpen(true);
  if (settings.sfxEnabled && script.trim() && sfxCues.length === 0) {
    try {
      const { cues } = await suggestSfx.mutateAsync(script.trim());
      setSfxCues(cues);
    } catch { /* preview still works without SFX */ }
  }
}
```

Add the "Önizle" button (in the controls row):
```tsx
<button type="button" onClick={openPreview} disabled={!hasScript}
  title={!hasScript ? "Önce konuşma metnini yaz" : "Reklamı önizle"}
  className="flex items-center gap-2 rounded-full border border-hairline bg-paper py-1 pl-2.5 pr-3 text-[13px] font-medium text-ink transition hover:bg-mist disabled:opacity-45">
  <Icon.play width={14} height={14} className="text-slate" />
  Önizle
</button>
```

Add the modal before the closing `</div>` of the component:
```tsx
<SfxPreviewModal
  open={previewOpen}
  onClose={() => setPreviewOpen(false)}
  script={script}
  cues={sfxCues}
  captionStyle={{ styleId: selectedCaption.base, font: selectedCaption.font, color: selectedCaption.color }}
  layout={{ avatarLayout: settings.avatarLayout, avatarSide: settings.avatarSide, captionPosition: settings.captionPosition }}
  avatarImageUrl={selectedAvatar?.imageUrl ?? null}
  backdropUrl={items.find((i) => i.kind === "image")?.serverUrl ?? items[0]?.url ?? null}
  captions
/>
```

- [ ] **Step 3: Include cues in the generate payload.** In `create()`'s `options` object, ensure cues are fetched (fallback) then add the `sfx` key:
```tsx
// before building options, ensure cues exist if enabled:
let cuesForRender = sfxCues;
if (settings.sfxEnabled && cuesForRender.length === 0 && script.trim()) {
  try { cuesForRender = (await suggestSfx.mutateAsync(script.trim())).cues; } catch { cuesForRender = []; }
}
// ...in options:
sfx: { enabled: settings.sfxEnabled, cues: cuesForRender },
```

- [ ] **Step 4: Verify typecheck + lint-free build.**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add apps/web/src/components/composer/SfxPreviewModal.tsx apps/web/src/components/MediaComposer.tsx
git commit -m "feat(web): SFX preview modal + Önizle button + options.sfx wiring"
```

---

## Task 11: Source the curated SFX library

**Files:**
- Create: `apps/web/public/sfx/{id}.mp3` for every `SFX_META` id
- Create: `apps/worker/sfx/library/{id}.mp3` for every `SFX_META` id
- Create: `apps/web/public/sfx/LICENSES.md` (and `apps/worker/sfx/library/LICENSES.md`)

- [ ] **Step 1: Collect royalty-free mp3s** (e.g. CC0 from freesound.org / Pixabay) for all 16 ids in `SFX_META`: `whoosh, ding, pop, boom, applause, cash, riser, click, swoosh, sparkle, airhorn, thud, bell, record_scratch, whistle, camera`. Keep each short (<2s except `applause`/`riser`), normalized, mono/stereo 44.1kHz.

- [ ] **Step 2: Place identical files in both dirs**, named exactly `{id}.mp3`.

- [ ] **Step 3: Record licenses** in `LICENSES.md` (source URL + license per file), mirroring `apps/web/public/fonts/LICENSE-*`.

- [ ] **Step 4: Verify presence** (every id has a file in both dirs):
```bash
cd /Users/berkan/Projects/sentezy && for id in whoosh ding pop boom applause cash riser click swoosh sparkle airhorn thud bell record_scratch whistle camera; do \
  [ -f "apps/web/public/sfx/$id.mp3" ] && [ -f "apps/worker/sfx/library/$id.mp3" ] && echo "ok $id" || echo "MISSING $id"; done
```
Expected: `ok` for all 16.

- [ ] **Step 5: Commit.**
```bash
git add apps/web/public/sfx apps/worker/sfx/library
git commit -m "feat(assets): curated royalty-free SFX library (16 effects) + licenses"
```

---

## Task 12: End-to-end verification

- [ ] **Step 1: Preview path.** Run web + API in dev. Upload an image, write a Turkish script mentioning a price/discount and a "win" moment, enable "Yapay zekâ ses efektleri", click **Önizle**. Confirm: captions animate, the avatar still + backdrop show, and you **hear** SFX (e.g. `cash` near "indirim", `applause` near a success word). Toggle SFX off → no SFX in a fresh preview.

- [ ] **Step 2: Final render path.** Generate the video (dev mode: no HeyGen). In the worker logs confirm cue resolution ran; download the MP4 and confirm the SFX are present and land on the spoken words (real timing) alongside the existing transition whooshes.

- [ ] **Step 3: Degradation.** With `OPENROUTER_API_KEY` unset, confirm `/videos/suggest-sfx` returns `{enabled:false,cues:[]}`, the preview still plays (no SFX), and generation still succeeds.

- [ ] **Step 4: Full typecheck sweep.**
```bash
cd /Users/berkan/Projects/sentezy && pnpm -r typecheck && (cd apps/worker && uv run pytest -q && uv run ruff check .)
```
Expected: all PASS.

- [ ] **Step 5: Commit any final fixes**, then the feature is complete.
