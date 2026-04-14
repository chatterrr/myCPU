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
        case Opcode::LD_W:
        case Opcode::B:
        case Opcode::BEQ:
        case Opcode::BNE:
        case Opcode::BLT:
        case Opcode::BGE:
        case Opcode::BLTU:
        case Opcode::BGEU:
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
        case Opcode::LD_W:
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
        case Opcode::LD_W:
        case Opcode::BEQ:
        case Opcode::BNE:
        case Opcode::BLT:
        case Opcode::BGE:
        case Opcode::BLTU:
        case Opcode::BGEU:
            return true;
        default:
            return false;
        }
    }

    bool pipeline_reads_rk(const DecodedInst& inst) {
        switch (inst.op) {
        case Opcode::ADD_W:
        case Opcode::SUB_W:
        case Opcode::BEQ:
        case Opcode::BNE:
        case Opcode::BLT:
        case Opcode::BGE:
        case Opcode::BLTU:
        case Opcode::BGEU:
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

    bool pipeline_can_forward_ex_mem_result(const DecodedInst& inst) {
        switch (inst.op) {
        case Opcode::ADD_W:
        case Opcode::SUB_W:
        case Opcode::ADDI_W:
            return inst.rd != 0;
        default:
            return false;
        }
    }

    bool pipeline_can_forward_mem_wb_result(const DecodedInst& inst) {
        return pipeline_writes_back(inst);
    }

    bool pipeline_is_control_flow(const DecodedInst& inst) {
        switch (inst.op) {
        case Opcode::B:
        case Opcode::BEQ:
        case Opcode::BNE:
        case Opcode::BLT:
        case Opcode::BGE:
        case Opcode::BLTU:
        case Opcode::BGEU:
            return true;
        default:
            return false;
        }
    }

    uint32_t pipeline_forward_operand(
        uint32_t reg_index,
        uint32_t latched_value,
        const PipelineEXMEM& ex_mem,
        const PipelineMEMWB& mem_wb
    ) {
        if (reg_index == 0) {
            return 0;
        }

        if (ex_mem.valid
            && pipeline_can_forward_ex_mem_result(ex_mem.inst)
            && ex_mem.inst.rd == reg_index) {
            return ex_mem.alu_result;
        }

        if (mem_wb.valid
            && pipeline_can_forward_mem_wb_result(mem_wb.inst)
            && mem_wb.inst.rd == reg_index) {
            return mem_wb.write_value;
        }

        return latched_value;
    }

    TracePipelineStage make_trace_stage_from_raw(
        uint32_t pc,
        uint32_t raw,
        const char* state
    ) {
        TracePipelineStage stage{};
        stage.state = state;
        stage.has_pc = true;
        stage.pc = pc;
        stage.has_raw = true;
        stage.raw = raw;
        stage.op = opcode_to_string(decode(raw).op);
        return stage;
    }

    TracePipelineStage make_trace_stage_from_inst(
        uint32_t pc,
        const DecodedInst& inst,
        const char* state
    ) {
        TracePipelineStage stage{};
        stage.state = state;
        stage.has_pc = true;
        stage.pc = pc;
        stage.has_raw = true;
        stage.raw = inst.raw;
        stage.op = opcode_to_string(inst.op);
        return stage;
    }

    void choose_trace_focus(
        const PipelineState& pipeline,
        bool has_fetch,
        uint32_t fetch_pc,
        uint32_t fetch_raw,
        uint32_t& trace_pc,
        uint32_t& trace_raw,
        DecodedInst& trace_inst
    ) {
        if (pipeline.if_id.valid) {
            trace_pc = pipeline.if_id.pc;
            trace_raw = pipeline.if_id.raw;
            trace_inst = decode(pipeline.if_id.raw);
            return;
        }

        if (pipeline.id_ex.valid) {
            trace_pc = pipeline.id_ex.pc;
            trace_raw = pipeline.id_ex.inst.raw;
            trace_inst = pipeline.id_ex.inst;
            return;
        }

        if (pipeline.ex_mem.valid) {
            trace_pc = pipeline.ex_mem.pc;
            trace_raw = pipeline.ex_mem.inst.raw;
            trace_inst = pipeline.ex_mem.inst;
            return;
        }

        if (pipeline.mem_wb.valid) {
            trace_pc = pipeline.mem_wb.pc;
            trace_raw = pipeline.mem_wb.inst.raw;
            trace_inst = pipeline.mem_wb.inst;
            return;
        }

        if (has_fetch) {
            trace_pc = fetch_pc;
            trace_raw = fetch_raw;
            trace_inst = decode(fetch_raw);
            return;
        }

        trace_pc = fetch_pc;
        trace_raw = 0;
        trace_inst = make_invalid_decoded_inst();
    }

    struct PipelineExecuteResult {
        uint32_t alu_result = 0;
        bool branch_taken = false;
        uint32_t branch_target = 0;
    };

    PipelineExecuteResult pipeline_execute_stage(
        const PipelineIDEX& stage,
        const PipelineEXMEM& ex_mem,
        const PipelineMEMWB& mem_wb
    ) {
        PipelineExecuteResult result{};
        const uint32_t src1_value = pipeline_reads_rj(stage.inst)
            ? pipeline_forward_operand(stage.inst.rj, stage.src1_value, ex_mem, mem_wb)
            : stage.src1_value;
        const uint32_t src2_value = pipeline_reads_rk(stage.inst)
            ? pipeline_forward_operand(stage.inst.rk, stage.src2_value, ex_mem, mem_wb)
            : stage.src2_value;

        switch (stage.inst.op) {
        case Opcode::ADD_W:
            result.alu_result = src1_value + src2_value;
            return result;
        case Opcode::SUB_W:
            result.alu_result = src1_value - src2_value;
            return result;
        case Opcode::ADDI_W:
            result.alu_result = src1_value + static_cast<uint32_t>(stage.inst.imm);
            return result;
        case Opcode::LD_W:
            result.alu_result = src1_value + static_cast<uint32_t>(stage.inst.imm);
            return result;
        case Opcode::B:
            result.branch_taken = true;
            result.branch_target = stage.pc + 4u + static_cast<uint32_t>(stage.inst.imm);
            return result;
        case Opcode::BEQ:
            result.branch_taken = (src1_value == src2_value);
            result.branch_target = stage.pc + 4u + static_cast<uint32_t>(stage.inst.imm);
            return result;
        case Opcode::BNE:
            result.branch_taken = (src1_value != src2_value);
            result.branch_target = stage.pc + 4u + static_cast<uint32_t>(stage.inst.imm);
            return result;
        case Opcode::BLT: {
            const int32_t lhs = static_cast<int32_t>(src1_value);
            const int32_t rhs = static_cast<int32_t>(src2_value);
            result.branch_taken = (lhs < rhs);
            result.branch_target = stage.pc + 4u + static_cast<uint32_t>(stage.inst.imm);
            return result;
        }
        case Opcode::BGE: {
            const int32_t lhs = static_cast<int32_t>(src1_value);
            const int32_t rhs = static_cast<int32_t>(src2_value);
            result.branch_taken = (lhs >= rhs);
            result.branch_target = stage.pc + 4u + static_cast<uint32_t>(stage.inst.imm);
            return result;
        }
        case Opcode::BLTU:
            result.branch_taken = (src1_value < src2_value);
            result.branch_target = stage.pc + 4u + static_cast<uint32_t>(stage.inst.imm);
            return result;
        case Opcode::BGEU:
            result.branch_taken = (src1_value >= src2_value);
            result.branch_target = stage.pc + 4u + static_cast<uint32_t>(stage.inst.imm);
            return result;
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
        if (pipeline_.ex_mem.inst.op == Opcode::LD_W) {
            next.mem_wb.write_value = mem_.read32(pipeline_.ex_mem.alu_result);
        }
        else {
            next.mem_wb.write_value = pipeline_.ex_mem.alu_result;
        }
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

    const CPUState before = state_;
    const uint32_t fetch_pc_before = state_.pc;
    trace_begin_step();

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
        if (pipeline_.ex_mem.inst.op == Opcode::LD_W) {
            next.mem_wb.write_value = mem_.read32(pipeline_.ex_mem.alu_result);
        }
        else {
            next.mem_wb.write_value = pipeline_.ex_mem.alu_result;
        }
    }

    bool flush_for_control_hazard = false;
    uint32_t control_target_pc = state_.pc;
    bool branch_resolved = false;
    bool branch_taken = false;

    if (pipeline_.id_ex.valid) {
        next.ex_mem.valid = true;
        next.ex_mem.pc = pipeline_.id_ex.pc;
        next.ex_mem.inst = pipeline_.id_ex.inst;
        const PipelineExecuteResult ex_result = pipeline_execute_stage(
            pipeline_.id_ex,
            pipeline_.ex_mem,
            pipeline_.mem_wb
        );
        next.ex_mem.alu_result = ex_result.alu_result;
        branch_resolved = pipeline_is_control_flow(pipeline_.id_ex.inst);
        branch_taken = ex_result.branch_taken;
        flush_for_control_hazard = ex_result.branch_taken;
        control_target_pc = ex_result.branch_target;
    }

    if (branch_resolved) {
        trace_note_branch(branch_taken);
    }

    bool stall_for_raw_hazard = false;
    bool fetched_instruction = false;
    uint32_t fetched_pc = fetch_pc_before;
    uint32_t fetched_raw = 0;

    if (!flush_for_control_hazard && pipeline_.if_id.valid) {
        DecodedInst decoded = decode(pipeline_.if_id.raw);
        if (decoded.op == Opcode::INVALID) {
            throw make_invalid_instruction_error(pipeline_.if_id.pc, pipeline_.if_id.raw);
        }
        if (!pipeline_supported(decoded)) {
            char buf[160];
            std::snprintf(
                buf,
                sizeof(buf),
                "pipeline mode currently supports ADD_W/SUB_W/ADDI_W/LD_W/B/BEQ/BNE/BLT/BGE/BLTU/BGEU, got %s at pc=0x%08X",
                opcode_to_string(decoded.op),
                pipeline_.if_id.pc
            );
            throw std::runtime_error(buf);
        }

        // Stall only when the producer will still not have a usable value for the
        // consumer's next EX stage. The current load-use case needs one bubble:
        // EX computes the address first, then MEM/WB provides the loaded word.
        stall_for_raw_hazard =
            (pipeline_.id_ex.valid
                && pipeline_has_raw_hazard(decoded, pipeline_.id_ex.inst)
                && !pipeline_can_forward_ex_mem_result(pipeline_.id_ex.inst))
            || (pipeline_.ex_mem.valid
                && pipeline_has_raw_hazard(decoded, pipeline_.ex_mem.inst)
                && !pipeline_can_forward_mem_wb_result(pipeline_.ex_mem.inst));

        if (!stall_for_raw_hazard) {
            next.id_ex.valid = true;
            next.id_ex.pc = pipeline_.if_id.pc;
            next.id_ex.inst = decoded;
            next.id_ex.src1_value = state_.gpr[decoded.rj];
            next.id_ex.src2_value = state_.gpr[decoded.rk];
        }
    }

    if (flush_for_control_hazard) {
        // Resolve control flow in EX and conservatively bubble the younger stages.
        state_.pc = control_target_pc;
    }
    else if (stall_for_raw_hazard) {
        next.if_id = pipeline_.if_id;
    }
    else {
        fetched_pc = state_.pc;
        fetched_raw = mem_.read32(fetched_pc);
        fetched_instruction = true;
        next.if_id.valid = true;
        next.if_id.pc = fetched_pc;
        next.if_id.raw = fetched_raw;

        state_.pc = fetched_pc + 4;
    }

    TracePipelineInfo pipeline_trace{};
    pipeline_trace.enabled = true;
    pipeline_trace.cycle = pipeline_.cycle;

    if (fetched_instruction) {
        pipeline_trace.if_stage = make_trace_stage_from_raw(fetched_pc, fetched_raw, "fetch");
    }
    else if (stall_for_raw_hazard) {
        pipeline_trace.if_stage.state = "stalled";
        pipeline_trace.if_stage.has_pc = true;
        pipeline_trace.if_stage.pc = fetch_pc_before;
    }
    else if (flush_for_control_hazard) {
        pipeline_trace.if_stage.state = "flushed";
        pipeline_trace.if_stage.has_pc = true;
        pipeline_trace.if_stage.pc = fetch_pc_before;
    }

    if (pipeline_.if_id.valid) {
        const char* id_state = "occupied";
        if (flush_for_control_hazard) {
            id_state = "flushed";
        }
        else if (stall_for_raw_hazard) {
            id_state = "stalled";
        }
        pipeline_trace.id_stage = make_trace_stage_from_raw(
            pipeline_.if_id.pc,
            pipeline_.if_id.raw,
            id_state
        );
    }

    if (pipeline_.id_ex.valid) {
        pipeline_trace.ex_stage = make_trace_stage_from_inst(
            pipeline_.id_ex.pc,
            pipeline_.id_ex.inst,
            "occupied"
        );
    }

    if (pipeline_.ex_mem.valid) {
        pipeline_trace.mem_stage = make_trace_stage_from_inst(
            pipeline_.ex_mem.pc,
            pipeline_.ex_mem.inst,
            "occupied"
        );
    }

    if (pipeline_.mem_wb.valid) {
        pipeline_trace.wb_stage = make_trace_stage_from_inst(
            pipeline_.mem_wb.pc,
            pipeline_.mem_wb.inst,
            "occupied"
        );
    }

    if (stall_for_raw_hazard) {
        pipeline_trace.stall = true;
        pipeline_trace.stall_reason = "raw_hazard";
        pipeline_trace.bubble_stages.push_back("EX");
    }

    if (flush_for_control_hazard) {
        pipeline_trace.flush_stages.push_back("IF");
        pipeline_trace.flush_stages.push_back("ID");
    }

    state_.gpr[0] = 0;
    pipeline_ = next;

    uint32_t trace_pc = fetch_pc_before;
    uint32_t trace_raw = 0;
    DecodedInst trace_inst = make_invalid_decoded_inst();
    choose_trace_focus(
        pipeline_,
        fetched_instruction,
        fetched_pc,
        fetched_raw,
        trace_pc,
        trace_raw,
        trace_inst
    );
    trace_note_pipeline(pipeline_trace);
    trace_step_jsonl(trace_pc, trace_raw, trace_inst, before, state_);
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
