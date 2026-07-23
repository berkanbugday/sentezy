"use client";

import { useEffect, useRef, useState } from "react";
import { type BrandCrop, CARD_INTRO_SECONDS, CARD_OUTRO_SECONDS, DEFAULT_CROP } from "@sentezy/remotion";
import { BrandPreview, type PreviewMode } from "@/components/brand/BrandPreview";
import { FontSelect } from "@/components/brand/FontSelect";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/composer/Spinner";
import { CAPTION_FONTS } from "@/lib/captionStyles";
import { clipErrorMessage, readMediaDuration } from "@/lib/videoDuration";
import { type BrandDraft as Draft, brandFingerprint, toBrandDraft } from "@/lib/brandDraft";
import { useBrandKit, useUpdateBrandKit, useUploadBrandAsset } from "@/lib/queries";

/** Six visibly distinct starting points — two neutrals and four hues. Deliberately not a
 *  full spectrum: near-identical darks read as a rendering fault, and the custom picker
 *  covers everything else. */
const SWATCHES = ["#0A0A0B", "#52525B", "#FF5A1F", "#2563EB", "#059669", "#7C3AED"];

const MODES: { v: PreviewMode; label: string }[] = [
  { v: "intro", label: "Intro" },
  { v: "outro", label: "Outro" },
  { v: "watermark", label: "Filigran" },
];

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
    setDraft(toBrandDraft(kitQ.data));
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
      setUploadError("That logo would not upload. Try again, or use a PNG under 5 MB.");
    }
  };

  /** Measure BEFORE uploading: a file whose length we cannot read is unusable, and
   *  rejecting it here avoids putting an orphan object in storage. An image has no
   *  intrinsic length, so it holds for exactly as long as the generated card would have. */
  const pickClip = async (end: "introClip" | "outroClip", file: File | undefined) => {
    if (!file) return;
    setClipError(null);
    const imageMs = (end === "introClip" ? CARD_INTRO_SECONDS : CARD_OUTRO_SECONDS) * 1000;
    const measured = await readMediaDuration(file, imageMs);
    if (!measured.ok) {
      setClipError(clipErrorMessage(measured.reason));
      return;
    }
    setUploading(end);
    try {
      const { key, url } = await upload.mutateAsync({ file, kind: "clip" });
      setSaved(false);
      setDraft((d) => (d ? { ...d, [end]: { key, ms: measured.ms, url, crop: DEFAULT_CROP } } : d));
    } catch {
      setClipError("That file would not upload. Try again, or use a shorter clip.");
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
      introClipCrop: draft.introClip?.crop ?? null,
      outroClipKey: draft.outroClip?.key ?? null,
      outroClipMs: draft.outroClip?.ms ?? null,
      outroClipCrop: draft.outroClip?.crop ?? null,
    });
    setSaved(true);
  };

  // The upload the preview is currently showing, if any. Cropping applies to THAT end —
  // the watermark mode has no upload, so it is never croppable.
  const activeEnd = mode === "intro" ? "introClip" : mode === "outro" ? "outroClip" : null;
  const activeClip = activeEnd ? draft?.[activeEnd] ?? null : null;
  const setCrop = (crop: BrandCrop) => {
    if (!activeEnd) return;
    setSaved(false);
    setDraft((d) => (d && d[activeEnd] ? { ...d, [activeEnd]: { ...d[activeEnd]!, crop } } : d));
  };

  const dirty = Boolean(draft && kitQ.data && brandFingerprint(draft) !== brandFingerprint(toBrandDraft(kitQ.data)));

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="disp text-[28px] font-semibold text-ink">Brand kit</h1>
          <p className="mt-1 text-[14.5px] text-slate">
            Set this up once and every video can open, close and sign off as your brand.
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
          <span className="sr-only">Loading…</span>
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
          <p className="text-[14px] text-muted">Your brand kit could not be loaded. Refresh the page.</p>
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
                    aria-label={draft.logoUrl ? "Replace logo" : "Upload logo"}
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
                      Remove
                    </button>
                  )}
                </div>
              </Row>

              <Row label="Brand name">
                <input
                  value={draft.brandName}
                  onChange={(e) => set("brandName", e.target.value)}
                  maxLength={60}
                  placeholder="Sentezy"
                  className={INPUT}
                  aria-label="Brand name"
                />
              </Row>

              <Row label="Handle">
                <input
                  value={draft.handle}
                  onChange={(e) => set("handle", e.target.value)}
                  maxLength={40}
                  placeholder="@sentezy"
                  className={INPUT}
                  aria-label="Handle"
                />
              </Row>

              <Row label="Closing line" hint="The button on the last card">
                <input
                  value={draft.outroCta}
                  onChange={(e) => set("outroCta", e.target.value)}
                  maxLength={40}
                  placeholder="Hemen dene"
                  className={INPUT}
                  aria-label="Closing line"
                />
              </Row>
            </section>

            <section className="card px-5 py-1">
              <Row label="Colour" hint="Background of the intro and outro">
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
                    title="Custom colour"
                  >
                    <Icon.plus width={13} height={13} />
                    <input
                      type="color"
                      value={draft.color}
                      onChange={(e) => set("color", e.target.value)}
                      className="sr-only"
                      aria-label="Custom colour"
                    />
                  </label>
                </div>
              </Row>

              <Row label="Font">
                <FontSelect value={draft.font} options={CAPTION_FONTS} onChange={(f) => set("font", f)} />
              </Row>
            </section>

            <section className="card px-5 py-1">
              <div className="border-b border-hairline pb-3 pt-4">
                <div className="text-[13.5px] font-medium text-ink">Use your own image or clip</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                  Upload something and it replaces that card entirely. It is scaled to fill a
                  9:16 frame and the overflow is cropped, so keep anything important near the
                  middle. A photo stays on screen for the length of the card.
                </p>
              </div>
              {(
                [
                  { end: "introClip", label: "Intro", ref: introRef },
                  { end: "outroClip", label: "Outro", ref: outroRef },
                ] as const
              ).map(({ end, label, ref }) => {
                const clip = draft[end];
                return (
                  <Row key={end} label={label}>
                    <input
                      ref={ref}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm"
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
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSaved(false);
                              setDraft((d) => (d ? { ...d, [end]: null } : d));
                            }}
                            className="text-[13px] font-medium text-muted transition hover:text-ink"
                          >
                            Remove
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
                            <Spinner size={14} /> Uploading…
                          </>
                        ) : (
                          <>
                            <Icon.plus width={14} height={14} /> Upload an image or clip
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
              clipUrl={activeClip?.url ?? null}
              crop={activeClip?.crop ?? null}
              onCropChange={activeClip ? setCrop : undefined}
            />
            {activeClip ? (
              /* Cropping lives on the preview itself rather than in a modal — the frame is
                 already the exact 9:16 the reel uses, so dragging here IS the edit. */
              <div className="mt-2.5">
                <div className="flex items-center gap-2.5">
                  <Icon.search width={13} height={13} className="flex-none text-muted" />
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={activeClip.crop.scale}
                    onChange={(e) => setCrop({ ...activeClip.crop, scale: Number(e.target.value) })}
                    aria-label="Zoom"
                    className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-hairline accent-ink"
                  />
                  <button
                    type="button"
                    onClick={() => setCrop(DEFAULT_CROP)}
                    disabled={
                      activeClip.crop.x === DEFAULT_CROP.x &&
                      activeClip.crop.y === DEFAULT_CROP.y &&
                      activeClip.crop.scale === DEFAULT_CROP.scale
                    }
                    className="flex-none text-[12px] font-medium text-muted transition hover:text-ink disabled:opacity-35"
                  >
                    Reset
                  </button>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-muted">
                  Drag the image to choose what shows inside the 9:16 frame.
                </p>
              </div>
            ) : (
              <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
                The text colour is chosen from your brand colour, so it always stays readable.
              </p>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
