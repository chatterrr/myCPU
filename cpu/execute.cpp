#include "execute.h"

#include <stdexcept>
#include <iostream>

#include "config/constants.h"
#include "memory/memory.h"
#include "utils/debug.h"

static void check_align4(uint32_t addr) {
    if (addr % 4 != 0) throw std::runtime_error("unaligned access");
}

static void check_align2(uint32_t addr) {
    if (addr % 2 != 0) throw std::runtime_error("unaligned access");
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

    case Opcode::LD_B: {
        uint32_t addr = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        int32_t result = static_cast<int32_t>(static_cast<int8_t>(mem.read8(addr)));
        s.gpr[in.rd] = static_cast<uint32_t>(result);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::ST_B: {
        uint32_t addr = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        uint32_t value = s.gpr[in.rd];

        mem.write8(addr, value);
        trace_note_mem_write(addr, value);

        if (addr == config::UART_ADDR) {
            trace_note_uart_char(static_cast<uint8_t>(value & 0xFFu));
        }

        s.pc = pc0 + 4;
        break;
    }

    case Opcode::LD_BU: {
        uint32_t addr = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        s.gpr[in.rd] = static_cast<uint32_t>(mem.read8(addr));
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::LD_H: {
        uint32_t addr = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        check_align2(addr);
        int32_t result = static_cast<int32_t>(static_cast<int16_t>(mem.read16(addr)));
        s.gpr[in.rd] = static_cast<uint32_t>(result);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::ST_H: {
        uint32_t addr = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        uint32_t value = s.gpr[in.rd];
        check_align2(addr);

        mem.write16(addr, value);
        trace_note_mem_write(addr, value);

        if (addr == config::UART_ADDR) {
            trace_note_uart_char(static_cast<uint8_t>(value & 0xFFu));
        }

        s.pc = pc0 + 4;
        break;
    }

    case Opcode::LD_HU: {
        uint32_t addr = s.gpr[in.rj] + static_cast<uint32_t>(in.imm);
        check_align2(addr);
        s.gpr[in.rd] = static_cast<uint32_t>(mem.read16(addr));
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::JIRL: {
        trace_note_branch(true);
        s.gpr[in.rk] = pc0 + 4;
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

    case Opcode::BLT: {
        int32_t lhs = static_cast<int32_t>(s.gpr[in.rj]);
        int32_t rhs = static_cast<int32_t>(s.gpr[in.rk]);
        bool taken = (lhs < rhs);
        trace_note_branch(taken);
        if (taken) s.pc = pc0 + 4 + static_cast<uint32_t>(in.imm);
        else s.pc = pc0 + 4;
        break;
    }

    case Opcode::BGE: {
        int32_t lhs = static_cast<int32_t>(s.gpr[in.rj]);
        int32_t rhs = static_cast<int32_t>(s.gpr[in.rk]);
        bool taken = (lhs >= rhs);
        trace_note_branch(taken);
        if (taken) s.pc = pc0 + 4 + static_cast<uint32_t>(in.imm);
        else s.pc = pc0 + 4;
        break;
    }

    case Opcode::BLTU: {
        bool taken = (s.gpr[in.rj] < s.gpr[in.rk]);
        trace_note_branch(taken);
        if (taken) s.pc = pc0 + 4 + static_cast<uint32_t>(in.imm);
        else s.pc = pc0 + 4;
        break;
    }

    case Opcode::BGEU: {
        bool taken = (s.gpr[in.rj] >= s.gpr[in.rk]);
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

    case Opcode::PCADDU12I: {
        s.gpr[in.rd] = pc0 + (static_cast<uint32_t>(in.imm) << 12);
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::BREAK: {
        // 直接抛出异常停止模拟器（最标准最简单）
        throw std::runtime_error("Breakpoint exception (software breakpoint)");
        // 如果你不想退出，只想继续运行，就只保留下面这行
        // s.pc += 4;
        break;
    }

    case Opcode::SYSCALL: {
        uint32_t syscall_num = s.gpr[11];
        switch (syscall_num) {
            // ------------- 1. 退出程序 (exit) ----------------
        case 93: {  // Linux LoongArch 标准 exit 号 = 93
            int32_t exit_code = s.gpr[4];  // 退出码在 r4
            //trace_note_syscall("exit", exit_code);
            throw std::runtime_error("Program exited with code: " + std::to_string(exit_code));
        }
               // ------------- 2. 打印单个字符 (print char) ----------------
        case 64: {  // write
            uint32_t fd = s.gpr[4];
            uint32_t buf_addr = s.gpr[5];
            // 读取一个字节（打印字符）
            uint8_t ch = mem.read8(buf_addr);
            if (fd == 1 || fd == 2) {  // stdout/stderr
                std::cout << ch;
                std::cout.flush();
            }
            break;
        }
               // ------------- 未知系统调用 ----------------
        default:
            throw std::runtime_error(
                "Unsupported syscall: " + std::to_string(syscall_num));
        }
        s.pc = pc0 + 4;
        break;
    }

    case Opcode::INVALID:
    default:
        throw std::runtime_error("invalid instruction");
    }
    }
}