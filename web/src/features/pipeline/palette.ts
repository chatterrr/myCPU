import type { PipelineStageKey } from "@/features/trace/types";

export const pipelineStageOrder: Array<{
  key: PipelineStageKey;
  label: string;
}> = [
  { key: "if", label: "IF" },
  { key: "id", label: "ID" },
  { key: "ex", label: "EX" },
  { key: "mem", label: "MEM" },
  { key: "wb", label: "WB" }
];

type StagePalette = {
  fill: number;
  stroke: number;
};

const paletteByState: Record<string, StagePalette> = {
  empty: { fill: 0x0f172a, stroke: 0x334155 },
  fetch: { fill: 0x0c4a6e, stroke: 0x22d3ee },
  occupied: { fill: 0x0f766e, stroke: 0x2dd4bf },
  stalled: { fill: 0x78350f, stroke: 0xf59e0b },
  flushed: { fill: 0x7f1d1d, stroke: 0xfb7185 }
};

const fallbackPalette: StagePalette = {
  fill: 0x1e293b,
  stroke: 0x94a3b8
};

export function getStagePalette(state: string): StagePalette {
  return paletteByState[state] ?? fallbackPalette;
}

