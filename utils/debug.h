#pragma once

#include <cstdint>

#include "cpu/isa.h"

void dump_regs(const CPUState& cpu);
void dump_inst(uint32_t pc, uint32_t raw, const DecodedInst& inst);
const char* opcode_to_string(Opcode op);

#ifdef DEBUG_TRACE
#define MYCPU_TRACE(stmt) do { stmt; } while (0)
#else
#define MYCPU_TRACE(stmt) do { } while (0)
#endif
