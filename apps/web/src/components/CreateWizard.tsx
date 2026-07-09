"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { ReelPreview } from "@/components/ReelPreview";
import { AvatarStep, type BgImage, FormatStep, type Presenter, ReviewStep, ScriptStep, SetupStep, VoiceStep, type Voice } from "@/components/WizardSteps";
import { apiFetch } from "@/lib/api";
import { type CreateReelValues, createReelSchema } from "@/lib/schemas";

const STEPS = ["Başlık & Arka plan", "Avatar", "Ses & dil", "Senaryo", "Önizle"] as const;

// Prisma stores aspectRatio as r9_16 etc.; map back when resuming a draft.
const RATIO_FROM_API: Record<string, CreateReelValues["aspectRatio"]> = {
  r9_16: "9:16", r1_1: "1:1", r16_9: "16:9", "9:16": "9:16", "1:1": "1:1", "16:9": "16:9",
};

function buildOptions(v: CreateReelValues, wizardStep: number) {
  const ids = v.backgroundImageIds ?? [];
  return {
    captions: v.captions,
    background: ids.length
      ? { type: "image" as const, value: ids[0], images: ids }
      : { type: "color" as const, value: "#0B0B0D" },
    wizardStep,
  };
}

/** Dev-only seed data so the studio can be previewed outside the auth gate. */
export type StudioDemo = {
  voices?: Voice[];
  presenters?: Presenter[];
  values?: Partial<CreateReelValues>;
  step?: number;
  bgImages?: BgImage[];
};

export function CreateWizard({ demo, draftId }: { demo?: StudioDemo; draftId?: string } = {}) {
  const router = useRouter();
  const [step, setStep] = useState(demo?.step ?? 0);
  const [voices, setVoices] = useState<Voice[]>(demo?.voices ?? []);
  const [presenters, setPresenters] = useState<Presenter[]>(demo?.presenters ?? []);
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
    defaultValues: { aspectRatio: "9:16", captions: true, backgroundImageIds: [], ...demo?.values },
  });
  const values = watch();
  const set: (n: keyof CreateReelValues, v: CreateReelValues[keyof CreateReelValues], o?: object) => void = setValue;

  // Background images (id + delivery URL for the preview). The form field
  // `backgroundImageIds` mirrors the ids so autosave/submit persist them.
  const [bgImages, setBgImages] = useState<BgImage[]>(demo?.bgImages ?? []);

  function syncBgImages(next: BgImage[]) {
    setBgImages(next);
    set("backgroundImageIds", next.map((i) => i.id));
  }

  async function uploadBackgrounds(files: FileList) {
    const uploaded: BgImage[] = [];
    for (const file of Array.from(files)) {
      const { id, uploadURL, imageUrl } = await apiFetch<{ id: string; uploadURL: string; imageUrl: string }>(
        "/backgrounds/upload",
        { method: "POST", body: JSON.stringify({}) },
      );
      const fd = new FormData();
      fd.append("file", file);
      await fetch(uploadURL, { method: "POST", body: fd });
      uploaded.push({ id, url: imageUrl });
    }
    syncBgImages([...bgImages, ...uploaded]);
  }

  function removeBackground(id: string) {
    syncBgImages(bgImages.filter((i) => i.id !== id));
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

  useEffect(() => {
    if (demo) return;
    apiFetch<{ voices: Voice[] }>("/voices").then((r) => setVoices(r.voices)).catch(() => {});
    apiFetch<{ presenters: Presenter[] }>("/presenters").then((r) => setPresenters(r.presenters)).catch(() => {});
  }, [demo]);

  // Resume: load an existing draft and jump to where the user left off.
  useEffect(() => {
    if (demo || !draftId) return;
    type DraftVideo = {
      title: string; script: string; presenterId: string | null; voiceId: string | null;
      aspectRatio: string; status: string; options: Record<string, unknown>;
    };
    apiFetch<{ video: DraftVideo }>(`/videos/${draftId}`)
      .then(({ video }) => {
        if (!video || video.status !== "draft") return;
        setValue("title", video.title === "Adsız video" ? "" : video.title);
        setValue("script", video.script ?? "");
        if (video.presenterId) setValue("presenterId", video.presenterId);
        if (video.voiceId) setValue("voiceId", video.voiceId);
        setValue("aspectRatio", RATIO_FROM_API[video.aspectRatio] ?? "9:16");
        const o = (video.options ?? {}) as { captions?: boolean; wizardStep?: number; background?: { type?: string; value?: string; images?: string[] } };
        if (typeof o.captions === "boolean") setValue("captions", o.captions);
        const bg = o.background ?? {};
        const ids = bg.images ?? (bg.type === "image" && bg.value ? [bg.value] : []);
        if (ids.length) {
          setValue("backgroundImageIds", ids);
          // URLs can't be rebuilt client-side (no CF hash); the ids still render in the video.
          setBgImages(ids.map((id) => ({ id, url: "" })));
        }
        if (typeof o.wizardStep === "number") setStep(Math.min(o.wizardStep, STEPS.length - 1));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, demo]);

  // Debounced autosave — persists the draft ~0.8s after any change.
  useEffect(() => {
    if (demo) return;
    if (!values.title?.trim() && !values.script?.trim() && !draftRef.current) return;
    const t = setTimeout(() => saveProgress(values, step), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    values.title, values.script, values.presenterId, values.voiceId, values.aspectRatio,
    values.captions, values.backgroundImageIds, step, demo,
  ]);

  const presenter = presenters.find((p) => p.id === values.presenterId);
  const voice = voices.find((v) => v.id === values.voiceId);

  async function next() {
    const perStep: (keyof CreateReelValues)[][] = [["title"], ["presenterId"], ["voiceId"], ["script"], []];
    if (await trigger(perStep[step])) setStep((s) => Math.min(s + 1, STEPS.length - 1));
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
      const { video } = await apiFetch<{ video: { id: string } }>(`/videos/${id}/generate`, {
        method: "POST",
        body: JSON.stringify({}),
      });
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
                onClick={() => i <= step && setStep(i)}
                disabled={i > step}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
                  i === step ? "bg-[var(--wash)] text-signal" : i < step ? "text-ink hover:bg-mist" : "cursor-default text-muted"
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
                onRemove={removeBackground}
              />
            )}
            {step === 1 && (
              <AvatarStep
                presenters={presenters}
                selected={values.presenterId}
                onSelect={(id) => set("presenterId", id, { shouldValidate: true })}
                onCreated={(p) => {
                  setPresenters((list) => [p, ...list]);
                  set("presenterId", p.id, { shouldValidate: true });
                }}
                error={errors.presenterId?.message}
              />
            )}
            {step === 2 && (
              <VoiceStep voices={voices} selected={values.voiceId} onSelect={(id) => set("voiceId", id, { shouldValidate: true })} error={errors.voiceId?.message} />
            )}
            {step === 3 && <ScriptStep register={register} errors={errors} values={values} setValue={set} />}
            {step === 4 && (
              <div className="flex flex-col gap-7">
                <FormatStep register={register} errors={errors} values={values} setValue={set} />
                <ReviewStep values={values} presenterName={presenter?.name ?? "—"} voiceLabel={voice?.label ?? "—"} submitError={submitError} />
              </div>
            )}
          </div>

          {/* nav */}
          <div className="mt-5 flex gap-3">
            {step > 0 && <button type="button" onClick={() => setStep((s) => s - 1)} className="btn btn-ghost">Geri</button>}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={next} className="btn btn-primary ml-auto">İleri →</button>
            ) : (
              <button type="button" onClick={onSubmit} disabled={generating || isSubmitting} className="btn btn-primary ml-auto disabled:opacity-60">
                {generating ? "Oluşturuluyor…" : "Videoyu oluştur"}
              </button>
            )}
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
              presenterImageUrl: presenter?.imageUrl,
              voiceLabel: voice?.label,
              aspectRatio: values.aspectRatio ?? "9:16",
              captions: values.captions ?? true,
              backgroundImageUrls: bgImages.map((i) => i.url).filter(Boolean),
            }}
          />
        </div>
      </div>
    </div>
  );
}
