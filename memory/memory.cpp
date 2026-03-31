#include "memory/memory.h"

#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>

#include "config/constants.h"

namespace {
std::string hex32(uint32_t value) {
    std::ostringstream oss;
    oss << "0x" << std::hex << std::uppercase << value;
    return oss.str();
}
}

Memory::Memory(std::size_t size) : data_(size, 0), uart_(std::cout) {
    if (size == 0) {
        throw std::runtime_error("Memory size must be greater than zero");
    }
}

void Memory::check_range(uint32_t addr, std::size_t width) const {
    const uint64_t end = static_cast<uint64_t>(addr) + static_cast<uint64_t>(width);
    if (end > static_cast<uint64_t>(data_.size())) {
        throw std::runtime_error(
            "Memory access out of range: addr=" + hex32(addr) +
            ", width=" + std::to_string(width));
    }
}

void Memory::check_alignment(uint32_t addr, std::size_t align) {
    if (addr % align != 0) {
        throw std::runtime_error(
            "Unaligned memory access: addr=" + hex32(addr) +
            ", align=" + std::to_string(align));
    }
}

bool Memory::is_uart_addr(uint32_t addr) const noexcept {
    return addr == config::UART_ADDR;
}

void Memory::write_uart_low_byte(uint32_t value) {
    uart_.write_byte(static_cast<uint8_t>(value & 0xFFu));
}

uint8_t Memory::read8(uint32_t addr) const {
    if (is_uart_addr(addr)) {
        return 0;
    }
    check_range(addr, 1);
    return data_[addr];
}

uint16_t Memory::read16(uint32_t addr) const {
    check_alignment(addr, 2);
    if (is_uart_addr(addr)) {
        return 0;
    }
    check_range(addr, 2);
    return static_cast<uint16_t>(data_[addr]) |
           (static_cast<uint16_t>(data_[addr + 1]) << 8u);
}

uint32_t Memory::read32(uint32_t addr) const {
    check_alignment(addr, 4);
    if (is_uart_addr(addr)) {
        return 0;
    }
    check_range(addr, 4);
    return static_cast<uint32_t>(data_[addr]) |
           (static_cast<uint32_t>(data_[addr + 1]) << 8u) |
           (static_cast<uint32_t>(data_[addr + 2]) << 16u) |
           (static_cast<uint32_t>(data_[addr + 3]) << 24u);
}

void Memory::write8(uint32_t addr, uint8_t value) {
    if (is_uart_addr(addr)) {
        write_uart_low_byte(value);
        return;
    }
    check_range(addr, 1);
    data_[addr] = value;
}

void Memory::write16(uint32_t addr, uint16_t value) {
    check_alignment(addr, 2);
    if (is_uart_addr(addr)) {
        write_uart_low_byte(value);
        return;
    }
    check_range(addr, 2);
    data_[addr] = static_cast<uint8_t>(value & 0xFFu);
    data_[addr + 1] = static_cast<uint8_t>((value >> 8u) & 0xFFu);
}

void Memory::write32(uint32_t addr, uint32_t value) {
    check_alignment(addr, 4);
    if (is_uart_addr(addr)) {
        write_uart_low_byte(value);
        return;
    }
    check_range(addr, 4);
    data_[addr] = static_cast<uint8_t>(value & 0xFFu);
    data_[addr + 1] = static_cast<uint8_t>((value >> 8u) & 0xFFu);
    data_[addr + 2] = static_cast<uint8_t>((value >> 16u) & 0xFFu);
    data_[addr + 3] = static_cast<uint8_t>((value >> 24u) & 0xFFu);
}
