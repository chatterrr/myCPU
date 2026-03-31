#include "CPU.h"
#include "decode.h"
#include "execute.h"
#include "memory/memory.h"
#include <stdexcept>
#include <cstdio>
#include "config/constants.h"
#include <cstring>


CPU::CPU(Memory& mem) : mem_(mem) {
    for (auto &reg : state_.gpr) reg = 0;
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

    // 1) PC 对齐检查（可选）
    if (state_.pc % 4 != 0) throw std::runtime_error("unaligned PC");

    // 2) 取指
    uint32_t raw = mem_.read32(state_.pc);
    state_.last_inst = raw;

    // 3) 解码
    // DecodedInst inst = decode(raw);
    // if (inst.op == Opcode::INVALID) throw std::runtime_error("invalid instruction");
    DecodedInst inst = decode(raw);
    if (inst.op == Opcode::INVALID) {
        char buf[128];
        std::snprintf(buf, sizeof(buf),
            "invalid instruction at pc=0x%08X raw=0x%08X",
            state_.pc, raw);
        throw std::runtime_error(buf);
    }

    // 4) 执行（execute 内部更新 pc）
    execute(state_, inst, mem_);

    // 5) 强制 $r0=0
    state_.gpr[0] = 0;
}

void CPU::run(uint64_t max_steps) {
    try {
        for (uint64_t i = 0; i < max_steps && state_.running; ++i) {
            step();
        }
        // 可选：超步数也算异常退出
        // if (state_.running) throw std::runtime_error("max steps reached");
    } catch (const std::runtime_error& e) {
        state_.exit_code = 1;
        state_.running = false;
        throw; // 文档建议由最外层 main 捕获并打印
    }
}

CPUState& CPU::state() { return state_; }
const CPUState& CPU::state() const { return state_; }