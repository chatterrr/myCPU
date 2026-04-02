#include <cstdio>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>

#include "config/constants.h"
#include "loader/loader.h"
#include "memory/memory.h"

namespace {

    void expect(bool cond, const std::string& msg) {
        if (!cond) {
            throw std::runtime_error("[TEST FAIL] " + msg);
        }
    }

    void test_memory_little_endian() {
        Memory mem(1024);
        mem.write32(0x20, 0x11223344u);
        expect(mem.read8(0x20) == 0x44u, "read8 low byte mismatch");
        expect(mem.read16(0x20) == 0x3344u, "read16 little-endian mismatch");
        expect(mem.read32(0x20) == 0x11223344u, "read32 mismatch");
    }

    void test_alignment_check() {
        Memory mem(1024);
        bool thrown = false;
        try {
            (void)mem.read32(0x02);
        }
        catch (const std::runtime_error&) {
            thrown = true;
        }
        expect(thrown, "unaligned read32 should throw");
    }

    void test_range_check() {
        Memory mem(32);
        bool thrown = false;
        try {
            mem.write32(31, 0x1u);
        }
        catch (const std::runtime_error&) {
            thrown = true;
        }
        expect(thrown, "out-of-range write32 should throw");
    }

    void test_loader_words() {
        Memory mem(4096);
        Loader::load_program_words(mem, 0x100, { 0xAABBCCDDu, 0x11223344u });
        expect(mem.read32(0x100) == 0xAABBCCDDu, "load_program_words first word mismatch");
        expect(mem.read32(0x104) == 0x11223344u, "load_program_words second word mismatch");
    }

    void test_loader_empty_program() {
        Memory mem(4096);
        bool thrown = false;
        try {
            Loader::load_program_words(mem, 0x100, {});
        }
        catch (const std::runtime_error&) {
            thrown = true;
        }
        expect(thrown, "empty program should throw");
    }

    void test_loader_base_out_of_range() {
        Memory mem(64);
        bool thrown = false;
        try {
            Loader::load_program_words(mem, 0x100, { 0x11223344u });
        }
        catch (const std::runtime_error&) {
            thrown = true;
        }
        expect(thrown, "out-of-range base should throw");
    }

    void test_loader_program_overflow() {
        Memory mem(16);
        bool thrown = false;
        try {
            Loader::load_program_words(mem, 12, { 0xAAAABBBB, 0xCCCCDDDD });
        }
        catch (const std::runtime_error&) {
            thrown = true;
        }
        expect(thrown, "program overflow should throw");
    }

    void test_loader_bin() {
        const std::string path = "member_b_tmp.bin";
        {
            std::ofstream fout(path, std::ios::binary);
            const unsigned char payload[] = { 0x78, 0x56, 0x34, 0x12, 0xAB };
            fout.write(reinterpret_cast<const char*>(payload), sizeof(payload));
        }

        Memory mem(4096);
        Loader::load_program_bin(mem, 0x80, path);
        expect(mem.read32(0x80) == 0x12345678u, "load_program_bin word mismatch");
        expect(mem.read8(0x84) == 0xABu, "load_program_bin tail byte mismatch");

        std::remove(path.c_str());
    }

    void test_loader_empty_bin() {
        const std::string path = "member_b_empty.bin";
        {
            std::ofstream fout(path, std::ios::binary);
        }

        Memory mem(4096);
        bool thrown = false;
        try {
            Loader::load_program_bin(mem, 0x80, path);
        }
        catch (const std::runtime_error&) {
            thrown = true;
        }

        std::remove(path.c_str());
        expect(thrown, "empty binary should throw");
    }

    void test_uart_mapping() {
        std::ostringstream capture;
        auto* old_buf = std::cout.rdbuf(capture.rdbuf());
        {
            Memory mem(1024);
            mem.write8(config::UART_ADDR, static_cast<uint8_t>('H'));
            mem.write16(config::UART_ADDR, static_cast<uint16_t>('i'));
            mem.write32(config::UART_ADDR, static_cast<uint32_t>('!'));
        }
        std::cout.rdbuf(old_buf);
        expect(capture.str() == "Hi!", "UART output mismatch");
    }

}  // namespace

int main() {
    try {
        test_memory_little_endian();
        test_alignment_check();
        test_range_check();

        test_loader_words();
        test_loader_empty_program();
        test_loader_base_out_of_range();
        test_loader_program_overflow();

        test_loader_bin();
        test_loader_empty_bin();

        test_uart_mapping();

        std::cout << "[PASS] member B support layer tests all passed.\n";
        return 0;
    }
    catch (const std::exception& ex) {
        std::cerr << ex.what() << '\n';
        return 1;
    }
}