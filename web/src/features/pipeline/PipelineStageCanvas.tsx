import { AnimatePresence, motion } from "motion/react";
import type {
  HazardFlowHint,
  HazardHintTone,
  HazardStageHighlight
} from "@/features/lesson_hazard/contracts";
import { pipelineStageOrder } from "@/features/pipeline/palette";
import {
  describePipelinePulse,
  findTokenOriginStage,
  getPipelineTokens,
  getRegisterActivities,
  getStageChineseLabel,
  getStageIndex,
  getStageStateLabel,
  type PipelineTone
} from "@/features/pipeline/visuals";
import type {
  PipelineStageKey,
  TracePipelineStage,
  TraceStepRecord
} from "@/features/trace/types";

const boardMetrics = {
  width: 1220,
  height: 470,
  stageWidth: 212,
  stageHeight: 210,
  stageGap: 16,
  stageStartX: 42,
  stageY: 118,
  tokenInsetX: 18,
  tokenY: 54
} as const;

const emptyStage: TracePipelineStage = { state: "empty" };

const toneClasses: Record<PipelineTone, string> = {
  neutral: "border-white/10 bg-white/5 text-slate-100",
  cyan: "border-cyan-300/30 bg-cyan-300/12 text-cyan-50",
  amber: "border-amber-300/30 bg-amber-300/12 text-amber-50",
  emerald: "border-emerald-300/30 bg-emerald-300/12 text-emerald-50",
  rose: "border-rose-300/30 bg-rose-300/12 text-rose-50"
};

const stageShellClasses: Record<string, string> = {
  empty: "border-slate-800/80 bg-slate-950/80 text-slate-400",
  fetch: "border-cyan-400/30 bg-cyan-950/28 text-cyan-50",
  occupied: "border-emerald-400/25 bg-emerald-950/26 text-emerald-50",
  stalled: "border-amber-400/30 bg-amber-950/28 text-amber-50",
  flushed: "border-rose-400/30 bg-rose-950/28 text-rose-50"
};

const tokenClasses: Record<string, string> = {
  fetch:
    "border-cyan-300/50 bg-[linear-gradient(180deg,rgba(34,211,238,0.28),rgba(6,182,212,0.08))] text-cyan-50 shadow-[0_0_38px_rgba(34,211,238,0.24)]",
  occupied:
    "border-emerald-300/50 bg-[linear-gradient(180deg,rgba(16,185,129,0.3),rgba(5,46,22,0.12))] text-emerald-50 shadow-[0_0_38px_rgba(16,185,129,0.24)]",
  stalled:
    "border-amber-300/60 bg-[linear-gradient(180deg,rgba(251,191,36,0.34),rgba(120,53,15,0.16))] text-amber-50 shadow-[0_0_44px_rgba(251,191,36,0.28)]",
  flushed:
    "border-rose-300/60 bg-[linear-gradient(180deg,rgba(251,113,133,0.34),rgba(127,29,29,0.16))] text-rose-50 shadow-[0_0_44px_rgba(251,113,133,0.26)]",
  bubble:
    "border-amber-200/55 bg-[linear-gradient(180deg,rgba(250,204,21,0.3),rgba(120,53,15,0.12))] text-amber-50 shadow-[0_0_32px_rgba(250,204,21,0.22)]"
};

const highlightRingClasses: Record<HazardHintTone, string> = {
  cyan: "ring-2 ring-cyan-300/45 shadow-[0_0_40px_rgba(34,211,238,0.18)]",
  amber: "ring-2 ring-amber-300/45 shadow-[0_0_40px_rgba(251,191,36,0.18)]",
  emerald: "ring-2 ring-emerald-300/45 shadow-[0_0_40px_rgba(16,185,129,0.2)]",
  rose: "ring-2 ring-rose-300/45 shadow-[0_0_40px_rgba(251,113,133,0.18)]"
};

const markClasses: Record<HazardHintTone, string> = {
  cyan: "border-cyan-300/30 bg-cyan-300/15 text-cyan-50",
  amber: "border-amber-300/30 bg-amber-300/15 text-amber-50",
  emerald: "border-emerald-300/30 bg-emerald-300/15 text-emerald-50",
  rose: "border-rose-300/30 bg-rose-300/15 text-rose-50"
};

const registerClasses = {
  read: "border-cyan-300/30 bg-cyan-300/14 text-cyan-50",
  target: "border-emerald-300/30 bg-emerald-300/14 text-emerald-50",
  write: "border-lime-300/35 bg-lime-300/14 text-lime-50"
} as const;

const flowColors: Record<HazardHintTone, { stroke: string; glow: string; fill: string }> = {
  cyan: {
    stroke: "#67e8f9",
    glow: "rgba(34,211,238,0.34)",
    fill: "rgba(34,211,238,0.16)"
  },
  amber: {
    stroke: "#fbbf24",
    glow: "rgba(251,191,36,0.34)",
    fill: "rgba(251,191,36,0.16)"
  },
  emerald: {
    stroke: "#6ee7b7",
    glow: "rgba(16,185,129,0.34)",
    fill: "rgba(16,185,129,0.16)"
  },
  rose: {
    stroke: "#fb7185",
    glow: "rgba(251,113,133,0.34)",
    fill: "rgba(251,113,133,0.16)"
  }
};

function getStageBoxX(stage: PipelineStageKey): number {
  return (
    boardMetrics.stageStartX
    + getStageIndex(stage) * (boardMetrics.stageWidth + boardMetrics.stageGap)
  );
}

function getTokenX(stage: PipelineStageKey): number {
  return getStageBoxX(stage) + boardMetrics.tokenInsetX;
}

function buildFlowPath(hint: HazardFlowHint) {
  const fromX = getStageBoxX(hint.fromStage) + boardMetrics.stageWidth / 2;
  const toX = getStageBoxX(hint.toStage) + boardMetrics.stageWidth / 2;
  const fromY = boardMetrics.stageY - 14;
  const toY = boardMetrics.stageY - 14;
  const lane = hint.lane ?? 0;
  const controlY = 30 + lane * 30 + Math.abs(fromX - toX) * 0.05;
  const labelY = controlY - 16;

  return {
    path: `M ${fromX} ${fromY} C ${fromX} ${controlY}, ${toX} ${controlY}, ${toX} ${toY}`,
    labelX: (fromX + toX) / 2,
    labelY
  };
}

function getEventLabel(step: TraceStepRecord) {
  if (step.pipeline?.flush.length || step.branched) {
    return "Flush";
  }

  if (step.pipeline?.stall) {
    return "Stall";
  }

  if (step.pipeline?.bubble.length) {
    return "Bubble";
  }

  return "Flow";
}

export function PipelineStageCanvas({
  step,
  previousStep = null,
  stageHighlights = [],
  flowHints = [],
  snapshotLabel = "主画幅",
  badgeLabel = "逐拍推进",
  pulseTone = "neutral",
  hazardLabel,
  showRegisters = true
}: {
  step: TraceStepRecord;
  previousStep?: TraceStepRecord | null;
  stageHighlights?: HazardStageHighlight[];
  flowHints?: HazardFlowHint[];
  snapshotLabel?: string;
  badgeLabel?: string;
  pulseTone?: PipelineTone;
  hazardLabel?: string;
  showRegisters?: boolean;
}) {
  if (!step.pipeline) {
    return (
      <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-5 text-sm text-rose-100">
        当前记录不包含流水线快照。
      </div>
    );
  }

  const pulse = describePipelinePulse(step, pulseTone);
  const tokens = getPipelineTokens(step);
  const registerActivities = getRegisterActivities(step);
  const marksByStage = stageHighlights.reduce<
    Partial<Record<PipelineStageKey, HazardStageHighlight[]>>
  >((accumulator, item) => {
    const currentMarks = accumulator[item.stage] ?? [];

    return {
      ...accumulator,
      [item.stage]: [...currentMarks, item]
    };
  }, {});

  return (
    <div className="overflow-x-auto">
      <div
        className="relative rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.92),rgba(3,7,18,0.82))] p-6 shadow-[0_30px_90px_rgba(2,6,23,0.38)]"
        style={{ minWidth: `${boardMetrics.width}px` }}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
              {snapshotLabel}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-2xl font-semibold text-slate-50">
                第 {step.pipeline.cycle} 拍
              </p>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${toneClasses[pulse.tone]}`}
              >
                {getEventLabel(step)}
              </span>
              {hazardLabel ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
                  {hazardLabel}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.26em] text-slate-300">
              {badgeLabel}
            </div>
            <div
              className={`rounded-full border px-4 py-2 text-sm font-medium ${toneClasses[pulse.tone]}`}
            >
              {pulse.label}
            </div>
          </div>
        </div>

        <div className="relative" style={{ height: `${boardMetrics.height}px` }}>
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
                  id={`pipeline-arrow-${tone}`}
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

            {pipelineStageOrder.slice(0, -1).map((stageRef, index) => {
              const startX = getStageBoxX(stageRef.key) + boardMetrics.stageWidth;
              const endX = getStageBoxX(pipelineStageOrder[index + 1]?.key ?? stageRef.key);
              const midY = boardMetrics.stageY + boardMetrics.stageHeight / 2;

              return (
                <g key={`${stageRef.key}-link`}>
                  <path
                    d={`M ${startX} ${midY} L ${endX - 18} ${midY}`}
                    stroke="rgba(71, 85, 105, 0.55)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M ${endX - 30} ${midY - 12} L ${endX - 18} ${midY} L ${endX - 30} ${midY + 12}`}
                    stroke="rgba(71, 85, 105, 0.55)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            {flowHints.map((hint) => {
              const geometry = buildFlowPath(hint);
              const palette = flowColors[hint.tone];
              const labelWidth = Math.max(60, hint.label.length * 10 + 18);

              return (
                <g key={`${hint.fromStage}-${hint.toStage}-${hint.label}`}>
                  <path
                    d={geometry.path}
                    stroke={palette.glow}
                    strokeWidth="12"
                    strokeLinecap="round"
                    opacity="0.22"
                  />
                  <path
                    d={geometry.path}
                    stroke={palette.stroke}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={hint.tone === "amber" ? "8 8" : "12 8"}
                    markerEnd={`url(#pipeline-arrow-${hint.tone})`}
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
                    fill={palette.stroke}
                    fontFamily="Space Grotesk, Segoe UI, sans-serif"
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

          {step.pipeline.flush.length ? (
            <motion.div
              key={`flush-wave-${step.pipeline.cycle}`}
              initial={{ opacity: 0, x: -36 }}
              animate={{ opacity: [0, 0.9, 0], x: [0, 118, 196] }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className="pointer-events-none absolute left-[42px] top-[118px] h-[210px] w-[440px] rounded-[30px] bg-[linear-gradient(90deg,rgba(244,63,94,0),rgba(244,63,94,0.18),rgba(244,63,94,0.5),rgba(244,63,94,0))] blur-sm"
            />
          ) : null}

          <div
            className="absolute left-0 top-0 flex gap-4"
            style={{
              left: `${boardMetrics.stageStartX}px`,
              top: `${boardMetrics.stageY}px`
            }}
          >
            {pipelineStageOrder.map((stageRef) => {
              const stage = step.pipeline?.[stageRef.key] ?? emptyStage;
              const marks = marksByStage[stageRef.key] ?? [];
              const dominantMark = marks[marks.length - 1];

              return (
                <div
                  key={stageRef.key}
                  className={`relative h-[210px] w-[212px] rounded-[30px] border p-4 ${stageShellClasses[stage.state] ?? stageShellClasses.empty} ${dominantMark ? highlightRingClasses[dominantMark.tone] : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-400/85">
                        {stageRef.label}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-50">
                        {getStageChineseLabel(stageRef.key)}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300/75">
                        {getStageStateLabel(stage.state)}
                      </p>
                    </div>

                    <div className="flex max-w-[92px] flex-col items-end gap-2">
                      {marks.map((mark) => (
                        <span
                          key={`${stageRef.key}-${mark.label}`}
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.2em] ${markClasses[mark.tone]}`}
                        >
                          {mark.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 rounded-[22px] border border-white/8 bg-black/12 px-4 py-3 text-xs uppercase tracking-[0.22em] text-slate-300/80">
                    {stage.raw ?? stage.pc ?? "等待指令"}
                  </div>
                </div>
              );
            })}
          </div>

          <AnimatePresence mode="popLayout">
            {tokens.map((token) => {
              const originStage = findTokenOriginStage(token, previousStep);
              const currentX = getTokenX(token.stage);
              const originX = getTokenX(originStage);
              const isStalled = token.state === "stalled";
              const isBubble = token.kind === "bubble";

              return (
                <motion.div
                  key={`${token.instructionKey}-${token.stage}`}
                  initial={{
                    x: originX,
                    y: boardMetrics.stageY + boardMetrics.tokenY,
                    opacity: isBubble ? 0 : 0.25,
                    scale: isBubble ? 0.6 : 0.96
                  }}
                  animate={{
                    x: currentX,
                    y: boardMetrics.stageY + boardMetrics.tokenY,
                    opacity: 1,
                    scale: isStalled ? [1, 1.03, 1] : 1
                  }}
                  exit={{ opacity: 0, scale: 0.82 }}
                  transition={{
                    duration: isBubble ? 0.42 : 0.68,
                    ease: "easeInOut"
                  }}
                  className={`absolute left-0 top-0 h-[120px] w-[176px] rounded-[24px] border px-4 py-4 backdrop-blur ${tokenClasses[token.state] ?? tokenClasses.occupied}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.26em] opacity-75">
                        {token.kind === "bubble" ? "插入" : token.stage.toUpperCase()}
                      </p>
                      <p className="mt-2 text-xl font-semibold leading-6">
                        {token.title}
                      </p>
                    </div>

                    <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] opacity-80">
                      {getStageStateLabel(token.state)}
                    </span>
                  </div>

                  <div className="mt-4 space-y-1 text-sm opacity-90">
                    <p>{token.subtitle}</p>
                    <p className="text-xs uppercase tracking-[0.2em] opacity-70">
                      {token.raw ?? (token.kind === "bubble" ? "stall gap" : "flow slot")}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {showRegisters ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
            <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-100">寄存器活动</p>
                <span className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  读 / 目标 / 写回
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {registerActivities.length ? (
                  registerActivities.map((activity, index) => (
                    <motion.span
                      key={`${activity.kind}-${activity.reg}-${activity.value ?? index}`}
                      initial={{ opacity: 0.35, scale: 0.92 }}
                      animate={{ opacity: [0.45, 1, 0.88], scale: [0.95, 1.04, 1] }}
                      transition={{ duration: 0.58, delay: index * 0.04 }}
                      className={`rounded-full border px-3 py-2 text-sm font-medium ${registerClasses[activity.kind]}`}
                    >
                      r{activity.reg} {activity.label}
                      {activity.value ? ` ${activity.value}` : ""}
                    </motion.span>
                  ))
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">
                    本拍无寄存器变化
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-100">路径提示</p>
                <span className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  producer / consumer
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {flowHints.length ? (
                  flowHints.map((hint) => (
                    <span
                      key={`${hint.fromStage}-${hint.toStage}-${hint.label}-rail`}
                      className={`rounded-full border px-3 py-2 text-sm ${markClasses[hint.tone]}`}
                    >
                      {hint.fromStage.toUpperCase()} → {hint.toStage.toUpperCase()} {hint.label}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">
                    本拍按阶段顺序推进
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
