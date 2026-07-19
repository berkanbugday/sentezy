# Avatar Variety & Distinctiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the portrait prompt engine in `build_avatar_catalog.py` so avatars get varied poses (incl. handheld microphones), unique per-persona faces, and younger/well-groomed women in glam sectors — with no image regeneration.

**Architecture:** All changes live in one deterministic script. We extract a pure `build_catalog() -> list[dict]` (testable, mirrors the existing name-cursor pattern), then layer three feature sets onto `build_prompt()`: a pose palette (B), a per-persona feature-seed engine with a uniqueness guard (A), and glam-sector grooming/youth overrides (C). Tests assert the generated catalog against the spec's success criteria. Finally we regenerate `avatars.json` (text only).

**Tech Stack:** Python 3.12, pytest (`uv run pytest`), `apps/worker` package. Script at `apps/worker/scripts/build_avatar_catalog.py`; output `apps/api/src/data/avatars.json`.

## Global Constraints

- **No image regeneration / no HeyGen / no re-seed / no OpenAI credits.** Deliverable is prompts + regenerated `avatars.json` text only.
- **`avatars.json` schema is unchanged** — same public keys per persona (`slug, name, sector, sectorLabel, gender, age, ethnicity, hijab, imageId, displayImageId, prompt`). `imageId`/`displayImageId` stay `""`. Internal `_features`/`_pose` keys must be stripped before writing.
- **Determinism preserved** — re-running the script yields identical output (no `random`, no time).
- **Framing + green-screen clauses preserved verbatim** from the current prompt (9:16, ~45–50% width, generous L/R margins, never edge-cropped, green chroma background, "no text/logos/watermark").
- **Total personas stays 126.**
- **Handheld-mic poses must keep the mouth visible/uncovered** (HeyGen lip-sync safety).
- **No git commits unless Berkan explicitly asks** (his standing no-git rule). Every "Checkpoint" step below runs the script + tests; do **not** `git commit` unless told to.
- **Run tests from `apps/worker`:** `cd apps/worker && uv run pytest tests/test_avatar_catalog.py -v`.

---

### Task 1: Extract a testable `build_catalog()` (no behavior change)

Refactor list-building out of `main()` into a pure function so later tasks can assert on the catalog. Behavior (prompts) is unchanged in this task.

**Files:**
- Modify: `apps/worker/scripts/build_avatar_catalog.py` (`main()` → extract `build_catalog()`)
- Test: `apps/worker/tests/test_avatar_catalog.py` (create)

**Interfaces:**
- Produces: `build_catalog() -> list[dict]` — returns all 126 persona dicts (public keys only for now). `main()` calls it and writes JSON.

- [x] **Step 1: Write the failing test**

Create `apps/worker/tests/test_avatar_catalog.py`:

```python
from scripts.build_avatar_catalog import build_catalog

PUBLIC_KEYS = {"slug", "name", "sector", "sectorLabel", "gender", "age",
               "ethnicity", "hijab", "imageId", "displayImageId", "prompt"}


def test_catalog_has_126_personas():
    cat = build_catalog()
    assert len(cat) == 126


def test_slugs_unique():
    cat = build_catalog()
    slugs = [a["slug"] for a in cat]
    assert len(slugs) == len(set(slugs))
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd apps/worker && uv run pytest tests/test_avatar_catalog.py -v`
Expected: FAIL with `ImportError: cannot import name 'build_catalog'`.

- [x] **Step 3: Extract `build_catalog()`**

**Reconciliation note (plan correction 2026-07-19):** the committed `avatars.json` has **126** personas including two real, image-backed extras — `kevser` and `beyza` (ecommerce, hijab, genç, turkish) added by hand on 2026-07-19 — but the script's generation logic only produces 124 (100 base + 24 hijab). Regenerating without these would delete two live avatars and their R2 images. So this task also adds an `EXTRA` list, appended after the hijab loop, that reproduces them (preserving their real `imageId`/`displayImageId`). After this, `build_catalog()` returns 126, matching the committed file.

First add the `EXTRA` constant next to `KNOWN` (near the top of the module):

```python
# Extra hand-added personas appended on top of the generated 100+24 — real,
# image-backed avatars that the generation loops don't produce. Keep in sync
# with any future hand-added avatars.json entries so a rebuild never drops them.
EXTRA: list[dict] = [
    {"slug": "kevser", "name": "Kevser", "sector": "ecommerce", "gender": "kadın",
     "age": "genç", "ethnicity": "turkish", "hijab": True,
     "imageId": "avatars/kevser.png", "displayImageId": "avatars/kevser-cut.png"},
    {"slug": "beyza", "name": "Beyza", "sector": "ecommerce", "gender": "kadın",
     "age": "genç", "ethnicity": "turkish", "hijab": True,
     "imageId": "avatars/beyza.png", "displayImageId": "avatars/beyza-cut.png"},
]
```

Then rename the body of `main()` that builds the list into a new function `build_catalog()` that **returns** the `avatars` list. Keep `main()` for file writing. Concretely:

```python
def build_catalog() -> list[dict]:
    used_names: set[str] = {k["name"] for k in KNOWN} | {e["name"] for e in EXTRA}
    used_slugs: set[str] = {k["slug"] for k in KNOWN} | {e["slug"] for e in EXTRA}
    name_cursor: dict[tuple[str, str], int] = {}

    def take_name(ethnicity: str, gender: str) -> str:
        pool = NAMES[ethnicity][gender]
        i = name_cursor.get((ethnicity, gender), 0)
        while i < len(pool) and pool[i] in used_names:
            i += 1
        if i >= len(pool):
            raise RuntimeError(f"name pool exhausted for {ethnicity}/{gender}")
        name_cursor[(ethnicity, gender)] = i + 1
        used_names.add(pool[i])
        return pool[i]

    def uniq_slug(name: str) -> str:
        base = name.lower().translate(str.maketrans("çğıöşü", "cgiosu"))
        slug, n = base, 2
        while slug in used_slugs:
            slug, n = f"{base}{n}", n + 1
        used_slugs.add(slug)
        return slug

    avatars: list[dict] = [
        entry(k["name"], k["sector"], k["gender"], k["age"], k["ethnicity"], k["imageId"], k["slug"])
        for k in KNOWN
    ]

    i = 0
    while len(avatars) < 100:
        sector_slug = SECTORS[i % len(SECTORS)][0]
        gender = "kadın" if i % 2 == 0 else "erkek"
        age = AGES[i % 3]
        ethnicity = ETHNICITY_CYCLE[i % len(ETHNICITY_CYCLE)]
        name = take_name(ethnicity, gender)
        avatars.append(entry(name, sector_slug, gender, age, ethnicity, "", uniq_slug(name)))
        i += 1

    hijab_cursor: dict[str, int] = {}

    def take_hijab_name(ethnicity: str) -> str:
        pool = HIJAB_NAMES[ethnicity]
        j = hijab_cursor.get(ethnicity, 0)
        while j < len(pool) and pool[j] in used_names:
            j += 1
        if j >= len(pool):
            raise RuntimeError(f"hijab name pool exhausted for {ethnicity}")
        hijab_cursor[ethnicity] = j + 1
        used_names.add(pool[j])
        return pool[j]

    for k, (sector_slug, *_rest) in enumerate(SECTORS):
        ethnicity = HIJAB_ETHNICITIES[k % len(HIJAB_ETHNICITIES)]
        age = AGES[k % 3]
        name = take_hijab_name(ethnicity)
        avatars.append(
            entry(name, sector_slug, "kadın", age, ethnicity, "", uniq_slug(name), hijab=True)
        )

    # extras appended on top of the generated 124 → 126 total (preserve their images)
    for ex in EXTRA:
        e = entry(ex["name"], ex["sector"], ex["gender"], ex["age"], ex["ethnicity"],
                  ex["imageId"], ex["slug"], hijab=ex["hijab"])
        e["displayImageId"] = ex["displayImageId"]
        avatars.append(e)

    return avatars
```

**In Tasks 2–4, the `EXTRA` loop is a persona-construction call site like the others** — update it in lockstep: Task 2 passes `take_pose(ex["sector"])`, Task 3 passes `assign_features(ex["slug"], ex["ethnicity"], ex["gender"], ex["hijab"])`, Task 4 applies `glam_adjust`. Because kevser/beyza are ecommerce + hijab + genç, they naturally receive the glam grooming + hijab-scarf + presenting/open-gesture treatment. Keep the `e["displayImageId"] = ex["displayImageId"]` line after each `entry(...)` so their real thumbnails survive.

Then rewrite `main()` to consume it and strip any internal (`_`-prefixed) keys:

```python
def main() -> None:
    avatars = build_catalog()
    public = [{k: v for k, v in a.items() if not k.startswith("_")} for a in avatars]

    out_path = os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "..", "api", "src", "data", "avatars.json")
    )
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    payload = {
        "note": "Generated by apps/worker/scripts/build_avatar_catalog.py — do not edit by hand. "
                "Run generate_avatars.py to fill empty imageId fields.",
        "count": len(public),
        "avatars": public,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    ready = sum(1 for a in public if a["imageId"])
    print(f"wrote {len(public)} avatars ({ready} ready, {len(public) - ready} pending) → {out_path}")
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd apps/worker && uv run pytest tests/test_avatar_catalog.py -v`
Expected: PASS (2 passed).

- [x] **Step 5: Checkpoint**

Run: `cd apps/worker && uv run python scripts/build_avatar_catalog.py`
Expected: prints `wrote 126 avatars (... pending) → .../avatars.json`. `git diff --stat` should show only whitespace/ordering-neutral changes to `avatars.json` (prompts unchanged this task). Do not commit.

---

### Task 2: Pose palette (Section B)

Replace the single universal hands-up pose with a 6-pose palette assigned by sector affinity + rotation. Handheld-mic poses appear and keep the mouth uncovered.

**Files:**
- Modify: `apps/worker/scripts/build_avatar_catalog.py` (add `POSES`, `SECTOR_POSES`; new `pose_key` param on `build_prompt`/`entry`; pose assignment in `build_catalog`)
- Test: `apps/worker/tests/test_avatar_catalog.py`

**Interfaces:**
- Produces: `POSES: dict[str, tuple[str, str]]` (key → (pose_fragment, mic_kind)), `SECTOR_POSES: dict[str, list[str]]`. `build_prompt(sector, gender, age, ethnicity, pose_key, hijab=False)` gains `pose_key`. Each returned persona dict carries internal `_pose` (the pose key).

- [x] **Step 1: Write the failing test**

Add to `tests/test_avatar_catalog.py`:

```python
from scripts.build_avatar_catalog import build_catalog, POSES, SECTOR_POSES, SECTORS

OLD_POSE = "both arms and hands fully visible in a natural, relaxed talking gesture"


def test_sector_poses_well_formed():
    sector_slugs = {s[0] for s in SECTORS}
    assert set(SECTOR_POSES) == sector_slugs           # every sector mapped
    for slug, keys in SECTOR_POSES.items():
        assert len(keys) >= 2                          # variety guaranteed
        assert all(k in POSES for k in keys)


def test_old_universal_pose_gone():
    for a in build_catalog():
        assert OLD_POSE not in a["prompt"]


def test_pose_varies_within_each_sector():
    from collections import defaultdict
    by_sector = defaultdict(set)
    for a in build_catalog():
        by_sector[a["sector"]].add(a["_pose"])
    # every sector uses >1 distinct pose across its personas
    for slug, poses in by_sector.items():
        assert len(poses) >= 2, f"{slug} only used {poses}"


def test_handheld_mic_poses_keep_mouth_visible():
    for a in build_catalog():
        if a["_pose"] in ("mic_speaking", "mic_chest"):
            assert "handheld microphone" in a["prompt"]
            assert ("never covered" in a["prompt"]) or ("fully visible" in a["prompt"])


def test_handheld_mic_appears_somewhere():
    poses = {a["_pose"] for a in build_catalog()}
    assert "mic_speaking" in poses or "mic_chest" in poses
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd apps/worker && uv run pytest tests/test_avatar_catalog.py -v`
Expected: FAIL — `ImportError` for `POSES`/`SECTOR_POSES`.

- [x] **Step 3: Add pose data + assignment + rewrite the pose portion of `build_prompt`**

Add near the other module constants:

```python
# ── pose palette — hands/arms + microphone. Drives HeyGen motion variety. ─────
# key → (pose fragment, mic kind). Handheld-mic poses keep the mouth uncovered.
POSES: dict[str, tuple[str, str]] = {
    "calm": ("hands resting low and lightly clasped near the waist, calm and still "
             "with minimal gesturing", "lavalier"),
    "open_gesture": ("one hand raised in a soft open-palm gesture while the other rests "
                     "relaxed at the side", "lavalier"),
    "mic_speaking": ("holding a handheld microphone and speaking into it, the microphone "
                     "held just below and to the side of the mouth so the mouth stays fully "
                     "visible and is never covered", "handheld"),
    "mic_chest": ("holding a handheld microphone at chest height, ready to speak, mouth "
                  "fully visible", "handheld"),
    "presenting": ("one open hand gesturing to the side as if presenting a product, body "
                   "angled slightly toward it", "lavalier"),
    "arms_crossed": ("arms lightly and confidently crossed at the chest with relaxed "
                     "shoulders", "lavalier"),
}

# Each sector lists ≥2 suitable poses; rotation picks among them so same-sector
# personas don't all share one pose.
SECTOR_POSES: dict[str, list[str]] = {
    "beauty": ["presenting", "open_gesture"],
    "restaurant": ["open_gesture", "calm"],
    "realestate": ["presenting", "arms_crossed"],
    "fashion": ["presenting", "open_gesture"],
    "fitness": ["open_gesture", "arms_crossed"],
    "dental": ["calm", "open_gesture"],
    "health": ["calm", "open_gesture"],
    "pharmacy": ["calm", "open_gesture"],
    "education": ["open_gesture", "mic_chest"],
    "legal": ["arms_crossed", "calm"],
    "finance": ["calm", "arms_crossed"],
    "tech": ["arms_crossed", "open_gesture"],
    "automotive": ["arms_crossed", "presenting"],
    "travel": ["open_gesture", "presenting"],
    "jewelry": ["presenting", "calm"],
    "optics": ["open_gesture", "presenting"],
    "petshop": ["open_gesture", "calm"],
    "construction": ["arms_crossed", "calm"],
    "wedding": ["open_gesture", "presenting"],
    "cosmetics": ["presenting", "open_gesture"],
    "corporate": ["mic_speaking", "calm", "arms_crossed"],
    "influencer": ["mic_speaking", "mic_chest", "open_gesture"],
    "ecommerce": ["presenting", "open_gesture"],
    "coaching": ["mic_speaking", "open_gesture"],
}
```

Change `build_prompt`'s signature to accept `pose_key` and replace the hard-coded pose + mic. The mic phrasing depends on `mic_kind`:

```python
def build_prompt(sector_slug: str, gender: str, age: str, ethnicity: str,
                 pose_key: str, hijab: bool = False) -> str:
    _, _, profession, attire = _sector(sector_slug)
    pose_fragment, mic_kind = POSES[pose_key]
    if mic_kind == "handheld":
        mic_clause = ""  # the handheld mic is already described by pose_fragment
    else:
        mic_clause = "A small lavalier microphone clipped near the collar. "  # note trailing space
    if hijab:
        wearing = (
            f"an elegant modern hijab (headscarf) that neatly covers the hair and frames the "
            f"face, tastefully colour-coordinated with {attire}"
        )
        rim = "gentle rim light to separate the head and shoulders from the background"
        edges = "crisp fabric edges on the headscarf"
    else:
        wearing = attire
        rim = "gentle rim light to separate the hair from the background"
        edges = "crisp hair edges"
    return (
        f"Photorealistic professional portrait of a {AGE_DESC[age]} {ETHNICITY_DESC[ethnicity]} "
        f"{GENDER_WORD[gender]}, a {profession}, upper body from the waist up, {pose_fragment}, "
        f"loosely framed with clear space around the subject, facing the camera directly, warm "
        f"natural approachable expression with a relaxed, slightly-open neutral mouth for lip-sync, "
        f"clear unobstructed face. Wearing {wearing} (not wearing any green). {mic_clause}Soft studio key "
        f"light on the subject, {rim}, {GREEN_BACKGROUND}. Eye-level, 85mm lens look, sharp focus on "
        f"the eyes, realistic skin texture, {edges}. Vertical 9:16, single person, centered with a "
        f"wide, extra-generous empty margin on BOTH the left and right — the subject occupies only "
        f"~45–50% of the frame width, full shoulders visible with clear space to each side edge and "
        f"never touching or cropped by the frame edges, no hands covering the face, no text, no "
        f"logos, no watermark. Editorial, ultra-realistic, high detail."
    )
```

Update `entry()` to take and pass `pose_key`, and stash `_pose`:

```python
def entry(name, sector_slug, gender, age, ethnicity, image_id, slug, pose_key, hijab=False) -> dict:
    _, label, _, _ = _sector(sector_slug)
    return {
        "slug": slug, "name": name, "sector": sector_slug, "sectorLabel": label,
        "gender": gender, "age": age, "ethnicity": ethnicity, "hijab": hijab,
        "imageId": image_id, "displayImageId": "",
        "prompt": build_prompt(sector_slug, gender, age, ethnicity, pose_key, hijab),
        "_pose": pose_key,
    }
```

In `build_catalog`, add a per-sector rotation cursor and pass a pose to every `entry()` call:

```python
    pose_cursor: dict[str, int] = {}

    def take_pose(sector_slug: str) -> str:
        keys = SECTOR_POSES[sector_slug]
        j = pose_cursor.get(sector_slug, 0)
        pose_cursor[sector_slug] = j + 1
        return keys[j % len(keys)]
```

Update the three `entry(...)` call sites to pass `take_pose(sector_slug)` as the `pose_key` argument. For the `KNOWN` loop, pass `take_pose(k["sector"])`.

- [x] **Step 4: Run tests to verify they pass**

Run: `cd apps/worker && uv run pytest tests/test_avatar_catalog.py -v`
Expected: PASS (all pose tests + Task 1 tests green).

- [x] **Step 5: Checkpoint**

Run: `cd apps/worker && uv run python scripts/build_avatar_catalog.py` — prints `wrote 126 avatars`. Spot-read one influencer persona's `prompt` in `avatars.json` to confirm the handheld-mic wording. Do not commit.

---

### Task 3: Distinctiveness engine (Section A)

Give each persona a unique face via ethnicity-gated feature pools + a per-`(ethnicity, gender, hijab)` uniqueness guard, plus hard overrides for the named look-alike clusters.

**Files:**
- Modify: `apps/worker/scripts/build_avatar_catalog.py` (feature pools, `_feature_line`, `assign_features` closure, `features` param on `build_prompt`/`entry`, `FEATURE_OVERRIDES`)
- Test: `apps/worker/tests/test_avatar_catalog.py`

**Interfaces:**
- Produces: `build_prompt(sector, gender, age, ethnicity, features, pose_key, hijab=False)` gains a `features: dict` param. Each persona dict carries internal `_features` (dict with `face`, `complexion`, `build`, `distinguishing`, and either `hair`+`color` or `scarf`, and for men `facial_hair`).

- [x] **Step 1: Write the failing test**

Add to `tests/test_avatar_catalog.py`:

```python
def _by_slug(cat):
    return {a["slug"]: a for a in cat}


def test_no_lookalikes_within_ethnicity_gender():
    cat = build_catalog()
    from collections import defaultdict
    combos = defaultdict(set)
    for a in cat:
        f = a["_features"]
        bucket = (a["ethnicity"], a["gender"], a["hijab"])
        third = f.get("facial_hair") or f.get("distinguishing")
        hairlike = f.get("hair") or f.get("scarf")
        key = (f["face"], hairlike, third)
        assert key not in combos[bucket], f"lookalike in {bucket}: {key}"
        combos[bucket].add(key)


def test_named_clusters_diverge():
    cat = _by_slug(build_catalog())
    for a, b in [("defne", "deniz"), ("zeynep", "ece")]:
        assert a in cat and b in cat
        fa, fb = cat[a]["_features"], cat[b]["_features"]
        assert fa["face"] != fb["face"]
        assert (fa.get("hair") or fa.get("scarf")) != (fb.get("hair") or fb.get("scarf"))


def test_hijab_personas_have_scarf_not_hair():
    for a in build_catalog():
        if a["hijab"]:
            assert "scarf" in a["_features"] and "hair" not in a["_features"]


def test_features_appear_in_prompt():
    for a in build_catalog():
        assert a["_features"]["face"] in a["prompt"]
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd apps/worker && uv run pytest tests/test_avatar_catalog.py::test_no_lookalikes_within_ethnicity_gender -v`
Expected: FAIL — `KeyError: '_features'` (not populated yet).

- [x] **Step 3: Add pools, overrides, and feature assignment**

Add module constants:

```python
# ── per-persona feature pools — make every face distinct ─────────────────────
FACE_SHAPES = ["an oval face", "a round face", "a square, defined jawline",
               "a heart-shaped face", "a long oval face", "high, angular cheekbones",
               "soft, rounded features", "a diamond-shaped face"]
HAIR_WOMEN = ["long straight hair", "long loose waves", "a shoulder-length blunt bob",
              "a sleek low bun", "a high ponytail", "voluminous curls",
              "a short textured pixie cut", "layered mid-length hair",
              "side-swept hair", "half-up styled hair"]
HAIR_MEN = ["a short crop", "a textured quiff", "a neat side part", "slicked-back hair",
            "a buzz cut", "short curls", "medium wavy hair", "a tied-back man-bun"]
FACIAL_HAIR_MEN = ["clean-shaven", "light stubble", "designer stubble",
                   "a short full trimmed beard", "a neat goatee", "a longer groomed beard"]
HIJAB_STYLES = ["a neatly draped satin hijab", "a softly wrapped chiffon hijab",
                "a modern turban-style hijab", "an elegantly pinned hijab with a subtle drape",
                "a two-tone layered hijab", "a smoothly wrapped jersey hijab"]
HAIR_COLORS = {
    "turkish": ["jet black", "dark brown", "chestnut brown", "dark auburn"],
    "mideast": ["jet black", "dark brown", "chestnut brown", "dark auburn"],
    "european": ["blonde", "light brown", "auburn", "dark blonde"],
    "eastasian": ["black", "dark brown"],
    "black": ["black", "dark brown"],
    "southasian": ["black", "dark brown"],
    "latino": ["dark brown", "black", "chestnut brown"],
}
COMPLEXIONS = {
    "turkish": ["fair", "light olive", "warm olive"],
    "mideast": ["light olive", "warm olive", "medium tan"],
    "european": ["fair", "light", "lightly tanned"],
    "eastasian": ["fair", "light"],
    "black": ["medium brown", "deep brown", "rich dark brown"],
    "southasian": ["light brown", "medium brown", "warm tan"],
    "latino": ["light tan", "warm tan", "medium brown"],
}
BUILDS = ["a slim build", "an average build", "an athletic, toned build",
          "a broad-shouldered build", "a petite frame", "a tall, lean build"]
DISTINGUISHING = ["light freckles across the cheeks", "gentle dimples", "prominent cheekbones",
                  "warm smile lines", "stylish eyeglasses", "a small beauty mark",
                  "expressive eyebrows", "a strong, defined jawline",
                  "kind eyes with subtle laugh lines"]

# Hard overrides for the specific look-alike clusters the user called out.
FEATURE_OVERRIDES: dict[str, dict] = {
    "defne": {"face": "a heart-shaped face", "hair": "long loose waves", "color": "chestnut brown",
              "complexion": "warm olive", "build": "a slim build", "distinguishing": "gentle dimples"},
    "deniz": {"face": "high, angular cheekbones", "hair": "a sleek low bun", "color": "jet black",
              "complexion": "fair", "build": "a tall, lean build",
              "distinguishing": "expressive eyebrows"},
    "zeynep": {"face": "a round face", "hair": "a shoulder-length blunt bob", "color": "dark brown",
               "complexion": "light olive", "build": "a petite frame",
               "distinguishing": "light freckles across the cheeks"},
    "ece": {"face": "a long oval face", "hair": "a high ponytail", "color": "dark auburn",
            "complexion": "warm olive", "build": "an athletic, toned build",
            "distinguishing": "a small beauty mark"},
}
```

Add a feature-line helper:

```python
def _feature_line(f: dict, gender: str, hijab: bool) -> str:
    parts = [f"{f['complexion']} skin", f["face"], f["build"]]
    if hijab:
        parts.append(f["distinguishing"])
    else:
        parts.append(f"{f['hair']} in {f['color']}")
        if gender == "erkek":
            parts.append(f["facial_hair"])
        parts.append(f["distinguishing"])
    return ", ".join(parts)
```

Thread `features` through `build_prompt` — insert the feature line right after the subject noun. Change the signature to `build_prompt(sector_slug, gender, age, ethnicity, features, pose_key, hijab=False)` and change the opening of the return string to:

```python
        f"Photorealistic professional portrait of a {AGE_DESC[age]} {ETHNICITY_DESC[ethnicity]} "
        f"{GENDER_WORD[gender]} with {_feature_line(features, gender, hijab)}, a {profession}, "
        f"upper body from the waist up, {pose_fragment}, "
```

For hijab, fold the scarf style into `wearing` (replaces the generic hijab wording):

```python
    if hijab:
        wearing = (
            f"{features['scarf']} that neatly covers the hair and frames the face, tastefully "
            f"colour-coordinated with {attire}"
        )
```

Add the assignment closure inside `build_catalog` (before the persona loops):

```python
    STRIDES = {"face": 1, "hair": 3, "color": 5, "complexion": 2, "build": 7,
               "distinguishing": 4, "facial_hair": 5, "scarf": 3}
    feat_cursor: dict[tuple, int] = {}
    used_combos: set = set()

    def assign_features(slug, ethnicity, gender, hijab) -> dict:
        if slug in FEATURE_OVERRIDES:
            f = dict(FEATURE_OVERRIDES[slug])
            key = ((ethnicity, gender, hijab), (f["face"], f.get("hair") or f.get("scarf"),
                    f.get("facial_hair") or f["distinguishing"]))
            used_combos.add(key)
            return f
        bucket = (ethnicity, gender, hijab)
        i = feat_cursor.get(bucket, 0)
        while True:
            def pick(pool, name):
                return pool[(i * STRIDES[name]) % len(pool)]
            f = {
                "face": pick(FACE_SHAPES, "face"),
                "complexion": pick(COMPLEXIONS[ethnicity], "complexion"),
                "build": pick(BUILDS, "build"),
                "distinguishing": pick(DISTINGUISHING, "distinguishing"),
            }
            if hijab:
                f["scarf"] = pick(HIJAB_STYLES, "scarf")
            else:
                f["hair"] = pick(HAIR_WOMEN if gender == "kadın" else HAIR_MEN, "hair")
                f["color"] = pick(HAIR_COLORS[ethnicity], "color")
                if gender == "erkek":
                    f["facial_hair"] = pick(FACIAL_HAIR_MEN, "facial_hair")
            third = f.get("facial_hair") or f["distinguishing"]
            key = (bucket, (f["face"], f.get("hair") or f.get("scarf"), third))
            i += 1
            if key not in used_combos:
                used_combos.add(key)
                feat_cursor[bucket] = i
                return f
```

Update `entry()` to accept `features` and pass to `build_prompt`, and stash `_features`:

```python
def entry(name, sector_slug, gender, age, ethnicity, image_id, slug, pose_key, features, hijab=False) -> dict:
    _, label, _, _ = _sector(sector_slug)
    return {
        "slug": slug, "name": name, "sector": sector_slug, "sectorLabel": label,
        "gender": gender, "age": age, "ethnicity": ethnicity, "hijab": hijab,
        "imageId": image_id, "displayImageId": "",
        "prompt": build_prompt(sector_slug, gender, age, ethnicity, features, pose_key, hijab),
        "_pose": pose_key, "_features": features,
    }
```

At each `entry(...)` call site, compute `features = assign_features(slug, ethnicity, gender, hijab)` and pass it. Note the KNOWN loop and base loop use `hijab=False`; the hijab loop uses `hijab=True`. Slugs are known before `entry` (KNOWN has explicit slugs; loops call `uniq_slug` first — reorder so the slug is computed before `assign_features`).

- [x] **Step 4: Run tests to verify they pass**

Run: `cd apps/worker && uv run pytest tests/test_avatar_catalog.py -v`
Expected: PASS (distinctiveness + earlier tests green).

- [x] **Step 5: Checkpoint**

Run: `cd apps/worker && uv run python scripts/build_avatar_catalog.py` — `wrote 126 avatars`. Spot-read Defne vs Deniz prompts in `avatars.json` — clearly different faces. Do not commit.

---

### Task 4: Grooming + youth overrides (Section C)

Women in glam sectors (incl. hijab) become `genç` with polished grooming descriptors.

**Files:**
- Modify: `apps/worker/scripts/build_avatar_catalog.py` (`GLAM_SECTORS`, age override in `build_catalog`, `glam` param + grooming clause in `build_prompt`)
- Test: `apps/worker/tests/test_avatar_catalog.py`

**Interfaces:**
- Produces: `GLAM_SECTORS: set[str]`. `build_prompt(..., glam=False)` gains a `glam` flag appending grooming wording.

- [x] **Step 1: Write the failing test**

Add to `tests/test_avatar_catalog.py`:

```python
from scripts.build_avatar_catalog import GLAM_SECTORS


def test_glam_women_are_young():
    for a in build_catalog():
        if a["sector"] in GLAM_SECTORS and a["gender"] == "kadın":
            assert a["age"] == "genç", f"{a['slug']} is {a['age']}"


def test_glam_women_have_grooming_descriptor():
    for a in build_catalog():
        if a["sector"] in GLAM_SECTORS and a["gender"] == "kadın":
            assert "well-groomed" in a["prompt"]


def test_non_glam_unaffected_ages_still_vary():
    ages = {a["age"] for a in build_catalog()
            if a["sector"] not in GLAM_SECTORS}
    assert {"genç", "yetişkin", "olgun"} <= ages
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd apps/worker && uv run pytest tests/test_avatar_catalog.py::test_glam_women_are_young -v`
Expected: FAIL — `ImportError: GLAM_SECTORS` / some glam women not `genç`.

- [x] **Step 3: Add glam constant, age override, grooming clause**

Add constant:

```python
GLAM_SECTORS: set[str] = {"beauty", "cosmetics", "ecommerce", "fashion", "jewelry", "influencer"}
```

Add `glam` to `build_prompt` — append grooming to `wearing`. Insert before the `return`:

```python
    if glam:
        if hijab:
            wearing += (", polished skin and softly defined brows, subtle tasteful makeup, "
                        "well-groomed with an editorial beauty finish")
        else:
            wearing += (", styled hair, tasteful polished makeup, well-groomed with an "
                        "editorial beauty finish")
```

Change signature to `build_prompt(sector_slug, gender, age, ethnicity, features, pose_key, hijab=False, glam=False)`.

In `build_catalog`, apply the age override + glam flag. Do this **before** computing `age`-dependent output, at each persona construction. Add a helper and use it:

```python
    def glam_adjust(sector_slug, gender, age):
        glam = sector_slug in GLAM_SECTORS and gender == "kadın"
        return ("genç" if glam else age), glam
```

At each `entry(...)` site, compute `age, glam = glam_adjust(sector_slug, gender, age)` before building, pass `glam` into `entry()` (add a `glam=False` param on `entry` that forwards to `build_prompt`). Update `entry()`:

```python
def entry(name, sector_slug, gender, age, ethnicity, image_id, slug, pose_key, features,
          hijab=False, glam=False) -> dict:
    ...
        "prompt": build_prompt(sector_slug, gender, age, ethnicity, features, pose_key, hijab, glam),
    ...
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd apps/worker && uv run pytest tests/test_avatar_catalog.py -v`
Expected: PASS (all tests green).

- [x] **Step 5: Checkpoint**

Run: `cd apps/worker && uv run python scripts/build_avatar_catalog.py` — `wrote 126 avatars`. Spot-read a beauty and an ecommerce woman — `genç` + grooming wording present. Do not commit.

---

### Task 5: Regenerate `avatars.json` + full validation

Produce the final catalog and confirm every spec success criterion + preserved clauses.

**Files:**
- Modify: `apps/api/src/data/avatars.json` (regenerated)
- Test: `apps/worker/tests/test_avatar_catalog.py`

- [x] **Step 1: Add preservation + framing guard tests**

Add to `tests/test_avatar_catalog.py`:

```python
GREEN = "chroma-key green"
FRAMING = "~45–50% of the frame width"


def test_framing_and_greenscreen_preserved():
    for a in build_catalog():
        assert GREEN in a["prompt"]
        assert FRAMING in a["prompt"]
        assert "no text, no logos, no watermark" in a["prompt"]


def test_public_json_has_no_internal_keys(tmp_path, monkeypatch):
    # main() must strip _pose/_features
    import json, scripts.build_avatar_catalog as m
    cat = m.build_catalog()
    public = [{k: v for k, v in a.items() if not k.startswith("_")} for a in cat]
    for a in public:
        assert "_pose" not in a and "_features" not in a
        assert set(a) == {"slug", "name", "sector", "sectorLabel", "gender", "age",
                          "ethnicity", "hijab", "imageId", "displayImageId", "prompt"}
```

- [x] **Step 2: Run full suite to verify it fails/passes**

Run: `cd apps/worker && uv run pytest tests/test_avatar_catalog.py -v`
Expected: PASS (framing preserved, no internal keys leak).

- [x] **Step 3: Regenerate the catalog file**

Run: `cd apps/worker && uv run python scripts/build_avatar_catalog.py`
Expected: `wrote 126 avatars (2 ready, 124 pending) → .../avatars.json`.

- [x] **Step 4: Verify the written JSON**

Run:
```bash
cd /Users/berkan/Projects/sentezy && python3 -c "
import json
d = json.load(open('apps/api/src/data/avatars.json'))
avs = d['avatars']
assert d['count'] == len(avs) == 126, len(avs)
assert all(set(a) == {'slug','name','sector','sectorLabel','gender','age','ethnicity','hijab','imageId','displayImageId','prompt'} for a in avs)
assert not any('_pose' in a or '_features' in a for a in avs)
print('OK 126 personas, clean schema, no internal keys')
"
```
Expected: `OK 126 personas, clean schema, no internal keys`.

- [x] **Step 5: Final review + checkpoint**

Confirm against spec success criteria (uniqueness, pose variety incl. handheld mic, glam women genç+groomed, Defne/Deniz & Zeynep/Ece diverge, framing preserved). Report the diff summary to Berkan. **Do not commit** — regeneration of portraits and any commit are Berkan's call.

---

## Self-Review

**Spec coverage:**
- A (distinctiveness) → Task 3. B (pose palette + mic) → Task 2. C (grooming/youth) → Task 4. Prompt assembly order → Tasks 2–4 build it incrementally; framing/green-screen preservation asserted in Task 5. "No schema change / strip internal keys" → Task 1 (`main` strips) + Task 5 test. "No regen/re-seed/commit" → Global Constraints + every checkpoint. Named-cluster overrides → Task 3 `FEATURE_OVERRIDES` + test. Determinism → pools use fixed strides, no RNG.
- Success criteria 1–5 each map to a test: (1) `test_no_lookalikes_within_ethnicity_gender`, (2) `test_pose_varies_within_each_sector` + `test_handheld_mic_poses_keep_mouth_visible` + `test_old_universal_pose_gone`, (3) `test_glam_women_are_young` + `test_glam_women_have_grooming_descriptor`, (4) `test_named_clusters_diverge`, (5) Task 5 regen + `test_framing_and_greenscreen_preserved`.

**Placeholder scan:** No TBD/TODO; all steps carry real code or exact commands.

**Type consistency:** `build_prompt` signature evolves deliberately: T2 adds `pose_key`; T3 inserts `features` before `pose_key` → final `(sector, gender, age, ethnicity, features, pose_key, hijab=False, glam=False)`; T4 adds `glam`. `entry()` mirrors this and every call site is updated in the same task. `assign_features` keys (`face`, `hair`/`scarf`, `color`, `complexion`, `build`, `distinguishing`, `facial_hair`) match `_feature_line` and all tests. `_pose`/`_features` internal keys consistently stripped by `main()` and asserted in Task 5.
