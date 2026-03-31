#include "utils/debug.h"

#include <iomanip>
#include <iostream>

const char* opcode_to_string(Opcode op) {
    switch (op) {
        case Opcode::ADD_W: return "ADD_W";
        case Opcode::SUB_W: return "SUB_W";
        case Opcode::ADDI_W: return "ADDI_W";
        case Opcode::AND: return "AND";
        case Opcode::OR: return "OR";
        case Opcode::XOR: return "XOR";
        case Opcode::LD_W: return "LD_W";
        case Opcode::ST_W: return "ST_W";
        case Opcode::B: return "B";
        case Opcode::BEQ: return "BEQ";
        case Opcode::BNE: return "BNE";
        case Opcode::INVALID: return "INVALID";
    }
    return "UNKNOWN";
}

void dump_regs(const CPUState& cpu) {
    std::ios old_state(nullptr);
    old_state.copyfmt(std::cout);

    std::cout << "==== Registers ====\n";
    for (int i = 0; i < 32; ++i) {
        std::cout << "r" << std::dec << std::setw(2) << std::setfill('0') << i
                  << " = 0x" << std::hex << std::setw(8) << std::setfill('0') << cpu.gpr[i]
                  << ((i % 4 == 3) ? '\n' : ' ');
    }
    std::cout << std::dec
              << "pc=0x" << std::hex << std::setw(8) << std::setfill('0') << cpu.pc
              << " last_inst=0x" << std::setw(8) << cpu.last_inst
              << std::dec << " running=" << cpu.running
              << " exit_code=" << cpu.exit_code << "\n";

    std::cout.copyfmt(old_state);
}

void dump_inst(uint32_t pc, uint32_t raw, const DecodedInst& inst) {
    std::ios old_state(nullptr);
    old_state.copyfmt(std::cout);

    std::cout << "[TRACE] pc=0x" << std::hex << std::setw(8) << std::setfill('0') << pc
              << " raw=0x" << std::setw(8) << raw
              << " op=" << opcode_to_string(inst.op)
              << std::dec
              << " rd=" << inst.rd
              << " rj=" << inst.rj
              << " rk=" << inst.rk
              << " imm=" << inst.imm << '\n';

    std::cout.copyfmt(old_state);
}
