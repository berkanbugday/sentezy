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


def _sector(slug: str) -> tuple[str, str, str, str]:
    return next(s for s in SECTORS if s[0] == slug)


def build_prompt(sector_slug: str, gender: str, age: str, ethnicity: str, hijab: bool = False) -> str:
    _, _, profession, attire = _sector(sector_slug)
    if hijab:
        # Muslim woman in a headscarf — hair is covered, so the hair-specific cues
        # (rim light on hair, crisp hair edges) are swapped for the headscarf.
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
        f"{GENDER_WORD[gender]}, a {profession}, upper body from mid-chest up, loosely framed "
        f"with clear space around the subject, facing the camera directly, warm natural "
        f"approachable expression with a relaxed, slightly-open neutral mouth for lip-sync, "
        f"clear unobstructed face. Wearing {wearing} (not wearing any green). A small lavalier "
        f"microphone clipped near the collar. Soft studio key light on the subject, {rim}, "
        f"{GREEN_BACKGROUND}. Eye-level, 85mm lens look, sharp focus on the eyes, realistic "
        f"skin texture, {edges}. Vertical 9:16, single person, centered with a wide, extra-generous empty "
        f"margin on BOTH the left and right — the subject occupies only ~45–50% of the frame "
        f"width, full shoulders visible with clear space to each side edge and never touching "
        f"or cropped by the frame edges, no hands covering the face, no text, no logos, no "
        f"watermark. Editorial, ultra-realistic, high detail."
    )


def entry(name: str, sector_slug: str, gender: str, age: str, ethnicity: str, image_id: str, slug: str, hijab: bool = False) -> dict:
    _, label, _, _ = _sector(sector_slug)
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
        "prompt": build_prompt(sector_slug, gender, age, ethnicity, hijab),
    }


def main() -> None:
    used_names: set[str] = {k["name"] for k in KNOWN}
    used_slugs: set[str] = {k["slug"] for k in KNOWN}
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

    avatars: list[dict] = [
        entry(k["name"], k["sector"], k["gender"], k["age"], k["ethnicity"], k["imageId"], k["slug"])
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
        avatars.append(entry(name, sector_slug, gender, age, ethnicity, "", uniq_slug(name)))
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
        avatars.append(
            entry(name, sector_slug, "kadın", age, ethnicity, "", uniq_slug(name), hijab=True)
        )

    out_path = os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "..", "api", "src", "data", "avatars.json")
    )
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    payload = {
        "note": "Generated by apps/worker/scripts/build_avatar_catalog.py — do not edit by hand. "
                "Run generate_avatars.py to fill empty imageId fields.",
        "count": len(avatars),
        "avatars": avatars,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    ready = sum(1 for a in avatars if a["imageId"])
    print(f"wrote {len(avatars)} avatars ({ready} ready, {len(avatars) - ready} pending) → {out_path}")


if __name__ == "__main__":
    main()
