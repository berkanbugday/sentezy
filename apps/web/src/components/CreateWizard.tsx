"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { apiFetch } from "@/lib/api";
import { type CreateReelValues, createReelSchema } from "@/lib/schemas";

type Voice = { id: string; label: string; gender: string | null; style: string | null };
type Presenter = { id: string; name: string; status: string };

const STEPS = ["Senaryo", "Avatar", "Ses & dil", "Biçim", "Önizle"] as const;
const RATIOS: CreateReelValues["aspectRatio"][] = ["9:16", "1:1", "16:9"];

export function CreateWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [presenters, setPresenters] = useState<Presenter[]>([]);
  const [colors, setColors] = useState<string[]>(["#0B0B0D", "#F5F4F1", "#7C86E8"]);
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
    defaultValues: { aspectRatio: "9:16", captions: true, backgroundColor: "#0B0B0D" },
  });
  const values = watch();

  useEffect(() => {
    apiFetch<{ voices: Voice[] }>("/voices").then((r) => setVoices(r.voices)).catch(() => {});
    apiFetch<{ presenters: Presenter[] }>("/presenters").then((r) => setPresenters(r.presenters)).catch(() => {});
    apiFetch<{ colors: string[] }>("/backgrounds").then((r) => setColors(r.colors)).catch(() => {});
  }, []);

  async function next() {
    const perStep: (keyof CreateReelValues)[][] = [
      ["title", "script"],
      ["presenterId"],
      ["voiceId"],
      ["aspectRatio"],
      [],
    ];
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
          options: {
            captions: v.captions,
            background: { type: "color", value: v.backgroundColor },
          },
        }),
      });
      router.push(`/videos/${video.id}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Bir hata oluştu");
    }
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="disp text-[26px] font-semibold text-ink">Yeni video</h1>
      <p className="mt-1 text-[14px] text-slate">Beş adımda konuşan videon hazır.</p>

      {/* step rail */}
      <div className="mt-6 flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => i < step && setStep(i)}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium ${
              i === step ? "bg-[var(--wash)] text-signal" : i < step ? "text-ink" : "text-muted"
            }`}
          >
            <span className="mono">{String(i + 1).padStart(2, "0")}</span>
            {label}
          </button>
        ))}
      </div>

      <div className="card mt-5 p-6">
        {/* 1 — script */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-ink">Başlık</label>
              <input className="w-full rounded-xl border border-hairline bg-mist px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-signal" placeholder="Örn: Kuaför tanıtımı" {...register("title")} />
              {errors.title && <p className="mt-1 text-[12.5px] text-red-600">{errors.title.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-ink">Senaryo</label>
              <textarea rows={8} className="w-full resize-y rounded-xl border border-hairline bg-mist px-3.5 py-3 text-[14px] leading-relaxed text-ink outline-none focus:border-signal" placeholder="Videonun konuşma metnini yaz…" {...register("script")} />
              <div className="mt-1 flex justify-between text-[12px] text-muted">
                <span>{errors.script && <span className="text-red-600">{errors.script.message}</span>}</span>
                <span>{values.script?.length ?? 0} karakter</span>
              </div>
            </div>
          </div>
        )}

        {/* 2 — avatar */}
        {step === 1 && (
          <PresenterStep
            presenters={presenters}
            selected={values.presenterId}
            onSelect={(id) => setValue("presenterId", id, { shouldValidate: true })}
            onCreated={(p) => {
              setPresenters((list) => [p, ...list]);
              setValue("presenterId", p.id, { shouldValidate: true });
            }}
            error={errors.presenterId?.message}
          />
        )}

        {/* 3 — voice */}
        {step === 2 && (
          <div>
            <div className="flex flex-col gap-2">
              {voices.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setValue("voiceId", v.id, { shouldValidate: true })}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left ${
                    values.voiceId === v.id ? "border-signal bg-[var(--wash)]" : "border-hairline bg-paper"
                  }`}
                >
                  <span className="text-[14px] font-semibold text-ink">{v.label}</span>
                  <span className="text-[12.5px] text-muted">{[v.gender, v.style].filter(Boolean).join(" · ")}</span>
                </button>
              ))}
              {voices.length === 0 && <p className="text-[13px] text-muted">Sesler yükleniyor…</p>}
            </div>
            {errors.voiceId && <p className="mt-2 text-[12.5px] text-red-600">{errors.voiceId.message}</p>}
          </div>
        )}

        {/* 4 — format */}
        {step === 3 && (
          <div className="flex flex-col gap-6">
            <div>
              <label className="mb-2 block text-[13px] font-medium text-ink">Oran</label>
              <div className="inline-flex gap-2">
                {RATIOS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setValue("aspectRatio", r)}
                    className={`rounded-xl border px-4 py-2 text-[14px] font-semibold ${
                      values.aspectRatio === r ? "border-signal bg-[var(--wash)] text-signal" : "border-hairline text-ink"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-3">
              <input type="checkbox" {...register("captions")} className="h-4 w-4 accent-[var(--color-signal)]" />
              <span className="text-[14px] text-ink">Otomatik altyazı</span>
            </label>
            <div>
              <label className="mb-2 block text-[13px] font-medium text-ink">Arka plan</label>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setValue("backgroundColor", c)}
                    className={`h-9 w-9 rounded-lg border-2 ${values.backgroundColor === c ? "border-signal" : "border-hairline"}`}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5 — preview */}
        {step === 4 && (
          <div className="flex flex-col gap-3 text-[14px]">
            {[
              ["Başlık", values.title],
              ["Sunucu", presenters.find((p) => p.id === values.presenterId)?.name ?? "—"],
              ["Ses", voices.find((v) => v.id === values.voiceId)?.label ?? "—"],
              ["Oran", values.aspectRatio],
              ["Altyazı", values.captions ? "Açık" : "Kapalı"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-hairline pb-2">
                <span className="text-muted">{k}</span>
                <span className="font-semibold text-ink">{v}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between rounded-xl bg-mist px-4 py-3">
              <span className="text-[13px] text-slate">Kredi maliyeti</span>
              <span className="text-[13px] font-semibold text-ink">1 kredi</span>
            </div>
            {submitError && <p className="text-[12.5px] text-red-600">{submitError}</p>}
          </div>
        )}
      </div>

      {/* nav */}
      <div className="mt-5 flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)} className="btn btn-ghost">Geri</button>
        )}
        {step < STEPS.length - 1 ? (
          <button onClick={next} className="btn btn-primary ml-auto">İleri →</button>
        ) : (
          <button onClick={onSubmit} disabled={isSubmitting} className="btn btn-primary ml-auto disabled:opacity-60">
            {isSubmitting ? "Oluşturuluyor…" : "Videoyu oluştur"}
          </button>
        )}
      </div>
    </div>
  );
}

function PresenterStep({
  presenters,
  selected,
  onSelect,
  onCreated,
  error,
}: {
  presenters: Presenter[];
  selected?: string;
  onSelect: (id: string) => void;
  onCreated: (p: Presenter) => void;
  error?: string;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addPresenter() {
    const file = fileRef.current?.files?.[0];
    if (!name.trim() || !file) return;
    setBusy(true);
    try {
      const { presenter, uploadURL } = await apiFetch<{ presenter: Presenter; uploadURL: string }>("/presenters", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      const fd = new FormData();
      fd.append("file", file);
      await fetch(uploadURL, { method: "POST", body: fd });
      onCreated(presenter);
      setName("");
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {presenters.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {presenters.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`rounded-2xl border p-4 text-center ${selected === p.id ? "border-signal bg-[var(--wash)]" : "border-hairline"}`}
            >
              <div className="grad mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full text-[20px] font-bold text-white">
                {p.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="truncate text-[13.5px] font-semibold text-ink">{p.name}</div>
              <div className="text-[11px] text-muted">{p.status}</div>
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-hairline p-4">
        <p className="mb-3 text-[13px] font-semibold text-ink">Yeni sunucu ekle</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="flex-1 rounded-xl border border-hairline bg-mist px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-signal" placeholder="İsim" value={name} onChange={(e) => setName(e.target.value)} />
          <input ref={fileRef} type="file" accept="image/*" className="text-[13px] text-slate" />
          <button onClick={addPresenter} disabled={busy} className="btn btn-ghost disabled:opacity-60">
            {busy ? "Yükleniyor…" : "Ekle"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-[12.5px] text-red-600">{error}</p>}
    </div>
  );
}
