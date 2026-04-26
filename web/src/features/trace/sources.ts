import type { TagTone } from "@/components/Tag";
import { parseTraceJsonl } from "@/features/trace/parser";
import type { TraceDocument, TraceMode } from "@/features/trace/types";

export type PortalRouteId = "workbench" | "hazard" | "traffic";
export type SampleConceptId =
  | "stop-reason"
  | "trap"
  | "interrupt"
  | "timer"
  | "device-bus"
  | "uart"
  | "raw"
  | "forwarding"
  | "load-use"
  | "branch-flush";
export type SampleStopKind =
  | "halt_instruction"
  | "trap_terminated"
  | "runtime_error"
  | "max_steps_reached";
export type HomeSurfaceId = "execution" | "pipeline" | "device";

export interface SampleTraceOption {
  id: string;
  label: string;
  path: string;
  summary: string;
  recommendedView: TraceMode;
  coverage: string[];
  featured: boolean;
  portalTags: Array<{ label: string; tone: TagTone }>;
  teachingGoal: string;
  recommendedPanels: string[];
  recommendedFields: string[];
  conceptIds: SampleConceptId[];
  relatedRoutes: PortalRouteId[];
  stopKinds: SampleStopKind[];
  homeSurface: HomeSurfaceId;
  pipelineSupport: "full" | "interpreter-only";
}

export const sampleTraceOptions: SampleTraceOption[] = [
  {
    id: "smoke",
    label: "基础冒烟 / HALT",
    path: "traces/smoke.jsonl",
    summary: "解释器基础样例，最终以 HALT 正常结束。",
    recommendedView: "interpreter",
    coverage: ["CPU", "正常结束", "寄存器写回"],
    featured: true,
    portalTags: [
      { label: "解释器", tone: "neutral" },
      { label: "HALT", tone: "emerald" },
      { label: "基础样例", tone: "cyan" }
    ],
    teachingGoal: "用最短路径看清 HALT 正常结束时，CPU、寄存器写回和 summary 是如何对齐的。",
    recommendedPanels: ["CPU / 指令", "程序总结"],
    recommendedFields: ["summary.stop_reason", "summary.exit_code", "gpr_changes"],
    conceptIds: ["stop-reason"],
    relatedRoutes: ["workbench"],
    stopKinds: ["halt_instruction"],
    homeSurface: "execution",
    pipelineSupport: "interpreter-only"
  },
  {
    id: "uart",
    label: "UART 输出",
    path: "traces/uart.jsonl",
    summary: "解释器样例，展示 UART 写入与总线路由后的设备事件。",
    recommendedView: "interpreter",
    coverage: ["设备", "UART", "总线", "正常结束"],
    featured: true,
    portalTags: [
      { label: "解释器", tone: "neutral" },
      { label: "UART", tone: "emerald" },
      { label: "总线", tone: "cyan" }
    ],
    teachingGoal: "把总线写 UART、设备事件和字符输出窗口三层关系放到同一处看清。",
    recommendedPanels: ["设备 / 总线 / 内存", "程序总结"],
    recommendedFields: ["uart", "device_events", "memory_accesses", "meta.device_map"],
    conceptIds: ["device-bus", "uart", "stop-reason"],
    relatedRoutes: ["workbench"],
    stopKinds: ["halt_instruction"],
    homeSurface: "device",
    pipelineSupport: "interpreter-only"
  },
  {
    id: "break-resume",
    label: "BREAK + ERTN",
    path: "traces/break-resume.jsonl",
    summary: "展示异常进入、处理程序执行和 ERTN 返回恢复。",
    recommendedView: "interpreter",
    coverage: ["陷入", "异常", "ERTN", "正常结束"],
    featured: false,
    portalTags: [
      { label: "异常", tone: "rose" },
      { label: "ERTN", tone: "emerald" },
      { label: "解释器", tone: "neutral" }
    ],
    teachingGoal: "观察 BREAK 如何进入异常向量，又如何靠 ERTN 返回到 EPC 指向的位置。",
    recommendedPanels: ["异常 / 中断", "程序总结"],
    recommendedFields: ["exception", "cause", "epc", "vector", "trap_state.exl", "next_pc"],
    conceptIds: ["trap", "stop-reason"],
    relatedRoutes: ["workbench"],
    stopKinds: ["halt_instruction"],
    homeSurface: "execution",
    pipelineSupport: "interpreter-only"
  },
  {
    id: "timer-interrupt",
    label: "定时器中断",
    path: "traces/timer-interrupt.jsonl",
    summary: "展示定时器配置、中断到达、处理程序和返回恢复。",
    recommendedView: "interpreter",
    coverage: ["中断", "定时器", "设备", "ERTN", "正常结束"],
    featured: true,
    portalTags: [
      { label: "中断", tone: "amber" },
      { label: "Timer", tone: "amber" },
      { label: "设备", tone: "cyan" }
    ],
    teachingGoal: "把 control、interval、remaining、中断置起和 ERTN 返回串成一条完整的中断处理链。",
    recommendedPanels: ["异常 / 中断", "设备 / 总线 / 内存", "程序总结"],
    recommendedFields: [
      "timer.control",
      "timer.interval",
      "timer.remaining",
      "device_events",
      "trap_state.pending_interrupt",
      "trap_state.exl"
    ],
    conceptIds: ["interrupt", "timer", "device-bus"],
    relatedRoutes: ["workbench"],
    stopKinds: ["halt_instruction"],
    homeSurface: "execution",
    pipelineSupport: "interpreter-only"
  },
  {
    id: "invalid-unhandled",
    label: "未处理异常",
    path: "traces/invalid-unhandled.jsonl",
    summary: "程序跳入异常向量后没有处理程序继续恢复，最终终止。",
    recommendedView: "interpreter",
    coverage: ["陷入", "异常", "trap 终止"],
    featured: true,
    portalTags: [
      { label: "异常", tone: "rose" },
      { label: "trap termination", tone: "rose" },
      { label: "解释器", tone: "neutral" }
    ],
    teachingGoal: "对照正常 BREAK + ERTN，理解没有 handler 恢复时为什么会停在 trap 终止态。",
    recommendedPanels: ["异常 / 中断", "程序总结"],
    recommendedFields: ["cause", "vector", "summary.stop_reason", "summary.exl", "summary.exit_code"],
    conceptIds: ["trap", "stop-reason"],
    relatedRoutes: ["workbench"],
    stopKinds: ["trap_terminated"],
    homeSurface: "execution",
    pipelineSupport: "interpreter-only"
  },
  {
    id: "smoke-max-steps",
    label: "步数耗尽",
    path: "traces/smoke-max-steps.jsonl",
    summary: "程序并未 HALT，而是因为达到最大步数上限而停止。",
    recommendedView: "interpreter",
    coverage: ["总结", "最大步数", "CPU"],
    featured: false,
    portalTags: [
      { label: "总结", tone: "cyan" },
      { label: "max-steps", tone: "amber" },
      { label: "解释器", tone: "neutral" }
    ],
    teachingGoal: "区分“程序自然停机”和“观测预算耗尽”两种完全不同的停止语义。",
    recommendedPanels: ["程序总结", "CPU / 指令"],
    recommendedFields: ["summary.stop_reason", "summary.steps", "running", "exit_code"],
    conceptIds: ["stop-reason"],
    relatedRoutes: ["workbench"],
    stopKinds: ["max_steps_reached"],
    homeSurface: "execution",
    pipelineSupport: "interpreter-only"
  },
  {
    id: "pipeline-raw",
    label: "流水线 RAW 相关",
    path: "traces/pipeline-raw.jsonl",
    summary: "用于讲解 RAW 依赖和等待关系的流水线样例。",
    recommendedView: "pipeline",
    coverage: ["流水线", "停顿", "相关冒险"],
    featured: false,
    portalTags: [
      { label: "Pipeline", tone: "cyan" },
      { label: "RAW", tone: "amber" },
      { label: "Hazard", tone: "amber" }
    ],
    teachingGoal: "先辨认谁在等待旧值，再把 RAW 依赖映射到 IF/ID/EX/MEM/WB 的具体位置。",
    recommendedPanels: ["流水线", "CPU / 指令"],
    recommendedFields: ["pipeline.stall_reason", "pipeline.id", "pipeline.ex", "pipeline.mem"],
    conceptIds: ["raw"],
    relatedRoutes: ["workbench", "hazard"],
    stopKinds: ["halt_instruction"],
    homeSurface: "pipeline",
    pipelineSupport: "full"
  },
  {
    id: "pipeline-forward",
    label: "流水线旁路",
    path: "traces/pipeline-forward.jsonl",
    summary: "展示 MEM/WB 到 EX 的显式 forwarding 元数据。",
    recommendedView: "pipeline",
    coverage: ["流水线", "旁路", "相关冒险"],
    featured: false,
    portalTags: [
      { label: "Pipeline", tone: "cyan" },
      { label: "旁路", tone: "cyan" },
      { label: "Hazard", tone: "amber" }
    ],
    teachingGoal: "确认结果并没有写回到寄存器，而是沿着 forwarding 路径直接送到执行段。",
    recommendedPanels: ["流水线", "CPU / 指令"],
    recommendedFields: ["pipeline.forwarding", "pipeline.ex", "pipeline.mem", "pipeline.wb"],
    conceptIds: ["forwarding"],
    relatedRoutes: ["workbench", "hazard", "traffic"],
    stopKinds: ["halt_instruction"],
    homeSurface: "pipeline",
    pipelineSupport: "full"
  },
  {
    id: "pipeline-loaduse",
    label: "流水线 load-use",
    path: "traces/pipeline-loaduse.jsonl",
    summary: "展示 load-use 联锁、stall、bubble 和访存记录。",
    recommendedView: "pipeline",
    coverage: ["流水线", "停顿", "bubble", "load-use", "内存"],
    featured: false,
    portalTags: [
      { label: "Pipeline", tone: "cyan" },
      { label: "Load-use", tone: "amber" },
      { label: "访存", tone: "emerald" }
    ],
    teachingGoal: "把 load 结果尚未可用这一事实，同 stall、bubble 和访存记录结合起来看。",
    recommendedPanels: ["流水线", "设备 / 总线 / 内存"],
    recommendedFields: ["pipeline.load_use", "pipeline.stall", "pipeline.bubble", "memory_accesses"],
    conceptIds: ["load-use"],
    relatedRoutes: ["workbench", "hazard", "traffic"],
    stopKinds: ["halt_instruction"],
    homeSurface: "pipeline",
    pipelineSupport: "full"
  },
  {
    id: "pipeline-branch",
    label: "流水线分支改道",
    path: "traces/pipeline-branch.jsonl",
    summary: "展示 taken 分支后的 IF/ID flush 与 redirect PC。",
    recommendedView: "pipeline",
    coverage: ["流水线", "分支", "冲刷", "改道"],
    featured: true,
    portalTags: [
      { label: "Pipeline", tone: "cyan" },
      { label: "分支", tone: "rose" },
      { label: "冲刷", tone: "rose" }
    ],
    teachingGoal: "把分支成立、redirect PC 和 IF/ID flush 串成同一拍内的控制流改道语义。",
    recommendedPanels: ["流水线", "CPU / 指令"],
    recommendedFields: ["branched", "pipeline.redirect_pc", "pipeline.flush"],
    conceptIds: ["branch-flush"],
    relatedRoutes: ["workbench", "hazard", "traffic"],
    stopKinds: ["halt_instruction"],
    homeSurface: "pipeline",
    pipelineSupport: "full"
  },
  {
    id: "pipeline-runtime-error",
    label: "流水线运行时错误",
    path: "traces/pipeline-runtime-error.jsonl",
    summary: "展示流水线模式遇到未支持指令时的 summary 终止语义。",
    recommendedView: "pipeline",
    coverage: ["流水线", "运行时错误", "总结"],
    featured: false,
    portalTags: [
      { label: "Pipeline", tone: "cyan" },
      { label: "runtime error", tone: "amber" },
      { label: "总结", tone: "rose" }
    ],
    teachingGoal: "观察 pipeline 模式拒绝某条指令时，summary 如何明确给出 runtime_error 语义。",
    recommendedPanels: ["程序总结", "流水线"],
    recommendedFields: ["summary.stop_reason", "summary.error_message", "summary.last_inst"],
    conceptIds: ["stop-reason"],
    relatedRoutes: ["workbench"],
    stopKinds: ["runtime_error"],
    homeSurface: "pipeline",
    pipelineSupport: "full"
  }
];

export async function loadTraceFromSample(
  option: SampleTraceOption
): Promise<TraceDocument> {
  const response = await fetch(`${import.meta.env.BASE_URL}${option.path}`);

  if (!response.ok) {
    throw new Error(`加载样例 trace 失败：${option.path}`);
  }

  return parseTraceJsonl(await response.text(), option.label);
}

export async function loadTraceFromFile(file: File): Promise<TraceDocument> {
  // 预留给未来的本地文件导入入口；当前统一门户尚未开放这个 UI。
  return parseTraceJsonl(await file.text(), file.name);
}
