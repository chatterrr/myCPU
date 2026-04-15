import type { PipelineStageKey, TraceDocument } from "@/features/trace/types";

export interface HazardPuzzleInput {
  trace: TraceDocument;
  focusStepIndex: number;
  focusStage: PipelineStageKey | null;
}

export interface HazardPuzzleFeedback {
  status: "pending" | "correct" | "incorrect";
  explanation?: string;
  highlightStages: PipelineStageKey[];
}

export const hazardLessonContractNotes = [
  "Input: TraceDocument plus the currently focused cycle and stage.",
  "Output: classification feedback, explanation text, and stage highlights.",
  "UI hook: reuse the existing cycle inspector without changing trace schema."
];

