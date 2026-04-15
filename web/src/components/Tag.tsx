export type TagTone = "neutral" | "cyan" | "amber" | "emerald" | "rose";

type TagProps = {
  label: string;
  tone?: TagTone;
};

const toneClasses: Record<TagTone, string> = {
  neutral: "border-white/10 bg-white/5 text-slate-200",
  cyan: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
  amber: "border-amber-400/20 bg-amber-400/10 text-amber-100",
  emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
  rose: "border-rose-400/20 bg-rose-400/10 text-rose-100"
};

export function Tag({ label, tone = "neutral" }: TagProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}

