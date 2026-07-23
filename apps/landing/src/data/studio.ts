/** Data for the three live studio demos. Every row here mirrors something real in the product,
 *  because the demos are the product's own pickers rebuilt in CSS — if a row is invented, the
 *  demo becomes a lie that happens to animate.
 *
 *  presenters → apps/api/src/data/avatars.json (the 12 with a displayImageId)
 *  voices     → the shared ElevenLabs library the composer's voice picker lists
 *  tracks     → apps/api/src/data/music.json (11 beds, 4 moods)
 */
import type { Copy } from "./copy";

export type Presenter = {
  slug: string;
  name: string;
  sector: Copy;
  tint: "cool" | "warm" | "rose" | "teal" | "violet" | "amber";
  /** Space-separated filter tags, matched by src/scripts/studio.ts. */
  tags: string;
};

export const presenters: Presenter[] = [
  { slug: "kevser",  name: "Kevser",  tint: "rose",   tags: "women hijab", sector: { en: "E-commerce",  tr: "E-ticaret" } },
  { slug: "anna",    name: "Anna",    tint: "cool",   tags: "women",       sector: { en: "Real estate", tr: "Emlak" } },
  { slug: "aaliyah", name: "Aaliyah", tint: "violet", tags: "women hijab", sector: { en: "Influencer",  tr: "Influencer" } },
  { slug: "arda",    name: "Arda",    tint: "teal",   tags: "men",         sector: { en: "Pharmacy",    tr: "Eczane" } },
  { slug: "beyza",   name: "Beyza",   tint: "warm",   tags: "women hijab", sector: { en: "E-commerce",  tr: "E-ticaret" } },
  { slug: "hana",    name: "Hana",    tint: "cool",   tags: "women",       sector: { en: "Finance",     tr: "Finans" } },
  { slug: "sumeyye", name: "Sümeyye", tint: "teal",   tags: "women hijab", sector: { en: "Health",      tr: "Sağlık" } },
  { slug: "alp",     name: "Alp",     tint: "cool",   tags: "men",         sector: { en: "Optics",      tr: "Optik" } },
  { slug: "mariam",  name: "Mariam",  tint: "teal",   tags: "women hijab", sector: { en: "Dental",      tr: "Diş" } },
  { slug: "camila",  name: "Camila",  tint: "amber",  tags: "women",       sector: { en: "Automotive",  tr: "Otomotiv" } },
  { slug: "amara",   name: "Amara",   tint: "violet", tags: "women",       sector: { en: "Education",   tr: "Eğitim" } },
  { slug: "aisha",   name: "Aisha",   tint: "warm",   tags: "women",       sector: { en: "Automotive",  tr: "Otomotiv" } },
];

/** Counts are asserted against `presenters` at build time — a filter chip that promises 5 and
 *  shows 4 is the kind of small lie this whole rebuild exists to prevent. */
export const presenterFilters = [
  { id: "all",   label: { en: "All",   tr: "Tümü" } },
  { id: "women", label: { en: "Women", tr: "Kadın" } },
  { id: "men",   label: { en: "Men",   tr: "Erkek" } },
  { id: "hijab", label: { en: "Hijab", tr: "Başörtülü" } },
].map((f) => ({
  ...f,
  count: f.id === "all" ? presenters.length : presenters.filter((p) => p.tags.split(" ").includes(f.id)).length,
}));

export type Voice = { name: string; tone: Copy; age: Copy };

/** Six of the shared voices the composer lists. Names are the library's own. */
export const voices: Voice[] = [
  { name: "PJ",                tone: { en: "Conversational", tr: "Sohbet" },   age: { en: "Young",      tr: "Genç" } },
  { name: "Kate Mercer",       tone: { en: "Narrative",      tr: "Anlatım" },  age: { en: "Middle-aged", tr: "Orta yaş" } },
  { name: "Rene",              tone: { en: "Conversational", tr: "Sohbet" },   age: { en: "Young",      tr: "Genç" } },
  { name: "David",             tone: { en: "Social media",   tr: "Sosyal medya" }, age: { en: "Young", tr: "Genç" } },
  { name: "Wilson Pacheco Jr.", tone: { en: "Conversational", tr: "Sohbet" },  age: { en: "Middle-aged", tr: "Orta yaş" } },
  { name: "Niuriel",           tone: { en: "Narrative",      tr: "Anlatım" },  age: { en: "Young",      tr: "Genç" } },
];

export type Track = { name: string; mood: string; moodLabel: Copy; sec: number };

export const tracks: Track[] = [
  { name: "Sinematik",          mood: "cinematic", moodLabel: { en: "Cinematic", tr: "Sinematik" }, sec: 31 },
  { name: "Fırtınadan Sonra",   mood: "cinematic", moodLabel: { en: "Cinematic", tr: "Sinematik" }, sec: 123 },
  { name: "Gölge Çetesi",       mood: "cinematic", moodLabel: { en: "Cinematic", tr: "Sinematik" }, sec: 74 },
  { name: "Sakin",              mood: "calm",      moodLabel: { en: "Calm",      tr: "Sakin" },     sec: 31 },
  { name: "Huzurlu An",         mood: "calm",      moodLabel: { en: "Calm",      tr: "Sakin" },     sec: 19 },
  { name: "Sakin Kasaba",       mood: "calm",      moodLabel: { en: "Calm",      tr: "Sakin" },     sec: 116 },
  { name: "Enerjik",            mood: "energetic", moodLabel: { en: "Energetic", tr: "Enerjik" },   sec: 30 },
  { name: "Neşe Dolu",          mood: "energetic", moodLabel: { en: "Energetic", tr: "Enerjik" },   sec: 21 },
  { name: "Zafer Anı",          mood: "energetic", moodLabel: { en: "Energetic", tr: "Enerjik" },   sec: 57 },
  { name: "Motivasyon Dalgası", mood: "corporate", moodLabel: { en: "Corporate", tr: "Kurumsal" },  sec: 170 },
  { name: "Başarı Anı",         mood: "corporate", moodLabel: { en: "Corporate", tr: "Kurumsal" },  sec: 27 },
];

export const moodFilters = [
  { id: "all",       label: { en: "All",       tr: "Tümü" } },
  { id: "cinematic", label: { en: "Cinematic", tr: "Sinematik" } },
  { id: "calm",      label: { en: "Calm",      tr: "Sakin" } },
  { id: "energetic", label: { en: "Energetic", tr: "Enerjik" } },
  { id: "corporate", label: { en: "Corporate", tr: "Kurumsal" } },
].map((f) => ({
  ...f,
  count: f.id === "all" ? tracks.length : tracks.filter((t) => t.mood === f.id).length,
}));

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
