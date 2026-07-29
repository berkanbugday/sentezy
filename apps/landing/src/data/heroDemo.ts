/** The hero demo's timeline, as data.
 *
 *  The component renders every state at once and CSS shows exactly one of them based on
 *  `[data-hd][data-step]`; this file says which step is up when, and where the cursor is.
 *  Retiming the demo therefore never means editing logic — which matters, because the timing
 *  is the whole design. Every beat is a moment a visitor has to be able to read.
 *
 *  Times are milliseconds from the start of the loop.
 */

/** One `data-step` value. CSS keys off these, so a new step needs a rule to go with it. */
export type Step =
  | "idle"      // nothing chosen yet — the empty dropzone
  | "drop"      // cursor is over the dropzone, mid-drag
  | "uploaded"  // three clips landed, spinners running
  | "typing"    // caret in the script box, text filling in
  | "typed"     // the line is written, controls come alive
  | "menu1"     // the "Video options" popover is open
  | "avatars"   // the presenter grid is up
  | "picked"    // Kevser chosen, back on the composer
  | "menu2"     // popover open again
  | "captions"  // the caption-style grid is up
  | "styled"    // a style chosen — everything the composer needs is set
  | "making"    // "Make video" pressed, button spinning
  | "done";     // the finished reel, playing

export type Beat = {
  at: number;
  step?: Step;
  /** `data-anchor` value the cursor glides to. The move is a CSS transition, so setting it
   *  ~500ms before the click is what makes the click look aimed rather than teleported. */
  cursor?: string;
  /** Fires the click ripple on the cursor. */
  click?: boolean;
};

/** Full loop length. The last beat holds the finished reel on screen for ~2.9s before the wrap —
 *  the reel is the payoff, and cutting away from it fast wastes the only frame that sells. */
export const LOOP = 16_800;

/** The typewriter window. `typing` fires at TYPE_FROM and `typed` at TYPE_TO — the driver reads
 *  the DURATION from these two and runs its own rAF for exactly that long, so the two must stay
 *  equal to the matching beats below.
 *
 *  3.6s for a ~140-character script is about 39 characters a second. That is faster than a
 *  person types and it is meant to be: the line is the product's input, not something the
 *  visitor has to read word by word, and every extra second here is a second before the reel. */
export const TYPE_FROM = 3_400;
export const TYPE_TO = 7_000;
export const TYPE_MS = TYPE_TO - TYPE_FROM;

export const beats: Beat[] = [
  { at: 0, step: "idle", cursor: "start" },
  { at: 600, cursor: "drop" },
  { at: 1_300, step: "drop", click: true },
  { at: 1_850, step: "uploaded" },
  { at: 2_900, cursor: "script" },
  { at: TYPE_FROM, step: "typing", click: true },
  { at: TYPE_TO, step: "typed" },
  { at: 7_300, cursor: "options" },
  { at: 7_800, step: "menu1", click: true },
  { at: 8_150, cursor: "menu-presenter" },
  { at: 8_650, step: "avatars", click: true },
  { at: 9_100, cursor: "pick-presenter" },
  { at: 9_750, step: "picked", click: true },
  { at: 10_100, cursor: "options" },
  { at: 10_550, step: "menu2", click: true },
  { at: 10_850, cursor: "menu-captions" },
  { at: 11_300, step: "captions", click: true },
  { at: 11_700, cursor: "pick-caption" },
  { at: 12_250, step: "styled", click: true },
  { at: 12_600, cursor: "make" },
  { at: 13_150, step: "making", click: true },
  { at: 13_950, step: "done", cursor: "start" },
];

/** What the visitor drags in: Berkan's own B-roll from src/assets/backgrounds — one photo and
 *  three clips, which is exactly the mix the composer accepts. `1.jpg` is the salon the result
 *  reel is shot against, so the media going in and the video coming out are the same shoot.
 *
 *  The three videos are represented by a first-frame still (`thumb-<slug>.jpg`, extracted with
 *  ffmpeg) rather than a <video> element: the sources are 2.6–14 MB and the tray renders them
 *  at 68px. The real composer does the same thing — `videoPoster()` in MediaComposer.tsx draws
 *  a poster off the uploaded file — so this is the behaviour, not a shortcut around it. */
export type Clip = { slug: string; kind: "image" | "video" };
export const CLIPS: Clip[] = [
  { slug: "1", kind: "image" },
  { slug: "2", kind: "video" },
  { slug: "3", kind: "video" },
  { slug: "4", kind: "video" },
];

/** The reel that plays on the last beat: src/assets/videos/7.mp4, downscaled to 540x960 and
 *  ~840 KB into public/reels the same way 1–6 were. It is NOT in data/reels.ts — the showcase
 *  wall further down the page still runs 1–6, and this one belongs to the demo. */
export const RESULT_REEL = "/reels/7.mp4";
/** A frame from 3s in, not the first: the opening frame is the empty room, and the poster is
 *  what reduced motion shows forever — so it needs the presenter in it. */
export const RESULT_POSTER = "7";

/** Presenter portraits in the picker grid, and the one the cursor lands on. Slugs join into
 *  src/assets/avatars/*.png. Names ride along because the real AvatarGrid labels every tile
 *  under the portrait; they are proper nouns, so they are not copy and do not translate. */
export const FACES = [
  { slug: "kevser", name: "Kevser" },
  { slug: "hana", name: "Hana" },
  { slug: "camila", name: "Camila" },
  { slug: "anna", name: "Anna" },
  { slug: "beyza", name: "Beyza" },
  { slug: "arda", name: "Arda" },
];
export const PICKED_FACE = "kevser";
export const PICKED_FACE_NAME = "Kevser";

/** Caption styles in the picker, matching `.cap-<id>` in global.css. Six, not four: the real
 *  CaptionPicker lays its tiles out `grid-cols-2 sm:grid-cols-3`, and six fills two clean rows
 *  of three where four left a row half empty.
 *
 *  The font on each is the second half of the preset's own label — CAPTION_PRESETS in
 *  lib/captionStyles.ts names every preset `family · font`, and the tile prints exactly that. */
export const CAPTIONS = [
  { id: "hormozi", font: "Anton" },
  { id: "tiktok", font: "Montserrat" },
  { id: "highlight", font: "Poppins" },
  { id: "boxed", font: "Bebas Neue" },
  { id: "glow", font: "Kanit" },
  { id: "clean", font: "Inter" },
] as const;
export const PICKED_CAPTION = "hormozi";

/** The connector between two clips in the tray, straight from lib/composer/transitions.ts. */
export const TR_GRADIENT = "linear-gradient(90deg, rgb(52,104,184), rgb(96,64,168), rgb(170,86,96))";
export const TR_GRADIENT_SOFT = "linear-gradient(135deg, rgba(52,104,184,0.16), rgba(96,64,168,0.16), rgba(170,86,96,0.16))";
