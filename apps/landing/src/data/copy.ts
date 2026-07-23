/** Every user-visible string on the page.
 *
 *  English only. The page shipped bilingual (EN in the markup, a `data-tr` twin swapped at
 *  runtime), which doubled every string, put a language toggle in both the nav and the footer,
 *  and made the copy tedious to edit. One language, one string, no runtime swap. */

export const nav = {
  platform: "What you choose",
  showcase: "Examples",
  how: "How it works",
  login: "Log in",
  cta: "Start free",
};

export const footer = {
  tagline: "Instagram reels for your business, without a camera.",
  productHead: "Product",
  presenters: "Presenters",
  captions: "Captions",
  music: "Music",
  solutionsHead: "Sectors",
  legalHead: "Legal",
  privacy: "Privacy",
  terms: "Terms",
  madeFor: "Made in Türkiye",
  instagramHead: "Instagram",
};

/* Someone lands here from Instagram on a phone. In one screen they have to learn what this
 * makes, what it costs them to try, and whether it fits their business. Nothing clever: what
 * you give it, what you get back, how long it takes. */
export const hero = {
  eyebrow: "INSTAGRAM REELS, WITHOUT A CAMERA",
  title: "Post a reel a day without filming one.",
  lead: "Paste a product link or write two sentences. Sentezy writes the script, picks a presenter, records the voice, adds captions and music, and gives you a finished vertical video in about five minutes. Ready to post.",
  ctaPrimary: "Make your first reel",
  ctaSecondary: "See real examples",
  microcopy: "Free to start. No card.",
};

/** Every number here traces to source. Do not add one that does not.
 *   12 → apps/api/src/data/avatars.json, entries with a non-empty displayImageId
 *   24 → same file, distinct `sector` values
 *   20 → CAPTION_STYLE_META in packages/types/src/index.ts
 *   14 → BROLL_EFFECT_META in packages/types/src/index.ts */
export const proof = [
  { n: "12", label: "Presenters to choose from" },
  { n: "24", label: "Sectors they are styled for" },
  { n: "20", label: "Caption styles" },
  { n: "14", label: "Cuts and transitions" },
];

/** All 24 sectors, in the order apps/api/src/data/avatars.json declares them — the same 24 the
 *  proof bar counts, so the claim and the list can never drift apart. The line under each says
 *  what that business posts, not what Sentezy does. */
export const sectors = {
  eyebrow: "WHO IT IS FOR",
  title: "If your customers are on Instagram, find your line of work.",
  lead: "Twenty-four of them, each with presenters dressed for the job.",
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
  eyebrow: "EXAMPLES",
  title: "These were made with Sentezy.",
  lead: "Script, presenter, voice, captions, edit — all of it. No camera, no studio, no editor. Tap one to hear it.",
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
      title: "Say what the reel is about",
      body: "Paste the product link and Sentezy reads the page and writes the script. Or type it yourself — two sentences is enough.",
    },
    {
      n: "02",
      title: "Choose how it looks and sounds",
      body: "Pick the presenter, the voice, the caption style and the music. You see the whole reel before it is made, and before it costs you anything.",
    },
    {
      n: "03",
      title: "Download and post",
      body: "You get an MP4 sized for Reels, TikTok and Shorts. Nothing to edit afterwards.",
    },
  ],
} as const;

/** The platform section: four choices, each demonstrated by a phone that plays through the
 *  options instead of describing them. The rows themselves live in src/data/studio.ts. */
export const platform = {
  eyebrow: "WHAT YOU CHOOSE",
  title: "Four choices. One finished reel.",
  lead: "Everything below is the actual catalogue you pick from inside Sentezy.",
  presenters: {
    eyebrow: "THE PRESENTER",
    title: "Someone who looks like they work in your business.",
    body: "A pharmacist in a lab coat, an estate agent in a blazer, a trainer in the gym. Twelve to choose from, and you can filter by gender or hijab. If you would rather not show a face at all, you do not have to.",
  },
  voices: {
    eyebrow: "THE VOICE",
    title: "It sounds like someone talking, not reading.",
    body: "Listen to the voices before you use one. Sentezy marks the pauses and the emphasis sentence by sentence, so it sounds like a person — including in Turkish, where most tools get the words wrong.",
  },
  music: {
    eyebrow: "THE MUSIC",
    title: "Music that stays under the voice.",
    body: "Eleven royalty-free tracks in four moods. The music turns itself down whenever the presenter speaks, so you never have to mix anything. You can also leave it silent.",
  },
  captions: {
    eyebrow: "THE CAPTIONS",
    title: "Captions people can read with the sound off.",
    body: "They are part of the video, so they show up wherever you post it. Twenty styles, in thirteen fonts and twelve colours — the word being spoken lights up as it is said.",
    sample: "THIS REEL SELLS",
  },
};

/** Four answers that are all true today. The old SOC 2, avatar-cloning and language-count
 *  answers described things that do not exist and are gone for good — scripts/verify.mjs fails
 *  the build if any of them comes back. */
export const faq = {
  eyebrow: "QUESTIONS",
  title: "Before you start.",
  items: [
    {
      q: "What does it cost to try?",
      a: "Nothing. You get credits when you sign up, with no card on file, and you only pay when you need more than that.",
    },
    {
      q: "How long does one reel take?",
      a: "About five minutes from a link or a couple of sentences to a finished file — most of that is Sentezy rendering, not you working.",
    },
    {
      q: "Do I need a camera, a studio or editing skills?",
      a: "No. You describe the reel and choose how it looks; Sentezy does the voice, the captions, the music and the cuts, and gives you a file ready to post.",
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
  title: "Make one and see.",
  lead: "Your first reels are free — no card, no trial countdown. Pay only when you want more of them.",
  cta: "Make your first reel",
  microcopy: "Takes about five minutes.",
};
