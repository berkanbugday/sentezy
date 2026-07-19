# Avatar variety & distinctiveness — design

**Date:** 2026-07-19
**Status:** Approved direction, spec under review
**Scope of this task:** Rewrite the portrait **prompt engine** only. **No image regeneration, no HeyGen renders, no re-seed.** Deliverable is a new `build_prompt()` + supporting pools in `apps/worker/scripts/build_avatar_catalog.py`, producing an updated `apps/api/src/data/avatars.json` that Berkan reviews as text/JSON. Regeneration (OpenAI credits) and HeyGen validation happen later, when he chooses.

## Problem

Two pieces of user feedback (2026-07-19, with screenshots):

1. **Repetitive motion.** Every avatar makes the same fidgety hand/arm movement. Users want variety — including avatars holding a microphone and speaking into one.
2. **Look-alikes.** Avatars of the same ethnicity/gender look like siblings (Defne/Deniz, Zeynep/Ece; men too). Women in beauty / cosmetics / e-commerce / conservative sectors should read **younger and more well-groomed**. No two avatars should ever look alike.

## Root cause

Both trace to `build_prompt()` in `apps/worker/scripts/build_avatar_catalog.py` (currently ~line 151):

- **Motion:** HeyGen Avatar IV animates from the still portrait's pose. Every prompt bakes in the identical pose — *"both arms and hands fully visible in a natural, relaxed talking gesture"* + a clipped lavalier mic. Identical starting pose → identical HeyGen gesture loop, and the mic is never held.
- **Look-alikes:** The prompt is fully templated. A persona's only varying inputs are `sector` (→ profession + attire) and the coarse `age`/`ethnicity`/`gender` descriptors. There is **zero per-persona facial variation**, so every young Turkish woman renders from the same description.

Fixing the prompt fixes both — but only takes visual effect on regeneration.

## Design

Three additions to `build_avatar_catalog.py`, all deterministic (re-runs stay stable, like the existing name-cursor logic) and reviewable as text.

### A. Distinctiveness engine — per-persona feature seeds

Add curated descriptor **pools** and assign each persona a **unique combination**, so no two personas of the same `(ethnicity, gender)` share the same face.

Pools (final wording refined during implementation; representative content):

- **`FACE_SHAPES`** (shared): oval, round, square-jawed, heart-shaped, long/oblong, angular with defined cheekbones, soft-rounded, diamond.
- **`HAIR_WOMEN`** (non-hijab): long straight, long loose waves, shoulder-length blunt bob, sleek low bun, high ponytail, voluminous curls, short textured pixie, layered mid-length, side-swept, half-up.
- **`HAIR_MEN`**: short crop, textured quiff, neat side part, slicked-back, buzz cut, short curls, medium wavy, man-bun.
- **`FACIAL_HAIR_MEN`**: clean-shaven, light stubble, designer stubble, short full trimmed beard, goatee, longer groomed beard.
- **`HAIR_COLORS`** — **ethnicity-gated** so colors stay plausible: Turkish/Mediterranean/Middle-Eastern → {jet black, dark brown, chestnut, dark auburn}; European → {blonde, light brown, auburn, dark blonde}; East-Asian → {black, dark brown}; Black African → {black, dark brown} (+ natural texture styles); South-Asian → {black, dark brown}; Latin American → {dark brown, black, chestnut}.
- **`COMPLEXIONS`** — ethnicity-gated to a plausible sub-range (e.g. Turkish → fair-to-olive; Black African → medium-to-deep brown), so distinctiveness never pushes a persona off its ethnicity.
- **`BUILDS`**: slim, average, athletic/toned, broad-shouldered, petite, tall and lean.
- **`DISTINGUISHING`**: light freckles, dimples, prominent cheekbones, warm smile lines, stylish eyeglasses, a small beauty mark, expressive eyebrows, a defined jawline, kind eyes with laugh lines. (For men, eyeglasses/beard interplay handled so combos stay coherent.)

**Uniqueness mechanism (deterministic).** For each persona, maintain a per-`(ethnicity, gender)` counter (mirrors the existing `name_cursor`). Derive each attribute index from that counter using **distinct coprime strides** so combinations spread rather than move in lockstep. Track a `used_combos` set keyed on the salient tuple `(face_shape, hair_style, distinguishing)`; on collision, bump the counter until the combo is unique. Pool sizes are chosen so the largest bucket (Turkish women, ~30+ personas) cannot exhaust unique combos.

**Named-cluster overrides.** For the specific look-alike pairs the user called out, hard-assign clearly divergent feature sets so they visibly differ:
- Defne vs. Deniz (Turkish women)
- Zeynep vs. Ece (Turkish women)
Implemented as an optional `FEATURE_OVERRIDES: dict[slug, dict]` consulted before the pool draw. Extensible for any future cluster.

### B. Pose palette — motion variety + microphones

Replace the single universal pose with a `POSES` dict of ~6 poses, each a prompt fragment describing hands/arms and (where relevant) a microphone:

| key | description in prompt | mic |
|---|---|---|
| `calm` | hands resting low / lightly clasped at waist, calm and still, minimal gesturing | lavalier clipped at collar |
| `open_gesture` | one hand raised in a soft open-palm gesture, the other relaxed at the side | lavalier clipped at collar |
| `mic_speaking` | holding a handheld microphone and speaking into it, mic held just below and to the side of the mouth (mouth fully visible, never covered) | handheld |
| `mic_chest` | holding a handheld microphone at chest height, ready to speak | handheld |
| `presenting` | one open hand gesturing to the side as if presenting a product or space, body angled slightly | lavalier clipped at collar |
| `arms_crossed` | arms lightly and confidently crossed at chest, relaxed shoulders | lavalier clipped at collar |

**Hard constraint (lip-sync safety):** handheld-mic poses keep the mic **below/beside the mouth, never occluding it**, and the existing "no hands covering the face" clause stays. This protects HeyGen lip-sync.

**Assignment.** A `SECTOR_POSES: dict[sector, list[pose_key]]` affinity map lists the poses that suit each sector; the persona's per-sector rotation index picks one, so same-sector personas don't all land on the same pose. Affinities (initial):
- Handheld mic (`mic_speaking`, `mic_chest`): influencer, coaching, corporate, education.
- Presenting: ecommerce, fashion, jewelry, realestate, beauty, cosmetics.
- Arms crossed: construction, automotive, tech, legal, finance.
- Calm: legal, finance, health, dental, pharmacy, corporate.
- Open gesture: education, coaching, restaurant, travel, petshop, wedding, optics.

Every sector lists ≥2 affinities so rotation produces variety. The old "both hands up gesturing" default is removed entirely.

### C. Grooming + youth overrides

Define `GLAM_SECTORS = {beauty, cosmetics, ecommerce, fashion, jewelry, influencer}`. For a persona with `gender == "kadın"` in a glam sector (**including hijab/conservative personas**):
- **Skew age young:** force `age = "genç"` — updating the persona's **`age` metadata field**, not just the prompt, so the picker's age filter stays consistent (these never appear as `olgun`/`yetişkin` in glam sectors). This intentionally trades some age diversity within glam sectors for the requested younger look.
- **Add grooming descriptors:** *styled hair, tasteful polished makeup, well-groomed, editorial beauty finish.* For hijab personas, the grooming attaches to face/skin/brows and an elegantly styled headscarf (hair stays covered).

This directly answers "women need to be more well-groomed and younger" for exactly the sectors named.

### Prompt assembly

`build_prompt()` composes, in order: subject line (age + ethnicity + gender + **feature seeds** + profession), **pose fragment** (hands/arms + mic), attire (+ **grooming** if glam), then the unchanged, working blocks — green-screen background, framing/margins (9:16, ~45–50% width, no edge-crop), lighting, lens, "no text/logo/watermark." The framing and green-screen rules from the 2026-07-15 framing fix are **preserved verbatim**; only the subject/pose/grooming portions change.

## Files touched

- `apps/worker/scripts/build_avatar_catalog.py` — new pools (`FACE_SHAPES`, `HAIR_WOMEN`, `HAIR_MEN`, `FACIAL_HAIR_MEN`, `HAIR_COLORS`, `COMPLEXIONS`, `BUILDS`, `DISTINGUISHING`, `POSES`, `SECTOR_POSES`, `GLAM_SECTORS`, `FEATURE_OVERRIDES`); rewritten `build_prompt()`; feature-seed + pose assignment wired into `entry()` / `main()`.
- `apps/api/src/data/avatars.json` — regenerated by running the script (new `prompt` per persona; `imageId`/`displayImageId` stay `""` for the generated 124, matching the already-out-of-sync committed state). **No schema change** — same keys.

**Count reconciliation (found during implementation):** the committed file has **126** personas (26 hijab), including two hand-added, image-backed extras — `kevser` and `beyza` (ecommerce, hijab, genç, turkish, added 2026-07-19). The script's loops only produce 124, so the script is added an `EXTRA` list (appended after the hijab loop) that reproduces those two and **preserves their real `imageId`/`displayImageId`**, so a rebuild never deletes them. They pick up the new pose/feature/grooming treatment like every other persona (their images only change if Berkan later force-regenerates them).

## Out of scope / non-goals

- No portrait regeneration, no HeyGen renders, no OpenAI/HeyGen credit spend.
- No DB migration and **no re-seed** — prompts live only in `avatars.json`, not `avatar_catalog`, so the live DB's 68 existing portraits are untouched. (When Berkan later regenerates, existing portraits need `generate_avatars.py --force` to adopt the new look; new/pending ones adopt it on a normal run.)
- No change to filters, picker UI, sector list, name pools, ethnicity weighting, or the count (126 personas).
- No git commit unless Berkan asks (his no-commit-unless-asked rule).

## Success criteria

Reviewing the regenerated `avatars.json` as text:
1. No two personas of the same `(ethnicity, gender)` share a `(face_shape, hair_style, distinguishing)` combo.
2. Pose varies within every sector; handheld-mic poses appear (and keep the mouth clear); the old universal hands-up pose is gone.
3. Women in glam sectors (incl. hijab) are `genç` and carry grooming descriptors.
4. Defne/Deniz and Zeynep/Ece have visibly divergent feature descriptors.
5. `python apps/worker/scripts/build_avatar_catalog.py` runs clean and prints 126 avatars; all framing/green-screen clauses preserved.
