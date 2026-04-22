#pragma once

#include <cstdint>
#include <iosfwd>

#include "device/Device.h"

class UART : public Device {
public:
    explicit UART(std::ostream& out);

    const char* trace_name() const noexcept override {
        return "uart";
    }

    uint8_t read8(uint32_t offset) const override;
    uint16_t read16(uint32_t offset) const override;
    uint32_t read32(uint32_t offset) const override;

    void write8(uint32_t offset, uint8_t value) override;
    void write16(uint32_t offset, uint16_t value) override;
    void write32(uint32_t offset, uint32_t value) override;

    void write_byte(uint8_t ch);

private:
    std::ostream* out_;
};
