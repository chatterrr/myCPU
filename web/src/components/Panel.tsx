import type { PropsWithChildren } from "react";

type PanelProps = PropsWithChildren<{
  title: string;
  description?: string;
  className?: string;
}>;

export function Panel({
  title,
  description,
  className = "",
  children
}: PanelProps) {
  return (
    <section
      className={`rounded-[28px] border border-white/10 bg-slate-950/75 p-5 shadow-[0_28px_80px_rgba(2,6,23,0.35)] backdrop-blur ${className}`}
    >
      <header className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
        {description ? (
          <p className="text-sm leading-6 text-slate-300">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

