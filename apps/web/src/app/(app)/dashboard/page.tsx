import Link from "next/link";
import { ComposerSection } from "@/components/composer/ComposerSection";

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
    <div>
      {/* full-bleed neutral hero — welcome + style dropdown + import composer */}
      <section className="hero-aurora -mx-5 -mt-6 px-5 pb-10 pt-10 sm:-mx-6 sm:px-6 sm:pt-12 md:-mx-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <ComposerSection />
        </div>
      </section>

      {/* recent */}
      <div className="mx-auto max-w-4xl">
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
    </div>
  );
}
