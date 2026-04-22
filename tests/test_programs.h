#pragma once
#include "config/constants.h"
#include <cstdint>
#include <vector>

#include "cpu/isa.h"

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
    constexpr uint32_t OP_SLTU = 0b00000000000100101;
    constexpr uint32_t OP_SLL_W = 0b00000000000101110;
    constexpr uint32_t OP_SRL_W = 0b00000000000101111;
    constexpr uint32_t OP_SRA_W = 0b00000000000110000;
    constexpr uint32_t OP_NOR = 0b00000000000101000;
    constexpr uint32_t OP_AND = 0b00000000000101001;
    constexpr uint32_t OP_OR = 0b00000000000101010;
    constexpr uint32_t OP_XOR = 0b00000000000101011;
    constexpr uint32_t OP_SLLI_W = 0b00000000010000001;
    constexpr uint32_t OP_SRLI_W = 0b00000000010001001;
    constexpr uint32_t OP_SRAI_W = 0b00000000010010001;
    constexpr uint32_t OP_BREAK = 0b00000000001010100;
    constexpr uint32_t OP_SYSCALL = 0b00000000001010110;

    constexpr uint32_t OP_SLTI = 0b0000001000;
    constexpr uint32_t OP_SLTUI = 0b0000001001;
    constexpr uint32_t OP_ADDI_W = 0b0000001010;
    constexpr uint32_t OP_ANDI = 0b0000001101;
    constexpr uint32_t OP_ORI = 0b0000001110;
    constexpr uint32_t OP_XORI = 0b0000001111;
    constexpr uint32_t OP_LD_B = 0b0010100000;
    constexpr uint32_t OP_LD_H = 0b0010100001;
    constexpr uint32_t OP_LD_W = 0b0010100010;
    constexpr uint32_t OP_ST_B = 0b0010100100;
    constexpr uint32_t OP_ST_H = 0b0010100101;
    constexpr uint32_t OP_ST_W = 0b0010100110;
    constexpr uint32_t OP_LD_BU = 0b0010101000;
    constexpr uint32_t OP_LD_HU = 0b0010101001;

    constexpr uint32_t OP_LU12I_W = 0b0001010;
    constexpr uint32_t OP_PCADDU12I = 0b0001110;

    constexpr uint32_t OP_BEQ = 0b010110;
    constexpr uint32_t OP_BNE = 0b010111;
    constexpr uint32_t OP_B = 0b010100;
    constexpr uint32_t OP_BLT = 0b011000;
    constexpr uint32_t OP_BGE = 0b011001;
    constexpr uint32_t OP_BLTU = 0b011010;
    constexpr uint32_t OP_BGEU = 0b011011;
    constexpr uint32_t OP_BL = 0b010101;
    constexpr uint32_t OP_JIRL = 0b010011;
    constexpr uint32_t kBreakRaw = ENC_3R(OP_BREAK, 0, 0, 0);
    constexpr uint32_t kSyscallRaw = ENC_3R(OP_SYSCALL, 0, 0, 0);
    constexpr uint32_t kErtnRaw = 0x06483800u;
    constexpr uint32_t kHaltRaw = kSimulatorHaltRaw;

    inline const std::vector<uint32_t> kCounterTrapHandlerWords = {
        ENC_2RI12(OP_ADDI_W, 30, 30, 1),
        kErtnRaw,
    };

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
    inline constexpr uint64_t kSltuProgramSteps = 4;
    inline constexpr uint64_t kNorProgramSteps = 4;
    inline constexpr uint64_t kShiftImmediateProgramSteps = 5;
    inline constexpr uint64_t kBranchCompareProgramSteps = 18;
    inline constexpr uint64_t kBlProgramSteps = 2;
    inline constexpr uint64_t kJirlProgramSteps = 4;
    inline constexpr uint64_t kPcaddu12iProgramSteps = 1;
    inline constexpr uint64_t kLu12iProgramSteps = 3;
    inline constexpr uint64_t kUartProgramSteps = 8;
    inline constexpr uint64_t kPipelineNoHazardProgramSteps = 14;
    inline constexpr uint64_t kPipelineRawHazardProgramSteps = 7;
    inline constexpr uint64_t kPipelineForwardingProgramSteps = 8;
    inline constexpr uint64_t kPipelineLoadUseProgramSteps = 8;
    inline constexpr uint64_t kPipelineBranchProgramSteps = 14;

    // ---------- split programs ----------
    inline const std::vector<uint32_t> kArithProgramWords = {
        ENC_2RI12(OP_ADDI_W, 1, 0, 5),
        ENC_2RI12(OP_ADDI_W, 2, 0, 7),
        ENC_3R(OP_ADD_W, 4, 1, 2),
        ENC_3R(OP_SUB_W, 5, 2, 1),
        kHaltRaw,
    };

    inline const std::vector<uint32_t> kLogicProgramWords = {
        ENC_2RI12(OP_ADDI_W, 4, 0, 12),
        ENC_2RI12(OP_ADDI_W, 5, 0,  2),
        ENC_3R(OP_AND, 10, 4, 4),
        ENC_3R(OP_OR,  11, 4, 5),
        ENC_3R(OP_XOR, 12, 4, 5),
        kHaltRaw,
    };

    inline const std::vector<uint32_t> kMemProgramWords = {
        ENC_2RI12(OP_ADDI_W, 4, 0, 12),
        ENC_2RI12(OP_ADDI_W, 6, 0, 0x80),
        ENC_2RI12(OP_ST_W,   4, 6, 0),
        ENC_2RI12(OP_LD_W,   7, 6, 0),
        kHaltRaw,
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
        kHaltRaw,
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
        kHaltRaw,
    };

    inline const std::vector<uint32_t> kR0WriteProtectProgramWords = {
        ENC_2RI12(OP_ADDI_W, 0, 0, 123),
        ENC_2RI12(OP_ADDI_W, 1, 0,   5),
        kHaltRaw,
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
        kHaltRaw,
    };

    inline const std::vector<uint32_t> kSltuProgramWords = {
        ENC_2RI12(OP_ADDI_W, 1, 0, -1),  // r1 = 0xFFFFFFFF
        ENC_2RI12(OP_ADDI_W, 2, 0,  1),  // r2 = 1
        ENC_3R(OP_SLTU, 3, 2, 1),        // r3 = (1 < 0xFFFFFFFF) -> 1
        ENC_3R(OP_SLTU, 4, 1, 2),        // r4 = (0xFFFFFFFF < 1) -> 0
    };

    inline const std::vector<uint32_t> kNorProgramWords = {
        ENC_2RI12(OP_ADDI_W, 1, 0, 12),  // r1 = 0x0000000C
        ENC_2RI12(OP_ADDI_W, 2, 0,  2),  // r2 = 0x00000002
        ENC_3R(OP_NOR, 3, 1, 2),         // r3 = ~(0xC | 0x2)
        ENC_3R(OP_NOR, 4, 0, 0),         // r4 = ~0
    };

    inline const std::vector<uint32_t> kShiftImmediateProgramWords = {
        ENC_2RI12(OP_ADDI_W, 1, 0,   1),  // r1 = 1
        ENC_3R(OP_SLLI_W, 2, 1, 4),       // r2 = 16
        ENC_2RI12(OP_ADDI_W, 3, 0, -16),  // r3 = 0xFFFFFFF0
        ENC_3R(OP_SRLI_W, 4, 3, 2),       // r4 = 0x3FFFFFFC
        ENC_3R(OP_SRAI_W, 5, 3, 2),       // r5 = 0xFFFFFFFC
    };

    inline const std::vector<uint32_t> kBranchCompareProgramWords = {
        ENC_2RI12(OP_ADDI_W, 1, 0, -1),   // r1 = -1
        ENC_2RI12(OP_ADDI_W, 2, 0,  1),   // r2 = 1

        ENC_2RI16(OP_BLT,  2, 1, 1),      // taken
        ENC_2RI12(OP_ADDI_W, 20, 0, 1),   // skipped
        ENC_2RI16(OP_BGE,  1, 2, 1),      // taken
        ENC_2RI12(OP_ADDI_W, 21, 0, 1),   // skipped
        ENC_2RI16(OP_BLTU, 1, 2, 1),      // taken
        ENC_2RI12(OP_ADDI_W, 22, 0, 1),   // skipped
        ENC_2RI16(OP_BGEU, 2, 1, 1),      // taken
        ENC_2RI12(OP_ADDI_W, 23, 0, 1),   // skipped

        ENC_2RI16(OP_BLT,  1, 2, 1),      // not taken
        ENC_2RI12(OP_ADDI_W, 24, 0, 1),   // executed
        ENC_2RI16(OP_BGE,  2, 1, 1),      // not taken
        ENC_2RI12(OP_ADDI_W, 25, 0, 1),   // executed
        ENC_2RI16(OP_BLTU, 2, 1, 1),      // not taken
        ENC_2RI12(OP_ADDI_W, 26, 0, 1),   // executed
        ENC_2RI16(OP_BGEU, 1, 2, 1),      // not taken
        ENC_2RI12(OP_ADDI_W, 27, 0, 1),   // executed
    };

    inline const std::vector<uint32_t> kBlProgramWords = {
        ENC_I26(OP_BL, 1),                // jump over the next instruction
        ENC_2RI12(OP_ADDI_W, 20, 0, 1),   // skipped
        ENC_2RI12(OP_ADDI_W, 7, 0, 42),   // executed after the link
    };

    inline const std::vector<uint32_t> kJirlProgramWords = {
        ENC_1RI20(OP_LU12I_W, 6, 0x1),    // r6 = 0x00001000
        ENC_2RI12(OP_ADDI_W,  6, 6, 16),  // r6 = 0x00001010
        ENC_2RI16(OP_JIRL,    5, 6, 0),   // r5 = 0x0000100C, pc = 0x00001010
        ENC_2RI12(OP_ADDI_W, 20, 0, 1),   // skipped
        ENC_2RI12(OP_ADDI_W,  7, 0, 42),  // jump target
    };

    inline const std::vector<uint32_t> kPcaddu12iProgramWords = {
        ENC_1RI20(OP_PCADDU12I, 8, 0x1),  // r8 = pc + 0x00001000
    };

    // 11) lu12i.w
    inline const std::vector<uint32_t> kLu12iProgramWords = {
        ENC_1RI20(OP_LU12I_W, 13, 0x12345),  // r13 = 0x12345000
        ENC_1RI20(OP_LU12I_W, 14, 0x1FE00),  // r14 = 0x1FE00000
        ENC_2RI12(OP_ADDI_W,  14, 14, 0x1E0), // r14 = 0x1FE001E0
        kHaltRaw,
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
        kHaltRaw,
    };

    inline const std::vector<uint32_t> kBreakResumeProgramWords = {
        kBreakRaw,
        ENC_2RI12(OP_ADDI_W, 9, 0, 7),
        kHaltRaw,
    };

    inline const std::vector<uint32_t> kTimerInterruptProgramWords = {
        ENC_1RI20(OP_LU12I_W, 10, 0x1FE00),
        ENC_2RI12(OP_ADDI_W,  10, 10, 0x200),
        ENC_2RI12(OP_ADDI_W,  11, 0, 2),
        ENC_2RI12(OP_ST_W,    11, 10, 4),
        ENC_2RI12(
            OP_ADDI_W,
            11,
            0,
            static_cast<int32_t>(
                config::TIMER_CTRL_ENABLE_BIT
                | config::TIMER_CTRL_INTERRUPT_ENABLE_BIT)),
        ENC_2RI12(OP_ST_W,    11, 10, 0),
        ENC_2RI12(OP_ADDI_W,  12, 0, 1),
        ENC_2RI12(OP_ADDI_W,  13, 0, 2),
        kHaltRaw,
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
        kHaltRaw,
    };

    // 14) pipeline RAW hazard demo without hand-written spacing
    inline const std::vector<uint32_t> kPipelineRawHazardProgramWords = {
        ENC_2RI12(OP_ADDI_W, 1, 0, 5),  // r1 = 5
        ENC_2RI12(OP_ADDI_W, 2, 1, 7),  // r2 = r1 + 7 = 12
        ENC_3R(OP_ADD_W, 4, 2, 1),      // r4 = r2 + r1 = 17
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
        kHaltRaw,
    };

    // 15) pipeline forwarding demo:
    // I3 needs EX/MEM(r2) + MEM/WB(r1), then I4 chains again from I3/I2.
    inline const std::vector<uint32_t> kPipelineForwardingProgramWords = {
        ENC_2RI12(OP_ADDI_W, 1, 0, 5),  // r1 = 5
        ENC_2RI12(OP_ADDI_W, 2, 1, 7),  // r2 = r1 + 7 = 12
        ENC_3R(OP_ADD_W, 4, 2, 1),      // r4 = r2 + r1 = 17
        ENC_3R(OP_SUB_W, 5, 4, 2),      // r5 = r4 - r2 = 5
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
        kHaltRaw,
    };

    inline constexpr uint32_t kPipelineLoadUseDataWord =
        ENC_2RI12(OP_ADDI_W, 0, 0, 5);

    // 16) pipeline load-use demo:
    // I2 immediately consumes the loaded word from I1 and needs one stall/bubble.
    inline const std::vector<uint32_t> kPipelineLoadUseProgramWords = {
        ENC_2RI12(OP_LD_W,   1, 0, 16), // r1 = MEM[0x10] -> embedded data word below
        ENC_2RI12(OP_ADDI_W, 2, 1,  1), // r2 = r1 + 1 (load-use hazard)
        ENC_3R(OP_ADD_W, 4, 2, 1),      // r4 = r2 + r1
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // spacer / harmless
        kPipelineLoadUseDataWord,       // data word, also executes as a harmless rd=0 ADDI
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
        kHaltRaw,
    };

    // 17) pipeline branch/control hazard demo:
    // I3 resolves a taken BEQ using forwarded operands and must flush two younger writes.
    // I7 then does the same for an unconditional B.
    inline const std::vector<uint32_t> kPipelineBranchProgramWords = {
        ENC_2RI12(OP_ADDI_W, 1, 0, 5),  // r1 = 5
        ENC_2RI12(OP_ADDI_W, 2, 1, 0),  // r2 = r1 (needs forwarding into the branch)
        ENC_2RI16(OP_BEQ,    2, 1, 2),  // taken: skip the next two wrong-path writes
        ENC_2RI12(OP_ADDI_W, 20, 0, 1), // wrong path, must be flushed
        ENC_2RI12(OP_ADDI_W, 21, 0, 1), // wrong path, must be flushed
        ENC_2RI12(OP_ADDI_W, 4, 2, 7),  // r4 = r2 + 7 = 12
        ENC_I26(OP_B, 1),               // taken: skip the next wrong-path write
        ENC_2RI12(OP_ADDI_W, 22, 0, 1), // wrong path, must be flushed
        ENC_3R(OP_ADD_W, 5, 4, 1),      // r5 = r4 + r1 = 17
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
        ENC_2RI12(OP_ADDI_W, 0, 0, 0),  // drain
        kHaltRaw,
    };

}  // namespace tests
