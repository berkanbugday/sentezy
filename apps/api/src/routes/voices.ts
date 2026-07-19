import type { FastifyInstance } from "fastify";
import { ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { prisma } from "@sentezy/db";
import { env } from "../env";
import { TTS_MODEL_ID, TTS_VOICE_SETTINGS, applyEmotionTag, collectAudio, elevenlabs, trimToSentence } from "../lib/elevenlabs";
import { type VoiceDTO, fetchSharedVoices, resolveVoice } from "../lib/voices";

// The shared library is the same for everyone, so cache each browsed page+filter combo.
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: { voices: VoiceDTO[]; hasMore: boolean } }>();

export async function voiceRoutes(app: FastifyInstance) {
  // Browse the ElevenLabs shared voice library, paginated (?page=N) and filtered
  // server-side (?gender/age/category/language/use_cases/search). Any failure falls back
  // to DB voices (e.g. previously-adopted ones) so the picker still works.
  app.get<{ Querystring: { page?: string; search?: string; gender?: string; age?: string; category?: string; language?: string; use_cases?: string; accent?: string } }>(
    "/voices",
    { preHandler: app.authenticate },
    async (req) => {
      const userId = req.user!.id;
      const page = Math.max(0, Math.floor(Number(req.query.page) || 0));
      const q = req.query;
      const filters = { search: q.search, gender: q.gender, age: q.age, category: q.category, language: q.language, useCase: q.use_cases, accent: q.accent };
      if (env.ELEVENLABS_API_KEY) {
        try {
          const key = JSON.stringify({ page, filters });
          const hit = cache.get(key);
          if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
          const data = await fetchSharedVoices(page, filters);
          if (data.voices.length) {
            cache.set(key, { at: Date.now(), data });
            return data;
          }
          return data; // empty filtered result — still valid
        } catch (e) {
          app.log.warn({ err: e }, "shared voices failed; DB fallback");
        }
      }
    // DB fallback: no pagination — only the first page returns rows.
    const rows = page === 0 ? await prisma.voice.findMany({ where: { OR: [{ isPublic: true }, { userId }] }, orderBy: { label: "asc" } }) : [];
    const voices: VoiceDTO[] = rows.map((r) => ({
      id: r.id,
      label: r.label,
      gender: r.gender,
      style: r.style,
      age: null,
      accent: null,
      useCase: r.style,
      descriptive: null,
      category: null,
      language: null,
      locale: null,
      description: null,
      previewUrl: null,
    }));
    return { voices, hasMore: false };
  });

  // Add a library voice to the account (once) and return the DB Voice id to reference.
  app.post<{ Body: { id?: string; name?: string } }>("/voices/adopt", { preHandler: app.authenticate }, async (req, reply) => {
    if (!env.ELEVENLABS_API_KEY) return reply.code(503).send({ error: "tts_unavailable" });
    if (!req.body?.id) return reply.code(400).send({ error: "missing_id" });
    try {
      const { dbId } = await resolveVoice(req.user!.id, req.body.id, req.body.name ?? "Ses");
      return { id: dbId };
    } catch (e) {
      app.log.warn({ err: e }, "voice adopt failed");
      return reply.code(502).send({ error: "adopt_failed" });
    }
  });

  // Real TTS preview: synthesize a short clip of the user's own text with a voice (opt-in
  // on the client — spends ElevenLabs credits). Adopts a library voice if needed first.
  app.post<{ Body: { id?: string; text?: string; emotion?: string } }>("/voices/preview", { preHandler: app.authenticate }, async (req, reply) => {
    if (!env.ELEVENLABS_API_KEY) return reply.code(503).send({ error: "tts_unavailable" });
    // Cap to keep previews cheap, but cut on a sentence boundary and carry the chosen
    // emotion — v3 delivery depends on text structure, so a mid-word stub reads nothing
    // like the render. Already-annotated scripts keep their per-sentence tags.
    const clip = applyEmotionTag(trimToSentence(req.body?.text ?? ""), req.body?.emotion);
    if (!clip || !req.body?.id) return reply.code(400).send({ error: "bad_request" });
    let elevenId: string;
    try {
      elevenId = (await resolveVoice(req.user!.id, req.body.id, "Ses")).elevenId;
    } catch {
      return reply.code(404).send({ error: "voice_not_found" });
    }
    try {
      const stream = await elevenlabs().textToSpeech.convert(elevenId, {
        text: clip,
        modelId: TTS_MODEL_ID,
        outputFormat: "mp3_44100_128",
        voiceSettings: TTS_VOICE_SETTINGS,
      });
      const audio = (await collectAudio(stream)).toString("base64");
      return { audio, mime: "audio/mpeg" };
    } catch (e) {
      const status = e instanceof ElevenLabsError ? e.statusCode : undefined;
      app.log.warn({ err: e, status }, "elevenlabs tts preview failed");
      return reply.code(502).send({ error: `tts_failed_${status ?? "unknown"}` });
    }
  });
}
