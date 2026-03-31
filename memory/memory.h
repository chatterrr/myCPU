#pragma once

#include <cstddef>
#include <cstdint>
#include <vector>

#include "device/uart.h"

class Memory {
public:
    explicit Memory(std::size_t size);

    uint8_t read8(uint32_t addr) const;
    uint16_t read16(uint32_t addr) const;
    uint32_t read32(uint32_t addr) const;

    void write8(uint32_t addr, uint8_t value);
    void write16(uint32_t addr, uint16_t value);
    void write32(uint32_t addr, uint32_t value);

    std::size_t size() const noexcept { return data_.size(); }

private:
    void check_range(uint32_t addr, std::size_t width) const;
    static void check_alignment(uint32_t addr, std::size_t align);
    bool is_uart_addr(uint32_t addr) const noexcept;
    void write_uart_low_byte(uint32_t value);

    std::vector<uint8_t> data_;
    UART uart_;
};
