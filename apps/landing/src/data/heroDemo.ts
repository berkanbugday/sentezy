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

/** Full loop length. The last beat holds the finished reel on screen for ~2.7s before the wrap —
 *  the reel is the payoff, and cutting away from it fast wastes the only frame that sells.
 *
 *  Retimed once already: the payoff used to land at 14.3s, which is a long wait for a punchline
 *  on a page people leave in three. The cursor's travel gaps and the post-click holds were the
 *  fat; the beats a viewer has to READ were not touched. */
export const LOOP = 15_200;

/** The typewriter window. `typing` fires at TYPE_FROM and `typed` at TYPE_TO — the driver reads
 *  the DURATION from these two and runs its own rAF for exactly that long, so the two must stay
 *  equal to the matching beats below. */
export const TYPE_FROM = 3_300;
export const TYPE_TO = 5_500;
export const TYPE_MS = TYPE_TO - TYPE_FROM;

export const beats: Beat[] = [
  { at: 0, step: "idle", cursor: "start" },
  { at: 600, cursor: "drop" },
  { at: 1_300, step: "drop", click: true },
  { at: 1_850, step: "uploaded" },
  { at: 2_800, cursor: "script" },
  { at: TYPE_FROM, step: "typing", click: true },
  { at: TYPE_TO, step: "typed" },
  { at: 5_800, cursor: "options" },
  { at: 6_300, step: "menu1", click: true },
  { at: 6_650, cursor: "menu-presenter" },
  { at: 7_150, step: "avatars", click: true },
  { at: 7_600, cursor: "pick-presenter" },
  { at: 8_250, step: "picked", click: true },
  { at: 8_600, cursor: "options" },
  { at: 9_050, step: "menu2", click: true },
  { at: 9_350, cursor: "menu-captions" },
  { at: 9_800, step: "captions", click: true },
  { at: 10_200, cursor: "pick-caption" },
  { at: 10_750, step: "styled", click: true },
  { at: 11_100, cursor: "make" },
  { at: 11_650, step: "making", click: true },
  { at: 12_450, step: "done", cursor: "start" },
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
