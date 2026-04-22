#pragma once

#include <cstdint>

#include "cpu/trap.h"

inline constexpr uint32_t CPU_STATUS_IE = 1u << 0;
inline constexpr uint32_t CPU_STATUS_EXL = 1u << 1;

struct CPUState {
    uint32_t gpr[32] = {};
    uint32_t pc = 0;
    bool running = false;

    uint32_t epc = 0;
    TrapCause cause = TrapCause::None;
    uint32_t status = 0;
    uint32_t exception_vector_base = 0;
    uint32_t badv = 0;
    bool pending_interrupt = false;
    bool last_trap_was_interrupt = false;

    uint32_t last_inst = 0;
    int exit_code = 0;
    enum class StopReason : uint32_t {
        None = 0,
        HaltInstruction,
        TrapTerminated,
        MaxStepsReached,
        RuntimeError
    } stop_reason = StopReason::None;
};

inline const char* stop_reason_to_string(CPUState::StopReason reason) {
    switch (reason) {
    case CPUState::StopReason::None: return "none";
    case CPUState::StopReason::HaltInstruction: return "halt_instruction";
    case CPUState::StopReason::TrapTerminated: return "trap_terminated";
    case CPUState::StopReason::MaxStepsReached: return "max_steps_reached";
    case CPUState::StopReason::RuntimeError: return "runtime_error";
    }
    return "unknown";
}

inline constexpr uint32_t kSimulatorHaltRaw = 0x6FFFFFFEu;

enum class Opcode {
    ADD_W, SUB_W, ADDI_W, SLT, SLTU,
    SLL_W, SRL_W, SRA_W,
    AND, OR, XOR, NOR,
    SLTI, SLTUI, ANDI, ORI, XORI,
    LD_W, ST_W, LD_B, LD_H, ST_B, ST_H,
    LD_BU, LD_HU,
    SLLI_W, SRLI_W, SRAI_W,
    B, BEQ, BNE, LU12I_W, PCADDU12I,
    BLT, BGE, BLTU, BGEU, BL, JIRL,
    BREAK, SYSCALL, ERTN, HALT,
    INVALID
};

struct DecodedInst {
    Opcode op;
    uint32_t rd;
    uint32_t rj;
    uint32_t rk;
    int32_t imm;
    uint32_t raw;
};

inline DecodedInst make_invalid_decoded_inst(uint32_t raw = 0) {
    return DecodedInst{ Opcode::INVALID, 0u, 0u, 0u, 0, raw };
}

struct PipelineIFID {
    bool valid = false;
    uint32_t pc = 0;
    uint32_t raw = 0;
};

struct PipelineIDEX {
    bool valid = false;
    uint32_t pc = 0;
    DecodedInst inst = make_invalid_decoded_inst();
    uint32_t src1_value = 0;
    uint32_t src2_value = 0;
};

struct PipelineEXMEM {
    bool valid = false;
    uint32_t pc = 0;
    DecodedInst inst = make_invalid_decoded_inst();
    uint32_t alu_result = 0;
    uint32_t store_value = 0;
};

struct PipelineMEMWB {
    bool valid = false;
    uint32_t pc = 0;
    DecodedInst inst = make_invalid_decoded_inst();
    uint32_t write_value = 0;
};

struct PipelineState {
    uint64_t cycle = 0;
    PipelineIFID if_id{};
    PipelineIDEX id_ex{};
    PipelineEXMEM ex_mem{};
    PipelineMEMWB mem_wb{};
};
