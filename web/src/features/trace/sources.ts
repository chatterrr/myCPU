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
    label: "RAW chain",
    path: "traces/pipeline-raw.jsonl",
    summary: "Shows a tight RAW dependency chain before the pipeline reacts."
  },
  {
    id: "pipeline-forward",
    label: "Forward bridge",
    path: "traces/pipeline-forward.jsonl",
    summary: "Shows dual forwarding paths that keep SUB_W moving in EX."
  },
  {
    id: "pipeline-loaduse",
    label: "Load-use stall",
    path: "traces/pipeline-loaduse.jsonl",
    summary: "Shows the classic RAW stall and inserted EX bubble."
  },
  {
    id: "pipeline-branch",
    label: "Branch flush",
    path: "traces/pipeline-branch.jsonl",
    summary: "Shows IF and ID flush behavior after a taken branch."
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
