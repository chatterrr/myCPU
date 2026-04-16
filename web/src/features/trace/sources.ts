import { parseTraceJsonl } from "@/features/trace/parser";
import type { TraceDocument } from "@/features/trace/types";

export interface SampleTraceOption {
  id: string;
  label: string;
  path: string;
  summary: string;
}

export const sampleTraceOptions: SampleTraceOption[] = [
  {
    id: "pipeline-raw",
    label: "RAW 链",
    path: "traces/pipeline-raw.jsonl",
    summary: "连续 RAW 依赖，适合观察谁在等数据。"
  },
  {
    id: "pipeline-forward",
    label: "旁路桥接",
    path: "traces/pipeline-forward.jsonl",
    summary: "双路旁路同时成立，EX 可以继续推进。"
  },
  {
    id: "pipeline-loaduse",
    label: "Load-use 暂停",
    path: "traces/pipeline-loaduse.jsonl",
    summary: "展示经典 load-use 暂停和 EX 空泡。"
  },
  {
    id: "pipeline-branch",
    label: "分支冲刷",
    path: "traces/pipeline-branch.jsonl",
    summary: "分支成立后，IF 和 ID 被立即冲刷。"
  }
];

export async function loadTraceFromSample(
  option: SampleTraceOption
): Promise<TraceDocument> {
  const response = await fetch(`${import.meta.env.BASE_URL}${option.path}`);

  if (!response.ok) {
    throw new Error(`Failed to load sample trace: ${option.path}`);
  }

  return parseTraceJsonl(await response.text(), option.label);
}

export async function loadTraceFromFile(file: File): Promise<TraceDocument> {
  return parseTraceJsonl(await file.text(), file.name);
}
