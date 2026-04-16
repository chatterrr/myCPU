import { motion } from "motion/react";
import { pipelineStageOrder } from "@/features/pipeline/palette";
import type {
  HazardFlowHint,
  HazardHintTone,
  HazardStageHighlight
} from "@/features/lesson_hazard/contracts";
import type { PipelineStageKey, TraceStepRecord } from "@/features/trace/types";

const boardMetrics = {
  width: 1000,
  height: 360,
  stageWidth: 172,
  stageHeight: 188,
  stageGap: 18,
  stageStartX: 36,
  stageY: 112
} as const;

const stageToneClasses: Record<HazardHintTone, string> = {
  cyan: "ring-2 ring-cyan-300/45 shadow-[0_0_45px_rgba(34,211,238,0.18)]",
  amber: "ring-2 ring-amber-300/45 shadow-[0_0_45px_rgba(251,191,36,0.16)]",
  rose: "ring-2 ring-rose-300/45 shadow-[0_0_45px_rgba(251,113,133,0.18)]",
  emerald: "ring-2 ring-emerald-300/45 shadow-[0_0_45px_rgba(52,211,153,0.18)]"
};

const stageMarkClasses: Record<HazardHintTone, string> = {
  cyan: "border-cyan-300/30 bg-cyan-300/15 text-cyan-50",
  amber: "border-amber-300/30 bg-amber-300/15 text-amber-50",
  rose: "border-rose-300/30 bg-rose-300/15 text-rose-50",
  emerald: "border-emerald-300/30 bg-emerald-300/15 text-emerald-50"
};

const flowColors: Record<
  HazardHintTone,
  { stroke: string; fill: string; text: string; glow: string }
> = {
  cyan: {
    stroke: "#67e8f9",
    fill: "rgba(34, 211, 238, 0.18)",
    text: "#ecfeff",
    glow: "rgba(34, 211, 238, 0.38)"
  },
  amber: {
    stroke: "#fbbf24",
    fill: "rgba(251, 191, 36, 0.18)",
    text: "#fffbeb",
    glow: "rgba(251, 191, 36, 0.34)"
  },
  rose: {
    stroke: "#fb7185",
    fill: "rgba(251, 113, 133, 0.18)",
    text: "#fff1f2",
    glow: "rgba(251, 113, 133, 0.34)"
  },
  emerald: {
    stroke: "#6ee7b7",
    fill: "rgba(52, 211, 153, 0.18)",
    text: "#ecfdf5",
    glow: "rgba(52, 211, 153, 0.34)"
  }
};

const stageStateClasses: Record<string, string> = {
  empty: "border-slate-800/80 bg-slate-950/80 text-slate-300",
  fetch: "border-cyan-400/25 bg-cyan-950/35 text-cyan-50",
  occupied: "border-emerald-400/20 bg-emerald-950/30 text-emerald-50",
  stalled: "border-amber-400/30 bg-amber-950/35 text-amber-50",
  flushed: "border-rose-400/30 bg-rose-950/35 text-rose-50"
};

function getStageX(stage: PipelineStageKey): number {
  const index = pipelineStageOrder.findIndex((stageRef) => stageRef.key === stage);

  return (
    boardMetrics.stageStartX
    + index * (boardMetrics.stageWidth + boardMetrics.stageGap)
  );
}

function buildFlowPath(hint: HazardFlowHint) {
  const fromX = getStageX(hint.fromStage) + boardMetrics.stageWidth / 2;
  const toX = getStageX(hint.toStage) + boardMetrics.stageWidth / 2;
  const fromY = boardMetrics.stageY - 10;
  const toY = boardMetrics.stageY - 10;
  const lane = hint.lane ?? 0;
  const controlY = 28 + lane * 28 + Math.abs(fromX - toX) * 0.03;
  const labelY = controlY - 14;

  return {
    path: `M ${fromX} ${fromY} C ${fromX} ${controlY}, ${toX} ${controlY}, ${toX} ${toY}`,
    labelX: (fromX + toX) / 2,
    labelY
  };
}

function describeStage(step: TraceStepRecord, stage: PipelineStageKey) {
  const snapshot = step.pipeline?.[stage];

  if (!snapshot) {
    return {
      state: "empty",
      title: "Empty",
      subline: "-",
      raw: undefined as string | undefined
    };
  }

  if (snapshot.state === "empty") {
    return {
      state: snapshot.state,
      title: "Empty",
      subline: "No instruction",
      raw: undefined as string | undefined
    };
  }

  if (snapshot.state === "stalled" && !snapshot.op) {
    return {
      state: snapshot.state,
      title: "Hold",
      subline: snapshot.pc ?? "PC held",
      raw: undefined as string | undefined
    };
  }

  if (snapshot.state === "flushed" && !snapshot.op) {
    return {
      state: snapshot.state,
      title: "Flushed",
      subline: snapshot.pc ?? "Wrong path",
      raw: undefined as string | undefined
    };
  }

  return {
    state: snapshot.state,
    title: snapshot.op ?? snapshot.state.toUpperCase(),
    subline: snapshot.pc ?? "-",
    raw: snapshot.raw
  };
}

export function HazardPuzzleBoard({
  step,
  stageHighlights,
  flowHints,
  snapshotLabel = "Focused snapshot",
  badgeLabel = "One cycle, one puzzle move"
}: {
  step: TraceStepRecord;
  stageHighlights: HazardStageHighlight[];
  flowHints: HazardFlowHint[];
  snapshotLabel?: string;
  badgeLabel?: string;
}) {
  if (!step.pipeline) {
    return (
      <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-5 text-sm text-rose-100">
        This puzzle level needs pipeline payload in the trace step.
      </div>
    );
  }

  const marksByStage = stageHighlights.reduce<
    Partial<Record<PipelineStageKey, HazardStageHighlight[]>>
  >((accumulator, highlight) => {
    const currentMarks = accumulator[highlight.stage] ?? [];

    return {
      ...accumulator,
      [highlight.stage]: [...currentMarks, highlight]
    };
  }, {});

  return (
    <div className="overflow-x-auto">
      <div
        className="relative rounded-[32px] border border-white/10 bg-slate-950/80 p-5"
        style={{ minWidth: `${boardMetrics.width}px` }}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
              {snapshotLabel}
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-50">
              Cycle {step.pipeline.cycle}
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-300">
            {badgeLabel}
          </div>
        </div>

        <svg
          className="pointer-events-none absolute left-0 top-0"
          width={boardMetrics.width}
          height={boardMetrics.height}
          viewBox={`0 0 ${boardMetrics.width} ${boardMetrics.height}`}
          fill="none"
          aria-hidden="true"
        >
          <defs>
            {Object.entries(flowColors).map(([tone, palette]) => (
              <marker
                key={tone}
                id={`hazard-arrow-${tone}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={palette.stroke} />
              </marker>
            ))}
          </defs>

          {flowHints.map((hint) => {
            const geometry = buildFlowPath(hint);
            const palette = flowColors[hint.tone];
            const labelWidth = Math.max(58, hint.label.length * 8 + 18);

            return (
              <g key={`${hint.fromStage}-${hint.toStage}-${hint.label}`}>
                <path
                  d={geometry.path}
                  stroke={palette.glow}
                  strokeWidth="10"
                  strokeLinecap="round"
                  opacity="0.18"
                />
                <path
                  d={geometry.path}
                  stroke={palette.stroke}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={hint.tone === "amber" ? "8 8" : undefined}
                  markerEnd={`url(#hazard-arrow-${hint.tone})`}
                />
                <rect
                  x={geometry.labelX - labelWidth / 2}
                  y={geometry.labelY - 12}
                  width={labelWidth}
                  height="24"
                  rx="12"
                  fill={palette.fill}
                  stroke={palette.stroke}
                />
                <text
                  x={geometry.labelX}
                  y={geometry.labelY + 4}
                  fill={palette.text}
                  fontFamily="Space Grotesk"
                  fontSize="12"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {hint.label}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="relative flex gap-[18px] pt-12">
          {pipelineStageOrder.map((stageRef, index) => {
            const stageInfo = describeStage(step, stageRef.key);
            const marks = marksByStage[stageRef.key] ?? [];
            const dominantTone = marks[marks.length - 1]?.tone;
            const stageClass = stageStateClasses[stageInfo.state]
              ?? "border-slate-700/70 bg-slate-900/80 text-slate-100";

            return (
              <motion.div
                key={stageRef.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: index * 0.04 }}
                className={`relative h-[188px] w-[172px] shrink-0 rounded-[28px] border p-4 ${stageClass} ${dominantTone ? stageToneClasses[dominantTone] : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-400/90">
                      {stageRef.label}
                    </p>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-slate-300/80">
                      {stageInfo.state}
                    </p>
                  </div>
                  <div className="flex max-w-[72px] flex-col items-end gap-2">
                    {marks.map((mark) => (
                      <span
                        key={`${stageRef.key}-${mark.label}`}
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] ${stageMarkClasses[mark.tone]}`}
                      >
                        {mark.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="rounded-[22px] border border-white/8 bg-black/10 px-4 py-3">
                    <p className="text-lg font-semibold leading-6 text-slate-50">
                      {stageInfo.title}
                    </p>
                    <p className="mt-2 text-sm text-slate-200/80">
                      {stageInfo.subline}
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-white/8 bg-black/10 px-4 py-3 text-xs uppercase tracking-[0.24em] text-slate-300/80">
                    {stageInfo.raw ?? "No RAW"}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
