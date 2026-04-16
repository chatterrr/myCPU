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
  hold: "Hold",
  advance: "Advance",
  flush: "Flush"
};

export const trafficActionTones: Record<TrafficGameActionType, HazardHintTone> = {
  hold: "amber",
  advance: "cyan",
  flush: "rose"
};

export const trafficGameContractNotes = [
  "Input: one pipeline snapshot per frame plus stage-control affordances.",
  "Action model: hold, advance, or flush on a named pipeline stage.",
  "Output: scored frame updates can layer on top of the current Pixi stage.",
  "M10 route: action-driven feedback reuses the same highlight and flow primitives from the hazard lesson."
];
