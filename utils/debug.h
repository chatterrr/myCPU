#pragma once

#include <cstdint>
#include <iosfwd>
#include <string>

#include "cpu/isa.h"

void dump_regs(const CPUState& cpu);
void dump_inst(uint32_t pc, uint32_t raw, const DecodedInst& inst);
const char* opcode_to_string(Opcode op);

// ---------- trace pipeline ----------
void set_trace_stream(std::ostream* os);
void clear_trace_stream();
bool trace_enabled();

void trace_begin_step();
void trace_note_branch(bool taken);
void trace_note_mem_write(uint32_t addr, uint32_t value);
void trace_note_uart_char(uint8_t ch);

void trace_meta_jsonl(
    const std::string& program_name,
    uint32_t load_base,
    uint32_t entry_pc,
    uint64_t max_steps);

void trace_step_jsonl(
    uint32_t pc_before,
    uint32_t raw,
    const DecodedInst& inst,
    const CPUState& before,
    const CPUState& after);

void trace_summary_jsonl(const CPUState& cpu);

#ifdef DEBUG_TRACE
#define MYCPU_TRACE(stmt) do { stmt; } while (0)
#else
#define MYCPU_TRACE(stmt) do { } while (0)
#endif