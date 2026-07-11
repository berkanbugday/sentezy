import type { FastifyInstance } from "fastify";
import { prisma } from "@sentezy/db";
import { env } from "../env";

// Shape returned to the wizard: the DB row's stable id (used as Video.voiceId and
// resolved to elevenlabs_voice_id by the worker) plus ElevenLabs' own filter labels.
type VoiceDTO = {
  id: string;
  label: string;
  gender: string | null;
  style: string | null;
  age: string | null;
  accent: string | null;
  useCase: string | null;
  previewUrl: string | null;
};

type ElevenVoice = {
  voice_id: string;
  name: string;
  labels?: Record<string, string | undefined>;
  preview_url?: string | null;
};

// The public ElevenLabs catalog is the same for every user, so cache the synced
// result and only refetch/upsert once the TTL lapses.
const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; voices: VoiceDTO[] } | null = null;

async function fetchElevenVoices(): Promise<ElevenVoice[]> {
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY! },
  });
  if (!res.ok) throw new Error(`elevenlabs_voices_failed_${res.status}`);
  const json = (await res.json()) as { voices?: ElevenVoice[] };
  return json.voices ?? [];
}

// ElevenLabs spells its use-case label a few different ways across voices.
function useCaseOf(labels: Record<string, string | undefined>): string | null {
  return labels.use_case ?? labels["use case"] ?? labels.description ?? null;
}

// Ensure a public Voice row exists for each ElevenLabs voice (stable UUID for the
// video FK + worker TTS lookup), then return the merged DTOs with live filter labels.
async function syncVoices(): Promise<VoiceDTO[]> {
  const eleven = await fetchElevenVoices();
  const out: VoiceDTO[] = [];
  for (const v of eleven) {
    const labels = v.labels ?? {};
    const gender = labels.gender ?? null;
    const useCase = useCaseOf(labels);
    const existing = await prisma.voice.findFirst({
      where: { elevenlabsVoiceId: v.voice_id, isPublic: true },
    });
    const row = existing
      ? await prisma.voice.update({ where: { id: existing.id }, data: { label: v.name, gender, style: useCase } })
      : await prisma.voice.create({ data: { elevenlabsVoiceId: v.voice_id, label: v.name, gender, style: useCase, isPublic: true } });
    out.push({
      id: row.id,
      label: row.label,
      gender,
      style: useCase,
      age: labels.age ?? null,
      accent: labels.accent ?? null,
      useCase,
      previewUrl: v.preview_url ?? null,
    });
  }
  return out;
}

export async function voiceRoutes(app: FastifyInstance) {
  app.get("/voices", { preHandler: app.authenticate }, async (req) => {
    const userId = req.user!.id;

    // Live ElevenLabs catalog (cached). Any failure — missing key, network, plan —
    // falls through to whatever voices are already in the DB so the wizard still works.
    if (env.ELEVENLABS_API_KEY) {
      try {
        if (!cache || Date.now() - cache.at > TTL_MS) {
          cache = { at: Date.now(), voices: await syncVoices() };
        }
        if (cache.voices.length) return { voices: cache.voices };
      } catch (e) {
        app.log.warn({ err: e }, "elevenlabs voice sync failed; falling back to DB");
      }
    }

    const rows = await prisma.voice.findMany({
      where: { OR: [{ isPublic: true }, { userId }] },
      orderBy: { label: "asc" },
    });
    const voices: VoiceDTO[] = rows.map((r) => ({
      id: r.id,
      label: r.label,
      gender: r.gender,
      style: r.style,
      age: null,
      accent: null,
      useCase: r.style,
      previewUrl: null,
    }));
    return { voices };
  });
}
