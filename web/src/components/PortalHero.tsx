import { Link, NavLink } from "react-router-dom";
import { Tag, type TagTone } from "@/components/Tag";

type PortalAction = {
  label: string;
  to: string;
  emphasis?: "primary" | "secondary";
};

type PortalHeroProps = {
  sectionLabel: string;
  title: string;
  description: string;
  tags?: Array<{ label: string; tone: TagTone }>;
  actions?: PortalAction[];
};

const navLinkClassName =
  "rounded-full border px-4 py-2 text-sm transition";

const actionClasses: Record<NonNullable<PortalAction["emphasis"]>, string> = {
  primary:
    "border-cyan-300/32 bg-cyan-300/12 text-cyan-50 hover:border-cyan-200/48 hover:bg-cyan-300/18",
  secondary:
    "border-white/10 bg-white/5 text-slate-100 hover:border-white/22 hover:bg-white/10"
};

export function PortalHero({
  sectionLabel,
  title,
  description,
  tags = [],
  actions = []
}: PortalHeroProps) {
  return (
    <header className="rounded-[34px] border border-cyan-300/16 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(251,113,133,0.12),transparent_24%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(2,6,23,0.86))] p-6 shadow-[0_36px_110px_rgba(2,6,23,0.48)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.28em] text-slate-400">{sectionLabel}</p>
          <nav className="mt-3 flex flex-wrap gap-2">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `${navLinkClassName} ${
                  isActive
                    ? "border-cyan-300/32 bg-cyan-300/12 text-cyan-50"
                    : "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10"
                }`
              }
            >
              工作台
            </NavLink>
            <NavLink
              to="/hazard-puzzle"
              className={({ isActive }) =>
                `${navLinkClassName} ${
                  isActive
                    ? "border-amber-300/32 bg-amber-300/12 text-amber-50"
                    : "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10"
                }`
              }
            >
              Hazard 互动
            </NavLink>
            <NavLink
              to="/traffic-control"
              className={({ isActive }) =>
                `${navLinkClassName} ${
                  isActive
                    ? "border-cyan-300/32 bg-cyan-300/12 text-cyan-50"
                    : "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10"
                }`
              }
            >
              方块调度
            </NavLink>
          </nav>
        </div>

        {tags.length ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Tag key={`${tag.label}-${tag.tone}`} label={tag.label} tone={tag.tone} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-4xl space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">
            {title}
          </h1>
          <p className="text-base leading-7 text-slate-200">{description}</p>
        </div>

        {actions.length ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => {
              const emphasis = action.emphasis ?? "secondary";
              return (
                <Link
                  key={`${action.label}-${action.to}`}
                  to={action.to}
                  className={`rounded-full border px-4 py-2 text-sm transition ${actionClasses[emphasis]}`}
                >
                  {action.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </header>
  );
}
