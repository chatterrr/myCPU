#include "decode.h"
#include "isa.h"
#include <cstdint>

namespace {

    uint32_t bits(uint32_t v, int hi, int lo) {
        return (v >> lo) & ((1u << (hi - lo + 1)) - 1u);
    }

    int32_t sext(uint32_t x, int bit_count) {
        const uint32_t m = 1u << (bit_count - 1);
        return static_cast<int32_t>((x ^ m) - m);
    }

    // ---------- field extractors ----------
    uint32_t get_rd(uint32_t raw) { return bits(raw, 4, 0); }
    uint32_t get_rj(uint32_t raw) { return bits(raw, 9, 5); }
    uint32_t get_rk(uint32_t raw) { return bits(raw, 14, 10); }

    // ---------- immediates ----------
    inline int32_t imm_i12(uint32_t raw) {
        return sext(bits(raw, 21, 10), 12);
    }

    inline int32_t imm_i16(uint32_t raw) {
        return sext(bits(raw, 25, 10), 16);
    }

    inline int32_t si20(uint32_t raw) {
        // 1RI20-type: si20 is in [24:5], rd is in [4:0]
        return sext(bits(raw, 24, 5), 20);
    }

    inline int32_t imm_i26_branch(uint32_t raw) {
        const uint32_t imm26 = bits(raw, 25, 0);
        return sext(imm26, 26) << 2;
    }

    // ---------- opcode extractors ----------
    inline uint32_t op_3r(uint32_t raw) { return bits(raw, 31, 15); }
    inline uint32_t op_2ri12(uint32_t raw) { return bits(raw, 31, 22); }
    inline uint32_t op_2ri16(uint32_t raw) { return bits(raw, 31, 26); }
    inline uint32_t op_i26(uint32_t raw) { return bits(raw, 31, 26); }
    inline uint32_t op_1ri20(uint32_t raw) { return bits(raw, 31, 25); }

    // ---------- opcode constants ----------
    constexpr uint32_t OP_ADD_W = 0b00000000000100000;
    constexpr uint32_t OP_SUB_W = 0b00000000000100010;
    constexpr uint32_t OP_SLT = 0b00000000000100100;
    constexpr uint32_t OP_AND = 0b00000000000101001;
    constexpr uint32_t OP_OR = 0b00000000000101010;
    constexpr uint32_t OP_XOR = 0b00000000000101011;

    constexpr uint32_t OP_ADDI_W = 0b0000001010;
    constexpr uint32_t OP_LD_W = 0b0010100010;
    constexpr uint32_t OP_ST_W = 0b0010100110;

    constexpr uint32_t OP_LU12I_W = 0b0001010;

    constexpr uint32_t OP_BEQ = 0b010110;
    constexpr uint32_t OP_BNE = 0b010111;
    constexpr uint32_t OP_B = 0b010100;

}  // namespace

DecodedInst decode(uint32_t raw) {
    DecodedInst d{};
    d.op = Opcode::INVALID;
    d.rd = 0;
    d.rj = 0;
    d.rk = 0;
    d.imm = 0;
    d.raw = raw;

    // 1) 3R-type
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
        if (op == OP_SLT) {
            d.op = Opcode::SLT;
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

    // 2) 2RI12-type
    {
        const uint32_t op = op_2ri12(raw);
        if (op == OP_ADDI_W) {
            d.op = Opcode::ADDI_W;
            d.rd = get_rd(raw);
            d.rj = get_rj(raw);
            d.imm = imm_i12(raw);
            return d;
        }
        if (op == OP_LD_W) {
            d.op = Opcode::LD_W;
            d.rd = get_rd(raw);
            d.rj = get_rj(raw);
            d.imm = imm_i12(raw);
            return d;
        }
        if (op == OP_ST_W) {
            d.op = Opcode::ST_W;
            d.rd = get_rd(raw);
            d.rj = get_rj(raw);
            d.imm = imm_i12(raw);
            return d;
        }
    }

    // 3) 2RI16-type
    {
        const uint32_t op = op_2ri16(raw);
        if (op == OP_BEQ) {
            d.op = Opcode::BEQ;
            d.rj = get_rj(raw);
            d.rk = get_rd(raw);
            d.imm = imm_i16(raw) << 2;
            return d;
        }
        if (op == OP_BNE) {
            d.op = Opcode::BNE;
            d.rj = get_rj(raw);
            d.rk = get_rd(raw);
            d.imm = imm_i16(raw) << 2;
            return d;
        }
    }

    // 4) I26-type
    {
        const uint32_t op = op_i26(raw);
        if (op == OP_B) {
            d.op = Opcode::B;
            d.imm = imm_i26_branch(raw);
            return d;
        }
    }

    // 5) 1RI20-type: lu12i.w
    {
        const uint32_t op = op_1ri20(raw);
        if (op == OP_LU12I_W) {
            d.op = Opcode::LU12I_W;
            d.rd = get_rd(raw);
            d.imm = si20(raw);
            return d;
        }
    }

    return d;
}