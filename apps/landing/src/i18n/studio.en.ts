/** Display labels for the four platform demos. The rows themselves — slugs, tints, bar
 *  silhouettes, durations — stay in src/data/studio.ts, because they are data, not copy. */
import type { Studio } from "./types";

export const studio: Studio = {
  presenterSectors: {
    aisha: "E-commerce",
    anna: "Real estate",
    arda: "Pharmacy",
    amara: "Influencer",
    camila: "Automotive",
    alp: "Optics",
  },
  voiceMeta: {
    "PJ": "Conversational · young",
    "Kate Mercer": "Narrative · middle-aged",
    "David": "Social media · young",
    "Rene": "Conversational · young",
  },
  trackMoods: {
    Cinematic: "Cinematic",
    Calm: "Calm",
    Energetic: "Energetic",
    Corporate: "Corporate",
  },
  captionLabels: {
    hormozi: "Hormozi",
    tiktok: "TikTok",
    highlight: "Highlight",
    boxed: "Boxed",
    glow: "Neon",
    clean: "Clean",
  },
};
