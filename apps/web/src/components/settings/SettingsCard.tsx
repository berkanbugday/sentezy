/** A titled settings card. The house card with an optional description under the heading,
 *  so every section on the page reads the same and the view file stays about content. */
export function SettingsCard({
  title,
  description,
  children,
  tone = "default",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** "danger" tints the border/heading red for the destructive section. */
  tone?: "default" | "danger";
}) {
  return (
    <section className={`card p-5 ${tone === "danger" ? "border-red-200" : ""}`}>
      <h2 className={`disp text-[15px] font-semibold ${tone === "danger" ? "text-red-600" : "text-ink"}`}>{title}</h2>
      {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
