#pragma once

#include <cstdint>
#include <optional>
#include <stdexcept>
#include <string>

enum class TrapCause : uint32_t {
    None = 0,
    InvalidInstruction,
    AddressOutOfRange,
    UnalignedAccess,
    Breakpoint,
    Syscall,
    TimerInterrupt
};

inline const char* trap_cause_to_string(TrapCause cause) {
    switch (cause) {
    case TrapCause::None: return "none";
    case TrapCause::InvalidInstruction: return "invalid_instruction";
    case TrapCause::AddressOutOfRange: return "address_out_of_range";
    case TrapCause::UnalignedAccess: return "unaligned_access";
    case TrapCause::Breakpoint: return "breakpoint";
    case TrapCause::Syscall: return "syscall";
    case TrapCause::TimerInterrupt: return "timer_interrupt";
    }
    return "unknown";
}

class TrapException : public std::runtime_error {
public:
    TrapException(TrapCause cause, const std::string& message)
        : std::runtime_error(message), cause_(cause) {}

    TrapException(TrapCause cause, uint32_t fault_addr, const std::string& message)
        : std::runtime_error(message), cause_(cause), fault_addr_(fault_addr) {}

    TrapCause cause() const noexcept {
        return cause_;
    }

    const std::optional<uint32_t>& fault_addr() const noexcept {
        return fault_addr_;
    }

private:
    TrapCause cause_ = TrapCause::None;
    std::optional<uint32_t> fault_addr_;
};
