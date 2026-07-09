import type { FastifyInstance } from "fastify";
import { signedDownloadUrl } from "../lib/r2";

// Curated, license-free background music beds (R2 keys). Users pick one — auto-ducked under the voice.
const TRACKS = [
  { key: "music/cinematic.mp3", name: "Sinematik" },
  { key: "music/calm.mp3", name: "Sakin" },
  { key: "music/upbeat.mp3", name: "Enerjik" },
];

export async function musicRoutes(app: FastifyInstance) {
  app.get("/music", async () => ({
    music: await Promise.all(TRACKS.map(async (t) => ({ ...t, previewUrl: await signedDownloadUrl(t.key) }))),
  }));
}
