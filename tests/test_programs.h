#pragma once
#include <cstdint>
#include <vector>

namespace tests {

    // ---------- encoders ----------
    constexpr uint32_t ENC_3R(uint32_t op, uint32_t rd, uint32_t rj, uint32_t rk) {
        return (op << 15) | (rk << 10) | (rj << 5) | rd;
    }

    constexpr uint32_t ENC_2RI12(uint32_t op, uint32_t rd, uint32_t rj, int32_t imm) {
        return (op << 22)
            | ((static_cast<uint32_t>(imm) & 0xFFFu) << 10)
            | (rj << 5)
            | rd;
    }

    constexpr uint32_t ENC_2RI16(uint32_t op, uint32_t rd, uint32_t rj, int32_t imm) {
        return (op << 26)
            | ((static_cast<uint32_t>(imm) & 0xFFFFu) << 10)
            | (rj << 5)
            | rd;
    }

    constexpr uint32_t ENC_I26(uint32_t op, int32_t imm) {
        return (op << 26)
            | (static_cast<uint32_t>(imm) & 0x03FFFFFFu);
    }

    // ---------- opcodes ----------
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

    // ---------- expected step counts ----------
    inline constexpr uint64_t kArithProgramSteps = 4;
    inline constexpr uint64_t kLogicProgramSteps = 5;
    inline constexpr uint64_t kMemProgramSteps = 4;
    inline constexpr uint64_t kBranchProgramSteps = 6;
    inline constexpr uint64_t kSmokeProgramSteps = 13;
    inline constexpr uint64_t kInvalidProgramSteps = 1;

    // ---------- split programs ----------
    // 1) arithmetic
    inline const std::vector<uint32_t> kArithProgramWords = {
        ENC_2RI12(OP_ADDI_W, 1, 0, 5),   // r1 = 5
        ENC_2RI12(OP_ADDI_W, 2, 0, 7),   // r2 = 7
        ENC_3R(OP_ADD_W,  4, 1, 2),   // r4 = 12
        ENC_3R(OP_SUB_W,  5, 2, 1),   // r5 = 2
    };

    // 2) logic
    inline const std::vector<uint32_t> kLogicProgramWords = {
        ENC_2RI12(OP_ADDI_W, 4, 0, 12),  // r4 = 12
        ENC_2RI12(OP_ADDI_W, 5, 0,  2),  // r5 = 2
        ENC_3R(OP_AND,   10, 4, 4),   // r10 = 12
        ENC_3R(OP_OR,    11, 4, 5),   // r11 = 14
        ENC_3R(OP_XOR,   12, 4, 5),   // r12 = 14
    };

    // 3) memory
    inline const std::vector<uint32_t> kMemProgramWords = {
        ENC_2RI12(OP_ADDI_W, 4, 0, 12),    // r4 = 12
        ENC_2RI12(OP_ADDI_W, 6, 0, 0x80),  // r6 = 0x80
        ENC_2RI12(OP_ST_W,   4, 6, 0),     // MEM[0x80] = r4
        ENC_2RI12(OP_LD_W,   7, 6, 0),     // r7 = MEM[0x80]
    };

    // 4) branch
    inline const std::vector<uint32_t> kBranchProgramWords = {
        ENC_2RI12(OP_ADDI_W, 4,  0, 12),   // r4 = 12
        ENC_2RI12(OP_ADDI_W, 7,  0, 12),   // r7 = 12
        ENC_2RI12(OP_ADDI_W, 5,  0,  2),   // r5 = 2

        ENC_2RI16(OP_BEQ,    7,  4,  1),   // equal -> skip next
        ENC_2RI12(OP_ADDI_W, 20, 0,  1),   // skipped

        ENC_2RI16(OP_BNE,    5,  4,  1),   // not equal -> skip next
        ENC_2RI12(OP_ADDI_W, 21, 0,  1),   // skipped

        ENC_I26(OP_B,             1),    // skip next
        ENC_2RI12(OP_ADDI_W, 22, 0,  1),   // skipped
    };

    // 5) smoke
    inline const std::vector<uint32_t> kSmokeProgramWords = {
        ENC_2RI12(OP_ADDI_W, 1, 0,   5),   // r1 = 5
        ENC_2RI12(OP_ADDI_W, 2, 0,   7),   // r2 = 7
        ENC_3R(OP_ADD_W,  4, 1,   2),   // r4 = 12
        ENC_3R(OP_SUB_W,  5, 2,   1),   // r5 = 2

        ENC_2RI12(OP_ADDI_W, 6, 0, 0x80),  // r6 = 0x80
        ENC_2RI12(OP_ST_W,   4, 6,   0),   // MEM[0x80] = r4
        ENC_2RI12(OP_LD_W,   7, 6,   0),   // r7 = MEM[0x80]

        ENC_2RI16(OP_BEQ,    7, 4,   1),   // equal -> skip next
        ENC_2RI12(OP_ADDI_W,20, 0,   1),   // skipped

        ENC_2RI16(OP_BNE,    5, 4,   1),   // not equal -> skip next
        ENC_2RI12(OP_ADDI_W,21, 0,   1),   // skipped

        ENC_I26(OP_B,         1),        // skip next
        ENC_2RI12(OP_ADDI_W,22, 0,   1),   // skipped

        ENC_3R(OP_AND,   10, 4,   7),   // r10 = 12
        ENC_3R(OP_OR,    11, 4,   5),   // r11 = 14
        ENC_3R(OP_XOR,   12, 4,   5),   // r12 = 14
    };

    // 6) invalid
    inline const std::vector<uint32_t> kInvalidProgramWords = {
        0x00000000u
    };

}  // namespace tests