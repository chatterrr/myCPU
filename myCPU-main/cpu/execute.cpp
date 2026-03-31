#include "execute.h"
#include "memory/memory.h"   // 路径按你们工程实际
#include <stdexcept>

static void check_align4(uint32_t addr) {
    if (addr % 4 != 0) throw std::runtime_error("unaligned access");
}

void execute(CPUState& s, const DecodedInst& in, Memory& mem) {
    uint32_t pc0 = s.pc;

    switch (in.op) {
    case Opcode::ADD_W:
        s.gpr[in.rd] = s.gpr[in.rj] + s.gpr[in.rk];
        s.pc = pc0 + 4;
        break;

    case Opcode::SUB_W:
        s.gpr[in.rd] = s.gpr[in.rj] - s.gpr[in.rk];
        s.pc = pc0 + 4;
        break;

    case Opcode::ADDI_W:
        s.gpr[in.rd] = s.gpr[in.rj] + (uint32_t)in.imm;
        s.pc = pc0 + 4;
        break;

    case Opcode::AND:
        s.gpr[in.rd] = s.gpr[in.rj] & s.gpr[in.rk];
        s.pc = pc0 + 4;
        break;

    case Opcode::OR:
        s.gpr[in.rd] = s.gpr[in.rj] | s.gpr[in.rk];
        s.pc = pc0 + 4;
        break;

    case Opcode::XOR:
        s.gpr[in.rd] = s.gpr[in.rj] ^ s.gpr[in.rk];
        s.pc = pc0 + 4;
        break;

    case Opcode::LD_W: {
        uint32_t addr = s.gpr[in.rj] + (uint32_t)in.imm;
        check_align4(addr);
        s.gpr[in.rd] = mem.read32(addr);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::ST_W: {
        uint32_t addr = s.gpr[in.rj] + (uint32_t)in.imm;
        check_align4(addr);
        // 注意：store 的“数据源寄存器”到底是 rd 还是 rk，取决于你们 decode 如何填字段
        mem.write32(addr, s.gpr[in.rd /*或 in.rk*/]);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::B:
        // 约定：目标 = pc0 + 4 + imm（示例）
        s.pc = pc0 + 4 + (uint32_t)in.imm;
        break;

    case Opcode::BEQ:
        if (s.gpr[in.rj] == s.gpr[in.rk]) s.pc = pc0 + 4 + (uint32_t)in.imm;
        else s.pc = pc0 + 4;
        break;

    case Opcode::BNE:
        if (s.gpr[in.rj] != s.gpr[in.rk]) s.pc = pc0 + 4 + (uint32_t)in.imm;
        else s.pc = pc0 + 4;
        break;

    case Opcode::LU12I_W:
        s.gpr[in.rd] = (uint32_t)(in.imm<<12);
        s.pc += 4;
        break;

    case Opcode::INVALID:
    default:
        throw std::runtime_error("invalid instruction");
    }
}