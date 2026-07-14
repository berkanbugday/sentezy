import Link from "next/link";
import { PromptComposer } from "@/components/PromptComposer";

const VIDEOS = [
  { title: "Kuaför Studio — Tanıtım", date: "8 Tem", ratio: "9:16", status: "ready" as const },
  { title: "Yeni Sezon İndirimi", date: "8 Tem", ratio: "9:16", status: "proc" as const },
  { title: "Emlak — Deniz Manzaralı", date: "6 Tem", ratio: "9:16", status: "ready" as const },
  { title: "Diş Kliniği Kampanya", date: "5 Tem", ratio: "1:1", status: "draft" as const },
];

const STATUS: Record<string, [string, string]> = {
  ready: ["Hazır", "badge-ready"],
  proc: ["İşleniyor", "badge-proc"],
  draft: ["Taslak", "badge-draft"],
};

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl">
      {/* aurora hero — the one color moment; greeting + conversational composer */}
      <section className="hero-aurora rounded-[22px] border border-hairline px-6 py-8 sm:px-9 sm:py-9">
        <h1 className="disp text-[28px] font-semibold text-ink">Merhaba, Deniz 👋</h1>
        <p className="mt-1 text-[14.5px] text-slate">Bugün ne tanıtalım?</p>
        <PromptComposer />
      </section>

      {/* recent */}
      <div className="mt-9 mb-4 flex items-center justify-between">
        <h2 className="text-[18px] font-semibold text-ink">Son videoların</h2>
        <Link href="/library" className="text-[13.5px] font-semibold text-signal">Tümünü gör →</Link>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
        {VIDEOS.map((v) => {
          const [label, cls] = STATUS[v.status];
          return (
            <div key={v.title} className="card overflow-hidden">
              <div className="ph-stripe relative aspect-[9/16]">
                <span className={`badge ${cls} absolute left-2.5 top-2.5`}>
                  <span className="dot" />
                  {label}
                </span>
              </div>
              <div className="p-3">
                <p className="truncate text-[13.5px] font-semibold text-ink">{v.title}</p>
                <div className="mt-1 flex items-center justify-between text-[12px] text-muted">
                  <span>{v.date}</span>
                  <span className="mono">{v.ratio}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
