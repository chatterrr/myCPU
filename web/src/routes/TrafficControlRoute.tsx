import { startTransition, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Panel } from "@/components/Panel";
import { PipelineStageCanvas } from "@/features/pipeline/PipelineStageCanvas";
import {
  getRegisterActivities,
  getStageChineseLabel,
  getStageStateLabel,
  type RegisterActivity
} from "@/features/pipeline/visuals";
import type { DispatchAction } from "@/features/traffic_game/engine";
import {
  createInitialDispatchSession,
  reduceDispatchSession
} from "@/features/traffic_game/engine";
import { TrafficIntersectionBoard } from "@/features/traffic_game/TrafficIntersectionBoard";
import {
  buildDispatchPieceSnapshot,
  getDispatchBoardLegend,
  getDispatchStatusText,
  getNextBlueprint,
  requiredDispatchSampleIds,
  resolveDispatchBlueprints
} from "@/features/traffic_game/levels";
import {
  loadTraceFromSample,
  sampleTraceOptions
} from "@/features/trace/sources";
import type {
  DispatchPieceSnapshot,
  DispatchSession,
  ResolvedDispatchBlueprint
} from "@/features/traffic_game/contracts";
import type { TraceDocument } from "@/features/trace/types";

const sampleOptionById = new Map(
  sampleTraceOptions.map((option) => [option.id, option])
);

const registerCardClasses = {
  idle: "border-white/14 bg-[linear-gradient(180deg,rgba(3,7,18,0.88),rgba(2,6,23,0.94))] text-slate-400",
  read:
    "border-cyan-300/55 bg-[linear-gradient(180deg,rgba(34,211,238,0.34),rgba(8,47,73,0.9))] text-cyan-50 shadow-[0_0_26px_rgba(34,211,238,0.18)]",
  target:
    "border-emerald-300/55 bg-[linear-gradient(180deg,rgba(16,185,129,0.34),rgba(6,46,22,0.9))] text-emerald-50 shadow-[0_0_26px_rgba(16,185,129,0.18)]",
  write:
    "border-lime-300/60 bg-[linear-gradient(180deg,rgba(132,204,22,0.34),rgba(54,83,20,0.92))] text-lime-50 shadow-[0_0_28px_rgba(132,204,22,0.2)]"
} as const;

const registerDotClasses = {
  idle: "bg-white/16",
  read: "bg-white/16",
  target: "bg-white/16",
  write: "bg-white/16"
} as const;

const statusAccentClasses = {
  alu: {
    hero: "border-emerald-300/28 bg-[linear-gradient(180deg,rgba(16,185,129,0.22),rgba(2,6,23,0.92))]",
    pill: "border-emerald-200/35 bg-emerald-300/12 text-emerald-50"
  },
  forward: {
    hero: "border-cyan-300/28 bg-[linear-gradient(180deg,rgba(34,211,238,0.22),rgba(2,6,23,0.92))]",
    pill: "border-cyan-200/35 bg-cyan-300/12 text-cyan-50"
  },
  "load-use": {
    hero: "border-amber-300/28 bg-[linear-gradient(180deg,rgba(251,191,36,0.22),rgba(2,6,23,0.92))]",
    pill: "border-amber-200/35 bg-amber-300/12 text-amber-50"
  },
  "branch-flush": {
    hero: "border-rose-300/28 bg-[linear-gradient(180deg,rgba(251,113,133,0.22),rgba(2,6,23,0.92))]",
    pill: "border-rose-200/35 bg-rose-300/12 text-rose-50"
  }
} as const;

function formatRegister(reg: number | null) {
  return reg === null ? "-" : `r${reg}`;
}

function formatImmediate(imm: number | null) {
  return imm === null ? "-" : `${imm}`;
}

function getRegisterDominantKind(activities: RegisterActivity[]) {
  if (activities.some((activity) => activity.kind === "write")) {
    return "write";
  }

  if (activities.some((activity) => activity.kind === "target")) {
    return "target";
  }

  if (activities.some((activity) => activity.kind === "read")) {
    return "read";
  }

  return "idle";
}

function renderSnapshotStage(snapshot: DispatchPieceSnapshot | null) {
  if (!snapshot?.activeStage) {
    return "等待入场";
  }

  return `${snapshot.activeStage.toUpperCase()} / ${getStageChineseLabel(
    snapshot.activeStage
  )}`;
}

function renderStatusCard(snapshot: DispatchPieceSnapshot | null) {
  if (!snapshot) {
    return (
      <div className="rounded-[24px] border border-white/12 bg-black/26 p-5 text-sm leading-6 text-slate-300">
        点一个块看详情。
      </div>
    );
  }

  const accent = statusAccentClasses[snapshot.blueprint.kind];

  return (
    <div className="space-y-4">
      <div className={`rounded-[24px] border p-5 ${accent.hero}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-slate-300">
              指令块
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-50">
              {snapshot.piece.instruction.op}
            </p>
            <p className="mt-2 text-sm text-slate-100">
              {snapshot.blueprint.title} · {getDispatchStatusText(snapshot)}
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1.5 text-xs ${accent.pill}`}>
            {snapshot.blueprint.shortLabel}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[22px] border border-white/12 bg-black/28 p-4">
          <p className="text-xs text-slate-400">指令</p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {snapshot.piece.instruction.op}
          </p>
        </div>
        <div className="rounded-[22px] border border-white/12 bg-black/28 p-4">
          <p className="text-xs text-slate-400">原始码</p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {snapshot.piece.instruction.raw}
          </p>
        </div>
        <div className="rounded-[22px] border border-white/12 bg-black/28 p-4">
          <p className="text-xs text-slate-400">源寄存器</p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {formatRegister(snapshot.piece.instruction.rj)} / {formatRegister(snapshot.piece.instruction.rk)}
          </p>
        </div>
        <div className="rounded-[22px] border border-white/12 bg-black/28 p-4">
          <p className="text-xs text-slate-400">目标寄存器</p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {formatRegister(snapshot.piece.instruction.rd)}
          </p>
        </div>
        <div className="rounded-[22px] border border-white/12 bg-black/28 p-4">
          <p className="text-xs text-slate-400">风险</p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {snapshot.blueprint.title}
          </p>
        </div>
        <div className="rounded-[22px] border border-white/12 bg-black/28 p-4">
          <p className="text-xs text-slate-400">阶段</p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {renderSnapshotStage(snapshot)}
          </p>
        </div>
        <div className="rounded-[22px] border border-white/12 bg-black/28 p-4">
          <p className="text-xs text-slate-400">状态</p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {getStageStateLabel(snapshot.pipelineState)}
          </p>
        </div>
        <div className="rounded-[22px] border border-white/12 bg-black/28 p-4">
          <p className="text-xs text-slate-400">立即数</p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {formatImmediate(snapshot.piece.instruction.imm)}
          </p>
        </div>
      </div>

      <div className={`rounded-[24px] border p-5 ${accent.hero}`}>
        <p className="text-xs uppercase tracking-[0.24em] text-slate-300">
          当前提示
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-100">
          {snapshot.hazardText}
        </p>
      </div>
    </div>
  );
}

export function TrafficControlRoute() {
  const [traceMap, setTraceMap] = useState<Record<string, TraceDocument>>({});
  const [session, setSession] = useState<DispatchSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSoftDropping, setIsSoftDropping] = useState(false);

  const blueprintRef = useRef<ResolvedDispatchBlueprint[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadDispatchTraces() {
      setIsLoading(true);
      setError(null);

      try {
        const entries = await Promise.all(
          requiredDispatchSampleIds.map(async (sampleId) => {
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

    void loadDispatchTraces();

    return () => {
      cancelled = true;
    };
  }, []);

  let resolvedBlueprints: ResolvedDispatchBlueprint[] = [];
  let blueprintError: string | null = null;

  try {
    if (Object.keys(traceMap).length) {
      resolvedBlueprints = resolveDispatchBlueprints(traceMap);
    }
  } catch (resolveError) {
    blueprintError = (resolveError as Error).message;
  }

  useEffect(() => {
    blueprintRef.current = resolvedBlueprints;
  }, [resolvedBlueprints]);

  useEffect(() => {
    if (isLoading || error || blueprintError || !resolvedBlueprints.length || session) {
      return;
    }

    setSession(createInitialDispatchSession(resolvedBlueprints));
  }, [blueprintError, error, isLoading, resolvedBlueprints, session]);

  function dispatchAction(action: DispatchAction) {
    setSession((current) => {
      if (!current || !blueprintRef.current.length) {
        return current;
      }

      return reduceDispatchSession(current, blueprintRef.current, action);
    });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (
        [
          "arrowleft",
          "arrowright",
          "arrowdown",
          "arrowup",
          "a",
          "d",
          "s",
          "w",
          " ",
          "p"
        ].includes(key)
      ) {
        event.preventDefault();
      }

      if (key === "arrowleft" || key === "a") {
        dispatchAction({ type: "left" });
        return;
      }

      if (key === "arrowright" || key === "d") {
        dispatchAction({ type: "right" });
        return;
      }

      if (key === "arrowup" || key === "w") {
        dispatchAction({ type: "rotate" });
        return;
      }

      if (key === "arrowdown" || key === "s") {
        setIsSoftDropping(true);
        dispatchAction({ type: "down" });
        return;
      }

      if (key === " ") {
        dispatchAction({ type: "drop" });
        return;
      }

      if (key === "p") {
        dispatchAction({ type: "togglePause" });
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (key === "arrowdown" || key === "s") {
        setIsSoftDropping(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!session || session.paused || session.gameOver) {
      return;
    }

    const timer = window.setInterval(() => {
      dispatchAction({ type: isSoftDropping ? "down" : "tick" });
    }, isSoftDropping ? 90 : 680);

    return () => window.clearInterval(timer);
  }, [isSoftDropping, session?.activePieceId, session?.gameOver, session?.paused]);

  const activePiece = session?.activePieceId
    ? session.pieces[session.activePieceId] ?? null
    : null;
  const selectedPiece = session?.selectedBlockId
    ? session.pieces[session.selectedBlockId] ?? null
    : activePiece;
  const activeSnapshot = buildDispatchPieceSnapshot(activePiece, resolvedBlueprints);
  const selectedSnapshot = buildDispatchPieceSnapshot(selectedPiece, resolvedBlueprints);
  const nextBlueprint = session
    ? getNextBlueprint(resolvedBlueprints, session.nextBlueprintIds)
    : null;
  const registerActivities = activeSnapshot
    ? getRegisterActivities(activeSnapshot.currentStep)
    : [];
  const registerActivityMap = registerActivities.reduce<Record<number, RegisterActivity[]>>(
    (accumulator, activity) => ({
      ...accumulator,
      [activity.reg]: [...(accumulator[activity.reg] ?? []), activity]
    }),
    {}
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.22),_transparent_18%),radial-gradient(circle_at_top_right,_rgba(251,113,133,0.18),_transparent_20%),radial-gradient(circle_at_bottom_left,_rgba(251,191,36,0.14),_transparent_24%),linear-gradient(180deg,_#01040d_0%,_#020611_38%,_#040916_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1840px] flex-col gap-5 px-3 py-4 sm:px-5 lg:px-6">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-[34px] border border-cyan-300/18 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(2,6,23,0.84))] p-4 shadow-[0_36px_110px_rgba(2,6,23,0.5)] backdrop-blur-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <Link
                to="/"
                className="inline-flex items-center rounded-full border border-cyan-300/24 bg-cyan-300/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-cyan-50 transition hover:border-cyan-200/44 hover:bg-cyan-300/16"
              >
                返回首页
              </Link>
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">
                  流水线方块调度
                </h1>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-[24px] border border-cyan-300/24 bg-cyan-300/10 p-4 shadow-[0_0_26px_rgba(34,211,238,0.08)]">
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/70">
                  当前块
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-50">
                  {activeSnapshot?.blueprint.title ?? "等待入场"}
                </p>
              </div>
              <div className="rounded-[24px] border border-emerald-300/24 bg-emerald-300/10 p-4 shadow-[0_0_26px_rgba(16,185,129,0.08)]">
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-100/70">
                  当前阶段
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-50">
                  {renderSnapshotStage(activeSnapshot)}
                </p>
              </div>
              <div className="rounded-[24px] border border-rose-300/24 bg-rose-300/10 p-4 shadow-[0_0_26px_rgba(251,113,133,0.08)]">
                <p className="text-xs uppercase tracking-[0.24em] text-rose-100/70">
                  锁定
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-50">
                  {session?.lockedCount ?? 0}
                </p>
              </div>
              <div className="rounded-[24px] border border-amber-300/24 bg-amber-300/10 p-4 shadow-[0_0_26px_rgba(251,191,36,0.08)]">
                <p className="text-xs uppercase tracking-[0.24em] text-amber-100/70">
                  清行
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-50">
                  {session?.lines ?? 0}
                </p>
              </div>
            </div>
          </div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.04 }}
          className="min-w-0"
        >
          {activeSnapshot ? (
            <PipelineStageCanvas
              step={activeSnapshot.currentStep}
              previousStep={activeSnapshot.previousStep}
              stageHighlights={activeSnapshot.stageHighlights}
              flowHints={activeSnapshot.flowHints}
              snapshotLabel="主舞台联动"
              badgeLabel={activeSnapshot.blueprint.cue}
              pulseTone={activeSnapshot.blueprint.tone}
              hazardLabel={`${activeSnapshot.blueprint.title} · 第 ${activeSnapshot.currentStep.pipeline?.cycle ?? "-"} 拍`}
              showRegisters={false}
            />
          ) : (
            <div className="rounded-[34px] border border-cyan-300/18 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),radial-gradient(circle_at_top_right,rgba(251,113,133,0.12),transparent_26%),linear-gradient(180deg,rgba(1,4,12,0.98),rgba(2,6,23,0.92))] p-6 shadow-[0_36px_110px_rgba(2,6,23,0.52)]">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                主舞台联动
              </p>
              <div className="mt-5 rounded-[24px] border border-white/12 bg-black/28 p-5 text-sm text-slate-300">
                等待当前块进场。
              </div>
            </div>
          )}
        </motion.section>

        <div className="grid gap-5 xl:grid-cols-[500px,minmax(0,1fr)] xl:items-stretch">
          <motion.section
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="min-w-0 h-full xl:justify-self-start"
          >
            <div className="h-full w-full max-w-[500px]">
              {isLoading ? (
                <div className="rounded-[32px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(2,6,23,0.86))] p-10 text-center text-sm text-slate-200">
                  正在载入方块……
                </div>
              ) : error || blueprintError ? (
                <div className="rounded-[32px] border border-rose-400/24 bg-rose-400/10 p-10 text-center text-sm text-rose-100">
                  {error ?? blueprintError}
                </div>
              ) : session ? (
                <TrafficIntersectionBoard
                  session={session}
                  blueprints={resolvedBlueprints}
                  onSelectBlock={(blockId) => dispatchAction({ type: "select", blockId })}
                  className="h-full"
                />
              ) : (
                <div className="rounded-[32px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(2,6,23,0.86))] p-10 text-center text-sm text-slate-200">
                  正在准备开局……
                </div>
              )}
            </div>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            className="flex min-w-0 h-full flex-col gap-5"
          >
            <div className="grid gap-5 xl:grid-cols-2 xl:items-stretch">
              <Panel
                title="状态卡"
                className="flex h-full min-h-0 flex-col border-amber-300/22 shadow-[0_28px_90px_rgba(251,191,36,0.08)]"
              >
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  {renderStatusCard(selectedSnapshot)}
                </div>
              </Panel>

              <Panel
                title="调度信息"
                className="flex h-full min-h-0 flex-col border-emerald-300/22 shadow-[0_28px_90px_rgba(16,185,129,0.08)]"
              >
                <div className="flex h-full flex-1 flex-col">
                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => dispatchAction({ type: "togglePause" })}
                    className="min-h-[78px] rounded-[22px] border border-cyan-300/40 bg-cyan-300/14 px-4 py-4 text-base font-semibold text-cyan-50 transition hover:border-cyan-200/55 hover:bg-cyan-300/20"
                  >
                    {session?.paused ? "继续" : "暂停"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSoftDropping(false);
                      dispatchAction({ type: "restart" });
                    }}
                    className="min-h-[78px] rounded-[22px] border border-white/14 bg-black/28 px-4 py-4 text-base font-semibold text-slate-100 transition hover:border-white/26 hover:bg-white/10"
                  >
                    重新开局
                  </button>
                </div>

                <div className="mt-4 grid flex-1 auto-rows-fr gap-4 sm:grid-cols-2">
                  <div className="flex min-h-[126px] flex-col justify-between rounded-[20px] border border-cyan-300/18 bg-black/28 p-5">
                    <p className="text-xs text-slate-400">节拍</p>
                    <p className="mt-3 text-3xl font-semibold text-slate-50">
                      {activeSnapshot?.currentStep.pipeline?.cycle ?? "-"}
                    </p>
                  </div>
                  <div className="flex min-h-[126px] flex-col justify-between rounded-[20px] border border-emerald-300/18 bg-black/28 p-5">
                    <p className="text-xs text-slate-400">下一块</p>
                    <p className="mt-3 text-xl font-semibold leading-8 text-slate-50">
                      {nextBlueprint?.title ?? "队列补充中"}
                    </p>
                  </div>
                  <div className="flex min-h-[126px] flex-col justify-between rounded-[20px] border border-amber-300/18 bg-black/28 p-5">
                    <p className="text-xs text-slate-400">动作</p>
                    <p className="mt-3 text-base leading-7 text-slate-100">
                      {session?.lastActionLabel ?? "准备开局"}
                    </p>
                  </div>
                  <div className="flex min-h-[126px] flex-col justify-between rounded-[20px] border border-rose-300/18 bg-black/28 p-5">
                    <p className="text-xs text-slate-400">反馈</p>
                    <p className="mt-3 text-base leading-7 text-slate-100">
                      {session?.lastEventLabel ?? "等待开局"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex min-h-[164px] flex-col justify-between rounded-[22px] border border-white/12 bg-black/28 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        队列前端
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-slate-50">
                        {nextBlueprint?.title ?? "等待补充"}
                      </p>
                      <p className="mt-3 text-base leading-7 text-slate-300">
                        {nextBlueprint?.description ?? "下一块生成后会显示在这里。"}
                      </p>
                    </div>
                    {nextBlueprint ? (
                      <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs text-slate-100">
                        {getDispatchBoardLegend(nextBlueprint.kind)}
                      </span>
                    ) : null}
                  </div>
                </div>
                </div>
              </Panel>
            </div>

            <Panel
              title="寄存器"
              className="flex-1 border-lime-300/22 shadow-[0_28px_90px_rgba(132,204,22,0.08)]"
            >
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {Array.from({ length: 32 }, (_, reg) => {
                  const activities = registerActivityMap[reg] ?? [];
                  const dominantKind = getRegisterDominantKind(activities);

                  return (
                    <motion.div
                      key={`dispatch-register-${reg}`}
                      initial={false}
                      animate={
                        activities.length
                          ? { opacity: [0.76, 1, 0.92], scale: [0.96, 1.04, 1] }
                          : { opacity: 1, scale: 1 }
                      }
                      transition={{ duration: 0.56, ease: "easeInOut" }}
                      className={`rounded-[18px] border p-3 transition-colors ${registerCardClasses[dominantKind]}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                          r{reg}
                        </span>
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${registerDotClasses[dominantKind]}`}
                        />
                      </div>

                      <div className="mt-3 min-h-[34px] space-y-1 text-[10px] leading-4">
                        {activities.length ? (
                          activities.slice(0, 2).map((activity, index) => (
                            <p key={`${reg}-${activity.kind}-${activity.value ?? index}`}>
                              {activity.label}
                              {activity.value ? ` ${activity.value}` : ""}
                            </p>
                          ))
                        ) : (
                          <p className="opacity-60">空闲</p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </Panel>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
