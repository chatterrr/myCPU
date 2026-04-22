export const pipelineStageKeys = ["if", "id", "ex", "mem", "wb"] as const;

export type PipelineStageKey = (typeof pipelineStageKeys)[number];
export type TraceMode = "interpreter" | "pipeline";

export interface TracePipelineStage {
  state: string;
  pc?: string;
  raw?: string;
  op?: string;
}

export interface TracePipelineForwarding {
  from_stage: string;
  to_stage: string;
  operand: string;
  reg: number;
  value: string;
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
  load_use: boolean;
  forwarding: TracePipelineForwarding[];
  redirect_pc?: string | null;
}

export interface GprChange {
  reg: number;
  value: string;
}

export interface TraceDeviceMapEntry {
  name: string;
  base?: string;
  size?: string;
}

export interface TraceTrapState {
  cause: string;
  epc: string;
  vector: string;
  badv: string;
  status: string;
  exl: boolean;
  pending_interrupt: boolean;
  last_trap_was_interrupt: boolean;
}

export interface TraceMemoryAccess {
  kind: string;
  addr: string;
  value: string;
  width: number;
  target: string;
  via: "bus" | "memory";
}

export interface TraceDeviceEvent {
  device: string;
  kind: string;
  addr?: string;
  value?: string;
  width?: number;
  text?: string;
  cause?: string;
}

export interface TraceMemWrite {
  addr: string;
  value: string;
}

export interface TraceTimerState {
  control: string;
  interval: number;
  remaining: number;
  enabled: boolean;
  periodic: boolean;
  interrupt_enabled: boolean;
}

export interface TraceMetaRecord {
  type: "meta";
  schema_version?: string;
  program: string;
  mode?: TraceMode;
  load_base?: string;
  entry_pc?: string;
  max_steps?: number | null;
  pipeline_mode?: boolean;
  device_map: TraceDeviceMapEntry[];
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
  trap_state: TraceTrapState;
  exception?: boolean | null;
  interrupt?: boolean | null;
  cause?: string | null;
  epc?: string | null;
  vector?: string | null;
  badv?: string | null;
  branched?: boolean | null;
  gpr_changes: GprChange[];
  memory_accesses: TraceMemoryAccess[];
  device_events: TraceDeviceEvent[];
  mem_write?: TraceMemWrite | null;
  uart?: string | null;
  timer?: TraceTimerState | null;
  pipeline: TracePipelineSnapshot | null;
}

export interface TraceSummaryRecord {
  type: "summary";
  schema_version?: string;
  mode?: TraceMode;
  steps?: number;
  pc?: string;
  last_inst?: string;
  epc?: string;
  vector?: string;
  badv?: string;
  cause?: string;
  stop_reason?: string;
  status?: string;
  exl?: boolean;
  running?: boolean;
  last_trap_was_interrupt?: boolean;
  pending_interrupt?: boolean;
  exit_code?: number | null;
  error_message?: string | null;
  regs: string[];
}

export interface TraceDocument {
  sourceName: string;
  meta: TraceMetaRecord | null;
  steps: TraceStepRecord[];
  summary: TraceSummaryRecord | null;
  inferredMode: TraceMode;
}
