import type { PipelineStageKey, TraceDocument } from "@/features/trace/types";

export type HazardHintTone = "cyan" | "amber" | "rose" | "emerald";

export interface HazardStageHighlight {
  stage: PipelineStageKey;
  label: string;
  tone: HazardHintTone;
}

export interface HazardFlowHint {
  fromStage: PipelineStageKey;
  toStage: PipelineStageKey;
  label: string;
  tone: HazardHintTone;
  lane?: number;
}

export interface HazardPuzzleInput {
  trace: TraceDocument;
  focusStepIndex: number;
  focusStage: PipelineStageKey | null;
}

export interface HazardPuzzleFeedback {
  status: "pending" | "correct" | "incorrect";
  explanation?: string;
  highlightStages: PipelineStageKey[];
  stageHighlights: HazardStageHighlight[];
  flowHints: HazardFlowHint[];
}

