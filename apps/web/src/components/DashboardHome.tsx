"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { SettingsDrawer } from "@/components/composer/SettingsDrawer";
import { MediaComposer, type ComposerSeed } from "@/components/MediaComposer";
import { type ComposerSettings, DEFAULT_SETTINGS } from "@/lib/composerSettings";
import { useMusic, useVideo } from "@/lib/queries";
import { optionsToComposerState } from "@/lib/reuse";

/** Dashboard home: the import composer (hero). Owns the shared settings state, and — when
 *  arriving from a video's "Yeniden kullan" button (?reuse=<id>) — seeds it from that video. */
export function DashboardHome() {
  const [settings, setSettings] = useState<ComposerSettings>(DEFAULT_SETTINGS);
  // Lifted out of MediaComposer so the drawer can gate clip-only settings.
  const [mediaCount, setMediaCount] = useState(0);

  const reuseId = useSearchParams().get("reuse") ?? "";
  const { data: source, isError: reuseFailed } = useVideo(reuseId);

  // Music is stored as a bare track key, so resolve it against the catalog to get the
  // MusicTrack object the picker needs. A track removed since the video was made simply
  // does not resolve, and reuse continues without music.
  const tracks = useMusic().data?.music ?? [];

  // No cast: the API returns `avatar`/`voice` already shaped as the composer's own types.
  const seed = useMemo<ComposerSeed | undefined>(() => {
    if (!reuseId || !source) return undefined;
    const { captionId, music } = optionsToComposerState(source.video);
    return {
      key: reuseId,
      selectedAvatar: source.avatar ?? null,
      selectedVoice: source.voice ?? null,
      selectedMusic: music ? (tracks.find((t) => t.key === music.trackKey) ?? null) : null,
      musicVolume: music?.volume ?? 0.15,
      captionId,
    };
    // `tracks` is a dep so a late-arriving music catalog can still resolve the track — this
    // is safe from re-triggering seeding because MediaComposer's effect guards on `seed.key`
    // (the source video id), not on this object's identity, so a new `tracks` array alone
    // (e.g. a background refetch) never re-seeds an already-seeded composer.
  }, [reuseId, source, tracks]);

  // Settings live here, so seed them here — once per source video, for the same reason
  // the composer guards its own seeding.
  const seededRef = useRef<string | null>(null);
  useEffect(() => {
    if (!reuseId || !source || seededRef.current === reuseId) return;
    seededRef.current = reuseId;
    setSettings(optionsToComposerState(source.video).settings);
  }, [reuseId, source]);

  return (
    <div>
      <section className="hero-aurora -mx-5 -mt-6 px-5 pb-10 pt-10 sm:-mx-6 sm:px-6 sm:pt-12 md:-mx-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="disp text-[26px] font-semibold leading-tight text-ink sm:text-[34px]">Sentezy&apos;e hoş geldin</h1>
              {/* A deleted or missing source degrades to a plain new-video flow with a
                  notice — never an error screen, since the composer works fine without it. */}
              <p className="mt-1.5 text-[14px] text-slate sm:text-[15px]">
                {reuseFailed
                  ? "Önceki video bulunamadı — varsayılan ayarlarla başlıyorsun"
                  : reuseId
                    ? "Ayarlar önceki videodan alındı — yeni metnini yaz"
                    : "Medyanı içe aktar ve videonu oluştur"}
              </p>
            </div>
            <SettingsDrawer settings={settings} onChange={setSettings} mediaCount={mediaCount} />
          </div>
          <MediaComposer extraSettings={settings} onMediaCountChange={setMediaCount} seed={seed} />
        </div>
      </section>
    </div>
  );
}
