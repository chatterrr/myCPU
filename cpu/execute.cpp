#include "execute.h"

#include <stdexcept>

#include "cpu/trap.h"
#include "memory/memory.h"
#include "utils/debug.h"

void execute(CPUState& s, const DecodedInst& in, Memory& mem) {
    const uint32_t pc0 = s.pc;

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
        const int32_t lhs = static_cast<int32_t>(s.gpr[in.rj]);
        const int32_t rhs = static_cast<int32_t>(s.gpr[in.rk]);
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
        const int32_t lhs = static_cast<int32_t>(s.gpr[in.rj]);
        s.gpr[in.rd] = (lhs < in.imm) ? 1u : 0u;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SLTUI: {
        s.gpr[in.rd] = (s.gpr[in.rj] < static_cast<uint32_t>(in.imm)) ? 1u : 0u;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::ANDI: {
        s.gpr[in.rd] = s.gpr[in.rj] & static_cast<uint32_t>(in.imm);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::ORI: {
        s.gpr[in.rd] = s.gpr[in.rj] | static_cast<uint32_t>(in.imm);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::XORI: {
        s.gpr[in.rd] = s.gpr[in.rj] ^ static_cast<uint32_t>(in.imm);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::NOR: {
        s.gpr[in.rd] = ~(s.gpr[in.rj] | s.gpr[in.rk]);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SLL_W: {
        const uint32_t shamt = s.gpr[in.rk] & 0x1Fu;
        s.gpr[in.rd] = s.gpr[in.rj] << shamt;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SRL_W: {
        const uint32_t shamt = s.gpr[in.rk] & 0x1Fu;
        s.gpr[in.rd] = s.gpr[in.rj] >> shamt;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SRA_W: {
        const uint32_t shamt = s.gpr[in.rk] & 0x1Fu;
        s.gpr[in.rd] = static_cast<uint32_t>(static_cast<int32_t>(s.gpr[in.rj]) >> shamt);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SLLI_W: {
        const uint32_t shamt = static_cast<uint32_t>(in.imm) & 0x1Fu;
        s.gpr[in.rd] = s.gpr[in.rj] << shamt;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SRLI_W: {
        const uint32_t shamt = static_cast<uint32_t>(in.imm) & 0x1Fu;
        s.gpr[in.rd] = s.gpr[in.rj] >> shamt;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::SRAI_W: {
        const uint32_t shamt = static_cast<uint32_t>(in.imm) & 0x1Fu;
        s.gpr[in.rd] = static_cast<uint32_t>(static_cast<int32_t>(s.gpr[in.rj]) >> shamt);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::LD_W: {
        const uint32_t addr = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        s.gpr[in.rd] = mem.read32(addr);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::ST_W: {
        const uint32_t addr = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        const uint32_t value = s.gpr[in.rd];

        mem.write32(addr, value);
        trace_note_mem_write(addr, value);

        s.pc = pc0 + 4;
        break;
    }

    case Opcode::LD_B: {
        const uint32_t addr = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        const int32_t result = static_cast<int32_t>(static_cast<int8_t>(mem.read8(addr)));
        s.gpr[in.rd] = static_cast<uint32_t>(result);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::ST_B: {
        const uint32_t addr = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        const uint32_t value = s.gpr[in.rd];

        mem.write8(addr, static_cast<uint8_t>(value & 0xFFu));
        trace_note_mem_write(addr, value);

        s.pc = pc0 + 4;
        break;
    }

    case Opcode::LD_BU: {
        const uint32_t addr = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        s.gpr[in.rd] = static_cast<uint32_t>(mem.read8(addr));
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::LD_H: {
        const uint32_t addr = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        const int32_t result = static_cast<int32_t>(static_cast<int16_t>(mem.read16(addr)));
        s.gpr[in.rd] = static_cast<uint32_t>(result);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::ST_H: {
        const uint32_t addr = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        const uint32_t value = s.gpr[in.rd];

        mem.write16(addr, static_cast<uint16_t>(value & 0xFFFFu));
        trace_note_mem_write(addr, value);

        s.pc = pc0 + 4;
        break;
    }

    case Opcode::LD_HU: {
        const uint32_t addr = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        s.gpr[in.rd] = static_cast<uint32_t>(mem.read16(addr));
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::JIRL: {
        trace_note_branch(true);
        s.gpr[in.rd] = pc0 + 4;
        s.pc = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        break;
    }

    case Opcode::B: {
        trace_note_branch(true);
        s.pc = pc0 + 4 + static_cast<uint32_t>(in.imm);
        break;
    }

    case Opcode::BL: {
        trace_note_branch(true);
        s.gpr[1] = pc0 + 4;
        s.pc = pc0 + 4 + static_cast<uint32_t>(in.imm);
        break;
    }

    case Opcode::BEQ: {
        const bool taken = (s.gpr[in.rj] == s.gpr[in.rk]);
        trace_note_branch(taken);
        s.pc = taken ? (pc0 + 4 + static_cast<uint32_t>(in.imm)) : (pc0 + 4);
        break;
    }

    case Opcode::BNE: {
        const bool taken = (s.gpr[in.rj] != s.gpr[in.rk]);
        trace_note_branch(taken);
        s.pc = taken ? (pc0 + 4 + static_cast<uint32_t>(in.imm)) : (pc0 + 4);
        break;
    }

    case Opcode::BLT: {
        const int32_t lhs = static_cast<int32_t>(s.gpr[in.rj]);
        const int32_t rhs = static_cast<int32_t>(s.gpr[in.rk]);
        const bool taken = (lhs < rhs);
        trace_note_branch(taken);
        s.pc = taken ? (pc0 + 4 + static_cast<uint32_t>(in.imm)) : (pc0 + 4);
        break;
    }

    case Opcode::BGE: {
        const int32_t lhs = static_cast<int32_t>(s.gpr[in.rj]);
        const int32_t rhs = static_cast<int32_t>(s.gpr[in.rk]);
        const bool taken = (lhs >= rhs);
        trace_note_branch(taken);
        s.pc = taken ? (pc0 + 4 + static_cast<uint32_t>(in.imm)) : (pc0 + 4);
        break;
    }

    case Opcode::BLTU: {
        const bool taken = (s.gpr[in.rj] < s.gpr[in.rk]);
        trace_note_branch(taken);
        s.pc = taken ? (pc0 + 4 + static_cast<uint32_t>(in.imm)) : (pc0 + 4);
        break;
    }

    case Opcode::BGEU: {
        const bool taken = (s.gpr[in.rj] >= s.gpr[in.rk]);
        trace_note_branch(taken);
        s.pc = taken ? (pc0 + 4 + static_cast<uint32_t>(in.imm)) : (pc0 + 4);
        break;
    }

    case Opcode::LU12I_W: {
        s.gpr[in.rd] = static_cast<uint32_t>(in.imm) << 12;
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::PCADDU12I: {
        s.gpr[in.rd] = pc0 + (static_cast<uint32_t>(in.imm) << 12);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::BREAK: {
        throw TrapException(
            TrapCause::Breakpoint,
            pc0,
            "Breakpoint exception (software breakpoint)");
    }

    case Opcode::SYSCALL: {
        throw TrapException(TrapCause::Syscall, pc0, "Syscall trap");
    }

    case Opcode::ERTN: {
        s.status &= ~CPU_STATUS_EXL;
        s.pending_interrupt = false;
        s.last_trap_was_interrupt = false;
        s.cause = TrapCause::None;
        s.pc = s.epc;
        break;
    }

    case Opcode::HALT: {
        s.pc = pc0 + 4;
        s.running = false;
        s.exit_code = 0;
        s.stop_reason = CPUState::StopReason::HaltInstruction;
        break;
    }

    case Opcode::INVALID:
    default:
        throw TrapException(TrapCause::InvalidInstruction, pc0, "invalid instruction");
    }
}
