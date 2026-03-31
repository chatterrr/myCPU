#pragma once

#include <cstdint>
#include <string>
#include <vector>

class Memory;

namespace Loader {

void load_program_words(Memory& mem, uint32_t base, const std::vector<uint32_t>& words);
void load_program_bin(Memory& mem, uint32_t base, const std::string& path);

}  // namespace Loader
