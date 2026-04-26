import type {
  GprChange,
  PipelineStageKey,
  TraceDeviceMapEntry,
  TraceDocument,
  TraceStepRecord,
  TraceSummaryRecord,
  TraceTimerState
} from "@/features/trace/types";
import {
  sampleTraceOptions,
  type SampleTraceOption
} from "@/features/trace/sources";
import type { TagTone } from "@/components/Tag";
import type {
  HazardFlowHint,
  HazardStageHighlight
} from "@/features/lesson_hazard/contracts";

export type TimelineEntry<T> = {
  stepNumber: number;
  item: T;
};

export interface SemanticTimelineEntry {
  stepNumber: number;
  title: string;
  detail: string;
  tone: TagTone;
}

export interface TrapPhaseSummary {
  title: string;
  detail: string;
  tone: TagTone;
}

export interface PipelineFallbackInfo {
  title: string;
  detail: string;
  focusPanels: string[];
  suggestedSamples: SampleTraceOption[];
}

export const sampleOptionById = new Map(
  sampleTraceOptions.map((option) => [option.id, option])
);

export const stopReasonGuide = [
  {
    id: "halt_instruction",
    label: "正常结束",
    detail: "程序执行到了模拟器的 HALT 指令，因此按正常路径结束。",
    tone: "emerald" as TagTone
  },
  {
    id: "trap_terminated",
    label: "陷入终止",
    detail: "程序进入异常向量后没有恢复执行，因此停在 trap 终止状态。",
    tone: "rose" as TagTone
  },
  {
    id: "runtime_error",
    label: "运行时错误",
    detail: "当前执行模式拒绝该程序，例如流水线教学模式遇到未支持指令。",
    tone: "amber" as TagTone
  },
  {
    id: "max_steps_reached",
    label: "步数耗尽",
    detail: "程序尚未正常结束，但配置的最大执行步数已经用完。",
    tone: "cyan" as TagTone
  }
];

export function clampStepIndex(nextIndex: number, trace: TraceDocument | null) {
  if (!trace?.steps.length) {
    return 0;
  }

  return Math.max(0, Math.min(nextIndex, trace.steps.length - 1));
}

export function formatRegister(reg: number | null | undefined) {
  return reg === null || reg === undefined ? "-" : `r${reg}`;
}

export function getStopReasonTone(reason: string | undefined): TagTone {
  if (reason === "halt_instruction") return "emerald";
  if (reason === "trap_terminated") return "rose";
  if (reason === "runtime_error") return "amber";
  if (reason === "max_steps_reached") return "cyan";
  return "neutral";
}

export function getStopReasonLabel(reason: string | undefined) {
  if (reason === "halt_instruction") return "HALT / 自然停机";
  if (reason === "trap_terminated") return "Trap termination";
  if (reason === "runtime_error") return "Runtime error";
  if (reason === "max_steps_reached") return "Max steps";
  return "Unknown";
}

export function getBranchTag(step: TraceStepRecord) {
  if (step.branched === true) return { label: "分支命中", tone: "rose" as TagTone };
  if (step.branched === false) return { label: "分支未命中", tone: "emerald" as TagTone };
  return null;
}

export function getTrapEventTag(step: TraceStepRecord) {
  if (step.exception) return { label: "异常", tone: "rose" as TagTone };
  if (step.interrupt) return { label: "中断", tone: "amber" as TagTone };
  return { label: "稳定执行", tone: "neutral" as TagTone };
}

function normalizeStageKey(value: string): PipelineStageKey | null {
  const normalized = value.trim().toLowerCase();
  return normalized === "if"
    || normalized === "id"
    || normalized === "ex"
    || normalized === "mem"
    || normalized === "wb"
    ? normalized
    : null;
}

export function buildPipelineVisuals(step: TraceStepRecord): {
  stageHighlights: HazardStageHighlight[];
  flowHints: HazardFlowHint[];
} {
  if (!step.pipeline) {
    return { stageHighlights: [], flowHints: [] };
  }

  const stageHighlights: HazardStageHighlight[] = [];
  const flowHints: HazardFlowHint[] = [];

  if (step.pipeline.stall) {
    stageHighlights.push({
      stage: "id",
      label: step.pipeline.load_use ? "load-use" : "停顿",
      tone: "amber"
    });
  }

  step.pipeline.bubble.forEach((stageName) => {
    const stage = normalizeStageKey(stageName);
    if (stage) stageHighlights.push({ stage, label: "气泡", tone: "amber" });
  });

  step.pipeline.flush.forEach((stageName) => {
    const stage = normalizeStageKey(stageName);
    if (stage) stageHighlights.push({ stage, label: "冲刷", tone: "rose" });
  });

  if (step.branched === true) {
    stageHighlights.push({ stage: "ex", label: "命中", tone: "rose" });
  } else if (step.branched === false) {
    stageHighlights.push({ stage: "ex", label: "未命中", tone: "emerald" });
  }

  step.pipeline.forwarding.forEach((forwarding, index) => {
    const fromStage = normalizeStageKey(forwarding.from_stage);
    const toStage = normalizeStageKey(forwarding.to_stage);
    if (!fromStage || !toStage) return;
    flowHints.push({
      fromStage,
      toStage,
      label: `r${forwarding.reg} ${forwarding.operand}`,
      tone: "cyan",
      lane: index
    });
  });

  if (step.pipeline.redirect_pc) {
    flowHints.push({
      fromStage: "ex",
      toStage: "if",
      label: "改道",
      tone: "rose",
      lane: flowHints.length
    });
  }

  return { stageHighlights, flowHints };
}

export function collectUartOutput(steps: TraceStepRecord[], stepIndex: number) {
  let output = "";
  for (let index = 0; index <= stepIndex && index < steps.length; index += 1) {
    const step = steps[index];
    if (step.uart) {
      output += step.uart;
      continue;
    }
    step.device_events.forEach((event) => {
      if (event.device === "uart" && event.kind === "tx" && event.text) {
        output += event.text;
      }
    });
  }
  return output;
}

export function collectRecentItems<T>(
  steps: TraceStepRecord[],
  stepIndex: number,
  picker: (step: TraceStepRecord) => T[],
  limit: number
): Array<TimelineEntry<T>> {
  const results: Array<TimelineEntry<T>> = [];

  for (let index = Math.min(stepIndex, steps.length - 1); index >= 0; index -= 1) {
    const currentStep = steps[index];
    const items = picker(currentStep);

    for (let itemIndex = items.length - 1; itemIndex >= 0; itemIndex -= 1) {
      results.push({ stepNumber: currentStep.step, item: items[itemIndex] });
      if (results.length >= limit) return results;
    }
  }

  return results;
}

export function findLastWriteback(
  steps: TraceStepRecord[],
  stepIndex: number
): { stepNumber: number; change: GprChange } | null {
  for (let index = Math.min(stepIndex, steps.length - 1); index >= 0; index -= 1) {
    const changes = steps[index].gpr_changes;
    const change = changes.length ? changes[changes.length - 1] : null;
    if (change) return { stepNumber: steps[index].step, change };
  }
  return null;
}

export function getPipelinePulseTone(step: TraceStepRecord) {
  if (step.pipeline?.flush.length || step.branched) return "rose" as const;
  if (step.pipeline?.stall || step.pipeline?.bubble.length) return "amber" as const;
  if (step.pipeline?.forwarding.length) return "cyan" as const;
  return "emerald" as const;
}

export function getErtnSummary(step: TraceStepRecord) {
  if (step.op !== "ERTN") return "当前步骤没有执行 ERTN。";
  return `ERTN 会返回到 ${step.next_pc ?? step.trap_state.epc}，同时清除 EXL。`;
}

function parseHex(value: string | undefined | null): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  const parsed = Number.parseInt(normalized, 16);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatHexOffset(offset: number) {
  return `0x${offset.toString(16).padStart(2, "0")}`;
}

function describeTimerFlags(timer: TraceTimerState) {
  return [
    timer.enabled ? "使能" : "停用",
    timer.periodic ? "周期模式" : "单次模式",
    timer.interrupt_enabled ? "中断打开" : "中断关闭"
  ].join(" / ");
}

function describeTimerRegister(
  addr: string | undefined,
  deviceMap: TraceDeviceMapEntry[]
) {
  const timerBase = deviceMap.find((entry) => entry.name === "timer")?.base;
  const baseValue = parseHex(timerBase);
  const addrValue = parseHex(addr);

  if (baseValue === null || addrValue === null) {
    return addr ?? "timer";
  }

  const offset = addrValue - baseValue;
  if (offset === 0) return "control";
  if (offset === 4) return "interval";
  return `timer + ${formatHexOffset(offset)}`;
}

function collectTimerChangeNotes(
  previousTimer: TraceTimerState | null | undefined,
  timer: TraceTimerState
) {
  const notes: string[] = [];

  if (!previousTimer) {
    if (timer.control !== "0x00000000") {
      notes.push(`control 初始化为 ${timer.control}（${describeTimerFlags(timer)}）`);
    }
    if (timer.interval !== 0) {
      notes.push(`interval 初始化为 ${timer.interval}`);
    }
    if (timer.remaining !== 0) {
      notes.push(`remaining 初始化为 ${timer.remaining}`);
    }
    return notes;
  }

  if (previousTimer.control !== timer.control) {
    notes.push(
      `control ${previousTimer.control} -> ${timer.control}（${describeTimerFlags(timer)}）`
    );
  }

  if (previousTimer.interval !== timer.interval) {
    notes.push(`interval ${previousTimer.interval} -> ${timer.interval}`);
  }

  if (previousTimer.remaining !== timer.remaining) {
    if (timer.remaining > previousTimer.remaining) {
      notes.push(`remaining 重新装填到 ${timer.remaining}`);
    } else if (timer.remaining === 0 && previousTimer.remaining > 0) {
      notes.push(`remaining ${previousTimer.remaining} -> 0，计数到期`);
    } else {
      notes.push(`remaining ${previousTimer.remaining} -> ${timer.remaining}`);
    }
  }

  return notes;
}

export function buildTimerSemanticTimeline(
  steps: TraceStepRecord[],
  stepIndex: number,
  deviceMap: TraceDeviceMapEntry[] = [],
  limit = 6
): SemanticTimelineEntry[] {
  const entries: SemanticTimelineEntry[] = [];
  const lastIndex = Math.min(stepIndex, steps.length - 1);

  for (let index = 0; index <= lastIndex; index += 1) {
    const step = steps[index];
    const previousTimer = index > 0 ? steps[index - 1]?.timer : null;
    const timer = step.timer;
    const timerWrites = step.memory_accesses.filter((item) => item.target === "timer");
    const timerEvents = step.device_events.filter((event) => event.device === "timer");

    if (!timer && !timerWrites.length && !timerEvents.length) {
      continue;
    }

    const detailParts: string[] = [];
    const changeNotes = timer ? collectTimerChangeNotes(previousTimer, timer) : [];
    const interruptEvent = timerEvents.find(
      (event) => event.kind === "interrupt_raised"
    );

    let title = "定时器状态变化";
    let tone: TagTone = "neutral";

    if (interruptEvent) {
      title = "定时器拉高中断";
      tone = "rose";
      detailParts.push(`cause ${interruptEvent.cause ?? "timer_interrupt"}`);
    }

    if (timerWrites.length) {
      if (tone === "neutral") {
        tone = "cyan";
        title = "更新定时器配置";
      }

      detailParts.push(
        `总线写 ${timerWrites
          .map(
            (write) =>
              `${describeTimerRegister(write.addr, deviceMap)} = ${write.value}`
          )
          .join("，")}`
      );
    }

    if (changeNotes.length) {
      if (title === "定时器状态变化") {
        const controlChanged =
          timer && previousTimer && previousTimer.control !== timer.control;
        const intervalChanged =
          timer && previousTimer && previousTimer.interval !== timer.interval;

        if (controlChanged || intervalChanged) {
          title = "更新定时器配置";
          tone = "cyan";
        } else {
          title = timer?.remaining === 0 ? "定时器到期" : "定时器推进";
          tone = timer?.remaining === 0 ? "amber" : "neutral";
        }
      }

      detailParts.push(changeNotes.join("；"));
    }

    if (!detailParts.length) {
      continue;
    }

    entries.push({
      stepNumber: step.step,
      title,
      detail: detailParts.join("。"),
      tone
    });
  }

  return entries.slice(-limit).reverse();
}

export function describeTrapPhase(
  step: TraceStepRecord | null,
  summary: TraceSummaryRecord | null
): TrapPhaseSummary {
  if (!step) {
    return {
      title: "尚未加载 trap 语义",
      detail: "请选择样例后，工作台会串起 trap / interrupt 的进入、处理和返回过程。",
      tone: "neutral"
    };
  }

  if (summary?.stop_reason === "trap_terminated" && step.trap_state.exl) {
    return {
      title: "程序停在 trap 终止态",
      detail: `EXL 仍然置位，cause 为 ${step.trap_state.cause}，没有完成 ERTN 返回。`,
      tone: "rose"
    };
  }

  if (step.interrupt) {
    return {
      title: "本步进入中断处理",
      detail: `cause ${step.cause ?? step.trap_state.cause}，EPC ${step.trap_state.epc}，向量 ${step.trap_state.vector}。`,
      tone: "amber"
    };
  }

  if (step.exception) {
    return {
      title: "本步进入异常处理",
      detail: `cause ${step.cause ?? step.trap_state.cause}，EPC ${step.trap_state.epc}，向量 ${step.trap_state.vector}。`,
      tone: "rose"
    };
  }

  if (step.op === "ERTN") {
    return {
      title: "本步执行 ERTN 返回",
      detail: `返回地址 ${step.next_pc ?? step.trap_state.epc}，EXL 会在这一步清除。`,
      tone: "emerald"
    };
  }

  if (step.trap_state.exl) {
    return {
      title: step.trap_state.last_trap_was_interrupt
        ? "正在中断处理程序内"
        : "正在异常处理程序内",
      detail: `当前锁存 cause ${step.trap_state.cause}，EPC ${step.trap_state.epc}，向量 ${step.trap_state.vector}。`,
      tone: step.trap_state.last_trap_was_interrupt ? "amber" : "rose"
    };
  }

  return {
    title: "当前处于正常执行",
    detail: "EXL 已清除，CPU 处在普通执行路径上；可继续观察 timer、device 和 summary 语义。",
    tone: "neutral"
  };
}

export function buildTrapProcessTimeline(
  steps: TraceStepRecord[],
  stepIndex: number,
  limit = 6
): SemanticTimelineEntry[] {
  const entries: SemanticTimelineEntry[] = [];
  const lastIndex = Math.min(stepIndex, steps.length - 1);

  for (let index = 0; index <= lastIndex; index += 1) {
    const step = steps[index];
    const previousStep = index > 0 ? steps[index - 1] : null;

    if (step.exception || step.interrupt) {
      entries.push({
        stepNumber: step.step,
        title: step.interrupt ? "进入中断入口" : "进入异常入口",
        detail: `cause ${step.cause ?? step.trap_state.cause}，EPC ${step.trap_state.epc}，vector ${step.trap_state.vector}，EXL 置位。`,
        tone: step.interrupt ? "amber" : "rose"
      });
      continue;
    }

    if (step.op === "ERTN") {
      entries.push({
        stepNumber: step.step,
        title: "ERTN 返回",
        detail: `返回到 ${step.next_pc ?? step.trap_state.epc}，同时把 EXL 从 1 清回 0。`,
        tone: "emerald"
      });
    }

    if (
      previousStep
      && step.op !== "ERTN"
      && previousStep.trap_state.exl !== step.trap_state.exl
    ) {
      entries.push({
        stepNumber: step.step,
        title: `EXL ${step.trap_state.exl ? "置位" : "清除"}`,
        detail: `status ${previousStep.trap_state.status} -> ${step.trap_state.status}`,
        tone: step.trap_state.exl ? "rose" : "emerald"
      });
    }

    if (
      previousStep
      && previousStep.trap_state.pending_interrupt !== step.trap_state.pending_interrupt
    ) {
      entries.push({
        stepNumber: step.step,
        title: `pending_interrupt ${step.trap_state.pending_interrupt ? "置位" : "清除"}`,
        detail: `当前 cause ${step.trap_state.cause}，status ${step.trap_state.status}`,
        tone: "amber"
      });
    }
  }

  return entries.slice(-limit).reverse();
}

export function buildPipelineFallbackInfo(
  option: SampleTraceOption,
  trace: TraceDocument | null
): PipelineFallbackInfo {
  const mode = trace?.meta?.mode ?? trace?.inferredMode ?? option.recommendedView;
  const sharedConceptIds = new Set(option.conceptIds);
  const relatedPipelineSamples = sampleTraceOptions.filter(
    (candidate) =>
      candidate.pipelineSupport === "full"
      && candidate.id !== option.id
      && candidate.conceptIds.some((conceptId) => sharedConceptIds.has(conceptId))
  );
  const fallbackSamples = relatedPipelineSamples.length
    ? relatedPipelineSamples
    : sampleTraceOptions.filter(
        (candidate) => candidate.pipelineSupport === "full" && candidate.id !== option.id
      );

  return {
    title: mode === "interpreter" ? "当前样例是解释器 trace" : "当前记录没有五级流水线快照",
    detail:
      mode === "interpreter"
        ? "解释器 trace 会保留逐步执行、trap、timer 和 device 语义，但不会导出 IF/ID/EX/MEM/WB 的逐拍槽位，所以这里需要降级成解释性提示而不是空白面板。"
        : "这份 trace 没有足够的 pipeline snapshot 可供渲染，工作台会退回到 CPU、trap、timer 和 summary 的共享语义层。",
    focusPanels: option.recommendedPanels.slice(0, 3),
    suggestedSamples: fallbackSamples.slice(0, 4)
  };
}
