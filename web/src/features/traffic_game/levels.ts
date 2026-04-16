import type {
  HazardFlowHint,
  HazardHintTone,
  HazardStageHighlight
} from "@/features/lesson_hazard/contracts";
import type {
  TrafficGameActionType,
  TrafficGameChoiceDescriptor
} from "@/features/traffic_game/contracts";
import type { PipelineStageKey } from "@/features/trace/types";

export type TrafficGameChoiceId =
  | "advance-if"
  | "advance-ex"
  | "hold-id"
  | "flush-ex"
  | "flush-if";

export interface TrafficGameChoice extends TrafficGameChoiceDescriptor {
  id: TrafficGameChoiceId;
}

export interface TrafficGameLevel {
  id: string;
  title: string;
  shortTitle: string;
  traceSampleId: string;
  focusStepIndex: number;
  focusStage: PipelineStageKey;
  briefing: string;
  objective: string;
  choices: TrafficGameChoice[];
  correctChoiceId: TrafficGameChoiceId;
  previewHighlights: HazardStageHighlight[];
  previewFlows: HazardFlowHint[];
}

export interface TrafficGameMission {
  id: string;
  title: string;
  summary: string;
  frames: TrafficGameLevel[];
}

export interface TrafficGameFeedback {
  status: "correct" | "incorrect";
  explanation: string;
  choice: TrafficGameChoice;
  recommendedChoice: TrafficGameChoice;
  stageHighlights: HazardStageHighlight[];
  flowHints: HazardFlowHint[];
}

function buildChoice(
  id: TrafficGameChoiceId,
  stage: PipelineStageKey,
  action: TrafficGameActionType,
  label: string,
  detail: string,
  cue: string,
  tone: HazardHintTone,
  feedbackText: string,
  feedbackHighlights: HazardStageHighlight[],
  feedbackFlows: HazardFlowHint[]
): TrafficGameChoice {
  return {
    id,
    stage,
    action,
    reason: detail,
    label,
    detail,
    cue,
    tone,
    feedback: {
      text: feedbackText,
      stageHighlights: feedbackHighlights,
      flowHints: feedbackFlows
    }
  };
}

export function getTrafficGamePreviewHighlights(
  level: TrafficGameLevel
): HazardStageHighlight[] {
  return level.previewHighlights;
}

export function buildTrafficGameFeedback(
  level: TrafficGameLevel,
  choiceId: TrafficGameChoiceId
): TrafficGameFeedback {
  const choice =
    level.choices.find((candidate) => candidate.id === choiceId) ?? level.choices[0];
  const recommendedChoice =
    level.choices.find((candidate) => candidate.id === level.correctChoiceId)
    ?? level.choices[0];
  const isCorrect = choiceId === level.correctChoiceId;

  return {
    status: isCorrect ? "correct" : "incorrect",
    explanation: choice.feedback.text,
    choice,
    recommendedChoice,
    stageHighlights: choice.feedback.stageHighlights,
    flowHints: choice.feedback.flowHints
  };
}

export const trafficControlMission: TrafficGameMission = {
  id: "dispatch-sprint",
  title: "路口调度",
  summary: "四个时刻。读一拍、走到控制点、执行一个动作。",
  frames: [
    {
      id: "green-wave",
      title: "F1. 入口绿波",
      shortTitle: "绿波",
      traceSampleId: "pipeline-forward",
      focusStepIndex: 2,
      focusStage: "if",
      briefing: "入口车道通畅，当前重点是让新车顺利进场。",
      objective: "走到对应控制点后，选一个动作让车流继续前进。",
      choices: [
        buildChoice(
          "advance-if",
          "if",
          "advance",
          "入口放行",
          "入口车道保持绿灯，继续把新车送进来。",
          "GO",
          "cyan",
          "对。入口当前没有堵点，放行能让车流顺畅接到下一个 stage。",
          [
            { stage: "if", label: "绿灯", tone: "cyan" },
            { stage: "id", label: "接车", tone: "emerald" }
          ],
          [{ fromStage: "if", toStage: "id", label: "进场", tone: "cyan", lane: 0 }]
        ),
        buildChoice(
          "hold-id",
          "id",
          "hold",
          "译码红灯",
          "明明没有压力，却提前把等待区锁住。",
          "STOP",
          "amber",
          "这会无故把流量堵在入口前。当前译码区是畅通的，不需要提前刹车。",
          [
            { stage: "id", label: "红灯", tone: "amber" },
            { stage: "if", label: "排队", tone: "amber" }
          ],
          [{ fromStage: "if", toStage: "id", label: "堆积", tone: "amber", lane: 0 }]
        ),
        buildChoice(
          "flush-if",
          "if",
          "flush",
          "入口清空",
          "把刚抓到的年轻车辆直接清掉。",
          "CLR",
          "rose",
          "这会白白丢掉健康流量。现在还没有错路，不该对入口做清场。",
          [
            { stage: "if", label: "清空", tone: "rose" },
            { stage: "id", label: "空档", tone: "rose" }
          ],
          [{ fromStage: "if", toStage: "id", label: "空槽", tone: "rose", lane: 0 }]
        )
      ],
      correctChoiceId: "advance-if",
      previewHighlights: [{ stage: "if", label: "入口", tone: "emerald" }],
      previewFlows: []
    },
    {
      id: "forward-run",
      title: "F2. 中心旁路",
      shortTitle: "旁路",
      traceSampleId: "pipeline-forward",
      focusStepIndex: 5,
      focusStage: "ex",
      briefing: "中心路口的车正在吃到旁路结果，这拍可以直接放行。",
      objective: "靠近执行路口，选择一个动作处理当前车辆。",
      choices: [
        buildChoice(
          "advance-ex",
          "ex",
          "advance",
          "路口放行",
          "让 EX 车辆借道通过，不额外停车。",
          "GO",
          "cyan",
          "对。旁路已经到位，中心路口直接放行最顺畅。",
          [
            { stage: "ex", label: "放行", tone: "cyan" },
            { stage: "mem", label: "r4", tone: "emerald" },
            { stage: "wb", label: "r2", tone: "emerald" }
          ],
          [
            { fromStage: "mem", toStage: "ex", label: "r4", tone: "cyan", lane: 0 },
            { fromStage: "wb", toStage: "ex", label: "r2", tone: "cyan", lane: 1 }
          ]
        ),
        buildChoice(
          "hold-id",
          "id",
          "hold",
          "等待区拦停",
          "把年轻车辆先顶在等待区里。",
          "STOP",
          "amber",
          "旁路已经帮 EX 解开依赖，这时再拦停只会平白降低吞吐。",
          [
            { stage: "id", label: "拦停", tone: "amber" },
            { stage: "ex", label: "已就绪", tone: "emerald" }
          ],
          [{ fromStage: "mem", toStage: "ex", label: "已到位", tone: "cyan", lane: 0 }]
        ),
        buildChoice(
          "flush-ex",
          "ex",
          "flush",
          "路口清场",
          "把中心路口的有效车辆直接清掉。",
          "CLR",
          "rose",
          "这会把已经准备好的有效车辆扫掉，既不安全也不必要。",
          [
            { stage: "ex", label: "清场", tone: "rose" },
            { stage: "mem", label: "有效数据", tone: "cyan" }
          ],
          [{ fromStage: "wb", toStage: "ex", label: "仍需使用", tone: "cyan", lane: 0 }]
        )
      ],
      correctChoiceId: "advance-ex",
      previewHighlights: [{ stage: "ex", label: "路口", tone: "emerald" }],
      previewFlows: []
    },
    {
      id: "loaduse-brake",
      title: "F3. 等待区刹车",
      shortTitle: "刹车",
      traceSampleId: "pipeline-loaduse",
      focusStepIndex: 2,
      focusStage: "id",
      briefing: "等待区想要的载入结果还没回来，这时必须先顶住车流。",
      objective: "走到等待区控制点，决定要不要亮红灯。",
      choices: [
        buildChoice(
          "hold-id",
          "id",
          "hold",
          "等待区红灯",
          "先让 IF / ID 顶住一拍，给 load 让路。",
          "STOP",
          "amber",
          "对。这里要先顶住等待区，再给 EX 一个气泡去消化压力。",
          [
            { stage: "if", label: "排队", tone: "amber" },
            { stage: "id", label: "红灯", tone: "amber" },
            { stage: "ex", label: "bubble", tone: "amber" }
          ],
          [
            {
              fromStage: "ex",
              toStage: "id",
              label: "load 未到",
              tone: "amber",
              lane: 0
            }
          ]
        ),
        buildChoice(
          "advance-if",
          "if",
          "advance",
          "入口继续放",
          "入口继续往里塞车，给堵点加压。",
          "GO",
          "cyan",
          "这会把入口车辆继续推向已经堵住的等待区，压力只会更大。",
          [
            { stage: "if", label: "继续进车", tone: "cyan" },
            { stage: "id", label: "已堵", tone: "amber" }
          ],
          [{ fromStage: "if", toStage: "id", label: "堆积", tone: "amber", lane: 0 }]
        ),
        buildChoice(
          "flush-ex",
          "ex",
          "flush",
          "执行区清场",
          "把正在走的 load 直接清掉。",
          "CLR",
          "rose",
          "这里需要的是短暂停车，不是把有效 load 清空。",
          [
            { stage: "ex", label: "清场", tone: "rose" },
            { stage: "id", label: "仍在等待", tone: "amber" }
          ],
          [{ fromStage: "ex", toStage: "id", label: "值丢失", tone: "rose", lane: 0 }]
        )
      ],
      correctChoiceId: "hold-id",
      previewHighlights: [{ stage: "id", label: "等待区", tone: "emerald" }],
      previewFlows: []
    },
    {
      id: "branch-purge",
      title: "F4. 错路清场",
      shortTitle: "清场",
      traceSampleId: "pipeline-branch",
      focusStepIndex: 4,
      focusStage: "ex",
      briefing: "分支判定已成立，前面的年轻车辆都在错路上。",
      objective: "靠近执行路口，发动一次正确的清场动作。",
      choices: [
        buildChoice(
          "flush-ex",
          "ex",
          "flush",
          "从路口清场",
          "以 EX 为起点，把 IF / ID 错路一起扫掉。",
          "CLR",
          "rose",
          "对。分支在 EX 成立后，必须立即把年轻错路一起冲刷掉。",
          [
            { stage: "ex", label: "判定成立", tone: "rose" },
            { stage: "if", label: "清场", tone: "rose" },
            { stage: "id", label: "清场", tone: "rose" }
          ],
          [
            { fromStage: "ex", toStage: "id", label: "flush", tone: "rose", lane: 0 },
            { fromStage: "ex", toStage: "if", label: "flush", tone: "rose", lane: 1 }
          ]
        ),
        buildChoice(
          "hold-id",
          "id",
          "hold",
          "等待区暂停",
          "只是停住错路车辆，不把它们扫走。",
          "STOP",
          "amber",
          "错路不能只停住，必须立刻清掉，否则错误路径还会继续占资源。",
          [
            { stage: "id", label: "停住", tone: "amber" },
            { stage: "if", label: "仍是错路", tone: "rose" }
          ],
          [{ fromStage: "ex", toStage: "id", label: "仍未清场", tone: "rose", lane: 0 }]
        ),
        buildChoice(
          "advance-if",
          "if",
          "advance",
          "入口继续放行",
          "让新车继续冲进错误路径。",
          "GO",
          "cyan",
          "这会让错路越走越深。既然已经判定改向，就应马上清场。",
          [
            { stage: "if", label: "继续进错路", tone: "rose" },
            { stage: "ex", label: "改向待执行", tone: "rose" }
          ],
          [{ fromStage: "if", toStage: "id", label: "继续错路", tone: "rose", lane: 0 }]
        )
      ],
      correctChoiceId: "flush-ex",
      previewHighlights: [{ stage: "ex", label: "路口", tone: "emerald" }],
      previewFlows: []
    }
  ]
};
