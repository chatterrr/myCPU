import { parseTraceJsonl } from "@/features/trace/parser";
import type { TraceDocument, TraceMode } from "@/features/trace/types";

export interface SampleTraceOption {
  id: string;
  label: string;
  path: string;
  summary: string;
  recommendedView: TraceMode;
  coverage: string[];
}

export const sampleTraceOptions: SampleTraceOption[] = [
  {
    id: "smoke",
    label: "基础冒烟 / HALT",
    path: "traces/smoke.jsonl",
    summary: "解释器基础样例，最终以 HALT 正常结束。",
    recommendedView: "interpreter",
    coverage: ["CPU", "正常结束", "寄存器写回"]
  },
  {
    id: "uart",
    label: "UART 输出",
    path: "traces/uart.jsonl",
    summary: "解释器样例，展示 UART 写入与总线路由后的设备事件。",
    recommendedView: "interpreter",
    coverage: ["设备", "UART", "总线", "正常结束"]
  },
  {
    id: "break-resume",
    label: "BREAK + ERTN",
    path: "traces/break-resume.jsonl",
    summary: "展示异常进入、处理程序执行和 ERTN 返回恢复。",
    recommendedView: "interpreter",
    coverage: ["陷入", "异常", "ERTN", "正常结束"]
  },
  {
    id: "timer-interrupt",
    label: "定时器中断",
    path: "traces/timer-interrupt.jsonl",
    summary: "展示定时器配置、中断到达、处理程序和返回恢复。",
    recommendedView: "interpreter",
    coverage: ["中断", "定时器", "设备", "ERTN", "正常结束"]
  },
  {
    id: "invalid-unhandled",
    label: "未处理异常",
    path: "traces/invalid-unhandled.jsonl",
    summary: "程序跳入异常向量后没有处理程序继续恢复，最终终止。",
    recommendedView: "interpreter",
    coverage: ["陷入", "异常", "trap 终止"]
  },
  {
    id: "smoke-max-steps",
    label: "步数耗尽",
    path: "traces/smoke-max-steps.jsonl",
    summary: "程序并未 HALT，而是因为达到最大步数上限而停止。",
    recommendedView: "interpreter",
    coverage: ["总结", "最大步数", "CPU"]
  },
  {
    id: "pipeline-raw",
    label: "流水线 RAW 相关",
    path: "traces/pipeline-raw.jsonl",
    summary: "用于讲解 RAW 依赖和等待关系的流水线样例。",
    recommendedView: "pipeline",
    coverage: ["流水线", "停顿", "相关冒险"]
  },
  {
    id: "pipeline-forward",
    label: "流水线旁路",
    path: "traces/pipeline-forward.jsonl",
    summary: "展示 MEM/WB 到 EX 的显式 forwarding 元数据。",
    recommendedView: "pipeline",
    coverage: ["流水线", "旁路", "相关冒险"]
  },
  {
    id: "pipeline-loaduse",
    label: "流水线 load-use",
    path: "traces/pipeline-loaduse.jsonl",
    summary: "展示 load-use 联锁、stall、bubble 和访存记录。",
    recommendedView: "pipeline",
    coverage: ["流水线", "停顿", "bubble", "load-use", "内存"]
  },
  {
    id: "pipeline-branch",
    label: "流水线分支改道",
    path: "traces/pipeline-branch.jsonl",
    summary: "展示 taken 分支后的 IF/ID flush 与 redirect PC。",
    recommendedView: "pipeline",
    coverage: ["流水线", "分支", "冲刷", "改道"]
  },
  {
    id: "pipeline-runtime-error",
    label: "流水线运行时错误",
    path: "traces/pipeline-runtime-error.jsonl",
    summary: "展示流水线模式遇到未支持指令时的 summary 终止语义。",
    recommendedView: "pipeline",
    coverage: ["流水线", "运行时错误", "总结"]
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
  return parseTraceJsonl(await file.text(), file.name);
}
