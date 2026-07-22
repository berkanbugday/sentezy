/** Real posts from instagram.com/sentezy.ai. Adding a reel here is the only step needed
 *  to put it on the page — InstaShowcase renders one card per entry, and falls back to a
 *  single follow card when the list is empty. */
export type Reel = { shortcode: string };

export const reels: Reel[] = [
  { shortcode: "DbCAH3rCwxe" },
  { shortcode: "DbDOIBPic25" },
  { shortcode: "DbFxuR3CUqM" },
];

export const permalink = (shortcode: string) => `https://www.instagram.com/reel/${shortcode}/`;
