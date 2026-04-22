#include "utils/debug.h"

#include <iomanip>
#include <iostream>
#include <ostream>
#include <sstream>
#include <string>

#include "config/constants.h"

namespace {

    constexpr const char* kTraceSchemaVersion = "workbench-v1";

    std::ostream* g_trace_stream = nullptr;
    uint64_t g_trace_step_counter = 0;
    bool g_trace_pipeline_mode = false;

    struct TraceExtras {
        bool has_branch = false;
        bool branch_taken = false;

        bool has_mem_write = false;
        uint32_t mem_write_addr = 0;
        uint32_t mem_write_value = 0;

        bool has_uart = false;
        std::string uart_text;

        bool has_trap = false;
        bool trap_is_interrupt = false;
        TrapCause trap_cause = TrapCause::None;
        uint32_t trap_epc = 0;
        uint32_t trap_vector = 0;
        uint32_t trap_badv = 0;

        bool has_pipeline = false;
        TracePipelineInfo pipeline;

        std::vector<TraceMemoryAccess> memory_accesses;
        std::vector<TraceDeviceEvent> device_events;

        bool has_timer = false;
        TimerSnapshot timer{};
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
            case '"': os << "\\\""; break;
            case '\n': os << "\\n"; break;
            case '\r': os << "\\r"; break;
            case '\t': os << "\\t"; break;
            default: os << ch; break;
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

    void write_trace_pipeline_forwarding_array(
        std::ostream& os,
        const std::vector<TracePipelineForwarding>& forwarding) {
        os << "[";
        for (size_t i = 0; i < forwarding.size(); ++i) {
            if (i > 0) {
                os << ",";
            }

            const TracePipelineForwarding& item = forwarding[i];
            os << "{\"from_stage\":";
            write_json_string(os, item.from_stage);
            os << ",\"to_stage\":";
            write_json_string(os, item.to_stage);
            os << ",\"operand\":";
            write_json_string(os, item.operand);
            os << ",\"reg\":" << item.reg;
            os << ",\"value\":";
            write_json_string(os, hex_u32(item.value));
            os << "}";
        }
        os << "]";
    }

    void write_trace_memory_access_array(
        std::ostream& os,
        const std::vector<TraceMemoryAccess>& accesses) {
        os << "[";
        for (size_t i = 0; i < accesses.size(); ++i) {
            if (i > 0) {
                os << ",";
            }

            const TraceMemoryAccess& item = accesses[i];
            os << "{\"kind\":";
            write_json_string(os, item.kind);
            os << ",\"addr\":";
            write_json_string(os, hex_u32(item.addr));
            os << ",\"value\":";
            write_json_string(os, hex_u32(item.value));
            os << ",\"width\":" << item.width;
            os << ",\"target\":";
            write_json_string(os, item.target);
            os << ",\"via\":";
            write_json_string(os, item.via_bus ? "bus" : "memory");
            os << "}";
        }
        os << "]";
    }

    void write_trace_device_event_array(
        std::ostream& os,
        const std::vector<TraceDeviceEvent>& events) {
        os << "[";
        for (size_t i = 0; i < events.size(); ++i) {
            if (i > 0) {
                os << ",";
            }

            const TraceDeviceEvent& item = events[i];
            os << "{\"device\":";
            write_json_string(os, item.device);
            os << ",\"kind\":";
            write_json_string(os, item.kind);

            if (item.has_addr) {
                os << ",\"addr\":";
                write_json_string(os, hex_u32(item.addr));
            }

            if (item.has_value) {
                os << ",\"value\":";
                write_json_string(os, hex_u32(item.value));
                os << ",\"width\":" << item.width;
            }

            if (!item.text.empty()) {
                os << ",\"text\":";
                write_json_string(os, item.text);
            }

            if (!item.cause.empty()) {
                os << ",\"cause\":";
                write_json_string(os, item.cause);
            }

            os << "}";
        }
        os << "]";
    }

    void write_timer_snapshot(std::ostream& os, const TimerSnapshot& snapshot) {
        os << "{\"control\":";
        write_json_string(os, hex_u32(snapshot.control));
        os << ",\"interval\":" << snapshot.interval
            << ",\"remaining\":" << snapshot.remaining
            << ",\"enabled\":" << (snapshot.enabled ? "true" : "false")
            << ",\"periodic\":" << (snapshot.periodic ? "true" : "false")
            << ",\"interrupt_enabled\":" << (snapshot.interrupt_enabled ? "true" : "false")
            << "}";
    }

}  // namespace

const char* opcode_to_string(Opcode op) {
    switch (op) {
    case Opcode::ADD_W: return "ADD_W";
    case Opcode::SUB_W: return "SUB_W";
    case Opcode::ADDI_W: return "ADDI_W";
    case Opcode::SLT: return "SLT";
    case Opcode::SLTU: return "SLTU";
    case Opcode::SLL_W: return "SLL_W";
    case Opcode::SRL_W: return "SRL_W";
    case Opcode::SRA_W: return "SRA_W";
    case Opcode::AND: return "AND";
    case Opcode::OR: return "OR";
    case Opcode::XOR: return "XOR";
    case Opcode::NOR: return "NOR";
    case Opcode::SLTI: return "SLTI";
    case Opcode::SLTUI: return "SLTUI";
    case Opcode::ANDI: return "ANDI";
    case Opcode::ORI: return "ORI";
    case Opcode::XORI: return "XORI";
    case Opcode::LD_W: return "LD_W";
    case Opcode::ST_W: return "ST_W";
    case Opcode::LD_B: return "LD_B";
    case Opcode::LD_H: return "LD_H";
    case Opcode::ST_B: return "ST_B";
    case Opcode::ST_H: return "ST_H";
    case Opcode::LD_BU: return "LD_BU";
    case Opcode::LD_HU: return "LD_HU";
    case Opcode::SLLI_W: return "SLLI_W";
    case Opcode::SRLI_W: return "SRLI_W";
    case Opcode::SRAI_W: return "SRAI_W";
    case Opcode::B: return "B";
    case Opcode::BEQ: return "BEQ";
    case Opcode::BNE: return "BNE";
    case Opcode::LU12I_W: return "LU12I_W";
    case Opcode::PCADDU12I: return "PCADDU12I";
    case Opcode::BLT: return "BLT";
    case Opcode::BGE: return "BGE";
    case Opcode::BLTU: return "BLTU";
    case Opcode::BGEU: return "BGEU";
    case Opcode::BL: return "BL";
    case Opcode::JIRL: return "JIRL";
    case Opcode::BREAK: return "BREAK";
    case Opcode::SYSCALL: return "SYSCALL";
    case Opcode::ERTN: return "ERTN";
    case Opcode::HALT: return "HALT";
    case Opcode::INVALID: return "INVALID";
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
        << " epc=0x" << std::setw(8) << cpu.epc
        << " last_inst=0x" << std::setw(8) << cpu.last_inst
        << " vector=0x" << std::setw(8) << cpu.exception_vector_base
        << " badv=0x" << std::setw(8) << cpu.badv
        << std::dec << " running=" << cpu.running
        << " cause=" << trap_cause_to_string(cpu.cause)
        << " stop_reason=" << stop_reason_to_string(cpu.stop_reason)
        << " status=0x" << std::hex << std::setw(8) << std::setfill('0') << cpu.status
        << std::dec << " pending_interrupt=" << cpu.pending_interrupt
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
    g_trace_pipeline_mode = false;
    g_trace_extras = TraceExtras{};
}

void clear_trace_stream() {
    g_trace_stream = nullptr;
    g_trace_step_counter = 0;
    g_trace_pipeline_mode = false;
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

void trace_note_mem_access(
    const char* kind,
    uint32_t addr,
    uint32_t value,
    uint32_t width,
    const char* target,
    bool via_bus) {
    if (!g_trace_stream) {
        return;
    }

    TraceMemoryAccess access{};
    access.kind = (kind != nullptr) ? kind : "access";
    access.addr = addr;
    access.value = value;
    access.width = width;
    access.target = (target != nullptr) ? target : "memory";
    access.via_bus = via_bus;
    g_trace_extras.memory_accesses.push_back(access);

    if (access.target != "memory") {
        TraceDeviceEvent event{};
        event.device = access.target;
        event.kind = std::string(via_bus ? "bus_" : "") + access.kind;
        event.has_addr = true;
        event.addr = addr;
        event.has_value = true;
        event.value = value;
        event.width = width;
        g_trace_extras.device_events.push_back(event);
    }
}

void trace_note_uart_char(uint8_t ch) {
    if (!g_trace_stream) {
        return;
    }

    g_trace_extras.has_uart = true;
    g_trace_extras.uart_text.push_back(static_cast<char>(ch));

    TraceDeviceEvent event{};
    event.device = "uart";
    event.kind = "tx";
    event.text.push_back(static_cast<char>(ch));
    g_trace_extras.device_events.push_back(event);
}

void trace_note_device_interrupt(const char* device, const char* cause) {
    if (!g_trace_stream) {
        return;
    }

    TraceDeviceEvent event{};
    event.device = (device != nullptr) ? device : "device";
    event.kind = "interrupt_raised";
    event.cause = (cause != nullptr) ? cause : "unknown";
    g_trace_extras.device_events.push_back(event);
}

void trace_note_trap(bool interrupt, TrapCause cause, uint32_t epc, uint32_t vector, uint32_t badv) {
    g_trace_extras.has_trap = true;
    g_trace_extras.trap_is_interrupt = interrupt;
    g_trace_extras.trap_cause = cause;
    g_trace_extras.trap_epc = epc;
    g_trace_extras.trap_vector = vector;
    g_trace_extras.trap_badv = badv;
}

void trace_note_timer_snapshot(const TimerSnapshot& snapshot) {
    if (!g_trace_stream) {
        return;
    }

    g_trace_extras.has_timer = true;
    g_trace_extras.timer = snapshot;
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

    g_trace_pipeline_mode = pipeline_mode;

    std::ostream& os = *g_trace_stream;
    os << "{\"type\":\"meta\",\"schema_version\":";
    write_json_string(os, kTraceSchemaVersion);
    os << ",\"program\":";
    write_json_string(os, program_name);
    os << ",\"mode\":";
    write_json_string(os, pipeline_mode ? "pipeline" : "interpreter");
    os << ",\"load_base\":";
    write_json_string(os, hex_u32(load_base));
    os << ",\"entry_pc\":";
    write_json_string(os, hex_u32(entry_pc));
    os << ",\"max_steps\":" << max_steps
        << ",\"pipeline_mode\":" << (pipeline_mode ? "true" : "false")
        << ",\"device_map\":["
        << "{\"name\":\"uart\",\"base\":";
    write_json_string(os, hex_u32(config::UART_ADDR));
    os << ",\"size\":";
    write_json_string(os, hex_u32(config::UART_SIZE));
    os << "},{\"name\":\"timer\",\"base\":";
    write_json_string(os, hex_u32(config::TIMER_ADDR));
    os << ",\"size\":";
    write_json_string(os, hex_u32(config::TIMER_SIZE));
    os << "}]"
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

    os << ",\"trap_state\":{\"cause\":";
    write_json_string(os, trap_cause_to_string(after.cause));
    os << ",\"epc\":";
    write_json_string(os, hex_u32(after.epc));
    os << ",\"vector\":";
    write_json_string(os, hex_u32(after.exception_vector_base));
    os << ",\"badv\":";
    write_json_string(os, hex_u32(after.badv));
    os << ",\"status\":";
    write_json_string(os, hex_u32(after.status));
    os << ",\"exl\":" << (((after.status & CPU_STATUS_EXL) != 0u) ? "true" : "false")
        << ",\"pending_interrupt\":" << (after.pending_interrupt ? "true" : "false")
        << ",\"last_trap_was_interrupt\":" << (after.last_trap_was_interrupt ? "true" : "false")
        << "}";

    os << ",\"exception\":";
    if (g_trace_extras.has_trap) {
        os << (g_trace_extras.trap_is_interrupt ? "false" : "true");
    }
    else {
        os << "null";
    }

    os << ",\"interrupt\":";
    if (g_trace_extras.has_trap) {
        os << (g_trace_extras.trap_is_interrupt ? "true" : "false");
    }
    else {
        os << "null";
    }

    os << ",\"cause\":";
    if (g_trace_extras.has_trap) {
        write_json_string(os, trap_cause_to_string(g_trace_extras.trap_cause));
    }
    else {
        os << "null";
    }

    os << ",\"epc\":";
    if (g_trace_extras.has_trap) {
        write_json_string(os, hex_u32(g_trace_extras.trap_epc));
    }
    else {
        os << "null";
    }

    os << ",\"vector\":";
    if (g_trace_extras.has_trap) {
        write_json_string(os, hex_u32(g_trace_extras.trap_vector));
    }
    else {
        os << "null";
    }

    os << ",\"badv\":";
    if (g_trace_extras.has_trap) {
        write_json_string(os, hex_u32(g_trace_extras.trap_badv));
    }
    else {
        os << "null";
    }

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

    os << ",\"memory_accesses\":";
    write_trace_memory_access_array(os, g_trace_extras.memory_accesses);

    os << ",\"device_events\":";
    write_trace_device_event_array(os, g_trace_extras.device_events);

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

    os << ",\"timer\":";
    if (g_trace_extras.has_timer) {
        write_timer_snapshot(os, g_trace_extras.timer);
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
        os << ",\"load_use\":" << (pipeline.load_use ? "true" : "false");
        os << ",\"forwarding\":";
        write_trace_pipeline_forwarding_array(os, pipeline.forwarding);
        os << ",\"redirect_pc\":";
        if (pipeline.has_redirect) {
            write_json_string(os, hex_u32(pipeline.redirect_pc));
        }
        else {
            os << "null";
        }
        os << "}";
    }

    os << "}\n";
}

void trace_summary_jsonl(const CPUState& cpu, const char* error_message) {
    if (!g_trace_stream) {
        return;
    }

    std::ostream& os = *g_trace_stream;
    os << "{\"type\":\"summary\""
        << ",\"schema_version\":";
    write_json_string(os, kTraceSchemaVersion);
    os << ",\"mode\":";
    write_json_string(os, g_trace_pipeline_mode ? "pipeline" : "interpreter");
    os << ",\"steps\":" << g_trace_step_counter
        << ",\"pc\":";
    write_json_string(os, hex_u32(cpu.pc));
    os << ",\"last_inst\":";
    write_json_string(os, hex_u32(cpu.last_inst));
    os << ",\"epc\":";
    write_json_string(os, hex_u32(cpu.epc));
    os << ",\"vector\":";
    write_json_string(os, hex_u32(cpu.exception_vector_base));
    os << ",\"badv\":";
    write_json_string(os, hex_u32(cpu.badv));
    os << ",\"cause\":";
    write_json_string(os, trap_cause_to_string(cpu.cause));
    os << ",\"stop_reason\":";
    write_json_string(os, stop_reason_to_string(cpu.stop_reason));
    os << ",\"status\":";
    write_json_string(os, hex_u32(cpu.status));
    os << ",\"exl\":" << (((cpu.status & CPU_STATUS_EXL) != 0u) ? "true" : "false")
        << ",\"running\":" << (cpu.running ? "true" : "false")
        << ",\"last_trap_was_interrupt\":" << (cpu.last_trap_was_interrupt ? "true" : "false")
        << ",\"pending_interrupt\":" << (cpu.pending_interrupt ? "true" : "false")
        << ",\"exit_code\":" << cpu.exit_code
        << ",\"error_message\":";

    if (error_message != nullptr) {
        write_json_string(os, error_message);
    }
    else {
        os << "null";
    }

    os << ",\"regs\":[";
    for (int i = 0; i < 32; ++i) {
        if (i > 0) {
            os << ",";
        }
        write_json_string(os, hex_u32(cpu.gpr[i]));
    }

    os << "]}\n";
}
