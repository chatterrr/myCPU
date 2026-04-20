# AGENTS.md

## Project
LoongArch teaching ISA simulator in C++ on Windows + Visual Studio + CMake.

## Current branch goal
pipeline-stage1: build a teaching-oriented 5-stage pipeline version without breaking the existing demo-stable behavior.

## Must preserve
- Existing build must stay green after each milestone.
- Existing tests: member_b_tests and cpu_integration_tests must pass.
- Existing built-in programs must still work:
  - smoke
  - slt
  - lu12i
  - uart
- Existing trace/viewer workflow must not be broken unless the task explicitly changes it.

## Environment
- Windows native
- PowerShell
- Visual Studio 18 2026
- CMake build directory: .\build
- Use actions:
  - configure-release
  - build-release
  - ctest-release
  - trace-smoke
  - trace-uart

## Coding constraints
- Do not make unrelated refactors.
- Modify the minimum number of files needed.
- Keep switch-case blocks in MSVC-safe scoped braces.
- Fix warnings when touching nearby code if low risk.
- Prefer incremental milestones over large rewrites.

## Validation rule
After every code change:
1. configure-release
2. build-release
3. ctest-release

If validation fails, stop and repair before moving on.