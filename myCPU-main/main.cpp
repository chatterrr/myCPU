#include <exception>
#include <iostream>
#include <string>

#include "config/constants.h"
#include "cpu/CPU.h"
#include "loader/loader.h"
#include "memory/memory.h"
#include "tests/test_programs.h"
#include "utils/debug.h"

namespace {

void print_usage(const char* argv0) {
    std::cout << "Usage:\n"
              << "  " << argv0 << " --bin <program.bin> [--max-steps N]\n"
              << "  " << argv0 << " --use-smoke [--max-steps N]\n\n"
              << "说明：\n"
              << "  --use-smoke 会加载 tests/test_programs.h 里的硬编码 word 程序。\n"
              << "  你需要先把成员 A 已确认编码正确的指令字填进去。\n";
}

}  // namespace

int main(int argc, char* argv[]) {
    try {
        bool use_smoke = false;
        std::string bin_path;
        uint64_t max_steps = config::DEFAULT_MAX_STEPS;

        for (int i = 1; i < argc; ++i) {
            const std::string arg = argv[i];
            if (arg == "--bin" && i + 1 < argc) {
                bin_path = argv[++i];
            } else if (arg == "--use-smoke") {
                use_smoke = true;
            } else if (arg == "--max-steps" && i + 1 < argc) {
                max_steps = std::stoull(argv[++i]);
            } else if (arg == "-h" || arg == "--help") {
                print_usage(argv[0]);
                return 0;
            } else {
                throw std::runtime_error("Unknown argument: " + arg);
            }
        }

        if (!use_smoke && bin_path.empty()) {
            print_usage(argv[0]);
            return 1;
        }

        Memory mem(config::MEM_SIZE);

        if (use_smoke) {
            if (tests::kSmokeProgramWords.empty()) {
                throw std::runtime_error(
                    "kSmokeProgramWords 目前为空，请先填入已确认编码正确的 LoongArch 指令字。");
            }
            Loader::load_program_words(mem, config::PROGRAM_BASE, tests::kSmokeProgramWords);
        }

        if (!bin_path.empty()) {
            Loader::load_program_bin(mem, config::PROGRAM_BASE, bin_path);
        }

        CPU cpu(mem);
        cpu.reset(config::PROGRAM_BASE);
        cpu.state().gpr[config::DEFAULT_SP_REG] = config::STACK_TOP;

        cpu.run(max_steps);
        dump_regs(cpu.state());
        std::cout << "[DONE] Program finished. exit_code=" << cpu.state().exit_code << '\n';
        return cpu.state().exit_code;
    } catch (const std::exception& ex) {
        std::cerr << "[FATAL] " << ex.what() << '\n';
        return 1;
    }
}
