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
  focusStage: PipelineStageKey;
  briefing: string;
  prompt: string;
  choices: HazardPuzzleChoice[];
  correctChoiceId: HazardChoiceId;
  successText: string;
  failureText: string;
  previewHighlights: HazardStageHighlight[];
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
    focusStage: "id",
    briefing: "ADD_W 还没进 EX，就已经盯上前两条还没写回的结果。",
    prompt: "这张快照里，核心问题属于哪一种 hazard？",
    choices: [
      { id: "raw", label: "RAW", detail: "年轻指令读取前一条尚未写回的结果" },
      { id: "control", label: "Control", detail: "分支改写了 PC 方向" },
      { id: "steady", label: "No hazard", detail: "数据与控制都很安全" }
    ],
    correctChoiceId: "raw",
    successText: "这是典型 RAW 依赖链，ADD_W 同时等着 r2 和 r1。",
    failureText: "这里没有改 PC；真正的问题是 ADD_W 正在追前两条尚未落地的结果。",
    previewHighlights: [{ stage: "id", label: "focus", tone: "emerald" }],
    solutionHighlights: [
      { stage: "id", label: "RAW sink", tone: "amber" },
      { stage: "ex", label: "src r2", tone: "amber" },
      { stage: "mem", label: "src r1", tone: "amber" }
    ],
    solutionFlows: [
      { fromStage: "mem", toStage: "id", label: "r1", tone: "amber", lane: 0 },
      { fromStage: "ex", toStage: "id", label: "r2", tone: "amber", lane: 1 }
    ]
  },
  {
    id: "forward-bridge",
    title: "L2. Forward 桥接",
    shortTitle: "Forward",
    concept: "Forward",
    traceSampleId: "pipeline-forward",
    focusStepIndex: 5,
    focusStage: "ex",
    briefing: "SUB_W 已在 EX，两个源操作数却还漂在前面的流水级里。",
    prompt: "为了不停顿，流水线此刻应该给 SUB_W 什么帮助？",
    choices: [
      { id: "forward", label: "Forward", detail: "把较新的结果直接旁路进 EX" },
      { id: "stall_bubble", label: "Stall + bubble", detail: "冻结前端并塞一个空泡" },
      { id: "flush", label: "Flush", detail: "把更年轻的指令整批冲掉" }
    ],
    correctChoiceId: "forward",
    successText: "对，这一拍靠 MEM 和 WB 的结果旁路进 EX，SUB_W 不需要停。",
    failureText: "这里没有 load-use 缺口，也不是分支改向；最快的做法是直接 forward。",
    previewHighlights: [{ stage: "ex", label: "focus", tone: "emerald" }],
    solutionHighlights: [
      { stage: "ex", label: "consumer", tone: "cyan" },
      { stage: "mem", label: "forward r4", tone: "cyan" },
      { stage: "wb", label: "forward r2", tone: "cyan" }
    ],
    solutionFlows: [
      { fromStage: "mem", toStage: "ex", label: "r4", tone: "cyan", lane: 0 },
      { fromStage: "wb", toStage: "ex", label: "r2", tone: "cyan", lane: 1 }
    ]
  },
  {
    id: "loaduse-brake",
    title: "L3. Load-use 刹车",
    shortTitle: "Load-use",
    concept: "Load-use",
    traceSampleId: "pipeline-loaduse",
    focusStepIndex: 2,
    focusStage: "id",
    briefing: "LD_W 还在路上，下一条 ADDI_W 就想马上吃到加载结果。",
    prompt: "这时最保守、也最正确的教学动作是什么？",
    choices: [
      { id: "forward", label: "Forward", detail: "像 ALU hazard 一样直接旁路" },
      { id: "stall_bubble", label: "Stall + bubble", detail: "先停 IF / ID，再在 EX 插入空泡" },
      { id: "flush", label: "Flush", detail: "把 IF / ID 清空重新抓取" }
    ],
    correctChoiceId: "stall_bubble",
    successText: "没错，load-use 要先顶住 IF / ID，再给 EX 一个 bubble 等数据回来。",
    failureText: "加载结果这拍还没到位，硬 forward 不安全；这里该 stall，并在 EX 插 bubble。",
    previewHighlights: [{ stage: "id", label: "focus", tone: "emerald" }],
    solutionHighlights: [
      { stage: "if", label: "stall", tone: "amber" },
      { stage: "id", label: "stall", tone: "amber" },
      { stage: "ex", label: "bubble", tone: "amber" }
    ],
    solutionFlows: [
      {
        fromStage: "ex",
        toStage: "id",
        label: "load not ready",
        tone: "amber",
        lane: 0
      }
    ]
  },
  {
    id: "branch-sweep",
    title: "L4. Branch 冲刷",
    shortTitle: "Flush",
    concept: "Branch",
    traceSampleId: "pipeline-branch",
    focusStepIndex: 4,
    focusStage: "ex",
    briefing: "BEQ 已在 EX 判定 taken，前面那两条年轻指令已经走错路了。",
    prompt: "判定成立后，最直接的图形动作应该是什么？",
    choices: [
      { id: "forward", label: "Forward", detail: "继续把旧值旁路给新指令" },
      { id: "stall_bubble", label: "Stall + bubble", detail: "先停住，再慢慢恢复" },
      { id: "flush", label: "Flush", detail: "把 IF / ID 的错路指令立刻冲掉" }
    ],
    correctChoiceId: "flush",
    successText: "对，taken branch 会把更年轻的 IF / ID 直接 flush 掉。",
    failureText: "这里已经不是等数据，而是 PC 已改道；错路上的 IF / ID 必须马上 flush。",
    previewHighlights: [{ stage: "ex", label: "focus", tone: "emerald" }],
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
