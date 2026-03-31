#include "loader/loader.h"

#include <fstream>
#include <iterator>
#include <stdexcept>
#include <vector>

#include "memory/memory.h"

namespace Loader {

void load_program_words(Memory& mem, uint32_t base, const std::vector<uint32_t>& words) {
    for (std::size_t i = 0; i < words.size(); ++i) {
        mem.write32(base + static_cast<uint32_t>(i * 4u), words[i]);
    }
}

void load_program_bin(Memory& mem, uint32_t base, const std::string& path) {
    std::ifstream fin(path, std::ios::binary);
    if (!fin) {
        throw std::runtime_error("Failed to open binary file: " + path);
    }

    std::vector<char> bytes((std::istreambuf_iterator<char>(fin)), std::istreambuf_iterator<char>());
    for (std::size_t i = 0; i < bytes.size(); ++i) {
        mem.write8(base + static_cast<uint32_t>(i), static_cast<uint8_t>(bytes[i]));
    }
}

}  // namespace Loader
