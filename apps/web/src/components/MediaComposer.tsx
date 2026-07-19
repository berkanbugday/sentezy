"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { type Avatar, type Voice } from "@/components/wizard/types";
import { apiFetch } from "@/lib/api";
import { presetById } from "@/lib/captionStyles";
import { type ComposerSettings, DEFAULT_SETTINGS } from "@/lib/composerSettings";
import { type Media } from "@/lib/composer/media";
import { TR_GRADIENT, TR_GRADIENT_SOFT, TRANSITION_LABELS } from "@/lib/composer/transitions";
import { type ImportProductResult, type MusicTrack, useCreateAvatar, useGenerateVideo, useImportProduct, useMyAvatars, useUploadBackground, useUploadBackgroundVideo } from "@/lib/queries";
import { videoPoster } from "@/lib/videoPoster";
import { cleanTitleText } from "@/lib/videoTitle";
import { DEFAULT_TRANSITION } from "./WizardSteps";
import { ActionMenu } from "./composer/ActionMenu";
import { AvatarPicker } from "./composer/AvatarPicker";
import { CaptionPicker } from "./composer/CaptionPicker";
import { EffectPicker } from "./composer/EffectPicker";
import { MusicPicker } from "./composer/MusicPicker";
import { PreviewModal } from "./composer/PreviewModal";
import { SettingsModal } from "./composer/SettingsModal";
import { Spinner } from "./composer/Spinner";
import { VoicePicker } from "./composer/VoicePicker";
import { Icon } from "./icons";

/**
 * The title stored for a new video. Prefers the imported product's NAME; otherwise the
 * script's first sentence trimmed at a word boundary (via the shared `cleanTitleText`, never
 * a mid-word cut). Display uses the same helpers so old rows read cleanly too.
 */
function deriveVideoTitle(script: string, productTitle?: string): string {
  const fromProduct = productTitle?.trim();
  if (fromProduct) return fromProduct;
  return cleanTitleText(script) || "Yeni video";
}

export type ComposerSeed = {
  key: string; // the source video id — changing it re-seeds
  selectedAvatar: Avatar | null;
  selectedVoice: Voice | null;
  selectedMusic: MusicTrack | null;
  musicVolume: number;
  /** null = no caption style selected (opt-in captions). */
  captionId: string | null;
};

/** Upload-first hero composer: accepts multiple images + videos, uploads each to
 *  storage (with per-tile progress), then builds a draft and queues it for render. */
export function MediaComposer({
  extraSettings,
  onSettingsChange,
  seed,
}: {
  extraSettings?: ComposerSettings;
  /** Persists changes made in the settings modal. If absent, the modal still opens but
   *  simply doesn't persist changes. */
  onSettingsChange?: (s: ComposerSettings) => void;
  /** "Yeniden kullan" seed: hydrates avatar/voice/music/caption once per source video. */
  seed?: ComposerSeed;
}) {
  const router = useRouter();
  const uploadImg = useUploadBackground();
  const uploadVid = useUploadBackgroundVideo();
  const createAvatar = useCreateAvatar();
  const generate = useGenerateVideo();
  const importProduct = useImportProduct();
  const myAvatars = useMyAvatars().data ?? [];
  const [mode, setMode] = useState<"link" | "upload">("link"); // paste a product link, or upload media
  const [importUrl, setImportUrl] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [product, setProduct] = useState<ImportProductResult["product"] | null>(null);
  const [items, setItems] = useState<Media[]>([]);
  const [drag, setDrag] = useState(false);
  const [effectOpen, setEffectOpen] = useState(false);
  const [activeBoundary, setActiveBoundary] = useState<string | null>(null); // media url whose incoming transition is being edited
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [musicOpen, setMusicOpen] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.15); // UI cap 0.4 — the bed never buries the voice
  const [captionOpen, setCaptionOpen] = useState(false);
  // Captions are opt-in: no default preset pre-selected — the user must choose a style.
  const [captionId, setCaptionId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [script, setScript] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedCaption = captionId ? presetById(captionId) : null;
  const settings = extraSettings ?? DEFAULT_SETTINGS;

  // "Yeniden kullan" seeding. Applied once per source video: the user may change any of
  // these straight after, and a re-render must not undo that. Script and media stay empty
  // by design — this reuses the look, not the content.
  const seededRef = useRef<string | null>(null);
  useEffect(() => {
    if (!seed || seededRef.current === seed.key) return;
    seededRef.current = seed.key;
    setSelectedAvatar(seed.selectedAvatar);
    setSelectedVoice(seed.selectedVoice);
    setSelectedMusic(seed.selectedMusic);
    setMusicVolume(seed.musicVolume);
    setCaptionId(seed.captionId);
    setMode("upload");
  }, [seed]);

  // The transition effect only applies between 2+ media — close/hide otherwise.
  const multiple = items.length > 1;
  useEffect(() => {
    if (!multiple) setEffectOpen(false);
  }, [multiple]);
  // The boundary currently being edited (its incoming transition), for the effect modal.
  const activeTransition = items.find((x) => x.url === activeBoundary)?.transition ?? DEFAULT_TRANSITION;
  const boundaryIndex = activeBoundary ? items.findIndex((x) => x.url === activeBoundary) : -1;

  // Revoke object URLs on unmount (ref keeps the latest list for the cleanup).
  const itemsRef = useRef<Media[]>([]);
  itemsRef.current = items;
  useEffect(
    () => () =>
      itemsRef.current.forEach((m) => {
        URL.revokeObjectURL(m.url);
        if (m.poster) URL.revokeObjectURL(m.poster);
      }),
    [],
  );

  const patch = (url: string, next: Partial<Media>) => setItems((prev) => prev.map((x) => (x.url === url ? { ...x, ...next } : x)));

  async function uploadOne(m: Media) {
    if (!m.file) return; // imported items are already in R2 (no local file to upload)
    try {
      if (m.kind === "image") {
        const { id, url } = await uploadImg.mutateAsync(m.file);
        patch(m.url, { status: "done", ref: id, serverUrl: url });
      } else {
        const { key, url } = await uploadVid.mutateAsync(m.file);
        patch(m.url, { status: "done", ref: key, serverUrl: url });
      }
    } catch {
      patch(m.url, { status: "error" });
    }
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next: Media[] = [];
    for (const f of Array.from(files)) {
      const kind = f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : null;
      if (kind) next.push({ url: URL.createObjectURL(f), name: f.name, kind, file: f, status: "uploading", transition: "whip" });
    }
    if (next.length) {
      setItems((prev) => [...prev, ...next]);
      next.forEach((m) => {
        void uploadOne(m);
        if (m.kind === "video" && m.file) videoPoster(m.file).then((p) => p && patch(m.url, { poster: p }));
      });
    }
    if (inputRef.current) inputRef.current.value = ""; // allow re-picking the same file
  }

  function remove(url: string) {
    const m = itemsRef.current.find((x) => x.url === url);
    URL.revokeObjectURL(url);
    if (m?.poster) URL.revokeObjectURL(m.poster);
    setItems((prev) => prev.filter((x) => x.url !== url));
  }

  function retry(m: Media) {
    patch(m.url, { status: "uploading" });
    void uploadOne({ ...m, status: "uploading" });
  }

  // Pre-fill the composer from a scraped product: media (already in R2) as B-roll + the AI
  // promo script. Avatar and voice are left for the user to choose (not auto-selected).
  function applyImport(result: ImportProductResult) {
    setProduct(result.product);
    setItems(
      result.media.map((m, idx) => ({
        url: m.url,
        serverUrl: m.url,
        ref: m.ref,
        kind: m.kind,
        name: result.product.title || `Ürün görseli ${idx + 1}`,
        status: "done" as const,
        transition: "slide", // product slides use the shutter-modern slide (BROLL_SFX_MAP.slide)
      })),
    );
    setScript(result.script);
  }

  async function handleImport() {
    const url = importUrl.trim();
    if (!url || importProduct.isPending) return;
    setImportError(null);
    try {
      const result = await importProduct.mutateAsync(url);
      applyImport(result);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      const messages: Record<string, string> = {
        invalid_url: "Geçerli bir ürün bağlantısı gir.",
        scrape_failed: "Sayfa okunamadı, bağlantıyı kontrol et.",
        no_product_found: "Bu bağlantıda ürün bulunamadı.",
        no_media_found: "Bu üründe kullanılabilir görsel bulunamadı.",
      };
      setImportError(messages[code] ?? "Ürün alınamadı, lütfen tekrar dene.");
    }
  }

  const uploading = items.some((i) => i.status === "uploading");
  const hasScript = script.trim().length > 0; // controls stay visible but disabled until written
  const hasMedia = items.some((i) => i.status === "done" && i.ref);
  // Generation needs voice + script and SOMETHING to show: either an avatar (talking head) OR
  // B-roll media (a faceless video). Avatar is optional — gate the button and point at what's missing.
  const canCreate = hasScript && !!selectedVoice && (!!selectedAvatar || hasMedia);
  const createHint = !hasScript
    ? "Önce konuşma metnini yaz"
    : !selectedVoice
      ? "Bir ses seç"
      : !selectedAvatar && !hasMedia
        ? "Avatar seç ya da görsel yükle (yüzsüz video)"
        : undefined;
  // Compact summary of what's currently picked, e.g. "Beyza · Damla - Energetic Content creator ·
  // Fırtınadan Sonra · Vurgu" — only selected pickers contribute (captions are opt-in, so this
  // omits them entirely rather than showing placeholder text when none is chosen).
  const selectionSummary = [selectedAvatar?.name, selectedVoice?.label, selectedMusic?.name, selectedCaption?.family]
    .filter((v): v is string => !!v)
    .join(" · ");
  const pick = () => inputRef.current?.click();

  function openPreview() {
    setPreviewOpen(true);
  }

  // Build the draft straight from the composer state, debit + queue it, then send
  // the user to the library to watch it render. (Replaces the old /create wizard.)
  async function create() {
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const ready = items.filter((i) => i.status === "done" && i.ref);
      const preset = captionId ? presetById(captionId) : null;

      // A chosen catalog avatar becomes a user avatar record — reuse one for the same portrait, else create it.
      let avatarId: string | null = null;
      if (selectedAvatar?.id && selectedAvatar.ready) {
        const existing = myAvatars.find((a) => a.sourceImageId === selectedAvatar.id);
        avatarId = existing?.id ?? (await createAvatar.mutateAsync({ name: selectedAvatar.name, sourceImageId: selectedAvatar.id })).avatar.id;
      }

      // A shared-library voice id is "owner|voice" — adopt it into the account to get the
      // real DB voice uuid the API/render pipeline references (it rejects the composite id).
      let voiceId: string | null = null;
      if (selectedVoice?.id) {
        const adopted = await apiFetch<{ id: string }>("/voices/adopt", { method: "POST", body: JSON.stringify({ id: selectedVoice.id, name: selectedVoice.label }) });
        voiceId = adopted.id;
      }

      // Ordered B-roll: each ref is an R2 key (image or video); first clip's transition is unused.
      const media = ready.map((i, idx) => ({
        kind: i.kind,
        ref: i.ref as string,
        transition: idx === 0 ? DEFAULT_TRANSITION : i.transition ?? DEFAULT_TRANSITION,
      }));

      const scriptText = script.trim();

      const options = {
        // Captions are opt-in: only write a style/font/color when the user actually chose one.
        captions: preset ? { enabled: true, style: preset.base, font: preset.font, color: preset.color } : { enabled: false },
        background: media.length
          ? {
              type: "image" as const,
              value: media[0].ref,
              images: media.filter((m) => m.kind === "image").map((m) => m.ref),
              transitions: media.map((m) => m.transition),
              media,
            }
          : { type: "color" as const, value: "#0B0B0D" },
        ...(selectedMusic ? { music: { trackKey: selectedMusic.key, volume: musicVolume } } : {}),
        layout: { avatarPosition: settings.avatarPosition, captionPosition: settings.captionPosition },
        voice: { emotion: settings.voiceEmotion ?? "" },
        effects: { transitionSfx: settings.transitionSfx ?? true },
        ...(product ? { product } : {}), // provenance when seeded from a product link
      };

      const text = scriptText;
      const title = deriveVideoTitle(text, product?.title);
      const { video: draft } = await apiFetch<{ video: { id: string } }>("/videos/draft", {
        method: "POST",
        body: JSON.stringify({ title, script: text }),
      });
      await apiFetch(`/videos/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          script: text,
          avatarId,
          voiceId,
          options,
        }),
      });
      await generate.mutateAsync(draft.id);
      router.push("/library");
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      const messages: Record<string, string> = {
        insufficient_credits: "Yeterli krediniz yok.",
        incomplete_draft: "Avatar, ses ve konuşma metni gerekli.",
        adopt_failed: "Ses seçilemedi, lütfen tekrar dene.",
        tts_unavailable: "Ses servisi şu an kullanılamıyor.",
        invalid_body: "Geçersiz istek, seçimlerini kontrol et.",
      };
      setSubmitError(messages[code] ?? "Video oluşturulamadı, lütfen tekrar dene.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`mt-7 rounded-[22px] border bg-paper p-3.5 shadow-sm transition ${drag ? "border-ink ring-2 ring-ink/10" : "border-hairline"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      {/* mode tabs — paste a product link, or upload your own media (hidden once media exists) */}
      {items.length === 0 && (
        <div className="mb-3 inline-flex rounded-full border border-hairline bg-mist/50 p-0.5 text-[13px] font-medium">
          {(["link", "upload"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setImportError(null); }}
              className={`rounded-full px-3.5 py-1.5 transition ${mode === m ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-slate"}`}
            >
              {m === "link" ? "Ürün linki" : "Medya yükle"}
            </button>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        mode === "link" ? (
          <div className="flex flex-col gap-3.5 rounded-[16px] border border-dashed border-hairline px-6 py-12">
            <div className="text-center">
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-mist text-slate">
                <Icon.paperclip width={22} height={22} />
              </span>
              <p className="text-[14.5px] font-medium text-ink">Ürün bağlantısını yapıştır</p>
              <p className="mx-auto mt-0.5 max-w-xs text-[12.5px] text-muted">Fotoğrafları, videoları ve tanıtım metnini senin için hazırlayalım.</p>
            </div>
            <div className="mx-auto flex w-full max-w-lg flex-col gap-2 sm:flex-row">
              <input
                type="url"
                inputMode="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleImport(); }}
                placeholder="https://…"
                className="min-w-0 flex-1 rounded-xl border border-hairline bg-paper px-3.5 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-muted focus:border-ink"
              />
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={!importUrl.trim() || importProduct.isPending}
                className="btn btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importProduct.isPending ? <Spinner size={16} /> : <Icon.arrowRight width={17} height={17} className="order-2" />}
                <span className="order-1">{importProduct.isPending ? "Getiriliyor…" : "Getir"}</span>
              </button>
            </div>
            {importError && <p className="text-center text-[13px] text-red-500">{importError}</p>}
          </div>
        ) : (
        <button
          type="button"
          onClick={pick}
          className={`flex w-full flex-col items-center justify-center gap-4 rounded-[16px] border border-dashed px-6 py-16 text-center transition ${drag ? "border-ink bg-mist" : "border-hairline hover:bg-mist/60"
            }`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mist text-slate">
            <Icon.plus width={24} height={24} />
          </span>
          <div>
            <p className="text-[14.5px] font-medium text-ink">Videolarını ya da görsellerini sürükle</p>
            <p className="mt-0.5 text-[12.5px] text-muted">(.mp4, .mov, .jpg, .png — birden fazla seçebilirsin)</p>
          </div>
        </button>
        )
      ) : (
        <div className="no-scrollbar flex flex-nowrap items-center overflow-x-auto pb-1">
          {items.map((m, i) => (
            <Fragment key={m.url}>
              {/* transition connector between two clips — a gradient line with this gap's effect node */}
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => { setActiveBoundary(m.url); setEffectOpen(true); }}
                  title={`Geçiş: ${TRANSITION_LABELS[m.transition ?? DEFAULT_TRANSITION] ?? ""}`}
                  aria-label="Geçiş efekti seç"
                  className="group/tr flex flex-none flex-col items-center gap-1 px-0.5"
                >
                  <span className="flex items-center">
                    <span className="h-0.5 w-3 rounded-full" style={{ background: TR_GRADIENT }} />
                    <span className="mx-0.5 grid h-7 w-7 place-items-center rounded-full border border-hairline text-slate transition group-hover/tr:text-ink" style={{ background: TR_GRADIENT_SOFT }}>
                      <Icon.wand width={13} height={13} />
                    </span>
                    <span className="h-0.5 w-3 rounded-full" style={{ background: TR_GRADIENT }} />
                  </span>
                  <span className="max-w-[60px] truncate text-[9px] font-medium leading-none text-muted group-hover/tr:text-slate">
                    {TRANSITION_LABELS[m.transition ?? DEFAULT_TRANSITION] ?? ""}
                  </span>
                </button>
              )}
              <div className="group relative h-[68px] w-[68px] flex-none overflow-hidden rounded-xl border border-hairline bg-mist">
              {m.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
              ) : (
                <>
                  {m.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.poster} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-mist text-muted">
                      <Icon.video width={22} height={22} />
                    </div>
                  )}
                  <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white">
                    <Icon.video width={10} height={10} />
                    video
                  </span>
                </>
              )}

              {/* upload state overlays */}
              {m.status === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
                  <Spinner />
                </div>
              )}
              {m.status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 text-white">
                  <span className="text-[9.5px] font-medium">Yüklenemedi</span>
                  <button type="button" onClick={() => retry(m)} className="rounded-full bg-white/20 px-2 py-0.5 text-[9.5px] font-semibold hover:bg-white/30">
                    Tekrar
                  </button>
                </div>
              )}
              {m.status === "done" && (
                <span className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-paper shadow">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                </span>
              )}

              <button
                type="button"
                onClick={() => remove(m.url)}
                aria-label={`${m.name} kaldır`}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white opacity-100 transition hover:bg-black/75 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Icon.close width={12} height={12} className="block" />
              </button>
              </div>
            </Fragment>
          ))}
          <button
            type="button"
            onClick={pick}
            className="ml-2 flex h-[68px] w-[68px] flex-none flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-hairline text-muted transition hover:bg-mist hover:text-slate"
          >
            <Icon.plus width={20} height={20} />
            <span className="text-[10px] font-medium">Ekle</span>
          </button>
        </div>
      )}

      <input ref={inputRef} type="file" accept="video/*,image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

      {/* speech / script text — softly appears once media is uploaded */}
      {items.length > 0 && (
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={3}
          placeholder="Videoda ne anlatılsın? Konuşma metnini yaz…"
          className="no-scrollbar soft-in mt-3 max-h-40 min-h-[84px] w-full resize-none overflow-y-auto rounded-xl bg-transparent px-1 py-1 text-[14px] leading-relaxed text-ink outline-none placeholder:text-muted"
        />
      )}

      {/* controls always visible, disabled until there's speech text to work with */}
      <div className="mt-3 flex flex-col gap-2.5 px-1 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {/* avatar / voice / music / caption pickers, grouped behind one menu */}
          <ActionMenu
            label="Video seçenekleri"
            disabled={!hasScript}
            title={!hasScript ? "Önce konuşma metnini yaz" : undefined}
            icon={Icon.plus}
            items={[
              {
                key: "avatar",
                label: "Avatar",
                icon: Icon.users,
                value: selectedAvatar ? selectedAvatar.name : "isteğe bağlı",
                onClick: () => setAvatarOpen(true),
              },
              {
                key: "voice",
                label: "Ses",
                icon: Icon.voice,
                value: selectedVoice ? selectedVoice.label : "seçilmedi",
                onClick: () => setVoiceOpen(true),
              },
              {
                key: "music",
                label: "Müzik",
                icon: Icon.musicNote,
                value: selectedMusic ? selectedMusic.name : "seçilmedi",
                onClick: () => setMusicOpen(true),
              },
              {
                key: "caption",
                label: "Alt yazı",
                icon: Icon.captions,
                value: selectedCaption ? selectedCaption.family : "seçilmedi",
                onClick: () => setCaptionOpen(true),
              },
            ]}
          />
          {/* extra settings (avatar/caption position, voice tone, transition SFX) */}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Ek ayarlar"
            title="Ek ayarlar"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-paper text-ink transition hover:bg-mist"
          >
            <Icon.settings width={17} height={17} />
          </button>
          {/* live preview */}
          <button
            type="button"
            onClick={openPreview}
            disabled={!hasScript}
            title={!hasScript ? "Önce konuşma metnini yaz" : "Reklamı önizle"}
            className="flex items-center gap-2 rounded-full border border-hairline bg-paper py-1 pl-2.5 pr-3 text-[13px] font-medium text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Icon.play width={14} height={14} className="text-slate" />
            Önizle
          </button>
          {items.length > 0 && (
            <span className="flex items-center gap-1.5 whitespace-nowrap text-[12px] text-muted">
              {uploading && <Spinner size={13} />}
              {uploading ? "yükleniyor…" : `${items.length} medya hazır`}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={create}
          disabled={uploading || submitting || !canCreate}
          title={createHint}
          className="btn btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto sm:w-auto"
        >
          {uploading || submitting ? <Spinner size={16} /> : <Icon.arrowRight width={17} height={17} className="order-2" />}
          <span className="order-1">{submitting ? "Oluşturuluyor…" : "Video oluştur"}</span>
        </button>
      </div>
      {selectionSummary && <p className="mt-1 truncate px-1 text-[12px] text-muted">{selectionSummary}</p>}
      {submitError && <p className="mt-2 px-1 text-[13px] text-red-500">{submitError}</p>}

      <EffectPicker
        open={effectOpen && multiple}
        onClose={() => setEffectOpen(false)}
        value={activeTransition}
        onSelect={(v) => { if (activeBoundary) patch(activeBoundary, { transition: v }); }}
        boundaryLabel={boundaryIndex >= 0 ? `${boundaryIndex}. ve ${boundaryIndex + 1}. klip arası` : undefined}
      />
      <AvatarPicker open={avatarOpen} onClose={() => setAvatarOpen(false)} selectedId={selectedAvatar?.id ?? null} onSelect={setSelectedAvatar} />
      <VoicePicker open={voiceOpen} onClose={() => setVoiceOpen(false)} selectedId={selectedVoice?.id ?? null} onSelect={setSelectedVoice} script={script} emotion={settings.voiceEmotion ?? ""} />
      <MusicPicker
        open={musicOpen}
        onClose={() => setMusicOpen(false)}
        selectedKey={selectedMusic?.key ?? null}
        onSelect={setSelectedMusic}
        volume={musicVolume}
        onVolumeChange={setMusicVolume}
      />
      <CaptionPicker open={captionOpen} onClose={() => setCaptionOpen(false)} selectedId={captionId} onSelect={setCaptionId} />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={(s) => onSettingsChange?.(s)}
        mediaCount={items.length}
      />
      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        script={script}
        captionStyle={selectedCaption ? { styleId: selectedCaption.base, font: selectedCaption.font, color: selectedCaption.color } : null}
        layout={{ avatarPosition: settings.avatarPosition, captionPosition: settings.captionPosition }}
        avatarImageUrl={selectedAvatar?.imageUrl ?? null}
        broll={items.map((i, idx) => ({
          url: i.serverUrl ?? i.url,
          kind: i.kind,
          transition: idx === 0 ? DEFAULT_TRANSITION : i.transition ?? DEFAULT_TRANSITION,
        }))}
        transitionSfx={settings.transitionSfx}
        musicUrl={selectedMusic?.previewUrl ?? null}
        musicVolume={musicVolume}
      />
    </div>
  );
}
