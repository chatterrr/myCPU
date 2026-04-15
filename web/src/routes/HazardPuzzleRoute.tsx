import { startTransition, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import { Panel } from "@/components/Panel";
import { Tag } from "@/components/Tag";
import { HazardPuzzleBoard } from "@/features/lesson_hazard/HazardPuzzleBoard";
import {
  buildHazardPuzzleFeedback,
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

export function HazardPuzzleRoute() {
  const [traceMap, setTraceMap] = useState<Record<string, TraceDocument>>({});
  const [activeLevelIndex, setActiveLevelIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<HazardChoiceId | null>(
    null
  );
  const [solvedLevelIds, setSolvedLevelIds] = useState<string[]>([]);
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

    void loadPuzzleTraces();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeLevel = hazardPuzzleLevels[activeLevelIndex];
  const activeTrace = traceMap[activeLevel.traceSampleId] ?? null;
  const activeStep = activeTrace?.steps[activeLevel.focusStepIndex] ?? null;
  const feedback = selectedChoiceId
    ? buildHazardPuzzleFeedback(activeLevel, selectedChoiceId)
    : null;
  const previewHighlights = getHazardPuzzlePreviewHighlights(activeLevel);
  const boardHighlights = feedback
    ? [...previewHighlights, ...feedback.stageHighlights]
    : previewHighlights;
  const boardFlows = feedback?.flowHints ?? [];

  function goToLevel(index: number) {
    startTransition(() => {
      setActiveLevelIndex(index);
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

  function goToNextLevel() {
    goToLevel((activeLevelIndex + 1) % hazardPuzzleLevels.length);
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.16),_transparent_28%),linear-gradient(180deg,_#12090a_0%,_#050816_36%,_#020617_100%)]">
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
              <Tag label="Entry 1" tone="amber" />
              <Tag label={`${hazardPuzzleLevels.length} levels`} tone="cyan" />
              <Tag label="RAW / load-use / branch" tone="rose" />
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">
                Hazard 解谜
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
                用一拍一题的方式，把 RAW、load-use、branch hazard
                压成短关卡。重点不是长段解释，而是直接看见 stall、bubble、
                forward、flush 在流水线上怎么发生。
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                Progress
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-50">
                {solvedLevelIds.length}/{hazardPuzzleLevels.length}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                每答对一关，就把一个 hazard 图形模板吃透。
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                Visual cues
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Tag label="stall / bubble" tone="amber" />
                <Tag label="forward" tone="cyan" />
                <Tag label="flush" tone="rose" />
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                Data source
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                全部关卡都直接吃现有 pipeline trace JSONL，不扩 trace
                协议。
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
              title="关卡地图"
              description="先识别 RAW，再看 forward、stall / bubble、flush。"
            >
              <div className="space-y-3">
                {hazardPuzzleLevels.map((level, index) => {
                  const solved = solvedLevelIds.includes(level.id);
                  const selected = index === activeLevelIndex;

                  return (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => goToLevel(index)}
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
                          {level.title}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.28em] text-slate-400">
                          {solved ? "Solved" : `Step ${index + 1}`}
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

            <Panel
              title="解题节奏"
              description="最小可玩版本只保留课程讲解真正需要的动作。"
            >
              <div className="space-y-3 text-sm leading-6 text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  1. 盯住高亮的 stage。
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  2. 选出这一拍最关键的 hazard 处理动作。
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  3. 直接看图形反馈，不靠大段说明书。
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
              title={activeLevel.title}
              description={activeLevel.briefing}
            >
              {isLoading ? (
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-300">
                  Loading hazard puzzle traces...
                </div>
              ) : error ? (
                <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-8 text-center text-sm text-rose-100">
                  {error}
                </div>
              ) : activeStep ? (
                <div className="space-y-5">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeLevel.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.26 }}
                    >
                      <HazardPuzzleBoard
                        step={activeStep}
                        stageHighlights={boardHighlights}
                        flowHints={boardFlows}
                      />
                    </motion.div>
                  </AnimatePresence>

                  <div className="flex flex-wrap gap-2">
                    <Tag label={activeLevel.concept} tone="amber" />
                    <Tag label={`cycle ${activeStep.pipeline?.cycle ?? "-"}`} tone="cyan" />
                    <Tag
                      label={activeTrace?.meta?.program ?? activeLevel.traceSampleId}
                      tone="neutral"
                    />
                    <Tag label={`focus ${activeLevel.focusStage.toUpperCase()}`} tone="emerald" />
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-300">
                  This level snapshot is missing.
                </div>
              )}
            </Panel>

            <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
              <Panel
                title="你的判断"
                description={activeLevel.prompt}
              >
                <div className="space-y-3">
                  {activeLevel.choices.map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => chooseAnswer(choice.id)}
                      className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${getChoiceClasses(choice.id)}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-base font-semibold">{choice.label}</span>
                        {selectedChoiceId && choice.id === activeLevel.correctChoiceId ? (
                          <span className="text-[10px] uppercase tracking-[0.28em]">
                            target
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 opacity-90">
                        {choice.detail}
                      </p>
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {feedback ? (
                    <motion.div
                      key={`${activeLevel.id}-${selectedChoiceId}`}
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
                      <p className="text-xs uppercase tracking-[0.28em] opacity-80">
                        {feedback.status === "correct" ? "Correct" : "Try again"}
                      </p>
                      <p className="mt-3 text-sm leading-6">{feedback.explanation}</p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={goToNextLevel}
                    className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-50 transition hover:border-cyan-300/40 hover:bg-cyan-300/15"
                  >
                    Next level
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedChoiceId(null)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                  >
                    Clear answer
                  </button>
                </div>
              </Panel>

              <Panel
                title="快照线索"
                description="只留解题必要信息，避免用大段文字抢走画面。"
              >
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
                      Focus stage
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-50">
                      {activeLevel.focusStage.toUpperCase()}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      Focus op
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-50">
                      {activeStep?.op ?? "-"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      Trace step
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-50">
                      {activeLevel.focusStepIndex}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    Visual legend
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Tag label="amber = stall / bubble / RAW tension" tone="amber" />
                    <Tag label="cyan = forwarding path" tone="cyan" />
                    <Tag label="rose = flush wave" tone="rose" />
                  </div>
                </div>
              </Panel>
            </div>

            {solvedLevelIds.length === hazardPuzzleLevels.length ? (
              <Panel
                title="全部通关"
                description="M9 的最小可玩版已经把三类 hazard 和三种关键图形反馈串起来了。"
              >
                <p className="text-sm leading-7 text-slate-300">
                  下一步可以直接复用这块 stage board，把选择题替换成 M10
                  的实时操作按钮与评分逻辑。
                </p>
              </Panel>
            ) : null}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
