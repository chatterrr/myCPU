# Milestone14 ISA Support Notes

This note keeps the two support surfaces separate on purpose.

## Interpreter / single-cycle support

The reference execute path is `cpu/execute.cpp`.

Implemented instruction set:

- Arithmetic and compare: `ADD_W`, `SUB_W`, `ADDI_W`, `SLT`, `SLTU`, `SLTI`, `SLTUI`
- Logic: `AND`, `OR`, `XOR`, `NOR`, `ANDI`, `ORI`, `XORI`
- Shift: `SLL_W`, `SRL_W`, `SRA_W`, `SLLI_W`, `SRLI_W`, `SRAI_W`
- Memory: `LD_W`, `ST_W`, `LD_B`, `LD_H`, `ST_B`, `ST_H`, `LD_BU`, `LD_HU`
- Control flow: `B`, `BEQ`, `BNE`, `BLT`, `BGE`, `BLTU`, `BGEU`, `BL`, `JIRL`
- Special: `LU12I_W`, `PCADDU12I`, `BREAK`, `SYSCALL`, `ERTN`

Milestone14 test focus validates the course-facing baseline directly:

- Arithmetic: `ADD_W`, `SUB_W`, `ADDI_W`, `SLT`, `SLTU`
- Logic: `AND`, `OR`, `XOR`, `NOR`
- Shift: `SLLI_W`, `SRLI_W`, `SRAI_W`
- Memory: `LD_W`, `ST_W`
- Branch and jump: `B`, `BEQ`, `BNE`, `BLT`, `BGE`, `BLTU`, `BGEU`, `BL`, `JIRL`
- Special: `LU12I_W`, `PCADDU12I`, `BREAK`, `SYSCALL`, `ERTN`

Still implemented but not independently validated in milestone14:

- `SLL_W`, `SRL_W`, `SRA_W`
- `SLTI`, `SLTUI`
- `ANDI`, `ORI`, `XORI`
- `LD_B`, `LD_H`, `ST_B`, `ST_H`, `LD_BU`, `LD_HU`

## Five-stage pipeline teaching support

The pipeline teaching subset is intentionally narrower than the interpreter path.
The support gate lives in `cpu/CPU.cpp` (`pipeline_supported`).

Code-enabled pipeline subset:

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

Direct milestone14 pipeline regression coverage:

- `ADD_W`
- `SUB_W`
- `ADDI_W`
- `LD_W`
- `B`
- `BEQ`
- `ERTN`
- hazard handling, forwarding, load-use stall, and branch flush behavior

Code-enabled but still lacking an instruction-specific pipeline regression:

- `BNE`
- `BLT`
- `BGE`
- `BLTU`
- `BGEU`

Everything else currently remains interpreter-only, even if it is declared,
decoded, executed, and visible in trace output.
