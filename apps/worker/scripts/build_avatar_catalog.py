#!/usr/bin/env python3
"""Generate the avatar catalog → apps/api/src/data/avatars.json.

Deterministic (no randomness) so re-running is stable. Expands curated pools —
24 SMB sectors × gender × age × ethnicity, weighted ~50% Turkish/Mediterranean
for the market — into 100 distinct professional talking-head personas, then adds
one hijab-wearing Muslim woman per sector (24 more → 124 total) so the Turkish
market and Muslim audiences have a headscarf option in every sector, age bracket
and Turkish/Middle-Eastern ethnicity. Each persona carries a generation prompt for
`generate_avatars.py` and filter metadata (sector, gender, age, hijab) for the
picker. Portraits are generated + uploaded to R2 by `generate_avatars.py`.

Run:  python apps/worker/scripts/build_avatar_catalog.py
"""

from __future__ import annotations

import json
import os

# ── sectors (SMB-weighted) ───────────────────────────────────────────────────
# slug, Turkish label, English profession, attire (English).
# NO scene background — for A-roll/B-roll the avatar must sit on a clean, plain
# studio backdrop (below) so B-roll cutaways and captions never fight a scene, and a
# sector-specific room never appears behind the wrong reel. Attire carries the sector.
SECTORS: list[tuple[str, str, str, str]] = [
    ("beauty", "Güzellik & Kuaför", "hair and beauty salon owner", "a stylish salon apron over a fashionable top"),
    ("restaurant", "Restoran & Kafe", "restaurant owner", "clean chef whites"),
    ("realestate", "Emlak", "real estate agent", "a tailored blazer over a crisp shirt"),
    ("fashion", "Moda & Butik", "fashion boutique owner", "trendy fashionable smart-casual clothing"),
    ("fitness", "Fitness & Spor", "fitness coach", "fitted athletic activewear"),
    ("dental", "Diş & Ağız Sağlığı", "dentist", "clean medical scrubs"),
    ("health", "Sağlık & Klinik", "doctor", "a white medical coat over scrubs"),
    ("pharmacy", "Eczane", "pharmacist", "a white pharmacist coat"),
    ("education", "Eğitim & Kurs", "teacher", "smart-casual professional clothing"),
    ("legal", "Hukuk & Danışmanlık", "lawyer", "a formal dark business suit"),
    ("finance", "Finans & Muhasebe", "financial advisor", "a tailored business suit"),
    ("tech", "Teknoloji & Yazılım", "tech founder", "a clean modern smart-casual outfit"),
    ("automotive", "Otomotiv", "car dealership representative", "a smart branded polo shirt"),
    ("travel", "Seyahat & Turizm", "travel agent", "smart-casual travel clothing"),
    ("jewelry", "Kuyumcu", "jeweller", "elegant formal attire"),
    ("optics", "Optik", "optician", "a smart professional shirt with stylish eyeglasses"),
    ("petshop", "Petshop", "pet shop owner", "a friendly branded polo shirt"),
    ("construction", "İnşaat & Yapı", "construction contractor", "a clean collared work shirt"),
    ("wedding", "Düğün & Organizasyon", "wedding planner", "elegant formal event attire"),
    ("cosmetics", "Kozmetik & Cilt Bakımı", "skincare specialist", "chic modern professional clothing"),
    ("corporate", "Kurumsal", "corporate spokesperson", "a professional business suit"),
    ("influencer", "Yaşam & İçerik", "lifestyle content creator", "trendy casual fashionable clothing"),
    ("ecommerce", "E-ticaret Markası", "e-commerce brand founder", "smart-casual modern clothing"),
    ("coaching", "Koçluk & Gelişim", "personal development coach", "smart-casual confident professional clothing"),
]

# Green screen — best for AI matting: max contrast for every hair colour and the spill
# is fully removable (green despill), so edges stay clean over any B-roll. The picker
# never shows green — generate_avatars.py mattes a clean thumbnail for the library.
GREEN_BACKGROUND = (
    "a solid, perfectly even chroma-key green screen background (bright chroma green), "
    "completely plain and uniform, evenly lit, no props, no scenery, no shadows on the background"
)

# ── ethnicity → prompt descriptor, weighted toward Turkish/Mediterranean ──────
ETHNICITY_DESC: dict[str, str] = {
    "turkish": "Turkish Mediterranean",
    "european": "European",
    "mideast": "Middle-Eastern",
    "eastasian": "East-Asian",
    "black": "Black African",
    "southasian": "South-Asian",
    "latino": "Latin American",
}
# turkish appears ~half the cycle → ~50% of the library
ETHNICITY_CYCLE = [
    "turkish", "turkish", "european", "turkish", "mideast", "turkish", "eastasian",
    "turkish", "black", "turkish", "southasian", "turkish", "latino",
]

# ── name pools by ethnicity + gender (unique, gender-appropriate) ─────────────
NAMES: dict[str, dict[str, list[str]]] = {
    "turkish": {
        "kadın": ["Elif", "Zeynep", "Ayşe", "Merve", "Ece", "Buse", "Deniz", "Gizem",
                   "Sıla", "Nur", "İrem", "Cansu", "Melis", "Beren", "Yasemin", "Damla",
                   "Ceren", "Aslı", "Pelin", "Duru", "Naz", "Esra", "Sena", "Öykü",
                   "Bade", "Ela", "Lara", "Mira", "Zehra", "Hande", "Tuğçe", "Gül",
                   "Işıl", "Berrak", "Feride", "Su"],
        "erkek": ["Mert", "Can", "Burak", "Ozan", "Efe", "Yusuf", "Kaan", "Baran",
                   "Onur", "Arda", "Tolga", "Berk", "Sinan", "Umut", "Barış",
                   "Cem", "Eren", "Serkan", "Tuna", "Alp", "Doruk", "Bora",
                   "Kaya", "Emir", "Yiğit", "Bertan", "Poyraz", "Batu", "Ege", "Toprak",
                   "Çınar", "Kuzey", "Demir", "Aras", "Selim", "Kağan"],
    },
    "european": {
        "kadın": ["Anna", "Sofia", "Klara", "Elena", "Ingrid", "Marta", "Lena", "Julia"],
        "erkek": ["Lukas", "Marco", "Erik", "David", "Adrian", "Felix", "Niklas", "Leon"],
    },
    "mideast": {
        "kadın": ["Layla", "Yasmin", "Rana", "Salma", "Nadia", "Amira", "Dina", "Hana"],
        "erkek": ["Omar", "Karim", "Sami", "Tariq", "Ali", "Rami", "Ziad", "Fadi"],
    },
    "eastasian": {
        "kadın": ["Mei", "Yuki", "Hana", "Jia", "Soo", "Lin", "Aiko", "Min"],
        "erkek": ["Kenji", "Wei", "Jun", "Hiro", "Tao", "Minho", "Ren", "Kai"],
    },
    "black": {
        "kadın": ["Amara", "Zola", "Nia", "Aya", "Chidi", "Imani", "Ada", "Thandi"],
        "erkek": ["Kwame", "Malik", "Jabari", "Tunde", "Sefu", "Kofi", "Dayo", "Zuri"],
    },
    "southasian": {
        "kadın": ["Priya", "Aisha", "Meera", "Anaya", "Riya", "Diya", "Sana", "Kavya"],
        "erkek": ["Arjun", "Rohan", "Vikram", "Aditya", "Rahul", "Karan", "Neil", "Dev"],
    },
    "latino": {
        "kadın": ["Camila", "Valentina", "Lucia", "Isabela", "Sofía", "Mariana", "Elena", "Paula"],
        "erkek": ["Mateo", "Diego", "Santiago", "Lucas", "Nicolás", "Andrés", "Javier", "Tomás"],
    },
}

AGE_DESC: dict[str, str] = {
    "genç": "young adult in their late 20s",
    "yetişkin": "adult in their late 30s",
    "olgun": "mature person in their early 50s",
}
AGES = ["genç", "yetişkin", "olgun"]
GENDER_WORD = {"kadın": "woman", "erkek": "man"}

# ── hijab personas — Muslim women's names (Türkiye + Middle-East) ─────────────
# Kept separate from NAMES so hijab slugs never collide with the base catalog.
# Only turkish + mideast: hijab targets the Turkish market and Muslim countries.
HIJAB_NAMES: dict[str, list[str]] = {
    "turkish": ["Kübra", "Betül", "Rabia", "Sümeyye", "Rümeysa", "Büşra",
                "Şeyma", "Ravza", "Feyza", "Hümeyra", "Zeliha", "Hafsa",
                "Elifnur", "Zeynepnur"],
    "mideast": ["Fatima", "Khadija", "Mariam", "Zainab", "Noor", "Huda",
                "Sumaya", "Rahma", "Bushra", "Iman", "Aaliyah", "Safiya",
                "Amina", "Yusra"],
}
HIJAB_ETHNICITIES = ["turkish", "mideast"]

# Curated named avatars — imageId is filled by generate_avatars.py (uploads to R2).
KNOWN: list[dict] = [
    {"slug": "defne", "name": "Defne", "sector": "beauty", "gender": "kadın", "age": "genç", "ethnicity": "turkish", "imageId": ""},
    {"slug": "kerem", "name": "Kerem", "sector": "tech", "gender": "erkek", "age": "yetişkin", "ethnicity": "turkish", "imageId": ""},
    {"slug": "selin", "name": "Selin", "sector": "realestate", "gender": "kadın", "age": "yetişkin", "ethnicity": "turkish", "imageId": ""},
    {"slug": "emre", "name": "Emre", "sector": "fitness", "gender": "erkek", "age": "genç", "ethnicity": "turkish", "imageId": ""},
]

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


# ── pose palette — hands/arms + microphone. Drives HeyGen motion variety. ─────
# key → (pose fragment, mic kind). Handheld-mic poses keep the mouth uncovered.
# Every pose must be non-directional: the avatar is composited on the left, right or
# centre of a reel, so any gesture or body turn "to one side" reads as pointing
# off-screen. Poses stay symmetric and square to the lens.
POSES: dict[str, tuple[str, str]] = {
    "mic_speaking": ("holding a small wireless lapel microphone in one hand while speaking — a "
                     "tiny clip-on lavalier capsule, not a stage mic — raised only to chest "
                     "height and well below the chin so the mouth stays fully visible and is "
                     "never covered, both shoulders level and square to the camera", "handheld"),
    "mic_chest": ("holding a small wireless lapel microphone in one hand at chest height — a "
                  "tiny clip-on lavalier capsule resting between the fingers, not a stage mic — "
                  "mouth fully visible, both shoulders level and square to the camera",
                  "handheld"),
    "calm": ("hands resting low and lightly clasped near the waist, calm and still "
             "with minimal gesturing", "lavalier"),
    "open_palm": ("both hands raised in a soft, even open-palm gesture at chest height, "
                  "symmetric and not pointing anywhere in particular", "lavalier"),
    "arms_crossed": ("arms lightly and confidently crossed at the chest with relaxed "
                     "shoulders", "lavalier"),
}

# Sectors where a handheld mic reads naturally (presenter/on-camera trades). Everyone
# else wears the clipped lapel mic — a dentist or lawyer holding a stage mic looks wrong.
HANDHELD_SECTORS: set[str] = {"influencer", "coaching", "corporate", "education",
                              "travel", "fitness", "ecommerce", "automotive"}

# Each sector lists ≥2 suitable poses; rotation picks among them so same-sector
# personas don't all share one pose.
SECTOR_POSES: dict[str, list[str]] = {
    "beauty": ["open_palm", "calm", "arms_crossed"],
    "restaurant": ["open_palm", "calm", "arms_crossed"],
    "realestate": ["arms_crossed", "calm", "open_palm"],
    "fashion": ["open_palm", "arms_crossed", "calm"],
    "fitness": ["open_palm", "mic_speaking", "mic_chest"],
    "dental": ["calm", "open_palm", "arms_crossed"],
    "health": ["calm", "open_palm", "arms_crossed"],
    "pharmacy": ["calm", "open_palm", "arms_crossed"],
    "education": ["open_palm", "mic_speaking", "mic_chest"],
    "legal": ["arms_crossed", "calm", "open_palm"],
    "finance": ["calm", "arms_crossed", "open_palm"],
    "tech": ["arms_crossed", "open_palm", "calm"],
    "automotive": ["open_palm", "mic_speaking", "mic_chest"],
    "travel": ["open_palm", "mic_speaking", "mic_chest"],
    "jewelry": ["calm", "open_palm", "arms_crossed"],
    "optics": ["open_palm", "calm", "arms_crossed"],
    "petshop": ["open_palm", "calm", "arms_crossed"],
    "construction": ["arms_crossed", "calm", "open_palm"],
    "wedding": ["open_palm", "calm", "arms_crossed"],
    "cosmetics": ["open_palm", "calm", "arms_crossed"],
    "corporate": ["open_palm", "mic_speaking", "mic_chest"],
    "influencer": ["open_palm", "mic_speaking", "mic_chest"],
    "ecommerce": ["open_palm", "mic_speaking", "mic_chest"],
    "coaching": ["open_palm", "mic_speaking", "mic_chest"],
}


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
    "eastasian": ["fair", "light", "warm ivory"],
    "black": ["medium brown", "deep brown", "rich dark brown"],
    "southasian": ["light brown", "medium brown", "warm tan"],
    "latino": ["light tan", "warm tan", "medium brown"],
}
BUILDS = ["a slim build", "an average build", "an athletic, toned build",
          "a broad-shouldered build", "a petite frame", "a tall, lean build"]
# Face shape and hair alone let mouths, brows and noses repeat across personas, so
# the catalog still read as look-alikes. These carry the rest of the identity.
EYE_SHAPES = ["almond-shaped eyes", "wide, round eyes", "softly hooded eyes",
              "upturned eyes", "deep-set eyes", "large expressive eyes",
              "narrow, calm eyes"]
EYEBROWS = ["thick straight brows", "softly arched brows", "high-arched brows",
            "full natural brows", "slim tapered brows", "strong angular brows",
            "gently rounded brows"]
NOSES = ["a straight narrow nose", "a softly rounded nose", "a slightly aquiline nose",
         "a small button nose", "a broad, gently curved nose", "a refined tapered nose"]
LIPS = ["full lips", "a wide, expressive mouth", "a small, delicate mouth",
        "medium lips with a defined cupid's bow", "thin, neatly shaped lips",
        "a soft, slightly asymmetric smile"]
# ── wardrobe palette — the axis that was missing ─────────────────────────────
# Face, pose and framing already varied, but attire carried NO colour, so the image
# model defaulted every persona in a sector to the same outfit: the two ecommerce
# hijab personas came back as near-twins in identical black blazers. At thumbnail
# size colour is what actually separates two people.
# NOTHING green, teal, olive or mint: the background is a chroma-key green screen,
# so a green-adjacent garment gets keyed away with it and punches a hole in the avatar.
OUTFIT_COLORS = [
    "deep navy", "charcoal grey", "classic black", "warm camel", "burgundy",
    "rust orange", "cream ivory", "dusty rose", "slate blue", "deep plum",
    "mustard ochre", "chocolate brown", "soft lilac", "powder blue", "brick red",
    "stone grey",
]
# Kept separate from OUTFIT_COLORS so the headscarf never matches the jacket — the
# prompt already asks for the two to be "colour-coordinated", not identical.
SCARF_COLORS = [
    "blush pink", "soft cream", "dusty blue", "deep plum", "warm terracotta",
    "mocha brown", "pale lavender", "mustard yellow", "navy", "soft dove grey",
    "burgundy", "peach",
]

# Sectors whose attire is white by definition — colouring "chef whites" or a "white
# pharmacist coat" contradicts itself, so these keep their uniform and take their
# variety from face, pose and (for hijab personas) the headscarf colour instead.
UNIFORM_SECTORS: set[str] = {"restaurant", "health", "pharmacy"}

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


# Every stride MUST be coprime with the length of the pool it indexes, or that pool
# silently collapses to len/gcd values (stride 3 over 6 hijab styles reached only 2).
STRIDES: dict[str, int] = {
    "face": 1, "eyes": 3, "eyebrows": 2, "nose": 5, "lips": 5, "hair": 3, "color": 5,
    "complexion": 2, "build": 7, "distinguishing": 4, "facial_hair": 5, "scarf": 5,
    "outfit": 5, "scarf_color": 5,
}


def feature_pools(ethnicity: str, gender: str, hijab: bool) -> dict[str, list[str]]:
    """Which pool each feature is drawn from for this persona bucket."""
    pools = {
        "face": FACE_SHAPES, "eyes": EYE_SHAPES, "eyebrows": EYEBROWS,
        "nose": NOSES, "lips": LIPS, "complexion": COMPLEXIONS[ethnicity],
        "build": BUILDS, "distinguishing": DISTINGUISHING, "outfit": OUTFIT_COLORS,
    }
    if hijab:
        pools["scarf"] = HIJAB_STYLES
        pools["scarf_color"] = SCARF_COLORS
    else:
        pools["hair"] = HAIR_WOMEN if gender == "kadın" else HAIR_MEN
        pools["color"] = HAIR_COLORS[ethnicity]
        if gender == "erkek":
            pools["facial_hair"] = FACIAL_HAIR_MEN
    return pools


def _sector(slug: str) -> tuple[str, str, str, str]:
    return next(s for s in SECTORS if s[0] == slug)


def _feature_line(f: dict, gender: str, hijab: bool) -> str:
    parts = [f"{f['complexion']} skin", f["face"], f["eyes"], f["eyebrows"],
             f["nose"], f["lips"], f["build"]]
    if hijab:
        parts.append(f["distinguishing"])
    else:
        parts.append(f"{f['hair']} in {f['color']}")
        if gender == "erkek":
            parts.append(f["facial_hair"])
        parts.append(f["distinguishing"])
    return ", ".join(parts)


# Beauty-led sectors: buyers expect a young, polished, editorial-looking presenter.
GLAM_SECTORS: set[str] = {"beauty", "cosmetics", "ecommerce", "fashion", "jewelry", "influencer"}


def _article(noun: str) -> str:
    """"a optician" / "a e-commerce brand founder" read as typos to the image model."""
    return f"{'an' if noun[0].lower() in 'aeiou' else 'a'} {noun}"


def is_glam(sector_slug: str, gender: str) -> bool:
    return sector_slug in GLAM_SECTORS and gender == "kadın"


def build_prompt(sector_slug: str, gender: str, age: str, ethnicity: str, features: dict,
                 pose_key: str, hijab: bool = False, glam: bool = False) -> str:
    _, _, profession, attire = _sector(sector_slug)
    pose_fragment, mic_kind = POSES[pose_key]
    if mic_kind == "handheld":
        mic_clause = ""  # the handheld mic is already described by pose_fragment
    else:
        mic_clause = ("A small black lavalier (lapel) microphone clipped visibly to the collar. ")
    # Colour the outfit unless the sector's attire is white by definition.
    outfit = attire if sector_slug in UNIFORM_SECTORS else f"{attire} in {features['outfit']}"
    if hijab:
        # Muslim woman in a headscarf — hair is covered, so the hair-specific cues
        # (rim light on hair, crisp hair edges) are swapped for the headscarf.
        wearing = (
            f"{features['scarf']} in {features['scarf_color']} that neatly covers the hair and "
            f"frames the face, tastefully colour-coordinated with {outfit}"
        )
        rim = "gentle rim light to separate the head and shoulders from the background"
        edges = "crisp fabric edges on the headscarf"
    else:
        wearing = outfit
        rim = "gentle rim light to separate the hair from the background"
        edges = "crisp hair edges"
    if glam:
        if hijab:
            wearing += (", polished skin and softly defined brows, subtle tasteful makeup, "
                        "well-groomed with an editorial beauty finish")
        else:
            wearing += (", styled hair, tasteful polished makeup, well-groomed with an "
                        "editorial beauty finish")
    # Someone holding a mic is shot like a presenter piece-to-camera: tight portrait
    # close-up. Collar-mic avatars stay in the wider upper-body medium shot.
    if mic_kind == "handheld":
        crop_intro = "a close-up portrait cropped at mid-chest"
        framing = (
            "centered in a close-up portrait camera angle — the shoulders span "
            "~68–72% of the frame width, with a clear empty margin on BOTH the left and right, "
            "full shoulders visible and never touching or cropped by the side edges. Framed as a "
            "close-up portrait: the frame is cropped at mid-chest, NOT a full-body or "
            "medium shot, no legs or feet visible."
        )
    else:
        crop_intro = "an upper-body medium shot cropped just below the hip"
        framing = (
            "centered with a modest empty margin on BOTH the left and right — the shoulders span "
            "~62–67% of the frame width, full shoulders visible with clear space to each side edge "
            "and never touching or cropped by the side edges. Framed as an upper-body medium shot: "
            "the frame is cropped just below the hip so a good amount of the torso is visible, and "
            "the body fills most of the frame height with only modest headroom, NOT a full-body "
            "shot, no legs or feet visible."
        )
    return (
        f"Photorealistic professional portrait of a {AGE_DESC[age]} {ETHNICITY_DESC[ethnicity]} "
        f"{GENDER_WORD[gender]} with {_feature_line(features, gender, hijab)}, {_article(profession)}, "
        f"{crop_intro}, {pose_fragment}, "
        f"comfortably framed, facing the camera directly with shoulders square to the camera "
        f"and the head and eyes looking straight into the lens — the body is not turned, "
        f"rotated or leaning either way, and no gesture points off-frame, warm "
        f"natural approachable expression with a relaxed, slightly-open neutral mouth for lip-sync, "
        f"clear unobstructed face. Wearing {wearing} (not wearing any green). {mic_clause}Soft studio key "
        f"light on the subject, {rim}, {GREEN_BACKGROUND}. Eye-level, 85mm lens look, sharp focus on "
        f"the eyes, realistic skin texture, {edges}. Vertical 2:3, single person, "
        f"{framing} The subject is never pressed against the frame: keep clear empty space on all "
        f"four sides, and the entire head — including the top of the hair or headscarf — stays "
        f"fully inside the frame with comfortable headroom above it, never cropped at the top. "
        f"No hands covering the face, no text, no "
        f"logos, no watermark. The microphone is ALWAYS a small lavalier/lapel clip microphone — "
        f"never a large handheld stage, reporter or karaoke microphone, no foam windscreen ball, "
        f"no microphone stand. A real person photographed in a real studio — natural skin "
        f"texture with visible pores, fine lines and subtle natural asymmetry, not airbrushed, "
        f"no plastic or CGI look. Candid, natural, ultra-realistic editorial photography."
    )


def entry(name: str, sector_slug: str, gender: str, age: str, ethnicity: str, image_id: str, slug: str,
          pose_key: str, features: dict, hijab: bool = False) -> dict:
    _, label, _, _ = _sector(sector_slug)
    # Derived here (not at each call site) so no persona can miss the override.
    glam = is_glam(sector_slug, gender)
    if glam:
        age = "genç"
    return {
        "slug": slug,
        "name": name,
        "sector": sector_slug,
        "sectorLabel": label,
        "gender": gender,
        "age": age,
        "ethnicity": ethnicity,
        "hijab": hijab,            # True → Muslim woman in a headscarf (Türkiye + Middle-East)
        "imageId": image_id,       # green-screen source (fed to HeyGen)
        "displayImageId": "",      # matted thumbnail for the picker (filled by generate_avatars.py)
        "prompt": build_prompt(sector_slug, gender, age, ethnicity, features, pose_key, hijab, glam),
        "_pose": pose_key,
        "_features": features,
    }


def build_catalog() -> list[dict]:
    used_names: set[str] = {k["name"] for k in KNOWN} | {e["name"] for e in EXTRA}
    used_slugs: set[str] = {k["slug"] for k in KNOWN} | {e["slug"] for e in EXTRA}
    name_cursor: dict[tuple[str, str], int] = {}

    def take_name(ethnicity: str, gender: str) -> str:
        pool = NAMES[ethnicity][gender]
        i = name_cursor.get((ethnicity, gender), 0)
        # advance until an unused name (pools are sized to never exhaust)
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

    pose_cursor: dict[str, int] = {}

    def take_pose(sector_slug: str) -> str:
        keys = SECTOR_POSES[sector_slug]
        j = pose_cursor.get(sector_slug, 0)
        pose_cursor[sector_slug] = j + 1
        return keys[j % len(keys)]

    # ── distinctiveness engine — ethnicity-gated feature pools + a deterministic
    # per-(ethnicity, gender, hijab) uniqueness guard, plus hard overrides for the
    # named look-alike clusters (defne/deniz, zeynep/ece).
    feat_cursor: dict[tuple, int] = {}
    used_combos: set = set()   # full feature tuple — no two personas identical anywhere
    used_coarse: set = set()   # the at-a-glance cues, per bucket — no two read alike

    def assign_features(slug, ethnicity, gender, hijab) -> dict:
        bucket = (ethnicity, gender, hijab)
        pools = feature_pools(ethnicity, gender, hijab)
        i = feat_cursor.get(bucket, 0)
        # sweep grid: the two pools whose offsets we vary to escape a collision
        sweep_a = "scarf" if hijab else "hair"
        sweep_b = "facial_hair" if ("facial_hair" in pools) else "distinguishing"

        def build(off_a, off_b):
            f = {}
            for name, pool in pools.items():
                extra = off_a if name == sweep_a else (off_b if name == sweep_b else 0)
                f[name] = pool[(i * STRIDES[name] + extra) % len(pool)]
            # hand-pinned looks for the clusters Berkan called out; the rest of the
            # face still comes from the pools so overrides stay fully specified.
            f.update(FEATURE_OVERRIDES.get(slug, {}))
            return f

        # Every feature is modular in `i`, so retrying with `i += 1` just walks a cycle
        # of lcm(pool sizes) keys and can spin forever. Instead hold `i` fixed and sweep
        # offsets across the sweep_a x sweep_b grid — each offset hits every value of its
        # pool exactly once, so this enumerates the whole grid and always terminates.
        for attempt in range(len(pools[sweep_a]) * len(pools[sweep_b])):
            f = build(attempt % len(pools[sweep_a]), attempt // len(pools[sweep_a]))
            key = tuple(sorted(f.items()))
            # Full uniqueness alone still lets two personas share face + hair + beard and
            # differ only in, say, nose — which reads as a look-alike at thumbnail size.
            coarse = (bucket, f["face"], f.get("hair") or f.get("scarf"),
                      f.get("facial_hair") or f["distinguishing"])
            if key not in used_combos and coarse not in used_coarse:
                used_combos.add(key)
                used_coarse.add(coarse)
                feat_cursor[bucket] = i + 1
                return f
        raise RuntimeError(
            f"no distinct feature combo left for bucket {bucket} "
            f"({len(pools[sweep_a])}x{len(pools[sweep_b])} grid exhausted at i={i})")

    avatars: list[dict] = [
        entry(k["name"], k["sector"], k["gender"], k["age"], k["ethnicity"], k["imageId"], k["slug"],
              take_pose(k["sector"]), assign_features(k["slug"], k["ethnicity"], k["gender"], False))
        for k in KNOWN
    ]

    # generate the remaining 96 to reach 100
    i = 0
    while len(avatars) < 100:
        sector_slug = SECTORS[i % len(SECTORS)][0]
        gender = "kadın" if i % 2 == 0 else "erkek"
        age = AGES[i % 3]
        ethnicity = ETHNICITY_CYCLE[i % len(ETHNICITY_CYCLE)]
        name = take_name(ethnicity, gender)
        slug = uniq_slug(name)
        features = assign_features(slug, ethnicity, gender, False)
        avatars.append(entry(name, sector_slug, gender, age, ethnicity, "", slug,
                              take_pose(sector_slug), features))
        i += 1

    # ── hijab personas — one Muslim woman per sector so every sector, age and the
    # Turkish/Middle-Eastern audiences all have a headscarf option. Age cycles so
    # all three brackets appear; ethnicity alternates turkish ↔ mideast.
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
        slug = uniq_slug(name)
        features = assign_features(slug, ethnicity, "kadın", True)
        avatars.append(
            entry(name, sector_slug, "kadın", age, ethnicity, "", slug,
                  take_pose(sector_slug), features, hijab=True)
        )

    # extras appended on top of the generated 124 → 126 total (preserve their images)
    for ex in EXTRA:
        features = assign_features(ex["slug"], ex["ethnicity"], ex["gender"], ex["hijab"])
        e = entry(ex["name"], ex["sector"], ex["gender"], ex["age"], ex["ethnicity"],
                  ex["imageId"], ex["slug"], take_pose(ex["sector"]), features, hijab=ex["hijab"])
        e["displayImageId"] = ex["displayImageId"]
        avatars.append(e)

    return avatars


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


if __name__ == "__main__":
    main()
