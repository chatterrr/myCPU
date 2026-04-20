# Plan.md

## Milestone 0 - Baseline freeze
Acceptance:
- current build and tests pass
- no functional changes

## Milestone 1 - Pipeline skeleton
Acceptance:
- add pipeline register structs
- add pipeline CPU loop skeleton
- code compiles
- existing baseline code path is preserved or safely adapted
- build-release and ctest-release pass

## Milestone 2 - Minimal pipeline execution
Acceptance:
- support a no-hazard arithmetic subset in pipeline mode
- provide one demonstration command
- build-release and ctest-release pass

## Milestone 3 - Hazard handling
Acceptance:
- detect RAW hazards
- insert stall or bubble
- add validation cases
- build-release and ctest-release pass

## Milestone 4 - Forwarding and control hazard basics
Acceptance:
- add simple forwarding for common ALU cases
- handle branch disruption conservatively
- build-release and ctest-release pass

## Milestone 5 - Viewer upgrade
Acceptance:
- viewer can display pipeline stage occupancy
- still supports existing trace workflow