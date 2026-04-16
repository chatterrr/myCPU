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
  title: "Dispatch Sprint",
  summary:
    "Four short control calls. Read one cycle, pull one lever, and keep the pipeline safe.",
  frames: [
    {
      id: "green-wave",
      title: "F1. Green Wave",
      shortTitle: "Green wave",
      traceSampleId: "pipeline-forward",
      focusStepIndex: 2,
      focusStage: "if",
      briefing:
        "The pipe is filling cleanly. Nothing is stalled or wrong-path yet, so the front gate should stay open.",
      objective: "Which control keeps the next instruction moving into the pipe?",
      choices: [
        buildChoice(
          "advance-if",
          "if",
          "advance",
          "Advance IF",
          "Keep fetch rolling into decode.",
          ">>",
          "cyan",
          "Correct. The front lane is clear, so opening IF keeps the pipe filling and hands the next slot to decode.",
          [
            { stage: "if", label: "advance", tone: "cyan" },
            { stage: "id", label: "receive", tone: "emerald" }
          ],
          [
            { fromStage: "if", toStage: "id", label: "roll", tone: "cyan", lane: 0 }
          ]
        ),
        buildChoice(
          "hold-id",
          "id",
          "hold",
          "Hold ID",
          "Freeze decode even though the lane is clear.",
          "||",
          "amber",
          "That brakes a clean lane. Decode is safe here, so holding ID only stacks fetch behind an unnecessary stoplight.",
          [
            { stage: "id", label: "hold", tone: "amber" },
            { stage: "if", label: "queue", tone: "amber" }
          ],
          [
            { fromStage: "if", toStage: "id", label: "queue", tone: "amber", lane: 0 }
          ]
        ),
        buildChoice(
          "flush-if",
          "if",
          "flush",
          "Flush IF",
          "Throw away the youngest fetch for no reason.",
          "!!",
          "rose",
          "That purges a healthy fetch. Nothing is wrong-path yet, so flushing IF only creates a needless gap at the front of the pipe.",
          [
            { stage: "if", label: "flush", tone: "rose" },
            { stage: "id", label: "gap", tone: "rose" }
          ],
          [
            { fromStage: "if", toStage: "id", label: "lost slot", tone: "rose", lane: 0 }
          ]
        )
      ],
      correctChoiceId: "advance-if",
      previewHighlights: [{ stage: "if", label: "green light", tone: "emerald" }],
      previewFlows: []
    },
    {
      id: "forward-run",
      title: "F2. Forward Run",
      shortTitle: "Forward run",
      traceSampleId: "pipeline-forward",
      focusStepIndex: 5,
      focusStage: "ex",
      briefing:
        "SUB_W has reached EX while its source values are still arriving from older stages. The bypass network is already doing the heavy lifting.",
      objective: "Which call keeps EX moving on this forwarding-friendly cycle?",
      choices: [
        buildChoice(
          "advance-ex",
          "ex",
          "advance",
          "Advance EX",
          "Let EX consume the bypassed values and continue.",
          ">>",
          "cyan",
          "Correct. MEM and WB already have the values that EX needs, so the safest call is to let SUB_W advance.",
          [
            { stage: "ex", label: "advance", tone: "cyan" },
            { stage: "mem", label: "bypass r4", tone: "cyan" },
            { stage: "wb", label: "bypass r2", tone: "cyan" }
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
          "Hold ID",
          "Stop younger traffic even though EX has what it needs.",
          "||",
          "amber",
          "That slows younger traffic even though EX is ready now. Forwarding is already solving the dependency, so this brake wastes throughput.",
          [
            { stage: "id", label: "hold", tone: "amber" },
            { stage: "ex", label: "ready", tone: "emerald" },
            { stage: "mem", label: "r4 ready", tone: "cyan" },
            { stage: "wb", label: "r2 ready", tone: "cyan" }
          ],
          [
            { fromStage: "mem", toStage: "ex", label: "ready", tone: "cyan", lane: 0 },
            { fromStage: "wb", toStage: "ex", label: "ready", tone: "cyan", lane: 1 }
          ]
        ),
        buildChoice(
          "flush-ex",
          "ex",
          "flush",
          "Flush EX",
          "Discard a valid ALU instruction mid-flight.",
          "!!",
          "rose",
          "That throws away a valid ALU op. EX already has the data it needs, so flushing here discards good work instead of protecting the pipe.",
          [
            { stage: "ex", label: "flush", tone: "rose" },
            { stage: "mem", label: "valid data", tone: "cyan" },
            { stage: "wb", label: "valid data", tone: "cyan" }
          ],
          [
            { fromStage: "mem", toStage: "ex", label: "needed", tone: "cyan", lane: 0 },
            { fromStage: "wb", toStage: "ex", label: "needed", tone: "cyan", lane: 1 }
          ]
        )
      ],
      correctChoiceId: "advance-ex",
      previewHighlights: [{ stage: "ex", label: "dispatch", tone: "emerald" }],
      previewFlows: []
    },
    {
      id: "loaduse-brake",
      title: "F3. Load-use Brake",
      shortTitle: "Load-use brake",
      traceSampleId: "pipeline-loaduse",
      focusStepIndex: 2,
      focusStage: "id",
      briefing:
        "The decode stage wants a loaded value that has not come back yet. This is the moment where traffic control must slow the front lane down.",
      objective: "Which lever prevents decode from reading data too early?",
      choices: [
        buildChoice(
          "hold-id",
          "id",
          "hold",
          "Hold ID",
          "Freeze decode until the load result is ready.",
          "||",
          "amber",
          "Correct. The load result is still in flight, so IF and ID must hold for one beat while EX carries the load and the bubble absorbs pressure.",
          [
            { stage: "if", label: "hold", tone: "amber" },
            { stage: "id", label: "hold", tone: "amber" },
            { stage: "ex", label: "bubble", tone: "amber" }
          ],
          [
            {
              fromStage: "ex",
              toStage: "id",
              label: "load pending",
              tone: "amber",
              lane: 0
            }
          ]
        ),
        buildChoice(
          "advance-if",
          "if",
          "advance",
          "Advance IF",
          "Push more work into a lane that is already blocked.",
          ">>",
          "cyan",
          "That pushes new traffic into a blocked decode lane. ID is waiting on the load, so advancing IF only increases pressure at the jam.",
          [
            { stage: "if", label: "advance", tone: "cyan" },
            { stage: "id", label: "blocked", tone: "amber" },
            { stage: "ex", label: "load pending", tone: "amber" }
          ],
          [
            { fromStage: "if", toStage: "id", label: "jam", tone: "amber", lane: 0 },
            {
              fromStage: "ex",
              toStage: "id",
              label: "load pending",
              tone: "amber",
              lane: 1
            }
          ]
        ),
        buildChoice(
          "flush-ex",
          "ex",
          "flush",
          "Flush EX",
          "Throw away the load instead of waiting one beat.",
          "!!",
          "rose",
          "That throws away the load instead of waiting for it. The safe fix is a short hold, not a purge.",
          [
            { stage: "ex", label: "flush", tone: "rose" },
            { stage: "id", label: "still waiting", tone: "amber" }
          ],
          [
            { fromStage: "ex", toStage: "id", label: "value lost", tone: "rose", lane: 0 }
          ]
        )
      ],
      correctChoiceId: "hold-id",
      previewHighlights: [{ stage: "id", label: "red light", tone: "emerald" }],
      previewFlows: []
    },
    {
      id: "branch-purge",
      title: "F4. Branch Purge",
      shortTitle: "Branch purge",
      traceSampleId: "pipeline-branch",
      focusStepIndex: 4,
      focusStage: "ex",
      briefing:
        "EX has resolved a taken branch. The younger instructions in IF and ID are now on the wrong path and must be cleared immediately.",
      objective: "Which call sends the cleanup wave through the younger stages?",
      choices: [
        buildChoice(
          "flush-ex",
          "ex",
          "flush",
          "Flush from EX",
          "Use the branch result in EX to purge younger traffic.",
          "!!",
          "rose",
          "Correct. EX has the taken branch, so it must send a flush wave through IF and ID before the wrong path grows any deeper.",
          [
            { stage: "ex", label: "branch taken", tone: "rose" },
            { stage: "if", label: "flush", tone: "rose" },
            { stage: "id", label: "flush", tone: "rose" }
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
          "Hold ID",
          "Pause the wrong-path instruction instead of removing it.",
          "||",
          "amber",
          "That freezes wrong-path traffic instead of removing it. Once the branch is taken, the younger stages must be cleared, not paused.",
          [
            { stage: "ex", label: "taken", tone: "rose" },
            { stage: "id", label: "hold", tone: "amber" },
            { stage: "if", label: "wrong path", tone: "rose" }
          ],
          [
            {
              fromStage: "ex",
              toStage: "id",
              label: "wrong path remains",
              tone: "rose",
              lane: 0
            }
          ]
        ),
        buildChoice(
          "advance-if",
          "if",
          "advance",
          "Advance IF",
          "Keep fetching deeper into the wrong path.",
          ">>",
          "cyan",
          "That keeps fetching deeper into the wrong path. The branch decision in EX means the front of the pipe should flush, not open wider.",
          [
            { stage: "ex", label: "taken", tone: "rose" },
            { stage: "if", label: "advance", tone: "cyan" },
            { stage: "id", label: "wrong path", tone: "rose" }
          ],
          [
            {
              fromStage: "if",
              toStage: "id",
              label: "more wrong work",
              tone: "rose",
              lane: 0
            },
            {
              fromStage: "ex",
              toStage: "if",
              label: "redirect pending",
              tone: "rose",
              lane: 1
            }
          ]
        )
      ],
      correctChoiceId: "flush-ex",
      previewHighlights: [{ stage: "ex", label: "taken", tone: "emerald" }],
      previewFlows: []
    }
  ]
};
