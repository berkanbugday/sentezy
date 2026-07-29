/** Showcase labels, keyed by Reel.file. `alt` is user-visible to screen readers and is
 *  translated; `file` names the asset and never is. */
import type { Reels } from "./types";

export const reels: Reels = {
  byFile: {
    "2": { sector: "Beauty",     alt: "A Sentezy reel made for a beauty salon" },
    "1": { sector: "Travel",     alt: "A Sentezy reel made for a travel agency" },
    "3": { sector: "Gym",        alt: "A Sentezy reel made for a gym" },
    "6": { sector: "Automotive", alt: "A Sentezy reel made for a car service" },
    "4": { sector: "Café",       alt: "A Sentezy reel made for a café" },
    "5": { sector: "Cruise",     alt: "A Sentezy reel made for a cruise line" },
  },
};
