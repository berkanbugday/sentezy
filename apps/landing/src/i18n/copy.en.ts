/** Every user-visible string on the page, in English.
 *
 *  The Turkish twin is src/i18n/copy.tr.ts. Both declare `const copy: Copy` against
 *  src/i18n/types.ts, so neither can drift from the other without failing the build.
 *
 *  The page shipped bilingual once before with both languages inline in the markup and a
 *  runtime swap; that is what this structure replaces. See the 2026-07-28 spec. */
import type { Copy } from "./types";

export const copy: Copy = {
  meta: {
    title: "Sentezy — vertical video without a camera",
    description: "Paste a product link or two sentences and get a finished vertical video with a presenter, voice, captions and music, ready for Reels, TikTok and Shorts. Free to start.",
  },

  nav: {
    platform: "What you choose",
    showcase: "Examples",
    how: "How it works",
    login: "Log in",
    cta: "Start free",
    language: "Language",
  },

  footer: {
    tagline: "Vertical video for your business, without a camera.",
    productHead: "Product",
    presenters: "Presenters",
    captions: "Captions",
    music: "Music",
    solutionsHead: "Sectors",
    legalHead: "Legal",
    privacy: "Privacy",
    terms: "Terms",
    instagramHead: "Instagram",
  },

  /* Someone lands here from a social post on a phone. In one screen they have to learn what this
   * makes, what it costs them to try, and whether it fits their business. Nothing clever: what
   * you give it, what you get back, how long it takes. */
  hero: {
    eyebrow: "VERTICAL VIDEO, WITHOUT A CAMERA",
    /* Mirrors the Turkish headline rather than the other way round — the Turkish was rewritten
       first and set the frame: name who does the work, then what is left for you. Two beats in
       both languages, with "Let Sentezy…" carrying the same permissive warmth as the optative
       `hazırlasın`. Keep the pair in step; if one changes, change the other. */
    title: "Let Sentezy make your videos. You just post them.",
    lead: "Paste a product link and Sentezy pulls the photos and writes the script. Or upload your own clips and type two sentences. Choose a presenter, a voice, captions and music, watch the whole thing preview, then download one vertical file that fits Reels, TikTok and Shorts. About five minutes.",
    ctaPrimary: "Make your first video",
    ctaSecondary: "See real examples",
    /* 30 credits on signup (profile default), 1 credit per video (CREDIT_COST in
     * apps/api/src/routes/videos.ts) — so this is literal, not a rounding of "some". */
    microcopy: "Your first videos are free. No card.",
  },

  /** Every number here traces to source. Do not add one that does not.
   *   126 → apps/api/src/data/avatars.json, total catalogue entries. NOTE: 12 of them have a
   *         portrait generated today (`displayImageId`); the rest appear as "coming soon" in the
   *         picker until the images are generated. Berkan asked for the catalogue number.
   *   24  → same file, distinct `sector` values
   *   20  → CAPTION_STYLE_META in packages/types/src/index.ts
   *   14  → BROLL_EFFECT_META in packages/types/src/index.ts */
  proof: [
    { n: "126", label: "Presenters to choose from" },
    { n: "24", label: "Sectors they are styled for" },
    { n: "20", label: "Caption styles" },
    { n: "14", label: "Cuts and transitions" },
  ],

  /** All 24 sectors, in the order apps/api/src/data/avatars.json declares them — the same 24 the
   *  proof bar counts, so the claim and the list can never drift apart. The line under each says
   *  what that business posts, not what Sentezy does. */
  sectors: {
    eyebrow: "WHO IT IS FOR",
    /* Was "If your customers scroll, find your line of work." — a conditional whose two halves
       had nothing to do with each other, and which read as badly in Turkish as in English. */
    title: "Made for your kind of business.",
    lead: "Twenty-four of them, each with presenters dressed for the job.",
    items: [
      { key: "beauty", name: "Beauty & Hair", body: "Before-and-afters, price drops and open slots." },
      { key: "tech", name: "Tech & Software", body: "Feature launches explained in fifteen seconds." },
      { key: "realestate", name: "Real Estate", body: "Every new listing gets a video the day it lists." },
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
      { key: "ecommerce", name: "E-commerce", body: "A video per product, straight from the link." },
      { key: "coaching", name: "Coaching", body: "One idea per video, on a weekly rhythm." },
    ],
  },

  showcase: {
    eyebrow: "EXAMPLES",
    title: "These were made with Sentezy.",
    lead: "Script, presenter, voice, captions and the edit. No camera, no studio, no editor. Tap one to hear it.",
    follow: "Follow @sentezy.ai",
    /** The wall autoplays muted, the way a feed does. These are the only affordance telling you
     *  the sound is there; a card swaps one label for the other. */
    soundOff: "Tap for sound",
    soundOn: "Sound on",
  },

  how: {
    eyebrow: "HOW IT WORKS",
    title: "Three steps. About five minutes.",
    steps: [
      {
        n: "01",
        title: "Paste a link, or bring your own clips",
        body: "Give Sentezy a product link and it pulls the photos and videos off the page and writes the script. Or upload your own footage and type two sentences.",
      },
      {
        n: "02",
        title: "Choose how it looks and sounds",
        body: "Presenter, voice, captions, music, and the cut between each clip. Play the whole video back before it is rendered. Nothing is charged until you are happy with it.",
      },
      {
        n: "03",
        title: "Download it and post it",
        body: "You get one finished vertical MP4 with the captions burned in. The same file works for Instagram Reels, TikTok, YouTube Shorts and anywhere else vertical. You post it yourself, from whichever account you want.",
      },
    ],
  },

  /** The platform section: four choices, each demonstrated by a phone that plays through the
   *  options instead of describing them. The rows themselves live in src/data/studio.ts. */
  platform: {
    eyebrow: "WHAT YOU CHOOSE",
    title: "Four choices. One finished video.",
    lead: "Everything below is the actual catalogue you pick from inside Sentezy.",
    presenters: {
      eyebrow: "THE PRESENTER",
      title: "Someone who looks like they work in your business.",
      body: "126 presenters across 24 kinds of business, dressed for the job. Filter by gender, age or hijab. Or show no face at all.",
    },
    voices: {
      eyebrow: "THE VOICE",
      title: "Hear your own words before you spend anything.",
      body: "Type your script and press play to hear it read back in your own words. Six tones, in English and Turkish.",
    },
    music: {
      eyebrow: "THE MUSIC",
      title: "Music that stays under the voice.",
      body: "Eleven royalty-free tracks in four moods, at a level you set. The music turns down when the presenter speaks. Silence is fine too.",
    },
    captions: {
      eyebrow: "THE CAPTIONS",
      title: "Captions people can read with the sound off.",
      body: "Burned into the video, so they work anywhere you post. Twenty styles, thirteen fonts, twelve colours. Each word lights up as it is said.",
      sample: "THIS REEL SELLS",
    },
  },

  /** Four answers that are all true today. The old SOC 2, avatar-cloning and language-count
   *  answers described things that do not exist and are gone for good — scripts/verify.mjs fails
   *  the build if any of them comes back. */
  faq: {
    eyebrow: "QUESTIONS",
    title: "Before you start.",
    items: [
      {
        q: "What does it cost to try?",
        a: "Nothing, and no card. You get free credits when you sign up, so your first videos are on us.",
      },
      {
        q: "How long does one video take?",
        a: "About five minutes from a link or a couple of sentences to a finished file. Most of that is Sentezy rendering, not you working.",
      },
      {
        q: "Do I need a camera, a studio or editing skills?",
        a: "No. You describe the video and choose how it looks; Sentezy does the voice, the captions, the music and the cuts, and gives you a file ready to post.",
      },
      {
        q: "Where can I post the videos?",
        a: "Anywhere vertical video goes: Instagram Reels, TikTok, YouTube Shorts, Facebook. You get one vertical file and post it yourself; Sentezy never asks for a password to any of them.",
      },
      {
        q: "Is my data safe? (KVKK/GDPR)",
        a: "Your scripts, uploads and rendered videos are encrypted in transit and at rest, and handled in line with KVKK and GDPR. You can delete your account and all its media at any time from Settings.",
      },
    ],
  },

  /** The page's single closing CTA. There used to be two — a pricing teaser before the FAQ and
   *  this one after it — saying the same thing twice with the same button. The teaser's promise
   *  survives as the lead line here. */
  finalCta: {
    /* Was "Make one and see." — "one" had no noun, so the closing line of the page never said
       what it was asking for. */
    title: "Try it with one video.",
    lead: "Free to start, no card, no trial countdown. Pay only when you want more than that.",
    cta: "Make your first video",
    microcopy: "Takes about five minutes.",
  },

  /** The standalone coming-soon screen. Lifted verbatim from the page before it read from
   *  copy — see src/pages/soon.astro. */
  soon: {
    title: "Coming soon — Sentezy",
    description: "Sentezy is almost ready. Follow along to know when it opens.",
    eyebrow: "COMING SOON",
    heading: "We're almost ready.",
    body: "Sentezy isn't open to everyone just yet. Follow along and you'll be the first to know when you can make your first video.",
    follow: "Follow on Instagram",
    back: "← Back to home",
  },
  legal: {
    back: "← Back to home",
    updated: "Last updated",
  },
};
