/** The shape both locales must satisfy. Written once, holds no copy.
 *
 *  This file is the guard the previous bilingual build lacked: every locale module — not
 *  just `copy.tr.ts` — declares against a type from this file, so a missing, extra or
 *  misspelled key in any of them (`Copy`, `Studio`, `Reels`) is a build error
 *  rather than a blank space on the live page.
 *
 *  Deliberately NOT derived from copy.en.ts. `typeof import("./copy.en")` is a module type
 *  and cannot be applied with `satisfies`, and the old `as const` markers would have frozen
 *  these to the literal English strings — which would reject every correct translation.
 *
 *  WHAT THIS DOES NOT CATCH: array LENGTH. `proof`, `sectors.items`, `how.steps` and
 *  `faq.items` are plain arrays, so a Turkish `faq.items` with three entries where English
 *  has five type-checks and ships. Keys are guarded; cardinality is not. `proof` and
 *  `sectors.items` happen to be covered elsewhere — the former by verify.mjs's digit
 *  assertions, the latter by Footer.astro's non-null lookup, which crashes the build on a
 *  drifted key. `how.steps` and `faq.items` have no coverage from either layer.
 *
 *  This paragraph exists because an earlier version of this comment claimed a guarantee that
 *  held for `Copy` alone while the other locale files sat outside it. A documented promise
 *  that silently does not hold is worse than a documented gap. */

export type Locale = "en" | "tr";

/** Join keys into apps/api/src/data/avatars.json. Identical in both locales, never
 *  translated. Typed as a union so a drifted Turkish key is a compile error — Footer.astro
 *  looks sectors up by key with a non-null assertion, and a miss there is a build crash
 *  that blames the footer instead of the translation. */
export type SectorKey =
  | "beauty" | "tech" | "realestate" | "fitness" | "restaurant" | "fashion"
  | "dental" | "health" | "pharmacy" | "education" | "legal" | "finance"
  | "automotive" | "travel" | "jewelry" | "optics" | "petshop" | "construction"
  | "wedding" | "cosmetics" | "corporate" | "influencer" | "ecommerce" | "coaching";

export type Copy = {
  meta: { title: string; description: string };
  nav: {
    platform: string; showcase: string; how: string; login: string; cta: string;
    language: string;
  };
  footer: {
    tagline: string; productHead: string; presenters: string; captions: string;
    music: string; solutionsHead: string; legalHead: string; privacy: string;
    terms: string; instagramHead: string;
  };
  hero: {
    title: string; lead: string;
    ctaPrimary: string; ctaSecondary: string; microcopy: string;
  };
  /** Every string inside the hero's animated app demo. The demo is a rebuild of the real
   *  composer (apps/web/src/components/MediaComposer.tsx), so where a string exists there it
   *  is copied verbatim in `en` rather than reworded — a demo that says something the product
   *  does not is the one thing this component must never do.
   *
   *  `steps` is the row of labels under the stage, and is the part that has to survive a
   *  visitor who never parses the UI: upload → write → choose → done, in four words each. */
  heroDemo: {
    dashTitle: string;
    dashLead: string;
    nav: { home: string; library: string; presenters: string; brand: string };
    credits: string;
    tabLink: string;
    tabUpload: string;
    dropTitle: string;
    dropHint: string;
    clipsReady: string;
    scriptPlaceholder: string;
    /** The line that types itself. Keep it one sentence — it has 2.7s to land. */
    script: string;
    options: string;
    menuPresenter: string;
    menuVoice: string;
    menuMusic: string;
    menuCaptions: string;
    menuNone: string;
    /** The voice shown as already chosen. A proper noun; identical in both locales. */
    voiceValue: string;
    preview: string;
    make: string;
    making: string;
    pickPresenter: string;
    pickCaption: string;
    /** The picker sheets' confirm button and their close control's label. Both exist in
     *  AvatarPicker.tsx; the demo shows them because a modal with no way out reads as a
     *  screenshot rather than a screen. */
    pickerDone: string;
    pickerClose: string;
    /** The transition named under each connector node between two clips in the tray. */
    transitionLabel: string;
    /** The tray's trailing "add more media" tile. */
    addMedia: string;
    ready: string;
    download: string;
    steps: string[];
  };
  /** `n` is a proof number and is identical in both locales — only `label` translates. */
  proof: { n: string; label: string }[];
  sectors: {
    eyebrow: string; title: string; lead: string;
    items: { key: SectorKey; name: string; body: string }[];
  };
  showcase: {
    eyebrow: string; title: string; lead: string; follow: string;
    soundOff: string; soundOn: string;
  };
  how: { eyebrow: string; title: string; steps: { n: string; title: string; body: string }[] };
  platform: {
    eyebrow: string; title: string; lead: string;
    presenters: { eyebrow: string; title: string; body: string };
    voices: { eyebrow: string; title: string; body: string };
    music: { eyebrow: string; title: string; body: string };
    captions: { eyebrow: string; title: string; body: string; sample: string };
  };
  faq: { eyebrow: string; title: string; items: { q: string; a: string }[] };
  finalCta: { title: string; lead: string; cta: string; microcopy: string };
  soon: {
    title: string; description: string; eyebrow: string;
    heading: string; body: string; follow: string; back: string;
  };
  /** Chrome around the legal pages' bodies. The clauses themselves are not copy — they are
   *  legally-operative text and live in the pages, one file per locale. */
  legal: { back: string; updated: string };
};

/** Join keys into src/data/studio.ts. Identical in both locales, never translated. Typed as
 *  unions so a missing, extra or misspelled entry in either locale file is a build error —
 *  the same guarantee `Copy` gives, which these maps previously did not have. */
export type PresenterSlug = "aisha" | "anna" | "arda" | "amara" | "camila" | "alp";
export type VoiceName = "PJ" | "Kate Mercer" | "David" | "Rene";
export type TrackMood = "Cinematic" | "Calm" | "Energetic" | "Corporate";
export type CaptionStyleId = "hormozi" | "tiktok" | "highlight" | "boxed" | "glow" | "clean";
export type ReelFile = "1" | "2" | "3" | "4" | "5" | "6";

export type Studio = {
  /** Keyed by Presenter.slug — the sector shown under each face on the demo phone. */
  presenterSectors: Record<PresenterSlug, string>;
  /** Keyed by Voice.name — the "Conversational · young" descriptor line. */
  voiceMeta: Record<VoiceName, string>;
  /** Keyed by Track.mood's English value — the mood chip on the music demo. */
  trackMoods: Record<TrackMood, string>;
  /** Keyed by captionStyles[].id. "Hormozi" and "TikTok" are proper nouns and do not change. */
  captionLabels: Record<CaptionStyleId, string>;
};

export type Reels = {
  /** Keyed by Reel.file. `alt` is translated too — it never appears on screen, but a Turkish
   *  screen-reader user hears it, and leaving it English is an untranslated paragraph. */
  byFile: Record<ReelFile, { sector: string; alt: string }>;
};

