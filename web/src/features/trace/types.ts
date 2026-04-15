export const pipelineStageKeys = ["if", "id", "ex", "mem", "wb"] as const;

export type PipelineStageKey = (typeof pipelineStageKeys)[number];

export interface TracePipelineStage {
  state: string;
  pc?: string;
  raw?: string;
  op?: string;
}

export interface TracePipelineSnapshot {
  cycle: number;
  if: TracePipelineStage;
  id: TracePipelineStage;
  ex: TracePipelineStage;
  mem: TracePipelineStage;
  wb: TracePipelineStage;
  stall: boolean;
  stall_reason?: string | null;
  bubble: string[];
  flush: string[];
}

export interface GprChange {
  reg: number;
  value: string;
}

export interface TraceMetaRecord {
  type: "meta";
  program: string;
  load_base?: string;
  entry_pc?: string;
  max_steps?: number | null;
  pipeline_mode?: boolean;
}

export interface TraceStepRecord {
  type: "step";
  step: number;
  pc: string;
  raw: string;
  op: string;
  rd: number | null;
  rj: number | null;
  rk: number | null;
  imm: number | null;
  next_pc?: string;
  running?: boolean;
  exit_code?: number | null;
  branched?: boolean | null;
  gpr_changes: GprChange[];
  mem_write?: unknown | null;
  uart?: unknown | null;
  pipeline: TracePipelineSnapshot | null;
}

export interface TraceSummaryRecord {
  type: "summary";
  pc?: string;
  last_inst?: string;
  running?: boolean;
  exit_code?: number | null;
  regs: string[];
}

export interface TraceDocument {
  sourceName: string;
  meta: TraceMetaRecord | null;
  steps: TraceStepRecord[];
  summary: TraceSummaryRecord | null;
}

