import { startTransition, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Panel } from "@/components/Panel";
import { PipelineStageCanvas } from "@/features/pipeline/PipelineStageCanvas";
import {
  buildHazardPuzzleFeedback,
  getHazardPuzzlePreviewFlows,
  getHazardPuzzlePreviewHighlights,
  hazardPuzzleLevels,
  type HazardChoiceId
} from "@/features/lesson_hazard/levels";
import {
  loadTraceFromSample,
  sampleTraceOptions
} from "@/features/trace/sources";
import type { TraceDocument } from "@/features/trace/types";

const sampleOptionById = new Map(
  sampleTraceOptions.map((option) => [option.id, option])
);

const requiredSampleIds = Array.from(
  new Set(hazardPuzzleLevels.map((level) => level.traceSampleId))
);

const choiceLetters = ["A", "B", "C", "D", "E", "F"];

function clampPreviewStep(
  nextIndex: number,
  activeLevel: (typeof hazardPuzzleLevels)[number],
  activeTrace: TraceDocument | null
) {
  if (!activeTrace) {
    return activeLevel.focusStepIndex;
  }

  const minIndex = activeLevel.previewStartStep;
  const maxIndex = Math.min(activeLevel.previewEndStep, activeTrace.steps.length - 1);

  return Math.max(minIndex, Math.min(nextIndex, maxIndex));
}

export function HazardPuzzleRoute() {
  const [traceMap, setTraceMap] = useState<Record<string, TraceDocument>>({});
  const [activeLevelIndex, setActiveLevelIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<HazardChoiceId | null>(
    null
  );
  const [solvedLevelIds, setSolvedLevelIds] = useState<string[]>([]);
  const [previewStepIndex, setPreviewStepIndex] = useState(
    hazardPuzzleLevels[0]?.focusStepIndex ?? 0
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPuzzleTraces() {
      setIsLoading(true);
      setError(null);

      try {
        const entries = await Promise.all(
          requiredSampleIds.map(async (sampleId) => {
            const option = sampleOptionById.get(sampleId);

            if (!option) {
              throw new Error(`缺少示例 trace: ${sampleId}`);
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

    void loadPuzzleTraces();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeLevel = hazardPuzzleLevels[activeLevelIndex];
  const activeTrace = traceMap[activeLevel.traceSampleId] ?? null;
  const activeStep = activeTrace?.steps[previewStepIndex] ?? null;
  const previousStep =
    activeTrace && previewStepIndex > 0 ? activeTrace.steps[previewStepIndex - 1] : null;
  const feedback = selectedChoiceId
    ? buildHazardPuzzleFeedback(activeLevel, selectedChoiceId)
    : null;
  const previewHighlights = getHazardPuzzlePreviewHighlights(activeLevel);
  const previewFlows = getHazardPuzzlePreviewFlows(activeLevel);
  const boardHighlights = feedback
    ? [...previewHighlights, ...feedback.stageHighlights]
    : previewHighlights;
  const boardFlows = feedback ? feedback.flowHints : previewFlows;
  const solvedCount = solvedLevelIds.length;
  const maxIndex = activeTrace
    ? Math.min(activeLevel.previewEndStep, activeTrace.steps.length - 1)
    : activeLevel.previewEndStep;

  function goToLevel(index: number) {
    const nextLevel = hazardPuzzleLevels[index];

    startTransition(() => {
      setActiveLevelIndex(index);
      setPreviewStepIndex(nextLevel.focusStepIndex);
      setSelectedChoiceId(null);
    });
  }

  function chooseAnswer(choiceId: HazardChoiceId) {
    startTransition(() => {
      setSelectedChoiceId(choiceId);

      if (choiceId === activeLevel.correctChoiceId) {
        setSolvedLevelIds((currentIds) =>
          currentIds.includes(activeLevel.id)
            ? currentIds
            : [...currentIds, activeLevel.id]
        );
      }
    });
  }

  function changePreviewStep(nextIndex: number) {
    startTransition(() => {
      setPreviewStepIndex(clampPreviewStep(nextIndex, activeLevel, activeTrace));
    });
  }

  function getChoiceClasses(choiceId: HazardChoiceId) {
    if (!selectedChoiceId) {
      return "border-white/12 bg-black/26 text-slate-100 hover:border-cyan-300/35 hover:bg-cyan-300/10";
    }

    if (choiceId === selectedChoiceId) {
      return choiceId === activeLevel.correctChoiceId
        ? "border-emerald-300/35 bg-emerald-300/15 text-emerald-50"
        : "border-rose-300/35 bg-rose-300/15 text-rose-50";
    }

    if (choiceId === activeLevel.correctChoiceId) {
      return "border-cyan-300/30 bg-cyan-300/10 text-cyan-50";
    }

    return "border-white/10 bg-white/5 text-slate-300";
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.13),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.14),_transparent_26%),linear-gradient(180deg,_#12090a_0%,_#050816_40%,_#020617_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-[34px] border border-white/10 bg-slate-950/72 p-5 shadow-[0_30px_90px_rgba(2,6,23,0.38)] backdrop-blur"
        >
          <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr] xl:items-center">
            <div className="space-y-3">
              <Link
                to="/"
                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-300 transition hover:border-cyan-300/35 hover:text-slate-50"
              >
                返回首页
              </Link>

              <div>
                <h1 className="text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">
                  Hazard 判断
                </h1>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-slate-400">
                  当前关
                </p>
                <p className="mt-3 text-xl font-semibold text-slate-50">
                  {activeLevel.shortTitle}
                </p>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-slate-400">
                  当前焦点
                </p>
                <p className="mt-3 text-xl font-semibold text-slate-50">
                  {activeLevel.focusStage.toUpperCase()}
                </p>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-slate-400">
                  完成进度
                </p>
                <p className="mt-3 text-xl font-semibold text-slate-50">
                  {solvedCount}/{hazardPuzzleLevels.length}
                </p>
              </div>
            </div>
          </div>
        </motion.header>

        <motion.main
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="space-y-6"
        >
          <Panel title={activeLevel.title}>
            {isLoading ? (
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-10 text-center text-sm text-slate-300">
                正在载入关卡画面……
              </div>
            ) : error ? (
              <div className="rounded-[28px] border border-rose-400/20 bg-rose-400/10 p-10 text-center text-sm text-rose-100">
                {error}
              </div>
            ) : activeStep ? (
              <div className="space-y-5">
                <PipelineStageCanvas
                  step={activeStep}
                  previousStep={previousStep}
                  stageHighlights={boardHighlights}
                  flowHints={boardFlows}
                  snapshotLabel=""
                  badgeLabel={activeLevel.shortTitle}
                  pulseTone={
                    activeLevel.correctChoiceId === "forward"
                      ? "cyan"
                      : activeLevel.correctChoiceId === "flush"
                        ? "rose"
                        : "amber"
                  }
                  hazardLabel={`${activeLevel.concept} · ${activeLevel.focusStage.toUpperCase()}`}
                />

                <div className="grid gap-4 lg:grid-cols-[auto,1fr,auto,auto] lg:items-center">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => changePreviewStep(previewStepIndex - 1)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
                    >
                      上一步
                    </button>
                    <button
                      type="button"
                      onClick={() => changePreviewStep(previewStepIndex + 1)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
                    >
                      下一步
                    </button>
                  </div>
                  <input
                    type="range"
                    min={activeLevel.previewStartStep}
                    max={maxIndex}
                    value={previewStepIndex}
                    onChange={(event) => changePreviewStep(Number(event.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                    Cycle {activeStep.pipeline?.cycle ?? "-"}
                  </span>
                  <button
                    type="button"
                    onClick={() => changePreviewStep(activeLevel.focusStepIndex)}
                    className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-50 transition hover:border-cyan-300/40 hover:bg-cyan-300/15"
                  >
                    回到焦点
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-10 text-center text-sm text-slate-300">
                当前关卡没有可用画面。
              </div>
            )}
          </Panel>

          <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)] xl:items-stretch">
            <motion.aside
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.06 }}
              className="h-full"
            >
              <Panel title="关卡地图" className="flex h-full flex-col">
                <div className="grid h-full auto-rows-fr gap-3">
                  {hazardPuzzleLevels.map((level, index) => {
                    const solved = solvedLevelIds.includes(level.id);
                    const selected = index === activeLevelIndex;

                    return (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => goToLevel(index)}
                        className={`flex h-full min-h-[108px] flex-col justify-between rounded-[22px] border px-4 py-4 text-left transition ${
                          selected
                            ? "border-cyan-300/35 bg-cyan-300/12"
                            : solved
                              ? "border-emerald-300/28 bg-emerald-300/10"
                              : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-slate-50">
                              {level.shortTitle}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-300">
                              {level.briefing}
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-slate-200">
                            {level.focusStage.toUpperCase()}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200">
                            {level.concept}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200">
                            第 {index + 1} 关
                          </span>
                          {solved ? (
                            <span className="rounded-full border border-emerald-300/24 bg-emerald-300/12 px-3 py-1.5 text-xs text-emerald-50">
                              已完成
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Panel>
            </motion.aside>

            <div className="flex h-full flex-col gap-6">
              <Panel title="你的判断" description={activeLevel.prompt}>
                  <div className="grid gap-3 md:grid-cols-3">
                    {activeLevel.choices.map((choice, index) => (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => chooseAnswer(choice.id)}
                        className={`rounded-[24px] border px-4 py-4 text-left transition ${getChoiceClasses(choice.id)}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-black/16 text-sm font-semibold">
                            {choiceLetters[index] ?? `${index + 1}`}
                          </span>
                          <span className="text-xl font-semibold">{choice.label}</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 opacity-90">{choice.detail}</p>
                      </button>
                    ))}
                  </div>

                  {feedback ? (
                    <div
                      className={`mt-5 rounded-[24px] border p-4 ${
                        feedback.status === "correct"
                          ? "border-emerald-300/30 bg-emerald-300/12 text-emerald-50"
                          : "border-rose-300/30 bg-rose-300/12 text-rose-50"
                      }`}
                    >
                      <p className="text-sm font-semibold tracking-[0.08em]">
                        {feedback.status === "correct" ? "正确" : "错误"}
                      </p>
                      <p className="mt-3 text-sm leading-6">{feedback.explanation}</p>
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedChoiceId(null)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                    >
                      清除判断
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        goToLevel((activeLevelIndex + 1) % hazardPuzzleLevels.length)
                      }
                      className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-50 transition hover:border-cyan-300/40 hover:bg-cyan-300/15"
                    >
                      下一关
                    </button>
                  </div>
              </Panel>

              <Panel title="当前线索">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        程序
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-50">
                        {activeTrace?.meta?.program ?? activeLevel.traceSampleId}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        焦点阶段
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-50">
                        {activeLevel.focusStage.toUpperCase()}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        风险类型
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-50">
                        {activeLevel.concept}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        当前指令
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-50">
                        {activeStep?.op ?? "-"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-sm text-amber-50">
                      黄：停顿 / bubble
                    </span>
                    <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-50">
                      青：旁路
                    </span>
                    <span className="rounded-full border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm text-rose-50">
                      红：冲刷
                    </span>
                  </div>
              </Panel>
            </div>
          </div>
        </motion.main>
      </div>
    </div>
  );
}
