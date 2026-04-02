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
    ADD_W, SUB_W, ADDI_W,SLT,
    AND, OR, XOR,
    LD_W, ST_W,
    B, BEQ, BNE,LU12I_W,
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