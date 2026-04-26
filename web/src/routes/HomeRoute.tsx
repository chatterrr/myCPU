import {
  startTransition,
  useDeferredValue,
  useEffect,
  useState
} from "react";
import { motion } from "motion/react";
import { useSearchParams } from "react-router-dom";
import { PortalHero } from "@/components/PortalHero";
import { Panel } from "@/components/Panel";
import { Tag, type TagTone } from "@/components/Tag";
import { PipelineStageCanvas } from "@/features/pipeline/PipelineStageCanvas";
import {
  loadTraceFromSample,
  sampleTraceOptions,
  type HomeSurfaceId
} from "@/features/trace/sources";
import {
  buildPipelineFallbackInfo,
  buildPipelineVisuals,
  buildTimerSemanticTimeline,
  buildTrapProcessTimeline,
  clampStepIndex,
  collectRecentItems,
  collectUartOutput,
  describeTrapPhase,
  findLastWriteback,
  formatRegister,
  getBranchTag,
  getErtnSummary,
  getPipelinePulseTone,
  getStopReasonLabel,
  getStopReasonTone,
  getTrapEventTag,
  sampleOptionById
} from "@/features/trace/workbench";
import type { TraceDocument } from "@/features/trace/types";

function Metric({
  label,
  value
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
      <p className="text-xs tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-base font-semibold text-slate-50">
        {value === null || value === undefined || value === "" ? "-" : value}
      </p>
    </div>
  );
}

function SemanticStoryCard({
  title,
  detail,
  tone,
  stepNumber
}: {
  title: string;
  detail: string;
  tone: "neutral" | "cyan" | "amber" | "emerald" | "rose";
  stepNumber?: number;
}) {
  const toneClass =
    tone === "rose"
      ? "border-rose-300/18 bg-rose-300/10"
      : tone === "amber"
        ? "border-amber-300/18 bg-amber-300/10"
        : tone === "cyan"
          ? "border-cyan-300/18 bg-cyan-300/10"
          : tone === "emerald"
            ? "border-emerald-300/18 bg-emerald-300/10"
            : "border-white/10 bg-white/5";

  return (
    <div className={`rounded-[22px] border px-4 py-3 ${toneClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-50">{title}</p>
        {stepNumber !== undefined ? (
          <span className="rounded-full border border-white/10 bg-black/18 px-3 py-1 text-xs text-slate-200">
            第 {stepNumber} 步
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-200">{detail}</p>
    </div>
  );
}

const focusToneClasses: Record<TagTone, string> = {
  neutral: "border-white/12 bg-black/28 text-slate-100",
  cyan: "border-cyan-300/26 bg-cyan-300/12 text-cyan-50",
  amber: "border-amber-300/26 bg-amber-300/12 text-amber-50",
  emerald: "border-emerald-300/26 bg-emerald-300/12 text-emerald-50",
  rose: "border-rose-300/26 bg-rose-300/12 text-rose-50"
};

function FocusTile({
  label,
  value,
  detail,
  tone,
  delay
}: {
  label: string;
  value: string;
  detail: string;
  tone: TagTone;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay }}
      className={`rounded-[24px] border p-4 shadow-[0_20px_60px_rgba(2,6,23,0.28)] ${focusToneClasses[tone]}`}
    >
      <p className="text-xs tracking-[0.22em] text-slate-300/80">{label}</p>
      <p className="mt-3 text-lg font-semibold">{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-200/90">{detail}</p>
    </motion.div>
  );
}

const homeSurfaceOrder: HomeSurfaceId[] = ["execution", "pipeline", "device"];

const homeSurfaceMeta: Record<
  HomeSurfaceId,
  {
    label: string;
    detail: string;
    panelTitle: string;
    panelDescription: string;
    tone: TagTone;
  }
> = {
  execution: {
    label: "执行过程",
    detail: "查看当前指令、寄存器写回、异常过程和程序结束结果。",
    panelTitle: "执行过程",
    panelDescription: "围绕当前样例展示当前指令、寄存器变化、异常状态与运行结果。",
    tone: "amber"
  },
  pipeline: {
    label: "流水线现场",
    detail: "查看 IF / ID / EX / MEM / WB 的阶段变化、停顿、旁路和冲刷。",
    panelTitle: "流水线现场",
    panelDescription: "围绕当前样例展示五级流水线快照、阶段状态与控制信号。",
    tone: "cyan"
  },
  device: {
    label: "外设、总线与存储访问",
    detail: "查看 UART、Timer、设备事件、总线访问与纯内存访问。",
    panelTitle: "外设、总线与存储访问",
    panelDescription: "围绕当前样例分开展示 UART、Timer、设备事件、总线访问与纯内存访问。",
    tone: "emerald"
  }
};

const surfaceCardClasses: Record<HomeSurfaceId, string> = {
  execution:
    "border-amber-300/24 bg-amber-300/10 shadow-[0_22px_80px_rgba(251,191,36,0.08)]",
  pipeline:
    "border-cyan-300/24 bg-cyan-300/10 shadow-[0_22px_80px_rgba(34,211,238,0.08)]",
  device:
    "border-emerald-300/24 bg-emerald-300/10 shadow-[0_22px_80px_rgba(16,185,129,0.08)]"
};

const surfaceButtonClasses: Record<HomeSurfaceId, string> = {
  execution: "border-amber-300/35 bg-amber-300/14 text-amber-50",
  pipeline: "border-cyan-300/35 bg-cyan-300/14 text-cyan-50",
  device: "border-emerald-300/35 bg-emerald-300/14 text-emerald-50"
};

export function HomeRoute() {
  const [searchParams] = useSearchParams();
  const [selectedSampleId, setSelectedSampleId] = useState("smoke");
  const [trace, setTrace] = useState<TraceDocument | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredStepIndex = useDeferredValue(stepIndex);

  useEffect(() => {
    const querySampleId = searchParams.get("sample");
    if (querySampleId && sampleOptionById.has(querySampleId) && querySampleId !== selectedSampleId) {
      setSelectedSampleId(querySampleId);
    }
  }, [searchParams, selectedSampleId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSample() {
      const option = sampleOptionById.get(selectedSampleId);
      if (!option) {
        setTrace(null);
        setError(`缺少样例 trace：${selectedSampleId}`);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setIsPlaying(false);
      setTrace(null);
      setStepIndex(0);

      try {
        const nextTrace = await loadTraceFromSample(option);
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setTrace(nextTrace);
          setIsLoading(false);
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError((loadError as Error).message);
        setTrace(null);
        setIsLoading(false);
      }
    }

    void loadSample();

    return () => {
      cancelled = true;
    };
  }, [selectedSampleId]);

  useEffect(() => {
    if (!isPlaying || !trace?.steps.length) {
      return;
    }

    const timer = window.setInterval(() => {
      setStepIndex((current) => {
        if (!trace || current >= trace.steps.length - 1) {
          window.clearInterval(timer);
          setIsPlaying(false);
          return current;
        }

        return current + 1;
      });
    }, 760);

    return () => window.clearInterval(timer);
  }, [isPlaying, trace]);

  const selectedOption =
    sampleOptionById.get(selectedSampleId) ?? sampleTraceOptions[0]!;
  const selectedSurface = selectedOption.homeSurface;
  const selectedSurfaceMeta = homeSurfaceMeta[selectedSurface];
  const groupedOptions = homeSurfaceOrder.map((surface) => ({
    surface,
    meta: homeSurfaceMeta[surface],
    options: sampleTraceOptions.filter((option) => option.homeSurface === surface)
  }));

  const activeStep = trace?.steps[deferredStepIndex] ?? null;
  const previousStep =
    trace && deferredStepIndex > 0 ? trace.steps[deferredStepIndex - 1] : null;
  const summary = trace?.summary ?? null;
  const stopReason = summary?.stop_reason;
  const branchTag = activeStep ? getBranchTag(activeStep) : null;
  const trapTag = activeStep ? getTrapEventTag(activeStep) : null;
  const visuals = activeStep ? buildPipelineVisuals(activeStep) : null;
  const uartOutput = trace ? collectUartOutput(trace.steps, deferredStepIndex) : "";
  const recentMemoryAccesses = trace
    ? collectRecentItems(
        trace.steps,
        deferredStepIndex,
        (step) =>
          step.memory_accesses.filter(
            (item) => item.target === "memory" && item.via === "memory"
          ),
        6
      )
    : [];
  const recentBusAccesses = trace
    ? collectRecentItems(
        trace.steps,
        deferredStepIndex,
        (step) => step.memory_accesses.filter((item) => item.via === "bus"),
        6
      )
    : [];
  const recentDeviceSignals = trace
    ? collectRecentItems(
        trace.steps,
        deferredStepIndex,
        (step) =>
          step.device_events.filter(
            (event) =>
              !(event.device === "uart" && event.kind === "tx")
              && event.kind !== "bus_write"
          ),
        6
      )
    : [];
  const recentUartEvents = trace
    ? collectRecentItems(
        trace.steps,
        deferredStepIndex,
        (step) =>
          step.device_events.filter(
            (event) => event.device === "uart" && event.kind === "tx"
          ),
        6
      )
    : [];
  const lastWriteback = trace
    ? findLastWriteback(trace.steps, deferredStepIndex)
    : null;
  const timerStory = trace
    ? buildTimerSemanticTimeline(
        trace.steps,
        deferredStepIndex,
        trace.meta?.device_map ?? []
      )
    : [];
  const trapStory = trace
    ? buildTrapProcessTimeline(trace.steps, deferredStepIndex)
    : [];
  const trapPhase = describeTrapPhase(activeStep, summary);
  const pipelineFallback = buildPipelineFallbackInfo(selectedOption, trace);

  const interpreterFocusItems: Array<{
    label: string;
    value: string;
    detail: string;
    tone: TagTone;
  }> = [
    {
      label: "当前指令",
      value: activeStep ? `${activeStep.op} @ ${activeStep.pc}` : selectedOption.label,
      detail: activeStep
        ? `下一 PC ${activeStep.next_pc ?? "-"}`
        : selectedOption.summary,
      tone: "cyan"
    },
    {
      label: "寄存器变化",
      value: activeStep?.gpr_changes.length
        ? activeStep.gpr_changes.map((change) => `r${change.reg}`).join(" / ")
        : "本步没有写回",
      detail: lastWriteback
        ? `最近一次写回在第 ${lastWriteback.stepNumber} 步：r${lastWriteback.change.reg} <- ${lastWriteback.change.value}`
        : "当前还没有观察到寄存器写回。",
      tone: activeStep?.gpr_changes.length ? "emerald" : "neutral"
    },
    {
      label: "异常 / 中断",
      value: trapTag?.label ?? trapPhase.title,
      detail: trapPhase.detail,
      tone: trapTag?.tone ?? trapPhase.tone
    },
    {
      label: "结束状态",
      value: getStopReasonLabel(stopReason),
      detail: `退出码 ${summary?.exit_code ?? activeStep?.exit_code ?? "-"}`,
      tone: getStopReasonTone(stopReason)
    }
  ];

  const summaryTiles: Array<{
    label: string;
    value: string;
    detail: string;
    tone: TagTone;
  }> = selectedSurface === "pipeline"
    ? [
        {
          label: "当前节拍",
          value: activeStep?.pipeline ? `${activeStep.pipeline.cycle}` : "-",
          detail: activeStep ? `当前步号 ${activeStep.step}` : "等待样例载入。",
          tone: "cyan"
        },
        {
          label: "停顿状态",
          value: activeStep?.pipeline?.stall
            ? (activeStep.pipeline.stall_reason ?? "检测到停顿")
            : "未检测到停顿",
          detail: activeStep?.pipeline?.load_use
            ? "当前包含 load-use 联锁。"
            : "可继续观察旁路与冲刷信号。",
          tone: activeStep?.pipeline?.stall ? "amber" : "neutral"
        },
        {
          label: "旁路路径",
          value: activeStep?.pipeline?.forwarding.length
            ? `${activeStep.pipeline.forwarding.length} 条`
            : "当前没有旁路",
          detail: activeStep?.pipeline?.forwarding.length
            ? activeStep.pipeline.forwarding
                .map((item) => `${item.from_stage.toUpperCase()}->${item.to_stage.toUpperCase()}`)
                .join(" / ")
            : "当前拍次没有显式旁路。",
          tone: activeStep?.pipeline?.forwarding.length ? "cyan" : "neutral"
        },
        {
          label: "控制改道",
          value: activeStep?.pipeline?.redirect_pc
            ? `重定向到 ${activeStep.pipeline.redirect_pc}`
            : "当前没有改道",
          detail: activeStep?.pipeline && activeStep.pipeline.flush.length
            ? `冲刷阶段 ${activeStep.pipeline.flush.join(" / ")}`
            : "当前没有冲刷阶段。",
          tone: activeStep?.pipeline
            && (Boolean(activeStep.pipeline.redirect_pc) || activeStep.pipeline.flush.length > 0)
            ? "rose"
            : "neutral"
        }
      ]
    : selectedSurface === "device"
      ? [
          {
            label: "UART 输出",
            value: uartOutput ? `${uartOutput.length} 个字符` : "暂无输出",
            detail: uartOutput || "当前没有 UART 输出。",
            tone: uartOutput ? "emerald" : "neutral"
          },
          {
            label: "Timer 状态",
            value: activeStep?.timer
              ? (activeStep.timer.enabled ? "正在计时" : "当前停用")
              : "未提供 Timer 快照",
            detail: activeStep?.timer
              ? `control ${activeStep.timer.control} / interval ${activeStep.timer.interval}`
              : "当前步没有 Timer 信息。",
            tone: activeStep?.timer?.enabled ? "amber" : "neutral"
          },
          {
            label: "设备事件",
            value: recentDeviceSignals[0]
              ? `${recentDeviceSignals[0].item.device} ${recentDeviceSignals[0].item.kind}`
              : "暂无设备事件",
            detail: recentDeviceSignals[0]
              ? `最近事件出现在第 ${recentDeviceSignals[0].stepNumber} 步。`
              : "当前没有新增设备事件。",
            tone: recentDeviceSignals[0] ? "cyan" : "neutral"
          },
          {
            label: "访问统计",
            value: `总线 ${recentBusAccesses.length} / 内存 ${recentMemoryAccesses.length}`,
            detail: "统计当前步之前最近观察到的访问条目数量。",
            tone: recentBusAccesses.length || recentMemoryAccesses.length
              ? "emerald"
              : "neutral"
          }
        ]
      : interpreterFocusItems;

  const pipelineStageTiles = activeStep?.pipeline
    ? [
        {
          label: "IF",
          value: activeStep.pipeline.if.op ?? activeStep.pipeline.if.state,
          detail: activeStep.pipeline.if.pc ?? "-"
        },
        {
          label: "ID",
          value: activeStep.pipeline.id.op ?? activeStep.pipeline.id.state,
          detail: activeStep.pipeline.id.pc ?? "-"
        },
        {
          label: "EX",
          value: activeStep.pipeline.ex.op ?? activeStep.pipeline.ex.state,
          detail: activeStep.pipeline.ex.pc ?? "-"
        },
        {
          label: "MEM",
          value: activeStep.pipeline.mem.op ?? activeStep.pipeline.mem.state,
          detail: activeStep.pipeline.mem.pc ?? "-"
        },
        {
          label: "WB",
          value: activeStep.pipeline.wb.op ?? activeStep.pipeline.wb.state,
          detail: activeStep.pipeline.wb.pc ?? "-"
        }
      ]
    : [];

  const pipelineShowcase = activeStep?.pipeline ? (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs tracking-[0.24em] text-slate-400">流水线现场</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-50">
            IF / ID / EX / MEM / WB 当前状态
          </h3>
          <p className="mt-3 text-sm leading-7 text-slate-200">
            当前版面直接展示五级流水线快照，用于对照停顿、冲刷、旁路和分支改道。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tag label={selectedOption.label} tone="cyan" />
          {branchTag ? <Tag label={branchTag.label} tone={branchTag.tone} /> : null}
          <Tag label={`当前步 ${activeStep.step}`} tone="neutral" />
        </div>
      </div>

      <div className="rounded-[30px] border border-white/10 bg-black/28 p-4 shadow-[0_34px_90px_rgba(2,6,23,0.42)]">
        <PipelineStageCanvas
          step={activeStep}
          previousStep={previousStep}
          stageHighlights={visuals?.stageHighlights ?? []}
          flowHints={visuals?.flowHints ?? []}
          snapshotLabel="当前画面"
          badgeLabel={selectedOption.label}
          pulseTone={getPipelinePulseTone(activeStep)}
          hazardLabel="流水线现场"
          showRegisters={false}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Tag
          label={activeStep.pipeline.stall ? "检测到停顿" : "当前无停顿"}
          tone={activeStep.pipeline.stall ? "amber" : "neutral"}
        />
        <Tag
          label={activeStep.pipeline.load_use ? "load-use 联锁" : "无 load-use 联锁"}
          tone={activeStep.pipeline.load_use ? "amber" : "neutral"}
        />
        <Tag
          label={
            activeStep.pipeline.redirect_pc
              ? `改道 ${activeStep.pipeline.redirect_pc}`
              : "当前无改道"
          }
          tone={activeStep.pipeline.redirect_pc ? "rose" : "neutral"}
        />
        <Tag
          label={
            activeStep.pipeline.flush.length
              ? `冲刷 ${activeStep.pipeline.flush.join("/")}`
              : "当前无冲刷"
          }
          tone={activeStep.pipeline.flush.length ? "rose" : "neutral"}
        />
        <Tag
          label={
            activeStep.pipeline.forwarding.length
              ? `旁路 ${activeStep.pipeline.forwarding.length}`
              : "当前无旁路"
          }
          tone={activeStep.pipeline.forwarding.length ? "cyan" : "neutral"}
        />
      </div>
    </div>
  ) : (
    <div className="space-y-4">
      <div className="max-w-2xl">
        <p className="text-xs tracking-[0.24em] text-slate-400">流水线现场</p>
        <h3 className="mt-2 text-2xl font-semibold text-slate-50">
          当前样例不提供完整流水线分拍画面
        </h3>
        <p className="mt-3 text-sm leading-7 text-slate-200">
          {pipelineFallback.detail}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <FocusTile
          label="推荐版面"
          value="执行过程"
          detail="该样例没有完整流水线逐拍快照，因此更适合优先阅读执行语义。"
          tone="amber"
          delay={0}
        />
        <FocusTile
          label="推荐关注内容"
          value={pipelineFallback.focusPanels.join(" / ")}
          detail={pipelineFallback.focusPanels.join(" / ")}
          tone="amber"
          delay={0.08}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Tag label="建议先看执行过程" tone="amber" />
        {pipelineFallback.focusPanels.map((panel) => (
          <Tag key={panel} label={`继续看 ${panel}`} tone="amber" />
        ))}
        {pipelineFallback.suggestedSamples.map((option) => (
          <button
            key={`fallback-${option.id}`}
            type="button"
            onClick={() => setSelectedSampleId(option.id)}
            className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-sm text-slate-100 transition hover:border-cyan-300/35 hover:bg-cyan-300/12"
          >
            切换到 {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  const detailPanel = selectedSurface === "pipeline" ? (
    <Panel
      title={homeSurfaceMeta.pipeline.panelTitle}
      description={homeSurfaceMeta.pipeline.panelDescription}
    >
      {activeStep ? (
        <div className="space-y-5">
          {pipelineShowcase}

          {activeStep.pipeline ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {pipelineStageTiles.map((item, index) => (
                  <FocusTile
                    key={`${item.label}-${item.value}-${item.detail}`}
                    label={item.label}
                    value={item.value}
                    detail={item.detail}
                    tone="cyan"
                    delay={index * 0.04}
                  />
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="当前节拍" value={activeStep.pipeline.cycle} />
                <Metric
                  label="停顿原因"
                  value={
                    activeStep.pipeline.stall_reason
                    ?? (activeStep.pipeline.stall ? "stall" : "-")
                  }
                />
                <Metric label="改道 PC" value={activeStep.pipeline.redirect_pc} />
                <Metric label="旁路数量" value={activeStep.pipeline.forwarding.length} />
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          正在载入所选样例的流水线数据。
        </div>
      )}
    </Panel>
  ) : selectedSurface === "device" ? (
    <Panel
      title={homeSurfaceMeta.device.panelTitle}
      description={homeSurfaceMeta.device.panelDescription}
    >
      {activeStep ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="UART 字符数" value={uartOutput.length || 0} />
            <Metric label="设备事件数" value={recentDeviceSignals.length} />
            <Metric label="总线访问数" value={recentBusAccesses.length} />
            <Metric label="纯内存访问数" value={recentMemoryAccesses.length} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(trace?.meta?.device_map ?? []).map((entry) => (
              <Tag
                key={`${entry.name}-${entry.base ?? "base"}`}
                label={`${entry.name}${entry.base ? ` @ ${entry.base}` : ""}`}
                tone="neutral"
              />
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr,0.95fr]">
            <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-50">UART 输出</p>
                <Tag
                  label={uartOutput ? `${uartOutput.length} 个字符` : "暂无输出"}
                  tone={uartOutput ? "emerald" : "neutral"}
                />
              </div>

              <pre className="mt-4 min-h-[120px] overflow-x-auto rounded-2xl border border-emerald-300/14 bg-emerald-300/8 p-4 text-sm text-emerald-50">
                {uartOutput || "（当前还没有 UART 输出）"}
              </pre>

              <div className="mt-4 space-y-2">
                {recentUartEvents.length ? (
                  recentUartEvents.map(({ stepNumber, item }, index) => (
                    <div
                      key={`${stepNumber}-${item.text ?? index}`}
                      className="rounded-2xl border border-emerald-300/16 bg-emerald-300/8 px-4 py-3 text-sm text-slate-100"
                    >
                      <p className="font-medium text-emerald-50">
                        第 {stepNumber} 步：UART 发送
                      </p>
                      <p className="mt-1 text-slate-300">
                        {item.text ?? "无字符负载"}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                    最近没有 UART 发送事件。
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-50">Timer 状态</p>
                <Tag
                  label={activeStep.timer?.enabled ? "正在计时" : "当前停用"}
                  tone={activeStep.timer?.enabled ? "amber" : "neutral"}
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Metric label="control" value={activeStep.timer?.control} />
                <Metric label="interval" value={activeStep.timer?.interval} />
                <Metric label="remaining" value={activeStep.timer?.remaining} />
                <Metric
                  label="运行状态"
                  value={
                    activeStep.timer
                      ? (activeStep.timer.enabled ? "enabled" : "disabled")
                      : "-"
                  }
                />
                <Metric
                  label="模式"
                  value={
                    activeStep.timer
                      ? (activeStep.timer.periodic ? "periodic" : "one-shot")
                      : "-"
                  }
                />
                <Metric
                  label="IRQ"
                  value={
                    activeStep.timer
                      ? (activeStep.timer.interrupt_enabled ? "enabled" : "disabled")
                      : "-"
                  }
                />
              </div>

              <div className="mt-4 space-y-2">
                {timerStory.length ? (
                  timerStory.map((entry) => (
                    <SemanticStoryCard
                      key={`${entry.stepNumber}-${entry.title}`}
                      title={entry.title}
                      detail={entry.detail}
                      tone={entry.tone}
                      stepNumber={entry.stepNumber}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                    当前样例没有显著的 Timer 语义变化。
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
              <p className="text-sm font-semibold text-slate-50">设备事件</p>
              <div className="mt-4 space-y-2">
                {recentDeviceSignals.length ? (
                  recentDeviceSignals.map(({ stepNumber, item }, index) => (
                    <div
                      key={`${stepNumber}-${item.device}-${item.kind}-${index}`}
                      className="rounded-2xl border border-cyan-300/16 bg-cyan-300/8 px-4 py-3 text-sm text-slate-100"
                    >
                      <p className="font-medium text-cyan-50">
                        第 {stepNumber} 步：{item.device} {item.kind}
                      </p>
                      <p className="mt-1 text-slate-300">
                        {item.cause
                          ?? item.text
                          ?? ([item.addr, item.value].filter(Boolean).join(" / ")
                            || "无额外负载")}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                    当前还没有设备事件。
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
              <p className="text-sm font-semibold text-slate-50">总线访问</p>
              <div className="mt-4 space-y-2">
                {recentBusAccesses.length ? (
                  recentBusAccesses.map(({ stepNumber, item }, index) => (
                    <div
                      key={`${stepNumber}-${item.kind}-${item.addr}-${index}`}
                      className="rounded-2xl border border-amber-300/16 bg-amber-300/8 px-4 py-3 text-sm text-slate-100"
                    >
                      <p className="font-medium text-amber-50">
                        第 {stepNumber} 步：{item.target} {item.kind}
                      </p>
                      <p className="mt-1 text-slate-300">
                        地址 {item.addr}，值 {item.value}，宽度 {item.width}，路径 {item.via}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                    当前还没有与设备相关的总线访问。
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
              <p className="text-sm font-semibold text-slate-50">纯内存访问</p>
              <div className="mt-4 space-y-2">
                {recentMemoryAccesses.length ? (
                  recentMemoryAccesses.map(({ stepNumber, item }, index) => (
                    <div
                      key={`${stepNumber}-${item.kind}-${item.addr}-${index}`}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100"
                    >
                      <p className="font-medium text-slate-50">
                        第 {stepNumber} 步：{item.kind} {item.addr}
                      </p>
                      <p className="mt-1 text-slate-300">
                        值 {item.value}，宽度 {item.width}，目标 {item.target}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                    当前还没有纯内存访问。
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          正在载入所选样例的外设与存储访问数据。
        </div>
      )}
    </Panel>
  ) : (
    <Panel
      title={homeSurfaceMeta.execution.panelTitle}
      description={homeSurfaceMeta.execution.panelDescription}
    >
      {activeStep ? (
        <div className="grid gap-5 xl:grid-cols-[1.02fr,0.98fr]">
          <div className="rounded-[26px] border border-white/10 bg-black/24 p-5">
            <p className="text-xs tracking-[0.22em] text-slate-400">当前指令与写回</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="PC" value={activeStep.pc} />
              <Metric label="下一 PC" value={activeStep.next_pc} />
              <Metric label="操作码" value={activeStep.op} />
              <Metric label="原始指令" value={activeStep.raw} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="rd" value={formatRegister(activeStep.rd)} />
              <Metric label="rj" value={formatRegister(activeStep.rj)} />
              <Metric label="rk" value={formatRegister(activeStep.rk)} />
              <Metric label="立即数" value={activeStep.imm} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {branchTag ? <Tag label={branchTag.label} tone={branchTag.tone} /> : null}
              {activeStep.gpr_changes.length ? (
                activeStep.gpr_changes.map((change) => (
                  <Tag
                    key={`${change.reg}-${change.value}`}
                    label={`r${change.reg} <- ${change.value}`}
                    tone="emerald"
                  />
                ))
              ) : (
                <Tag label="本步没有写回" tone="neutral" />
              )}
            </div>

            <div className="mt-4 rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              {lastWriteback
                ? `最近一次写回发生在第 ${lastWriteback.stepNumber} 步：r${lastWriteback.change.reg} <- ${lastWriteback.change.value}`
                : "当前还没有观察到寄存器写回。"}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="总步数" value={summary?.steps ?? trace?.steps.length} />
              <Metric label="停止方式" value={getStopReasonLabel(stopReason)} />
              <Metric label="退出码" value={summary?.exit_code} />
              <Metric label="停止 PC" value={summary?.pc} />
            </div>

            {summary?.error_message ? (
              <div className="mt-4 rounded-[22px] border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
                {summary.error_message}
              </div>
            ) : null}
          </div>

          <div className="rounded-[26px] border border-white/10 bg-black/24 p-5">
            <p className="text-xs tracking-[0.22em] text-slate-400">异常与中断语义</p>

            <div className="mt-4">
              <SemanticStoryCard
                title={trapPhase.title}
                detail={trapPhase.detail}
                tone={trapPhase.tone}
                stepNumber={activeStep.step}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {trapTag ? <Tag label={trapTag.label} tone={trapTag.tone} /> : null}
              <Tag
                label={`原因 ${activeStep.cause ?? activeStep.trap_state.cause}`}
                tone={
                  activeStep.exception || activeStep.interrupt ? "rose" : "neutral"
                }
              />
              <Tag
                label={`EXL ${activeStep.trap_state.exl ? "置位" : "清除"}`}
                tone={activeStep.trap_state.exl ? "rose" : "neutral"}
              />
              <Tag
                label={`待处理中断 ${activeStep.trap_state.pending_interrupt ? "有" : "无"}`}
                tone={activeStep.trap_state.pending_interrupt ? "amber" : "neutral"}
              />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Metric label="原因" value={activeStep.trap_state.cause} />
              <Metric label="EPC" value={activeStep.trap_state.epc} />
              <Metric label="异常向量" value={activeStep.trap_state.vector} />
              <Metric label="BADV" value={activeStep.trap_state.badv} />
              <Metric label="状态寄存器" value={activeStep.trap_state.status} />
              <Metric
                label="上次为中断"
                value={activeStep.trap_state.last_trap_was_interrupt ? "是" : "否"}
              />
            </div>

            <div className="mt-4 rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              {getErtnSummary(activeStep)}
            </div>

            <div className="mt-4 space-y-3">
              {trapStory.length ? (
                trapStory.map((entry) => (
                  <SemanticStoryCard
                    key={`${entry.stepNumber}-${entry.title}`}
                    title={entry.title}
                    detail={entry.detail}
                    tone={entry.tone}
                    stepNumber={entry.stepNumber}
                  />
                ))
              ) : (
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  当前样例还没有进入异常或中断处理路径。
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          正在载入所选样例的执行数据。
        </div>
      )}
    </Panel>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_20%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.12),_transparent_24%),linear-gradient(180deg,_#04111f_0%,_#030712_45%,_#02050f_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1720px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <PortalHero
          sectionLabel="LoongArch 流水线"
          title="LoongArch 程序执行可视化工作台"
          description="选择样例后，下方展开主版面，围绕运行记录分析。"
          actions={[
            { label: "Hazard 互动", to: "/hazard-puzzle", emphasis: "secondary" },
            { label: "方块调度", to: "/traffic-control", emphasis: "secondary" }
          ]}
        />

        <Panel
          title="样例选择"
          description="样例按照观察重点归类。选择样例后，下方只展开与其对应的主版面，其余版面默认收起。"
        >
          <div className="grid gap-5 xl:grid-cols-[0.95fr,1.05fr]">
            <div className="grid gap-4">
              {groupedOptions.map(({ surface, meta, options }, groupIndex) => (
                <motion.div
                  key={surface}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: groupIndex * 0.05 }}
                  className={`rounded-[30px] border p-5 ${
                    selectedSurface === surface
                      ? surfaceCardClasses[surface]
                      : "border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.92),rgba(3,7,18,0.82))]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="max-w-2xl">
                      <p className="text-xs tracking-[0.22em] text-slate-400">{meta.label}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-200">{meta.detail}</p>
                    </div>
                    <Tag label={`${options.length} 个样例`} tone={meta.tone} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedSampleId(option.id)}
                        className={`rounded-full border px-4 py-2 text-sm transition ${
                          selectedSampleId === option.id
                            ? surfaceButtonClasses[surface]
                            : "border-white/10 bg-white/5 text-slate-100 hover:border-white/18 hover:bg-white/8"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              key={selectedSampleId}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32 }}
              className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(5,15,31,0.96),rgba(2,6,23,0.9))] p-6 shadow-[0_38px_120px_rgba(2,6,23,0.46)]"
            >
              <motion.div
                className="absolute -left-10 top-12 h-36 w-36 rounded-full bg-cyan-300/12 blur-3xl"
                animate={{ x: [0, 60, 0], y: [0, 24, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute right-0 top-0 h-44 w-44 rounded-full bg-emerald-300/10 blur-3xl"
                animate={{ x: [0, -32, 0], y: [0, 28, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              />

              <div className="relative space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <p className="text-xs tracking-[0.24em] text-slate-400">
                      {selectedSurfaceMeta.panelTitle}
                    </p>
                    <h3 className="mt-2 text-3xl font-semibold text-slate-50">
                      {selectedOption.label}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-slate-200">
                      {selectedOption.summary}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      {selectedOption.teachingGoal}
                    </p>
                  </div>
                  <Tag
                    label={`下方展开 ${selectedSurfaceMeta.panelTitle}`}
                    tone={selectedSurfaceMeta.tone}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedOption.portalTags.map((tag) => (
                    <Tag
                      key={`${selectedOption.id}-${tag.label}`}
                      label={tag.label}
                      tone={tag.tone}
                    />
                  ))}
                  {selectedOption.stopKinds.map((kind) => (
                    <Tag
                      key={`${selectedOption.id}-${kind}`}
                      label={getStopReasonLabel(kind)}
                      tone={getStopReasonTone(kind)}
                    />
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {summaryTiles.map((item, index) => (
                    <FocusTile
                      key={`${item.label}-${item.value}-${index}`}
                      label={item.label}
                      value={item.value}
                      detail={item.detail}
                      tone={item.tone}
                      delay={index * 0.05}
                    />
                  ))}
                </div>

                <div className="rounded-[28px] border border-white/10 bg-black/24 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs tracking-[0.22em] text-slate-400">播放控制</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedOption.recommendedFields.slice(0, 3).map((field) => (
                        <Tag key={field} label={field} tone="neutral" />
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlaying(false);
                        startTransition(() => {
                          setStepIndex((current) => clampStepIndex(current - 1, trace));
                        });
                      }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100"
                    >
                      上一步
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPlaying((current) => !current)}
                      className="rounded-2xl border border-cyan-300/30 bg-cyan-300/12 px-4 py-3 text-sm text-cyan-50"
                    >
                      {isPlaying ? "暂停" : "播放"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlaying(false);
                        startTransition(() => {
                          setStepIndex((current) => clampStepIndex(current + 1, trace));
                        });
                      }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100"
                    >
                      下一步
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlaying(false);
                        setStepIndex(0);
                      }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100"
                    >
                      回到开始
                    </button>
                  </div>

                  <div className="mt-4 rounded-[24px] border border-white/10 bg-slate-950/60 px-4 py-4">
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, (trace?.steps.length ?? 1) - 1)}
                      value={Math.min(stepIndex, Math.max(0, (trace?.steps.length ?? 1) - 1))}
                      onChange={(event) => {
                        setIsPlaying(false);
                        setStepIndex(Number(event.target.value));
                      }}
                      className="w-full accent-cyan-400"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Tag
                        label={`步号 ${(trace?.steps.length ?? 0) ? deferredStepIndex + 1 : 0}/${trace?.steps.length ?? 0}`}
                        tone="cyan"
                      />
                      <Tag
                        label={`停止方式 ${getStopReasonLabel(stopReason)}`}
                        tone={getStopReasonTone(stopReason)}
                      />
                      <Tag
                        label={`退出码 ${summary?.exit_code ?? activeStep?.exit_code ?? "-"}`}
                        tone={getStopReasonTone(stopReason)}
                      />
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                      正在载入样例记录...
                    </div>
                  ) : null}

                  {error ? (
                    <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
                      {error}
                    </div>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </div>
        </Panel>

        {detailPanel}
      </div>
    </div>
  );
}
