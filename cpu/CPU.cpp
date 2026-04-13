#include "CPU.h"
#include "decode.h"
#include "execute.h"
#include "memory/memory.h"

#include <cstdio>
#include <cstring>
#include <stdexcept>

#include "config/constants.h"
#include "utils/debug.h"

CPU::CPU(Memory& mem) : mem_(mem) {
    for (auto& reg : state_.gpr) reg = 0;
    state_.pc = 0;
    state_.running = false;
    state_.last_inst = 0;
    state_.exit_code = 0;
    reset_pipeline();
}

void CPU::reset(uint32_t pc_start) {
    std::memset(state_.gpr, 0, sizeof(state_.gpr));
    state_.pc = pc_start;
    state_.running = true;
    state_.last_inst = 0;
    state_.exit_code = 0;

    state_.gpr[3] = config::STACK_TOP;
    state_.gpr[0] = 0;
    reset_pipeline();
}

void CPU::reset_pipeline() {
    pipeline_ = {};
}

void CPU::advance_pipeline_skeleton(uint32_t fetched_pc, uint32_t fetched_raw) {
    PipelineState next{};
    next.cycle = pipeline_.cycle + 1;

    if (pipeline_.ex_mem.valid) {
        next.mem_wb.valid = true;
        next.mem_wb.pc = pipeline_.ex_mem.pc;
        next.mem_wb.inst = pipeline_.ex_mem.inst;
        next.mem_wb.write_value = pipeline_.ex_mem.alu_result;
    }

    if (pipeline_.id_ex.valid) {
        next.ex_mem.valid = true;
        next.ex_mem.pc = pipeline_.id_ex.pc;
        next.ex_mem.inst = pipeline_.id_ex.inst;
    }

    if (pipeline_.if_id.valid) {
        next.id_ex.valid = true;
        next.id_ex.pc = pipeline_.if_id.pc;
        next.id_ex.inst = decode(pipeline_.if_id.raw);
    }

    next.if_id.valid = true;
    next.if_id.pc = fetched_pc;
    next.if_id.raw = fetched_raw;

    pipeline_ = next;
}

void CPU::step() {
    if (!state_.running) return;

    if (state_.pc % 4 != 0) {
        throw std::runtime_error("unaligned PC");
    }

    const uint32_t pc_before = state_.pc;
    const CPUState before = state_;

    uint32_t raw = mem_.read32(state_.pc);
    state_.last_inst = raw;

    DecodedInst inst = decode(raw);
    if (inst.op == Opcode::INVALID) {
        char buf[128];
        std::snprintf(
            buf,
            sizeof(buf),
            "invalid instruction at pc=0x%08X raw=0x%08X",
            state_.pc,
            raw
        );
        throw std::runtime_error(buf);
    }

    MYCPU_TRACE(dump_inst(pc_before, raw, inst));

    trace_begin_step();

    execute(state_, inst, mem_);

    state_.gpr[0] = 0;

    trace_step_jsonl(pc_before, raw, inst, before, state_);

    // Keep pipeline stage registers advancing without changing the stable execution path yet.
    advance_pipeline_skeleton(pc_before, raw);
}

void CPU::run(uint64_t max_steps) {
    try {
        for (uint64_t i = 0; i < max_steps && state_.running; ++i) {
            step();
        }
    }
    catch (const std::runtime_error&) {
        state_.exit_code = 1;
        state_.running = false;
        throw;
    }
}

CPUState& CPU::state() { return state_; }
const CPUState& CPU::state() const { return state_; }
