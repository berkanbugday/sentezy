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

export const showcase = {
  eyebrow: { en: "SHOWCASE", tr: "ÖRNEKLER" },
  title: { en: "Real reels. Made with Sentezy.", tr: "Gerçek reels'ler. Sentezy ile yapıldı." },
  lead: {
    en: "Every one of these was generated end to end — script, presenter, voice, captions and edit. Nobody held a camera.",
    tr: "Bunların hepsi baştan sona üretildi — metin, sunucu, ses, altyazı ve kurgu. Kimse kamera tutmadı.",
  },
  follow: { en: "Follow @sentezy.ai", tr: "@sentezy.ai'yi takip et" },
  /** Inside the blockquote. embed.js replaces it once the script lands, but it is our own
   *  markup until then — and stays visible for anyone with JS blocked or Instagram unreachable. */
  viewOnInstagram: { en: "View this reel on Instagram", tr: "Bu reels'i Instagram'da izle" },
  empty: { en: "See the latest reels on Instagram", tr: "En yeni reels'leri Instagram'da izleyin" },
} satisfies Record<string, Copy>;

export const how = {
  eyebrow: { en: "HOW IT WORKS", tr: "NASIL ÇALIŞIR" },
  title: { en: "Three steps. About five minutes.", tr: "Üç adım. Yaklaşık beş dakika." },
  steps: [
    {
      n: "01",
      title: { en: "Paste a link or a script", tr: "Link ya da metin yapıştırın" },
      body: { en: "Drop in a product URL and Sentezy reads the page and writes the script for you. Or bring your own.", tr: "Bir ürün linki bırakın; Sentezy sayfayı okur ve metni sizin için yazar. Ya da kendi metninizi getirin." },
    },
    {
      n: "02",
      title: { en: "Pick a presenter and a style", tr: "Sunucu ve stil seçin" },
      body: { en: "Choose the face, the voice, the caption treatment and the music. Preview before you spend a credit.", tr: "Yüzü, sesi, altyazı stilini ve müziği seçin. Kredi harcamadan önce önizleyin." },
    },
    {
      n: "03",
      title: { en: "Publish", tr: "Yayınlayın" },
      body: { en: "Download the finished 9:16 file, or post it straight to your feed.", tr: "Bitmiş 9:16 dosyayı indirin ya da doğrudan paylaşın." },
    },
  ],
} as const;

/** The three studio blocks. `key` is also the screenshot filename: a block ships only if
 *  `src/assets/app/<key>.png` exists (see src/data/shots.ts). Per the spec, a block whose
 *  screenshot is missing is cut from the page — it never ships as a gray placeholder. */
export const studio = {
  eyebrow: { en: "PLATFORM", tr: "PLATFORM" },
  title: { en: "The studio behind the reels.", tr: "Reels'lerin arkasındaki stüdyo." },
  blocks: [
    {
      key: "composer",
      eyebrow: { en: "COMPOSER", tr: "OLUŞTURUCU" },
      title: { en: "Everything on one screen.", tr: "Her şey tek ekranda." },
      bullets: [
        { en: "12 AI presenters across 24 sectors.", tr: "24 sektörde 12 yapay zeka sunucu." },
        { en: "Shared ElevenLabs voices, auditioned in place.", tr: "Paylaşılan ElevenLabs sesleri, yerinde dinlenir." },
        { en: "Upload your own footage as B-roll behind the presenter.", tr: "Kendi görüntülerinizi sunucunun arkasına B-roll olarak ekleyin." },
      ],
      alt: "The Sentezy media composer with a presenter and voice selected",
    },
    {
      key: "captions",
      eyebrow: { en: "CAPTIONS", tr: "ALTYAZILAR" },
      title: { en: "20 caption styles, burned in.", tr: "20 altyazı stili, videoya işlenir." },
      bullets: [
        { en: "Word-level timing, so the highlight lands on the beat.", tr: "Kelime seviyesinde zamanlama — vurgu tam yerine oturur." },
        { en: "Keyword emphasis and emoji picked from the script.", tr: "Metinden seçilen anahtar kelime vurgusu ve emoji." },
        { en: "14 transitions between B-roll clips.", tr: "B-roll klipleri arasında 14 geçiş efekti." },
      ],
      alt: "The Sentezy caption style picker",
    },
    {
      key: "brand-kit",
      eyebrow: { en: "BRAND KIT", tr: "MARKA KİTİ" },
      title: { en: "Your logo on every reel.", tr: "Her reels'te sizin logonuz." },
      bullets: [
        { en: "Logo, colors and fonts applied automatically.", tr: "Logo, renkler ve fontlar otomatik uygulanır." },
        { en: "Set it once — every future reel inherits it.", tr: "Bir kez ayarlayın — sonraki tüm reels'ler devralır." },
        { en: "Preview the result before rendering.", tr: "Render öncesi sonucu önizleyin." },
      ],
      alt: "The Sentezy brand kit screen",
    },
  ],
} as const;

/** Six of the twenty caption styles, shown live. `id` is both the real style id and the
 *  `.cap-<id>` class from the hero marquee — the treatments are reused, not redefined.
 *  ids and TR labels are transcribed from CAPTION_STYLE_META (packages/types/src/index.ts);
 *  the landing does not import from the workspace. 6 shown + "14 more" = the 20 claimed. */
export const captionDemo = {
  eyebrow: { en: "CAPTIONS", tr: "ALTYAZILAR" },
  title: { en: "20 caption styles. Burned into the file.", tr: "20 altyazı stili. Dosyaya işlenmiş." },
  lead: {
    en: "Not an overlay a platform can strip — the captions are rendered into the video, word by word, on the beat.",
    tr: "Platformun kaldırabileceği bir katman değil — altyazılar videoya, kelime kelime, ritme oturarak işlenir.",
  },
  sample: { en: "THIS REEL SELLS", tr: "BU REELS SATIYOR" },
  more: { en: "…and 14 more styles.", tr: "…ve 14 stil daha." },
  styles: [
    { id: "hormozi", label: { en: "Hormozi", tr: "Hormozi" } },
    { id: "tiktok", label: { en: "TikTok", tr: "TikTok" } },
    { id: "highlight", label: { en: "Highlight", tr: "Vurgu" } },
    { id: "boxed", label: { en: "Boxed", tr: "Kutu" } },
    { id: "glow", label: { en: "Neon", tr: "Neon" } },
    { id: "clean", label: { en: "Clean", tr: "Sade" } },
  ],
} as const;

export const pricing = {
  title: { en: "Start free. Upgrade when you scale.", tr: "Ücretsiz başlayın. Büyüdükçe yükseltin." },
  body: {
    en: "Your first reels are on us — no card, no trial timer. Move to a paid plan when you need more of them.",
    tr: "İlk reels'leriniz bizden — kart yok, deneme süresi yok. Daha fazlasına ihtiyacınız olunca ücretli plana geçin.",
  },
  cta: { en: "Start free", tr: "Ücretsiz başla" },
} satisfies Record<string, Copy>;

/** Rewritten to four answers that are all true today. The old SOC 2, digital-twin and
 *  175-language answers were claims about things that do not exist and are gone for good —
 *  scripts/verify.mjs fails the build if any of them comes back. */
export const faq = {
  eyebrow: { en: "FAQ", tr: "SSS" },
  title: { en: "Frequently asked questions.", tr: "Sık sorulan sorular." },
  items: [
    {
      q: { en: "Is Sentezy really free to start?", tr: "Sentezy'e başlamak gerçekten ücretsiz mi?" },
      a: { en: "Yes. You get credits to make your first reels with no card on file. Upgrade only when you need more.", tr: "Evet. Kart bilgisi vermeden ilk reels'lerinizi yapacak kredi alırsınız. Yalnızca daha fazlasına ihtiyacınız olunca yükseltin." },
    },
    {
      q: { en: "Which sectors do the presenters cover?", tr: "Sunucular hangi sektörleri kapsıyor?" },
      a: { en: "24 sectors, from real estate and beauty to dental, pharmacy, automotive and e-commerce. Each presenter is styled for their line of work.", tr: "Emlaktan güzelliğe, dişten eczaneye, otomotivden e-ticarete 24 sektör. Her sunucu kendi işine göre giydirilmiştir." },
    },
    {
      q: { en: "Do I need a camera or editing skills?", tr: "Kamera ya da kurgu bilgisi gerekiyor mu?" },
      a: { en: "Neither. You write or paste a script, pick a presenter and a style, and Sentezy renders the finished 9:16 file — voice, captions, music and all.", tr: "İkisi de gerekmiyor. Metni yazın ya da yapıştırın, sunucu ve stil seçin; Sentezy bitmiş 9:16 dosyayı ses, altyazı ve müzikle birlikte üretir." },
    },
    {
      q: { en: "Is my data safe? (KVKK/GDPR)", tr: "Verilerim güvende mi? (KVKK/GDPR)" },
      a: { en: "Your scripts, uploads and rendered videos are encrypted in transit and at rest, and handled in line with KVKK and GDPR. You can delete your account and all its media at any time from Settings.", tr: "Metinleriniz, yüklemeleriniz ve videolarınız aktarımda ve saklamada şifrelenir; KVKK ve GDPR'a uygun işlenir. Hesabınızı ve tüm medyanızı istediğiniz an Ayarlar'dan silebilirsiniz." },
    },
  ],
} as const;

export const finalCta = {
  title: { en: "Your next reel is five minutes away.", tr: "Sıradaki reels'iniz beş dakika uzakta." },
  cta: { en: "Start free", tr: "Ücretsiz başla" },
  microcopy: { en: "No credit card required", tr: "Kredi kartı gerekmez" },
} satisfies Record<string, Copy>;
