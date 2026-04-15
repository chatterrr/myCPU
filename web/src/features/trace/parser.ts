import type {
  GprChange,
  TraceDocument,
  TraceMetaRecord,
  TracePipelineSnapshot,
  TracePipelineStage,
  TraceStepRecord,
  TraceSummaryRecord
} from "@/features/trace/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function normalizePipelineStage(value: unknown): TracePipelineStage {
  if (!isRecord(value)) {
    return { state: "empty" };
  }

  return {
    state: readString(value.state, "empty"),
    pc: typeof value.pc === "string" ? value.pc : undefined,
    raw: typeof value.raw === "string" ? value.raw : undefined,
    op: typeof value.op === "string" ? value.op : undefined
  };
}

function normalizePipelineSnapshot(value: unknown): TracePipelineSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    cycle: readNumber(value.cycle) ?? 0,
    if: normalizePipelineStage(value.if),
    id: normalizePipelineStage(value.id),
    ex: normalizePipelineStage(value.ex),
    mem: normalizePipelineStage(value.mem),
    wb: normalizePipelineStage(value.wb),
    stall: readBoolean(value.stall) ?? false,
    stall_reason:
      typeof value.stall_reason === "string" ? value.stall_reason : null,
    bubble: readStringArray(value.bubble),
    flush: readStringArray(value.flush)
  };
}

function normalizeGprChanges(value: unknown): GprChange[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const reg = readNumber(item.reg);
    const rawValue = item.value;

    if (reg === null || typeof rawValue !== "string") {
      return [];
    }

    return [{ reg, value: rawValue }];
  });
}

function normalizeMetaRecord(value: Record<string, unknown>): TraceMetaRecord {
  return {
    type: "meta",
    program: readString(value.program, "unknown"),
    load_base: typeof value.load_base === "string" ? value.load_base : undefined,
    entry_pc: typeof value.entry_pc === "string" ? value.entry_pc : undefined,
    max_steps: readNumber(value.max_steps),
    pipeline_mode: readBoolean(value.pipeline_mode) ?? undefined
  };
}

function normalizeStepRecord(value: Record<string, unknown>): TraceStepRecord {
  return {
    type: "step",
    step: readNumber(value.step) ?? 0,
    pc: readString(value.pc, "0x00000000"),
    raw: readString(value.raw, "0x00000000"),
    op: readString(value.op, "UNKNOWN"),
    rd: readNumber(value.rd),
    rj: readNumber(value.rj),
    rk: readNumber(value.rk),
    imm: readNumber(value.imm),
    next_pc: typeof value.next_pc === "string" ? value.next_pc : undefined,
    running: readBoolean(value.running) ?? undefined,
    exit_code: readNumber(value.exit_code),
    branched: readBoolean(value.branched),
    gpr_changes: normalizeGprChanges(value.gpr_changes),
    mem_write: value.mem_write ?? null,
    uart: value.uart ?? null,
    pipeline: normalizePipelineSnapshot(value.pipeline)
  };
}

function normalizeSummaryRecord(value: Record<string, unknown>): TraceSummaryRecord {
  return {
    type: "summary",
    pc: typeof value.pc === "string" ? value.pc : undefined,
    last_inst: typeof value.last_inst === "string" ? value.last_inst : undefined,
    running: readBoolean(value.running) ?? undefined,
    exit_code: readNumber(value.exit_code),
    regs: readStringArray(value.regs)
  };
}

export function parseTraceJsonl(text: string, sourceName: string): TraceDocument {
  const steps: TraceStepRecord[] = [];
  let meta: TraceMetaRecord | null = null;
  let summary: TraceSummaryRecord | null = null;

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new Error(
        `Trace parse error at line ${index + 1}: ${(error as Error).message}`
      );
    }

    if (!isRecord(parsed) || typeof parsed.type !== "string") {
      throw new Error(`Trace line ${index + 1} is missing a record type.`);
    }

    if (parsed.type === "meta") {
      meta = normalizeMetaRecord(parsed);
      return;
    }

    if (parsed.type === "step") {
      steps.push(normalizeStepRecord(parsed));
      return;
    }

    if (parsed.type === "summary") {
      summary = normalizeSummaryRecord(parsed);
      return;
    }
  });

  if (!steps.length) {
    throw new Error("No step records found in trace file.");
  }

  return {
    sourceName,
    meta,
    steps,
    summary
  };
}

