#include <cstdint>
#include <exception>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string>

#include "config/constants.h"
#include "cpu/CPU.h"
#include "loader/loader.h"
#include "memory/memory.h"
#include "tests/test_programs.h"
#include "utils/debug.h"

namespace {

    uint32_t parse_u32_arg(const std::string& text, const char* name) {
        std::size_t pos = 0;
        unsigned long value = 0;
        try {
            value = std::stoul(text, &pos, 0);
        }
        catch (const std::exception&) {
            throw std::runtime_error(std::string("Invalid value for ") + name + ": " + text);
        }

        if (pos != text.size()) {
            throw std::runtime_error(std::string("Invalid value for ") + name + ": " + text);
        }
        if (value > std::numeric_limits<uint32_t>::max()) {
            throw std::runtime_error(std::string("Value out of range for ") + name + ": " + text);
        }
        return static_cast<uint32_t>(value);
    }

    uint64_t parse_u64_arg(const std::string& text, const char* name) {
        std::size_t pos = 0;
        unsigned long long value = 0;
        try {
            value = std::stoull(text, &pos, 0);
        }
        catch (const std::exception&) {
            throw std::runtime_error(std::string("Invalid value for ") + name + ": " + text);
        }

        if (pos != text.size()) {
            throw std::runtime_error(std::string("Invalid value for ") + name + ": " + text);
        }
        return static_cast<uint64_t>(value);
    }

    void print_usage(const char* argv0) {
        std::cout
            << "Usage:\n"
            << "  " << argv0 << " --bin <program.bin> [--base <addr>] [--entry <addr>] [--max-steps N] [--dump-regs]\n"
            << "  " << argv0 << " --use-smoke [--base <addr>] [--entry <addr>] [--max-steps N] [--dump-regs]\n\n"
            << "Options:\n"
            << "  --bin <path>       Load program from a raw binary file.\n"
            << "  --use-smoke        Load the built-in smoke program from tests/test_programs.h.\n"
            << "  --base <addr>      Load address, supports decimal or hex (for example 4096 or 0x1000).\n"
            << "  --entry <addr>     Initial PC, supports decimal or hex.\n"
            << "  --max-steps <N>    Maximum number of instructions to run.\n"
            << "  --dump-regs        Dump registers after execution.\n"
            << "  -h, --help         Show this help message.\n\n"
            << "Notes:\n"
            << "  Exactly one of --bin or --use-smoke must be provided.\n"
            << "  If --entry is not given, it defaults to the load base address.\n";
    }

}  // namespace

int main(int argc, char* argv[]) {
    try {
        bool use_smoke = false;
        bool dump_regs_on_exit = false;
        bool entry_explicit = false;

        std::string bin_path;
        uint64_t max_steps = config::DEFAULT_MAX_STEPS;
        uint32_t load_base = config::PROGRAM_BASE;
        uint32_t entry_pc = config::PROGRAM_BASE;

        for (int i = 1; i < argc; ++i) {
            const std::string arg = argv[i];

            if (arg == "--bin" && i + 1 < argc) {
                bin_path = argv[++i];
            }
            else if (arg == "--use-smoke") {
                use_smoke = true;
            }
            else if (arg == "--max-steps" && i + 1 < argc) {
                max_steps = parse_u64_arg(argv[++i], "--max-steps");
            }
            else if (arg == "--base" && i + 1 < argc) {
                load_base = parse_u32_arg(argv[++i], "--base");
                if (!entry_explicit) {
                    entry_pc = load_base;
                }
            }
            else if (arg == "--entry" && i + 1 < argc) {
                entry_pc = parse_u32_arg(argv[++i], "--entry");
                entry_explicit = true;
            }
            else if (arg == "--dump-regs") {
                dump_regs_on_exit = true;
            }
            else if (arg == "-h" || arg == "--help") {
                print_usage(argv[0]);
                return 0;
            }
            else {
                throw std::runtime_error("Unknown argument: " + arg);
            }
        }

        const bool has_bin = !bin_path.empty();
        if (use_smoke == has_bin) {
            print_usage(argv[0]);
            return 1;
        }

        Memory mem(config::MEM_SIZE);

        if (use_smoke) {
            if (tests::kSmokeProgramWords.empty()) {
                throw std::runtime_error(
                    "kSmokeProgramWords is empty. Fill in the confirmed LoongArch instruction words first.");
            }
            Loader::load_program_words(mem, load_base, tests::kSmokeProgramWords);
        }
        else {
            Loader::load_program_bin(mem, load_base, bin_path);
        }

        CPU cpu(mem);
        cpu.reset(entry_pc);

        cpu.run(max_steps);

        if (dump_regs_on_exit) {
            dump_regs(cpu.state());
        }

        std::cout << "[DONE] Program finished. exit_code=" << cpu.state().exit_code << '\n';
        return cpu.state().exit_code;
    }
    catch (const std::exception& ex) {
        std::cerr << "[FATAL] " << ex.what() << '\n';
        return 1;
    }
}