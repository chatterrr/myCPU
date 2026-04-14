#pragma once
#include <cstdint>
#include "isa.h"

class Memory;

class CPU {
public:
    explicit CPU(Memory& mem);
    void reset(uint32_t pc_start);
    void set_pipeline_mode(bool enabled);
    void step();
    void run(uint64_t max_steps = 100000);
    CPUState& state();
    const CPUState& state() const;

private:
    void reset_pipeline();
    void advance_pipeline_skeleton(uint32_t fetched_pc, uint32_t fetched_raw);
    void step_single_cycle();
    void step_pipeline_mode();

    Memory& mem_;
    CPUState state_;
    PipelineState pipeline_;
    bool pipeline_mode_ = false;
};
