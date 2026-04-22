#pragma once

#include <optional>

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
    bool interrupts_enabled() const noexcept;
    bool exception_level_active() const noexcept;
    bool has_exception_handler() const;
    void stop_cpu(CPUState::StopReason reason, int exit_code) noexcept;
    void enter_trap(
        TrapCause cause,
        uint32_t trap_pc,
        uint32_t resume_pc,
        bool is_interrupt,
        std::optional<uint32_t> badv = std::nullopt);
    void handle_trap_exception(
        const TrapException& ex,
        uint32_t trap_pc,
        uint32_t raw,
        const DecodedInst& inst,
        const CPUState& before);
    void reset_pipeline();
    void advance_pipeline_skeleton(uint32_t fetched_pc, uint32_t fetched_raw);
    void step_single_cycle();
    void step_pipeline_mode();

    Memory& mem_;
    CPUState state_;
    PipelineState pipeline_;
    bool pipeline_mode_ = false;
};
