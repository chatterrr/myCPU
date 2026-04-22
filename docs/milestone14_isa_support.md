# Milestone15 ISA Support And Runtime Notes

This note keeps the interpreter reference path, the teaching pipeline subset,
and the runtime stop semantics separate on purpose.

## Program end semantics

Built-in demo programs now end with a simulator-only `HALT` word.
That gives the CLI a stable, easy-to-explain stop condition without introducing
an OS, loader, or syscall ABI.

- `reason=halt_instruction`: normal program completion
- `reason=trap_terminated`: an exception or interrupt was taken, but the
  exception vector was empty, so execution stopped instead of falling into the
  zero-filled region
- `reason=max_steps_reached`: the host-side step budget was exhausted before a
  normal halt or trap termination happened
- `reason=runtime_error`: host-side execution failed, for example when pipeline
  teaching mode rejects an interpreter-only instruction

The exception vector is still available for teaching trap handling. If a handler
is loaded at `0x00000080`, the CPU will enter the handler instead of stopping.

## Which programs halt naturally

The built-in demo programs intended for CLI or course demonstration now halt
naturally:

- `smoke`
- `arith`
- `logic`
- `mem`
- `branch`
- `r0`
- `slt`
- `lu12i`
- `uart`
- `pipeline-nohaz`
- `pipeline-raw`
- `pipeline-forward`
- `pipeline-loaduse`
- `pipeline-branch`

Small unit-test programs that intentionally exercise traps, partial traces, or
resume flows may still use an explicit step budget instead of `HALT`.

## Interpreter / single-cycle support

The reference execute path is `cpu/execute.cpp`.

Implemented and independently validated instruction groups:

- Arithmetic and compare:
  `ADD_W`, `SUB_W`, `ADDI_W`, `SLT`, `SLTU`, `SLTI`, `SLTUI`
- Logic:
  `AND`, `OR`, `XOR`, `NOR`, `ANDI`, `ORI`, `XORI`
- Shift:
  `SLL_W`, `SRL_W`, `SRA_W`, `SLLI_W`, `SRLI_W`, `SRAI_W`
- Memory:
  `LD_W`, `ST_W`, `LD_B`, `LD_H`, `ST_B`, `ST_H`, `LD_BU`, `LD_HU`
- Control flow:
  `B`, `BEQ`, `BNE`, `BLT`, `BGE`, `BLTU`, `BGEU`, `BL`, `JIRL`
- Special:
  `LU12I_W`, `PCADDU12I`, `BREAK`, `SYSCALL`, `ERTN`

## Five-stage pipeline teaching support

The pipeline teaching subset is intentionally narrower than the interpreter
path. The support gate lives in `cpu/CPU.cpp` (`pipeline_supported`).

Code-enabled and instruction-level validated pipeline subset:

- `ADD_W`
- `SUB_W`
- `ADDI_W`
- `LD_W`
- `B`
- `BEQ`
- `BNE`
- `BLT`
- `BGE`
- `BLTU`
- `BGEU`
- `ERTN`
- simulator-only `HALT` for demo termination

Pipeline validation now includes:

- no-hazard execution
- RAW hazard handling
- forwarding
- load-use stall / bubble insertion
- branch flush / redirect behavior
- dedicated instruction-level regressions for `BNE`, `BLT`, `BGE`, `BLTU`,
  and `BGEU`

Everything else remains interpreter-only, even if it is declared, decoded,
executed, and visible in trace output.

## Recommended course demos

Stable built-in programs for milestone15 demos:

- baseline interpreter run:
  `.\build\Release\mycpu.exe --use-program smoke --dump-regs`
- signed / unsigned compare run:
  `.\build\Release\mycpu.exe --use-program slt --dump-regs`
- UART run:
  `.\build\Release\mycpu.exe --use-program uart`
- pipeline branch trace:
  `.\build\Release\mycpu.exe --pipeline --use-program pipeline-branch --trace .\build\pipeline-branch.jsonl`

When a fixed budget is still useful for debugging, `--max-steps` remains
available, but it is no longer required just to let the built-in demos finish.
