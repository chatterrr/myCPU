#pragma once
#include<cstdint>

struct CPUState {
    uint32_t gpr[32];
    uint32_t pc;
    bool running;

    uint32_t last_inst;   // 最近执行的原始指令
    int exit_code;        // 0 正常结束；非 0 表示异常退出
};

enum class Opcode {
    ADD_W, SUB_W, ADDI_W, SLT, SLTU,
    SLL_W,SRL_W,SRA_W,
    AND, OR, XOR, NOR,
    SLTI,SLTUI,ANDI,ORI,XORI,
    LD_W, ST_W, LD_B, LD_H, ST_B, ST_H,
    LD_BU, LD_HU,
    SLLI_W,SRLI_W,SRAI_W,
    B, BEQ, BNE, LU12I_W, PCADDU12I,
    BLT,BGE,BLTU,BGEU,BL,JIRL,
    BREAK,SYSCALL,
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
