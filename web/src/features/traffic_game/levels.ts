import {
  findTokenByInstructionKey,
  getPipelineTokens,
  type PipelineToken
} from "@/features/pipeline/visuals";
import type {
  HazardFlowHint,
  HazardStageHighlight
} from "@/features/lesson_hazard/contracts";
import {
  dispatchKindLabels,
  type DispatchBlueprint,
  type DispatchBlockKind,
  type DispatchPiece,
  type DispatchPieceSnapshot,
  type ResolvedDispatchBlueprint
} from "@/features/traffic_game/contracts";
import type {
  PipelineStageKey,
  TraceDocument,
  TraceStepRecord
} from "@/features/trace/types";

function cells(
  ...points: Array<[number, number]>
): Array<{ x: number; y: number }> {
  return points.map(([x, y]) => ({ x, y }));
}

const iShape = [
  cells([0, 1], [1, 1], [2, 1], [3, 1]),
  cells([2, 0], [2, 1], [2, 2], [2, 3])
] as const;

const oShape = [
  cells([1, 0], [2, 0], [1, 1], [2, 1])
] as const;

const tShape = [
  cells([1, 0], [0, 1], [1, 1], [2, 1]),
  cells([1, 0], [1, 1], [2, 1], [1, 2]),
  cells([0, 1], [1, 1], [2, 1], [1, 2]),
  cells([1, 0], [0, 1], [1, 1], [1, 2])
] as const;

const sShape = [
  cells([1, 0], [2, 0], [0, 1], [1, 1]),
  cells([1, 0], [1, 1], [2, 1], [2, 2])
] as const;

const jShape = [
  cells([0, 0], [0, 1], [1, 1], [2, 1]),
  cells([1, 0], [2, 0], [1, 1], [1, 2]),
  cells([0, 1], [1, 1], [2, 1], [2, 2]),
  cells([1, 0], [1, 1], [0, 2], [1, 2])
] as const;

export const dispatchBlueprints: DispatchBlueprint[] = [
  {
    id: "alu-lane",
    kind: "alu",
    title: "算术直推",
    shortLabel: "ALU",
    cue: "直推",
    description: "稳定下压",
    traceSampleId: "pipeline-forward",
    stepWindowStart: 0,
    stepWindowEnd: 4,
    anchorStepIndex: 0,
    anchorStage: "if",
    rotations: iShape,
    tone: "emerald",
    stageHighlights: [
      { stage: "if", label: "入场", tone: "emerald" },
      { stage: "wb", label: "写回", tone: "cyan" }
    ],
    flowHints: []
  },
  {
    id: "alu-square",
    kind: "alu",
    title: "写回方块",
    shortLabel: "WR",
    cue: "落稳",
    description: "补齐空位",
    traceSampleId: "pipeline-branch",
    stepWindowStart: 5,
    stepWindowEnd: 9,
    anchorStepIndex: 5,
    anchorStage: "if",
    rotations: oShape,
    tone: "cyan",
    stageHighlights: [
      { stage: "mem", label: "通过", tone: "cyan" },
      { stage: "wb", label: "提交", tone: "emerald" }
    ],
    flowHints: []
  },
  {
    id: "forward-bridge",
    kind: "forward",
    title: "旁路桥",
    shortLabel: "FW",
    cue: "旁路",
    description: "结果直送",
    traceSampleId: "pipeline-forward",
    stepWindowStart: 3,
    stepWindowEnd: 7,
    anchorStepIndex: 3,
    anchorStage: "if",
    rotations: tShape,
    tone: "cyan",
    stageHighlights: [
      { stage: "ex", label: "取数", tone: "cyan" },
      { stage: "mem", label: "r4", tone: "emerald" },
      { stage: "wb", label: "r2", tone: "emerald" }
    ],
    flowHints: [
      { fromStage: "mem", toStage: "ex", label: "r4", tone: "cyan", lane: 0 },
      { fromStage: "wb", toStage: "ex", label: "r2", tone: "cyan", lane: 1 }
    ]
  },
  {
    id: "loaduse-brake",
    kind: "load-use",
    title: "装载急停",
    shortLabel: "ST",
    cue: "停拍",
    description: "插入气泡",
    traceSampleId: "pipeline-loaduse",
    stepWindowStart: 1,
    stepWindowEnd: 6,
    anchorStepIndex: 1,
    anchorStage: "if",
    rotations: sShape,
    tone: "amber",
    stageHighlights: [
      { stage: "if", label: "排队", tone: "amber" },
      { stage: "id", label: "停住", tone: "amber" },
      { stage: "ex", label: "气泡", tone: "amber" }
    ],
    flowHints: [
      { fromStage: "ex", toStage: "id", label: "load 未到", tone: "amber", lane: 0 }
    ]
  },
  {
    id: "branch-sweep",
    kind: "branch-flush",
    title: "分支冲刷",
    shortLabel: "FL",
    cue: "清前段",
    description: "改道清空",
    traceSampleId: "pipeline-branch",
    stepWindowStart: 2,
    stepWindowEnd: 6,
    anchorStepIndex: 2,
    anchorStage: "if",
    rotations: jShape,
    tone: "rose",
    stageHighlights: [
      { stage: "ex", label: "改道", tone: "rose" },
      { stage: "if", label: "清空", tone: "rose" },
      { stage: "id", label: "清空", tone: "rose" }
    ],
    flowHints: [
      { fromStage: "ex", toStage: "id", label: "flush", tone: "rose", lane: 0 },
      { fromStage: "ex", toStage: "if", label: "flush", tone: "rose", lane: 1 }
    ]
  }
];

export const requiredDispatchSampleIds = Array.from(
  new Set(dispatchBlueprints.map((blueprint) => blueprint.traceSampleId))
);

export function resolveDispatchBlueprints(
  traceMap: Record<string, TraceDocument>
): ResolvedDispatchBlueprint[] {
  return dispatchBlueprints.map((blueprint) => {
    const trace = traceMap[blueprint.traceSampleId];

    if (!trace) {
      throw new Error(`缺少示例 trace: ${blueprint.traceSampleId}`);
    }

    const anchorStep = trace.steps[blueprint.anchorStepIndex];

    if (!anchorStep) {
      throw new Error(
        `trace ${blueprint.traceSampleId} 缺少步号 ${blueprint.anchorStepIndex}`
      );
    }

    return {
      ...blueprint,
      trace,
      instructionKey: [anchorStep.op, anchorStep.raw, anchorStep.pc].join("|"),
      instruction: {
        op: anchorStep.op,
        raw: anchorStep.raw,
        pc: anchorStep.pc,
        rd: anchorStep.rd,
        rj: anchorStep.rj,
        rk: anchorStep.rk,
        imm: anchorStep.imm
      }
    };
  });
}

function buildStageHighlights(
  blueprint: ResolvedDispatchBlueprint,
  activeStage: PipelineStageKey | null,
  step: TraceStepRecord
) {
  const dynamicHighlights: HazardStageHighlight[] = [];

  if (activeStage) {
    dynamicHighlights.push({
      stage: activeStage,
      label: "当前块",
      tone: blueprint.tone
    });
  }

  if (step.pipeline?.stall && !dynamicHighlights.some((item) => item.stage === "id")) {
    dynamicHighlights.push({ stage: "id", label: "停顿", tone: "amber" });
  }

  if (step.pipeline?.bubble.length && !dynamicHighlights.some((item) => item.stage === "ex")) {
    dynamicHighlights.push({ stage: "ex", label: "气泡", tone: "amber" });
  }

  if (step.pipeline?.flush.length && !dynamicHighlights.some((item) => item.stage === "if")) {
    dynamicHighlights.push({ stage: "if", label: "冲刷", tone: "rose" });
  }

  return [...blueprint.stageHighlights, ...dynamicHighlights];
}

export function describeDispatchHazard(
  blueprint: ResolvedDispatchBlueprint,
  step: TraceStepRecord
) {
  if (step.pipeline?.flush.length || step.branched) {
    return "错误路径被整段冲掉。";
  }

  if (step.pipeline?.stall) {
    return "前段停住，执行段插入气泡。";
  }

  if (blueprint.kind === "forward") {
    return "结果直接旁路回执行段。";
  }

  if (step.gpr_changes.length) {
    return "结果已经写回寄存器。";
  }

  return "五级流水正在稳定推进。";
}

function findActiveStageToken(
  step: TraceStepRecord,
  instructionKey: string
): PipelineToken | null {
  return (
    findTokenByInstructionKey(step, instructionKey)
    ?? getPipelineTokens(step).find((token) => token.kind === "bubble")
    ?? null
  );
}

export function buildDispatchPieceSnapshot(
  piece: DispatchPiece | null | undefined,
  blueprints: ResolvedDispatchBlueprint[]
): DispatchPieceSnapshot | null {
  if (!piece) {
    return null;
  }

  const blueprint = blueprints.find((item) => item.id === piece.blueprintId);

  if (!blueprint) {
    return null;
  }

  const currentStepIndex = Math.min(
    blueprint.stepWindowStart + piece.progress,
    blueprint.stepWindowEnd
  );
  const currentStep = blueprint.trace.steps[currentStepIndex];

  if (!currentStep) {
    return null;
  }

  const previousStep =
    currentStepIndex > blueprint.stepWindowStart
      ? blueprint.trace.steps[currentStepIndex - 1] ?? null
      : null;
  const activeToken = findActiveStageToken(currentStep, piece.instructionKey);

  return {
    piece,
    blueprint,
    currentStepIndex,
    currentStep,
    previousStep,
    activeStage: activeToken?.stage ?? null,
    pipelineState: activeToken?.state ?? piece.state,
    hazardText: describeDispatchHazard(blueprint, currentStep),
    stageHighlights: buildStageHighlights(
      blueprint,
      activeToken?.stage ?? null,
      currentStep
    ),
    flowHints: blueprint.flowHints
  };
}

export function getDispatchStatusText(snapshot: DispatchPieceSnapshot | null) {
  if (!snapshot) {
    return "等待入场";
  }

  if (snapshot.pipelineState === "cleared") {
    return "已消行";
  }

  if (snapshot.pipelineState === "locked") {
    return "已锁定";
  }

  return dispatchKindLabels[snapshot.blueprint.kind];
}

export function getDispatchBoardLegend(kind: DispatchBlockKind) {
  return dispatchKindLabels[kind];
}

export function getNextBlueprint(
  blueprints: ResolvedDispatchBlueprint[],
  nextBlueprintIds: string[]
) {
  const nextId = nextBlueprintIds[0];

  return blueprints.find((blueprint) => blueprint.id === nextId) ?? null;
}

export function getSnapshotStageText(snapshot: DispatchPieceSnapshot | null) {
  if (!snapshot?.activeStage) {
    return "等待入场";
  }

  return snapshot.activeStage.toUpperCase();
}
