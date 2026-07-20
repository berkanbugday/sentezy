"use client";

import { useEffect, useRef, useState } from "react";
import { BrandPreview } from "@/components/brand/BrandPreview";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/composer/Spinner";
import { CAPTION_FONTS } from "@/lib/captionStyles";
import { type BrandKit, useBrandKit, useUpdateBrandKit, useUploadBrandAsset } from "@/lib/queries";

/** Monochrome-first swatches plus a few brand hues. The app chrome stays grayscale; these
 *  chips and the preview are the only coloured pixels, because the colour IS the content. */
const SWATCHES = ["#0A0A0B", "#18181B", "#52525B", "#FF5A1F", "#2563EB", "#059669", "#DC2626", "#7C3AED"];

type Draft = {
  brandName: string;
  handle: string;
  outroCta: string;
  color: string;
  font: string;
  logoKey: string | null;
  logoUrl: string | null;
};

const toDraft = (k: BrandKit): Draft => ({
  brandName: k.brandName ?? "",
  handle: k.handle ?? "",
  outroCta: k.outroCta ?? "",
  color: k.color,
  font: k.font,
  logoKey: k.logoKey,
  logoUrl: k.logoUrl,
});

const FIELD =
  "w-full rounded-xl border border-hairline bg-mist px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-muted focus:border-signal";

export function BrandKitView() {
  const kitQ = useBrandKit();
  const save = useUpdateBrandKit();
  const upload = useUploadBrandAsset();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Seed the form once the kit lands. Keyed on nothing but arrival: re-seeding on every
  // refetch would wipe edits in progress.
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
      setUploadError("Logo yüklenemedi, tekrar dene.");
    }
  };

  const onSave = async () => {
    if (!draft) return;
    // Empty text fields are stored as null, not "" — null is what "not set" means to the
    // renderer, and an empty string would render an empty line on the card.
    await save.mutateAsync({
      brandName: draft.brandName.trim() || null,
      handle: draft.handle.trim() || null,
      outroCta: draft.outroCta.trim() || null,
      color: draft.color,
      font: draft.font,
      logoKey: draft.logoKey,
    });
    setSaved(true);
  };

  const dirty = Boolean(draft && kitQ.data && JSON.stringify(draft) !== JSON.stringify(toDraft(kitQ.data)));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="disp text-[28px] font-semibold text-ink">Marka Kiti</h1>
        <p className="mt-1 text-[14.5px] text-slate">
          Logonu ve marka bilgilerini bir kez ayarla, tüm videolarında kullan.
        </p>
      </div>

      {kitQ.isLoading ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Yükleniyor…</span>
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-11 rounded-xl bg-black/5" />
              ))}
            </div>
            <div className="ph-stripe aspect-[9/16] max-h-72 rounded-[18px] border border-hairline" />
          </div>
        </div>
      ) : kitQ.isError ? (
        /* A failed request is not an empty kit — never show blank defaults as if they were
           the user's saved data, or a save would silently overwrite the real kit. */
        <div className="card p-10 text-center">
          <p className="text-[14px] text-muted">Marka kiti yüklenemedi</p>
          <button type="button" onClick={() => kitQ.refetch()} className="mt-2 text-[13px] font-medium text-signal">
            Tekrar dene
          </button>
        </div>
      ) : draft ? (
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
          {/* ── Form ── */}
          <div className="space-y-6">
            {/* Logo */}
            <section>
              <h2 className="disp mb-2 text-[15px] font-semibold text-ink">Logo</h2>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => pickLogo(e.target.files?.[0])}
              />
              {draft.logoUrl ? (
                <div className="flex items-center gap-3">
                  <div className="grid h-[68px] w-[68px] place-items-center overflow-hidden rounded-xl border border-hairline bg-mist">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={draft.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                  </div>
                  <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-ghost">
                    Değiştir
                  </button>
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
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={upload.isPending}
                  className="flex w-full flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-hairline px-6 py-10 text-center transition hover:border-slate"
                >
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-mist text-slate">
                    {upload.isPending ? <Spinner /> : <Icon.media width={22} height={22} />}
                  </span>
                  <span className="text-[14px] font-medium text-ink">
                    {upload.isPending ? "Yükleniyor…" : "Logonu yükle"}
                  </span>
                  <span className="text-[12.5px] text-muted">(.png, .jpg, .webp, .svg)</span>
                </button>
              )}
              {uploadError && <p className="mt-2 text-[12.5px] text-red-600">{uploadError}</p>}
            </section>

            {/* Text */}
            <section className="space-y-3">
              <h2 className="disp text-[15px] font-semibold text-ink">Marka bilgileri</h2>
              <div>
                <label htmlFor="bk-name" className="mb-1 block text-[13px] text-slate">
                  Marka adı
                </label>
                <input
                  id="bk-name"
                  value={draft.brandName}
                  onChange={(e) => set("brandName", e.target.value)}
                  maxLength={60}
                  placeholder="Sentezy"
                  className={FIELD}
                />
              </div>
              <div>
                <label htmlFor="bk-handle" className="mb-1 block text-[13px] text-slate">
                  Kullanıcı adı
                </label>
                <input
                  id="bk-handle"
                  value={draft.handle}
                  onChange={(e) => set("handle", e.target.value)}
                  maxLength={40}
                  placeholder="@sentezy"
                  className={FIELD}
                />
              </div>
              <div>
                <label htmlFor="bk-cta" className="mb-1 block text-[13px] text-slate">
                  Kapanış çağrısı
                </label>
                <input
                  id="bk-cta"
                  value={draft.outroCta}
                  onChange={(e) => set("outroCta", e.target.value)}
                  maxLength={40}
                  placeholder="Hemen dene"
                  className={FIELD}
                />
              </div>
            </section>

            {/* Colour */}
            <section>
              <h2 className="disp mb-2 text-[15px] font-semibold text-ink">Renk</h2>
              <div className="flex flex-wrap items-center gap-2">
                {SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => set("color", hex)}
                    aria-label={hex}
                    aria-pressed={draft.color.toUpperCase() === hex}
                    className={`h-8 w-8 rounded-full border transition ${
                      draft.color.toUpperCase() === hex ? "border-ink ring-2 ring-ink" : "border-hairline hover:border-slate"
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
                <label
                  className="flex h-8 cursor-pointer items-center gap-2 rounded-full border border-hairline px-3 text-[12.5px] text-slate transition hover:border-slate"
                  title="Özel renk"
                >
                  <span
                    className="h-4 w-4 rounded-full border border-hairline"
                    style={{ backgroundColor: draft.color }}
                  />
                  <span className="mono">{draft.color.toUpperCase()}</span>
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(e) => set("color", e.target.value)}
                    className="sr-only"
                    aria-label="Özel renk"
                  />
                </label>
              </div>
            </section>

            {/* Font */}
            <section>
              <h2 className="disp mb-2 text-[15px] font-semibold text-ink">Yazı tipi</h2>
              <div className="flex flex-wrap gap-1.5">
                {CAPTION_FONTS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => set("font", f)}
                    className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                      draft.font === f ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:border-slate"
                    }`}
                    style={{ fontFamily: `"${f}", sans-serif` }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </section>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onSave}
                disabled={!dirty || save.isPending}
                className="btn btn-primary min-w-28 disabled:opacity-40"
              >
                {save.isPending ? "Kaydediliyor…" : "Kaydet"}
              </button>
              {saved && !dirty && (
                <span role="status" className="text-[13px] text-muted">
                  Kaydedildi
                </span>
              )}
              {save.isError && <span className="text-[13px] text-red-600">Kaydedilemedi, tekrar dene.</span>}
            </div>
          </div>

          {/* ── Live preview ── */}
          <aside>
            <h2 className="disp mb-2 text-[15px] font-semibold text-ink">Önizleme</h2>
            <BrandPreview
              color={draft.color}
              font={draft.font}
              brandName={draft.brandName}
              handle={draft.handle}
              outroCta={draft.outroCta}
              logoUrl={draft.logoUrl}
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
