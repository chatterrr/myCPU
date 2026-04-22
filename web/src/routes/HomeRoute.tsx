import {
  startTransition,
  useDeferredValue,
  useEffect,
  useState
} from "react";
import { Link } from "react-router-dom";
import { Panel } from "@/components/Panel";
import { Tag } from "@/components/Tag";
import { PipelineStageCanvas } from "@/features/pipeline/PipelineStageCanvas";
import {
  loadTraceFromSample,
  sampleTraceOptions
} from "@/features/trace/sources";
import {
  buildPipelineVisuals,
  clampStepIndex,
  collectRecentItems,
  collectUartOutput,
  findLastWriteback,
  formatRegister,
  getBranchTag,
  getErtnSummary,
  getPipelinePulseTone,
  getStopReasonTone,
  getTrapEventTag,
  sampleOptionById,
  stopReasonGuide,
  topSampleIds
} from "@/features/trace/workbench";
import type { TraceDocument, TraceMode } from "@/features/trace/types";

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

export function HomeRoute() {
  const [selectedSampleId, setSelectedSampleId] = useState("smoke");
  const [trace, setTrace] = useState<TraceDocument | null>(null);
  const [viewMode, setViewMode] = useState<TraceMode>("interpreter");
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredStepIndex = useDeferredValue(stepIndex);

  useEffect(() => {
    let cancelled = false;

    async function loadSample() {
      const option = sampleOptionById.get(selectedSampleId);
      if (!option) {
        setError(`缺少样例 trace：${selectedSampleId}`);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setIsPlaying(false);

      try {
        const nextTrace = await loadTraceFromSample(option);
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setTrace(nextTrace);
          setViewMode(option.recommendedView ?? nextTrace.inferredMode);
          setStepIndex(0);
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
  const activeStep = trace?.steps[deferredStepIndex] ?? null;
  const previousStep =
    trace && deferredStepIndex > 0 ? trace.steps[deferredStepIndex - 1] : null;
  const summary = trace?.summary;
  const stopReason = summary?.stop_reason;
  const programMode = trace?.meta?.mode ?? trace?.inferredMode ?? "interpreter";
  const branchTag = activeStep ? getBranchTag(activeStep) : null;
  const trapTag = activeStep ? getTrapEventTag(activeStep) : null;
  const visuals = activeStep ? buildPipelineVisuals(activeStep) : null;
  const uartOutput = trace ? collectUartOutput(trace.steps, deferredStepIndex) : "";
  const recentDeviceEvents = trace
    ? collectRecentItems(trace.steps, deferredStepIndex, (step) => step.device_events, 6)
    : [];
  const recentMemoryAccesses = trace
    ? collectRecentItems(trace.steps, deferredStepIndex, (step) => step.memory_accesses, 6)
    : [];
  const lastWriteback = trace
    ? findLastWriteback(trace.steps, deferredStepIndex)
    : null;

  const pipelinePanel = (
    <Panel
      title="流水线"
      description="同一套 trace 契约驱动 IF/ID/EX/MEM/WB 的统一可视化。"
    >
      {activeStep?.pipeline ? (
        <div className="space-y-4">
          <PipelineStageCanvas
            step={activeStep}
            previousStep={previousStep}
            stageHighlights={visuals?.stageHighlights ?? []}
            flowHints={visuals?.flowHints ?? []}
            snapshotLabel="统一工作台"
            badgeLabel={selectedOption.label}
            pulseTone={getPipelinePulseTone(activeStep)}
            hazardLabel={viewMode === "pipeline" ? "流水线视角" : "解释器视角"}
            showRegisters={false}
          />

          <div className="flex flex-wrap gap-2">
            <Tag
              label={activeStep.pipeline.stall ? "发生停顿" : "无停顿"}
              tone={activeStep.pipeline.stall ? "amber" : "neutral"}
            />
            <Tag
              label={activeStep.pipeline.load_use ? "load-use 联锁" : "无 load-use"}
              tone={activeStep.pipeline.load_use ? "amber" : "neutral"}
            />
            <Tag
              label={
                activeStep.pipeline.redirect_pc
                  ? `改道 ${activeStep.pipeline.redirect_pc}`
                  : "无改道"
              }
              tone={activeStep.pipeline.redirect_pc ? "rose" : "neutral"}
            />
            <Tag
              label={
                activeStep.pipeline.flush.length
                  ? `冲刷 ${activeStep.pipeline.flush.join("/")}`
                  : "无冲刷"
              }
              tone={activeStep.pipeline.flush.length ? "rose" : "neutral"}
            />
            <Tag
              label={
                activeStep.pipeline.forwarding.length
                  ? `旁路 ${activeStep.pipeline.forwarding.length}`
                  : "无旁路"
              }
              tone={activeStep.pipeline.forwarding.length ? "cyan" : "neutral"}
            />
            {branchTag ? <Tag label={branchTag.label} tone={branchTag.tone} /> : null}
          </div>
        </div>
      ) : (
        <div className="rounded-[22px] border border-amber-300/18 bg-amber-300/8 p-4 text-sm text-amber-50">
          当前样例没有逐级流水线快照，但同一工作台仍会展示 CPU、异常、中断、设备和总结信息。
        </div>
      )}
    </Panel>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_20%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.12),_transparent_24%),linear-gradient(180deg,_#04111f_0%,_#030712_45%,_#02050f_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1720px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-[34px] border border-cyan-300/16 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(2,6,23,0.86))] p-6 shadow-[0_36px_110px_rgba(2,6,23,0.48)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Tag label="milestone16" tone="cyan" />
                <Tag label="统一工作台" tone="emerald" />
                <Tag label="trace 优先" tone="amber" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">
                统一执行可视化工作台
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-200">
                现在我们用同一个入口解释程序总结、CPU 状态、流水线流动、
                异常或中断行为，以及设备活动，全部基于同一份 trace 契约。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                to="/hazard-puzzle"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
              >
                冒险判断关卡
              </Link>
              <Link
                to="/traffic-control"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
              >
                流水线调度方块
              </Link>
            </div>
          </div>
        </header>

        <Panel
          title="控制区"
          description="在这里切换样例、切换讲解视角、步进、播放和跳转。"
        >
          <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),auto]">
                <label className="rounded-[22px] border border-white/10 bg-black/24 p-4">
                  <span className="text-xs tracking-[0.2em] text-slate-400">
                    内置样例
                  </span>
                  <select
                    value={selectedSampleId}
                    onChange={(event) => setSelectedSampleId(event.target.value)}
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-slate-50"
                  >
                    {sampleTraceOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
                  <p className="text-xs tracking-[0.2em] text-slate-400">视图重点</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setViewMode("interpreter")}
                      className={`rounded-2xl border px-4 py-3 text-sm ${
                        viewMode === "interpreter"
                          ? "border-cyan-300/35 bg-cyan-300/14 text-cyan-50"
                          : "border-white/10 bg-white/5 text-slate-200"
                      }`}
                    >
                      解释器
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("pipeline")}
                      className={`rounded-2xl border px-4 py-3 text-sm ${
                        viewMode === "pipeline"
                          ? "border-cyan-300/35 bg-cyan-300/14 text-cyan-50"
                          : "border-white/10 bg-white/5 text-slate-200"
                      }`}
                    >
                      流水线
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
                <p className="text-sm font-semibold text-slate-50">
                  {selectedOption.summary}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedOption.coverage.map((item) => (
                    <Tag key={item} label={item} tone="neutral" />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {topSampleIds.map((sampleId) => {
                    const option = sampleOptionById.get(sampleId);
                    return option ? (
                      <button
                        key={sampleId}
                        type="button"
                        onClick={() => setSelectedSampleId(sampleId)}
                        className={`rounded-full border px-3 py-2 text-sm ${
                          sampleId === selectedSampleId
                            ? "border-cyan-300/35 bg-cyan-300/14 text-cyan-50"
                            : "border-white/10 bg-white/5 text-slate-200"
                        }`}
                      >
                        {option.label}
                      </button>
                    ) : null;
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
              <p className="text-xs tracking-[0.2em] text-slate-400">播放控制</p>
              <div className="mt-3 flex flex-wrap gap-2">
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
                  重置
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4">
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
                    label={`步骤 ${(trace?.steps.length ?? 0) ? deferredStepIndex + 1 : 0}/${trace?.steps.length ?? 0}`}
                    tone="cyan"
                  />
                  <Tag
                    label={`停止原因 ${stopReason ?? "-"}`}
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
                  正在加载样例 trace...
                </div>
              ) : null}

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </Panel>

        {viewMode === "pipeline" ? pipelinePanel : null}

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel
            title="CPU / 指令"
            description="集中查看当前 PC、解码结果、寄存器变化和最近一次写回。"
          >
            {activeStep ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                    <Tag label="本步无写回" tone="neutral" />
                  )}
                </div>

                <div className="mt-4 rounded-[22px] border border-white/10 bg-black/24 p-4 text-sm text-slate-300">
                  {lastWriteback
                    ? `最近一次写回：第 ${lastWriteback.stepNumber} 步，r${lastWriteback.change.reg} <- ${lastWriteback.change.value}`
                    : "目前还没有发生寄存器写回。"}
                </div>
              </>
            ) : (
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                请选择样例以查看 CPU 状态。
              </div>
            )}
          </Panel>

          <Panel
            title="程序总结"
            description="统一展示运行总结，以及不同停止语义的教学解释。"
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Metric label="程序" value={trace?.meta?.program ?? selectedOption.id} />
              <Metric label="模式" value={summary?.mode ?? programMode} />
              <Metric
                label="Schema"
                value={trace?.meta?.schema_version ?? summary?.schema_version}
              />
              <Metric label="总步数" value={summary?.steps ?? trace?.steps.length} />
              <Metric label="退出码" value={summary?.exit_code} />
              <Metric label="最后指令" value={summary?.last_inst} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Tag
                label={`停止语义 ${stopReason ?? "unknown"}`}
                tone={getStopReasonTone(stopReason)}
              />
              <Tag
                label={`EXL ${summary?.exl ? "置位" : "清除"}`}
                tone={summary?.exl ? "rose" : "neutral"}
              />
              <Tag
                label={`待处理中断 ${summary?.pending_interrupt ? "有" : "无"}`}
                tone={summary?.pending_interrupt ? "amber" : "neutral"}
              />
            </div>

            {summary?.error_message ? (
              <div className="mt-4 rounded-[22px] border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
                {summary.error_message}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {stopReasonGuide.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-[22px] border p-4 ${
                    item.id === stopReason
                      ? "border-cyan-300/30 bg-cyan-300/10"
                      : "border-white/10 bg-black/24"
                  }`}
                >
                  <Tag label={item.label} tone={item.tone} />
                  <p className="mt-3 text-sm leading-6 text-slate-200">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {viewMode === "interpreter" ? pipelinePanel : null}

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel
            title="异常 / 中断"
            description="展示当前事件、锁存状态、EPC 或异常向量，以及 ERTN 返回效果。"
          >
            {activeStep ? (
              <>
                <div className="flex flex-wrap gap-2">
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

                <div className="mt-4 rounded-[22px] border border-white/10 bg-black/24 p-4 text-sm text-slate-300">
                  {getErtnSummary(activeStep)}
                </div>
              </>
            ) : (
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                请选择样例以查看异常或中断状态。
              </div>
            )}
          </Panel>

          <Panel
            title="设备 / 内存"
            description="集中展示 UART 输出、定时器快照、设备事件和最近的访存记录。"
          >
            {activeStep ? (
              <>
                <div className="grid gap-4 xl:grid-cols-[1fr,0.95fr]">
                  <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-50">
                        UART 输出窗口
                      </p>
                      <Tag
                        label={uartOutput ? `${uartOutput.length} 个字符` : "暂无输出"}
                        tone={uartOutput ? "emerald" : "neutral"}
                      />
                    </div>

                    <pre className="mt-4 min-h-[120px] overflow-x-auto rounded-2xl border border-emerald-300/14 bg-emerald-300/8 p-4 text-sm text-emerald-50">
                      {uartOutput || "（当前还没有 UART 输出）"}
                    </pre>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Metric label="timer control" value={activeStep.timer?.control} />
                      <Metric label="interval" value={activeStep.timer?.interval} />
                      <Metric label="remaining" value={activeStep.timer?.remaining} />
                      <Metric
                        label="enabled"
                        value={
                          activeStep.timer
                            ? activeStep.timer.enabled
                              ? "true"
                              : "false"
                            : "-"
                        }
                      />
                      <Metric
                        label="periodic"
                        value={
                          activeStep.timer
                            ? activeStep.timer.periodic
                              ? "true"
                              : "false"
                            : "-"
                        }
                      />
                      <Metric
                        label="irq enable"
                        value={
                          activeStep.timer
                            ? activeStep.timer.interrupt_enabled
                              ? "true"
                              : "false"
                            : "-"
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
                    <p className="text-sm font-semibold text-slate-50">最近设备事件</p>
                    <div className="mt-4 space-y-2">
                      {recentDeviceEvents.length ? (
                        recentDeviceEvents.map(({ stepNumber, item }, index) => (
                          <div
                            key={`${stepNumber}-${item.device}-${item.kind}-${index}`}
                            className="rounded-2xl border border-cyan-300/16 bg-cyan-300/8 px-4 py-3 text-sm text-slate-100"
                          >
                            <p className="font-medium text-cyan-50">
                              第 {stepNumber} 步：{item.device} {item.kind}
                            </p>
                            <p className="mt-1 text-slate-300">
                              {item.text
                                ?? item.cause
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
                    <p className="text-sm font-semibold text-slate-50">最近访存记录</p>
                    <div className="mt-4 space-y-2">
                      {recentMemoryAccesses.length ? (
                        recentMemoryAccesses.map(({ stepNumber, item }, index) => (
                          <div
                            key={`${stepNumber}-${item.kind}-${item.addr}-${index}`}
                            className="rounded-2xl border border-amber-300/16 bg-amber-300/8 px-4 py-3 text-sm text-slate-100"
                          >
                            <p className="font-medium text-amber-50">
                              第 {stepNumber} 步：{item.kind} {item.addr}
                            </p>
                            <p className="mt-1 text-slate-300">
                              值 {item.value}，宽度 {item.width}，目标 {item.target}，
                              路径 {item.via}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                          当前还没有访存记录。
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                请选择样例以查看设备和内存活动。
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
