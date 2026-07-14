"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { ReelPreview } from "@/components/ReelPreview";
import { type Avatar, AvatarStep, type BgImage, FormatStep, type Presenter, ReviewStep, ScriptStep, SetupStep, VoiceStep, type Voice } from "@/components/WizardSteps";
import { apiFetch } from "@/lib/api";
import { cfImageUrl } from "@/lib/images";
import { type MusicTrack, useAvatars, useCreatePresenter, useGenerateVideo, useMusic, usePresenters, useUploadBackground, useUploadBackgroundVideo, useVoices } from "@/lib/queries";
import { type CreateReelValues, createReelSchema } from "@/lib/schemas";

const STEPS = ["Başlık & B-roll", "Avatar & ses", "Senaryo", "Önizle"] as const;

// Prisma stores aspectRatio as r9_16 etc.; map back when resuming a draft.
const RATIO_FROM_API: Record<string, CreateReelValues["aspectRatio"]> = {
  r9_16: "9:16", r1_1: "1:1", r16_9: "16:9", "9:16": "9:16", "1:1": "1:1", "16:9": "16:9",
};

function buildOptions(v: CreateReelValues, wizardStep: number) {
  const ids = v.backgroundImageIds ?? [];
  const kinds = v.backgroundKinds ?? [];
  const trans = v.backgroundTransitions ?? [];
  // Unified ordered B-roll: each ref is a CF Images id (image) or an R2 key (video).
  const media = ids.map((ref, i) => ({
    kind: (kinds[i] === "video" ? "video" : "image") as "image" | "video",
    ref,
    transition: trans[i] ?? "fade",
  }));
  return {
    captions: { enabled: v.captions, style: v.captionStyle ?? "karaoke", font: v.captionFont ?? "General Sans", color: v.captionColor ?? "#FFD54A" },
    background: media.length
      ? {
          type: "image" as const,
          value: media[0].ref,
          images: media.filter((m) => m.kind === "image").map((m) => m.ref),
          transitions: media.map((m) => m.transition),
          media,
        }
      : { type: "color" as const, value: "#0B0B0D" },
    ...(v.musicTrackKey ? { music: { trackKey: v.musicTrackKey, volume: v.musicVolume ?? 0.15 } } : {}),
    layout: { presenterLayout: v.presenterLayout, avatarSide: v.avatarSide, captionPosition: v.captionPosition },
    voice: { emotion: v.voiceEmotion ?? "" },
    effects: { transitionSfx: v.transitionSfx ?? true },
    wizardStep,
  };
}

/** Dev-only seed data so the studio can be previewed outside the auth gate. */
export type StudioDemo = {
  voices?: Voice[];
  presenters?: Presenter[];
  avatars?: Avatar[];
  music?: MusicTrack[];
  values?: Partial<CreateReelValues>;
  step?: number;
  bgImages?: BgImage[];
};

export function CreateWizard({ demo, draftId }: { demo?: StudioDemo; draftId?: string } = {}) {
  const router = useRouter();
  const [step, setStep] = useState(demo?.step ?? 0);
  // Highest step reached — every step up to here stays clickable in the top rail,
  // so you can jump freely among visited steps (even after going back).
  const [maxStep, setMaxStep] = useState(demo?.step ?? 0);
  // Server state via TanStack Query (disabled in dev/demo, which supplies its own).
  const voicesQ = useVoices(!demo);
  const avatarsQ = useAvatars(!demo);
  const presentersQ = usePresenters(!demo);
  const musicQ = useMusic(!demo);
  const voices = demo?.voices ?? voicesQ.data ?? [];
  const avatars = demo?.avatars ?? avatarsQ.data ?? [];
  const presenters = demo?.presenters ?? presentersQ.data ?? [];
  const music = demo?.music ?? musicQ.data ?? [];
  // Mutations (pending/error handled by TanStack Query, cache updates in the hooks).
  const createPresenter = useCreatePresenter();
  const uploadBg = useUploadBackground();
  const uploadBgVideo = useUploadBackgroundVideo();
  const generate = useGenerateVideo();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [generating, setGenerating] = useState(false);
  // The draft's video id, and the in-flight creation promise (so concurrent
  // saves share one create call rather than racing).
  const draftRef = useRef<string | null>(draftId ?? null);
  const creatingRef = useRef<Promise<string | null> | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<CreateReelValues>({
    resolver: zodResolver(createReelSchema),
    defaultValues: { aspectRatio: "9:16", captions: true, captionStyle: "karaoke", captionFont: "General Sans", captionColor: "#FFD54A", voiceEmotion: "", backgroundImageIds: [], backgroundKinds: [], backgroundTransitions: [], musicVolume: 0.15, presenterLayout: "side", avatarSide: "right", captionPosition: "bottom", transitionSfx: true, ...demo?.values },
  });
  const values = watch();
  const set: (n: keyof CreateReelValues, v: CreateReelValues[keyof CreateReelValues], o?: object) => void = setValue;

  // Background images (id + delivery URL for the preview). The form field
  // `backgroundImageIds` mirrors the ids so autosave/submit persist them.
  const [bgImages, setBgImages] = useState<BgImage[]>(demo?.bgImages ?? []);

  function syncBgImages(next: BgImage[]) {
    setBgImages(next);
    set("backgroundImageIds", next.map((i) => i.id));
    // Keep kinds + per-item transitions aligned to the B-roll order for autosave/submit.
    set("backgroundKinds", next.map((i) => i.kind ?? "image"));
    set("backgroundTransitions", next.map((i) => i.transition ?? "fade"));
  }

  async function uploadBackgrounds(files: FileList) {
    const uploaded: BgImage[] = [];
    for (const file of Array.from(files)) {
      uploaded.push({ ...(await uploadBg.mutateAsync(file)), kind: "image", transition: "fade" });
    }
    syncBgImages([...bgImages, ...uploaded]);
  }

  async function uploadBackgroundVideos(files: FileList) {
    const uploaded: BgImage[] = [];
    for (const file of Array.from(files)) {
      const { key, url } = await uploadBgVideo.mutateAsync(file); // R2 key is the B-roll ref
      uploaded.push({ id: key, url, kind: "video", transition: "fade" });
    }
    syncBgImages([...bgImages, ...uploaded]);
  }

  function removeBackground(id: string) {
    syncBgImages(bgImages.filter((i) => i.id !== id));
  }

  function setTransition(id: string, transition: string) {
    syncBgImages(bgImages.map((i) => (i.id === id ? { ...i, transition } : i)));
  }

  // Lazily create the draft on first save; concurrent callers share the promise.
  async function ensureDraft(v: CreateReelValues): Promise<string | null> {
    if (draftRef.current) return draftRef.current;
    if (!creatingRef.current) {
      creatingRef.current = apiFetch<{ video: { id: string } }>("/videos/draft", {
        method: "POST",
        body: JSON.stringify({ title: v.title, script: v.script }),
      })
        .then((r) => {
          draftRef.current = r.video.id;
          return r.video.id;
        })
        .catch(() => null);
    }
    return creatingRef.current;
  }

  // Fire-and-forget: persist the draft without blocking the UI or navigation.
  function saveProgress(v: CreateReelValues, wizardStep: number) {
    if (demo) return;
    setSaveState("saving");
    void (async () => {
      const id = await ensureDraft(v);
      if (!id) return setSaveState("idle");
      try {
        await apiFetch(`/videos/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: v.title,
            script: v.script,
            presenterId: v.presenterId || null,
            voiceId: v.voiceId || null,
            aspectRatio: v.aspectRatio,
            options: buildOptions(v, wizardStep),
          }),
        });
        setSaveState("saved");
      } catch {
        setSaveState("idle");
      }
    })();
  }

  // Selecting a preset avatar creates (or reuses) a presenter that references it.
  async function selectAvatar(a: Avatar) {
    if (!a.ready || !a.id) return; // pending portraits can't be rendered yet
    const existing = presenters.find((p) => p.sourceImageId === a.id);
    if (existing) {
      set("presenterId", existing.id, { shouldValidate: true });
      return;
    }
    // useCreatePresenter adds the new presenter to the query cache on success.
    const { presenter } = await createPresenter.mutateAsync({ name: a.name, sourceImageId: a.id });
    set("presenterId", presenter.id, { shouldValidate: true });
  }

  // Resume: load an existing draft and jump to where the user left off.
  useEffect(() => {
    if (demo || !draftId) return;
    type DraftVideo = {
      title: string; script: string; presenterId: string | null; voiceId: string | null;
      aspectRatio: string; status: string; options: Record<string, unknown>;
    };
    apiFetch<{ video: DraftVideo; brollImageUrls?: string[]; brollMedia?: { kind: "image" | "video"; ref: string; transition?: string; url: string }[] }>(`/videos/${draftId}`)
      .then(({ video, brollImageUrls, brollMedia }) => {
        if (!video || video.status !== "draft") return;
        setValue("title", video.title === "Adsız video" ? "" : video.title);
        setValue("script", video.script ?? "");
        if (video.presenterId) setValue("presenterId", video.presenterId);
        if (video.voiceId) setValue("voiceId", video.voiceId);
        setValue("aspectRatio", RATIO_FROM_API[video.aspectRatio] ?? "9:16");
        const o = (video.options ?? {}) as { captions?: boolean | { enabled?: boolean; style?: "karaoke" | "tiktok" | "beast" | "hormozi" | "boxed" | "clean" | "keyword"; font?: string; color?: string }; wizardStep?: number; background?: { type?: string; value?: string; images?: string[]; transitions?: string[] }; music?: { trackKey?: string | null; volume?: number }; layout?: { presenterLayout?: "side" | "bottom"; avatarSide?: "left" | "right"; captionPosition?: "top" | "bottom" }; voice?: { emotion?: string }; effects?: { transitionSfx?: boolean } };
        // captions: legacy drafts store a boolean; newer ones an object.
        if (typeof o.captions === "boolean") setValue("captions", o.captions);
        else if (o.captions) {
          setValue("captions", o.captions.enabled ?? true);
          if (o.captions.style) setValue("captionStyle", o.captions.style);
          if (o.captions.font) setValue("captionFont", o.captions.font);
          if (o.captions.color) setValue("captionColor", o.captions.color);
        }
        if (o.music?.trackKey) setValue("musicTrackKey", o.music.trackKey);
        if (typeof o.music?.volume === "number") setValue("musicVolume", o.music.volume);
        if (o.layout?.presenterLayout) setValue("presenterLayout", o.layout.presenterLayout);
        if (o.layout?.avatarSide) setValue("avatarSide", o.layout.avatarSide);
        if (o.layout?.captionPosition) setValue("captionPosition", o.layout.captionPosition);
        if (typeof o.voice?.emotion === "string") setValue("voiceEmotion", o.voice.emotion);
        if (typeof o.effects?.transitionSfx === "boolean") setValue("transitionSfx", o.effects.transitionSfx);
        // Prefer the unified media list (images + video clips, with signed URLs);
        // fall back to the legacy images+transitions (older drafts).
        const bg = o.background ?? {};
        if (brollMedia?.length) {
          const restored: BgImage[] = brollMedia.map((m) => ({
            id: m.ref,
            url: m.url ?? (m.kind === "image" ? cfImageUrl(m.ref) : ""),
            kind: m.kind,
            transition: m.transition ?? "fade",
          }));
          setValue("backgroundImageIds", restored.map((i) => i.id));
          setValue("backgroundKinds", restored.map((i) => i.kind ?? "image"));
          setValue("backgroundTransitions", restored.map((i) => i.transition ?? "fade"));
          setBgImages(restored);
        } else {
          const ids = bg.images ?? (bg.type === "image" && bg.value ? [bg.value] : []);
          if (ids.length) {
            const trans = bg.transitions ?? [];
            setValue("backgroundImageIds", ids);
            setValue("backgroundKinds", ids.map(() => "image"));
            setValue("backgroundTransitions", ids.map((_, i) => trans[i] ?? "fade"));
            setBgImages(ids.map((id, i) => ({ id, url: brollImageUrls?.[i] ?? cfImageUrl(id), kind: "image", transition: trans[i] ?? "fade" })));
          }
        }
        if (typeof o.wizardStep === "number") {
          const s = Math.min(o.wizardStep, STEPS.length - 1);
          setStep(s);
          setMaxStep((m) => Math.max(m, s));
        }
      })
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, demo]);

  // Seed B-roll from media uploaded on the Home composer (stashed in sessionStorage
  // as it navigated here). Only on a fresh video — never clobber a resumed draft.
  const seededRef = useRef(false);
  useEffect(() => {
    if (demo || draftId || seededRef.current) return;
    seededRef.current = true;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem("sentezy:pending-media");
      sessionStorage.removeItem("sentezy:pending-media");
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const media = JSON.parse(raw) as { ref: string; url?: string; kind: "image" | "video"; transition?: string }[];
      const restored: BgImage[] = media
        .filter((m) => m?.ref)
        .map((m) => ({ id: m.ref, url: m.url ?? (m.kind === "image" ? cfImageUrl(m.ref) : ""), kind: m.kind, transition: m.transition ?? "fade" }));
      if (restored.length) syncBgImages(restored);
    } catch {
      /* ignore malformed payloads */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, demo]);

  const presenter = presenters.find((p) => p.id === values.presenterId);
  // Prefer the avatar's matted (transparent) thumbnail for the cut-out preview;
  // fall back to the presenter's source image if it isn't matted yet.
  const selectedAvatar = avatars.find((a) => a.ready && a.id === presenter?.sourceImageId);
  const presenterCutoutUrl = selectedAvatar?.imageUrl ?? presenter?.imageUrl ?? null;
  const voice = voices.find((v) => v.id === values.voiceId);

  // Advance to the next step and save the draft (save on next, not on every change).
  async function next() {
    const perStep: (keyof CreateReelValues)[][] = [["title"], ["presenterId", "voiceId"], ["script"], []];
    if (!(await trigger(perStep[step]))) return;
    const nextStep = Math.min(step + 1, STEPS.length - 1);
    setStep(nextStep);
    setMaxStep((m) => Math.max(m, nextStep));
    saveProgress(values, nextStep);
  }

  // Jump to any already-visited step via the top rail (no save — data lives in the form).
  function goToStep(i: number) {
    if (i <= maxStep) setStep(i);
  }

  // Finalize: make sure the draft is saved, then generate (debit + queue).
  const onSubmit = handleSubmit(async (v) => {
    setSubmitError(null);
    setGenerating(true);
    try {
      const id = await ensureDraft(v);
      if (!id) throw new Error("Taslak kaydedilemedi");
      await apiFetch(`/videos/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: v.title,
          script: v.script,
          presenterId: v.presenterId || null,
          voiceId: v.voiceId || null,
          aspectRatio: v.aspectRatio,
          options: buildOptions(v, step),
        }),
      });
      const { video } = await generate.mutateAsync(id);
      router.push(`/videos/${video.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bir hata oluştu";
      setSubmitError(msg.includes("insufficient_credits") ? "Yeterli krediniz yok." : msg);
      setGenerating(false);
    }
  });

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <div className="flex items-center gap-2.5">
          <span className="eyebrow">Stüdyo</span>
          {!demo && (
            <span className="mono text-[11px] text-muted">
              {saveState === "saving" ? "· kaydediliyor…" : saveState === "saved" ? "· taslak kaydedildi" : "· taslak"}
            </span>
          )}
        </div>
        <h1 className="disp mt-1 text-[28px] font-semibold text-ink">Yeni video</h1>
        <p className="mt-1 text-[14px] text-slate">Beş adımda konuşan videon hazır — sağda canlı önizle.</p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px]">
        {/* ── controls ── */}
        <div className="order-2 lg:order-1">
          {/* step rail */}
          <div className="mb-5 flex flex-wrap gap-1.5">
            {STEPS.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => goToStep(i)}
                disabled={i > maxStep}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium transition ${i === step ? "bg-[var(--wash)] text-signal" : i <= maxStep ? "text-ink hover:bg-mist" : "cursor-default text-muted"
                  }`}
              >
                <span className="mono text-[11px]">{String(i + 1).padStart(2, "0")}</span>
                {label}
              </button>
            ))}
          </div>

          <div className="card p-6">
            {step === 0 && (
              <SetupStep
                register={register}
                errors={errors}
                values={values}
                setValue={set}
                bgImages={bgImages}
                onUpload={uploadBackgrounds}
                onUploadVideo={uploadBackgroundVideos}
                onRemove={removeBackground}
                onTransition={setTransition}
              />
            )}
            {step === 1 && (
              <div className="flex flex-col gap-7">
                <div>
                  <h3 className="disp mb-3 text-[15px] font-semibold text-ink">Avatar</h3>
                  <AvatarStep
                    avatars={avatars}
                    selectedImageUrl={presenterCutoutUrl}
                    selectedName={presenter?.name}
                    onSelect={selectAvatar}
                    busy={createPresenter.isPending}
                    error={createPresenter.isError ? "Avatar seçilemedi, tekrar dene." : errors.presenterId?.message}
                  />
                </div>
                <div className="border-t border-hairline pt-7">
                  <h3 className="disp mb-3 text-[15px] font-semibold text-ink">Ses</h3>
                  <VoiceStep voices={voices} selected={values.voiceId} onSelect={(id) => set("voiceId", id, { shouldValidate: true })} error={errors.voiceId?.message} />
                </div>
              </div>
            )}
            {step === 2 && <ScriptStep register={register} errors={errors} values={values} setValue={set} />}
            {step === 3 && (
              <div className="flex flex-col gap-7">
                <FormatStep register={register} errors={errors} values={values} setValue={set} music={music} />
                <ReviewStep values={values} presenterName={presenter?.name ?? "—"} voiceLabel={voice?.label ?? "—"} submitError={submitError} />
              </div>
            )}
          </div>

          {/* nav */}
          <div className="mt-5 flex gap-3">
            {step > 0 && <button type="button" onClick={() => setStep((s) => s - 1)} className="btn btn-ghost">Geri</button>}
            <div className="ml-auto flex gap-3">
              {!demo && (
                <button
                  type="button"
                  onClick={() => saveProgress(values, step)}
                  disabled={saveState === "saving"}
                  className="btn btn-ghost disabled:opacity-60"
                >
                  {saveState === "saving" ? "Kaydediliyor…" : "Kaydet"}
                </button>
              )}
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={next} className="btn btn-primary">İleri →</button>
              ) : (
                <button type="button" onClick={onSubmit} disabled={generating || isSubmitting} className="btn btn-primary disabled:opacity-60">
                  {generating ? "Oluşturuluyor…" : "Videoyu oluştur"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── live preview ── */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-6">
          <ReelPreview
            step={step}
            values={{
              title: values.title,
              script: values.script,
              presenterName: presenter?.name,
              presenterImageUrl: presenterCutoutUrl,
              voiceLabel: voice?.label,
              aspectRatio: values.aspectRatio ?? "9:16",
              captions: values.captions ?? true,
              captionStyle: values.captionStyle ?? "karaoke",
              captionFont: values.captionFont ?? "General Sans",
              captionColor: values.captionColor ?? "#FFD54A",
              brollMedia: bgImages.filter((i) => i.url).map((i) => ({ url: i.url, kind: i.kind ?? "image" })),
              musicLabel: music.find((t) => t.key === values.musicTrackKey)?.name,
              presenterLayout: values.presenterLayout ?? "side",
              avatarSide: values.avatarSide ?? "right",
              captionPosition: values.captionPosition ?? "bottom",
            }}
          />
        </div>
      </div>
    </div>
  );
}
