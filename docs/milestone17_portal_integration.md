# Milestone17 Unified Portal Checklist

## Main paths now in the primary router

- `/`
  - unified workbench
  - sample guide and concept help entry
  - shared semantic view for CPU, pipeline, trap, timer, bus, UART, and stop summary
- `/hazard-puzzle`
  - hazard teaching interaction
  - reuses pipeline samples from the shared registry
  - links back to the workbench sample guide and concept guide
- `/traffic-control`
  - pipeline block interaction
  - reuses the same trace schema and pipeline canvas
  - links back to the workbench sample guide and concept guide

## Historical or legacy items

- removed in milestone17
  - `web/src/features/lesson_hazard/HazardPuzzleBoard.tsx`
    - old hazard prototype component
    - not connected to the main router
    - replaced in practice by `PipelineStageCanvas` plus route-specific overlays
- still kept but not wired into the current portal flow
  - `loadTraceFromFile()` in `web/src/features/trace/sources.ts`
    - reserved for future local file import
    - currently no UI entry in the unified portal

## Reusable pieces that remain the common backbone

- sample registry
  - `web/src/features/trace/sources.ts`
  - now carries shared sample metadata, panels, concept links, and stop semantics
- trace schema and parser
  - `web/src/features/trace/types.ts`
  - `web/src/features/trace/parser.ts`
- workbench semantic helpers
  - `web/src/features/trace/workbench.ts`
- shared pipeline visualization
  - `web/src/features/pipeline/PipelineStageCanvas.tsx`
  - `web/src/features/pipeline/visuals.ts`
- shared shell-level UI
  - `web/src/components/Panel.tsx`
  - `web/src/components/Tag.tsx`
  - `web/src/components/PortalHero.tsx`
- unified portal metadata
  - `web/src/app/portalCatalog.ts`

## Unification gains in milestone17

- navigation
  - the three main routes now expose the same shell-level navigation and cross-page links
- language
  - route headers now share the same Chinese teaching tone
- sample explanation
  - sample meaning, recommended panels, focus fields, concepts, and stop semantics now come from one registry
- semantic depth
  - timer / bus uses a semantic timeline instead of a raw event dump
  - trap / interrupt uses a process summary plus a step timeline
  - interpreter traces now explain why the pipeline panel degrades instead of rendering as an empty block
- information separation
  - UART output, timer state, device signals, bus accesses, and pure memory accesses are shown separately

## Areas that are still not perfectly unified

- trace loading is still route-local
  - the workbench, hazard route, and traffic route each load their own sample traces
  - sample identity is unified, but runtime state is not shared across routes
- local file import is still not exposed in the portal
  - the API helper exists, but the user-facing entry has not been added
- full five-stage visualization still depends on pipeline snapshots
  - interpreter traces now degrade more clearly, but they still cannot synthesize IF/ID/EX/MEM/WB detail that was never exported
