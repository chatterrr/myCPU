#include "execute.h"

#include <stdexcept>

#include "config/constants.h"
#include "memory/memory.h"
#include "utils/debug.h"

static void check_align4(uint32_t addr) {
    if (addr % 4 != 0) throw std::runtime_error("unaligned access");
}

void execute(CPUState& s, const DecodedInst& in, Memory& mem) {
    uint32_t pc0 = s.pc;

    switch (in.op) {
    case Opcode::ADD_W: {
        s.gpr[in.rd] = s.gpr[in.rj] + s.gpr[in.rk];
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SUB_W: {
        s.gpr[in.rd] = s.gpr[in.rj] - s.gpr[in.rk];
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SLT: {
        int32_t lhs = static_cast<int32_t>(s.gpr[in.rj]);
        int32_t rhs = static_cast<int32_t>(s.gpr[in.rk]);
        s.gpr[in.rd] = (lhs < rhs) ? 1u : 0u;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SLTU: {
        s.gpr[in.rd] = (s.gpr[in.rj] < s.gpr[in.rk]) ? 1u : 0u;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::ADDI_W: {
        s.gpr[in.rd] = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::AND: {
        s.gpr[in.rd] = s.gpr[in.rj] & s.gpr[in.rk];
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::OR: {
        s.gpr[in.rd] = s.gpr[in.rj] | s.gpr[in.rk];
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::XOR: {
        s.gpr[in.rd] = s.gpr[in.rj] ^ s.gpr[in.rk];
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SLTI: {
        int32_t lhs = static_cast<int32_t>(s.gpr[in.rj]);
        s.gpr[in.rd] = (lhs < s.gpr[in.imm]) ? 1u : 0u;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SLTUI: {
        s.gpr[in.rd] = (s.gpr[in.rj] < s.gpr[in.imm]) ? 1u : 0u;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::ANDI: {
        s.gpr[in.rd] = s.gpr[in.rj] & s.gpr[in.imm];
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::ORI: {
        s.gpr[in.rd] = s.gpr[in.rj] | s.gpr[in.imm];
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::XORI: {
        s.gpr[in.rd] = s.gpr[in.rj] ^ s.gpr[in.imm];
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::NOR: {
        s.gpr[in.rd] = ~(s.gpr[in.rj] | s.gpr[in.rk]);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SLL_W: {
        uint32_t shamt = s.gpr[in.rk] & 0x1Fu;
        s.gpr[in.rd] = s.gpr[in.rj] << shamt;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SRL_W: {
        uint32_t shamt = s.gpr[in.rk] & 0x1Fu;
        s.gpr[in.rd] = s.gpr[in.rj] >> shamt;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SRA_W: {
        uint32_t shamt = s.gpr[in.rk] & 0x1Fu;
        s.gpr[in.rd] = static_cast<int32_t>(s.gpr[in.rj]) >> shamt;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SLLI_W: {
        uint32_t shamt = s.gpr[in.imm] & 0x1Fu;
        s.gpr[in.rd] = s.gpr[in.rj] << shamt;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SRLI_W: {
        uint32_t shamt = s.gpr[in.imm] & 0x1Fu;
        s.gpr[in.rd] = s.gpr[in.rj] >> shamt;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SRAI_W: {
        uint32_t shamt = s.gpr[in.imm] & 0x1Fu;
        s.gpr[in.rd] = static_cast<int32_t>(s.gpr[in.rj]) >> shamt;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::LD_W: {
        uint32_t addr = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        check_align4(addr);
        s.gpr[in.rd] = mem.read32(addr);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::ST_W: {
        uint32_t addr = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        uint32_t value = s.gpr[in.rd];
        check_align4(addr);

        mem.write32(addr, value);
        trace_note_mem_write(addr, value);

        if (addr == config::UART_ADDR) {
            trace_note_uart_char(static_cast<uint8_t>(value & 0xFFu));
        }

        s.pc = pc0 + 4;
        break;
    }

    case Opcode::B: {
        trace_note_branch(true);
        s.pc = pc0 + 4 + static_cast<uint32_t>(in.imm);
        break;
    }

    case Opcode::BEQ: {
        bool taken = (s.gpr[in.rj] == s.gpr[in.rk]);
        trace_note_branch(taken);
        if (taken) s.pc = pc0 + 4 + static_cast<uint32_t>(in.imm);
        else s.pc = pc0 + 4;
        break;
    }

    case Opcode::BNE: {
        bool taken = (s.gpr[in.rj] != s.gpr[in.rk]);
        trace_note_branch(taken);
        if (taken) s.pc = pc0 + 4 + static_cast<uint32_t>(in.imm);
        else s.pc = pc0 + 4;
        break;
    }

    case Opcode::LU12I_W: {
        s.gpr[in.rd] = static_cast<uint32_t>(in.imm) << 12;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::INVALID:
    default:
        throw std::runtime_error("invalid instruction");
    }
}