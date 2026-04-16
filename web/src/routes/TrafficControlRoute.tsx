import { startTransition, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import { Panel } from "@/components/Panel";
import { Tag, type TagTone } from "@/components/Tag";
import { HazardPuzzleBoard } from "@/features/lesson_hazard/HazardPuzzleBoard";
import {
  trafficActionLabels,
  trafficActionTones
} from "@/features/traffic_game/contracts";
import {
  buildTrafficGameFeedback,
  getTrafficGamePreviewHighlights,
  trafficControlMission,
  type TrafficGameChoice,
  type TrafficGameChoiceId
} from "@/features/traffic_game/levels";
import {
  loadTraceFromSample,
  sampleTraceOptions
} from "@/features/trace/sources";
import type { TraceDocument } from "@/features/trace/types";

const sampleOptionById = new Map(
  sampleTraceOptions.map((option) => [option.id, option])
);

const requiredSampleIds = Array.from(
  new Set(trafficControlMission.frames.map((frame) => frame.traceSampleId))
);

const feedbackStatusTones: Record<"correct" | "incorrect", TagTone> = {
  correct: "emerald",
  incorrect: "rose"
};

const idleChoiceClassByTone: Record<TagTone, string> = {
  neutral:
    "border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/8",
  cyan:
    "border-cyan-300/15 bg-cyan-300/8 text-slate-100 hover:border-cyan-300/35 hover:bg-cyan-300/12",
  amber:
    "border-amber-300/15 bg-amber-300/8 text-slate-100 hover:border-amber-300/35 hover:bg-amber-300/12",
  emerald:
    "border-emerald-300/15 bg-emerald-300/8 text-slate-100 hover:border-emerald-300/35 hover:bg-emerald-300/12",
  rose:
    "border-rose-300/15 bg-rose-300/8 text-slate-100 hover:border-rose-300/35 hover:bg-rose-300/12"
};

const revealChoiceClassByTone: Record<TagTone, string> = {
  neutral: "border-white/15 bg-white/8 text-slate-100",
  cyan: "border-cyan-300/30 bg-cyan-300/12 text-cyan-50",
  amber: "border-amber-300/30 bg-amber-300/12 text-amber-50",
  emerald: "border-emerald-300/30 bg-emerald-300/12 text-emerald-50",
  rose: "border-rose-300/30 bg-rose-300/12 text-rose-50"
};

function getChoiceTone(choice: TrafficGameChoice): TagTone {
  return trafficActionTones[choice.action] ?? choice.tone;
}

export function TrafficControlRoute() {
  const [traceMap, setTraceMap] = useState<Record<string, TraceDocument>>({});
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<TrafficGameChoiceId | null>(
    null
  );
  const [clearedFrameIds, setClearedFrameIds] = useState<string[]>([]);
  const [attemptsByFrame, setAttemptsByFrame] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTrafficTraces() {
      setIsLoading(true);
      setError(null);

      try {
        const entries = await Promise.all(
          requiredSampleIds.map(async (sampleId) => {
            const option = sampleOptionById.get(sampleId);

            if (!option) {
              throw new Error(`Missing sample trace option: ${sampleId}`);
            }

            return [sampleId, await loadTraceFromSample(option)] as const;
          })
        );

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setTraceMap(Object.fromEntries(entries));
          setIsLoading(false);
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError((loadError as Error).message);
        setIsLoading(false);
      }
    }

    void loadTrafficTraces();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeFrame = trafficControlMission.frames[activeFrameIndex];
  const activeTrace = traceMap[activeFrame.traceSampleId] ?? null;
  const activeStep = activeTrace?.steps[activeFrame.focusStepIndex] ?? null;
  const feedback = selectedChoiceId
    ? buildTrafficGameFeedback(activeFrame, selectedChoiceId)
    : null;
  const previewHighlights = getTrafficGamePreviewHighlights(activeFrame);
  const boardHighlights = feedback
    ? [...previewHighlights, ...feedback.stageHighlights]
    : previewHighlights;
  const boardFlows = feedback ? feedback.flowHints : activeFrame.previewFlows;
  const currentAttemptCount = attemptsByFrame[activeFrame.id] ?? 0;
  const solvedFrameCount = clearedFrameIds.length;
  const firstPassCount = clearedFrameIds.filter(
    (frameId) => (attemptsByFrame[frameId] ?? 0) === 1
  ).length;
  const totalAttempts = Object.values(attemptsByFrame).reduce(
    (total, count) => total + count,
    0
  );
  const missedCalls = Math.max(totalAttempts - solvedFrameCount, 0);
  const progressPercent = Math.round(
    (solvedFrameCount / trafficControlMission.frames.length) * 100
  );
  const isFrameCleared = clearedFrameIds.includes(activeFrame.id);
  const isLastFrame = activeFrameIndex === trafficControlMission.frames.length - 1;
  const selectedCallLabel = feedback
    ? `${trafficActionLabels[feedback.choice.action]} ${feedback.choice.stage.toUpperCase()}`
    : "Pick a call";
  const selectedCallTone = feedback ? getChoiceTone(feedback.choice) : "neutral";

  function goToFrame(index: number) {
    startTransition(() => {
      setActiveFrameIndex(index);
      setSelectedChoiceId(null);
    });
  }

  function chooseAction(choiceId: TrafficGameChoiceId) {
    startTransition(() => {
      setSelectedChoiceId(choiceId);
      setAttemptsByFrame((current) => ({
        ...current,
        [activeFrame.id]: (current[activeFrame.id] ?? 0) + 1
      }));

      if (choiceId === activeFrame.correctChoiceId) {
        setClearedFrameIds((currentIds) =>
          currentIds.includes(activeFrame.id)
            ? currentIds
            : [...currentIds, activeFrame.id]
        );
      }
    });
  }

  function goToNextFrame() {
    goToFrame(isLastFrame ? 0 : activeFrameIndex + 1);
  }

  function resetMission() {
    startTransition(() => {
      setActiveFrameIndex(0);
      setSelectedChoiceId(null);
      setClearedFrameIds([]);
      setAttemptsByFrame({});
    });
  }

  function getChoiceClasses(choice: TrafficGameChoice) {
    const tone = getChoiceTone(choice);

    if (!selectedChoiceId) {
      return idleChoiceClassByTone[tone];
    }

    if (choice.id === selectedChoiceId) {
      return feedback?.status === "correct"
        ? "border-emerald-300/35 bg-emerald-300/15 text-emerald-50"
        : "border-rose-300/35 bg-rose-300/15 text-rose-50";
    }

    if (choice.id === activeFrame.correctChoiceId) {
      return revealChoiceClassByTone[tone];
    }

    return "border-white/10 bg-white/5 text-slate-300";
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(251,113,133,0.14),_transparent_22%),linear-gradient(180deg,_#050816_0%,_#07111b_42%,_#020617_100%)]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid gap-4 rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_32px_90px_rgba(2,6,23,0.45)] backdrop-blur xl:grid-cols-[1.15fr,0.85fr]"
        >
          <div className="space-y-4">
            <Link
              to="/"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-300 transition hover:border-cyan-300/35 hover:text-slate-50"
            >
              Back to home
            </Link>

            <div className="flex flex-wrap gap-2">
              <Tag label="Entry 2" tone="cyan" />
              <Tag label={trafficControlMission.title} tone="emerald" />
              <Tag label={`${trafficControlMission.frames.length} dispatch calls`} tone="rose" />
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">
                Pipeline Traffic Control
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
                A lightweight dispatch game built on the same pipeline snapshots
                as the hazard lesson. Read the stage board, pull one lever, and
                keep the pipe flowing safely.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                Flow meter
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-50">
                {solvedFrameCount}/{trafficControlMission.frames.length}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Cleared frames in the current sprint.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                Control legend
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Tag label="advance" tone="cyan" />
                <Tag label="hold" tone="amber" />
                <Tag label="flush" tone="rose" />
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                Trace source
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                Every frame reuses the existing pipeline JSONL samples and the
                same stage-highlight language as the hazard lesson.
              </p>
            </div>
          </div>
        </motion.header>

        <div className="grid gap-6 xl:grid-cols-[300px,1fr]">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="space-y-6"
          >
            <Panel
              title="Dispatch map"
              description={trafficControlMission.summary}
            >
              <div className="space-y-3">
                {trafficControlMission.frames.map((frame, index) => {
                  const solved = clearedFrameIds.includes(frame.id);
                  const selected = index === activeFrameIndex;

                  return (
                    <button
                      key={frame.id}
                      type="button"
                      onClick={() => goToFrame(index)}
                      className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
                        selected
                          ? "border-cyan-300/35 bg-cyan-300/12"
                          : solved
                            ? "border-emerald-300/25 bg-emerald-300/10"
                            : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-50">
                          {frame.title}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.28em] text-slate-400">
                          {solved ? "Cleared" : `Call ${index + 1}`}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {frame.briefing}
                      </p>
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel
              title="Control rules"
              description="Small, visual, and fast: one frame, one lever, one reaction."
            >
              <div className="space-y-3 text-sm leading-6 text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  1. Read the highlighted stage and the current cycle.
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  2. Pick one control call: advance, hold, or flush.
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  3. Watch the board react with the same hazard cues used in Entry 1.
                </div>
              </div>
            </Panel>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="space-y-6"
          >
            <Panel
              title={activeFrame.title}
              description={activeFrame.briefing}
            >
              {isLoading ? (
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-300">
                  Loading traffic control frames...
                </div>
              ) : error ? (
                <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-8 text-center text-sm text-rose-100">
                  {error}
                </div>
              ) : activeStep ? (
                <div className="space-y-5">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${activeFrame.id}-${selectedChoiceId ?? "preview"}`}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.26 }}
                    >
                      <HazardPuzzleBoard
                        step={activeStep}
                        stageHighlights={boardHighlights}
                        flowHints={boardFlows}
                        snapshotLabel="Traffic snapshot"
                        badgeLabel="One cycle, one dispatch call"
                      />
                    </motion.div>
                  </AnimatePresence>

                  <div className="flex flex-wrap gap-2">
                    <Tag label={`cycle ${activeStep.pipeline?.cycle ?? "-"}`} tone="cyan" />
                    <Tag
                      label={activeTrace?.meta?.program ?? activeFrame.traceSampleId}
                      tone="neutral"
                    />
                    <Tag label={`focus ${activeFrame.focusStage.toUpperCase()}`} tone="emerald" />
                    <Tag label={activeFrame.shortTitle} tone="rose" />
                    <Tag label={`step ${activeFrame.focusStepIndex}`} tone="neutral" />
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[0.95fr,1.05fr]">
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        Dispatch strip
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Tag label={selectedCallLabel} tone={selectedCallTone} />
                        <Tag
                          label={feedback ? "board reacting" : "awaiting lever"}
                          tone={feedback ? feedbackStatusTones[feedback.status] : "neutral"}
                        />
                        {feedback && feedback.status === "incorrect" ? (
                          <Tag
                            label={`best ${trafficActionLabels[feedback.recommendedChoice.action]} ${feedback.recommendedChoice.stage.toUpperCase()}`}
                            tone={getChoiceTone(feedback.recommendedChoice)}
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        Board cue
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-200">
                        {feedback
                          ? feedback.explanation
                          : "Pick one lever to preview that traffic call directly on the shared pipeline stage board."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-300">
                  This dispatch frame is missing.
                </div>
              )}
            </Panel>

            <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
              <Panel
                title="Dispatch console"
                description={activeFrame.objective}
              >
                <div className="grid gap-3 md:grid-cols-3">
                  {activeFrame.choices.map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => chooseAction(choice.id)}
                      className={`rounded-[26px] border px-4 py-4 text-left transition ${getChoiceClasses(choice)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.28em] opacity-70">
                            {choice.stage.toUpperCase()}
                          </p>
                          <p className="mt-3 text-3xl font-semibold">{choice.cue}</p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em]">
                          {trafficActionLabels[choice.action]}
                        </span>
                      </div>
                      <p className="mt-4 text-base font-semibold">{choice.label}</p>
                      <p className="mt-2 text-sm leading-6 opacity-90">{choice.detail}</p>
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {feedback ? (
                    <motion.div
                      key={`${activeFrame.id}-${selectedChoiceId}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22 }}
                      className={`mt-5 rounded-[24px] border p-4 ${
                        feedback.status === "correct"
                          ? "border-emerald-300/30 bg-emerald-300/12 text-emerald-50"
                          : "border-rose-300/30 bg-rose-300/12 text-rose-50"
                      }`}
                    >
                      <div className="flex flex-wrap gap-2">
                        <Tag
                          label={selectedCallLabel}
                          tone={getChoiceTone(feedback.choice)}
                        />
                        <Tag
                          label={
                            feedback.status === "correct"
                              ? "dispatch confirmed"
                              : "traffic conflict"
                          }
                          tone={feedbackStatusTones[feedback.status]}
                        />
                        {feedback.status === "incorrect" ? (
                          <Tag
                            label={`route ${trafficActionLabels[feedback.recommendedChoice.action]} ${feedback.recommendedChoice.stage.toUpperCase()}`}
                            tone={getChoiceTone(feedback.recommendedChoice)}
                          />
                        ) : null}
                      </div>
                      <p className="mt-3 text-xs uppercase tracking-[0.28em] opacity-80">
                        {feedback.status === "correct" ? "Dispatch confirmed" : "Traffic conflict"}
                      </p>
                      <p className="mt-3 text-sm leading-6">{feedback.explanation}</p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={goToNextFrame}
                    disabled={!isFrameCleared}
                    className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-50 transition hover:border-cyan-300/40 hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
                  >
                    {isLastFrame ? "Loop sprint" : "Dispatch next frame"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedChoiceId(null)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                  >
                    Clear call
                  </button>
                  <button
                    type="button"
                    onClick={resetMission}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                  >
                    Restart sprint
                  </button>
                </div>
              </Panel>

              <Panel
                title="Traffic HUD"
                description="Light scoring, minimal text, same trace language."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      Current op
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-50">
                      {activeStep?.op ?? "-"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      Live lever
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-50">
                      {selectedCallLabel}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      Attempts here
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-50">
                      {currentAttemptCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      Flow meter
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-50">
                      {progressPercent}%
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    Sprint stats
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Tag label={`first pass ${firstPassCount}`} tone="emerald" />
                    <Tag label={`retries ${missedCalls}`} tone="amber" />
                    <Tag label={`cleared ${solvedFrameCount}`} tone="cyan" />
                  </div>
                </div>

                <div className="mt-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    Visual legend
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Tag label="cyan = advance / bypass flow" tone="cyan" />
                    <Tag label="amber = hold / bubble pressure" tone="amber" />
                    <Tag label="rose = flush purge wave" tone="rose" />
                  </div>
                </div>
              </Panel>
            </div>

            {solvedFrameCount === trafficControlMission.frames.length ? (
              <Panel
                title="Sprint clear"
                description="The traffic-control mode is now fully playable on top of the existing trace viewer stack."
              >
                <p className="text-sm leading-7 text-slate-300">
                  Entry 2 reuses the same trace samples, stage board, and hazard
                  cue language as Entry 1, but swaps quiz choices for live
                  dispatch calls.
                </p>
              </Panel>
            ) : null}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
