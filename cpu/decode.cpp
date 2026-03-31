#include "decode.h"
#include "isa.h"
#include <cstdint>

namespace {
// 如果你没放到 isa.h，就在这里做成 static
uint32_t bits(uint32_t v, int hi, int lo) {
    return (v >> lo) & ((1u << (hi - lo + 1)) - 1u);
}
int32_t sext(uint32_t x, int bits) {
    uint32_t m = 1u << (bits - 1);
    return (int32_t)((x ^ m) - m);
}

// 下面这些“字段位置”需要你按 LoongArch LA32 编码表确定：
// rd/rj/rk/imm/opcode/func 等在哪些 bit 位
uint32_t get_rd(uint32_t raw) { return bits(raw, 4, 0); }
uint32_t get_rj(uint32_t raw) { return bits(raw, 9, 5); }
uint32_t get_rk(uint32_t raw) { return bits(raw, 14, 10); }
// ------------------------------
// 立即数字段提取（按格式表）
// ------------------------------
inline int32_t imm_i12(uint32_t raw) {
    // 2RI12-type: imm[11:0] 在 [21:10]
    return sext(bits(raw, 21, 10), 12);
}
inline int32_t imm_i16(uint32_t raw) {
    // 2RI16-type: imm[15:0] 在 [25:10]
    return sext(bits(raw, 25, 10), 16);
}
inline int32_t imm_i21_branch(uint32_t raw) {
    // 1RI21-type: imm[15:0] 在 [25:10], imm[20:16] 在 [4:0]
    // 按分支偏移常见语义，最终字节偏移通常要 << 2
    uint32_t low16  = bits(raw, 25, 10);
    uint32_t high5  = bits(raw, 4, 0);
    uint32_t imm21  = (high5 << 16) | low16;
    return sext(imm21, 21) << 2;
}
inline int32_t imm_i26_branch(uint32_t raw) {
    // I26-type: imm[25:0]（图上分成 imm[15:0] + imm[25:16]）
    // 同理，通常分支偏移是指令对齐偏移，最终 << 2
    uint32_t imm26 = bits(raw, 25, 0);
    return sext(imm26, 26) << 2;
}
// ------------------------------
// opcode提取（按不同格式）
// ------------------------------
inline uint32_t op_3r(uint32_t raw)      { return bits(raw, 31, 15); } // 3R-type
inline uint32_t op_2ri12(uint32_t raw)   { return bits(raw, 31, 22); } // 2RI12-type
inline uint32_t op_2ri16(uint32_t raw)   { return bits(raw, 31, 26); } // 2RI16-type
inline uint32_t op_i26(uint32_t raw)     { return bits(raw, 31, 26); } // I26-type
inline uint32_t op_1ri21(uint32_t raw)   { return bits(raw, 31, 26); } // 1RI21-type
// ------------------------------
//
// ------------------------------
constexpr uint32_t OP_ADD_W = 0b00000000000100000;
constexpr uint32_t OP_SUB_W = 0b00000000000100010;
constexpr uint32_t OP_AND = 0b00000000000101001;
constexpr uint32_t OP_OR = 0b00000000000101010;
constexpr uint32_t OP_XOR = 0b00000000000101011;

constexpr uint32_t OP_ADDI_W = 0b0000001010;
constexpr uint32_t OP_LD_W = 0b0010100010;
constexpr uint32_t OP_ST_W = 0b0010100110;

constexpr uint32_t OP_BEQ = 0b010110;
constexpr uint32_t OP_BNE = 0b010111;
constexpr uint32_t OP_B = 0b010100;
}

DecodedInst decode(uint32_t raw) {
    DecodedInst d{};
    d.op  = Opcode::INVALID;
    d.rd  = 0;
    d.rj  = 0;
    d.rk  = 0;
    d.imm = 0;
    d.raw = raw;
    // ----------------------------------------------------
    // 1) 3R-type: add.w/sub.w/and/or/xor
    // opcode | rk | rj | rd
    // ----------------------------------------------------
    {
        const uint32_t op = op_3r(raw);
        if (op == OP_ADD_W) {
            d.op = Opcode::ADD_W;
            d.rd = get_rd(raw);
            d.rj = get_rj(raw);
            d.rk = get_rk(raw);
            return d;
        }
        if (op == OP_SUB_W) {
            d.op = Opcode::SUB_W;
            d.rd = get_rd(raw);
            d.rj = get_rj(raw);
            d.rk = get_rk(raw);
            return d;
        }
        if (op == OP_AND) {
            d.op = Opcode::AND;
            d.rd = get_rd(raw);
            d.rj = get_rj(raw);
            d.rk = get_rk(raw);
            return d;
        }
        if (op == OP_OR) {
            d.op = Opcode::OR;
            d.rd = get_rd(raw);
            d.rj = get_rj(raw);
            d.rk = get_rk(raw);
            return d;
        }
        if (op == OP_XOR) {
            d.op = Opcode::XOR;
            d.rd = get_rd(raw);
            d.rj = get_rj(raw);
            d.rk = get_rk(raw);
            return d;
        }
    }
    // ----------------------------------------------------
    // 2) 2RI12-type: addi.w / ld.w / st.w
    // opcode | imm[11:0] | rj | rd
    // ----------------------------------------------------
    {
        const uint32_t op = op_2ri12(raw);
        if (op == OP_ADDI_W) {
            d.op  = Opcode::ADDI_W;
            d.rd  = get_rd(raw);
            d.rj  = get_rj(raw);
            d.imm = imm_i12(raw);
            return d;
        }
        if (op == OP_LD_W) {
            d.op  = Opcode::LD_W;
            d.rd  = get_rd(raw); // 目标寄存器
            d.rj  = get_rj(raw); // base
            d.imm = imm_i12(raw); // offset
            return d;
        }
        if (op == OP_ST_W) {
            d.op  = Opcode::ST_W;
            d.rd  = get_rd(raw); // LoongArch里st.w常用rd作为待存数据寄存器
            d.rj  = get_rj(raw); // base
            d.imm = imm_i12(raw); // offset
            return d;
        }
    }
    // ----------------------------------------------------
    // 3) 2RI16-type: beq / bne（常见）
    // opcode | imm[15:0] | rj | rd
    // 注意：beq/bne 语义是比较两个寄存器
    // 这里把“第二个比较寄存器”统一放到 d.rk
    // ----------------------------------------------------
    {
        const uint32_t op = op_2ri16(raw);
        if (op == OP_BEQ) {
            d.op  = Opcode::BEQ;
            d.rj  = get_rj(raw);
            d.rk  = get_rd(raw);   // 2RI16里没有rk字段，用rd位承载第二寄存器
            d.imm = imm_i16(raw) << 2; // 分支偏移（按4字节对齐）
            return d;
        }
        if (op == OP_BNE) {
            d.op  = Opcode::BNE;
            d.rj  = get_rj(raw);
            d.rk  = get_rd(raw);
            d.imm = imm_i16(raw) << 2;
            return d;
        }
    }
    // ----------------------------------------------------
    // 4) I26-type: b（常见）
    // opcode | imm[25:0]
    // ----------------------------------------------------
    {
        const uint32_t op = op_i26(raw);
        if (op == OP_B) {
            d.op  = Opcode::B;
            d.imm = imm_i26_branch(raw);
            return d;
        }
    }
    // 可选：如果你后续有1RI21类分支（这阶段可能暂不用）
    // {
    //     const uint32_t op = op_1ri21(raw);
    //     if (op == OP_xxx) {
    //         d.op = ...;
    //         d.rj = get_rj(raw);
    //         d.imm = imm_i21_branch(raw);
    //         return d;
    //     }
    // }
    // 无法识别 -> INVALID
    return d;
}