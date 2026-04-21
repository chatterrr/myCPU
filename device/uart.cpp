#include "device/uart.h"

#include <iostream>
#include <stdexcept>

#include "utils/debug.h"

UART::UART(std::ostream& out) : out_(&out) {
    if (out_ == nullptr) {
        throw std::runtime_error("UART output stream is null");
    }
}

uint8_t UART::read8(uint32_t) const {
    return 0;
}

uint16_t UART::read16(uint32_t) const {
    return 0;
}

uint32_t UART::read32(uint32_t) const {
    return 0;
}

void UART::write8(uint32_t, uint8_t value) {
    write_byte(value);
}

void UART::write16(uint32_t, uint16_t value) {
    write_byte(static_cast<uint8_t>(value & 0xFFu));
}

void UART::write32(uint32_t, uint32_t value) {
    write_byte(static_cast<uint8_t>(value & 0xFFu));
}

void UART::write_byte(uint8_t ch) {
    out_->put(static_cast<char>(ch));
    out_->flush();
    trace_note_uart_char(ch);
}
