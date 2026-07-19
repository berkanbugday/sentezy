"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "@/components/icons";
import { type Avatar } from "@/components/wizard/types";

/** A closer look at one avatar before committing to it — the grid tile is too small to
 *  judge a face. The action seeds the composer with this avatar via ?avatar=<id>. */
export function AvatarPreview({ avatar, onClose }: { avatar: Avatar | null; onClose: () => void }) {
  const router = useRouter();

  useEffect(() => {
    if (!avatar) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [avatar, onClose]);

  if (!avatar) return null;
  const meta = [avatar.sectorLabel, avatar.age, avatar.hijab ? "Başörtülü" : null].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
        <div className="flex-none px-5 pt-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
          <div className="mb-1 flex items-start justify-end gap-3">
            <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
              <Icon.close width={18} height={18} className="block" />
            </button>
          </div>
        </div>

        <div className="no-scrollbar overflow-y-auto px-5 py-4">
          <div className="overflow-hidden rounded-2xl border border-hairline bg-mist">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar.imageUrl} alt={avatar.name} className="aspect-[3/4] w-full object-cover" />
          </div>
          <h3 className="disp mt-3 text-[19px] font-semibold text-ink">{avatar.name}</h3>
          {meta && <p className="mt-0.5 text-[13px] text-muted">{meta}</p>}
        </div>

        <div className="flex flex-none justify-end px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:pb-4">
          <button
            type="button"
            onClick={() => router.push(`/dashboard?avatar=${encodeURIComponent(avatar.id)}`)}
            className="btn btn-primary w-full justify-center"
          >
            Bu avatarla video oluştur
          </button>
        </div>
      </div>
    </div>
  );
}
