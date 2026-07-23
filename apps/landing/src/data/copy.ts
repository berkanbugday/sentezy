/** Every user-visible string on the page.
 *
 *  English only. The page shipped bilingual (EN in the markup, a `data-tr` twin swapped at
 *  runtime), which doubled every string, put a language toggle in both the nav and the footer,
 *  and made the copy tedious to edit. One language, one string, no runtime swap. */

export const nav = {
  platform: "Platform",
  showcase: "Showcase",
  how: "How it works",
  login: "Log in",
  cta: "Start free",
};

export const footer = {
  tagline: "Reels with an AI presenter. No filming, no editing.",
  productHead: "Product",
  presenters: "AI presenters",
  captions: "Captions",
  music: "Music",
  solutionsHead: "Solutions",
  legalHead: "Legal",
  privacy: "Privacy",
  terms: "Terms",
  madeFor: "Made in Türkiye",
  instagramHead: "Instagram",
};

export const hero = {
  eyebrow: "AI PRESENTER REELS",
  title: "Reels that sell — without filming a thing.",
  lead: "Paste a product link or a script. Sentezy picks an AI presenter, writes the copy, burns in viral captions, and hands back a finished 9:16 reel. Built for travel, beauty, real estate and gym brands.",
  ctaPrimary: "Start free",
  ctaSecondary: "Watch a reel",
  microcopy: "No credit card required",
};

/** Every number here traces to source. Do not add one that does not.
 *   12 → apps/api/src/data/avatars.json, entries with a non-empty displayImageId
 *   24 → same file, distinct `sector` values
 *   20 → CAPTION_STYLE_META in packages/types/src/index.ts
 *   14 → BROLL_EFFECT_META in packages/types/src/index.ts */
export const proof = [
  { n: "12", label: "AI presenters" },
  { n: "24", label: "Sectors covered" },
  { n: "20", label: "Caption styles" },
  { n: "14", label: "Transitions" },
];

/** All 24 sectors, in the order apps/api/src/data/avatars.json declares them — the same 24 the
 *  proof bar counts, so the claim and the list can never drift apart. The line under each says
 *  what that business posts, not what Sentezy does. */
export const sectors = {
  eyebrow: "BUILT FOR",
  title: "Made for the businesses that live on reels.",
  lead: "Twenty-four sectors, each with presenters dressed for the job.",
  items: [
    { key: "beauty", name: "Beauty & Hair", body: "Before-and-afters, price drops and open slots." },
    { key: "tech", name: "Tech & Software", body: "Feature launches explained in fifteen seconds." },
    { key: "realestate", name: "Real Estate", body: "Every new listing gets a reel the day it lists." },
    { key: "fitness", name: "Fitness & Gym", body: "Class schedules, transformations, campaigns." },
    { key: "restaurant", name: "Restaurant & Café", body: "Today's menu, tonight's table, this week's special." },
    { key: "fashion", name: "Fashion & Boutique", body: "New arrivals on the shelf and on the feed." },
    { key: "dental", name: "Dental", body: "Treatments explained without the waiting-room brochure." },
    { key: "health", name: "Health & Clinic", body: "Appointments, check-ups and what to expect." },
    { key: "pharmacy", name: "Pharmacy", body: "Seasonal advice and what is in stock now." },
    { key: "education", name: "Education & Courses", body: "Enrolment windows and what the course covers." },
    { key: "legal", name: "Legal & Consulting", body: "One question answered clearly, once a week." },
    { key: "finance", name: "Finance & Accounting", body: "Deadlines, incentives and plain-language answers." },
    { key: "automotive", name: "Automotive", body: "New arrivals, test drives and service offers." },
    { key: "travel", name: "Travel & Tourism", body: "Tours and hotel nights shown, not described." },
    { key: "jewelry", name: "Jewellery", body: "New pieces, close up, with the light on them." },
    { key: "optics", name: "Optics", body: "Frames of the season and second-pair offers." },
    { key: "petshop", name: "Pet Shop", body: "Food, grooming and the week's new arrivals." },
    { key: "construction", name: "Construction", body: "Projects in progress and finished handovers." },
    { key: "wedding", name: "Weddings & Events", body: "Venues, packages and dates still open." },
    { key: "cosmetics", name: "Cosmetics & Skincare", body: "Routines, ingredients and what actually changed." },
    { key: "corporate", name: "Corporate", body: "Announcements that do not read like a press release." },
    { key: "influencer", name: "Lifestyle & Creators", body: "A daily post without a daily shoot." },
    { key: "ecommerce", name: "E-commerce", body: "A reel per product, straight from the link." },
    { key: "coaching", name: "Coaching", body: "One idea per reel, on a weekly rhythm." },
  ],
} as const;

export const showcase = {
  eyebrow: "SHOWCASE",
  title: "Real reels. Made with Sentezy.",
  lead: "Every one of these was generated end to end — script, presenter, voice, captions and edit. Nobody held a camera.",
  follow: "Follow @sentezy.ai",
  /** The wall autoplays muted, the way a feed does. These are the only affordance telling you
   *  the sound is there; a card swaps one label for the other. */
  soundOff: "Tap for sound",
  soundOn: "Sound on",
};

export const how = {
  eyebrow: "HOW IT WORKS",
  title: "Three steps. About five minutes.",
  steps: [
    {
      n: "01",
      title: "Paste a link or a script",
      body: "Drop in a product URL and Sentezy reads the page and writes the script for you. Or bring your own.",
    },
    {
      n: "02",
      title: "Pick a presenter and a style",
      body: "Choose the face, the voice, the caption treatment and the music. Preview before you spend a credit.",
    },
    {
      n: "03",
      title: "Publish",
      body: "Download the finished 9:16 file, or post it straight to your feed.",
    },
  ],
} as const;

/** The platform section: four choices, each demonstrated by a phone that plays through the
 *  options instead of describing them. The rows themselves live in src/data/studio.ts. */
export const platform = {
  eyebrow: "PLATFORM",
  title: "Four choices. One finished reel.",
  lead: "Presenter, voice, music, captions — every option below is the real catalog, playing through itself.",
  presenters: {
    eyebrow: "PRESENTER",
    title: "Twelve faces, dressed for the sector.",
    body: "A pharmacist in a lab coat, a realtor in a blazer — the wardrobe does the positioning before a word is spoken. Filter by gender or hijab, or go faceless entirely.",
  },
  voices: {
    eyebrow: "VOICE",
    title: "A read, not a recital.",
    body: "Shared ElevenLabs voices, auditioned before you spend a credit. Pacing and emphasis are marked up sentence by sentence, so it lands like speech — Turkish first, including the words other tools mangle.",
  },
  music: {
    eyebrow: "MUSIC",
    title: "A bed under every reel.",
    body: "Eleven license-free beds across four moods, ducking automatically under the voice. No mixing on your side — and silence stays a valid choice.",
  },
  captions: {
    eyebrow: "CAPTIONS",
    title: "20 caption styles, burned into the file.",
    body: "Not an overlay a platform can strip — the captions are rendered into the video, word by word, on the beat. 20 styles across 13 fonts and 12 accent colors.",
    sample: "THIS REEL SELLS",
  },
};

/** Four answers that are all true today. The old SOC 2, avatar-cloning and language-count
 *  answers described things that do not exist and are gone for good — scripts/verify.mjs fails
 *  the build if any of them comes back. */
export const faq = {
  eyebrow: "FAQ",
  title: "Frequently asked questions.",
  items: [
    {
      q: "Is Sentezy really free to start?",
      a: "Yes. You get credits to make your first reels with no card on file. Upgrade only when you need more.",
    },
    {
      q: "Which sectors do the presenters cover?",
      a: "24 sectors, from real estate and beauty to dental, pharmacy, automotive and e-commerce. Each presenter is styled for their line of work.",
    },
    {
      q: "Do I need a camera or editing skills?",
      a: "Neither. You write or paste a script, pick a presenter and a style, and Sentezy renders the finished 9:16 file — voice, captions, music and all.",
    },
    {
      q: "Is my data safe? (KVKK/GDPR)",
      a: "Your scripts, uploads and rendered videos are encrypted in transit and at rest, and handled in line with KVKK and GDPR. You can delete your account and all its media at any time from Settings.",
    },
  ],
} as const;

/** The page's single closing CTA. There used to be two — a pricing teaser before the FAQ and
 *  this one after it — saying the same thing twice with the same button. The teaser's promise
 *  survives as the lead line here. */
export const finalCta = {
  title: "Your next reel is five minutes away.",
  lead: "Your first reels are on us — no card, no trial timer. Move to a paid plan when you need more of them.",
  cta: "Start free",
  microcopy: "No credit card required",
};
