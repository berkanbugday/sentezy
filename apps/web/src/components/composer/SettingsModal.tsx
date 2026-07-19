"use client";

import { useEffect } from "react";
import { VOICE_EMOTIONS } from "@/components/wizard/constants";
import { Icon } from "@/components/icons";
import { type ComposerSettings } from "@/lib/composerSettings";

type Opt<T> = { value: T; label: string };

function Pills<T extends string>({ options, value, onChange }: { options: readonly Opt<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${value === o.value ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[13px] font-semibold text-ink">{label}</div>
      {children}
    </div>
  );
}

const AVATAR_POS_OPTS: Opt<ComposerSettings["avatarPosition"]>[] = [
  { value: "left", label: "Sol" },
  { value: "center", label: "Orta" },
  { value: "right", label: "Sağ" },
];
const CAPPOS_OPTS: Opt<ComposerSettings["captionPosition"]>[] = [
  { value: "top", label: "Üst" },
  { value: "bottom", label: "Alt" },
];

/** Modal of extra video settings, opened from the composer's control row. */
export function SettingsModal({
  open,
  onClose,
  settings,
  onChange,
  mediaCount = 0,
}: {
  open: boolean;
  onClose: () => void;
  settings: ComposerSettings;
  onChange: (s: ComposerSettings) => void;
  /** Uploaded clip count — transition SFX only exist between clips. */
  mediaCount?: number;
}) {
  const set = <K extends keyof ComposerSettings>(k: K, v: ComposerSettings[K]) => onChange({ ...settings, [k]: v });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // A transition sound plays AT a cut, so it needs at least two clips to sit between.
  const transitionSfxAvailable = mediaCount >= 2;

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
        <div className="sticky top-0 z-10 flex-none bg-paper px-5 pt-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
          <div className="mb-1 flex items-start justify-between gap-3">
            <h3 className="disp mt-0.5 text-[18px] font-semibold text-ink">Ek ayarlar</h3>
            <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
              <Icon.close width={18} height={18} className="block" />
            </button>
          </div>
        </div>

        <div className="no-scrollbar flex flex-col gap-5 overflow-y-auto px-5 py-5">
          <Field label="Avatar yerleşimi">
            <Pills options={AVATAR_POS_OPTS} value={settings.avatarPosition} onChange={(v) => set("avatarPosition", v)} />
          </Field>
          <Field label="Alt yazı konumu">
            <Pills options={CAPPOS_OPTS} value={settings.captionPosition} onChange={(v) => set("captionPosition", v)} />
          </Field>
          <Field label="Ses tonu">
            <Pills options={VOICE_EMOTIONS} value={settings.voiceEmotion} onChange={(v) => set("voiceEmotion", v)} />
          </Field>
          <Field label="Geçiş efekti sesi">
            <button
              type="button"
              role="switch"
              aria-checked={settings.transitionSfx}
              disabled={!transitionSfxAvailable}
              onClick={() => set("transitionSfx", !settings.transitionSfx)}
              className="flex items-center gap-2.5 text-[12.5px] font-medium text-ink transition disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${settings.transitionSfx ? "bg-ink" : "bg-hairline"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${settings.transitionSfx ? "left-[18px]" : "left-0.5"}`} />
              </span>
              {settings.transitionSfx ? "Açık" : "Kapalı"}
            </button>
            {!transitionSfxAvailable && (
              <p className="mt-1.5 text-[11.5px] text-muted">Geçiş sesi klipler arasında çalar — en az 2 medya yükle.</p>
            )}
          </Field>
        </div>

        <div className="flex flex-none items-center justify-end gap-3 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3">
          <button type="button" onClick={onClose} className="btn btn-primary min-w-28">Tamam</button>
        </div>
      </div>
    </div>
  );
}
