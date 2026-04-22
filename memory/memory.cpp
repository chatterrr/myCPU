#include "memory/memory.h"

#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>

#include "config/constants.h"
#include "cpu/trap.h"
#include "utils/debug.h"

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

    bus_.map_device(config::UART_ADDR, config::UART_SIZE, uart_);
    bus_.map_device(config::TIMER_ADDR, config::TIMER_SIZE, timer_);
}

void Memory::check_range(uint32_t addr, std::size_t width) const {
    const uint64_t end = static_cast<uint64_t>(addr) + static_cast<uint64_t>(width);
    if (end > static_cast<uint64_t>(data_.size())) {
        throw TrapException(
            TrapCause::AddressOutOfRange,
            addr,
            "Memory access out of range: addr=" + hex32(addr) +
            ", width=" + std::to_string(width));
    }
}

void Memory::check_alignment(uint32_t addr, std::size_t align) {
    if (addr % align != 0) {
        throw TrapException(
            TrapCause::UnalignedAccess,
            addr,
            "Unaligned memory access: addr=" + hex32(addr) +
            ", align=" + std::to_string(align));
    }
}

uint8_t Memory::read8(uint32_t addr) const {
    uint8_t value = 0;
    if (bus_.try_read8(addr, value)) {
        return value;
    }
    check_range(addr, 1);
    value = data_[addr];
    trace_note_mem_access("read", addr, value, 1u, "memory", false);
    return value;
}

uint16_t Memory::read16(uint32_t addr) const {
    check_alignment(addr, 2);
    uint16_t value = 0;
    if (bus_.try_read16(addr, value)) {
        return value;
    }
    check_range(addr, 2);
    value = static_cast<uint16_t>(data_[addr]) |
            (static_cast<uint16_t>(data_[addr + 1]) << 8u);
    trace_note_mem_access("read", addr, value, 2u, "memory", false);
    return value;
}

uint32_t Memory::read32(uint32_t addr) const {
    return read32_impl(addr, true);
}

uint32_t Memory::fetch32(uint32_t addr) const {
    return read32_impl(addr, false);
}

uint32_t Memory::read32_impl(uint32_t addr, bool trace_access) const {
    check_alignment(addr, 4);
    uint32_t value = 0;
    if (bus_.try_read32(addr, value)) {
        return value;
    }
    check_range(addr, 4);
    value = static_cast<uint32_t>(data_[addr]) |
            (static_cast<uint32_t>(data_[addr + 1]) << 8u) |
            (static_cast<uint32_t>(data_[addr + 2]) << 16u) |
            (static_cast<uint32_t>(data_[addr + 3]) << 24u);
    if (trace_access) {
        trace_note_mem_access("read", addr, value, 4u, "memory", false);
    }
    return value;
}

void Memory::write8(uint32_t addr, uint8_t value) {
    if (bus_.try_write8(addr, value)) {
        return;
    }
    check_range(addr, 1);
    data_[addr] = value;
    trace_note_mem_access("write", addr, value, 1u, "memory", false);
}

void Memory::write16(uint32_t addr, uint16_t value) {
    check_alignment(addr, 2);
    if (bus_.try_write16(addr, value)) {
        return;
    }
    check_range(addr, 2);
    data_[addr] = static_cast<uint8_t>(value & 0xFFu);
    data_[addr + 1] = static_cast<uint8_t>((value >> 8u) & 0xFFu);
    trace_note_mem_access("write", addr, value, 2u, "memory", false);
}

void Memory::write32(uint32_t addr, uint32_t value) {
    check_alignment(addr, 4);
    if (bus_.try_write32(addr, value)) {
        return;
    }
    check_range(addr, 4);
    data_[addr] = static_cast<uint8_t>(value & 0xFFu);
    data_[addr + 1] = static_cast<uint8_t>((value >> 8u) & 0xFFu);
    data_[addr + 2] = static_cast<uint8_t>((value >> 16u) & 0xFFu);
    data_[addr + 3] = static_cast<uint8_t>((value >> 24u) & 0xFFu);
    trace_note_mem_access("write", addr, value, 4u, "memory", false);
}

void Memory::tick_devices() {
    bus_.tick_devices();
}

bool Memory::has_pending_interrupt() const noexcept {
    return bus_.has_pending_interrupt();
}

std::optional<TrapCause> Memory::consume_pending_interrupt() {
    return bus_.consume_pending_interrupt();
}

TimerSnapshot Memory::timer_snapshot() const noexcept {
    return timer_.snapshot();
}
