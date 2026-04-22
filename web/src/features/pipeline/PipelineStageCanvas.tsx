import { motion } from "motion/react";
import type {
  HazardFlowHint,
  HazardHintTone,
  HazardStageHighlight
} from "@/features/lesson_hazard/contracts";
import { pipelineStageOrder } from "@/features/pipeline/palette";
import {
  describePipelinePulse,
  getPipelineTokens,
  getRegisterActivities,
  getStageChineseLabel,
  getStageStateLabel,
  type PipelineTone
} from "@/features/pipeline/visuals";
import type {
  PipelineStageKey,
  TracePipelineStage,
  TraceStepRecord
} from "@/features/trace/types";

const toneClasses: Record<PipelineTone, string> = {
  neutral: "border-white/20 bg-white/10 text-slate-50",
  cyan: "border-cyan-300/55 bg-cyan-300/18 text-cyan-50",
  amber: "border-amber-300/55 bg-amber-300/18 text-amber-50",
  emerald: "border-emerald-300/55 bg-emerald-300/18 text-emerald-50",
  rose: "border-rose-300/55 bg-rose-300/18 text-rose-50"
};

const stageShellClasses: Record<string, string> = {
  empty: "border-slate-700/90 bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.92))] text-slate-300",
  fetch: "border-cyan-300/55 bg-[linear-gradient(180deg,rgba(6,182,212,0.22),rgba(8,47,73,0.72))] text-cyan-50",
  occupied: "border-emerald-300/50 bg-[linear-gradient(180deg,rgba(16,185,129,0.2),rgba(5,46,22,0.74))] text-emerald-50",
  stalled: "border-amber-300/55 bg-[linear-gradient(180deg,rgba(251,191,36,0.22),rgba(120,53,15,0.78))] text-amber-50",
  flushed: "border-rose-300/55 bg-[linear-gradient(180deg,rgba(251,113,133,0.22),rgba(127,29,29,0.8))] text-rose-50",
  bubble: "border-yellow-200/75 bg-[linear-gradient(180deg,rgba(254,240,138,0.42),rgba(120,53,15,0.16))] text-amber-50"
};

const hintClasses: Record<HazardHintTone, string> = {
  cyan: "border-cyan-300/50 bg-cyan-300/18 text-cyan-50",
  amber: "border-amber-300/50 bg-amber-300/18 text-amber-50",
  emerald: "border-emerald-300/50 bg-emerald-300/18 text-emerald-50",
  rose: "border-rose-300/50 bg-rose-300/18 text-rose-50"
};

const emptyStage: TracePipelineStage = { state: "empty" };

function groupHighlights(
  stageHighlights: HazardStageHighlight[]
): Partial<Record<PipelineStageKey, HazardStageHighlight[]>> {
  return stageHighlights.reduce<Partial<Record<PipelineStageKey, HazardStageHighlight[]>>>(
    (accumulator, item) => ({
      ...accumulator,
      [item.stage]: [...(accumulator[item.stage] ?? []), item]
    }),
    {}
  );
}

function getEventLabel(step: TraceStepRecord) {
  if (step.pipeline?.flush.length || step.branched) {
    return "冲刷";
  }

  if (step.pipeline?.stall) {
    return "停顿";
  }

  if (step.pipeline?.bubble.length) {
    return "气泡";
  }

  return "推进";
}

export function PipelineStageCanvas({
  step,
  stageHighlights = [],
  flowHints = [],
  snapshotLabel = "流水线画面",
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
        当前记录没有流水线快照。
      </div>
    );
  }

  const pulse = describePipelinePulse(step, pulseTone);
  const registerActivities = getRegisterActivities(step);
  const highlightsByStage = groupHighlights(stageHighlights);
  const tokens = getPipelineTokens(step);

  return (
    <div className="rounded-[34px] border border-cyan-300/18 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),radial-gradient(circle_at_top_right,rgba(251,113,133,0.12),transparent_26%),linear-gradient(180deg,rgba(1,4,12,0.98),rgba(2,6,23,0.92))] p-6 shadow-[0_36px_110px_rgba(2,6,23,0.52)]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          {snapshotLabel ? (
            <p className="text-xs tracking-[0.24em] text-slate-400">{snapshotLabel}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-2xl font-semibold text-slate-50">
              第 {step.pipeline.cycle} 拍
            </p>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses[pulse.tone]}`}
            >
              {getEventLabel(step)}
            </span>
            {hazardLabel ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                {hazardLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">
            {badgeLabel}
          </div>
          <div
            className={`rounded-full border px-4 py-2 text-sm font-medium ${toneClasses[pulse.tone]}`}
          >
            {pulse.label}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {pipelineStageOrder.map((stageRef) => {
          const stage = step.pipeline?.[stageRef.key] ?? emptyStage;
          const marks = highlightsByStage[stageRef.key] ?? [];
          const stageTokens = tokens.filter((token) => token.stage === stageRef.key);

          return (
            <div
              key={stageRef.key}
              className={`rounded-[28px] border p-4 ${stageShellClasses[stage.state] ?? stageShellClasses.empty}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs tracking-[0.22em] text-slate-300/85">
                    {stageRef.label}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-50">
                    {getStageChineseLabel(stageRef.key)}
                  </p>
                  <p className="mt-1 text-xs text-slate-300/80">
                    {getStageStateLabel(stage.state)}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {marks.map((mark) => (
                    <span
                      key={`${stageRef.key}-${mark.label}`}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${hintClasses[mark.tone]}`}
                    >
                      {mark.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {stageTokens.length ? (
                  stageTokens.map((token) => (
                    <motion.div
                      key={`${token.instructionKey}-${token.stage}`}
                      initial={{ opacity: 0.8, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22 }}
                      className={`rounded-[20px] border px-4 py-3 ${stageShellClasses[token.state] ?? stageShellClasses.occupied}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">
                          {token.kind === "bubble" ? "气泡" : token.title}
                        </p>
                        <span className="text-[10px] text-slate-200/80">
                          {token.kind === "bubble" ? "插入" : token.stage.toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-100">{token.subtitle}</p>
                      <p className="mt-1 text-xs text-slate-300/80">
                        {token.raw ?? (token.kind === "bubble" ? "停顿空拍" : "流水线槽位")}
                      </p>
                    </motion.div>
                  ))
                ) : (
                  <div className="rounded-[20px] border border-white/12 bg-black/24 px-4 py-3 text-sm text-slate-300">
                    {stage.raw ?? stage.pc ?? "等待指令"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
        {showRegisters ? (
          <div className="rounded-[26px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(8,47,73,0.34),rgba(2,6,23,0.92))] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-100">寄存器活动</p>
              <span className="text-xs text-slate-400">读取 / 目标 / 写回</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {registerActivities.length ? (
                registerActivities.map((activity, index) => (
                  <motion.span
                    key={`${activity.kind}-${activity.reg}-${activity.value ?? index}`}
                    initial={{ opacity: 0.4, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.22 }}
                    className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-sm text-slate-100"
                  >
                    r{activity.reg} {activity.label}
                    {activity.value ? ` ${activity.value}` : ""}
                  </motion.span>
                ))
              ) : (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">
                  本拍没有寄存器变化
                </span>
              )}
            </div>
          </div>
        ) : null}

        <div className="rounded-[26px] border border-emerald-300/18 bg-[linear-gradient(180deg,rgba(6,78,59,0.34),rgba(2,6,23,0.92))] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-100">路径提示</p>
            <span className="text-xs text-slate-400">来源 / 去向</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {flowHints.length ? (
              flowHints.map((hint) => (
                <span
                  key={`${hint.fromStage}-${hint.toStage}-${hint.label}`}
                  className={`rounded-full border px-3 py-2 text-sm ${hintClasses[hint.tone]}`}
                >
                  {hint.fromStage.toUpperCase()} -&gt; {hint.toStage.toUpperCase()} {hint.label}
                </span>
              ))
            ) : (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">
                本拍按顺序推进
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
