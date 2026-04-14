#include <cstdint>
#include <exception>
#include <fstream>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>

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

    const std::vector<uint32_t>& resolve_builtin_program(const std::string& name) {
        if (name == "smoke") return tests::kSmokeProgramWords;
        if (name == "arith") return tests::kArithProgramWords;
        if (name == "logic") return tests::kLogicProgramWords;
        if (name == "mem") return tests::kMemProgramWords;
        if (name == "branch") return tests::kBranchProgramWords;
        if (name == "r0") return tests::kR0WriteProtectProgramWords;
        if (name == "slt") return tests::kSltProgramWords;
        if (name == "lu12i") return tests::kLu12iProgramWords;
        if (name == "uart") return tests::kUartProgramWords;
        if (name == "pipeline-nohaz") return tests::kPipelineNoHazardProgramWords;
        if (name == "pipeline-raw") return tests::kPipelineRawHazardProgramWords;

        throw std::runtime_error(
            "Unknown built-in program: " + name +
            ". Supported names: smoke, arith, logic, mem, branch, r0, slt, lu12i, uart, pipeline-nohaz, pipeline-raw");
    }

    void print_usage(const char* argv0) {
        std::cout
            << "Usage:\n"
            << "  " << argv0 << " [--pipeline] --bin <program.bin> [--base <addr>] [--entry <addr>] [--max-steps N] [--dump-regs] [--trace <trace.jsonl>]\n"
            << "  " << argv0 << " [--pipeline] --use-program <name> [--base <addr>] [--entry <addr>] [--max-steps N] [--dump-regs] [--trace <trace.jsonl>]\n"
            << "  " << argv0 << " [--pipeline] --use-smoke [--base <addr>] [--entry <addr>] [--max-steps N] [--dump-regs] [--trace <trace.jsonl>]\n\n"
            << "Options:\n"
            << "  --bin <path>         Load program from a raw binary file.\n"
            << "  --use-program <name> Load a built-in program from tests/test_programs.h.\n"
            << "  --use-smoke          Alias of --use-program smoke.\n"
            << "  --pipeline           Run in minimal 5-stage pipeline mode.\n"
            << "  --base <addr>        Load address, supports decimal or hex.\n"
            << "  --entry <addr>       Initial PC, supports decimal or hex.\n"
            << "  --max-steps <N>      Maximum number of instructions to run.\n"
            << "  --dump-regs          Dump registers after execution.\n"
            << "  --trace <path>       Write JSONL execution trace for visualization.\n"
            << "  -h, --help           Show this help message.\n\n"
            << "Built-in programs:\n"
            << "  smoke, arith, logic, mem, branch, r0, slt, lu12i, uart, pipeline-nohaz, pipeline-raw\n\n"
            << "Notes:\n"
            << "  Exactly one of --bin, --use-program, or --use-smoke must be provided.\n"
            << "  If --entry is not given, it defaults to the load base address.\n";
    }

}  // namespace

int main(int argc, char* argv[]) {
    std::ofstream trace_out;

    try {
        bool use_smoke = false;
        bool dump_regs_on_exit = false;
        bool entry_explicit = false;
        bool pipeline_mode = false;

        std::string bin_path;
        std::string builtin_program_name;
        std::string trace_path;

        uint64_t max_steps = config::DEFAULT_MAX_STEPS;
        uint32_t load_base = config::PROGRAM_BASE;
        uint32_t entry_pc = config::PROGRAM_BASE;

        for (int i = 1; i < argc; ++i) {
            const std::string arg = argv[i];

            if (arg == "--bin" && i + 1 < argc) {
                bin_path = argv[++i];
            }
            else if (arg == "--use-program" && i + 1 < argc) {
                builtin_program_name = argv[++i];
            }
            else if (arg == "--use-smoke") {
                use_smoke = true;
            }
            else if (arg == "--pipeline") {
                pipeline_mode = true;
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
            else if (arg == "--trace" && i + 1 < argc) {
                trace_path = argv[++i];
            }
            else if (arg == "-h" || arg == "--help") {
                print_usage(argv[0]);
                return 0;
            }
            else {
                throw std::runtime_error("Unknown argument: " + arg);
            }
        }

        if (use_smoke) {
            if (!builtin_program_name.empty()) {
                throw std::runtime_error("Do not use --use-smoke together with --use-program.");
            }
            builtin_program_name = "smoke";
        }

        const bool has_bin = !bin_path.empty();
        const bool has_builtin = !builtin_program_name.empty();

        if ((has_bin ? 1 : 0) + (has_builtin ? 1 : 0) != 1) {
            print_usage(argv[0]);
            return 1;
        }

        Memory mem(config::MEM_SIZE);
        std::string program_name;

        if (has_builtin) {
            const auto& words = resolve_builtin_program(builtin_program_name);
            if (words.empty()) {
                throw std::runtime_error(
                    "Built-in program is empty: " + builtin_program_name);
            }
            Loader::load_program_words(mem, load_base, words);
            program_name = builtin_program_name;
        }
        else {
            Loader::load_program_bin(mem, load_base, bin_path);
            program_name = bin_path;
        }

        if (!trace_path.empty()) {
            trace_out.open(trace_path, std::ios::out | std::ios::trunc);
            if (!trace_out) {
                throw std::runtime_error("Failed to open trace output file: " + trace_path);
            }
            set_trace_stream(&trace_out);
            trace_meta_jsonl(program_name, load_base, entry_pc, max_steps);
        }

        CPU cpu(mem);
        cpu.set_pipeline_mode(pipeline_mode);
        cpu.reset(entry_pc);

        cpu.run(max_steps);

        if (trace_enabled()) {
            trace_summary_jsonl(cpu.state());
            clear_trace_stream();
            trace_out.close();
        }

        if (dump_regs_on_exit) {
            dump_regs(cpu.state());
        }

        std::cout << "[DONE] Program finished. exit_code=" << cpu.state().exit_code << '\n';
        return cpu.state().exit_code;
    }
    catch (const std::exception& ex) {
        if (trace_enabled()) {
            clear_trace_stream();
        }
        std::cerr << "[FATAL] " << ex.what() << '\n';
        return 1;
    }
}
