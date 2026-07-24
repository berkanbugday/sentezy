"use client";

import Link from "next/link";
import { useEffect } from "react";
import { VOICE_EMOTIONS } from "@/components/wizard/constants";
import { Icon } from "@/components/icons";
import { type ComposerSettings } from "@/lib/composerSettings";
import { kitHasContent } from "@/lib/branding";
import { useBrandKit } from "@/lib/queries";

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

/** The house on/off switch. Extracted when the brand toggles arrived — the same markup
 *  was about to be copied four times. */
function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-[12.5px] font-medium text-ink transition disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${checked ? "bg-ink" : "bg-hairline"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
      {checked ? "On" : "Off"}
    </button>
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
  { value: "left", label: "Left" },
  { value: "center", label: "Middle" },
  { value: "right", label: "Right" },
];
const CAPPOS_OPTS: Opt<ComposerSettings["captionPosition"]>[] = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
];

const BRAND_TOGGLES: { key: "brandIntro" | "brandOutro" | "brandWatermark"; label: string }[] = [
  { key: "brandIntro", label: "Intro card" },
  { key: "brandOutro", label: "Outro card" },
  { key: "brandWatermark", label: "Watermark" },
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

  // GET /brand-kit returns defaults rather than 404ing, so "has a kit" means the user has
  // actually put something on it. A kit that is ONLY an uploaded intro video counts —
  // it needs no logo and no name to render.
  const kit = useBrandKit(open).data;
  const hasBrandKit = kitHasContent(kit);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
        <div className="sticky top-0 z-10 flex-none bg-paper px-5 pt-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
          <div className="mb-1 flex items-start justify-between gap-3">
            <h3 className="disp mt-0.5 text-[18px] font-semibold text-ink">More settings</h3>
            <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
              <Icon.close width={18} height={18} className="block" />
            </button>
          </div>
        </div>

        <div className="no-scrollbar flex flex-col gap-5 overflow-y-auto px-5 py-5">
          <Field label="Where the presenter stands">
            <Pills options={AVATAR_POS_OPTS} value={settings.avatarPosition} onChange={(v) => set("avatarPosition", v)} />
          </Field>
          <Field label="Where the captions sit">
            <Pills options={CAPPOS_OPTS} value={settings.captionPosition} onChange={(v) => set("captionPosition", v)} />
          </Field>
          <Field label="Tone of voice">
            <Pills options={VOICE_EMOTIONS} value={settings.voiceEmotion} onChange={(v) => set("voiceEmotion", v)} />
          </Field>
          <Field label="Whoosh between clips">
            <Toggle
              checked={settings.transitionSfx}
              onChange={(v) => set("transitionSfx", v)}
              disabled={!transitionSfxAvailable}
              label="Whoosh between clips"
            />
            {!transitionSfxAvailable && (
              <p className="mt-1.5 text-[11.5px] text-muted">Plays between clips — add a second one to use it.</p>
            )}
          </Field>

          <div className="border-t border-hairline pt-5">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <div className="text-[13px] font-semibold text-ink">Your brand</div>
              <Link href="/brand-kit" className="text-[12.5px] font-medium text-signal">
                Edit brand kit
              </Link>
            </div>
            {hasBrandKit ? (
              <div className="flex flex-col gap-3">
                {BRAND_TOGGLES.map((b) => (
                  <div key={b.key} className="flex items-center justify-between gap-4">
                    <span className="text-[12.5px] text-slate">{b.label}</span>
                    <Toggle checked={settings[b.key]} onChange={(v) => set(b.key, v)} label={b.label} />
                  </div>
                ))}
              </div>
            ) : (
              /* Toggling branding on with no kit would produce a card with nothing on it,
                 so send the user to build one first rather than letting them arm an
                 empty intro. */
              <p className="text-[11.5px] text-muted">
                You have not set up a brand kit yet.{" "}
                <Link href="/brand-kit" className="font-medium text-signal">
                  Create one
                </Link>{" "}
                — then you can switch the intro, outro and watermark on here.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-none items-center justify-end gap-3 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3">
          <button type="button" onClick={onClose} className="btn btn-primary min-w-28">Tamam</button>
        </div>
      </div>
    </div>
  );
}
