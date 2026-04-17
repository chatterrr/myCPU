import { startTransition, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { PipelineStageCanvas } from "@/features/pipeline/PipelineStageCanvas";
import type { PipelineTone } from "@/features/pipeline/visuals";
import {
  loadTraceFromSample,
  sampleTraceOptions
} from "@/features/trace/sources";
import type { TraceDocument } from "@/features/trace/types";

type PreviewScene = {
  id: string;
  mode: "hazard" | "traffic";
  traceSampleId: string;
  stepIndex: number;
  title: string;
  subtitle: string;
  badge: string;
  pulseTone: PipelineTone;
  stageHighlights: Array<{
    stage: "if" | "id" | "ex" | "mem" | "wb";
    label: string;
    tone: "cyan" | "amber" | "emerald" | "rose";
  }>;
  flowHints: Array<{
    fromStage: "if" | "id" | "ex" | "mem" | "wb";
    toStage: "if" | "id" | "ex" | "mem" | "wb";
    label: string;
    tone: "cyan" | "amber" | "emerald" | "rose";
    lane?: number;
  }>;
};

const sampleOptionById = new Map(
  sampleTraceOptions.map((option) => [option.id, option])
);

const homePreviewScenes: PreviewScene[] = [
  {
    id: "raw-shadow",
    mode: "hazard",
    traceSampleId: "pipeline-raw",
    stepIndex: 3,
    title: "RAW 阴影",
    subtitle: "译码段在等前面的结果落地。",
    badge: "识别依赖",
    pulseTone: "amber",
    stageHighlights: [
      { stage: "id", label: "等待", tone: "amber" },
      { stage: "ex", label: "前指令", tone: "amber" },
      { stage: "mem", label: "前指令", tone: "amber" }
    ],
    flowHints: [
      { fromStage: "mem", toStage: "id", label: "r1", tone: "amber", lane: 0 },
      { fromStage: "ex", toStage: "id", label: "r2", tone: "amber", lane: 1 }
    ]
  },
  {
    id: "forward-bridge",
    mode: "hazard",
    traceSampleId: "pipeline-forward",
    stepIndex: 5,
    title: "旁路桥接",
    subtitle: "EX 直接借道 MEM / WB。",
    badge: "看清旁路",
    pulseTone: "cyan",
    stageHighlights: [
      { stage: "ex", label: "取数", tone: "cyan" },
      { stage: "mem", label: "r4", tone: "emerald" },
      { stage: "wb", label: "r2", tone: "emerald" }
    ],
    flowHints: [
      { fromStage: "mem", toStage: "ex", label: "r4", tone: "cyan", lane: 0 },
      { fromStage: "wb", toStage: "ex", label: "r2", tone: "cyan", lane: 1 }
    ]
  },
  {
    id: "traffic-hold",
    mode: "traffic",
    traceSampleId: "pipeline-loaduse",
    stepIndex: 2,
    title: "装载停顿",
    subtitle: "结果没到，前段短暂停住。",
    badge: "停拍等待",
    pulseTone: "amber",
    stageHighlights: [
      { stage: "if", label: "排队", tone: "amber" },
      { stage: "id", label: "停住", tone: "amber" },
      { stage: "ex", label: "气泡", tone: "amber" }
    ],
    flowHints: [
      {
        fromStage: "ex",
        toStage: "id",
        label: "load 未到",
        tone: "amber",
        lane: 0
      }
    ]
  },
  {
    id: "traffic-flush",
    mode: "traffic",
    traceSampleId: "pipeline-branch",
    stepIndex: 4,
    title: "分支冲刷",
    subtitle: "前面的错误路径被整段清走。",
    badge: "红色清扫",
    pulseTone: "rose",
    stageHighlights: [
      { stage: "ex", label: "判定", tone: "rose" },
      { stage: "if", label: "清空", tone: "rose" },
      { stage: "id", label: "清空", tone: "rose" }
    ],
    flowHints: [
      { fromStage: "ex", toStage: "id", label: "flush", tone: "rose", lane: 0 },
      { fromStage: "ex", toStage: "if", label: "flush", tone: "rose", lane: 1 }
    ]
  }
];

function getScenePool(mode: "all" | "hazard" | "traffic") {
  if (mode === "all") {
    return homePreviewScenes;
  }

  return homePreviewScenes.filter((scene) => scene.mode === mode);
}

export function HomeRoute() {
  const [traceMap, setTraceMap] = useState<Record<string, TraceDocument>>({});
  const [previewMode, setPreviewMode] = useState<"all" | "hazard" | "traffic">(
    "all"
  );
  const [sceneIndex, setSceneIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadScenes() {
      setIsLoading(true);
      setError(null);

      try {
        const sampleIds = Array.from(
          new Set(homePreviewScenes.map((scene) => scene.traceSampleId))
        );

        const entries = await Promise.all(
          sampleIds.map(async (sampleId) => {
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

    void loadScenes();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSceneIndex(0);
  }, [previewMode]);

  useEffect(() => {
    const pool = getScenePool(previewMode);

    if (pool.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setSceneIndex((current) => (current + 1) % pool.length);
    }, 2400);

    return () => window.clearInterval(timer);
  }, [previewMode]);

  const scenePool = getScenePool(previewMode);
  const activeScene = scenePool[sceneIndex % scenePool.length];
  const activeTrace = activeScene ? traceMap[activeScene.traceSampleId] : null;
  const activeStep = activeScene ? activeTrace?.steps[activeScene.stepIndex] : null;
  const previousStep =
    activeScene && activeTrace && activeScene.stepIndex > 0
      ? activeTrace.steps[activeScene.stepIndex - 1]
      : null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(52,211,153,0.14),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.12),_transparent_26%),linear-gradient(180deg,_#020611_0%,_#030712_44%,_#02050e_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-[34px] border border-cyan-300/18 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(2,6,23,0.84))] p-6 shadow-[0_36px_110px_rgba(2,6,23,0.5)] backdrop-blur-xl"
        >
          <div className="grid gap-5 xl:grid-cols-[1.1fr,0.9fr] xl:items-end">
            <div className="space-y-4">
              <p className="text-sm font-medium uppercase tracking-[0.32em] text-cyan-300/88">
                LoongArch 五级流水线
              </p>
              <div className="space-y-3">
                <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl xl:text-6xl">
                  流水线可视化教学台
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-200 sm:text-lg">
                  一边看五级流水，一边练 hazard 判断和方块调度。
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[26px] border border-cyan-300/22 bg-cyan-300/10 p-4 shadow-[0_0_26px_rgba(34,211,238,0.08)]">
                <p className="text-xs uppercase tracking-[0.26em] text-cyan-100/72">
                  当前画面
                </p>
                <p className="mt-3 text-xl font-semibold text-slate-50">
                  {activeScene?.title ?? "-"}
                </p>
              </div>
              <div className="rounded-[26px] border border-emerald-300/22 bg-emerald-300/10 p-4 shadow-[0_0_26px_rgba(16,185,129,0.08)]">
                <p className="text-xs uppercase tracking-[0.26em] text-emerald-100/72">
                  演示片段
                </p>
                <p className="mt-3 text-xl font-semibold text-slate-50">
                  {activeTrace?.meta?.program ?? "-"}
                </p>
              </div>
              <div className="rounded-[26px] border border-amber-300/22 bg-amber-300/10 p-4 shadow-[0_0_26px_rgba(251,191,36,0.08)]">
                <p className="text-xs uppercase tracking-[0.26em] text-amber-100/72">
                  当前节拍
                </p>
                <p className="mt-3 text-xl font-semibold text-slate-50">
                  {activeStep?.pipeline?.cycle ?? "-"}
                </p>
              </div>
            </div>
          </div>
        </motion.header>

        <div className="grid gap-6 xl:grid-cols-[1.7fr,0.9fr]">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06 }}
            className="rounded-[34px] border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(2,6,23,0.88))] p-5 shadow-[0_36px_110px_rgba(2,6,23,0.46)] backdrop-blur-xl"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                  动态预览
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-50">
                  {activeScene?.subtitle ?? "载入中"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {scenePool.map((scene, index) => (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => setSceneIndex(index)}
                    className={`rounded-full border px-3 py-2 text-sm transition ${
                      activeScene?.id === scene.id
                        ? "border-cyan-300/50 bg-cyan-300/18 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.16)]"
                        : "border-white/12 bg-black/26 text-slate-200 hover:border-white/24 hover:bg-white/10"
                    }`}
                  >
                    {scene.title}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="rounded-[28px] border border-white/12 bg-black/26 p-10 text-center text-sm text-slate-200">
                正在载入预览……
              </div>
            ) : error ? (
              <div className="rounded-[28px] border border-rose-400/24 bg-rose-400/10 p-10 text-center text-sm text-rose-100">
                {error}
              </div>
            ) : activeStep ? (
              <PipelineStageCanvas
                step={activeStep}
                previousStep={previousStep}
                stageHighlights={activeScene.stageHighlights}
                flowHints={activeScene.flowHints}
                snapshotLabel="首页预览"
                badgeLabel={activeScene.badge}
                pulseTone={activeScene.pulseTone}
                hazardLabel={activeScene.mode === "hazard" ? "讲解模式" : "调度模式"}
                showRegisters={false}
              />
            ) : (
              <div className="rounded-[28px] border border-white/12 bg-black/26 p-10 text-center text-sm text-slate-200">
                当前没有可用画面。
              </div>
            )}
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="grid gap-5"
          >
            <Link
              to="/hazard-puzzle"
              onMouseEnter={() => setPreviewMode("hazard")}
              onMouseLeave={() => setPreviewMode("all")}
              className="group rounded-[34px] border border-amber-300/26 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_28%),linear-gradient(145deg,rgba(120,53,15,0.36),rgba(15,23,42,0.94))] p-6 shadow-[0_34px_96px_rgba(2,6,23,0.42)] transition duration-200 hover:-translate-y-1 hover:border-amber-200/50 hover:shadow-[0_40px_110px_rgba(2,6,23,0.5)]"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="rounded-full border border-amber-300/36 bg-amber-300/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-amber-50">
                  模式一
                </span>
                <span className="text-xs uppercase tracking-[0.28em] text-amber-100/82">
                  讲解 / 关卡
                </span>
              </div>

                <h2 className="mt-6 text-3xl font-semibold tracking-tight text-slate-50">
                  Hazard 判断
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-100">
                  看哪一级在等数据，判断该停、该旁路，还是该冲刷。
                </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {["RAW", "旁路", "停顿", "冲刷"].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-amber-200/24 bg-amber-200/10 px-3 py-1.5 text-sm text-amber-50"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-7 inline-flex items-center rounded-full border border-amber-200/28 bg-amber-200/12 px-4 py-2 text-sm font-medium text-amber-50 transition group-hover:border-amber-100/50 group-hover:bg-amber-100/20">
                进入判断
              </div>
            </Link>

            <Link
              to="/traffic-control"
              onMouseEnter={() => setPreviewMode("traffic")}
              onMouseLeave={() => setPreviewMode("all")}
              className="group rounded-[34px] border border-cyan-300/28 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(251,113,133,0.12),transparent_24%),linear-gradient(145deg,rgba(8,47,73,0.46),rgba(15,23,42,0.96))] p-6 shadow-[0_38px_110px_rgba(2,6,23,0.48)] transition duration-200 hover:-translate-y-1 hover:border-cyan-200/56 hover:shadow-[0_44px_120px_rgba(2,6,23,0.54)]"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="rounded-full border border-cyan-300/40 bg-cyan-300/16 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-50">
                  模式二
                </span>
                <span className="text-xs uppercase tracking-[0.28em] text-cyan-100/84">
                  下落 / 调度
                </span>
              </div>

              <h2 className="mt-6 text-3xl font-semibold tracking-tight text-slate-50">
                流水线方块调度
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-100">
                把指令块堆进主舞台，右侧同步看 stall、旁路、气泡和 flush。
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {["下落", "旁路", "停顿", "冲刷"].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-cyan-200/24 bg-cyan-200/10 px-3 py-1.5 text-sm text-cyan-50"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-7 inline-flex items-center rounded-full border border-cyan-200/30 bg-cyan-200/12 px-4 py-2 text-sm font-medium text-cyan-50 transition group-hover:border-cyan-100/52 group-hover:bg-cyan-100/22">
                进入调度
              </div>
            </Link>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
