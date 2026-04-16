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
    briefing: "译码想立刻读到前两条结果，但数据还没落地。",
    prompt: "这一拍先看什么？",
    choices: [
      { id: "raw", label: "RAW", detail: "前面的结果还没写回。" },
      { id: "control", label: "控制", detail: "PC 方向改变了。" },
      { id: "steady", label: "继续", detail: "这拍没有风险。" }
    ],
    correctChoiceId: "raw",
    successText: "对。ID 正在追前面的结果，这是典型 RAW 依赖。",
    failureText: "这里不是分支改向，问题在于 ID 正在等旧结果。",
    previewHighlights: [{ stage: "id", label: "焦点", tone: "emerald" }],
    previewFlows: [
      { fromStage: "mem", toStage: "id", label: "r1", tone: "amber", lane: 0 },
      { fromStage: "ex", toStage: "id", label: "r2", tone: "amber", lane: 1 }
    ],
    solutionHighlights: [
      { stage: "id", label: "consumer", tone: "amber" },
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
    concept: "Forward",
    traceSampleId: "pipeline-forward",
    focusStepIndex: 5,
    previewStartStep: 3,
    previewEndStep: 6,
    focusStage: "ex",
    briefing: "EX 已经拿到旧结果的旁路输入，这拍可以继续走。",
    prompt: "这拍该做什么？",
    choices: [
      { id: "forward", label: "旁路", detail: "把新结果直接送进 EX。" },
      { id: "stall_bubble", label: "暂停", detail: "前端先停一下再说。" },
      { id: "flush", label: "冲刷", detail: "把年轻指令清掉。" }
    ],
    correctChoiceId: "forward",
    successText: "对。旁路已经成立，EX 不用停车。",
    failureText: "这里不是 load-use，也不是错路，直接旁路最合适。",
    previewHighlights: [{ stage: "ex", label: "焦点", tone: "emerald" }],
    previewFlows: [
      { fromStage: "mem", toStage: "ex", label: "r4", tone: "cyan", lane: 0 },
      { fromStage: "wb", toStage: "ex", label: "r2", tone: "cyan", lane: 1 }
    ],
    solutionHighlights: [
      { stage: "ex", label: "consumer", tone: "cyan" },
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
    shortTitle: "暂停",
    concept: "Load-use",
    traceSampleId: "pipeline-loaduse",
    focusStepIndex: 2,
    previewStartStep: 0,
    previewEndStep: 4,
    focusStage: "id",
    briefing: "load 结果还在路上，译码现在读会太早。",
    prompt: "这拍该怎么控？",
    choices: [
      { id: "forward", label: "旁路", detail: "像普通 ALU hazard 一样直接送。" },
      { id: "stall_bubble", label: "暂停", detail: "IF / ID 顶住，EX 插入气泡。" },
      { id: "flush", label: "冲刷", detail: "把 IF / ID 全部清掉。" }
    ],
    correctChoiceId: "stall_bubble",
    successText: "对。先停住 IF / ID，再给 EX 插一个 bubble。",
    failureText: "load 结果这拍还没到，硬旁路不安全，也不该直接冲刷。",
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
      { stage: "if", label: "暂停", tone: "amber" },
      { stage: "id", label: "暂停", tone: "amber" },
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
    concept: "Branch",
    traceSampleId: "pipeline-branch",
    focusStepIndex: 4,
    previewStartStep: 2,
    previewEndStep: 5,
    focusStage: "ex",
    briefing: "EX 判定分支成立，前面的年轻指令已经走错路。",
    prompt: "现在该按哪一个？",
    choices: [
      { id: "forward", label: "旁路", detail: "继续把旧值送下去。" },
      { id: "stall_bubble", label: "暂停", detail: "先停住，等等看。" },
      { id: "flush", label: "冲刷", detail: "把 IF / ID 错路立即清掉。" }
    ],
    correctChoiceId: "flush",
    successText: "对。分支成立后，年轻指令必须立刻冲刷。",
    failureText: "这里不是等数据，而是 PC 已改向，错路要马上清掉。",
    previewHighlights: [{ stage: "ex", label: "焦点", tone: "emerald" }],
    previewFlows: [
      { fromStage: "ex", toStage: "id", label: "flush", tone: "rose", lane: 0 },
      { fromStage: "ex", toStage: "if", label: "flush", tone: "rose", lane: 1 }
    ],
    solutionHighlights: [
      { stage: "ex", label: "taken", tone: "rose" },
      { stage: "if", label: "flush", tone: "rose" },
      { stage: "id", label: "flush", tone: "rose" }
    ],
    solutionFlows: [
      { fromStage: "ex", toStage: "id", label: "flush", tone: "rose", lane: 0 },
      { fromStage: "ex", toStage: "if", label: "flush", tone: "rose", lane: 1 }
    ]
  }
];
