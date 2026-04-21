#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
#include <vector>

#include "cpu/trap.h"

class Device;

class Bus {
public:
    void map_device(uint32_t base, uint32_t size, Device& device);

    bool try_read8(uint32_t addr, uint8_t& value) const;
    bool try_read16(uint32_t addr, uint16_t& value) const;
    bool try_read32(uint32_t addr, uint32_t& value) const;

    bool try_write8(uint32_t addr, uint8_t value);
    bool try_write16(uint32_t addr, uint16_t value);
    bool try_write32(uint32_t addr, uint32_t value);

    void tick_devices();

    void raise_interrupt(TrapCause cause);
    bool has_pending_interrupt() const noexcept;
    std::optional<TrapCause> consume_pending_interrupt();

private:
    struct Mapping {
        uint32_t base = 0;
        uint32_t size = 0;
        Device* device = nullptr;
    };

    Mapping* find_mapping(uint32_t addr, std::size_t width);
    const Mapping* find_mapping(uint32_t addr, std::size_t width) const;

    std::vector<Mapping> mappings_;
    std::optional<TrapCause> pending_interrupt_;
};
