import type {
  GprChange,
  PipelineStageKey,
  TraceDocument,
  TraceStepRecord
} from "@/features/trace/types";
import { sampleTraceOptions } from "@/features/trace/sources";
import type { TagTone } from "@/components/Tag";
import type {
  HazardFlowHint,
  HazardStageHighlight
} from "@/features/lesson_hazard/contracts";

export type TimelineEntry<T> = {
  stepNumber: number;
  item: T;
};

export const sampleOptionById = new Map(
  sampleTraceOptions.map((option) => [option.id, option])
);

export const topSampleIds = [
  "smoke",
  "uart",
  "pipeline-branch",
  "timer-interrupt",
  "invalid-unhandled"
];

export const stopReasonGuide = [
  {
    id: "halt_instruction",
    label: "正常结束",
    detail: "程序执行到了模拟器的 HALT 指令，因此按正常路径结束。",
    tone: "emerald" as TagTone
  },
  {
    id: "trap_terminated",
    label: "陷入终止",
    detail: "程序进入异常向量后没有恢复执行，因此停在 trap 终止状态。",
    tone: "rose" as TagTone
  },
  {
    id: "runtime_error",
    label: "运行时错误",
    detail: "当前执行模式拒绝该程序，例如流水线教学模式遇到未支持指令。",
    tone: "amber" as TagTone
  },
  {
    id: "max_steps_reached",
    label: "步数耗尽",
    detail: "程序尚未正常结束，但配置的最大执行步数已经用完。",
    tone: "cyan" as TagTone
  }
];

export function clampStepIndex(nextIndex: number, trace: TraceDocument | null) {
  if (!trace?.steps.length) {
    return 0;
  }

  return Math.max(0, Math.min(nextIndex, trace.steps.length - 1));
}

export function formatRegister(reg: number | null | undefined) {
  return reg === null || reg === undefined ? "-" : `r${reg}`;
}

export function getStopReasonTone(reason: string | undefined): TagTone {
  if (reason === "halt_instruction") return "emerald";
  if (reason === "trap_terminated") return "rose";
  if (reason === "runtime_error") return "amber";
  if (reason === "max_steps_reached") return "cyan";
  return "neutral";
}

export function getBranchTag(step: TraceStepRecord) {
  if (step.branched === true) return { label: "分支命中", tone: "rose" as TagTone };
  if (step.branched === false) return { label: "分支未命中", tone: "emerald" as TagTone };
  return null;
}

export function getTrapEventTag(step: TraceStepRecord) {
  if (step.exception) return { label: "异常", tone: "rose" as TagTone };
  if (step.interrupt) return { label: "中断", tone: "amber" as TagTone };
  return { label: "稳定执行", tone: "neutral" as TagTone };
}

function normalizeStageKey(value: string): PipelineStageKey | null {
  const normalized = value.trim().toLowerCase();
  return normalized === "if"
    || normalized === "id"
    || normalized === "ex"
    || normalized === "mem"
    || normalized === "wb"
    ? normalized
    : null;
}

export function buildPipelineVisuals(step: TraceStepRecord): {
  stageHighlights: HazardStageHighlight[];
  flowHints: HazardFlowHint[];
} {
  if (!step.pipeline) {
    return { stageHighlights: [], flowHints: [] };
  }

  const stageHighlights: HazardStageHighlight[] = [];
  const flowHints: HazardFlowHint[] = [];

  if (step.pipeline.stall) {
    stageHighlights.push({
      stage: "id",
      label: step.pipeline.load_use ? "load-use" : "停顿",
      tone: "amber"
    });
  }

  step.pipeline.bubble.forEach((stageName) => {
    const stage = normalizeStageKey(stageName);
    if (stage) stageHighlights.push({ stage, label: "气泡", tone: "amber" });
  });

  step.pipeline.flush.forEach((stageName) => {
    const stage = normalizeStageKey(stageName);
    if (stage) stageHighlights.push({ stage, label: "冲刷", tone: "rose" });
  });

  if (step.branched === true) {
    stageHighlights.push({ stage: "ex", label: "命中", tone: "rose" });
  } else if (step.branched === false) {
    stageHighlights.push({ stage: "ex", label: "未命中", tone: "emerald" });
  }

  step.pipeline.forwarding.forEach((forwarding, index) => {
    const fromStage = normalizeStageKey(forwarding.from_stage);
    const toStage = normalizeStageKey(forwarding.to_stage);
    if (!fromStage || !toStage) return;
    flowHints.push({
      fromStage,
      toStage,
      label: `r${forwarding.reg} ${forwarding.operand}`,
      tone: "cyan",
      lane: index
    });
  });

  if (step.pipeline.redirect_pc) {
    flowHints.push({
      fromStage: "ex",
      toStage: "if",
      label: "改道",
      tone: "rose",
      lane: flowHints.length
    });
  }

  return { stageHighlights, flowHints };
}

export function collectUartOutput(steps: TraceStepRecord[], stepIndex: number) {
  let output = "";
  for (let index = 0; index <= stepIndex && index < steps.length; index += 1) {
    const step = steps[index];
    if (step.uart) {
      output += step.uart;
      continue;
    }
    step.device_events.forEach((event) => {
      if (event.device === "uart" && event.kind === "tx" && event.text) {
        output += event.text;
      }
    });
  }
  return output;
}

export function collectRecentItems<T>(
  steps: TraceStepRecord[],
  stepIndex: number,
  picker: (step: TraceStepRecord) => T[],
  limit: number
): Array<TimelineEntry<T>> {
  const results: Array<TimelineEntry<T>> = [];

  for (let index = Math.min(stepIndex, steps.length - 1); index >= 0; index -= 1) {
    const currentStep = steps[index];
    const items = picker(currentStep);

    for (let itemIndex = items.length - 1; itemIndex >= 0; itemIndex -= 1) {
      results.push({ stepNumber: currentStep.step, item: items[itemIndex] });
      if (results.length >= limit) return results;
    }
  }

  return results;
}

export function findLastWriteback(
  steps: TraceStepRecord[],
  stepIndex: number
): { stepNumber: number; change: GprChange } | null {
  for (let index = Math.min(stepIndex, steps.length - 1); index >= 0; index -= 1) {
    const changes = steps[index].gpr_changes;
    const change = changes.length ? changes[changes.length - 1] : null;
    if (change) return { stepNumber: steps[index].step, change };
  }
  return null;
}

export function getPipelinePulseTone(step: TraceStepRecord) {
  if (step.pipeline?.flush.length || step.branched) return "rose" as const;
  if (step.pipeline?.stall || step.pipeline?.bubble.length) return "amber" as const;
  if (step.pipeline?.forwarding.length) return "cyan" as const;
  return "emerald" as const;
}

export function getErtnSummary(step: TraceStepRecord) {
  if (step.op !== "ERTN") return "当前步骤没有执行 ERTN。";
  return `ERTN 会返回到 ${step.next_pc ?? step.trap_state.epc}，同时清除 EXL。`;
}
