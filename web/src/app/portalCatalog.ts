import type { TagTone } from "@/components/Tag";
import type { PortalRouteId, SampleConceptId } from "@/features/trace/sources";

export interface PortalModuleCard {
  id: PortalRouteId | "guide";
  title: string;
  to: string;
  tone: TagTone;
  summary: string;
  detail: string;
}

export interface ConceptGuideEntry {
  id: SampleConceptId;
  label: string;
  tone: TagTone;
  summary: string;
  watchFields: string[];
  relatedRoutes: PortalRouteId[];
}

export interface IntegrationStatusItem {
  label: string;
  tone: TagTone;
  detail: string;
}

export const routeLabelById: Record<PortalRouteId, string> = {
  workbench: "工作台",
  hazard: "Hazard 互动",
  traffic: "方块调度"
};

export const routePathById: Record<PortalRouteId, string> = {
  workbench: "/",
  hazard: "/hazard-puzzle",
  traffic: "/traffic-control"
};

export const portalModuleCards: PortalModuleCard[] = [
  {
    id: "workbench",
    title: "统一工作台",
    to: "/",
    tone: "emerald",
    summary: "同一份 trace 契约驱动 CPU、trap、timer、device 和 pipeline 面板。",
    detail: "这是主路径。所有内置样例都先在这里建立共同语义，再跳向互动教学。"
  },
  {
    id: "hazard",
    title: "Hazard 教学互动",
    to: "/hazard-puzzle",
    tone: "amber",
    summary: "围绕 pipeline 样例做冒险判断题，复用同一个流水线画布。",
    detail: "关卡不再单独维护另一套数据源，而是从统一样例注册表取相关 trace。"
  },
  {
    id: "traffic",
    title: "流水线方块互动",
    to: "/traffic-control",
    tone: "cyan",
    summary: "把 forwarding、load-use、branch flush 重新组织成可玩的调度互动。",
    detail: "状态卡、方块语义和主舞台全部复用共享 pipeline 组件与代表性样例。"
  },
  {
    id: "guide",
    title: "样例说明 / 帮助",
    to: "/#sample-guide",
    tone: "rose",
    summary: "统一列出样例用途、推荐面板、关注字段与停止语义。",
    detail: "不再为单个样例造独立页面，而是由统一配置驱动说明层和概念帮助。"
  }
];

export const conceptGuideEntries: ConceptGuideEntry[] = [
  {
    id: "stop-reason",
    label: "停止语义",
    tone: "emerald",
    summary: "先判断程序是 HALT、trap termination、runtime error，还是 max-steps 收束。",
    watchFields: ["summary.stop_reason", "summary.exit_code", "summary.error_message"],
    relatedRoutes: ["workbench"]
  },
  {
    id: "trap",
    label: "异常处理",
    tone: "rose",
    summary: "关注何时进入 trap、锁存了什么 EPC / vector，以及 EXL 是否仍然置位。",
    watchFields: ["exception", "cause", "epc", "vector", "trap_state.exl"],
    relatedRoutes: ["workbench"]
  },
  {
    id: "interrupt",
    label: "中断处理",
    tone: "amber",
    summary: "中断与异常共用处理入口，但需要特别关注 pending_interrupt 和 ERTN 的返回时机。",
    watchFields: ["interrupt", "trap_state.pending_interrupt", "trap_state.last_trap_was_interrupt"],
    relatedRoutes: ["workbench"]
  },
  {
    id: "timer",
    label: "Timer 语义",
    tone: "amber",
    summary: "把 control / interval / remaining 串起来看，才能理解定时器是如何一步步走到 interrupt raise 的。",
    watchFields: ["timer.control", "timer.interval", "timer.remaining", "device_events"],
    relatedRoutes: ["workbench"]
  },
  {
    id: "device-bus",
    label: "总线与设备",
    tone: "cyan",
    summary: "总线访问说明 CPU 把数据送去了哪里，device_events 说明外设随后做了什么。",
    watchFields: ["memory_accesses", "device_events", "meta.device_map"],
    relatedRoutes: ["workbench"]
  },
  {
    id: "uart",
    label: "UART 输出",
    tone: "emerald",
    summary: "字符输出既能从 uart 累积串看，也能从 tx 事件回看每一次发射。",
    watchFields: ["uart", "device_events[].text", "memory_accesses[].target"],
    relatedRoutes: ["workbench"]
  },
  {
    id: "raw",
    label: "RAW 相关",
    tone: "amber",
    summary: "先辨认谁在等旧值，再判断该停住还是可以继续推进。",
    watchFields: ["pipeline.stall_reason", "pipeline.id", "pipeline.ex", "pipeline.mem"],
    relatedRoutes: ["workbench", "hazard"]
  },
  {
    id: "forwarding",
    label: "旁路",
    tone: "cyan",
    summary: "旁路的关键不是停拍，而是确认结果从哪个阶段直送到了 EX。",
    watchFields: ["pipeline.forwarding", "pipeline.ex", "pipeline.mem", "pipeline.wb"],
    relatedRoutes: ["workbench", "hazard", "traffic"]
  },
  {
    id: "load-use",
    label: "Load-use",
    tone: "amber",
    summary: "当 load 结果尚未可用时，要看见 stall、bubble 和后续恢复是如何接力的。",
    watchFields: ["pipeline.load_use", "pipeline.stall", "pipeline.bubble", "memory_accesses"],
    relatedRoutes: ["workbench", "hazard", "traffic"]
  },
  {
    id: "branch-flush",
    label: "分支冲刷",
    tone: "rose",
    summary: "分支改道最核心的信号是 redirect PC 和 IF/ID flush，而不是寄存器写回。",
    watchFields: ["branched", "pipeline.redirect_pc", "pipeline.flush"],
    relatedRoutes: ["workbench", "hazard", "traffic"]
  }
];

export const integrationStatusItems: IntegrationStatusItem[] = [
  {
    label: "主路径 /",
    tone: "emerald",
    detail: "统一工作台，负责样例选择、样例说明层、概念帮助和共享语义可视化。"
  },
  {
    label: "主路径 /hazard-puzzle",
    tone: "amber",
    detail: "仍在主路由内，作为统一门户下的 hazard 教学互动入口。"
  },
  {
    label: "主路径 /traffic-control",
    tone: "cyan",
    detail: "仍在主路由内，作为统一门户下的流水线方块互动入口。"
  },
  {
    label: "共享 trace 契约",
    tone: "neutral",
    detail: "sample registry、trace parser、TraceDocument、PipelineStageCanvas 继续作为三条主路径的公共底座。"
  },
  {
    label: "保留未接 UI",
    tone: "amber",
    detail: "`loadTraceFromFile()` 仍保留为未来文件导入的接口，但当前未接统一门户入口。"
  }
];
