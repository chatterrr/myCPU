#include "CPU.h"
#include "decode.h"
#include "execute.h"
#include "memory/memory.h"

#include <cstdio>
#include <cstring>
#include <stdexcept>

#include "config/constants.h"
#include "utils/debug.h"

namespace {

    std::runtime_error make_invalid_instruction_error(uint32_t pc, uint32_t raw) {
        char buf[128];
        std::snprintf(
            buf,
            sizeof(buf),
            "invalid instruction at pc=0x%08X raw=0x%08X",
            pc,
            raw
        );
        return std::runtime_error(buf);
    }

    bool pipeline_supported(const DecodedInst& inst) {
        switch (inst.op) {
        case Opcode::ADD_W:
        case Opcode::SUB_W:
        case Opcode::ADDI_W:
            return true;
        default:
            return false;
        }
    }

    bool pipeline_writes_back(const DecodedInst& inst) {
        switch (inst.op) {
        case Opcode::ADD_W:
        case Opcode::SUB_W:
        case Opcode::ADDI_W:
            return inst.rd != 0;
        default:
            return false;
        }
    }

    bool pipeline_reads_rj(const DecodedInst& inst) {
        switch (inst.op) {
        case Opcode::ADD_W:
        case Opcode::SUB_W:
        case Opcode::ADDI_W:
            return true;
        default:
            return false;
        }
    }

    bool pipeline_reads_rk(const DecodedInst& inst) {
        switch (inst.op) {
        case Opcode::ADD_W:
        case Opcode::SUB_W:
            return true;
        default:
            return false;
        }
    }

    bool pipeline_has_raw_hazard(const DecodedInst& consumer, const DecodedInst& producer) {
        if (!pipeline_writes_back(producer)) {
            return false;
        }

        const uint32_t pending_rd = producer.rd;
        if (pending_rd == 0) {
            return false;
        }

        if (pipeline_reads_rj(consumer) && consumer.rj == pending_rd) {
            return true;
        }
        if (pipeline_reads_rk(consumer) && consumer.rk == pending_rd) {
            return true;
        }
        return false;
    }

    uint32_t pipeline_execute_alu(const PipelineIDEX& stage) {
        switch (stage.inst.op) {
        case Opcode::ADD_W:
            return stage.src1_value + stage.src2_value;
        case Opcode::SUB_W:
            return stage.src1_value - stage.src2_value;
        case Opcode::ADDI_W:
            return stage.src1_value + static_cast<uint32_t>(stage.inst.imm);
        default:
            throw std::runtime_error("unsupported instruction reached pipeline EX stage");
        }
    }

}  // namespace

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

void CPU::set_pipeline_mode(bool enabled) {
    pipeline_mode_ = enabled;
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
    if (pipeline_mode_) {
        step_pipeline_mode();
        return;
    }

    step_single_cycle();
}

void CPU::step_single_cycle() {
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
        throw make_invalid_instruction_error(state_.pc, raw);
    }

    MYCPU_TRACE(dump_inst(pc_before, raw, inst));

    trace_begin_step();

    execute(state_, inst, mem_);

    state_.gpr[0] = 0;

    trace_step_jsonl(pc_before, raw, inst, before, state_);

    // Keep pipeline stage registers advancing without changing the stable execution path yet.
    advance_pipeline_skeleton(pc_before, raw);
}

void CPU::step_pipeline_mode() {
    if (!state_.running) return;

    if (state_.pc % 4 != 0) {
        throw std::runtime_error("unaligned PC");
    }

    if (pipeline_.mem_wb.valid) {
        if (pipeline_writes_back(pipeline_.mem_wb.inst)) {
            state_.gpr[pipeline_.mem_wb.inst.rd] = pipeline_.mem_wb.write_value;
        }
        state_.last_inst = pipeline_.mem_wb.inst.raw;
    }

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
        next.ex_mem.alu_result = pipeline_execute_alu(pipeline_.id_ex);
    }

    bool stall_for_raw_hazard = false;

    if (pipeline_.if_id.valid) {
        DecodedInst decoded = decode(pipeline_.if_id.raw);
        if (decoded.op == Opcode::INVALID) {
            throw make_invalid_instruction_error(pipeline_.if_id.pc, pipeline_.if_id.raw);
        }
        if (!pipeline_supported(decoded)) {
            char buf[160];
            std::snprintf(
                buf,
                sizeof(buf),
                "pipeline mode currently supports only ADD_W/SUB_W/ADDI_W, got %s at pc=0x%08X",
                opcode_to_string(decoded.op),
                pipeline_.if_id.pc
            );
            throw std::runtime_error(buf);
        }

        stall_for_raw_hazard =
            (pipeline_.id_ex.valid && pipeline_has_raw_hazard(decoded, pipeline_.id_ex.inst))
            || (pipeline_.ex_mem.valid && pipeline_has_raw_hazard(decoded, pipeline_.ex_mem.inst));

        if (!stall_for_raw_hazard) {
            next.id_ex.valid = true;
            next.id_ex.pc = pipeline_.if_id.pc;
            next.id_ex.inst = decoded;
            next.id_ex.src1_value = state_.gpr[decoded.rj];
            next.id_ex.src2_value = state_.gpr[decoded.rk];
        }
    }

    if (stall_for_raw_hazard) {
        next.if_id = pipeline_.if_id;
    }
    else {
        const uint32_t fetched_pc = state_.pc;
        const uint32_t fetched_raw = mem_.read32(fetched_pc);
        next.if_id.valid = true;
        next.if_id.pc = fetched_pc;
        next.if_id.raw = fetched_raw;

        state_.pc = fetched_pc + 4;
    }

    state_.gpr[0] = 0;
    pipeline_ = next;
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
