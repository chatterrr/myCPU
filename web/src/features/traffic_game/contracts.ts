import type {
  HazardFlowHint,
  HazardHintTone,
  HazardStageHighlight
} from "@/features/lesson_hazard/contracts";
import type {
  PipelineStageKey,
  TraceDocument,
  TraceStepRecord
} from "@/features/trace/types";

export type DispatchBlockKind =
  | "alu"
  | "forward"
  | "load-use"
  | "branch-flush";

export type DispatchPieceState = "falling" | "locked" | "cleared";

export interface DispatchCellPoint {
  x: number;
  y: number;
}

export interface DispatchInstructionMeta {
  op: string;
  raw: string;
  pc: string;
  rd: number | null;
  rj: number | null;
  rk: number | null;
  imm: number | null;
}

export interface DispatchBlueprint {
  id: string;
  kind: DispatchBlockKind;
  title: string;
  shortLabel: string;
  cue: string;
  description: string;
  traceSampleId: string;
  stepWindowStart: number;
  stepWindowEnd: number;
  anchorStepIndex: number;
  anchorStage: PipelineStageKey;
  rotations: ReadonlyArray<ReadonlyArray<DispatchCellPoint>>;
  tone: HazardHintTone;
  stageHighlights: HazardStageHighlight[];
  flowHints: HazardFlowHint[];
}

export interface ResolvedDispatchBlueprint extends DispatchBlueprint {
  trace: TraceDocument;
  instructionKey: string;
  instruction: DispatchInstructionMeta;
}

export interface DispatchPiece {
  id: string;
  blueprintId: string;
  kind: DispatchBlockKind;
  row: number;
  col: number;
  rotation: number;
  progress: number;
  maxProgress: number;
  state: DispatchPieceState;
  instructionKey: string;
  instruction: DispatchInstructionMeta;
}

export interface DispatchBoardCell {
  blockId: string;
}

export interface DispatchSession {
  board: Array<Array<DispatchBoardCell | null>>;
  pieces: Record<string, DispatchPiece>;
  activePieceId: string | null;
  nextBlueprintIds: string[];
  selectedBlockId: string | null;
  nextSerial: number;
  score: number;
  lines: number;
  lockedCount: number;
  gameOver: boolean;
  paused: boolean;
  lastActionLabel: string;
  lastEventLabel: string;
}

export interface DispatchPieceSnapshot {
  piece: DispatchPiece;
  blueprint: ResolvedDispatchBlueprint;
  currentStepIndex: number;
  currentStep: TraceStepRecord;
  previousStep: TraceStepRecord | null;
  activeStage: PipelineStageKey | null;
  pipelineState: string;
  hazardText: string;
  stageHighlights: HazardStageHighlight[];
  flowHints: HazardFlowHint[];
}

export const dispatchKindLabels: Record<DispatchBlockKind, string> = {
  alu: "算术推进",
  forward: "旁路直送",
  "load-use": "装载停顿",
  "branch-flush": "分支冲刷"
};
