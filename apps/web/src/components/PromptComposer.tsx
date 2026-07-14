"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Icon } from "./icons";

// Prompt shortcuts — seed the composer, mirroring the reference's suggestion chips.
const CHIPS = [
  "Altyazı ekle",
  "Vurucu ve enerjik yap",
  "Sosyal medya videosu",
  "Trend bir ses ekle",
  "Geçişlerle düzenle",
];

/** Conversational hero composer: describe the video, then route into the wizard. */
export function PromptComposer() {
  const router = useRouter();
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  function autosize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }

  function fill(value: string) {
    setText(value);
    const el = taRef.current;
    if (el) {
      el.focus();
      requestAnimationFrame(() => autosize(el));
    }
  }

  function submit() {
    const q = text.trim();
    if (!q) return;
    router.push(`/create?prompt=${encodeURIComponent(q)}`);
  }

  return (
    <div className="mt-6">
      <div className="card rounded-[20px] p-4 shadow-sm">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            autosize(e.target);
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          rows={2}
          placeholder="Ne tanıtmak istiyorsun? Bir fikir yaz ya da link yapıştır…"
          className="w-full resize-none bg-transparent px-2 pt-1.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-muted"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            title="Dosya ekle"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-hairline text-slate hover:bg-mist"
          >
            <Icon.paperclip width={17} height={17} />
          </button>
          <button type="button" className="btn btn-ghost h-9 !py-0 text-[13px]">
            <Icon.wand width={16} height={16} />
            Stil ekle
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim()}
            className="btn btn-primary ml-auto disabled:cursor-not-allowed disabled:opacity-40"
          >
            Oluştur
            <Icon.arrowRight width={17} height={17} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => fill(c)}
            className="rounded-full border border-hairline bg-paper px-3.5 py-1.5 text-[13px] font-medium text-slate transition hover:bg-mist hover:text-ink"
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
