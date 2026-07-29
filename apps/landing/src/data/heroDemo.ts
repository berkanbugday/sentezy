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

/** Full loop length. The last beat holds the finished reel on screen for ~3s before the wrap —
 *  the reel is the payoff, and cutting away from it fast wastes the only frame that sells. */
export const LOOP = 17_400;

/** The typewriter window. The driver interpolates `script.slice(0, n)` across it rather than
 *  running its own interval, so the text can never drift out of step with the beats. */
export const TYPE_FROM = 3_900;
export const TYPE_TO = 6_600;

export const beats: Beat[] = [
  { at: 0, step: "idle", cursor: "start" },
  { at: 700, cursor: "drop" },
  { at: 1_500, step: "drop", click: true },
  { at: 2_100, step: "uploaded" },
  { at: 3_300, cursor: "script" },
  { at: 3_900, step: "typing", click: true },
  { at: TYPE_TO, step: "typed" },
  { at: 6_900, cursor: "options" },
  { at: 7_500, step: "menu1", click: true },
  { at: 7_900, cursor: "menu-presenter" },
  { at: 8_500, step: "avatars", click: true },
  { at: 9_000, cursor: "pick-presenter" },
  { at: 9_700, step: "picked", click: true },
  { at: 10_100, cursor: "options" },
  { at: 10_600, step: "menu2", click: true },
  { at: 10_900, cursor: "menu-captions" },
  { at: 11_400, step: "captions", click: true },
  { at: 11_800, cursor: "pick-caption" },
  { at: 12_400, step: "styled", click: true },
  { at: 12_800, cursor: "make" },
  { at: 13_400, step: "making", click: true },
  { at: 14_300, step: "done", cursor: "start" },
];

/** Which step each label under the stage belongs to. A label lights when the current step is
 *  at or past its first step, and unlights when the next label's turn comes — so the row reads
 *  as progress rather than four independent blinks. */
export const STEP_ORDER: Step[] = [
  "idle", "drop", "uploaded", "typing", "typed", "menu1",
  "avatars", "picked", "menu2", "captions", "styled", "making", "done",
];

/** First step of each of the four labels in `copy.heroDemo.steps`. */
export const LABEL_AT: Step[] = ["idle", "typing", "menu1", "done"];

/** The three uploaded clips, as poster slugs in src/assets/posters.
 *
 *  `3` is first on purpose: it is the opening frame of /reels/3.mp4, the video that plays at
 *  the end. What the visitor watches go in is literally what comes back out.
 *
 *  Not any three posters, either. The tray crops these to a square from near the top of a 9:16
 *  frame, and posters 1 and 5 have their burned-in captions inside that crop — on a tile that
 *  is meant to be raw footage the visitor just dragged in, an already-captioned still makes the
 *  input look like the output. 3, 4 and 6 are clean up there. */
export const CLIPS = ["3", "4", "6"] as const;

/** The clip shown with a "video" badge — the other two read as photos, which is the mix the
 *  composer actually accepts. */
export const VIDEO_CLIP = "3";

/** The reel that plays on the last beat. Served from public/reels, the same files the showcase
 *  uses further down the page, so it is already in the browser cache by the second visit. */
export const RESULT_REEL = "/reels/3.mp4";
/** Its first frame, and also CLIPS[0]. Used as the video's poster so the last beat has
 *  something to show before the file has finished buffering — and so reduced motion, which
 *  never calls play(), still ends on a real finished reel. */
export const RESULT_POSTER = "3";

/** Presenter portraits in the picker grid, and the one the cursor lands on. Slugs join into
 *  src/assets/avatars/*.png — the same set Platform.astro draws from. */
export const FACES = ["kevser", "hana", "camila", "anna", "beyza", "arda"] as const;
export const PICKED_FACE = "kevser";
export const PICKED_FACE_NAME = "Kevser";

/** Caption styles in the picker, matching `.cap-<id>` in global.css. The demo picks the first,
 *  which is also the one the burned-in captions of /reels/1.mp4 most resemble. */
export const CAPTIONS = ["hormozi", "tiktok", "highlight", "boxed"] as const;
export const PICKED_CAPTION = "hormozi";
