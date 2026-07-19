"use client";

import { useState } from "react";
import { type Avatar } from "@/components/wizard/types";
import { Icon } from "@/components/icons";
import { AvatarGrid } from "./AvatarGrid";

/** Avatar picker sheet — the catalog browser in a modal. Tapping a tile only marks it;
 *  the choice reaches the composer when "Tamam" is pressed, so closing any other way
 *  discards it. The grid itself lives in AvatarGrid, shared with the /avatars page. */
export function AvatarPicker({ open, onClose, selectedId, onSelect }: { open: boolean; onClose: () => void; selectedId: string | null; onSelect: (a: Avatar | null) => void }) {
  if (!open) return null;
  /* Keyed on nothing — the sheet unmounts when closed, so the draft resets each time it opens. */
  return <PickerSheet onClose={onClose} selectedId={selectedId} onSelect={onSelect} />;
}

function PickerSheet({ onClose, selectedId, onSelect }: { onClose: () => void; selectedId: string | null; onSelect: (a: Avatar | null) => void }) {
  /* Wrapped rather than bare: `undefined` means "untouched, still showing the composer's
   * avatar", while `{ value: null }` is the deliberate choice of the "Avatarsız" tile. */
  const [draft, setDraft] = useState<{ value: Avatar | null } | undefined>(undefined);
  const shownId = draft ? (draft.value?.id ?? null) : selectedId;

  const confirm = () => {
    if (draft) onSelect(draft.value);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
        <div className="flex-none px-5 pt-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
          <div className="mb-1 flex items-start justify-between gap-3">
            <h3 className="disp mt-0.5 text-[18px] font-semibold text-ink">Avatar seç</h3>
            <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
              <Icon.close width={18} height={18} className="block" />
            </button>
          </div>
        </div>

        <div className="no-scrollbar overflow-y-auto px-5 py-4">
          <AvatarGrid selectedId={shownId} showNoneOption onSelect={(a) => setDraft({ value: a })} />
        </div>

        <div className="flex flex-none justify-end px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3">
          <button type="button" onClick={confirm} className="btn btn-primary min-w-28">
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}
