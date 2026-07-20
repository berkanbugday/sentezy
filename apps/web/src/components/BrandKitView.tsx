"use client";

import { useEffect, useRef, useState } from "react";
import { BrandPreview, type PreviewMode } from "@/components/brand/BrandPreview";
import { FontSelect } from "@/components/brand/FontSelect";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/composer/Spinner";
import { CAPTION_FONTS } from "@/lib/captionStyles";
import { clipErrorMessage, readClipDuration } from "@/lib/videoDuration";
import { type BrandKit, useBrandKit, useUpdateBrandKit, useUploadBrandAsset } from "@/lib/queries";

/** Six visibly distinct starting points — two neutrals and four hues. Deliberately not a
 *  full spectrum: near-identical darks read as a rendering fault, and the custom picker
 *  covers everything else. */
const SWATCHES = ["#0A0A0B", "#52525B", "#FF5A1F", "#2563EB", "#059669", "#7C3AED"];

const MODES: { v: PreviewMode; label: string }[] = [
  { v: "intro", label: "Giriş" },
  { v: "outro", label: "Kapanış" },
  { v: "watermark", label: "Filigran" },
];

type Clip = { key: string; ms: number; url: string | null } | null;

type Draft = {
  brandName: string;
  handle: string;
  outroCta: string;
  color: string;
  font: string;
  logoKey: string | null;
  logoUrl: string | null;
  introClip: Clip;
  outroClip: Clip;
};

const toDraft = (k: BrandKit): Draft => ({
  brandName: k.brandName ?? "",
  handle: k.handle ?? "",
  outroCta: k.outroCta ?? "",
  color: k.color,
  font: k.font,
  logoKey: k.logoKey,
  logoUrl: k.logoUrl,
  introClip: k.introClipKey && k.introClipMs ? { key: k.introClipKey, ms: k.introClipMs, url: k.introClipUrl } : null,
  outroClip: k.outroClipKey && k.outroClipMs ? { key: k.outroClipKey, ms: k.outroClipMs, url: k.outroClipUrl } : null,
});

const INPUT =
  "w-full rounded-xl border border-hairline bg-mist px-3.5 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-muted focus:border-signal";

/** One setting per line: name on the left, control on the right. Matches the read-only
 *  detail rows in VideoDetail, and keeps a 40-character field from stretching to 800px. */
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-hairline py-3.5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="sm:pt-0.5">
        <div className="text-[13.5px] font-medium text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] text-muted">{hint}</div>}
      </div>
      <div className="w-full sm:w-[260px] sm:flex-none">{children}</div>
    </div>
  );
}

export function BrandKitView() {
  const kitQ = useBrandKit();
  const save = useUpdateBrandKit();
  const upload = useUploadBrandAsset();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [clipError, setClipError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"introClip" | "outroClip" | null>(null);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<PreviewMode>("intro");
  const fileRef = useRef<HTMLInputElement>(null);
  const introRef = useRef<HTMLInputElement>(null);
  const outroRef = useRef<HTMLInputElement>(null);

  // Seed the form once the kit arrives. Re-seeding on every refetch would wipe edits.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !kitQ.data) return;
    seeded.current = true;
    setDraft(toDraft(kitQ.data));
  }, [kitQ.data]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setSaved(false);
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  };

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    try {
      const { key, url } = await upload.mutateAsync({ file, kind: "logo" });
      setSaved(false);
      setDraft((d) => (d ? { ...d, logoKey: key, logoUrl: url } : d));
    } catch {
      setUploadError("Logo yüklenemedi. Tekrar dene.");
    }
  };

  /** Measure the clip BEFORE uploading: a file whose length we cannot read is unusable, and
   *  rejecting it here avoids putting an orphan object in storage. */
  const pickClip = async (end: "introClip" | "outroClip", file: File | undefined) => {
    if (!file) return;
    setClipError(null);
    const measured = await readClipDuration(file);
    if (!measured.ok) {
      setClipError(clipErrorMessage(measured.reason));
      return;
    }
    setUploading(end);
    try {
      const { key, url } = await upload.mutateAsync({ file, kind: "clip" });
      setSaved(false);
      setDraft((d) => (d ? { ...d, [end]: { key, ms: measured.ms, url } } : d));
    } catch {
      setClipError("Video yüklenemedi. Tekrar dene.");
    } finally {
      setUploading(null);
    }
  };

  const onSave = async () => {
    if (!draft) return;
    // Empty fields are stored as null: "" would render an empty line on the card.
    await save.mutateAsync({
      brandName: draft.brandName.trim() || null,
      handle: draft.handle.trim() || null,
      outroCta: draft.outroCta.trim() || null,
      color: draft.color,
      font: draft.font,
      logoKey: draft.logoKey,
      // Key and duration always travel together — the API rejects half a pair, because a
      // clip without its length would desynchronise the reel's audio.
      introClipKey: draft.introClip?.key ?? null,
      introClipMs: draft.introClip?.ms ?? null,
      outroClipKey: draft.outroClip?.key ?? null,
      outroClipMs: draft.outroClip?.ms ?? null,
    });
    setSaved(true);
  };

  const dirty = Boolean(draft && kitQ.data && JSON.stringify(draft) !== JSON.stringify(toDraft(kitQ.data)));

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="disp text-[28px] font-semibold text-ink">Marka Kiti</h1>
          <p className="mt-1 text-[14.5px] text-slate">
            Bir kez ayarla, videolarında giriş, kapanış ve filigran olarak kullan.
          </p>
        </div>
        {draft && (
          <div className="flex items-center gap-3">
            {saved && !dirty && <span role="status" className="text-[13px] text-muted">Kaydedildi</span>}
            {save.isError && <span className="text-[13px] text-red-600">Kaydedilemedi</span>}
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || save.isPending}
              className="btn btn-primary min-w-28 disabled:opacity-35"
            >
              {save.isPending ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        )}
      </div>

      {kitQ.isLoading ? (
        <div role="status" aria-live="polite" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <span className="sr-only">Yükleniyor…</span>
          <div className="card p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-6 border-b border-hairline py-4 last:border-0">
                <div className="h-3 w-24 rounded bg-black/5" />
                <div className="h-9 w-[260px] rounded-xl bg-black/5" />
              </div>
            ))}
          </div>
          <div className="ph-stripe aspect-[9/16] rounded-[26px] border border-hairline" />
        </div>
      ) : kitQ.isError ? (
        /* A failed load is not an empty kit — showing blank defaults would let a save
           overwrite the real one. */
        <div className="card p-10 text-center">
          <p className="text-[14px] text-muted">Marka kiti yüklenemedi</p>
          <button type="button" onClick={() => kitQ.refetch()} className="mt-2 text-[13px] font-medium text-signal">
            Tekrar dene
          </button>
        </div>
      ) : draft ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex flex-col gap-5">
            <section className="card px-5 py-1">
              <Row label="Logo" hint="PNG, JPG, WEBP ya da SVG">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => pickLogo(e.target.files?.[0])}
                />
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={upload.isPending}
                    aria-label={draft.logoUrl ? "Logoyu değiştir" : "Logo yükle"}
                    className={`group relative grid h-[52px] w-[52px] flex-none place-items-center overflow-hidden rounded-xl border bg-mist transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                      draft.logoUrl ? "border-hairline hover:border-slate" : "border-dashed border-hairline hover:border-slate"
                    }`}
                  >
                    {upload.isPending ? (
                      <Spinner />
                    ) : draft.logoUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={draft.logoUrl} alt="" className="h-full w-full object-contain p-1.5" />
                        <span className="absolute inset-0 hidden place-items-center bg-ink/70 text-paper group-hover:grid">
                          <Icon.pencil width={15} height={15} />
                        </span>
                      </>
                    ) : (
                      <Icon.plus width={17} height={17} className="text-muted" />
                    )}
                  </button>
                  {draft.logoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setSaved(false);
                        setDraft((d) => (d ? { ...d, logoKey: null, logoUrl: null } : d));
                      }}
                      className="text-[13px] font-medium text-muted transition hover:text-ink"
                    >
                      Kaldır
                    </button>
                  )}
                </div>
              </Row>

              <Row label="Marka adı">
                <input
                  value={draft.brandName}
                  onChange={(e) => set("brandName", e.target.value)}
                  maxLength={60}
                  placeholder="Sentezy"
                  className={INPUT}
                  aria-label="Marka adı"
                />
              </Row>

              <Row label="Kullanıcı adı">
                <input
                  value={draft.handle}
                  onChange={(e) => set("handle", e.target.value)}
                  maxLength={40}
                  placeholder="@sentezy"
                  className={INPUT}
                  aria-label="Kullanıcı adı"
                />
              </Row>

              <Row label="Kapanış yazısı" hint="Videonun sonundaki buton">
                <input
                  value={draft.outroCta}
                  onChange={(e) => set("outroCta", e.target.value)}
                  maxLength={40}
                  placeholder="Hemen dene"
                  className={INPUT}
                  aria-label="Kapanış yazısı"
                />
              </Row>
            </section>

            <section className="card px-5 py-1">
              <Row label="Renk" hint="Giriş ve kapanış arka planı">
                <div className="flex items-center gap-1.5">
                  {SWATCHES.map((hex) => {
                    const on = draft.color.toUpperCase() === hex;
                    return (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => set("color", hex)}
                        aria-label={hex}
                        aria-pressed={on}
                        className={`h-7 w-7 flex-none rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                          on ? "ring-2 ring-ink ring-offset-2" : "ring-1 ring-hairline hover:ring-slate"
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    );
                  })}
                  <label
                    className="ml-0.5 grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-full border border-dashed border-hairline text-muted transition hover:border-slate hover:text-ink"
                    title="Özel renk"
                  >
                    <Icon.plus width={13} height={13} />
                    <input
                      type="color"
                      value={draft.color}
                      onChange={(e) => set("color", e.target.value)}
                      className="sr-only"
                      aria-label="Özel renk"
                    />
                  </label>
                </div>
              </Row>

              <Row label="Yazı tipi">
                <FontSelect value={draft.font} options={CAPTION_FONTS} onChange={(f) => set("font", f)} />
              </Row>
            </section>

            <section className="card px-5 py-1">
              <div className="border-b border-hairline pb-3 pt-4">
                <div className="text-[13.5px] font-medium text-ink">Kendi videon</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                  Hazır kart yerine kendi giriş ya da kapanış videonu kullan. Yüklediğin video o
                  bölümün yerini tamamen alır.
                </p>
              </div>
              {(
                [
                  { end: "introClip", label: "Giriş videosu", ref: introRef },
                  { end: "outroClip", label: "Kapanış videosu", ref: outroRef },
                ] as const
              ).map(({ end, label, ref }) => {
                const clip = draft[end];
                return (
                  <Row key={end} label={label}>
                    <input
                      ref={ref}
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm"
                      className="hidden"
                      onChange={(e) => pickClip(end, e.target.files?.[0])}
                    />
                    {clip ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink">
                          <Icon.video width={15} height={15} className="flex-none text-muted" />
                          <span className="mono">{(clip.ms / 1000).toFixed(1)} sn</span>
                        </span>
                        <span className="flex flex-none items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => ref.current?.click()}
                            className="text-[13px] font-medium text-signal"
                          >
                            Değiştir
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSaved(false);
                              setDraft((d) => (d ? { ...d, [end]: null } : d));
                            }}
                            className="text-[13px] font-medium text-muted transition hover:text-ink"
                          >
                            Kaldır
                          </button>
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => ref.current?.click()}
                        disabled={uploading !== null}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-hairline py-2.5 text-[13px] font-medium text-slate transition hover:border-slate hover:text-ink disabled:opacity-45"
                      >
                        {uploading === end ? (
                          <>
                            <Spinner size={14} /> Yükleniyor…
                          </>
                        ) : (
                          <>
                            <Icon.plus width={14} height={14} /> Video yükle
                          </>
                        )}
                      </button>
                    )}
                  </Row>
                );
              })}
            </section>

            {(uploadError || clipError) && (
              <p role="alert" className="text-[12.5px] text-red-600">
                {uploadError ?? clipError}
              </p>
            )}
          </div>

          <aside className="lg:sticky lg:top-6">
            <div className="mb-2.5 flex gap-1 rounded-full border border-hairline p-1">
              {MODES.map((m) => (
                <button
                  key={m.v}
                  type="button"
                  onClick={() => setMode(m.v)}
                  aria-pressed={mode === m.v}
                  className={`flex-1 rounded-full py-1.5 text-[12px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                    mode === m.v ? "bg-ink text-paper" : "text-slate hover:text-ink"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <BrandPreview
              mode={mode}
              color={draft.color}
              font={draft.font}
              brandName={draft.brandName}
              handle={draft.handle}
              outroCta={draft.outroCta}
              logoUrl={draft.logoUrl}
              clipUrl={mode === "intro" ? draft.introClip?.url ?? null : mode === "outro" ? draft.outroClip?.url ?? null : null}
            />
            <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
              Yazı rengi marka rengine göre seçilir, her zaman okunur kalır.
            </p>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
