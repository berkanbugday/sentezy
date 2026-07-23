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
  music: { en: "Music", tr: "Müzik" },
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
  /** The wall autoplays muted, the way a feed does. This is the only affordance telling you
   *  the sound is there — it swaps to the "sound on" line once you turn it on. */
  soundOff: { en: "Tap for sound", tr: "Ses için dokun" },
  soundOn: { en: "Sound on", tr: "Ses açık" },
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

/** The three studio blocks. Each one is a LIVE demo of the matching picker in the app —
 *  filters that filter, a list that plays through — not a screenshot of it. The row data
 *  lives in src/data/studio.ts and traces back to the API's own catalogs. */
export const studio = {
  eyebrow: { en: "PLATFORM", tr: "PLATFORM" },
  title: { en: "The studio behind the reels.", tr: "Reels'lerin arkasındaki stüdyo." },
  lead: {
    en: "Every choice below is the real catalog. Filter it here the same way you would inside the app.",
    tr: "Aşağıdaki her seçim gerçek katalog. Uygulamanın içindeki gibi burada da filtreleyin.",
  },
  presenters: {
    eyebrow: { en: "PRESENTERS", tr: "SUNUCULAR" },
    title: { en: "Twelve faces, dressed for the sector.", tr: "On iki yüz, sektörüne göre giyinmiş." },
    bullets: [
      { en: "A pharmacist in a lab coat, a realtor in a blazer — the wardrobe does the positioning.", tr: "Önlüklü eczacı, blazer'lı emlakçı — kıyafet konumlandırmayı yapar." },
      { en: "Filter by gender or hijab, the way the picker does.", tr: "Seçicideki gibi cinsiyete ya da başörtüsüne göre filtreleyin." },
      { en: "Or go faceless — a reel works without a presenter too.", tr: "Ya da yüzsüz gidin — reels sunucusuz da çalışır." },
    ],
  },
  voices: {
    eyebrow: { en: "VOICES", tr: "SESLER" },
    title: { en: "A read, not a recital.", tr: "Okuma değil, anlatım." },
    bullets: [
      { en: "Shared ElevenLabs voices, auditioned before you spend a credit.", tr: "Paylaşılan ElevenLabs sesleri — kredi harcamadan önce dinlenir." },
      { en: "Pacing and emphasis marked up per sentence, so it lands like speech.", tr: "Cümle cümle tempo ve vurgu işaretlenir; konuşma gibi düşer." },
      { en: "Turkish first — including the words other tools mangle.", tr: "Önce Türkçe — diğer araçların yamulttuğu kelimeler dahil." },
    ],
  },
  music: {
    eyebrow: { en: "MUSIC", tr: "MÜZİK" },
    title: { en: "A bed under every reel.", tr: "Her reels'in altında bir müzik." },
    bullets: [
      { en: "11 license-free beds across four moods.", tr: "Dört ruh halinde 11 telifsiz müzik." },
      { en: "The bed ducks automatically under the voice — no mixing on your side.", tr: "Müzik sesin altında otomatik kısılır — sizin miksleme yapmanız gerekmez." },
      { en: "Or leave it silent. Some reels land harder dry.", tr: "Ya da sessiz bırakın. Bazı reels'ler müziksiz daha çok tutar." },
    ],
  },
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

/** Rewritten to four answers that are all true today. The old compliance-badge, avatar-cloning
 *  and language-count answers were claims about things that do not exist and are gone for good —
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
