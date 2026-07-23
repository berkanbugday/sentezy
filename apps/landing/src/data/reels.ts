/** The reels on the showcase wall, self-hosted rather than embedded.
 *
 *  Instagram's embed ships its own chrome — a white card, a "0 likes" counter, an "Add a
 *  comment" field and a letterboxed player — which framed our best work inside someone else's
 *  dead-looking UI. These are the same reels, served as files we control.
 *
 *  `file` names `public/reels/<file>.mp4`, transcoded to 540x960 H.264 (CRF 29, faststart)
 *  from the 1080p masters, and `src/assets/posters/<file>.jpg`, which goes through
 *  astro:assets. The masters live in src/assets/videos/ and are git-ignored — 80 MB of source
 *  has no business in a repo when only the 5 MB of output ships.
 *
 *  To add a reel, from apps/landing:
 *    ffmpeg -i src/assets/videos/N.mp4 -vf scale=-2:960:flags=lanczos -c:v libx264 \
 *      -profile:v high -preset slow -crf 29 -pix_fmt yuv420p -r 30 -c:a aac -b:a 80k -ac 1 \
 *      -movflags +faststart public/reels/N.mp4
 *    ffmpeg -ss 1.2 -i src/assets/videos/N.mp4 -frames:v 1 -vf scale=-2:1280 -q:v 3 \
 *      src/assets/posters/N.jpg
 *  then append an entry here.
 */
export type Reel = { file: string; sector: string; alt: string };

export const reels: Reel[] = [
  { file: "2", sector: "Beauty", alt: "A Sentezy reel made for a beauty salon" },
  { file: "1", sector: "Travel", alt: "A Sentezy reel made for a travel agency" },
  { file: "3", sector: "Gym", alt: "A Sentezy reel made for a gym" },
  { file: "6", sector: "Automotive", alt: "A Sentezy reel made for a car service" },
  { file: "4", sector: "Café", alt: "A Sentezy reel made for a café" },
  { file: "5", sector: "Cruise", alt: "A Sentezy reel made for a cruise line" },
];
