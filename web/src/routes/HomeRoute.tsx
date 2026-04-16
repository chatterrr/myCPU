import {
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
  type ChangeEvent
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import { Panel } from "@/components/Panel";
import { Tag, type TagTone } from "@/components/Tag";
import { hazardLessonContractNotes } from "@/features/lesson_hazard/contracts";
import { PipelineStageCanvas } from "@/features/pipeline/PipelineStageCanvas";
import {
  loadTraceFromFile,
  loadTraceFromSample,
  sampleTraceOptions
} from "@/features/trace/sources";
import type { TraceDocument, TraceStepRecord } from "@/features/trace/types";
import { trafficGameContractNotes } from "@/features/traffic_game/contracts";

function clampStepIndex(
  nextIndex: number,
  trace: TraceDocument | null
): number {
  if (!trace) {
    return 0;
  }

  return Math.max(0, Math.min(nextIndex, trace.steps.length - 1));
}

function formatChangeSet(step: TraceStepRecord) {
  if (!step.gpr_changes.length) {
    return "None";
  }

  return step.gpr_changes.map((change) => `r${change.reg}=${change.value}`).join(", ");
}

function formatUnknown(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function buildEventTags(step: TraceStepRecord): Array<{
  label: string;
  tone: TagTone;
}> {
  const tags: Array<{ label: string; tone: TagTone }> = [];

  if (step.pipeline?.stall) {
    tags.push({
      label: `stall ${step.pipeline.stall_reason ?? "hazard"}`,
      tone: "amber"
    });
  }

  step.pipeline?.bubble.forEach((bubbleStage) => {
    tags.push({ label: `bubble ${bubbleStage}`, tone: "amber" });
  });

  step.pipeline?.flush.forEach((flushStage) => {
    tags.push({ label: `flush ${flushStage}`, tone: "rose" });
  });

  if (step.branched) {
    tags.push({ label: "branch taken", tone: "emerald" });
  }

  if (!tags.length) {
    tags.push({ label: "steady flow", tone: "cyan" });
  }

  return tags;
}

export function HomeRoute() {
  const [selectedSampleId, setSelectedSampleId] = useState(sampleTraceOptions[0].id);
  const [sampleRevision, setSampleRevision] = useState(0);
  const [trace, setTrace] = useState<TraceDocument | null>(null);
  const [sourceLabel, setSourceLabel] = useState(sampleTraceOptions[0].label);
  const [stepIndex, setStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const selectedSample =
      sampleTraceOptions.find((sample) => sample.id === selectedSampleId) ??
      sampleTraceOptions[0];

    async function loadSample() {
      setIsLoading(true);
      setError(null);

      try {
        const nextTrace = await loadTraceFromSample(selectedSample);

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setTrace(nextTrace);
          setSourceLabel(selectedSample.label);
          setStepIndex(0);
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

    void loadSample();

    return () => {
      cancelled = true;
    };
  }, [selectedSampleId, sampleRevision]);

  const deferredIndex = useDeferredValue(stepIndex);
  const currentStep = trace
    ? trace.steps[clampStepIndex(deferredIndex, trace)]
    : null;
  const currentTags = currentStep ? buildEventTags(currentStep) : [];

  async function onTraceUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextTrace = await loadTraceFromFile(file);
      startTransition(() => {
        setTrace(nextTrace);
        setSourceLabel(file.name);
        setStepIndex(0);
        setIsLoading(false);
      });
    } catch (loadError) {
      setError((loadError as Error).message);
      setIsLoading(false);
    }
  }

  function goToStep(nextIndex: number) {
    startTransition(() => {
      setStepIndex(clampStepIndex(nextIndex, trace));
    });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_28%),linear-gradient(180deg,_#07111b_0%,_#020617_48%,_#030712_100%)]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid gap-4 rounded-[32px] border border-cyan-400/15 bg-slate-950/65 p-6 shadow-[0_32px_90px_rgba(2,6,23,0.45)] backdrop-blur xl:grid-cols-[1.3fr,0.7fr]"
        >
          <div className="space-y-4">
            <Tag label="Milestone 8 foundation" tone="cyan" />
            <div className="space-y-3">
              <h1 className="text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">
                myCPU Pipeline Web Frontend
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
                A trace-driven frontend that keeps the pipeline viewer, the
                hazard lesson, and the new traffic-control game on one shared
                visual stack.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                Data path
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                `mycpu.exe` trace JSONL feeds the browser parser, then the Pixi
                stage renders IF / ID / EX / MEM / WB.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                Shared base
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                Hazard puzzle and traffic control both extend the same
                `TraceDocument`, stage board, and cycle inspector.
              </p>
            </div>
          </div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]"
        >
          <Link
            to="/hazard-puzzle"
            className="group rounded-[30px] border border-amber-300/20 bg-[linear-gradient(145deg,rgba(251,191,36,0.15),rgba(15,23,42,0.88))] p-6 shadow-[0_28px_80px_rgba(2,6,23,0.35)] transition hover:-translate-y-0.5 hover:border-amber-200/35 hover:shadow-[0_36px_90px_rgba(2,6,23,0.42)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Tag label="Entry 1 / Milestone 9" tone="amber" />
              <span className="text-xs uppercase tracking-[0.28em] text-amber-100/80">
                Hazard puzzle live
              </span>
            </div>

            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-50">
              Hazard Puzzle
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">
              Four short levels teach RAW, load-use, branch, and forwarding
              behavior directly on top of the five pipeline stages.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Tag label="RAW" tone="amber" />
              <Tag label="load-use" tone="amber" />
              <Tag label="branch" tone="rose" />
              <Tag label="forward" tone="cyan" />
            </div>

            <div className="mt-6 inline-flex items-center rounded-full border border-amber-200/25 bg-amber-200/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.28em] text-amber-50 transition group-hover:border-amber-100/35 group-hover:bg-amber-100/15">
              Open puzzle mode
            </div>
          </Link>

          <Link
            to="/traffic-control"
            className="group rounded-[30px] border border-cyan-300/20 bg-[linear-gradient(145deg,rgba(34,211,238,0.14),rgba(15,23,42,0.88))] p-6 shadow-[0_28px_80px_rgba(2,6,23,0.35)] transition hover:-translate-y-0.5 hover:border-cyan-200/35 hover:shadow-[0_36px_90px_rgba(2,6,23,0.42)]"
          >
            <div className="flex flex-wrap gap-2">
              <Tag label="Entry 2 / Milestone 10" tone="cyan" />
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-50">
              Pipeline Traffic Control
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              A lightweight dispatch game that turns hold, advance, and flush
              into direct player controls without changing the CPU core or the
              trace schema.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Controls
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Hold, advance, and flush become direct player actions on top
                  of the pipeline stages.
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Shared stack
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Same JSONL, same parser, same stage theme, and no CPU core
                  changes required.
                </p>
              </div>
            </div>

            <div className="mt-6 inline-flex items-center rounded-full border border-cyan-200/25 bg-cyan-200/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.28em] text-cyan-50 transition group-hover:border-cyan-100/35 group-hover:bg-cyan-100/15">
              Open traffic control
            </div>
          </Link>
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[340px,1fr]">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="space-y-6"
          >
            <Panel
              title="Trace sources"
              description="Load a checked-in sample or upload any existing pipeline JSONL file."
            >
              <div className="space-y-4">
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.28em] text-slate-400">
                    Sample trace
                  </span>
                  <select
                    value={selectedSampleId}
                    onChange={(event) => setSelectedSampleId(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                  >
                    {sampleTraceOptions.map((sample) => (
                      <option key={sample.id} value={sample.id}>
                        {sample.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => setSampleRevision((value) => value + 1)}
                  className="w-full rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/15"
                >
                  Reload sample
                </button>

                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.28em] text-slate-400">
                    Upload trace
                  </span>
                  <input
                    type="file"
                    accept=".jsonl,.txt"
                    onChange={onTraceUpload}
                    className="block w-full rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-900"
                  />
                </label>

                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                    Current source
                  </p>
                  <p className="mt-3 text-sm font-medium text-slate-100">
                    {sourceLabel}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {sampleTraceOptions.find((sample) => sample.id === selectedSampleId)
                      ?.summary ?? "Uploaded trace"}
                  </p>
                </div>
              </div>
            </Panel>

            <Panel
              title="Milestone 9 hook"
              description="Typed extension points for the hazard lesson puzzle."
            >
              <ul className="space-y-3 text-sm leading-6 text-slate-300">
                {hazardLessonContractNotes.map((note) => (
                  <li
                    key={note}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    {note}
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel
              title="Milestone 10 hook"
              description="Typed frame and action contracts for the traffic control game."
            >
              <ul className="space-y-3 text-sm leading-6 text-slate-300">
                {trafficGameContractNotes.map((note) => (
                  <li
                    key={note}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    {note}
                  </li>
                ))}
              </ul>
            </Panel>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="space-y-6"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Panel title="Program" className="bg-white/5">
                <p className="text-2xl font-semibold text-slate-50">
                  {trace?.meta?.program ?? "-"}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {trace?.meta?.pipeline_mode ? "Pipeline trace" : "Single-step trace"}
                </p>
              </Panel>
              <Panel title="Current cycle" className="bg-white/5">
                <p className="text-2xl font-semibold text-slate-50">
                  {currentStep?.pipeline?.cycle ?? "-"}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Step {currentStep?.step ?? "-"}
                </p>
              </Panel>
              <Panel title="Instruction" className="bg-white/5">
                <p className="text-2xl font-semibold text-slate-50">
                  {currentStep?.op ?? "-"}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  PC {currentStep?.pc ?? "-"}
                </p>
              </Panel>
              <Panel title="Trace length" className="bg-white/5">
                <p className="text-2xl font-semibold text-slate-50">
                  {trace?.steps.length ?? 0}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Summary exit {trace?.summary?.exit_code ?? "-"}
                </p>
              </Panel>
            </div>

            <Panel
              title="Pipeline stage"
              description="A minimum Pixi-based visualization of IF / ID / EX / MEM / WB for the selected cycle."
            >
              {isLoading ? (
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-300">
                  Loading trace...
                </div>
              ) : error ? (
                <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-8 text-center text-sm text-rose-100">
                  {error}
                </div>
              ) : currentStep ? (
                <div className="space-y-5">
                  <PipelineStageCanvas step={currentStep} />

                  <div className="flex flex-wrap gap-2">
                    {currentTags.map((tag) => (
                      <Tag key={tag.label} label={tag.label} tone={tag.tone} />
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[auto,1fr,auto] sm:items-center">
                    <button
                      type="button"
                      onClick={() => goToStep(stepIndex - 1)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                    >
                      Previous cycle
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={Math.max((trace?.steps.length ?? 1) - 1, 0)}
                      value={stepIndex}
                      onChange={(event) => goToStep(Number(event.target.value))}
                      className="w-full accent-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => goToStep(stepIndex + 1)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                    >
                      Next cycle
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-300">
                  No trace loaded yet.
                </div>
              )}
            </Panel>

            <AnimatePresence mode="wait">
              {currentStep ? (
                <motion.div
                  key={`${sourceLabel}-${currentStep.step}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.24 }}
                  className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]"
                >
                  <Panel
                    title="Cycle inspector"
                    description="Mirrors the existing trace fields without changing the JSONL schema."
                  >
                    <dl className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <dt className="text-xs uppercase tracking-[0.24em] text-slate-400">
                          Raw
                        </dt>
                        <dd className="mt-2 text-sm text-slate-100">{currentStep.raw}</dd>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <dt className="text-xs uppercase tracking-[0.24em] text-slate-400">
                          Next PC
                        </dt>
                        <dd className="mt-2 text-sm text-slate-100">
                          {currentStep.next_pc ?? "-"}
                        </dd>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <dt className="text-xs uppercase tracking-[0.24em] text-slate-400">
                          Registers
                        </dt>
                        <dd className="mt-2 text-sm text-slate-100">
                          {formatChangeSet(currentStep)}
                        </dd>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <dt className="text-xs uppercase tracking-[0.24em] text-slate-400">
                          Branch flag
                        </dt>
                        <dd className="mt-2 text-sm text-slate-100">
                          {currentStep.branched === null || currentStep.branched === undefined
                            ? "-"
                            : String(currentStep.branched)}
                        </dd>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
                        <dt className="text-xs uppercase tracking-[0.24em] text-slate-400">
                          Memory write
                        </dt>
                        <dd className="mt-2 text-sm text-slate-100">
                          {formatUnknown(currentStep.mem_write)}
                        </dd>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
                        <dt className="text-xs uppercase tracking-[0.24em] text-slate-400">
                          UART payload
                        </dt>
                        <dd className="mt-2 text-sm text-slate-100">
                          {formatUnknown(currentStep.uart)}
                        </dd>
                      </div>
                    </dl>
                  </Panel>

                  <Panel
                    title="Trace compatibility"
                    description="The browser parser accepts the same record categories as the existing Python viewer."
                  >
                    <div className="space-y-3 text-sm leading-6 text-slate-300">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        meta {"->"} program, base, entry, max steps, pipeline flag
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        step {"->"} instruction data plus optional pipeline snapshot
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        summary {"->"} final PC, last instruction, running flag, exit code
                      </div>
                    </div>
                  </Panel>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
