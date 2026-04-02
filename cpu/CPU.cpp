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
}

void CPU::reset(uint32_t pc_start) {
    std::memset(state_.gpr, 0, sizeof(state_.gpr));
    state_.pc = pc_start;
    state_.running = true;
    state_.last_inst = 0;
    state_.exit_code = 0;

    state_.gpr[3] = config::STACK_TOP;
    state_.gpr[0] = 0;
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