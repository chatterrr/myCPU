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