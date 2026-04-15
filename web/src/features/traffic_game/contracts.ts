import type {
  PipelineStageKey,
  TracePipelineSnapshot
} from "@/features/trace/types";

export interface TrafficGameFrame {
  snapshot: TracePipelineSnapshot;
  controllableStages: PipelineStageKey[];
}

export interface TrafficGameAction {
  stage: PipelineStageKey;
  action: "hold" | "advance" | "flush";
  reason: string;
}

export const trafficGameContractNotes = [
  "Input: one pipeline snapshot per frame plus stage-control affordances.",
  "Action model: hold, advance, or flush on a named pipeline stage.",
  "Output: scored frame updates can layer on top of the current Pixi stage."
];
