#pragma once
#include <cstdint>
#include "isa.h"

class Memory;

class CPU {
public:
    explicit CPU(Memory& mem);
    void reset(uint32_t pc_start);
    void step();
    void run(uint64_t max_steps = 100000);
    CPUState& state();
    const CPUState& state() const;

private:
    Memory& mem_;
    CPUState state_;
};