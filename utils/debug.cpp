#include "utils/debug.h"

#include <iomanip>
#include <iostream>
#include <ostream>
#include <sstream>
#include <string>

namespace {

    std::ostream* g_trace_stream = nullptr;
    uint64_t g_trace_step_counter = 0;

    struct TraceExtras {
        bool has_branch = false;
        bool branch_taken = false;

        bool has_mem_write = false;
        uint32_t mem_write_addr = 0;
        uint32_t mem_write_value = 0;

        bool has_uart = false;
        std::string uart_text;

        bool has_pipeline = false;
        TracePipelineInfo pipeline;
    };

    TraceExtras g_trace_extras{};

    std::string hex_u32(uint32_t value) {
        std::ostringstream oss;
        oss << "0x"
            << std::hex << std::setw(8) << std::setfill('0')
            << value;
        return oss.str();
    }

    void write_json_string(std::ostream& os, const std::string& s) {
        os << '"';
        for (char ch : s) {
            switch (ch) {
            case '\\': os << "\\\\"; break;
            case '"':  os << "\\\""; break;
            case '\n': os << "\\n";  break;
            case '\r': os << "\\r";  break;
            case '\t': os << "\\t";  break;
            default:   os << ch;     break;
            }
        }
        os << '"';
    }

    void write_json_string_array(std::ostream& os, const std::vector<std::string>& items) {
        os << "[";
        for (size_t i = 0; i < items.size(); ++i) {
            if (i > 0) {
                os << ",";
            }
            write_json_string(os, items[i]);
        }
        os << "]";
    }

    void write_trace_pipeline_stage(std::ostream& os, const TracePipelineStage& stage) {
        os << "{\"state\":";
        write_json_string(os, stage.state);

        if (stage.has_pc) {
            os << ",\"pc\":";
            write_json_string(os, hex_u32(stage.pc));
        }

        if (stage.has_raw) {
            os << ",\"raw\":";
            write_json_string(os, hex_u32(stage.raw));
        }

        if (!stage.op.empty()) {
            os << ",\"op\":";
            write_json_string(os, stage.op);
        }

        os << "}";
    }

}  // namespace

const char* opcode_to_string(Opcode op) {
    switch (op) {
    case Opcode::ADD_W:    return "ADD_W";
    case Opcode::SUB_W:    return "SUB_W";
    case Opcode::ADDI_W:   return "ADDI_W";
    case Opcode::SLT:      return "SLT";
    case Opcode::AND:      return "AND";
    case Opcode::OR:       return "OR";
    case Opcode::XOR:      return "XOR";
    case Opcode::LD_W:     return "LD_W";
    case Opcode::ST_W:     return "ST_W";
    case Opcode::B:        return "B";
    case Opcode::BEQ:      return "BEQ";
    case Opcode::BNE:      return "BNE";
    case Opcode::BLT:      return "BLT";
    case Opcode::BGE:      return "BGE";
    case Opcode::BLTU:     return "BLTU";
    case Opcode::BGEU:     return "BGEU";
    case Opcode::LU12I_W:  return "LU12I_W";
    case Opcode::INVALID:  return "INVALID";
    }
    return "UNKNOWN";
}

void dump_regs(const CPUState& cpu) {
    std::ios old_state(nullptr);
    old_state.copyfmt(std::cout);

    std::cout << "==== Registers ====\n";
    for (int i = 0; i < 32; ++i) {
        std::cout << "r" << std::dec << std::setw(2) << std::setfill('0') << i
            << " = 0x" << std::hex << std::setw(8) << std::setfill('0') << cpu.gpr[i]
            << ((i % 4 == 3) ? '\n' : ' ');
    }
    std::cout << std::dec
        << "pc=0x" << std::hex << std::setw(8) << std::setfill('0') << cpu.pc
        << " last_inst=0x" << std::setw(8) << cpu.last_inst
        << std::dec << " running=" << cpu.running
        << " exit_code=" << cpu.exit_code << "\n";

    std::cout.copyfmt(old_state);
}

void dump_inst(uint32_t pc, uint32_t raw, const DecodedInst& inst) {
    std::ios old_state(nullptr);
    old_state.copyfmt(std::cout);

    std::cout << "[TRACE] pc=0x" << std::hex << std::setw(8) << std::setfill('0') << pc
        << " raw=0x" << std::setw(8) << raw
        << " op=" << opcode_to_string(inst.op)
        << std::dec
        << " rd=" << inst.rd
        << " rj=" << inst.rj
        << " rk=" << inst.rk
        << " imm=" << inst.imm << '\n';

    std::cout.copyfmt(old_state);
}

void set_trace_stream(std::ostream* os) {
    g_trace_stream = os;
    g_trace_step_counter = 0;
    g_trace_extras = TraceExtras{};
}

void clear_trace_stream() {
    g_trace_stream = nullptr;
    g_trace_step_counter = 0;
    g_trace_extras = TraceExtras{};
}

bool trace_enabled() {
    return g_trace_stream != nullptr;
}

void trace_begin_step() {
    g_trace_extras = TraceExtras{};
}

void trace_note_branch(bool taken) {
    g_trace_extras.has_branch = true;
    g_trace_extras.branch_taken = taken;
}

void trace_note_mem_write(uint32_t addr, uint32_t value) {
    g_trace_extras.has_mem_write = true;
    g_trace_extras.mem_write_addr = addr;
    g_trace_extras.mem_write_value = value;
}

void trace_note_uart_char(uint8_t ch) {
    g_trace_extras.has_uart = true;
    g_trace_extras.uart_text.push_back(static_cast<char>(ch));
}

void trace_note_pipeline(const TracePipelineInfo& info) {
    g_trace_extras.has_pipeline = info.enabled;
    g_trace_extras.pipeline = info;
}

void trace_meta_jsonl(
    const std::string& program_name,
    uint32_t load_base,
    uint32_t entry_pc,
    uint64_t max_steps,
    bool pipeline_mode) {
    if (!g_trace_stream) {
        return;
    }

    std::ostream& os = *g_trace_stream;
    os << "{\"type\":\"meta\",\"program\":";
    write_json_string(os, program_name);
    os << ",\"load_base\":";
    write_json_string(os, hex_u32(load_base));
    os << ",\"entry_pc\":";
    write_json_string(os, hex_u32(entry_pc));
    os << ",\"max_steps\":" << max_steps
        << ",\"pipeline_mode\":" << (pipeline_mode ? "true" : "false")
        << "}\n";
}

void trace_step_jsonl(
    uint32_t pc_before,
    uint32_t raw,
    const DecodedInst& inst,
    const CPUState& before,
    const CPUState& after) {
    if (!g_trace_stream) {
        return;
    }

    std::ostream& os = *g_trace_stream;
    os << "{\"type\":\"step\""
        << ",\"step\":" << g_trace_step_counter++
        << ",\"pc\":";
    write_json_string(os, hex_u32(pc_before));
    os << ",\"raw\":";
    write_json_string(os, hex_u32(raw));
    os << ",\"op\":";
    write_json_string(os, opcode_to_string(inst.op));
    os << ",\"rd\":" << inst.rd
        << ",\"rj\":" << inst.rj
        << ",\"rk\":" << inst.rk
        << ",\"imm\":" << inst.imm
        << ",\"next_pc\":";
    write_json_string(os, hex_u32(after.pc));
    os << ",\"running\":" << (after.running ? "true" : "false")
        << ",\"exit_code\":" << after.exit_code;

    os << ",\"branched\":";
    if (g_trace_extras.has_branch) {
        os << (g_trace_extras.branch_taken ? "true" : "false");
    }
    else {
        os << "null";
    }

    os << ",\"gpr_changes\":[";
    bool first = true;
    for (int i = 0; i < 32; ++i) {
        if (before.gpr[i] != after.gpr[i]) {
            if (!first) {
                os << ",";
            }
            first = false;
            os << "{\"reg\":" << i << ",\"value\":";
            write_json_string(os, hex_u32(after.gpr[i]));
            os << "}";
        }
    }
    os << "]";

    os << ",\"mem_write\":";
    if (g_trace_extras.has_mem_write) {
        os << "{\"addr\":";
        write_json_string(os, hex_u32(g_trace_extras.mem_write_addr));
        os << ",\"value\":";
        write_json_string(os, hex_u32(g_trace_extras.mem_write_value));
        os << "}";
    }
    else {
        os << "null";
    }

    os << ",\"uart\":";
    if (g_trace_extras.has_uart) {
        write_json_string(os, g_trace_extras.uart_text);
    }
    else {
        os << "null";
    }

    if (g_trace_extras.has_pipeline) {
        const TracePipelineInfo& pipeline = g_trace_extras.pipeline;
        os << ",\"pipeline\":{\"cycle\":" << pipeline.cycle
            << ",\"if\":";
        write_trace_pipeline_stage(os, pipeline.if_stage);
        os << ",\"id\":";
        write_trace_pipeline_stage(os, pipeline.id_stage);
        os << ",\"ex\":";
        write_trace_pipeline_stage(os, pipeline.ex_stage);
        os << ",\"mem\":";
        write_trace_pipeline_stage(os, pipeline.mem_stage);
        os << ",\"wb\":";
        write_trace_pipeline_stage(os, pipeline.wb_stage);
        os << ",\"stall\":" << (pipeline.stall ? "true" : "false")
            << ",\"stall_reason\":";
        if (!pipeline.stall_reason.empty()) {
            write_json_string(os, pipeline.stall_reason);
        }
        else {
            os << "null";
        }
        os << ",\"bubble\":";
        write_json_string_array(os, pipeline.bubble_stages);
        os << ",\"flush\":";
        write_json_string_array(os, pipeline.flush_stages);
        os << "}";
    }

    os << "}\n";
}

void trace_summary_jsonl(const CPUState& cpu) {
    if (!g_trace_stream) {
        return;
    }

    std::ostream& os = *g_trace_stream;
    os << "{\"type\":\"summary\""
        << ",\"pc\":";
    write_json_string(os, hex_u32(cpu.pc));
    os << ",\"last_inst\":";
    write_json_string(os, hex_u32(cpu.last_inst));
    os << ",\"running\":" << (cpu.running ? "true" : "false")
        << ",\"exit_code\":" << cpu.exit_code
        << ",\"regs\":[";

    for (int i = 0; i < 32; ++i) {
        if (i > 0) {
            os << ",";
        }
        write_json_string(os, hex_u32(cpu.gpr[i]));
    }

    os << "]}\n";
}
