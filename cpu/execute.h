#pragma once
#include "isa.h"

class Memory; // 或者 #include "memory.h"（取决于你们 include 风格）

void execute(CPUState& state, const DecodedInst& inst, Memory& mem);