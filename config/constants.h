#pragma once

#include <cstddef>
#include <cstdint>

namespace config {

inline constexpr uint32_t PROGRAM_BASE = 0x00001000u;
inline constexpr uint32_t DATA_BASE    = 0x00010000u;
inline constexpr uint32_t STACK_TOP    = 0x0002FFFCu;
inline constexpr uint32_t UART_ADDR    = 0x1FE001E0u;
inline constexpr uint32_t UART_SIZE    = 0x00000004u;
inline constexpr uint32_t TIMER_ADDR   = 0x1FE00200u;
inline constexpr uint32_t TIMER_SIZE   = 0x00000010u;
inline constexpr uint32_t EXCEPTION_VECTOR_BASE = 0x00000080u;
inline constexpr std::size_t MEM_SIZE  = 0x00200000u;  // 2 MB

inline constexpr uint32_t TIMER_CTRL_ENABLE_BIT = 1u << 0;
inline constexpr uint32_t TIMER_CTRL_PERIODIC_BIT = 1u << 1;
inline constexpr uint32_t TIMER_CTRL_INTERRUPT_ENABLE_BIT = 1u << 2;
inline constexpr uint32_t TIMER_CONTROL_WRITABLE_MASK =
    TIMER_CTRL_ENABLE_BIT |
    TIMER_CTRL_PERIODIC_BIT |
    TIMER_CTRL_INTERRUPT_ENABLE_BIT;

// 课程第一阶段可统一把 r3 当作 sp。
inline constexpr std::size_t DEFAULT_SP_REG = 3;
inline constexpr uint64_t DEFAULT_MAX_STEPS = 100000;

}  // namespace config
