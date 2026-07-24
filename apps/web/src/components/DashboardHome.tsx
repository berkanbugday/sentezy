"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MediaComposer, type ComposerSeed } from "@/components/MediaComposer";
import { avatarSeed, pickSeed } from "@/lib/composerSeed";
import { type ComposerSettings, DEFAULT_SETTINGS } from "@/lib/composerSettings";
import { useAvatars, useMusic, useVideo } from "@/lib/queries";
import { optionsToComposerState } from "@/lib/reuse";

/** Dashboard home: the import composer (hero). Owns the shared settings state, and — when
 *  arriving from a video's "Yeniden kullan" button (?reuse=<id>) — seeds it from that video. */
export function DashboardHome() {
  const [settings, setSettings] = useState<ComposerSettings>(DEFAULT_SETTINGS);

  const searchParams = useSearchParams();
  const reuseId = searchParams.get("reuse") ?? "";
  const { data: source, isError: reuseFailed } = useVideo(reuseId);

  // ?avatar=<id> — a single avatar chosen on /avatars. Only consulted when there is no
  // ?reuse=, which carries a whole configuration and therefore wins.
  const avatarId = searchParams.get("avatar") ?? "";
  const avatarsQ = useAvatars({}, Boolean(avatarId) && !reuseId);
  // Memoised like `reuseSeed` below: without it, `avatarSeed(...)` returns a fresh object
  // every render, and MediaComposer's `useEffect(..., [seed])` would re-run on every render
  // of this component (harmless only because its own `seededRef` short-circuits).
  const avatarSeeded = useMemo(() => avatarSeed(avatarId, avatarsQ.data ?? []), [avatarId, avatarsQ.data]);
  // The id is real but not in the catalog (removed, or never rendered) — degrade to a
  // plain new-video flow with a notice, exactly as a missing ?reuse= video does.
  const avatarFailed = Boolean(avatarId) && !reuseId && !avatarsQ.isFetching && !avatarSeeded;

  // Music is stored as a bare track key, so resolve it against the catalog to get the
  // MusicTrack object the picker needs. A track removed since the video was made simply
  // does not resolve, and reuse continues without music.
  const musicQuery = useMusic("", Boolean(reuseId));
  const tracks = musicQuery.data?.music ?? [];

  // No cast: the API returns `avatar`/`voice` already shaped as the composer's own types.
  const reuseSeed = useMemo<ComposerSeed | undefined>(() => {
    if (!reuseId || !source) return undefined;
    const { captionId, music } = optionsToComposerState(source.video);
    // MediaComposer seeds only once per `seed.key` (the source video id), so if we emitted a
    // seed here before the catalog resolved, `selectedMusic` would be locked in as `null`
    // forever once the catalog arrives — the effect re-runs, sees the same key, and bails.
    // Withholding the seed entirely while a video WITH stored music waits on the catalog
    // avoids that; a video with no stored music never needs the catalog, so it isn't made
    // to wait for no reason.
    // Gated on `isFetching`, not `isPending`/`isSuccess`: it stays true through React
    // Query's automatic retries (so a retry in flight still gets its chance), but — unlike
    // `isSuccess` — it does NOT withhold forever on a permanent failure. Once the query
    // settles either way (retries exhausted), `isFetching` goes false and the seed proceeds;
    // on a real failure `tracks` stays empty and `selectedMusic` below resolves to `null`,
    // silently degrading only the music — avatar/voice/captions/layout still seed correctly.
    if (music && musicQuery.isFetching) return undefined;
    return {
      key: reuseId,
      selectedAvatar: source.avatar ?? null,
      selectedVoice: source.voice ?? null,
      selectedMusic: music ? (tracks.find((t) => t.key === music.trackKey) ?? null) : null,
      musicVolume: music?.volume ?? 0.15,
      captionId,
    };
  }, [reuseId, source, tracks, musicQuery.isFetching]);

  const seed = pickSeed(reuseSeed, avatarSeeded);

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
          <div>
            <h1 className="disp text-[26px] font-semibold leading-tight text-ink sm:text-[34px]">What are we making today?</h1>
            {/* A deleted or missing source degrades to a plain new-video flow with a
                notice — never an error screen, since the composer works fine without it. */}
            <p className="mt-1.5 text-[14px] text-slate sm:text-[15px]">
              {reuseFailed
                ? "That video could not be found, so we started you fresh"
                : reuseId
                  ? "Same presenter, voice and style as before — just write the new script"
                  : avatarFailed
                    ? "That presenter could not be found, so we started you fresh"
                    : avatarSeeded
                      ? `${avatarSeeded.selectedAvatar?.name} is presenting — write the script`
                      : "Paste a product link, or upload your own photos and clips"}
            </p>
          </div>
          <MediaComposer extraSettings={settings} onSettingsChange={setSettings} seed={seed} />
        </div>
      </section>
    </div>
  );
}
