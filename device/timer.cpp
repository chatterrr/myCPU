#include "device/timer.h"

#include <cstdint>
#include <stdexcept>

#include "config/constants.h"
#include "device/bus.h"
#include "utils/debug.h"

namespace {

    constexpr uint32_t kTimerControlOffset = 0x0u;
    constexpr uint32_t kTimerIntervalOffset = 0x4u;
    constexpr uint32_t kTimerRemainingOffset = 0x8u;

    uint32_t byte_shift(uint32_t offset) {
        return (offset & 0x3u) * 8u;
    }

}  // namespace

uint8_t TimerDevice::read8(uint32_t offset) const {
    const uint32_t value = read_register(offset & ~0x3u);
    return static_cast<uint8_t>((value >> byte_shift(offset)) & 0xFFu);
}

uint16_t TimerDevice::read16(uint32_t offset) const {
    const uint32_t value = read_register(offset & ~0x3u);
    return static_cast<uint16_t>((value >> byte_shift(offset)) & 0xFFFFu);
}

uint32_t TimerDevice::read32(uint32_t offset) const {
    return read_register(offset);
}

void TimerDevice::write8(uint32_t offset, uint8_t value) {
    const uint32_t aligned_offset = offset & ~0x3u;
    const uint32_t shift = byte_shift(offset);
    const uint32_t mask = 0xFFu << shift;
    const uint32_t current = read_register(aligned_offset);
    write_register(aligned_offset, (current & ~mask) | (static_cast<uint32_t>(value) << shift));
}

void TimerDevice::write16(uint32_t offset, uint16_t value) {
    const uint32_t aligned_offset = offset & ~0x3u;
    const uint32_t shift = byte_shift(offset);
    const uint32_t mask = 0xFFFFu << shift;
    const uint32_t current = read_register(aligned_offset);
    write_register(aligned_offset, (current & ~mask) | (static_cast<uint32_t>(value) << shift));
}

void TimerDevice::write32(uint32_t offset, uint32_t value) {
    write_register(offset, value);
}

void TimerDevice::tick() {
    if ((control_ & config::TIMER_CTRL_ENABLE_BIT) == 0u || interval_ == 0u) {
        return;
    }

    if (remaining_ > 0u) {
        --remaining_;
    }

    if (remaining_ != 0u) {
        return;
    }

    if ((control_ & config::TIMER_CTRL_INTERRUPT_ENABLE_BIT) != 0u && bus() != nullptr) {
        bus()->raise_interrupt(TrapCause::TimerInterrupt);
        trace_note_device_interrupt("timer", trap_cause_to_string(TrapCause::TimerInterrupt));
    }

    if ((control_ & config::TIMER_CTRL_PERIODIC_BIT) != 0u) {
        remaining_ = interval_;
    }
    else {
        control_ &= ~config::TIMER_CTRL_ENABLE_BIT;
    }
}

TimerSnapshot TimerDevice::snapshot() const noexcept {
    TimerSnapshot snapshot{};
    snapshot.control = control_;
    snapshot.interval = interval_;
    snapshot.remaining = remaining_;
    snapshot.enabled = (control_ & config::TIMER_CTRL_ENABLE_BIT) != 0u;
    snapshot.periodic = (control_ & config::TIMER_CTRL_PERIODIC_BIT) != 0u;
    snapshot.interrupt_enabled =
        (control_ & config::TIMER_CTRL_INTERRUPT_ENABLE_BIT) != 0u;
    return snapshot;
}

uint32_t TimerDevice::read_register(uint32_t aligned_offset) const {
    switch (aligned_offset) {
    case kTimerControlOffset:
        return control_;
    case kTimerIntervalOffset:
        return interval_;
    case kTimerRemainingOffset:
        return remaining_;
    default:
        throw std::runtime_error("Timer register read out of range.");
    }
}

void TimerDevice::write_register(uint32_t aligned_offset, uint32_t value) {
    switch (aligned_offset) {
    case kTimerControlOffset:
        control_ = value & config::TIMER_CONTROL_WRITABLE_MASK;
        refresh_after_control_write();
        return;
    case kTimerIntervalOffset:
        interval_ = value;
        if ((control_ & config::TIMER_CTRL_ENABLE_BIT) != 0u) {
            remaining_ = interval_;
        }
        return;
    case kTimerRemainingOffset:
        remaining_ = value;
        return;
    default:
        throw std::runtime_error("Timer register write out of range.");
    }
}

void TimerDevice::refresh_after_control_write() {
    if ((control_ & config::TIMER_CTRL_ENABLE_BIT) != 0u) {
        if (remaining_ == 0u) {
            remaining_ = interval_;
        }
    }
    else {
        remaining_ = 0u;
    }
}
