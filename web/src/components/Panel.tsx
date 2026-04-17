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
      className={`rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(2,6,23,0.94),rgba(3,7,18,0.88))] p-5 shadow-[0_30px_90px_rgba(2,6,23,0.46)] backdrop-blur-xl ${className}`}
    >
      <header className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold tracking-[0.02em] text-slate-50">{title}</h2>
        {description ? (
          <p className="text-sm leading-6 text-slate-200">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

