#pragma once

#include <cstdint>

#include "device/Device.h"

struct TimerSnapshot {
    uint32_t control = 0;
    uint32_t interval = 0;
    uint32_t remaining = 0;
    bool enabled = false;
    bool periodic = false;
    bool interrupt_enabled = false;
};

class TimerDevice : public Device {
public:
    const char* trace_name() const noexcept override {
        return "timer";
    }

    uint8_t read8(uint32_t offset) const override;
    uint16_t read16(uint32_t offset) const override;
    uint32_t read32(uint32_t offset) const override;

    void write8(uint32_t offset, uint8_t value) override;
    void write16(uint32_t offset, uint16_t value) override;
    void write32(uint32_t offset, uint32_t value) override;

    void tick() override;
    TimerSnapshot snapshot() const noexcept;

private:
    uint32_t read_register(uint32_t aligned_offset) const;
    void write_register(uint32_t aligned_offset, uint32_t value);
    void refresh_after_control_write();

    uint32_t control_ = 0;
    uint32_t interval_ = 0;
    uint32_t remaining_ = 0;
};
