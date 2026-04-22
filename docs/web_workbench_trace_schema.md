# Unified Web Workbench Trace Schema

## Goal

`milestone16` converges the teaching UI onto one reusable workbench instead of one-off demo pages.
The contract keeps the existing JSONL trace format and extends it incrementally with `schema_version = "workbench-v1"`.

The workbench reads trace data in four layers:

1. `meta`: run setup and sample identity
2. `step`: per-step execution state
3. `pipeline`: per-step five-stage snapshot plus hazard metadata
4. `summary`: run end semantics and final CPU state

## Functional object inventory

| Workbench object | Trace fields | Code source | Status in milestone16 |
| --- | --- | --- | --- |
| program name | `meta.program` | `main.cpp`, `utils/debug.cpp::trace_meta_jsonl` | already existed |
| mode | `meta.mode`, `meta.pipeline_mode`, `summary.mode` | `main.cpp`, `utils/debug.cpp::trace_meta_jsonl`, `trace_summary_jsonl` | `mode` added, old `pipeline_mode` kept |
| stop_reason | `summary.stop_reason` | `utils/debug.cpp::trace_summary_jsonl` | already existed |
| exit_code | `step.exit_code`, `summary.exit_code` | `utils/debug.cpp::trace_step_jsonl`, `trace_summary_jsonl` | already existed |
| last_inst | `summary.last_inst` | `utils/debug.cpp::trace_summary_jsonl` | already existed |
| PC | `step.pc`, `step.next_pc`, `summary.pc` | `utils/debug.cpp::trace_step_jsonl`, `trace_summary_jsonl` | already existed |
| register writeback | `step.gpr_changes` | `utils/debug.cpp::trace_step_jsonl` | already existed |
| current instruction/opcode | `step.raw`, `step.op`, `step.rd/rj/rk/imm` | `utils/debug.cpp::trace_step_jsonl` | already existed |
| branch result | `step.branched`, `pipeline.redirect_pc`, `pipeline.flush` | `cpu/CPU.cpp`, `utils/debug.cpp::trace_note_branch`, `trace_note_pipeline` | already existed |
| IF/ID/EX/MEM/WB | `step.pipeline.if/id/ex/mem/wb` | `cpu/CPU.cpp::step_pipeline_mode`, `trace_note_pipeline` | already existed |
| stall / bubble / flush | `step.pipeline.stall`, `stall_reason`, `bubble`, `flush` | `cpu/CPU.cpp::step_pipeline_mode`, `trace_note_pipeline` | already existed |
| forwarding | `step.pipeline.forwarding[]` | `cpu/CPU.cpp::pipeline_forward_operand`, `step_pipeline_mode` | added in milestone16 |
| load-use | `step.pipeline.load_use` | `cpu/CPU.cpp::step_pipeline_mode` | added in milestone16 |
| exception / interrupt edge | `step.exception`, `step.interrupt`, `step.cause`, `step.epc`, `step.vector`, `step.badv` | `cpu/CPU.cpp::handle_trap_exception`, interrupt path in `step()`, `trace_note_trap` | already existed |
| latched trap state | `step.trap_state.{cause,epc,vector,badv,status,exl,pending_interrupt,last_trap_was_interrupt}` | `utils/debug.cpp::trace_step_jsonl` from `CPUState` | added in milestone16 |
| summary trap state | `summary.{cause,epc,vector,badv,status,exl,pending_interrupt,last_trap_was_interrupt}` | `utils/debug.cpp::trace_summary_jsonl` | mostly existed, expanded |
| exception vector entry | `step.vector`, `step.trap_state.vector`, `summary.vector` | `CPUState.exception_vector_base`, trace writers | already existed |
| memory access | `step.memory_accesses[]` | `memory/memory.cpp`, `device/bus.cpp`, `utils/debug.cpp::trace_note_mem_access` | added in milestone16 |
| UART output | `step.uart`, `step.device_events[]` | `device/uart.cpp::trace_note_uart_char`, `utils/debug.cpp` | `uart` existed, `device_events` added |
| timer state | `step.timer` | `memory/memory.cpp::timer_snapshot`, `device/timer.cpp`, `trace_note_timer_snapshot` | added in milestone16 |
| bus/device mapping event | `meta.device_map`, `step.device_events[]` | `utils/debug.cpp::trace_meta_jsonl`, `device/bus.cpp`, `device/timer.cpp`, `device/uart.cpp` | added in milestone16 |
| halt / trap / runtime / max-steps end semantics | `summary.stop_reason`, `summary.exit_code`, `summary.error_message` | `CPUState.stop_reason`, `main.cpp`, `utils/debug.cpp::trace_summary_jsonl` | `error_message` added in milestone16 |

## Data contract

### Meta record

`meta` remains the first JSONL line.

Current fields:

- `type = "meta"`
- `schema_version`
- `program`
- `mode`
- `load_base`
- `entry_pc`
- `max_steps`
- `pipeline_mode`
- `device_map[]`

Compatibility notes:

- old traces may only have `pipeline_mode`
- the web parser infers `mode` from `pipeline_mode` when `mode` is missing

### Step record

`step` stays as the core teaching record.

Stable fields reused from older traces:

- instruction: `pc`, `raw`, `op`, `rd`, `rj`, `rk`, `imm`
- control flow: `next_pc`, `branched`
- CPU updates: `running`, `exit_code`, `gpr_changes`
- trap edge event: `exception`, `interrupt`, `cause`, `epc`, `vector`, `badv`
- legacy write/device helpers: `mem_write`, `uart`
- pipeline snapshot root: `pipeline`

Incremental additions in `workbench-v1`:

- `trap_state`
- `memory_accesses[]`
- `device_events[]`
- `timer`
- `pipeline.load_use`
- `pipeline.forwarding[]`

### Pipeline payload

When present, `step.pipeline` contains:

- `cycle`
- five stage objects: `if`, `id`, `ex`, `mem`, `wb`
- hazard flags: `stall`, `stall_reason`, `bubble[]`, `flush[]`
- redirect data: `redirect_pc`
- reuse-friendly teaching metadata: `load_use`, `forwarding[]`

The UI treats missing `pipeline` as a valid interpreter trace, not an error.

### Summary record

`summary` remains the last JSONL line.

Current fields:

- `type = "summary"`
- `schema_version`
- `mode`
- `steps`
- `pc`
- `last_inst`
- `epc`
- `vector`
- `badv`
- `cause`
- `stop_reason`
- `status`
- `exl`
- `running`
- `last_trap_was_interrupt`
- `pending_interrupt`
- `exit_code`
- `error_message`
- `regs[]`

`error_message` is only set for fatal runtime failures such as pipeline mode rejecting an unsupported instruction.

## Minimal simulator changes accepted in milestone16

The simulator boundary stayed narrow:

- added trace-only metadata for forwarding, load-use, trap state, timer snapshots, memory accesses, and device events
- added summary preservation for runtime errors in `main.cpp`
- added small built-in sample programs for trap and interrupt coverage
- added a sample trace generation script under `web/scripts/`

No CPU core rewrite, no new backend service, and no large ISA expansion were introduced for the UI.

## Backward compatibility policy

The web parser intentionally accepts older traces.

Fallback behavior:

- infer `mode` from `pipeline_mode`
- synthesize `trap_state` from legacy flat trap fields when needed
- synthesize `memory_accesses` from legacy `mem_write` when needed
- synthesize `device_events` from legacy `uart` when needed
- infer `pipeline.load_use` from `stall + raw_hazard + bubble(EX)` when missing
- synthesize a minimal `summary` from the final step if an older sample has no summary record

This keeps older viewer samples readable while allowing new workbench panels to light up when richer fields exist.

## Sample integration target

The unified workbench is expected to cover these representative traces through the same parser and components:

- `smoke`
- `uart`
- `pipeline-branch`
- `break-resume`
- `timer-interrupt`
- `invalid-unhandled`
- `smoke-max-steps`
- `pipeline-runtime-error`

Additional pipeline samples such as `pipeline-raw`, `pipeline-forward`, and `pipeline-loaduse` reuse the same schema and pipeline panel without frontend special cases.
