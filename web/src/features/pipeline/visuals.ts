import { pipelineStageOrder } from "@/features/pipeline/palette";
import type {
  PipelineStageKey,
  TracePipelineStage,
  TraceStepRecord
} from "@/features/trace/types";

export type PipelineTone = "cyan" | "amber" | "emerald" | "rose" | "neutral";

export interface PipelineToken {
  stage: PipelineStageKey;
  instructionKey: string;
  kind: "instruction" | "bubble";
  state: string;
  title: string;
  subtitle: string;
  op?: string;
  pc?: string;
  raw?: string;
}

export interface RegisterActivity {
  reg: number;
  kind: "read" | "write" | "target";
  label: string;
  value?: string;
}

const stateLabelMap: Record<string, string> = {
  empty: "空槽",
  fetch: "取指",
  occupied: "执行中",
  stalled: "暂停",
  flushed: "冲刷",
  bubble: "气泡"
};

const stageLabelMap: Record<PipelineStageKey, string> = {
  if: "取指",
  id: "译码",
  ex: "执行",
  mem: "访存",
  wb: "写回"
};

const emptyStage: TracePipelineStage = { state: "empty" };

function buildInstructionKey(stage: TracePipelineStage): string | null {
  if (!stage.op && !stage.raw && !stage.pc) {
    return null;
  }

  return [stage.op ?? "-", stage.raw ?? "-", stage.pc ?? "-"].join("|");
}

function buildStageToken(
  stageKey: PipelineStageKey,
  stage: TracePipelineStage
): PipelineToken | null {
  const instructionKey = buildInstructionKey(stage);

  if (!instructionKey) {
    return null;
  }

  if (stage.state === "stalled" && !stage.op) {
    return {
      stage: stageKey,
      instructionKey,
      kind: "instruction",
      state: stage.state,
      title: "暂停",
      subtitle: stage.pc ?? "保持原位",
      op: stage.op,
      pc: stage.pc,
      raw: stage.raw
    };
  }

  if (stage.state === "flushed" && !stage.op) {
    return {
      stage: stageKey,
      instructionKey,
      kind: "instruction",
      state: stage.state,
      title: "冲刷",
      subtitle: stage.pc ?? "错误路径",
      op: stage.op,
      pc: stage.pc,
      raw: stage.raw
    };
  }

  return {
    stage: stageKey,
    instructionKey,
    kind: "instruction",
    state: stage.state,
    title: stage.op ?? stateLabelMap[stage.state] ?? "指令",
    subtitle: stage.pc ?? "-",
    op: stage.op,
    pc: stage.pc,
    raw: stage.raw
  };
}

export function normalizeStageLabel(stage: string): PipelineStageKey | null {
  const normalized = stage.trim().toLowerCase();

  return pipelineStageOrder.find((entry) => entry.key === normalized)?.key ?? null;
}

export function getStageStateLabel(state: string): string {
  return stateLabelMap[state] ?? state;
}

export function getStageChineseLabel(stage: PipelineStageKey): string {
  return stageLabelMap[stage];
}

export function getStageIndex(stage: PipelineStageKey): number {
  return pipelineStageOrder.findIndex((entry) => entry.key === stage);
}

export function getPipelineTokens(step: TraceStepRecord | null): PipelineToken[] {
  if (!step?.pipeline) {
    return [];
  }

  const tokens: PipelineToken[] = [];

  pipelineStageOrder.forEach((stageRef) => {
    const snapshot = step.pipeline?.[stageRef.key] ?? emptyStage;
    const token = buildStageToken(stageRef.key, snapshot);

    if (token) {
      tokens.push(token);
    }
  });

  step.pipeline.bubble.forEach((stageName, index) => {
    const stageKey = normalizeStageLabel(stageName);

    if (!stageKey) {
      return;
    }

    tokens.push({
      stage: stageKey,
      instructionKey: `bubble|${stageKey}|${step.pipeline?.cycle ?? 0}|${index}`,
      kind: "bubble",
      state: "bubble",
      title: "Bubble",
      subtitle: "插入空泡"
    });
  });

  return tokens;
}

export function findTokenOriginStage(
  token: PipelineToken,
  previousStep: TraceStepRecord | null | undefined
): PipelineStageKey {
  if (!previousStep) {
    return token.stage;
  }

  const previousToken = getPipelineTokens(previousStep).find(
    (candidate) =>
      candidate.kind === token.kind
      && candidate.instructionKey === token.instructionKey
  );

  return previousToken?.stage ?? token.stage;
}

export function getRegisterActivities(step: TraceStepRecord): RegisterActivity[] {
  const activities: RegisterActivity[] = [];

  if (step.rj !== null && step.rj !== undefined) {
    activities.push({ reg: step.rj, kind: "read", label: "读 rj" });
  }

  if (step.rk !== null && step.rk !== undefined) {
    activities.push({ reg: step.rk, kind: "read", label: "读 rk" });
  }

  if (step.rd !== null && step.rd !== undefined) {
    activities.push({ reg: step.rd, kind: "target", label: "目标 rd" });
  }

  step.gpr_changes.forEach((change) => {
    activities.push({
      reg: change.reg,
      kind: "write",
      label: "写回",
      value: change.value
    });
  });

  return activities;
}

export function describePipelinePulse(
  step: TraceStepRecord,
  preferredTone: PipelineTone = "neutral"
): { label: string; tone: PipelineTone } {
  if (step.pipeline?.flush.length || step.branched) {
    return { label: "冲刷错误路径", tone: "rose" };
  }

  if (step.pipeline?.stall) {
    return {
      label: step.pipeline.stall_reason ? "暂停等待数据" : "暂停",
      tone: "amber"
    };
  }

  if (step.pipeline?.bubble.length) {
    return { label: "插入气泡", tone: "amber" };
  }

  if (preferredTone !== "neutral") {
    return {
      label: preferredTone === "cyan" ? "旁路继续推进" : "稳定推进",
      tone: preferredTone
    };
  }

  return { label: "逐拍推进", tone: "emerald" };
}
