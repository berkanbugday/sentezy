/** Rows for the four platform demos. Each mirrors something real in the product, because the
 *  demos are the product's own choices played back — an invented row is a lie that animates.
 *
 *  presenters → apps/api/src/data/avatars.json (the 12 with a displayImageId)
 *  voices     → the shared ElevenLabs library the composer's voice picker lists
 *  tracks     → apps/api/src/data/music.json (11 beds, 4 moods)
 *  captions   → CAPTION_STYLE_META in packages/types/src/index.ts (6 of the 20)
 */
import type { CaptionStyleId, PresenterSlug, TrackMood, VoiceName } from "../i18n/types";

export type Tint = "cool" | "warm" | "rose" | "teal" | "violet" | "amber";

export type Presenter = { slug: PresenterSlug; name: string; tint: Tint };

/** Six of the twelve — enough to read as a catalog without the phone cycling for half a minute.
 *  Ordered so consecutive slides change sector, tone and backdrop, not just the face. */
export const presenters: Presenter[] = [
  { slug: "aisha",  name: "Aisha",  tint: "rose" },
  { slug: "anna",   name: "Anna",   tint: "cool" },
  { slug: "arda",   name: "Arda",   tint: "teal" },
  { slug: "amara",  name: "Amara",  tint: "violet" },
  { slug: "camila", name: "Camila", tint: "amber" },
  { slug: "alp",    name: "Alp",    tint: "cool" },
];

export type Voice = { name: VoiceName; presenter: string; tint: Tint };

export const voices: Voice[] = [
  { name: "PJ",           presenter: "beyza",   tint: "warm" },
  { name: "Kate Mercer",  presenter: "amara",   tint: "violet" },
  { name: "David",        presenter: "alp",     tint: "cool" },
  { name: "Rene",         presenter: "sumeyye", tint: "teal" },
];

/** `mood` is the lookup key into Studio.trackMoods, not a display string. */
export type Track = { name: string; mood: TrackMood; sec: number; bars: number[] };

/** `bars` is the equalizer silhouette — a fixed 9-bar shape per track so the four moods read
 *  differently at a glance (calm sits low and even, energetic spikes). */
export const tracks: Track[] = [
  { name: "After the Storm", mood: "Cinematic", sec: 123, bars: [30, 52, 44, 68, 90, 62, 46, 58, 34] },
  { name: "Quiet Hour",      mood: "Calm",      sec: 19,  bars: [22, 30, 26, 34, 28, 36, 24, 30, 20] },
  { name: "Victory Lap",     mood: "Energetic", sec: 57,  bars: [46, 84, 60, 96, 72, 100, 58, 88, 52] },
  { name: "Momentum",        mood: "Corporate", sec: 170, bars: [34, 48, 62, 54, 70, 58, 66, 44, 38] },
];

/** The caption treatments, matching `.cap-<id>` in global.css and real CAPTION_STYLE_META ids. */
export const captionStyles: { id: CaptionStyleId }[] = [
  { id: "hormozi" },
  { id: "tiktok" },
  { id: "highlight" },
  { id: "boxed" },
  { id: "glow" },
  { id: "clean" },
];

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
