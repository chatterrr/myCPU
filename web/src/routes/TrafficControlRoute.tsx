import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import { Panel } from "@/components/Panel";
import { getPipelineTokens } from "@/features/pipeline/visuals";
import {
  trafficActionLabels
} from "@/features/traffic_game/contracts";
import { TrafficIntersectionBoard } from "@/features/traffic_game/TrafficIntersectionBoard";
import {
  buildTrafficGameFeedback,
  trafficControlMission,
  type TrafficGameChoiceId
} from "@/features/traffic_game/levels";
import {
  loadTraceFromSample,
  sampleTraceOptions
} from "@/features/trace/sources";
import type { PipelineStageKey, TraceDocument } from "@/features/trace/types";

const sampleOptionById = new Map(
  sampleTraceOptions.map((option) => [option.id, option])
);

const requiredSampleIds = Array.from(
  new Set(trafficControlMission.frames.map((frame) => frame.traceSampleId))
);

const controlPointPositions: Record<PipelineStageKey, { x: number; y: number }> = {
  if: { x: 590, y: 190 },
  id: { x: 245, y: 400 },
  ex: { x: 590, y: 400 },
  mem: { x: 935, y: 400 },
  wb: { x: 590, y: 630 }
};

const boardBounds = {
  minX: 48,
  minY: 48,
  maxX: 1090,
  maxY: 700
} as const;

const movementKeys = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowleft",
  "arrowdown",
  "arrowright"
]);

function clampPosition(position: { x: number; y: number }) {
  return {
    x: Math.max(boardBounds.minX, Math.min(position.x, boardBounds.maxX)),
    y: Math.max(boardBounds.minY, Math.min(position.y, boardBounds.maxY))
  };
}

function findNearbyStage(position: { x: number; y: number }): PipelineStageKey | null {
  const candidates = Object.entries(controlPointPositions) as Array<
    [PipelineStageKey, { x: number; y: number }]
  >;

  const nearest = candidates
    .map(([stage, point]) => ({
      stage,
      distance: Math.hypot(point.x - position.x, point.y - position.y)
    }))
    .sort((left, right) => left.distance - right.distance)[0];

  return nearest && nearest.distance < 110 ? nearest.stage : null;
}

function getStageSceneLabel(stage: PipelineStageKey) {
  switch (stage) {
    case "if":
      return "入口";
    case "id":
      return "等待区";
    case "ex":
      return "主路口";
    case "mem":
      return "访存通道";
    case "wb":
      return "出口";
  }
}

export function TrafficControlRoute() {
  const [traceMap, setTraceMap] = useState<Record<string, TraceDocument>>({});
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<TrafficGameChoiceId | null>(
    null
  );
  const [selectedVehicleKey, setSelectedVehicleKey] = useState<string | null>(null);
  const [clearedFrameIds, setClearedFrameIds] = useState<string[]>([]);
  const [attemptsByFrame, setAttemptsByFrame] = useState<Record<string, number>>({});
  const [playerPosition, setPlayerPosition] = useState({ x: 590, y: 680 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pressedKeysRef = useRef<Set<string>>(new Set());

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

    void loadTrafficTraces();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (!movementKeys.has(key)) {
        return;
      }

      event.preventDefault();
      pressedKeysRef.current.add(key);
    }

    function onKeyUp(event: KeyboardEvent) {
      pressedKeysRef.current.delete(event.key.toLowerCase());
    }

    let frameId = 0;

    function tick() {
      const keys = pressedKeysRef.current;

      if (keys.size) {
        setPlayerPosition((current) => {
          const next = { ...current };
          const speed = 6;

          if (keys.has("w") || keys.has("arrowup")) {
            next.y -= speed;
          }

          if (keys.has("s") || keys.has("arrowdown")) {
            next.y += speed;
          }

          if (keys.has("a") || keys.has("arrowleft")) {
            next.x -= speed;
          }

          if (keys.has("d") || keys.has("arrowright")) {
            next.x += speed;
          }

          return clampPosition(next);
        });
      }

      frameId = window.requestAnimationFrame(tick);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  const activeFrame = trafficControlMission.frames[activeFrameIndex];
  const activeTrace = traceMap[activeFrame.traceSampleId] ?? null;
  const activeStep = activeTrace?.steps[activeFrame.focusStepIndex] ?? null;
  const previousStep =
    activeTrace && activeFrame.focusStepIndex > 0
      ? activeTrace.steps[activeFrame.focusStepIndex - 1]
      : null;
  const feedback = selectedChoiceId
    ? buildTrafficGameFeedback(activeFrame, selectedChoiceId)
    : null;
  const nearbyStage = findNearbyStage(playerPosition);
  const nearbyChoices = nearbyStage
    ? activeFrame.choices.filter((choice) => choice.stage === nearbyStage)
    : [];
  const solvedFrameCount = clearedFrameIds.length;
  const progressPercent = Math.round(
    (solvedFrameCount / trafficControlMission.frames.length) * 100
  );
  const isFrameCleared = clearedFrameIds.includes(activeFrame.id);
  const isLastFrame = activeFrameIndex === trafficControlMission.frames.length - 1;
  const activeTokens = activeStep ? getPipelineTokens(activeStep) : [];
  const selectedVehicle = selectedVehicleKey
    ? activeTokens.find((token) => token.instructionKey === selectedVehicleKey)
    : null;
  const currentAttemptCount = attemptsByFrame[activeFrame.id] ?? 0;

  useEffect(() => {
    setSelectedChoiceId(null);
    setSelectedVehicleKey(null);
    setPlayerPosition({ x: 590, y: 680 });
  }, [activeFrame.id]);

  function goToFrame(index: number) {
    startTransition(() => {
      setActiveFrameIndex(index);
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
      setSelectedVehicleKey(null);
      setClearedFrameIds([]);
      setAttemptsByFrame({});
      setPlayerPosition({ x: 590, y: 680 });
    });
  }

  function onBoardKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const key = event.key.toLowerCase();

    if (!movementKeys.has(key)) {
      return;
    }

    event.preventDefault();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(251,113,133,0.12),_transparent_24%),linear-gradient(180deg,_#06111d_0%,_#07111b_42%,_#020617_100%)]">
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
                  Traffic Control
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
                  用 WASD / 方向键移动指挥员，靠近控制点后执行放行、暂停、冲刷，点车可查看当前指令状态。
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-slate-400">
                  当前时刻
                </p>
                <p className="mt-3 text-xl font-semibold text-slate-50">
                  {activeFrame.shortTitle}
                </p>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-slate-400">
                  已清场
                </p>
                <p className="mt-3 text-xl font-semibold text-slate-50">
                  {solvedFrameCount}/{trafficControlMission.frames.length}
                </p>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-slate-400">
                  流量表
                </p>
                <p className="mt-3 text-xl font-semibold text-slate-50">
                  {progressPercent}%
                </p>
              </div>
            </div>
          </div>
        </motion.header>

        <div className="grid gap-6 xl:grid-cols-[310px,1fr]">
          <motion.aside
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.06 }}
            className="space-y-6"
          >
            <Panel title="调度图" description={trafficControlMission.summary}>
              <div className="space-y-3">
                {trafficControlMission.frames.map((frame, index) => {
                  const solved = clearedFrameIds.includes(frame.id);
                  const selected = index === activeFrameIndex;

                  return (
                    <button
                      key={frame.id}
                      type="button"
                      onClick={() => goToFrame(index)}
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
                          {frame.shortTitle}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-slate-300">
                          {frame.focusStage.toUpperCase()}
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

            <Panel title="操作方式" description="先移动，再控灯，再点车看状态。">
              <div className="space-y-3 text-sm leading-6 text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  `WASD` / 方向键：移动指挥员
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  靠近控制点：出现可用动作
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  点击车辆：查看该指令当前状态
                </div>
              </div>
            </Panel>
          </motion.aside>

          <motion.main
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="space-y-6"
          >
            <Panel title={activeFrame.title} description={activeFrame.briefing}>
              {isLoading ? (
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-10 text-center text-sm text-slate-300">
                  正在载入交通场景…
                </div>
              ) : error ? (
                <div className="rounded-[28px] border border-rose-400/20 bg-rose-400/10 p-10 text-center text-sm text-rose-100">
                  {error}
                </div>
              ) : activeStep ? (
                <div
                  className="space-y-5 outline-none"
                  tabIndex={0}
                  onKeyDown={onBoardKeyDown}
                >
                  <TrafficIntersectionBoard
                    step={activeStep}
                    previousStep={previousStep}
                    playerPosition={playerPosition}
                    nearbyStage={nearbyStage}
                    focusStage={activeFrame.focusStage}
                    selectedVehicleKey={selectedVehicleKey}
                    onVehicleSelect={setSelectedVehicleKey}
                  />

                  <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                    <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-100">控制台</p>
                        <span className="text-xs uppercase tracking-[0.24em] text-slate-400">
                          {nearbyStage ? `当前靠近 ${getStageSceneLabel(nearbyStage)}` : "先移动到控制点"}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        {nearbyChoices.length ? (
                          nearbyChoices.map((choice) => (
                            <button
                              key={choice.id}
                              type="button"
                              onClick={() => chooseAction(choice.id)}
                              className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                                selectedChoiceId === choice.id
                                  ? "border-cyan-300/35 bg-cyan-300/15 text-cyan-50"
                                  : choice.action === "hold"
                                    ? "border-amber-300/25 bg-amber-300/10 text-amber-50 hover:border-amber-300/40 hover:bg-amber-300/15"
                                    : choice.action === "flush"
                                      ? "border-rose-300/25 bg-rose-300/10 text-rose-50 hover:border-rose-300/40 hover:bg-rose-300/15"
                                      : "border-cyan-300/25 bg-cyan-300/10 text-cyan-50 hover:border-cyan-300/40 hover:bg-cyan-300/15"
                              }`}
                            >
                              {trafficActionLabels[choice.action]} {choice.stage.toUpperCase()}
                            </button>
                          ))
                        ) : (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">
                            走到入口、等待区或主路口附近再操作
                          </span>
                        )}
                      </div>

                      <p className="mt-4 text-sm leading-6 text-slate-300">
                        {feedback ? feedback.explanation : activeFrame.objective}
                      </p>
                    </div>

                    <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-100">当前车辆</p>
                        <span className="text-xs uppercase tracking-[0.24em] text-slate-400">
                          鼠标点击车辆
                        </span>
                      </div>

                      {selectedVehicle ? (
                        <div className="mt-4 space-y-3">
                          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                            <p className="text-xl font-semibold text-slate-50">
                              {selectedVehicle.title}
                            </p>
                            <p className="mt-2 text-sm text-slate-300">
                              {selectedVehicle.stage.toUpperCase()} · {selectedVehicle.pc ?? "-"}
                            </p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                                是否有依赖
                              </p>
                              <p className="mt-2 text-base font-semibold text-slate-50">
                                {activeStep.rj !== null || activeStep.rk !== null ? "有" : "无"}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                                是否被 hold
                              </p>
                              <p className="mt-2 text-base font-semibold text-slate-50">
                                {selectedVehicle.state === "stalled" || activeStep.pipeline?.stall
                                  ? "是"
                                  : "否"}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                                是否在 flush 路径
                              </p>
                              <p className="mt-2 text-base font-semibold text-slate-50">
                                {selectedVehicle.state === "flushed"
                                || activeStep.pipeline?.flush.includes(
                                  selectedVehicle.stage.toUpperCase()
                                )
                                  ? "是"
                                  : "否"}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                                当前状态
                              </p>
                              <p className="mt-2 text-base font-semibold text-slate-50">
                                {selectedVehicle.state}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-slate-400">
                          点一辆车，查看这条指令当前处于哪个 stage、是否有依赖、是否被拦停或冲刷。
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-10 text-center text-sm text-slate-300">
                  当前时刻没有可用画面。
                </div>
              )}
            </Panel>

            <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
              <Panel title="调度反馈" description="每拍只做一个动作，立刻看结果。">
                <AnimatePresence mode="wait">
                  {feedback ? (
                    <motion.div
                      key={`${activeFrame.id}-${selectedChoiceId}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className={`rounded-[24px] border p-4 ${
                        feedback.status === "correct"
                          ? "border-emerald-300/30 bg-emerald-300/12 text-emerald-50"
                          : "border-rose-300/30 bg-rose-300/12 text-rose-50"
                      }`}
                    >
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1.5 text-sm ${
                            feedback.choice.action === "hold"
                              ? "border-amber-300/25 bg-amber-300/10 text-amber-50"
                              : feedback.choice.action === "flush"
                                ? "border-rose-300/25 bg-rose-300/10 text-rose-50"
                                : "border-cyan-300/25 bg-cyan-300/10 text-cyan-50"
                          }`}
                        >
                          {trafficActionLabels[feedback.choice.action]} {feedback.choice.stage.toUpperCase()}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-sm">
                          {feedback.status === "correct" ? "调度正确" : "路口冲突"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6">{feedback.explanation}</p>
                    </motion.div>
                  ) : (
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
                      先把指挥员移动到控制点附近，再执行一个动作。
                    </div>
                  )}
                </AnimatePresence>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={goToNextFrame}
                    disabled={!isFrameCleared}
                    className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-50 transition hover:border-cyan-300/40 hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
                  >
                    {isLastFrame ? "回到第一时刻" : "进入下一时刻"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedChoiceId(null)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                  >
                    清除反馈
                  </button>
                  <button
                    type="button"
                    onClick={resetMission}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                  >
                    重开一轮
                  </button>
                </div>
              </Panel>

              <Panel title="交通 HUD" description="短信息、强颜色、少文字。">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      当前 Program
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-50">
                      {activeTrace?.meta?.program ?? activeFrame.traceSampleId}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      当前拍数
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-50">
                      {activeStep?.pipeline?.cycle ?? "-"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      已尝试
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-50">
                      {currentAttemptCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      靠近控制点
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-50">
                      {nearbyStage ? getStageSceneLabel(nearbyStage) : "未靠近"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {Object.entries(trafficActionLabels).map(([action, label]) => (
                    <span
                      key={action}
                      className={`rounded-full border px-3 py-2 text-sm ${
                        action === "hold"
                          ? "border-amber-300/25 bg-amber-300/10 text-amber-50"
                          : action === "flush"
                            ? "border-rose-300/25 bg-rose-300/10 text-rose-50"
                            : "border-cyan-300/25 bg-cyan-300/10 text-cyan-50"
                      }`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </Panel>
            </div>
          </motion.main>
        </div>
      </div>
    </div>
  );
}
