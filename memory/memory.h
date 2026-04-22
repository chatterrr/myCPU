#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
#include <vector>

#include "device/bus.h"
#include "device/timer.h"
#include "device/uart.h"

class Memory {
public:
    explicit Memory(std::size_t size);

    uint32_t fetch32(uint32_t addr) const;

    uint8_t read8(uint32_t addr) const;
    uint16_t read16(uint32_t addr) const;
    uint32_t read32(uint32_t addr) const;

    void write8(uint32_t addr, uint8_t value);
    void write16(uint32_t addr, uint16_t value);
    void write32(uint32_t addr, uint32_t value);

    std::size_t size() const noexcept { return data_.size(); }
    void tick_devices();
    bool has_pending_interrupt() const noexcept;
    std::optional<TrapCause> consume_pending_interrupt();
    TimerSnapshot timer_snapshot() const noexcept;

private:
    void check_range(uint32_t addr, std::size_t width) const;
    static void check_alignment(uint32_t addr, std::size_t align);
    uint32_t read32_impl(uint32_t addr, bool trace_access) const;

    std::vector<uint8_t> data_;
    Bus bus_;
    UART uart_;
    TimerDevice timer_;
};
