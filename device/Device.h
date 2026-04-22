#pragma once

#include <cstdint>

class Bus;

class Device {
public:
    virtual ~Device() = default;

    virtual const char* trace_name() const noexcept {
        return "device";
    }

    virtual uint8_t read8(uint32_t offset) const = 0;
    virtual uint16_t read16(uint32_t offset) const = 0;
    virtual uint32_t read32(uint32_t offset) const = 0;

    virtual void write8(uint32_t offset, uint8_t value) = 0;
    virtual void write16(uint32_t offset, uint16_t value) = 0;
    virtual void write32(uint32_t offset, uint32_t value) = 0;

    virtual void tick() {}

    virtual void attach_bus(Bus* bus) {
        bus_ = bus;
    }

protected:
    Bus* bus() const noexcept {
        return bus_;
    }

private:
    Bus* bus_ = nullptr;
};
