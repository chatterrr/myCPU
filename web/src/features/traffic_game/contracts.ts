import type {
  HazardFlowHint,
  HazardHintTone,
  HazardStageHighlight
} from "@/features/lesson_hazard/contracts";
import type {
  PipelineStageKey,
  TracePipelineSnapshot
} from "@/features/trace/types";

export type TrafficGameActionType = "hold" | "advance" | "flush";

export interface TrafficGameFrame {
  snapshot: TracePipelineSnapshot;
  controllableStages: PipelineStageKey[];
}

export interface TrafficGameAction {
  stage: PipelineStageKey;
  action: TrafficGameActionType;
  reason: string;
}

export interface TrafficGameActionFeedback {
  text: string;
  stageHighlights: HazardStageHighlight[];
  flowHints: HazardFlowHint[];
}

export interface TrafficGameChoiceDescriptor extends TrafficGameAction {
  label: string;
  detail: string;
  cue: string;
  tone: HazardHintTone;
  feedback: TrafficGameActionFeedback;
}

export const trafficActionLabels: Record<TrafficGameActionType, string> = {
  hold: "暂停",
  advance: "放行",
  flush: "冲刷"
};

export const trafficActionTones: Record<TrafficGameActionType, HazardHintTone> = {
  hold: "amber",
  advance: "cyan",
  flush: "rose"
};

export const trafficGameContractNotes = [
  "输入：一拍流水线快照，以及当前可控制的 stage。",
  "动作：对指定 stage 执行放行、暂停或冲刷。",
  "输出：沿用高亮、流向和短反馈，不改 trace 协议。",
  "页面：交通调度台只换交互映射，不脱离原有流水线逻辑。"
];
