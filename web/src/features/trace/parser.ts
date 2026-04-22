import type {
  GprChange,
  TraceDeviceEvent,
  TraceDeviceMapEntry,
  TraceDocument,
  TraceMemWrite,
  TraceMemoryAccess,
  TraceMetaRecord,
  TraceMode,
  TracePipelineForwarding,
  TracePipelineSnapshot,
  TracePipelineStage,
  TraceStepRecord,
  TraceSummaryRecord,
  TraceTimerState,
  TraceTrapState
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

function readMode(value: unknown): TraceMode | undefined {
  return value === "interpreter" || value === "pipeline" ? value : undefined;
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

function normalizePipelineForwarding(value: unknown): TracePipelineForwarding[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const reg = readNumber(item.reg);
    const valueText = typeof item.value === "string" ? item.value : null;
    if (reg === null || valueText === null) {
      return [];
    }

    return [
      {
        from_stage: readString(item.from_stage, "unknown"),
        to_stage: readString(item.to_stage, "unknown"),
        operand: readString(item.operand, "src"),
        reg,
        value: valueText
      }
    ];
  });
}

function normalizePipelineSnapshot(value: unknown): TracePipelineSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const stall = readBoolean(value.stall) ?? false;
  const stallReason =
    typeof value.stall_reason === "string" ? value.stall_reason : null;
  const bubble = readStringArray(value.bubble);

  return {
    cycle: readNumber(value.cycle) ?? 0,
    if: normalizePipelineStage(value.if),
    id: normalizePipelineStage(value.id),
    ex: normalizePipelineStage(value.ex),
    mem: normalizePipelineStage(value.mem),
    wb: normalizePipelineStage(value.wb),
    stall,
    stall_reason: stallReason,
    bubble,
    flush: readStringArray(value.flush),
    load_use:
      readBoolean(value.load_use)
      ?? (stall && stallReason === "raw_hazard" && bubble.includes("EX")),
    forwarding: normalizePipelineForwarding(value.forwarding),
    redirect_pc:
      typeof value.redirect_pc === "string" ? value.redirect_pc : null
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

function normalizeDeviceMap(value: unknown): TraceDeviceMapEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    return [
      {
        name: readString(item.name, "device"),
        base: typeof item.base === "string" ? item.base : undefined,
        size: typeof item.size === "string" ? item.size : undefined
      }
    ];
  });
}

function normalizeMemWrite(value: unknown): TraceMemWrite | null {
  if (!isRecord(value)) {
    return null;
  }

  const addr = typeof value.addr === "string" ? value.addr : null;
  const storedValue = typeof value.value === "string" ? value.value : null;

  if (!addr || !storedValue) {
    return null;
  }

  return {
    addr,
    value: storedValue
  };
}

function normalizeTrapState(
  value: unknown,
  fallback: {
    cause?: string | null;
    epc?: string | null;
    vector?: string | null;
    badv?: string | null;
    interrupt?: boolean | null;
  }
): TraceTrapState {
  if (!isRecord(value)) {
    return {
      cause: fallback.cause ?? "none",
      epc: fallback.epc ?? "0x00000000",
      vector: fallback.vector ?? "0x00000080",
      badv: fallback.badv ?? "0x00000000",
      status: "0x00000001",
      exl: false,
      pending_interrupt: false,
      last_trap_was_interrupt: fallback.interrupt ?? false
    };
  }

  return {
    cause: readString(value.cause, fallback.cause ?? "none"),
    epc: readString(value.epc, fallback.epc ?? "0x00000000"),
    vector: readString(value.vector, fallback.vector ?? "0x00000080"),
    badv: readString(value.badv, fallback.badv ?? "0x00000000"),
    status: readString(value.status, "0x00000001"),
    exl: readBoolean(value.exl) ?? false,
    pending_interrupt: readBoolean(value.pending_interrupt) ?? false,
    last_trap_was_interrupt:
      readBoolean(value.last_trap_was_interrupt)
      ?? (fallback.interrupt ?? false)
  };
}

function normalizeMemoryAccesses(
  value: unknown,
  memWrite: TraceMemWrite | null
): TraceMemoryAccess[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (!isRecord(item)) {
        return [];
      }

      const addr = typeof item.addr === "string" ? item.addr : null;
      const storedValue = typeof item.value === "string" ? item.value : null;
      const width = readNumber(item.width);

      if (!addr || !storedValue || width === null) {
        return [];
      }

      return [
        {
          kind: readString(item.kind, "access"),
          addr,
          value: storedValue,
          width,
          target: readString(item.target, "memory"),
          via: item.via === "bus" ? "bus" : "memory"
        }
      ];
    });
  }

  if (!memWrite) {
    return [];
  }

  return [
    {
      kind: "write",
      addr: memWrite.addr,
      value: memWrite.value,
      width: 4,
      target: "memory",
      via: "memory"
    }
  ];
}

function normalizeDeviceEvents(
  value: unknown,
  uartText: string | null
): TraceDeviceEvent[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (!isRecord(item)) {
        return [];
      }

      return [
        {
          device: readString(item.device, "device"),
          kind: readString(item.kind, "event"),
          addr: typeof item.addr === "string" ? item.addr : undefined,
          value: typeof item.value === "string" ? item.value : undefined,
          width: readNumber(item.width) ?? undefined,
          text: typeof item.text === "string" ? item.text : undefined,
          cause: typeof item.cause === "string" ? item.cause : undefined
        }
      ];
    });
  }

  if (!uartText) {
    return [];
  }

  return [
    {
      device: "uart",
      kind: "tx",
      text: uartText
    }
  ];
}

function normalizeTimerState(value: unknown): TraceTimerState | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    control: readString(value.control, "0x00000000"),
    interval: readNumber(value.interval) ?? 0,
    remaining: readNumber(value.remaining) ?? 0,
    enabled: readBoolean(value.enabled) ?? false,
    periodic: readBoolean(value.periodic) ?? false,
    interrupt_enabled: readBoolean(value.interrupt_enabled) ?? false
  };
}

function normalizeMetaRecord(value: Record<string, unknown>): TraceMetaRecord {
  const mode =
    readMode(value.mode)
    ?? ((readBoolean(value.pipeline_mode) ?? false) ? "pipeline" : "interpreter");

  return {
    type: "meta",
    schema_version:
      typeof value.schema_version === "string" ? value.schema_version : undefined,
    program: readString(value.program, "unknown"),
    mode,
    load_base: typeof value.load_base === "string" ? value.load_base : undefined,
    entry_pc: typeof value.entry_pc === "string" ? value.entry_pc : undefined,
    max_steps: readNumber(value.max_steps),
    pipeline_mode: readBoolean(value.pipeline_mode) ?? (mode === "pipeline"),
    device_map: normalizeDeviceMap(value.device_map)
  };
}

function normalizeStepRecord(value: Record<string, unknown>): TraceStepRecord {
  const memWrite = normalizeMemWrite(value.mem_write);
  const uartText = typeof value.uart === "string" ? value.uart : null;
  const interrupt = readBoolean(value.interrupt);

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
    trap_state: normalizeTrapState(value.trap_state, {
      cause: typeof value.cause === "string" ? value.cause : null,
      epc: typeof value.epc === "string" ? value.epc : null,
      vector: typeof value.vector === "string" ? value.vector : null,
      badv: typeof value.badv === "string" ? value.badv : null,
      interrupt
    }),
    exception: readBoolean(value.exception),
    interrupt,
    cause: typeof value.cause === "string" ? value.cause : null,
    epc: typeof value.epc === "string" ? value.epc : null,
    vector: typeof value.vector === "string" ? value.vector : null,
    badv: typeof value.badv === "string" ? value.badv : null,
    branched: readBoolean(value.branched),
    gpr_changes: normalizeGprChanges(value.gpr_changes),
    memory_accesses: normalizeMemoryAccesses(value.memory_accesses, memWrite),
    device_events: normalizeDeviceEvents(value.device_events, uartText),
    mem_write: memWrite,
    uart: uartText,
    timer: normalizeTimerState(value.timer),
    pipeline: normalizePipelineSnapshot(value.pipeline)
  };
}

function inferStopReason(
  value: Record<string, unknown>,
  exitCode: number | null,
  running: boolean | undefined
): string | undefined {
  if (typeof value.stop_reason === "string") {
    return value.stop_reason;
  }

  if (exitCode === 2) {
    return "max_steps_reached";
  }

  if (exitCode === 1 && typeof value.cause === "string" && value.cause !== "none") {
    return "trap_terminated";
  }

  if (exitCode === 1) {
    return "runtime_error";
  }

  if (exitCode === 0 && running === false) {
    return "halt_instruction";
  }

  return undefined;
}

function synthesizeSummary(
  steps: TraceStepRecord[],
  mode: TraceMode
): TraceSummaryRecord | null {
  const lastStep = steps.length ? steps[steps.length - 1] : null;
  if (!lastStep) {
    return null;
  }

  return {
    type: "summary",
    mode,
    steps: steps.length,
    pc: lastStep.next_pc ?? lastStep.pc,
    last_inst: lastStep.raw,
    epc: lastStep.trap_state.epc,
    vector: lastStep.trap_state.vector,
    badv: lastStep.trap_state.badv,
    cause: lastStep.trap_state.cause,
    stop_reason: inferStopReason(
      {
        cause: lastStep.cause,
        stop_reason: undefined
      },
      lastStep.exit_code ?? null,
      lastStep.running
    ),
    status: lastStep.trap_state.status,
    exl: lastStep.trap_state.exl,
    running: lastStep.running,
    last_trap_was_interrupt: lastStep.trap_state.last_trap_was_interrupt,
    pending_interrupt: lastStep.trap_state.pending_interrupt,
    exit_code: lastStep.exit_code ?? null,
    error_message: null,
    regs: []
  };
}

function normalizeSummaryRecord(
  value: Record<string, unknown>,
  steps: TraceStepRecord[],
  fallbackMode: TraceMode
): TraceSummaryRecord {
  const running = readBoolean(value.running) ?? undefined;
  const exitCode = readNumber(value.exit_code);

  return {
    type: "summary",
    schema_version:
      typeof value.schema_version === "string" ? value.schema_version : undefined,
    mode:
      readMode(value.mode)
      ?? ((steps.some((step) => step.pipeline !== null) ? "pipeline" : fallbackMode) as TraceMode),
    steps: readNumber(value.steps) ?? steps.length,
    pc: typeof value.pc === "string" ? value.pc : undefined,
    last_inst: typeof value.last_inst === "string" ? value.last_inst : undefined,
    epc: typeof value.epc === "string" ? value.epc : undefined,
    vector: typeof value.vector === "string" ? value.vector : undefined,
    badv: typeof value.badv === "string" ? value.badv : undefined,
    cause: typeof value.cause === "string" ? value.cause : undefined,
    stop_reason: inferStopReason(value, exitCode, running),
    status: typeof value.status === "string" ? value.status : undefined,
    exl: readBoolean(value.exl) ?? undefined,
    running,
    last_trap_was_interrupt:
      readBoolean(value.last_trap_was_interrupt) ?? undefined,
    pending_interrupt: readBoolean(value.pending_interrupt) ?? undefined,
    exit_code: exitCode,
    error_message:
      typeof value.error_message === "string" ? value.error_message : null,
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
      const fallbackMode =
        meta?.mode ?? (steps.some((step) => step.pipeline !== null) ? "pipeline" : "interpreter");
      summary = normalizeSummaryRecord(parsed, steps, fallbackMode);
    }
  });

  if (!steps.length) {
    throw new Error("No step records found in trace file.");
  }

  const resolvedMeta: TraceMetaRecord | null = meta;
  const resolvedSummary: TraceSummaryRecord | null = summary;

  const summaryMode = resolvedSummary
    ? (resolvedSummary as TraceSummaryRecord).mode
    : undefined;
  const metaMode = resolvedMeta
    ? (resolvedMeta as TraceMetaRecord).mode
    : undefined;

  const inferredMode =
    summaryMode
    ?? metaMode
    ?? (steps.some((step) => step.pipeline !== null) ? "pipeline" : "interpreter");

  const normalizedMeta: TraceMetaRecord | null = resolvedMeta
    ? (() => {
        const metaRecord = resolvedMeta as TraceMetaRecord;
        return {
          type: "meta",
          schema_version: metaRecord.schema_version,
          program: metaRecord.program,
          mode: metaRecord.mode ?? inferredMode,
          load_base: metaRecord.load_base,
          entry_pc: metaRecord.entry_pc,
          max_steps: metaRecord.max_steps,
          pipeline_mode: metaRecord.pipeline_mode ?? (inferredMode === "pipeline"),
          device_map: metaRecord.device_map
        };
      })()
    : null;

  return {
    sourceName,
    meta: normalizedMeta,
    steps,
    summary: resolvedSummary ?? synthesizeSummary(steps, inferredMode),
    inferredMode
  };
}
