import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Starter ElevenLabs voice catalog (prebuilt public voices).
// Verify IDs against your ElevenLabs account; prebuilt IDs are stable but plan-dependent.
const VOICES = [
  { elevenlabsVoiceId: "21m00Tcm4TlvDq8ikWAM", label: "Rachel", gender: "female", style: "calm, narration" },
  { elevenlabsVoiceId: "EXAVITQu4vr4xnSDxMaL", label: "Bella", gender: "female", style: "soft, friendly" },
  { elevenlabsVoiceId: "pNInz6obpgDQGcFmaJgB", label: "Adam", gender: "male", style: "deep, corporate" },
  { elevenlabsVoiceId: "ErXwobaYiN019PkySvjV", label: "Antoni", gender: "male", style: "warm, energetic" },
];

async function main() {
  for (const v of VOICES) {
    // No unique constraint on elevenlabs_voice_id, so upsert-by-find to stay idempotent.
    const existing = await prisma.voice.findFirst({
      where: { elevenlabsVoiceId: v.elevenlabsVoiceId, isPublic: true },
    });
    if (existing) {
      await prisma.voice.update({ where: { id: existing.id }, data: v });
    } else {
      await prisma.voice.create({ data: { ...v, isPublic: true } });
    }
  }
  const count = await prisma.voice.count({ where: { isPublic: true } });
  console.log(`Seeded voices — ${count} public voice(s) in catalog.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
