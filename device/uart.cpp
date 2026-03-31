#include "device/uart.h"

#include <iostream>
#include <stdexcept>

UART::UART(std::ostream& out) : out_(&out) {
    if (out_ == nullptr) {
        throw std::runtime_error("UART output stream is null");
    }
}

void UART::write_byte(uint8_t ch) {
    out_->put(static_cast<char>(ch));
    out_->flush();
}
