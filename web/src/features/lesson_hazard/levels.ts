import type {
  HazardFlowHint,
  HazardPuzzleFeedback,
  HazardStageHighlight
} from "@/features/lesson_hazard/contracts";
import type { PipelineStageKey } from "@/features/trace/types";

export type HazardChoiceId =
  | "raw"
  | "forward"
  | "stall_bubble"
  | "flush"
  | "control"
  | "steady";

export interface HazardPuzzleChoice {
  id: HazardChoiceId;
  label: string;
  detail: string;
}

export interface HazardPuzzleLevel {
  id: string;
  title: string;
  shortTitle: string;
  concept: string;
  traceSampleId: string;
  focusStepIndex: number;
  previewStartStep: number;
  previewEndStep: number;
  focusStage: PipelineStageKey;
  briefing: string;
  prompt: string;
  choices: HazardPuzzleChoice[];
  correctChoiceId: HazardChoiceId;
  successText: string;
  failureText: string;
  previewHighlights: HazardStageHighlight[];
  previewFlows: HazardFlowHint[];
  solutionHighlights: HazardStageHighlight[];
  solutionFlows: HazardFlowHint[];
}

function collectSolutionStages(level: HazardPuzzleLevel): PipelineStageKey[] {
  const stageSet = new Set<PipelineStageKey>();

  level.solutionHighlights.forEach((highlight) => {
    stageSet.add(highlight.stage);
  });

  level.solutionFlows.forEach((flow) => {
    stageSet.add(flow.fromStage);
    stageSet.add(flow.toStage);
  });

  return Array.from(stageSet);
}

export function getHazardPuzzlePreviewHighlights(
  level: HazardPuzzleLevel
): HazardStageHighlight[] {
  return level.previewHighlights;
}

export function getHazardPuzzlePreviewFlows(
  level: HazardPuzzleLevel
): HazardFlowHint[] {
  return level.previewFlows;
}

export function buildHazardPuzzleFeedback(
  level: HazardPuzzleLevel,
  choiceId: HazardChoiceId
): HazardPuzzleFeedback {
  const isCorrect = choiceId === level.correctChoiceId;

  return {
    status: isCorrect ? "correct" : "incorrect",
    explanation: isCorrect ? level.successText : level.failureText,
    highlightStages: collectSolutionStages(level),
    stageHighlights: level.solutionHighlights,
    flowHints: level.solutionFlows
  };
}

export const hazardPuzzleLevels: HazardPuzzleLevel[] = [
  {
    id: "raw-shadow",
    title: "L1. RAW 阴影",
    shortTitle: "RAW",
    concept: "RAW",
    traceSampleId: "pipeline-raw",
    focusStepIndex: 3,
    previewStartStep: 1,
    previewEndStep: 4,
    focusStage: "id",
    briefing: "译码段想立刻读到前两条结果，但数据还没有真正写回。",
    prompt: "这一拍最先应该警惕什么？",
    choices: [
      { id: "raw", label: "RAW", detail: "前面的结果还没有写回寄存器。" },
      { id: "control", label: "控制", detail: "PC 方向已经改变。" },
      { id: "steady", label: "继续", detail: "这一拍没有明显风险。" }
    ],
    correctChoiceId: "raw",
    successText: "对。ID 正在追前面的结果，这就是典型的 RAW 相关。",
    failureText: "这里不是 PC 改道，真正的问题是 ID 还在等待旧结果。",
    previewHighlights: [{ stage: "id", label: "焦点", tone: "emerald" }],
    previewFlows: [
      { fromStage: "mem", toStage: "id", label: "r1", tone: "amber", lane: 0 },
      { fromStage: "ex", toStage: "id", label: "r2", tone: "amber", lane: 1 }
    ],
    solutionHighlights: [
      { stage: "id", label: "读取端", tone: "amber" },
      { stage: "ex", label: "r2", tone: "amber" },
      { stage: "mem", label: "r1", tone: "amber" }
    ],
    solutionFlows: [
      { fromStage: "mem", toStage: "id", label: "r1", tone: "amber", lane: 0 },
      { fromStage: "ex", toStage: "id", label: "r2", tone: "amber", lane: 1 }
    ]
  },
  {
    id: "forward-bridge",
    title: "L2. 旁路桥接",
    shortTitle: "旁路",
    concept: "旁路",
    traceSampleId: "pipeline-forward",
    focusStepIndex: 5,
    previewStartStep: 3,
    previewEndStep: 6,
    focusStage: "ex",
    briefing: "EX 已经拿到旧结果的旁路输入，这一拍可以继续往前走。",
    prompt: "这一拍该怎么处理？",
    choices: [
      { id: "forward", label: "旁路", detail: "把最新结果直接送进 EX。" },
      { id: "stall_bubble", label: "暂停", detail: "前端先停一拍再说。" },
      { id: "flush", label: "冲刷", detail: "把年轻指令全部清掉。" }
    ],
    correctChoiceId: "forward",
    successText: "对。旁路已经建立，EX 不需要停车。",
    failureText: "这里不是 load-use，也不是错路，直接旁路最合适。",
    previewHighlights: [{ stage: "ex", label: "焦点", tone: "emerald" }],
    previewFlows: [
      { fromStage: "mem", toStage: "ex", label: "r4", tone: "cyan", lane: 0 },
      { fromStage: "wb", toStage: "ex", label: "r2", tone: "cyan", lane: 1 }
    ],
    solutionHighlights: [
      { stage: "ex", label: "读取端", tone: "cyan" },
      { stage: "mem", label: "r4", tone: "emerald" },
      { stage: "wb", label: "r2", tone: "emerald" }
    ],
    solutionFlows: [
      { fromStage: "mem", toStage: "ex", label: "r4", tone: "cyan", lane: 0 },
      { fromStage: "wb", toStage: "ex", label: "r2", tone: "cyan", lane: 1 }
    ]
  },
  {
    id: "loaduse-brake",
    title: "L3. Load-use 刹车",
    shortTitle: "停顿",
    concept: "Load-use",
    traceSampleId: "pipeline-loaduse",
    focusStepIndex: 2,
    previewStartStep: 0,
    previewEndStep: 4,
    focusStage: "id",
    briefing: "load 的结果还在路上，如果现在读取就会过早。",
    prompt: "这一拍该怎么控？",
    choices: [
      { id: "forward", label: "旁路", detail: "像普通 ALU hazard 一样直接旁路。" },
      { id: "stall_bubble", label: "停顿", detail: "IF / ID 顶住，EX 插入一个 bubble。" },
      { id: "flush", label: "冲刷", detail: "把 IF / ID 全部清掉。" }
    ],
    correctChoiceId: "stall_bubble",
    successText: "对。先停住 IF / ID，再给 EX 插入一个 bubble。",
    failureText: "load 结果这一拍还没到，硬旁路不安全，也不该直接冲刷。",
    previewHighlights: [{ stage: "id", label: "焦点", tone: "emerald" }],
    previewFlows: [
      {
        fromStage: "ex",
        toStage: "id",
        label: "load 未到",
        tone: "amber",
        lane: 0
      }
    ],
    solutionHighlights: [
      { stage: "if", label: "停顿", tone: "amber" },
      { stage: "id", label: "停顿", tone: "amber" },
      { stage: "ex", label: "bubble", tone: "amber" }
    ],
    solutionFlows: [
      {
        fromStage: "ex",
        toStage: "id",
        label: "load 未到",
        tone: "amber",
        lane: 0
      }
    ]
  },
  {
    id: "branch-sweep",
    title: "L4. 分支冲刷",
    shortTitle: "冲刷",
    concept: "分支",
    traceSampleId: "pipeline-branch",
    focusStepIndex: 4,
    previewStartStep: 2,
    previewEndStep: 5,
    focusStage: "ex",
    briefing: "EX 判定分支成立后，前面的年轻指令已经走错路了。",
    prompt: "现在应该按哪一个？",
    choices: [
      { id: "forward", label: "旁路", detail: "继续把旧值往下送。" },
      { id: "stall_bubble", label: "停顿", detail: "先停住，再观察一拍。" },
      { id: "flush", label: "冲刷", detail: "把 IF / ID 的错路指令立刻清掉。" }
    ],
    correctChoiceId: "flush",
    successText: "对。分支一旦成立，年轻指令就必须立即冲刷。",
    failureText: "这里不是等数据，而是 PC 已改向，错路必须马上清掉。",
    previewHighlights: [{ stage: "ex", label: "焦点", tone: "emerald" }],
    previewFlows: [
      { fromStage: "ex", toStage: "id", label: "冲刷", tone: "rose", lane: 0 },
      { fromStage: "ex", toStage: "if", label: "冲刷", tone: "rose", lane: 1 }
    ],
    solutionHighlights: [
      { stage: "ex", label: "跳转成立", tone: "rose" },
      { stage: "if", label: "冲刷", tone: "rose" },
      { stage: "id", label: "冲刷", tone: "rose" }
    ],
    solutionFlows: [
      { fromStage: "ex", toStage: "id", label: "冲刷", tone: "rose", lane: 0 },
      { fromStage: "ex", toStage: "if", label: "冲刷", tone: "rose", lane: 1 }
    ]
  }
];
