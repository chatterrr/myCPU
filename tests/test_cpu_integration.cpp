#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

#include "config/constants.h"
#include "cpu/CPU.h"
#include "loader/loader.h"
#include "memory/memory.h"
#include "tests/test_programs.h"

namespace {

    void expect(bool cond, const std::string& msg) {
        if (!cond) {
            throw std::runtime_error("[TEST FAIL] " + msg);
        }
    }

    struct ProgramContext {
        Memory mem;
        CPU cpu;

        ProgramContext() : mem(config::MEM_SIZE), cpu(mem) {}
    };

    void load_and_reset(ProgramContext& ctx, const std::vector<uint32_t>& words) {
        Loader::load_program_words(ctx.mem, config::PROGRAM_BASE, words);
        ctx.cpu.reset(config::PROGRAM_BASE);
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

        bool thrown = false;
        try {
            ctx.cpu.run(tests::kUnalignedAccessProgramSteps);
        }
        catch (const std::runtime_error&) {
            thrown = true;
        }
        expect(thrown, "unaligned access program should throw runtime_error");
    }

    void test_out_of_range_access_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kOutOfRangeAccessProgramWords);

        bool thrown = false;
        try {
            ctx.cpu.run(tests::kOutOfRangeAccessProgramSteps);
        }
        catch (const std::runtime_error&) {
            thrown = true;
        }
        expect(thrown, "out-of-range access program should throw runtime_error");
    }

    void test_invalid_program() {
        ProgramContext ctx;
        load_and_reset(ctx, tests::kInvalidProgramWords);

        bool thrown = false;
        try {
            ctx.cpu.step();
        }
        catch (const std::runtime_error&) {
            thrown = true;
        }
        expect(thrown, "invalid program should throw runtime_error");
    }

    void test_lu12i_program_when_enabled() {
        if (!tests::kEnableLu12iIntegrationTest) {
            return;
        }

        if (tests::kLu12iProgramWords.empty()) {
            throw std::runtime_error(
                "[TEST FAIL] lu12i integration test is enabled, but kLu12iProgramWords is empty");
        }

        throw std::runtime_error(
            "[TODO] Implement lu12i integration assertions after member A finalizes lu12i.w support.");
    }

    void test_uart_e2e_program_when_enabled() {
        if (!tests::kEnableUartE2EIntegrationTest) {
            return;
        }

        if (tests::kUartProgramWords.empty()) {
            throw std::runtime_error(
                "[TEST FAIL] UART E2E integration test is enabled, but kUartProgramWords is empty");
        }

        throw std::runtime_error(
            "[TODO] Implement UART E2E integration assertions after large-address path is available.");
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

        // Future stage2 hooks. They stay inactive until the corresponding
        // program vectors and CPU support are ready.
        test_lu12i_program_when_enabled();
        test_uart_e2e_program_when_enabled();

        std::cout << "[PASS] CPU integration tests all passed.\n";
        return 0;
    }
    catch (const std::exception& ex) {
        std::cerr << ex.what() << '\n';
        return 1;
    }
}