/** Every user-visible string, in both languages. Components render the EN text as the
 *  element's content and the TR text as `data-tr`; src/scripts/i18n.ts swaps them at
 *  runtime. Keeping all copy here means a translation gap is a type error, not a
 *  half-translated page. */
export type Copy = { en: string; tr: string };

export const nav = {
  platform: { en: "Platform", tr: "Platform" },
  showcase: { en: "Showcase", tr: "Örnekler" },
  how: { en: "How it works", tr: "Nasıl çalışır" },
  login: { en: "Log in", tr: "Giriş yap" },
  cta: { en: "Start free", tr: "Ücretsiz başla" },
} satisfies Record<string, Copy>;

export const footer = {
  tagline: {
    en: "Reels with an AI presenter. No filming, no editing.",
    tr: "Yapay zeka sunuculu reels. Çekim yok, kurgu yok.",
  },
  productHead: { en: "Product", tr: "Ürün" },
  presenters: { en: "AI presenters", tr: "Yapay zeka sunucular" },
  captions: { en: "Captions", tr: "Altyazılar" },
  brandKit: { en: "Brand kit", tr: "Marka kiti" },
  solutionsHead: { en: "Solutions", tr: "Çözümler" },
  legalHead: { en: "Legal", tr: "Yasal" },
  privacy: { en: "Privacy", tr: "Gizlilik" },
  terms: { en: "Terms", tr: "Şartlar" },
  madeFor: { en: "Made for teams worldwide", tr: "Türkiye'de tasarlandı" },
  /** Identical in both languages, but it still lives here — a string that skips this module
   *  is a string nobody can find when the copy changes. */
  instagramHead: { en: "Instagram", tr: "Instagram" },
} satisfies Record<string, Copy>;

export const sectorNames = {
  travel: { en: "Travel", tr: "Seyahat" },
  beauty: { en: "Beauty", tr: "Güzellik" },
  realestate: { en: "Real Estate", tr: "Emlak" },
  gym: { en: "Gym", tr: "Spor Salonu" },
} satisfies Record<string, Copy>;

export const hero = {
  eyebrow: { en: "AI PRESENTER REELS", tr: "YAPAY ZEKA SUNUCULU REELS" },
  title: { en: "Reels that sell — without filming a thing.", tr: "Satan reels'ler — hiç çekim yapmadan." },
  lead: {
    en: "Paste a product link or a script. Sentezy picks an AI presenter, writes the copy, burns in viral captions, and hands back a finished 9:16 reel. Built for travel, beauty, real estate and gym brands.",
    tr: "Bir ürün linki ya da metin yapıştırın. Sentezy yapay zeka sunucuyu seçer, metni yazar, viral altyazıları basar ve size bitmiş bir 9:16 reels verir. Seyahat, güzellik, emlak ve spor salonu markaları için.",
  },
  ctaPrimary: { en: "Start free", tr: "Ücretsiz başla" },
  ctaSecondary: { en: "Watch a reel", tr: "Bir reels izle" },
  microcopy: { en: "No credit card required", tr: "Kredi kartı gerekmez" },
} satisfies Record<string, Copy>;

/** Every number here traces to source. Do not add one that does not.
 *   12 → apps/api/src/data/avatars.json, entries with a non-empty displayImageId
 *   24 → same file, distinct `sector` values
 *   20 → CAPTION_STYLE_META in packages/types/src/index.ts
 *   14 → BROLL_EFFECT_META in packages/types/src/index.ts */
export const proof = [
  { n: "12", label: { en: "AI presenters", tr: "Yapay zeka sunucu" } },
  { n: "24", label: { en: "Sectors covered", tr: "Sektör" } },
  { n: "20", label: { en: "Caption styles", tr: "Altyazı stili" } },
  { n: "14", label: { en: "Transitions", tr: "Geçiş efekti" } },
] satisfies { n: string; label: Copy }[];

export const sectors = {
  eyebrow: { en: "BUILT FOR", tr: "KİMLER İÇİN" },
  title: { en: "Made for the businesses that live on reels.", tr: "Reels'te yaşayan işletmeler için." },
  items: [
    {
      key: "travel",
      body: { en: "Fill tours and hotel nights with reels that show the place, not a brochure.", tr: "Turları ve otel gecelerini broşür değil, mekânı gösteren reels'lerle doldurun." },
    },
    {
      key: "beauty",
      body: { en: "Before-and-afters, price drops and open slots — posted daily, filmed never.", tr: "Öncesi-sonrası, indirimler ve boş randevular — her gün paylaşın, hiç çekim yapmayın." },
    },
    {
      key: "realestate",
      body: { en: "Every new listing gets its own presenter-led reel the day it goes live.", tr: "Her yeni ilan, yayına girdiği gün kendi sunuculu reels'ine kavuşur." },
    },
    {
      key: "gym",
      body: { en: "Class schedules, transformations and campaigns, on a weekly drumbeat.", tr: "Ders programları, dönüşümler ve kampanyalar — her hafta düzenli." },
    },
  ],
} as const;
