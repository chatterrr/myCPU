#include "loader/loader.h"

#include <cstdint>
#include <fstream>
#include <iterator>
#include <limits>
#include <sstream>
#include <stdexcept>
#include <vector>

#include "memory/memory.h"

namespace {

    void validate_word_load_request(uint32_t base, std::size_t word_count) {
        if (word_count == 0) {
            throw std::runtime_error("Loader::load_program_words received an empty program.");
        }
        if ((base & 0x3u) != 0u) {
            throw std::runtime_error("Loader::load_program_words requires a 4-byte aligned base address.");
        }

        const uint64_t total_bytes = static_cast<uint64_t>(word_count) * 4ull;
        const uint64_t end_exclusive = static_cast<uint64_t>(base) + total_bytes;
        if (end_exclusive > static_cast<uint64_t>(std::numeric_limits<uint32_t>::max()) + 1ull) {
            throw std::runtime_error("Loader::load_program_words address calculation overflowed 32-bit address space.");
        }
    }

    void validate_byte_load_request(uint32_t base, std::size_t byte_count) {
        if (byte_count == 0) {
            throw std::runtime_error("Loader::load_program_bin received an empty binary.");
        }

        const uint64_t end_exclusive = static_cast<uint64_t>(base) + static_cast<uint64_t>(byte_count);
        if (end_exclusive > static_cast<uint64_t>(std::numeric_limits<uint32_t>::max()) + 1ull) {
            throw std::runtime_error("Loader::load_program_bin address calculation overflowed 32-bit address space.");
        }
    }

    std::runtime_error make_loader_error(
        const char* func_name,
        uint32_t addr,
        std::size_t index,
        const std::exception& cause) {
        std::ostringstream oss;
        oss << func_name
            << " failed at index=" << index
            << ", addr=0x" << std::hex << addr
            << ": " << cause.what();
        return std::runtime_error(oss.str());
    }

}  // namespace

namespace Loader {

    void load_program_words(Memory& mem, uint32_t base, const std::vector<uint32_t>& words) {
        validate_word_load_request(base, words.size());

        for (std::size_t i = 0; i < words.size(); ++i) {
            const uint32_t addr = base + static_cast<uint32_t>(i * 4u);
            try {
                mem.write32(addr, words[i]);
            }
            catch (const std::exception& ex) {
                throw make_loader_error("Loader::load_program_words", addr, i, ex);
            }
        }
    }

    void load_program_bin(Memory& mem, uint32_t base, const std::string& path) {
        std::ifstream fin(path, std::ios::binary);
        if (!fin) {
            throw std::runtime_error("Failed to open binary file: " + path);
        }

        std::vector<char> bytes((std::istreambuf_iterator<char>(fin)),
            std::istreambuf_iterator<char>());

        validate_byte_load_request(base, bytes.size());

        for (std::size_t i = 0; i < bytes.size(); ++i) {
            const uint32_t addr = base + static_cast<uint32_t>(i);
            try {
                mem.write8(addr, static_cast<uint8_t>(bytes[i]));
            }
            catch (const std::exception& ex) {
                throw make_loader_error("Loader::load_program_bin", addr, i, ex);
            }
        }
    }

}  // namespace Loader