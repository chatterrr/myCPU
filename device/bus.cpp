#include "device/bus.h"

#include <cstddef>
#include <cstdint>
#include <stdexcept>

#include "device/Device.h"
#include "utils/debug.h"

namespace {

    bool range_contains(uint32_t base, uint32_t size, uint32_t addr, std::size_t width) {
        const uint64_t begin = addr;
        const uint64_t end = begin + static_cast<uint64_t>(width);
        const uint64_t map_begin = base;
        const uint64_t map_end = map_begin + static_cast<uint64_t>(size);
        return begin >= map_begin && end <= map_end;
    }

}  // namespace

void Bus::map_device(uint32_t base, uint32_t size, Device& device) {
    if (size == 0) {
        throw std::runtime_error("Bus::map_device requires a non-zero size.");
    }

    for (const Mapping& mapping : mappings_) {
        const uint64_t lhs_begin = mapping.base;
        const uint64_t lhs_end = lhs_begin + static_cast<uint64_t>(mapping.size);
        const uint64_t rhs_begin = base;
        const uint64_t rhs_end = rhs_begin + static_cast<uint64_t>(size);
        if (lhs_begin < rhs_end && rhs_begin < lhs_end) {
            throw std::runtime_error("Bus::map_device overlap detected.");
        }
    }

    mappings_.push_back(Mapping{ base, size, &device });
    device.attach_bus(this);
}

bool Bus::try_read8(uint32_t addr, uint8_t& value) const {
    const Mapping* mapping = find_mapping(addr, 1);
    if (mapping == nullptr) {
        return false;
    }

    value = mapping->device->read8(addr - mapping->base);
    trace_note_mem_access("read", addr, value, 1u, mapping->device->trace_name(), true);
    return true;
}

bool Bus::try_read16(uint32_t addr, uint16_t& value) const {
    const Mapping* mapping = find_mapping(addr, 2);
    if (mapping == nullptr) {
        return false;
    }

    value = mapping->device->read16(addr - mapping->base);
    trace_note_mem_access("read", addr, value, 2u, mapping->device->trace_name(), true);
    return true;
}

bool Bus::try_read32(uint32_t addr, uint32_t& value) const {
    const Mapping* mapping = find_mapping(addr, 4);
    if (mapping == nullptr) {
        return false;
    }

    value = mapping->device->read32(addr - mapping->base);
    trace_note_mem_access("read", addr, value, 4u, mapping->device->trace_name(), true);
    return true;
}

bool Bus::try_write8(uint32_t addr, uint8_t value) {
    Mapping* mapping = find_mapping(addr, 1);
    if (mapping == nullptr) {
        return false;
    }

    mapping->device->write8(addr - mapping->base, value);
    trace_note_mem_access("write", addr, value, 1u, mapping->device->trace_name(), true);
    return true;
}

bool Bus::try_write16(uint32_t addr, uint16_t value) {
    Mapping* mapping = find_mapping(addr, 2);
    if (mapping == nullptr) {
        return false;
    }

    mapping->device->write16(addr - mapping->base, value);
    trace_note_mem_access("write", addr, value, 2u, mapping->device->trace_name(), true);
    return true;
}

bool Bus::try_write32(uint32_t addr, uint32_t value) {
    Mapping* mapping = find_mapping(addr, 4);
    if (mapping == nullptr) {
        return false;
    }

    mapping->device->write32(addr - mapping->base, value);
    trace_note_mem_access("write", addr, value, 4u, mapping->device->trace_name(), true);
    return true;
}

void Bus::tick_devices() {
    for (const Mapping& mapping : mappings_) {
        mapping.device->tick();
    }
}

void Bus::raise_interrupt(TrapCause cause) {
    if (!pending_interrupt_.has_value()) {
        pending_interrupt_ = cause;
    }
}

bool Bus::has_pending_interrupt() const noexcept {
    return pending_interrupt_.has_value();
}

std::optional<TrapCause> Bus::consume_pending_interrupt() {
    const std::optional<TrapCause> cause = pending_interrupt_;
    pending_interrupt_.reset();
    return cause;
}

Bus::Mapping* Bus::find_mapping(uint32_t addr, std::size_t width) {
    for (Mapping& mapping : mappings_) {
        if (range_contains(mapping.base, mapping.size, addr, width)) {
            return &mapping;
        }
    }
    return nullptr;
}

const Bus::Mapping* Bus::find_mapping(uint32_t addr, std::size_t width) const {
    for (const Mapping& mapping : mappings_) {
        if (range_contains(mapping.base, mapping.size, addr, width)) {
            return &mapping;
        }
    }
    return nullptr;
}
