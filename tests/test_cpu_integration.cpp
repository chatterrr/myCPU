#include <iostream>
#include <sstream>
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

    void expect(bool cond, const std::string& msg) {
        if (!cond) {
            throw std::runtime_error("[TEST FAIL] " + msg);
        }
    }

    void expect_contains(const std::string& text, const std::string& needle, const std::string& msg) {
        expect(text.find(needle) != std::string::npos, msg + " missing: " + needle);
    }

    struct ProgramContext {
        Memory mem;
        CPU cpu;

        ProgramContext() : mem(config::MEM_SIZE), cpu(mem) {}
    };

    void load_and_reset(
        ProgramContext& ctx,
        const std::vector<uint32_t>& words,
        uint32_t base = config::PROGRAM_BASE
    ) {
        Loader::load_program_words(ctx.mem, base, words);
        ctx.cpu.reset(base);
    }

    void load_exception_handler(
        ProgramContext& ctx,
        const std::vector<uint32_t>& handler_words
    ) {
        Loader::load_program_words(ctx.mem, config::EXCEPTION_VECTOR_BASE, handler_words);
    }

    std::vector<uint32_t> make_counter_handler_words(uint32_t reg_index) {
        return {
            tests::ENC_2RI12(tests::OP_ADDI_W, reg_index, reg_index, 1),
            tests::kErtnRaw,
        };
    }

    void expect_trap_state(
        const CPUState& s,
        TrapCause expected_cause,
        uint32_t expected_epc,
        uint32_t expected_badv,
        const std::string& label
    ) {
        expect(s.pc == config::EXCEPTION_VECTOR_BASE, label + ": pc should jump to exception vector");
        expect(s.cause == expected_cause, label + ": cause mismatch");
        expect(s.epc == expected_epc, label + ": epc mismatch");
        expect(s.badv == expected_badv, label + ": badv mismatch");
        expect((s.status & CPU_STATUS_EXL) != 0u, label + ": EXL should be set in trap");
    }

    std::string capture_trace_for_program(
        const std::vector<uint32_t>& words,
        uint64_t max_steps,
        bool pipeline_mode,
        uint32_t base = config::PROGRAM_BASE,
        const std::vector<uint32_t>& handler_words = {}
    ) {
        ProgramContext ctx;
        ctx.cpu.set_pipeline_mode(pipeline_mode);
        Loader::load_program_words(ctx.mem, base, words);
        if (!handler_words.empty()) {
            load_exception_handler(ctx, handler_words);
        }
        ctx.cpu.reset(base);

        std::ostringstream trace;
        set_trace_stream(&trace);
        trace_meta_jsonl("test-program", base, base, max_steps, pipeline_mode);
        ctx.cpu.run(max_steps);
        trace_summary_jsonl(ctx.cpu.state());
        clear_trace_stream();
        return trace.str();
    }

    void test_arith_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kArithProgramWords);
        ctx.cpu.run(tests::kArithProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[0] == 0, "r0 must stay zero");
        expect(s.gpr[1] == 5, "arith: r1 should be 5");
        expect(s.gpr[2] == 7, "arith: r2 should be 7");
        expect(s.gpr[4] == 12, "arith: r4 should be 12");
        expect(s.gpr[5] == 2, "arith: r5 should be 2");
        expect(s.gpr[3] == config::STACK_TOP, "arith: sp should equal STACK_TOP");
    }

    void test_logic_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kLogicProgramWords);
        ctx.cpu.run(tests::kLogicProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[0] == 0, "logic: r0 must stay zero");
        expect(s.gpr[10] == 12, "logic: r10 should be 12");
        expect(s.gpr[11] == 14, "logic: r11 should be 14");
        expect(s.gpr[12] == 14, "logic: r12 should be 14");
    }

    void test_mem_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kMemProgramWords);
        ctx.cpu.run(tests::kMemProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[6] == 0x80, "mem: r6 should be 0x80");
        expect(s.gpr[7] == 12, "mem: r7 should be 12");
        expect(ctx.mem.read32(0x80) == 12u, "mem: MEM[0x80] should be 12");
    }

    void test_branch_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kBranchProgramWords);
        ctx.cpu.run(tests::kBranchProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[4] == 12, "branch: r4 should be 12");
        expect(s.gpr[5] == 2, "branch: r5 should be 2");
        expect(s.gpr[7] == 12, "branch: r7 should be 12");
        expect(s.gpr[20] == 0, "branch: r20 should remain 0");
        expect(s.gpr[21] == 0, "branch: r21 should remain 0");
        expect(s.gpr[22] == 0, "branch: r22 should remain 0");
    }

    void test_smoke_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kSmokeProgramWords);
        ctx.cpu.run(tests::kSmokeProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[0] == 0, "smoke: r0 must stay zero");
        expect(s.gpr[1] == 5, "smoke: r1 should be 5");
        expect(s.gpr[2] == 7, "smoke: r2 should be 7");
        expect(s.gpr[4] == 12, "smoke: r4 should be 12");
        expect(s.gpr[5] == 2, "smoke: r5 should be 2");
        expect(s.gpr[6] == 0x80, "smoke: r6 should be 0x80");
        expect(s.gpr[7] == 12, "smoke: r7 should be 12");
        expect(s.gpr[10] == 12, "smoke: r10 should be 12");
        expect(s.gpr[11] == 14, "smoke: r11 should be 14");
        expect(s.gpr[12] == 14, "smoke: r12 should be 14");
        expect(s.gpr[20] == 0, "smoke: r20 should remain 0");
        expect(s.gpr[21] == 0, "smoke: r21 should remain 0");
        expect(s.gpr[22] == 0, "smoke: r22 should remain 0");
        expect(ctx.mem.read32(0x80) == 12u, "smoke: MEM[0x80] should be 12");
    }

    void test_r0_write_protect_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kR0WriteProtectProgramWords);
        ctx.cpu.run(tests::kR0WriteProtectProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[0] == 0, "r0-protect: r0 must still be 0");
        expect(s.gpr[1] == 5, "r0-protect: r1 should be 5");
    }

    void test_unaligned_access_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kUnalignedAccessProgramWords);
        ctx.cpu.run(tests::kUnalignedAccessProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect_trap_state(
            s,
            TrapCause::UnalignedAccess,
            config::PROGRAM_BASE + 12u,
            0x82u,
            "unaligned access");
    }

    void test_out_of_range_access_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kOutOfRangeAccessProgramWords);
        ctx.cpu.run(tests::kOutOfRangeAccessProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect_trap_state(
            s,
            TrapCause::AddressOutOfRange,
            config::PROGRAM_BASE + 12u,
            0xFFFFFFFCu,
            "out-of-range access");
    }

    void test_invalid_program() {
        ProgramContext ctx;
        const std::vector<uint32_t> words = {
            0x00000000u,
            tests::ENC_2RI12(tests::OP_ADDI_W, 9, 0, 7),
        };
        load_and_reset(ctx, words);
        load_exception_handler(ctx, make_counter_handler_words(30));

        ctx.cpu.step();
        expect_trap_state(
            ctx.cpu.state(),
            TrapCause::InvalidInstruction,
            config::PROGRAM_BASE + 4u,
            config::PROGRAM_BASE,
            "invalid instruction");

        ctx.cpu.step();
        ctx.cpu.step();
        ctx.cpu.step();

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[30] == 1u, "invalid instruction handler should increment the trap counter");
        expect(s.gpr[9] == 7u, "ERTN should resume at the saved epc");
        expect((s.status & CPU_STATUS_EXL) == 0u, "ERTN should clear EXL");
        expect(s.cause == TrapCause::None, "ERTN should clear the latched cause");
    }

    void test_slt_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kSltProgramWords);
        ctx.cpu.run(tests::kSltProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[3] == 1, "slt: r3 should be 1");
        expect(s.gpr[4] == 0, "slt: r4 should be 0");
        expect(s.gpr[5] == 0xFFFFFFFFu, "slt: r5 should be -1 in two's complement");
        expect(s.gpr[7] == 1, "slt: r7 should be 1");
    }

    void test_lu12i_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kLu12iProgramWords);
        ctx.cpu.run(tests::kLu12iProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[13] == 0x12345000u, "lu12i: r13 should be 0x12345000");
        expect(s.gpr[14] == config::UART_ADDR, "lu12i: r14 should become UART_ADDR");
        expect(s.gpr[0] == 0, "lu12i: r0 must stay zero");
    }

    void test_sltu_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kSltuProgramWords);
        ctx.cpu.run(tests::kSltuProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[1] == 0xFFFFFFFFu, "sltu: r1 should be 0xFFFFFFFF");
        expect(s.gpr[2] == 1u, "sltu: r2 should be 1");
        expect(s.gpr[3] == 1u, "sltu: r3 should be 1");
        expect(s.gpr[4] == 0u, "sltu: r4 should be 0");
    }

    void test_nor_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kNorProgramWords);
        ctx.cpu.run(tests::kNorProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[3] == 0xFFFFFFF1u, "nor: r3 should be ~(0xC | 0x2)");
        expect(s.gpr[4] == 0xFFFFFFFFu, "nor: r4 should be all ones");
    }

    void test_shift_immediate_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kShiftImmediateProgramWords);
        ctx.cpu.run(tests::kShiftImmediateProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[2] == 16u, "shift-imm: SLLI_W should shift left by 4");
        expect(s.gpr[4] == 0x3FFFFFFCu, "shift-imm: SRLI_W should zero-fill");
        expect(s.gpr[5] == 0xFFFFFFFCu, "shift-imm: SRAI_W should sign-extend");
    }

    void test_branch_compare_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kBranchCompareProgramWords);
        ctx.cpu.run(tests::kBranchCompareProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[20] == 0u, "branch-compare: BLT taken should skip r20 write");
        expect(s.gpr[21] == 0u, "branch-compare: BGE taken should skip r21 write");
        expect(s.gpr[22] == 0u, "branch-compare: BLTU taken should skip r22 write");
        expect(s.gpr[23] == 0u, "branch-compare: BGEU taken should skip r23 write");
        expect(s.gpr[24] == 1u, "branch-compare: BLT not-taken path should execute");
        expect(s.gpr[25] == 1u, "branch-compare: BGE not-taken path should execute");
        expect(s.gpr[26] == 1u, "branch-compare: BLTU not-taken path should execute");
        expect(s.gpr[27] == 1u, "branch-compare: BGEU not-taken path should execute");
    }

    void test_bl_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kBlProgramWords);
        ctx.cpu.run(tests::kBlProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[1] == config::PROGRAM_BASE + 4u, "bl: r1 should capture the return address");
        expect(s.gpr[20] == 0u, "bl: skipped instruction must not run");
        expect(s.gpr[7] == 42u, "bl: branch target should execute");
    }

    void test_jirl_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kJirlProgramWords);
        ctx.cpu.run(tests::kJirlProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[5] == config::PROGRAM_BASE + 12u, "jirl: rd should capture the return address");
        expect(s.gpr[20] == 0u, "jirl: skipped instruction must not run");
        expect(s.gpr[7] == 42u, "jirl: jump target should execute");
    }

    void test_pcaddu12i_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kPcaddu12iProgramWords);
        ctx.cpu.run(tests::kPcaddu12iProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[8] == (config::PROGRAM_BASE + 0x1000u), "pcaddu12i: result should be pc + (imm << 12)");
    }

    void run_trap_resume_test(
        const std::vector<uint32_t>& words,
        TrapCause expected_cause,
        const std::string& label
    ) {
        ProgramContext ctx;
        load_and_reset(ctx, words);
        load_exception_handler(ctx, make_counter_handler_words(30));

        ctx.cpu.step();
        expect_trap_state(
            ctx.cpu.state(),
            expected_cause,
            config::PROGRAM_BASE + 4u,
            config::PROGRAM_BASE,
            label);

        ctx.cpu.step();
        ctx.cpu.step();
        ctx.cpu.step();

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[30] == 1u, label + ": handler should increment the trap counter");
        expect(s.gpr[9] == 7u, label + ": ERTN should resume at the saved epc");
        expect((s.status & CPU_STATUS_EXL) == 0u, label + ": ERTN should clear EXL");
        expect(s.cause == TrapCause::None, label + ": ERTN should clear the latched cause");
    }

    void test_break_program() {
        run_trap_resume_test(
            {
                tests::kBreakRaw,
                tests::ENC_2RI12(tests::OP_ADDI_W, 9, 0, 7),
            },
            TrapCause::Breakpoint,
            "break");
    }

    void test_syscall_program() {
        run_trap_resume_test(
            {
                tests::kSyscallRaw,
                tests::ENC_2RI12(tests::OP_ADDI_W, 9, 0, 7),
            },
            TrapCause::Syscall,
            "syscall");
    }

    void test_uart_e2e_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kUartProgramWords);

        std::ostringstream capture;
        auto* old_buf = std::cout.rdbuf(capture.rdbuf());

        ctx.cpu.run(tests::kUartProgramSteps);

        std::cout.rdbuf(old_buf);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[15] == config::UART_ADDR, "uart-e2e: r15 should be UART_ADDR");
        expect(capture.str() == "Hi!", "uart-e2e: UART output should be Hi!");
    }

    void test_timer_interrupt_program() {
        ProgramContext ctx;
        const std::vector<uint32_t> timer_program_words = {
            tests::ENC_1RI20(tests::OP_LU12I_W, 10, 0x1FE00),
            tests::ENC_2RI12(tests::OP_ADDI_W, 10, 10, 0x200),
            tests::ENC_2RI12(tests::OP_ADDI_W, 11, 0, 2),
            tests::ENC_2RI12(tests::OP_ST_W, 11, 10, 4),
            tests::ENC_2RI12(
                tests::OP_ADDI_W,
                11,
                0,
                static_cast<int32_t>(config::TIMER_CTRL_ENABLE_BIT | config::TIMER_CTRL_INTERRUPT_ENABLE_BIT)),
            tests::ENC_2RI12(tests::OP_ST_W, 11, 10, 0),
            tests::ENC_2RI12(tests::OP_ADDI_W, 12, 0, 1),
            tests::ENC_2RI12(tests::OP_ADDI_W, 13, 0, 2),
        };

        load_and_reset(ctx, timer_program_words);
        load_exception_handler(ctx, make_counter_handler_words(30));
        ctx.cpu.run(11);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[30] == 1u, "timer: handler should run exactly once");
        expect(s.gpr[12] == 1u, "timer: pre-interrupt instruction should still retire");
        expect(s.gpr[13] == 2u, "timer: ERTN should resume interrupted control flow");
        expect((s.status & CPU_STATUS_EXL) == 0u, "timer: ERTN should clear EXL");
        expect(s.cause == TrapCause::None, "timer: cause should be cleared after ERTN");
    }

    void test_pipeline_no_hazard_program() {
        ProgramContext ctx;
        ctx.cpu.set_pipeline_mode(true);
        load_and_reset(ctx, tests::kPipelineNoHazardProgramWords);
        ctx.cpu.run(tests::kPipelineNoHazardProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[0] == 0, "pipeline-nohaz: r0 must stay zero");
        expect(s.gpr[1] == 5, "pipeline-nohaz: r1 should be 5");
        expect(s.gpr[2] == 7, "pipeline-nohaz: r2 should be 7");
        expect(s.gpr[4] == 12, "pipeline-nohaz: r4 should be 12");
        expect(s.gpr[5] == 7, "pipeline-nohaz: r5 should be 7");
    }

    void test_pipeline_raw_hazard_program() {
        ProgramContext ctx;
        ctx.cpu.set_pipeline_mode(true);
        load_and_reset(ctx, tests::kPipelineRawHazardProgramWords);
        ctx.cpu.run(tests::kPipelineRawHazardProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[0] == 0, "pipeline-raw: r0 must stay zero");
        expect(s.gpr[1] == 5, "pipeline-raw: r1 should be 5");
        expect(s.gpr[2] == 12, "pipeline-raw: r2 should be 12");
        expect(s.gpr[4] == 17, "pipeline-raw: r4 should be 17");
    }

    void test_pipeline_forwarding_program() {
        ProgramContext ctx;
        ctx.cpu.set_pipeline_mode(true);
        load_and_reset(ctx, tests::kPipelineForwardingProgramWords);
        ctx.cpu.run(tests::kPipelineForwardingProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[0] == 0, "pipeline-fwd: r0 must stay zero");
        expect(s.gpr[1] == 5, "pipeline-fwd: r1 should be 5");
        expect(s.gpr[2] == 12, "pipeline-fwd: r2 should be 12");
        expect(s.gpr[4] == 17, "pipeline-fwd: r4 should be 17");
        expect(s.gpr[5] == 5, "pipeline-fwd: r5 should be 5");
    }

    void test_pipeline_load_use_program() {
        ProgramContext ctx;
        ctx.cpu.set_pipeline_mode(true);
        load_and_reset(ctx, tests::kPipelineLoadUseProgramWords, 0);
        ctx.cpu.run(tests::kPipelineLoadUseProgramSteps);

        const uint32_t loaded_word = tests::kPipelineLoadUseDataWord;
        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[0] == 0, "pipeline-loaduse: r0 must stay zero");
        expect(s.gpr[1] == loaded_word, "pipeline-loaduse: r1 should match the embedded data word");
        expect(s.gpr[2] == loaded_word + 1u, "pipeline-loaduse: r2 should consume the loaded value");
        expect(s.gpr[4] == loaded_word + loaded_word + 1u, "pipeline-loaduse: r4 should reflect the chained dependency");
    }

    void test_pipeline_branch_program() {
        ProgramContext ctx;
        ctx.cpu.set_pipeline_mode(true);
        load_and_reset(ctx, tests::kPipelineBranchProgramWords);
        ctx.cpu.run(tests::kPipelineBranchProgramSteps);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[0] == 0, "pipeline-branch: r0 must stay zero");
        expect(s.gpr[1] == 5, "pipeline-branch: r1 should be 5");
        expect(s.gpr[2] == 5, "pipeline-branch: r2 should be 5");
        expect(s.gpr[4] == 12, "pipeline-branch: r4 should be 12");
        expect(s.gpr[5] == 17, "pipeline-branch: r5 should be 17");
        expect(s.gpr[20] == 0, "pipeline-branch: r20 should remain 0 after flush");
        expect(s.gpr[21] == 0, "pipeline-branch: r21 should remain 0 after flush");
        expect(s.gpr[22] == 0, "pipeline-branch: r22 should remain 0 after flush");
    }

    void test_pipeline_ertn_resume_program() {
        ProgramContext ctx;
        ctx.cpu.set_pipeline_mode(true);
        const std::vector<uint32_t> words = {
            0x00000000u,
            tests::ENC_2RI12(tests::OP_ADDI_W, 9, 0, 7),
            tests::ENC_2RI12(tests::OP_ADDI_W, 0, 0, 0),
            tests::ENC_2RI12(tests::OP_ADDI_W, 0, 0, 0),
            tests::ENC_2RI12(tests::OP_ADDI_W, 0, 0, 0),
            tests::ENC_2RI12(tests::OP_ADDI_W, 0, 0, 0),
            tests::ENC_2RI12(tests::OP_ADDI_W, 0, 0, 0),
            tests::ENC_2RI12(tests::OP_ADDI_W, 0, 0, 0),
        };

        load_and_reset(ctx, words);
        load_exception_handler(ctx, make_counter_handler_words(30));
        ctx.cpu.run(12);

        const CPUState& s = ctx.cpu.state();
        expect(s.gpr[30] == 1u, "pipeline-ertn: handler should run exactly once");
        expect(s.gpr[9] == 7u, "pipeline-ertn: ERTN should resume at the saved epc");
        expect((s.status & CPU_STATUS_EXL) == 0u, "pipeline-ertn: ERTN should clear EXL");
        expect(s.cause == TrapCause::None, "pipeline-ertn: cause should be cleared after ERTN");
    }

    void test_pipeline_rejects_interpreter_only_instruction() {
        ProgramContext ctx;
        ctx.cpu.set_pipeline_mode(true);
        const std::vector<uint32_t> words = {
            tests::ENC_3R(tests::OP_OR, 1, 0, 0),
        };

        load_and_reset(ctx, words);

        bool thrown = false;
        try {
            ctx.cpu.run(2);
        }
        catch (const std::runtime_error& ex) {
            thrown = true;
            expect_contains(
                ex.what(),
                "pipeline teaching mode currently supports",
                "pipeline boundary message should explain the supported subset");
            expect_contains(
                ex.what(),
                "got OR",
                "pipeline boundary message should name the rejected opcode");
        }

        expect(thrown, "pipeline boundary test should throw on interpreter-only instructions");
        expect(ctx.cpu.state().exit_code == 1, "pipeline boundary test should set exit_code=1");
        expect(!ctx.cpu.state().running, "pipeline boundary test should stop the CPU");
    }

    void test_pipeline_trace_records() {
        const std::string load_use_trace = capture_trace_for_program(
            tests::kPipelineLoadUseProgramWords,
            tests::kPipelineLoadUseProgramSteps,
            true,
            0
        );
        expect_contains(load_use_trace, "\"pipeline_mode\":true", "pipeline trace meta should mark pipeline mode");
        expect_contains(load_use_trace, "\"pipeline\":{\"cycle\":", "pipeline trace should include per-cycle pipeline payload");
        expect_contains(load_use_trace, "\"if\":{\"state\":\"fetch\"", "pipeline trace should include IF occupancy");
        expect_contains(load_use_trace, "\"stall\":true", "load-use trace should record a stall");
        expect_contains(load_use_trace, "\"stall_reason\":\"raw_hazard\"", "load-use trace should explain the stall");
        expect_contains(load_use_trace, "\"bubble\":[\"EX\"]", "load-use trace should record the inserted EX bubble");

        const std::string branch_trace = capture_trace_for_program(
            tests::kPipelineBranchProgramWords,
            tests::kPipelineBranchProgramSteps,
            true
        );
        expect_contains(branch_trace, "\"flush\":[\"IF\",\"ID\"]", "branch trace should record flushed younger stages");
        expect_contains(branch_trace, "\"id\":{\"state\":\"flushed\"", "branch trace should mark the flushed ID stage");

        const std::string compare_trace = capture_trace_for_program(
            tests::kBranchCompareProgramWords,
            tests::kBranchCompareProgramSteps,
            false
        );
        expect_contains(compare_trace, "\"branched\":true", "branch trace should record taken branches");
        expect_contains(compare_trace, "\"branched\":false", "branch trace should record not-taken branches");
    }

    void test_trap_trace_records() {
        const std::vector<uint32_t> invalid_then_resume_words = {
            0x00000000u,
            tests::ENC_2RI12(tests::OP_ADDI_W, 9, 0, 7),
        };
        const std::vector<uint32_t> handler_words = make_counter_handler_words(30);

        const std::string exception_trace = capture_trace_for_program(
            invalid_then_resume_words,
            1,
            false,
            config::PROGRAM_BASE,
            handler_words
        );
        expect_contains(exception_trace, "\"exception\":true", "exception trace should mark exception steps");
        expect_contains(exception_trace, "\"interrupt\":false", "exception trace should mark interrupt=false");
        expect_contains(exception_trace, "\"cause\":\"invalid_instruction\"", "exception trace should record the invalid cause");
        expect_contains(exception_trace, "\"epc\":\"0x00001004\"", "exception trace should record epc");
        expect_contains(exception_trace, "\"vector\":\"0x00000080\"", "exception trace should record the vector");

        const std::vector<uint32_t> timer_program_words = {
            tests::ENC_1RI20(tests::OP_LU12I_W, 10, 0x1FE00),
            tests::ENC_2RI12(tests::OP_ADDI_W, 10, 10, 0x200),
            tests::ENC_2RI12(tests::OP_ADDI_W, 11, 0, 2),
            tests::ENC_2RI12(tests::OP_ST_W, 11, 10, 4),
            tests::ENC_2RI12(
                tests::OP_ADDI_W,
                11,
                0,
                static_cast<int32_t>(config::TIMER_CTRL_ENABLE_BIT | config::TIMER_CTRL_INTERRUPT_ENABLE_BIT)),
            tests::ENC_2RI12(tests::OP_ST_W, 11, 10, 0),
            tests::ENC_2RI12(tests::OP_ADDI_W, 12, 0, 1),
            tests::ENC_2RI12(tests::OP_ADDI_W, 13, 0, 2),
        };

        const std::string interrupt_trace = capture_trace_for_program(
            timer_program_words,
            8,
            false,
            config::PROGRAM_BASE,
            handler_words
        );
        expect_contains(interrupt_trace, "\"interrupt\":true", "interrupt trace should mark interrupt steps");
        expect_contains(interrupt_trace, "\"cause\":\"timer_interrupt\"", "interrupt trace should record the timer cause");
        expect_contains(interrupt_trace, "\"vector\":\"0x00000080\"", "interrupt trace should record the vector");

        const std::string jirl_trace = capture_trace_for_program(
            tests::kJirlProgramWords,
            3,
            false
        );
        expect_contains(
            jirl_trace,
            "\"op\":\"JIRL\",\"rd\":5,\"rj\":6,\"rk\":0",
            "JIRL trace should use rd for the link register");
    }

}  // namespace

int main() {
    try {
        test_arith_program();
        test_logic_program();
        test_mem_program();
        test_branch_program();
        test_smoke_program();

        test_r0_write_protect_program();
        test_unaligned_access_program();
        test_out_of_range_access_program();
        test_invalid_program();

        test_slt_program();
        test_sltu_program();
        test_nor_program();
        test_shift_immediate_program();
        test_branch_compare_program();
        test_bl_program();
        test_jirl_program();
        test_pcaddu12i_program();
        test_lu12i_program();
        test_break_program();
        test_syscall_program();
        test_uart_e2e_program();
        test_timer_interrupt_program();
        test_pipeline_no_hazard_program();
        test_pipeline_raw_hazard_program();
        test_pipeline_forwarding_program();
        test_pipeline_load_use_program();
        test_pipeline_branch_program();
        test_pipeline_ertn_resume_program();
        test_pipeline_rejects_interpreter_only_instruction();
        test_pipeline_trace_records();
        test_trap_trace_records();

        std::cout << "[PASS] CPU integration tests all passed.\n";
        return 0;
    }
    catch (const std::exception& ex) {
        std::cerr << ex.what() << '\n';
        return 1;
    }
}
