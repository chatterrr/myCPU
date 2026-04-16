import { motion } from "motion/react";
import type { PipelineStageKey, TraceStepRecord } from "@/features/trace/types";
import {
  findTokenOriginStage,
  getPipelineTokens,
  getStageChineseLabel,
  type PipelineToken
} from "@/features/pipeline/visuals";

const sceneMetrics = {
  width: 1180,
  height: 760,
  laneWidth: 180,
  tokenWidth: 160,
  tokenHeight: 78
} as const;

const stagePositions: Record<PipelineStageKey, { x: number; y: number }> = {
  if: { x: 590, y: 120 },
  id: { x: 245, y: 330 },
  ex: { x: 590, y: 330 },
  mem: { x: 935, y: 330 },
  wb: { x: 590, y: 560 }
};

const stageZoneClasses: Record<string, string> = {
  if: "border-cyan-300/30 bg-cyan-950/30 text-cyan-50",
  id: "border-amber-300/28 bg-amber-950/28 text-amber-50",
  ex: "border-emerald-300/28 bg-emerald-950/28 text-emerald-50",
  mem: "border-sky-300/28 bg-sky-950/28 text-sky-50",
  wb: "border-lime-300/28 bg-lime-950/24 text-lime-50"
};

const carClasses: Record<string, string> = {
  fetch:
    "border-cyan-300/45 bg-[linear-gradient(180deg,rgba(34,211,238,0.25),rgba(8,47,73,0.22))] text-cyan-50",
  occupied:
    "border-emerald-300/45 bg-[linear-gradient(180deg,rgba(16,185,129,0.25),rgba(6,78,59,0.22))] text-emerald-50",
  stalled:
    "border-amber-300/50 bg-[linear-gradient(180deg,rgba(251,191,36,0.3),rgba(120,53,15,0.22))] text-amber-50",
  flushed:
    "border-rose-300/55 bg-[linear-gradient(180deg,rgba(251,113,133,0.34),rgba(136,19,55,0.22))] text-rose-50",
  bubble:
    "border-amber-200/50 bg-[linear-gradient(180deg,rgba(250,204,21,0.28),rgba(120,53,15,0.18))] text-amber-50"
};

function getTokenPosition(stage: PipelineStageKey) {
  const center = stagePositions[stage];

  return {
    x: center.x - sceneMetrics.tokenWidth / 2,
    y: center.y - sceneMetrics.tokenHeight / 2
  };
}

function getStagePrompt(stage: PipelineStageKey) {
  switch (stage) {
    case "if":
      return "入口控制点";
    case "id":
      return "等待区控制点";
    case "ex":
      return "路口控制点";
    case "mem":
      return "访存通道";
    case "wb":
      return "回写出口";
  }
}

function renderCarLamp(token: PipelineToken) {
  if (token.state === "stalled") {
    return "bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.9)]";
  }

  if (token.state === "flushed") {
    return "bg-rose-300 shadow-[0_0_18px_rgba(251,113,133,0.9)]";
  }

  if (token.kind === "bubble") {
    return "bg-amber-200 shadow-[0_0_18px_rgba(250,204,21,0.75)]";
  }

  return "bg-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.85)]";
}

export function TrafficIntersectionBoard({
  step,
  previousStep = null,
  playerPosition,
  nearbyStage,
  focusStage,
  selectedVehicleKey,
  onVehicleSelect
}: {
  step: TraceStepRecord;
  previousStep?: TraceStepRecord | null;
  playerPosition: { x: number; y: number };
  nearbyStage: PipelineStageKey | null;
  focusStage: PipelineStageKey;
  selectedVehicleKey: string | null;
  onVehicleSelect: (vehicleKey: string) => void;
}) {
  const tokens = getPipelineTokens(step);

  return (
    <div className="overflow-x-auto">
      <div
        className="relative rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.08),_transparent_26%),linear-gradient(180deg,rgba(2,6,23,0.95),rgba(4,8,22,0.88))] p-5"
        style={{ minWidth: `${sceneMetrics.width}px` }}
      >
        <div
          className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,47,73,0.1),rgba(2,6,23,0.08))]"
          style={{ height: `${sceneMetrics.height}px` }}
        >
          <div className="absolute left-1/2 top-0 h-full w-[180px] -translate-x-1/2 bg-slate-900/60" />
          <div className="absolute left-0 top-1/2 h-[180px] w-full -translate-y-1/2 bg-slate-900/60" />

          <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 border-l border-dashed border-slate-600/60" />
          <div className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 border-t border-dashed border-slate-600/60" />

          {step.pipeline?.flush.length ? (
            <motion.div
              key={`traffic-flush-${step.pipeline.cycle}`}
              initial={{ opacity: 0, x: -120 }}
              animate={{ opacity: [0, 0.85, 0], x: [0, 240, 460] }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className="pointer-events-none absolute left-[120px] top-[160px] h-[220px] w-[540px] rounded-full bg-[linear-gradient(90deg,rgba(244,63,94,0),rgba(244,63,94,0.18),rgba(244,63,94,0.52),rgba(244,63,94,0))] blur-md"
            />
          ) : null}

          {(
            Object.entries(stagePositions) as Array<
              [PipelineStageKey, { x: number; y: number }]
            >
          ).map(([stageKey, position]) => {
            const isNearby = nearbyStage === stageKey;
            const isFocus = focusStage === stageKey;

            return (
              <div
                key={stageKey}
                className={`absolute h-[104px] w-[168px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border p-4 ${stageZoneClasses[stageKey]} ${isFocus ? "shadow-[0_0_40px_rgba(34,211,238,0.16)]" : ""} ${isNearby ? "ring-2 ring-white/25" : ""}`}
                style={{ left: `${position.x}px`, top: `${position.y}px` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-white/70">
                      {stageKey.toUpperCase()}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {getStageChineseLabel(stageKey)}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-white/80">
                    {getStagePrompt(stageKey)}
                  </span>
                </div>
              </div>
            );
          })}

          {tokens.map((token) => {
            const originStage = findTokenOriginStage(token, previousStep);
            const fromPosition = getTokenPosition(originStage);
            const toPosition = getTokenPosition(token.stage);
            const isSelected = selectedVehicleKey === token.instructionKey;

            return (
              <motion.button
                key={`${token.instructionKey}-${token.stage}`}
                type="button"
                initial={{
                  x: fromPosition.x,
                  y: fromPosition.y,
                  opacity: token.kind === "bubble" ? 0 : 0.4,
                  scale: token.kind === "bubble" ? 0.72 : 0.95
                }}
                animate={{
                  x: toPosition.x,
                  y: toPosition.y,
                  opacity: 1,
                  scale: token.state === "stalled" ? [1, 1.03, 1] : 1
                }}
                transition={{ duration: 0.66, ease: "easeInOut" }}
                onClick={() => onVehicleSelect(token.instructionKey)}
                className={`absolute left-0 top-0 h-[78px] w-[160px] rounded-[22px] border p-3 text-left backdrop-blur transition hover:-translate-y-0.5 ${carClasses[token.state] ?? carClasses.occupied} ${isSelected ? "ring-2 ring-white/55 shadow-[0_0_30px_rgba(255,255,255,0.16)]" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] opacity-75">
                      {token.stage.toUpperCase()}
                    </p>
                    <p className="mt-2 text-lg font-semibold leading-5">
                      {token.title}
                    </p>
                  </div>
                  <span
                    className={`mt-1 h-3.5 w-3.5 rounded-full ${renderCarLamp(token)}`}
                  />
                </div>
                <p className="mt-3 truncate text-xs opacity-80">
                  {token.pc ?? token.subtitle}
                </p>
              </motion.button>
            );
          })}

          <motion.div
            animate={{ x: playerPosition.x, y: playerPosition.y }}
            transition={{ type: "spring", stiffness: 260, damping: 26, mass: 0.6 }}
            className="absolute left-0 top-0 h-10 w-10 rounded-full border border-white/40 bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.9),rgba(34,211,238,0.6),rgba(14,116,144,0.95))] shadow-[0_0_28px_rgba(34,211,238,0.45)]"
          >
            <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-950/80" />
          </motion.div>

          {nearbyStage ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute rounded-[20px] border border-cyan-300/25 bg-slate-950/88 px-4 py-3 text-sm text-slate-100 shadow-[0_20px_40px_rgba(2,6,23,0.38)]"
              style={{
                left: `${stagePositions[nearbyStage].x + 96}px`,
                top: `${stagePositions[nearbyStage].y - 32}px`
              }}
            >
              靠近 {getStagePrompt(nearbyStage)}
            </motion.div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
