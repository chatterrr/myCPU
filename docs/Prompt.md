# Prompt.md

## Goal
Extend the LoongArch simulator from the current single-step execution baseline into a teaching-oriented pipelined simulator, while preserving the existing runnable demo, tests, trace pipeline, and UART behavior.

## Current completed baseline
- CPU / Memory / Loader / UART
- built-in programs
- trace JSONL export
- trace viewer
- ctest passing in current baseline
- Codex local environment and worktree flow working

## Near-term milestones
1. Freeze current passing baseline in pipeline-stage1.
2. Introduce 5-stage pipeline data structures:
   IF / ID / EX / MEM / WB
3. Add pipeline main loop without hazard handling first.
4. Run a minimal no-hazard program successfully.
5. Then add hazard detection / stalling / forwarding.
6. Extend viewer later to display pipeline stages.

## Non-goals for the first pipeline milestone
- No full hazard handling yet
- No branch flush optimization yet
- No interrupt / exception framework redesign
- No broad UI redesign

## Done when
For each milestone:
- build-release passes
- ctest-release passes, or tests are updated intentionally with explanation
- changes are limited and reviewable
- milestone behavior is demonstrated with a concrete command