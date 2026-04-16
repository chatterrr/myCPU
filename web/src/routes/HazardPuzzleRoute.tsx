import { startTransition, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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

function clampPreviewStep(
  nextIndex: number,
  activeLevel: (typeof hazardPuzzleLevels)[number],
  activeTrace: TraceDocument | null
) {
  if (!activeTrace) {
    return activeLevel.previewStartStep;
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
  const [previewStepIndex, setPreviewStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
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

  useEffect(() => {
    setPreviewStepIndex(activeLevel.previewStartStep);
    setSelectedChoiceId(null);
    setIsPlaying(true);
  }, [activeLevel.id]);

  useEffect(() => {
    if (!isPlaying || !activeTrace) {
      return;
    }

    const maxIndex = Math.min(activeLevel.previewEndStep, activeTrace.steps.length - 1);

    const timer = window.setInterval(() => {
      setPreviewStepIndex((current) =>
        current >= maxIndex ? activeLevel.previewStartStep : current + 1
      );
    }, 1150);

    return () => window.clearInterval(timer);
  }, [
    activeLevel.previewEndStep,
    activeLevel.previewStartStep,
    activeTrace,
    isPlaying
  ]);

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
    startTransition(() => {
      setActiveLevelIndex(index);
    });
  }

  function chooseAnswer(choiceId: HazardChoiceId) {
    startTransition(() => {
      setSelectedChoiceId(choiceId);
      setIsPlaying(false);

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
      setIsPlaying(false);
    });
  }

  function getChoiceClasses(choiceId: HazardChoiceId) {
    if (!selectedChoiceId) {
      return "border-white/10 bg-white/5 text-slate-100 hover:border-cyan-300/35 hover:bg-cyan-300/10";
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
          className="rounded-[34px] border border-white/10 bg-slate-950/72 p-6 shadow-[0_30px_90px_rgba(2,6,23,0.38)] backdrop-blur"
        >
          <div className="grid gap-5 xl:grid-cols-[1.15fr,0.85fr] xl:items-end">
            <div className="space-y-4">
              <Link
                to="/"
                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-300 transition hover:border-cyan-300/35 hover:text-slate-50"
              >
                返回首页
              </Link>

              <div className="space-y-3">
                <h1 className="text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">
                  Hazard 解谜
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
                  一屏看清当前拍数、焦点 stage、风险类型，再判断这拍该继续、旁路、暂停还是冲刷。
                </p>
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

        <div className="grid gap-6 xl:grid-cols-[300px,1fr]">
          <motion.aside
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.06 }}
            className="space-y-6"
          >
            <Panel title="关卡地图" description="从识别依赖，到判断控制动作。">
              <div className="space-y-3">
                {hazardPuzzleLevels.map((level, index) => {
                  const solved = solvedLevelIds.includes(level.id);
                  const selected = index === activeLevelIndex;

                  return (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => goToLevel(index)}
                      className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                        selected
                          ? "border-cyan-300/35 bg-cyan-300/12"
                          : solved
                            ? "border-emerald-300/28 bg-emerald-300/10"
                            : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-base font-semibold text-slate-50">
                          {level.shortTitle}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-slate-300">
                          {level.focusStage.toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {level.briefing}
                      </p>
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel title="判断口径" description="文字压缩，重点交给动画和颜色。">
              <div className="flex flex-wrap gap-2">
                {["RAW", "旁路", "暂停", "冲刷"].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </Panel>
          </motion.aside>

          <motion.main
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="space-y-6"
          >
            <Panel title={activeLevel.title} description={activeLevel.briefing}>
              {isLoading ? (
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-10 text-center text-sm text-slate-300">
                  正在载入关卡画面…
                </div>
              ) : error ? (
                <div className="rounded-[28px] border border-rose-400/20 bg-rose-400/10 p-10 text-center text-sm text-rose-100">
                  {error}
                </div>
              ) : activeStep ? (
                <div className="space-y-5">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${activeLevel.id}-${previewStepIndex}-${selectedChoiceId ?? "preview"}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22 }}
                    >
                      <PipelineStageCanvas
                        step={activeStep}
                        previousStep={previousStep}
                        stageHighlights={boardHighlights}
                        flowHints={boardFlows}
                        snapshotLabel="教学主画幅"
                        badgeLabel={selectedChoiceId ? "判断反馈" : "自动播放"}
                        pulseTone={
                          activeLevel.correctChoiceId === "forward"
                            ? "cyan"
                            : activeLevel.correctChoiceId === "flush"
                              ? "rose"
                              : "amber"
                        }
                        hazardLabel={`${activeLevel.concept} · ${activeLevel.focusStage.toUpperCase()}`}
                      />
                    </motion.div>
                  </AnimatePresence>

                  <div className="grid gap-4 lg:grid-cols-[auto,auto,1fr,auto,auto] lg:items-center">
                    <button
                      type="button"
                      onClick={() => setIsPlaying((value) => !value)}
                      className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-50 transition hover:border-cyan-300/40 hover:bg-cyan-300/15"
                    >
                      {isPlaying ? "暂停" : "播放"}
                    </button>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => changePreviewStep(previewStepIndex - 1)}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
                      >
                        上一拍
                      </button>
                      <button
                        type="button"
                        onClick={() => changePreviewStep(previewStepIndex + 1)}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
                      >
                        下一拍
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
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                      Step {previewStepIndex}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-10 text-center text-sm text-slate-300">
                  当前关卡没有可用画面。
                </div>
              )}
            </Panel>

            <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
              <Panel title="你的判断" description={activeLevel.prompt}>
                <div className="grid gap-3 md:grid-cols-3">
                  {activeLevel.choices.map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => chooseAnswer(choice.id)}
                      className={`rounded-[24px] border px-4 py-4 text-left transition ${getChoiceClasses(choice.id)}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xl font-semibold">{choice.label}</span>
                        <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em]">
                          {choice.id === activeLevel.correctChoiceId ? "目标" : "选项"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 opacity-90">{choice.detail}</p>
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {feedback ? (
                    <motion.div
                      key={`${activeLevel.id}-${selectedChoiceId}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className={`mt-5 rounded-[24px] border p-4 ${
                        feedback.status === "correct"
                          ? "border-emerald-300/30 bg-emerald-300/12 text-emerald-50"
                          : "border-rose-300/30 bg-rose-300/12 text-rose-50"
                      }`}
                    >
                      <p className="text-xs uppercase tracking-[0.28em] opacity-80">
                        {feedback.status === "correct" ? "判断正确" : "再看一拍"}
                      </p>
                      <p className="mt-3 text-sm leading-6">{feedback.explanation}</p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

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
                    onClick={() => goToLevel((activeLevelIndex + 1) % hazardPuzzleLevels.length)}
                    className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-50 transition hover:border-cyan-300/40 hover:bg-cyan-300/15"
                  >
                    下一关
                  </button>
                </div>
              </Panel>

              <Panel title="当前线索" description="尽量少字，只看当前最关键的信息。">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      Program
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-50">
                      {activeTrace?.meta?.program ?? activeLevel.traceSampleId}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      焦点 stage
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-50">
                      {activeLevel.focusStage.toUpperCase()}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      Hazard
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
                    黄：暂停 / bubble
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
          </motion.main>
        </div>
      </div>
    </div>
  );
}
