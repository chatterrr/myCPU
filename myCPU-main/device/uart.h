#pragma once

#include <cstdint>
#include <iosfwd>

class UART {
public:
    explicit UART(std::ostream& out);
    void write_byte(uint8_t ch);

private:
    std::ostream* out_;
};
