"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { type Avatar, type Voice } from "@/components/wizard/types";
import { DEFAULT_PRESET, presetById } from "@/lib/captionStyles";
import { type ComposerSettings, DEFAULT_SETTINGS } from "@/lib/composerSettings";
import { type Media, PENDING_KEY } from "@/lib/composer/media";
import { TR_GRADIENT, TR_GRADIENT_SOFT, TRANSITION_LABELS } from "@/lib/composer/transitions";
import { useUploadBackground, useUploadBackgroundVideo } from "@/lib/queries";
import { videoPoster } from "@/lib/videoPoster";
import { DEFAULT_TRANSITION } from "./WizardSteps";
import { AvatarPicker } from "./composer/AvatarPicker";
import { CaptionPicker } from "./composer/CaptionPicker";
import { EffectPicker } from "./composer/EffectPicker";
import { Spinner } from "./composer/Spinner";
import { VoicePicker } from "./composer/VoicePicker";
import { Icon } from "./icons";

/** Upload-first hero composer: accepts multiple images + videos, uploads each to
 *  storage (with per-tile progress), and carries the uploaded refs into /create. */
export function MediaComposer({ extraSettings }: { extraSettings?: ComposerSettings }) {
  const router = useRouter();
  const uploadImg = useUploadBackground();
  const uploadVid = useUploadBackgroundVideo();
  const [items, setItems] = useState<Media[]>([]);
  const [drag, setDrag] = useState(false);
  const [effectOpen, setEffectOpen] = useState(false);
  const [activeBoundary, setActiveBoundary] = useState<string | null>(null); // media url whose incoming transition is being edited
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [captionId, setCaptionId] = useState(DEFAULT_PRESET.id);
  const [script, setScript] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedCaption = presetById(captionId);

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
        if (m.kind === "video") videoPoster(m.file).then((p) => p && patch(m.url, { poster: p }));
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

  const uploading = items.some((i) => i.status === "uploading");
  const hasScript = script.trim().length > 0; // controls stay visible but disabled until written
  const pick = () => inputRef.current?.click();

  function create() {
    const ready = items.filter((i) => i.status === "done" && i.ref);
    const preset = presetById(captionId);
    const payload = {
      // Each clip carries its own incoming transition; the first clip's is unused.
      media: ready.map((i, idx) => ({ ref: i.ref, url: i.serverUrl, kind: i.kind, transition: idx === 0 ? DEFAULT_TRANSITION : i.transition ?? DEFAULT_TRANSITION })),
      script: script.trim() || undefined,
      avatar: selectedAvatar ? { id: selectedAvatar.id, name: selectedAvatar.name } : undefined,
      voice: selectedVoice ? { id: selectedVoice.id } : undefined,
      caption: { style: preset.base, font: preset.font, color: preset.color },
      settings: extraSettings ?? DEFAULT_SETTINGS,
    };
    try {
      if (payload.media.length || payload.script || payload.avatar) sessionStorage.setItem(PENDING_KEY, JSON.stringify(payload));
      else sessionStorage.removeItem(PENDING_KEY);
    } catch { }
    router.push("/create");
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
      {items.length === 0 ? (
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
          {/* avatar mini-preview chip */}
          <button
            type="button"
            onClick={() => setAvatarOpen(true)}
            disabled={!hasScript}
            title={!hasScript ? "Önce konuşma metnini yaz" : undefined}
            className="flex items-center gap-2 rounded-full border border-hairline bg-paper py-1 pl-1 pr-3 text-[13px] font-medium text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="flex h-7 w-7 flex-none items-center justify-center overflow-hidden rounded-full bg-mist text-muted">
              {selectedAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedAvatar.imageUrl} alt={selectedAvatar.name} className="h-full w-full object-cover" />
              ) : (
                <Icon.users width={15} height={15} />
              )}
            </span>
            {selectedAvatar ? selectedAvatar.name : "Avatar seç"}
            <Icon.chevronDown width={14} height={14} className="text-muted" />
          </button>
          {/* voice mini chip */}
          <button
            type="button"
            onClick={() => setVoiceOpen(true)}
            disabled={!hasScript}
            title={!hasScript ? "Önce konuşma metnini yaz" : undefined}
            className="flex items-center gap-2 rounded-full border border-hairline bg-paper py-1 pl-1 pr-3 text-[13px] font-medium text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-mist text-slate">
              <Icon.voice width={15} height={15} />
            </span>
            {selectedVoice ? selectedVoice.label : "Ses seç"}
            <Icon.chevronDown width={14} height={14} className="text-muted" />
          </button>
          {/* caption style chip */}
          <button
            type="button"
            onClick={() => setCaptionOpen(true)}
            disabled={!hasScript}
            title={!hasScript ? "Önce konuşma metnini yaz" : undefined}
            className="flex items-center gap-2 rounded-full border border-hairline bg-paper py-1 pl-1 pr-3 text-[13px] font-medium text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="grid h-7 w-11 flex-none place-items-center overflow-hidden rounded-full bg-black">
              <span style={{ color: selectedCaption.color, fontFamily: `"${selectedCaption.font}", sans-serif`, fontWeight: 800, fontSize: 12, lineHeight: 1 }}>Aa</span>
            </span>
            {selectedCaption.family}
            <Icon.chevronDown width={14} height={14} className="text-muted" />
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
          disabled={uploading || !hasScript}
          title={!hasScript ? "Önce konuşma metnini yaz" : undefined}
          className="btn btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto sm:w-auto"
        >
          {uploading ? <Spinner size={16} /> : <Icon.arrowRight width={17} height={17} className="order-2" />}
          <span className="order-1">Video oluştur</span>
        </button>
      </div>

      <EffectPicker
        open={effectOpen && multiple}
        onClose={() => setEffectOpen(false)}
        value={activeTransition}
        onSelect={(v) => { if (activeBoundary) patch(activeBoundary, { transition: v }); }}
        boundaryLabel={boundaryIndex >= 0 ? `${boundaryIndex}. ve ${boundaryIndex + 1}. klip arası` : undefined}
      />
      <AvatarPicker open={avatarOpen} onClose={() => setAvatarOpen(false)} selectedId={selectedAvatar?.id ?? null} onSelect={setSelectedAvatar} />
      <VoicePicker open={voiceOpen} onClose={() => setVoiceOpen(false)} selectedId={selectedVoice?.id ?? null} onSelect={setSelectedVoice} script={script} />
      <CaptionPicker open={captionOpen} onClose={() => setCaptionOpen(false)} selectedId={captionId} onSelect={setCaptionId} script={script} />
    </div>
  );
}
