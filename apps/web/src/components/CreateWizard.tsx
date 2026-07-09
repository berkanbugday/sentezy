"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { ReelPreview } from "@/components/ReelPreview";
import { AvatarStep, FormatStep, type Presenter, ReviewStep, ScriptStep, VoiceStep, type Voice } from "@/components/WizardSteps";
import { apiFetch } from "@/lib/api";
import { type CreateReelValues, createReelSchema } from "@/lib/schemas";

const STEPS = ["Senaryo", "Avatar", "Ses & dil", "Biçim", "Önizle"] as const;

/** Dev-only seed data so the studio can be previewed outside the auth gate. */
export type StudioDemo = {
  voices?: Voice[];
  presenters?: Presenter[];
  colors?: string[];
  values?: Partial<CreateReelValues>;
  step?: number;
};

export function CreateWizard({ demo }: { demo?: StudioDemo } = {}) {
  const router = useRouter();
  const [step, setStep] = useState(demo?.step ?? 0);
  const [voices, setVoices] = useState<Voice[]>(demo?.voices ?? []);
  const [presenters, setPresenters] = useState<Presenter[]>(demo?.presenters ?? []);
  const [colors, setColors] = useState<string[]>(demo?.colors ?? ["#0A0A0B", "#3F3F46", "#FFFFFF"]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<CreateReelValues>({
    resolver: zodResolver(createReelSchema),
    defaultValues: { aspectRatio: "9:16", captions: true, backgroundColor: "#0B0B0D", ...demo?.values },
  });
  const values = watch();
  const set: (n: keyof CreateReelValues, v: CreateReelValues[keyof CreateReelValues], o?: object) => void = setValue;

  useEffect(() => {
    if (demo) return;
    apiFetch<{ voices: Voice[] }>("/voices").then((r) => setVoices(r.voices)).catch(() => {});
    apiFetch<{ presenters: Presenter[] }>("/presenters").then((r) => setPresenters(r.presenters)).catch(() => {});
    apiFetch<{ colors: string[] }>("/backgrounds").then((r) => setColors(r.colors)).catch(() => {});
  }, [demo]);

  const presenter = presenters.find((p) => p.id === values.presenterId);
  const voice = voices.find((v) => v.id === values.voiceId);

  async function next() {
    const perStep: (keyof CreateReelValues)[][] = [["title", "script"], ["presenterId"], ["voiceId"], ["aspectRatio"], []];
    if (await trigger(perStep[step])) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  const onSubmit = handleSubmit(async (v) => {
    setSubmitError(null);
    try {
      const { video } = await apiFetch<{ video: { id: string } }>("/videos", {
        method: "POST",
        body: JSON.stringify({
          title: v.title,
          script: v.script,
          presenterId: v.presenterId,
          voiceId: v.voiceId,
          aspectRatio: v.aspectRatio,
          options: { captions: v.captions, background: { type: "color", value: v.backgroundColor } },
        }),
      });
      router.push(`/videos/${video.id}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Bir hata oluştu");
    }
  });

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <span className="eyebrow">Stüdyo</span>
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
            {step === 0 && <ScriptStep register={register} errors={errors} values={values} setValue={set} />}
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
            {step === 3 && <FormatStep register={register} errors={errors} values={values} setValue={set} colors={colors} />}
            {step === 4 && (
              <ReviewStep values={values} presenterName={presenter?.name ?? "—"} voiceLabel={voice?.label ?? "—"} submitError={submitError} />
            )}
          </div>

          {/* nav */}
          <div className="mt-5 flex gap-3">
            {step > 0 && <button type="button" onClick={() => setStep((s) => s - 1)} className="btn btn-ghost">Geri</button>}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={next} className="btn btn-primary ml-auto">İleri →</button>
            ) : (
              <button type="button" onClick={onSubmit} disabled={isSubmitting} className="btn btn-primary ml-auto disabled:opacity-60">
                {isSubmitting ? "Oluşturuluyor…" : "Videoyu oluştur"}
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
              backgroundColor: values.backgroundColor ?? "#0B0B0D",
            }}
          />
        </div>
      </div>
    </div>
  );
}
