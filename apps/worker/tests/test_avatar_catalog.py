import re

from scripts.build_avatar_catalog import (COMPLEXIONS, build_catalog, POSES, SECTOR_POSES, SECTORS, _sector,
                                          HIJAB_STYLES, GLAM_SECTORS, OUTFIT_COLORS, SCARF_COLORS,
                                          STRIDES, feature_pools, HANDHELD_SECTORS, UNIFORM_SECTORS)

PUBLIC_KEYS = {"slug", "name", "sector", "sectorLabel", "gender", "age",
               "ethnicity", "hijab", "imageId", "displayImageId", "prompt"}

OLD_POSE = "both arms and hands fully visible in a natural, relaxed talking gesture"


def test_catalog_has_126_personas():
    cat = build_catalog()
    assert len(cat) == 126


def test_slugs_unique():
    cat = build_catalog()
    slugs = [a["slug"] for a in cat]
    assert len(slugs) == len(set(slugs))


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
            assert "lapel microphone in one hand" in a["prompt"]
            assert ("never covered" in a["prompt"]) or ("fully visible" in a["prompt"])


def test_handheld_mic_appears_somewhere():
    poses = {a["_pose"] for a in build_catalog()}
    assert "mic_speaking" in poses or "mic_chest" in poses


def test_no_double_space_or_broken_mic_fragment():
    for a in build_catalog():
        assert "  " not in a["prompt"], a["slug"]                    # no double spaces
        assert ". holding a handheld" not in a["prompt"], a["slug"]  # no broken lowercase fragment


def test_lavalier_sentence_intact_for_non_handheld_poses():
    for a in build_catalog():
        if a["_pose"] not in ("mic_speaking", "mic_chest"):
            assert "small black lavalier (lapel) microphone clipped visibly to the collar" in a["prompt"], a["slug"]


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


def _guarded_catalog(timeout=30):
    """build_catalog() behind a watchdog so a non-terminating guard fails the test
    instead of wedging the whole suite."""
    import threading

    box = {}

    def run():
        try:
            box["cat"] = build_catalog()
        except BaseException as e:  # noqa: BLE001 - surface the real failure
            box["err"] = e

    t = threading.Thread(target=run, daemon=True)
    t.start()
    t.join(timeout)
    assert not t.is_alive(), f"build_catalog() did not terminate within {timeout}s"
    assert "err" not in box, f"build_catalog() raised: {box.get('err')!r}"
    return box["cat"]


def test_build_catalog_terminates():
    """The uniqueness guard must never spin forever when a bucket runs out of
    stride-generated combos (turkish/erkek exhausts its 24-combo cycle at #25)."""
    assert len(_guarded_catalog()) == 126


def test_every_hijab_style_is_used():
    """A stride sharing a factor with the pool length silently collapses it."""
    used = {a["_features"]["scarf"] for a in _guarded_catalog() if a["hijab"]}
    assert used == set(HIJAB_STYLES), f"unused hijab styles: {set(HIJAB_STYLES) - used}"


def test_glam_women_are_young():
    for a in build_catalog():
        if a["sector"] in GLAM_SECTORS and a["gender"] == "kadın":
            assert a["age"] == "genç", f"{a['slug']} is {a['age']}"


def test_glam_women_have_grooming_descriptor():
    for a in build_catalog():
        if a["sector"] in GLAM_SECTORS and a["gender"] == "kadın":
            assert "well-groomed" in a["prompt"], a["slug"]


def test_non_glam_ages_still_vary():
    ages = {a["age"] for a in build_catalog() if a["sector"] not in GLAM_SECTORS}
    assert {"genç", "yetişkin", "olgun"} <= ages


GREEN = "chroma-key green"
FRAMING = "~62–67% of the frame width"
CLOSEUP_FRAMING = "~68–72% of the frame width"


def _is_held_mic(a):
    return POSES[a["_pose"]][1] == "handheld"


def test_framing_and_greenscreen_preserved():
    for a in build_catalog():
        assert GREEN in a["prompt"], a["slug"]
        assert (CLOSEUP_FRAMING if _is_held_mic(a) else FRAMING) in a["prompt"], a["slug"]
        assert "no text, no logos, no watermark" in a["prompt"], a["slug"]


def test_framing_is_waist_up_not_full_body():
    """A narrow width share in a 9:16 frame implies head-to-toe coverage, which
    overrode 'waist up' and produced full-body portraits."""
    for a in build_catalog():
        p = a["prompt"]
        assert "45–50%" not in p, a["slug"]          # the clause that forced the zoom-out
        assert "loosely framed" not in p, a["slug"]  # invites even more empty space
        expected = "cropped at mid-chest" if _is_held_mic(a) else "cropped just below the hip"
        assert expected in p, a["slug"]
        assert "no legs or feet visible" in p, a["slug"]


# Approx adult proportions: body height above the crop line, as a multiple of
# shoulder width. Rough by nature - the band below is deliberately wide.
CROP_EXTENT_OVER_SHOULDERS = {"waist": 1.74, "hip": 2.10, "chest": 1.25}


def _generator_size():
    """The size generate_avatars.py actually requests, as (w, h)."""
    import pathlib
    src = (pathlib.Path(__file__).parents[1] / "scripts" / "generate_avatars.py").read_text()
    m = re.search(r'"size":\s*"(\d+)x(\d+)"', src)
    assert m, "could not find the requested image size"
    return int(m.group(1)), int(m.group(2))


def test_generator_is_not_on_a_legacy_image_model():
    """The prompt was never the reason portraits looked flat — the script sat on
    gpt-image-1 for two model generations. Pin that it doesn't silently regress."""
    import pathlib
    src = (pathlib.Path(__file__).parents[1] / "scripts" / "generate_avatars.py").read_text()
    m = re.search(r'OPENAI_IMAGE_MODEL = "([^"]+)"', src)
    assert m, "could not find the configured image model"
    assert m.group(1) not in ("gpt-image-1", "dall-e-2", "dall-e-3"), m.group(1)


def _width_share(prompt):
    m = re.search(r"shoulders span ~(\d+)–(\d+)% of the frame width", prompt)
    assert m, prompt[-400:]
    return (int(m.group(1)) + int(m.group(2))) / 200


def test_width_share_geometrically_supports_a_waist_up_crop():
    """The bug that recurred three times: a width share too small for the frame's
    aspect ratio leaves vertical space the generator fills with hips and legs.
    At 50-55% the waist-up body covers only ~60% of the height, so it cannot obey
    'waist up' no matter how the crop is worded."""
    w, h = _generator_size()
    for a in build_catalog():
        f = _width_share(a["prompt"])
        crop = "chest" if _is_held_mic(a) else "hip"
        lo, hi = (0.45, 0.75) if crop == "chest" else (0.75, 0.95)
        fill = CROP_EXTENT_OVER_SHOULDERS[crop] * f / (h / w)
        assert lo <= fill <= hi, (
            f"{a['slug']}: shoulders at {f:.0%} of width put the visible body at "
            f"{fill:.0%} of frame height - too little invites legs, too much crops the head")


def test_prompt_aspect_matches_the_size_actually_requested():
    """The prompt claimed 'Vertical 9:16' while the API rendered 1024x1536 (2:3)."""
    from math import gcd
    w, h = _generator_size()
    g = gcd(w, h)
    for a in build_catalog():
        assert f"Vertical {w // g}:{h // g}" in a["prompt"], a["slug"]


def test_side_edges_still_protected_for_chroma_key():
    """The bottom is now deliberately cropped, but shoulders must never be."""
    for a in build_catalog():
        assert "never touching or cropped by the side edges" in a["prompt"], a["slug"]


def test_public_json_has_no_internal_keys():
    for a in build_catalog():
        public = {k: v for k, v in a.items() if not k.startswith("_")}
        assert set(public) == PUBLIC_KEYS


def test_article_agrees_with_profession():
    """Professions were emitted as a hardcoded "a {profession}" → "a e-commerce"."""
    for a in build_catalog():
        prof = _sector(a["sector"])[2]
        want = f"{'an' if prof[0] in 'aeiou' else 'a'} {prof}"
        assert want in a["prompt"], (a["slug"], want)


DIRECTIONAL = ["to the side", "angled", "toward it", "off to one", "turned to"]


def test_no_directional_pose_or_body_language():
    """Avatars get composited left, right or centre, so a body angled or gesturing
    to one side reads as pointing off-screen."""
    for a in build_catalog():
        for phrase in DIRECTIONAL:
            assert phrase not in a["prompt"], (a["slug"], phrase)


def test_every_prompt_states_square_to_camera():
    for a in build_catalog():
        assert "shoulders square to the camera" in a["prompt"], a["slug"]


def test_handheld_mic_only_in_presenter_sectors():
    """A dentist or lawyer holding a stage mic reads wrong; a coach or influencer doesn't."""
    for slug, keys in SECTOR_POSES.items():
        has_handheld = any(POSES[k][1] == "handheld" for k in keys)
        assert has_handheld == (slug in HANDHELD_SECTORS), slug


def test_handheld_mic_is_the_minority_pose():
    """A collar-clipped lapel mic is the default; handheld is for variety only."""
    cat = build_catalog()
    mic = sum(POSES[a["_pose"]][1] == "handheld" for a in cat)
    assert 0.20 <= mic / len(cat) <= 0.40, f"{mic}/{len(cat)} hold a handheld mic"


def test_every_sector_offers_a_lavalier_pose():
    for slug, keys in SECTOR_POSES.items():
        assert any(POSES[k][1] == "lavalier" for k in keys), slug


IDENTITY_KEYS = ["face", "eyes", "eyebrows", "nose", "lips", "complexion",
                 "build", "distinguishing"]


def test_every_persona_has_a_full_facial_feature_set():
    for a in build_catalog():
        for k in IDENTITY_KEYS:
            assert a["_features"].get(k), (a["slug"], k)


def test_no_two_avatars_share_their_full_feature_set():
    """'Unique in every way' - across the WHOLE catalog, not just within a bucket."""
    seen = {}
    for a in build_catalog():
        key = tuple(sorted(a["_features"].items()))
        assert key not in seen, f"{a['slug']} is a twin of {seen.get(key)}"
        seen[key] = a["slug"]


def test_facial_features_appear_in_the_prompt():
    for a in build_catalog():
        for k in ("eyes", "eyebrows", "nose", "lips"):
            assert a["_features"][k] in a["prompt"], (a["slug"], k)


def test_strides_are_coprime_with_every_pool_they_index():
    """A stride sharing a factor with its pool length silently collapses the pool -
    stride 3 over 6 hijab styles only ever reached 2 of them."""
    from math import gcd
    combos = [(e, g, h) for e in COMPLEXIONS for g in ("kadın", "erkek") for h in (False, True)]
    for ethnicity, gender, hijab in combos:
        for name, pool in feature_pools(ethnicity, gender, hijab).items():
            assert gcd(STRIDES[name], len(pool)) == 1, (
                f"stride {STRIDES[name]} over {name} pool of {len(pool)} "
                f"reaches only {len(pool) // gcd(STRIDES[name], len(pool))} values")


# ── wardrobe palette ─────────────────────────────────────────────────────────
# Without a colour, the image model dressed a whole sector in the same black blazer
# and two personas rendered as look-alikes despite distinct faces and poses.

# Green-adjacent garments get keyed away with the chroma-key background.
CHROMA_RISK = ["green", "teal", "olive", "mint", "emerald", "lime", "sage", "jade"]


def test_palettes_avoid_chroma_key_greens():
    for colour in OUTFIT_COLORS + SCARF_COLORS:
        for risky in CHROMA_RISK:
            assert risky not in colour.lower(), colour


def test_every_non_uniform_persona_has_a_coloured_outfit():
    for a in build_catalog():
        if a["sector"] in UNIFORM_SECTORS:
            continue
        colour = a["_features"]["outfit"]
        assert colour in OUTFIT_COLORS, (a["slug"], colour)
        assert f"in {colour}" in a["prompt"], a["slug"]


def test_uniform_sectors_keep_their_whites_uncoloured():
    """'chef whites in burgundy' contradicts itself."""
    for a in build_catalog():
        if a["sector"] in UNIFORM_SECTORS:
            attire = _sector(a["sector"])[3]
            assert f"{attire} in " not in a["prompt"], a["slug"]


def test_hijab_personas_have_a_scarf_colour_distinct_from_the_outfit():
    for a in build_catalog():
        if not a["hijab"]:
            continue
        f = a["_features"]
        assert f["scarf_color"] in SCARF_COLORS, a["slug"]
        assert f"{f['scarf']} in {f['scarf_color']}" in a["prompt"], a["slug"]
        if a["sector"] not in UNIFORM_SECTORS:
            assert f["scarf_color"] != f["outfit"], a["slug"]


def test_outfit_colour_varies_within_every_sector():
    from collections import defaultdict
    by_sector = defaultdict(set)
    for a in build_catalog():
        if a["sector"] not in UNIFORM_SECTORS:
            by_sector[a["sector"]].add(a["_features"]["outfit"])
    for slug, colours in by_sector.items():
        assert len(colours) >= 2, f"{slug} dresses everyone in {colours}"


def test_kevser_and_beyza_are_visually_distinct():
    """The pair Berkan flagged: same sector, same gender, both hijab — they must not
    render as twins, so every at-a-glance cue has to differ."""
    cat = _by_slug(build_catalog())
    k, b = cat["kevser"]["_features"], cat["beyza"]["_features"]
    for cue in ("outfit", "scarf_color", "scarf", "face", "complexion"):
        assert k[cue] != b[cue], f"kevser and beyza share {cue}={k[cue]!r}"
    assert cat["kevser"]["_pose"] != cat["beyza"]["_pose"]


def test_prompt_asks_for_natural_unretouched_realism():
    for a in build_catalog():
        p = a["prompt"]
        assert "natural skin texture with visible pores" in p, a["slug"]
        assert "not airbrushed" in p or "no plastic" in p, a["slug"]


def test_microphone_is_always_a_lapel_mic():
    """A 'handheld microphone' renders as a big foam-ball stage mic. Held or clipped,
    it must always be the small lavalier/lapel clip mic."""
    for a in build_catalog():
        p = a["prompt"]
        assert "handheld microphone" not in p, a["slug"]
        assert "lapel" in p, a["slug"]
        assert "never a large handheld stage, reporter or karaoke microphone" in p, a["slug"]
        assert "no foam windscreen ball" in p, a["slug"]


def test_held_mic_avatars_are_close_up_portraits():
    """Held-mic avatars are shot as tight portraits; collar-mic ones stay wider."""
    for a in build_catalog():
        p = a["prompt"]
        if _is_held_mic(a):
            assert "close-up portrait camera angle" in p, a["slug"]
            assert "cropped at mid-chest" in p, a["slug"]
        else:
            assert "close-up" not in p, a["slug"]
            assert "cropped just below the hip" in p, a["slug"]


def test_no_fill_the_frame_clause_contradicting_the_margins():
    """'head and shoulders filling the frame' beat 'never cropped by the side edges'
    and produced a close-up with the top of the head cut off."""
    for a in build_catalog():
        assert "filling the frame" not in a["prompt"], a["slug"]


def test_whole_head_stays_inside_the_frame_with_margin():
    """Applies to BOTH crops - the top-crop failure is not close-up specific."""
    for a in build_catalog():
        p = a["prompt"]
        assert "entire head" in p and "fully inside the frame" in p, a["slug"]
        assert "never cropped at the top" in p, a["slug"]
        assert "clear empty space on all four sides" in p, a["slug"]
