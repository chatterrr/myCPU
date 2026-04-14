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

    constexpr uint32_t ENC_1RI20(uint32_t op, uint32_t rd, int32_t imm20) {
        return (op << 25)
            | ((static_cast<uint32_t>(imm20) & 0xFFFFFu) << 5)
            | rd;
    }

    // ---------- opcodes ----------
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

    // ---------- expected step counts ----------
    inline constexpr uint64_t kArithProgramSteps = 4;
    inline constexpr uint64_t kLogicProgramSteps = 5;
    inline constexpr uint64_t kMemProgramSteps = 4;
    inline constexpr uint64_t kBranchProgramSteps = 6;
    inline constexpr uint64_t kSmokeProgramSteps = 13;
    inline constexpr uint64_t kR0WriteProtectProgramSteps = 2;
    inline constexpr uint64_t kUnalignedAccessProgramSteps = 3;
    inline constexpr uint64_t kOutOfRangeAccessProgramSteps = 3;
    inline constexpr uint64_t kInvalidProgramSteps = 1;

    inline constexpr uint64_t kSltProgramSteps = 6;
    inline constexpr uint64_t kLu12iProgramSteps = 3;
    inline constexpr uint64_t kUartProgramSteps = 8;
    inline constexpr uint64_t kPipelineNoHazardProgramSteps = 14;
    inline constexpr uint64_t kPipelineRawHazardProgramSteps = 11;

    // ---------- split programs ----------
    inline const std::vector<uint32_t> kArithProgramWords = {
        ENC_2RI12(OP_ADDI_W, 1, 0, 5),
        ENC_2RI12(OP_ADDI_W, 2, 0, 7),
        ENC_3R(OP_ADD_W, 4, 1, 2),
        ENC_3R(OP_SUB_W, 5, 2, 1),
    };

    inline const std::vector<uint32_t> kLogicProgramWords = {
        ENC_2RI12(OP_ADDI_W, 4, 0, 12),
        ENC_2RI12(OP_ADDI_W, 5, 0,  2),
        ENC_3R(OP_AND, 10, 4, 4),
        ENC_3R(OP_OR,  11, 4, 5),
        ENC_3R(OP_XOR, 12, 4, 5),
    };

    inline const std::vector<uint32_t> kMemProgramWords = {
        ENC_2RI12(OP_ADDI_W, 4, 0, 12),
        ENC_2RI12(OP_ADDI_W, 6, 0, 0x80),
        ENC_2RI12(OP_ST_W,   4, 6, 0),
        ENC_2RI12(OP_LD_W,   7, 6, 0),
    };

    inline const std::vector<uint32_t> kBranchProgramWords = {
        ENC_2RI12(OP_ADDI_W, 4,  0, 12),
        ENC_2RI12(OP_ADDI_W, 7,  0, 12),
        ENC_2RI12(OP_ADDI_W, 5,  0,  2),

        ENC_2RI16(OP_BEQ,    7,  4,  1),
        ENC_2RI12(OP_ADDI_W, 20, 0,  1),

        ENC_2RI16(OP_BNE,    5,  4,  1),
        ENC_2RI12(OP_ADDI_W, 21, 0,  1),

        ENC_I26(OP_B, 1),
        ENC_2RI12(OP_ADDI_W, 22, 0, 1),
    };

    inline const std::vector<uint32_t> kSmokeProgramWords = {
        ENC_2RI12(OP_ADDI_W, 1, 0,   5),
        ENC_2RI12(OP_ADDI_W, 2, 0,   7),
        ENC_3R(OP_ADD_W, 4, 1, 2),
        ENC_3R(OP_SUB_W, 5, 2, 1),

        ENC_2RI12(OP_ADDI_W, 6, 0, 0x80),
        ENC_2RI12(OP_ST_W,   4, 6, 0),
        ENC_2RI12(OP_LD_W,   7, 6, 0),

        ENC_2RI16(OP_BEQ,    7, 4, 1),
        ENC_2RI12(OP_ADDI_W, 20, 0, 1),

        ENC_2RI16(OP_BNE,    5, 4, 1),
        ENC_2RI12(OP_ADDI_W, 21, 0, 1),

        ENC_I26(OP_B, 1),
        ENC_2RI12(OP_ADDI_W, 22, 0, 1),

        ENC_3R(OP_AND, 10, 4, 7),
        ENC_3R(OP_OR,  11, 4, 5),
        ENC_3R(OP_XOR, 12, 4, 5),
    };

    inline const std::vector<uint32_t> kR0WriteProtectProgramWords = {
        ENC_2RI12(OP_ADDI_W, 0, 0, 123),
        ENC_2RI12(OP_ADDI_W, 1, 0,   5),
    };

    inline const std::vector<uint32_t> kUnalignedAccessProgramWords = {
        ENC_2RI12(OP_ADDI_W, 4, 0, 12),
        ENC_2RI12(OP_ADDI_W, 6, 0, 0x82),
        ENC_2RI12(OP_ST_W,   4, 6, 0),
    };

    inline const std::vector<uint32_t> kOutOfRangeAccessProgramWords = {
        ENC_2RI12(OP_ADDI_W, 4, 0, 12),
        ENC_2RI12(OP_ADDI_W, 6, 0, -4),
        ENC_2RI12(OP_ST_W,   4, 6, 0),
    };

    inline const std::vector<uint32_t> kInvalidProgramWords = {
        0x00000000u
    };

    // 10) slt
    inline const std::vector<uint32_t> kSltProgramWords = {
        ENC_2RI12(OP_ADDI_W, 1, 0,  1),   // r1 = 1
        ENC_2RI12(OP_ADDI_W, 2, 0,  2),   // r2 = 2
        ENC_3R(OP_SLT,    3, 1,  2),   // r3 = (1 < 2)  -> 1
        ENC_3R(OP_SLT,    4, 2,  1),   // r4 = (2 < 1)  -> 0
        ENC_2RI12(OP_ADDI_W, 5, 0, -1),   // r5 = -1
        ENC_3R(OP_SLT,    7, 5,  1),   // r7 = (-1 < 1) -> 1
    };

    // 11) lu12i.w
    inline const std::vector<uint32_t> kLu12iProgramWords = {
        ENC_1RI20(OP_LU12I_W, 13, 0x12345),  // r13 = 0x12345000
        ENC_1RI20(OP_LU12I_W, 14, 0x1FE00),  // r14 = 0x1FE00000
        ENC_2RI12(OP_ADDI_W,  14, 14, 0x1E0) // r14 = 0x1FE001E0
    };

    // 12) UART end-to-end
    inline const std::vector<uint32_t> kUartProgramWords = {
        ENC_1RI20(OP_LU12I_W, 15, 0x1FE00), // r15 = 0x1FE00000
        ENC_2RI12(OP_ADDI_W,  15, 15, 0x1E0), // r15 = UART_ADDR

        ENC_2RI12(OP_ADDI_W, 16, 0, 'H'),
        ENC_2RI12(OP_ST_W,   16, 15, 0),

        ENC_2RI12(OP_ADDI_W, 16, 0, 'i'),
        ENC_2RI12(OP_ST_W,   16, 15, 0),

        ENC_2RI12(OP_ADDI_W, 16, 0, '!'),
        ENC_2RI12(OP_ST_W,   16, 15, 0),
    };

    // 13) minimal no-hazard pipeline demo
    inline const std::vector<uint32_t> kPipelineNoHazardProgramWords = {
        ENC_2RI12(OP_ADDI_W, 1, 0, 5),  // r1 = 5
        ENC_2RI12(OP_ADDI_W, 2, 0, 7),  // r2 = 7
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // nop
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // nop
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // nop
        ENC_3R(OP_ADD_W, 4, 1, 2),      // r4 = 12
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // nop
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // nop
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // nop
        ENC_3R(OP_SUB_W, 5, 4, 1),      // r5 = 7
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
    };

    // 14) pipeline RAW hazard demo without hand-written spacing
    inline const std::vector<uint32_t> kPipelineRawHazardProgramWords = {
        ENC_2RI12(OP_ADDI_W, 1, 0, 5),  // r1 = 5
        ENC_2RI12(OP_ADDI_W, 2, 1, 7),  // r2 = r1 + 7 = 12
        ENC_3R(OP_ADD_W, 4, 2, 1),      // r4 = r2 + r1 = 17
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
    };

}  // namespace tests
