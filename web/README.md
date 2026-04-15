# myCPU Web Frontend Foundation

Milestone 8 adds a standalone React + Vite + TypeScript frontend in `web/`.
It keeps the existing `mycpu.exe + trace JSONL` workflow intact and consumes the
same pipeline trace payload that `tools/trace_viewer.py` already understands.

## Structure

```text
web/
  public/
    traces/
  scripts/
    sync-samples.ps1
  src/
    app/
    assets/
    components/
    features/
      lesson_hazard/
      pipeline/
      trace/
      traffic_game/
    routes/
    styles/
```

## Tech choices

- React + Vite + TypeScript: app shell and routing
- Tailwind CSS: layout, panels, controls
- PixiJS + `@pixi/react`: minimum IF/ID/EX/MEM/WB stage rendering
- Motion: step and panel transitions
- Trace input:
  - built-in samples from `public/traces/*.jsonl`
  - local `.jsonl` upload from the browser

## Commands

```powershell
cd .\web
npm install
npm run build
npm run dev
```

To refresh the checked-in sample traces after regenerating them from
`mycpu.exe`, run:

```powershell
cd .\web
npm run sync:traces
```

## M9 / M10 contracts

The next milestones already have typed extension points:

- `src/features/lesson_hazard/contracts.ts`
  - consumes `TraceDocument`
  - accepts a focused cycle and stage
  - returns puzzle feedback and highlight hints
- `src/features/traffic_game/contracts.ts`
  - consumes a per-cycle pipeline snapshot
  - accepts user traffic-control actions (`hold`, `advance`, `flush`)
  - returns scored frame updates for game flow

The current UI only visualizes the trace and does not implement lesson or game
logic yet.

