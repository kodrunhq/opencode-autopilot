---
phase: 19-agent-visibility-fixes
plan: 02
subsystem: tools/stocktake
tags: [stocktake, config-hook, agent-detection, diagnostics]
dependency_graph:
  requires: [19-01]
  provides: [stocktake-config-hook-detection]
  affects: [src/tools/stocktake.ts]
tech_stack:
  added: []
  patterns: [config-hook-agent-injection, deduplication-by-origin]
key_files:
  created: []
  modified:
    - src/tools/stocktake.ts
    - tests/tools/stocktake.test.ts
decisions:
  - ConfigHookAgent interface exported for external use and testing
  - Model field left undefined in stocktakeCore (pure function; model resolution deferred to wrapper)
  - Local agents array renamed to agentEntries to avoid shadowing the imported agents map
metrics:
  duration: 2min
  completed: 2026-04-03
---

# Phase 19 Plan 02: Stocktake Config-Hook Agent Detection Summary

Extended stocktakeCore to detect and report all 15 config-hook-injected agents alongside filesystem agents, with origin, mode, group, and hidden fields per agent.

## What Was Done

### Task 1: Extend AssetEntry and stocktakeCore for config-hook agents (TDD)

**RED:** Wrote 7 new test cases covering config-hook detection, field population, filesystem origin preservation, deduplication (filesystem wins), summary configHook count, backward compatibility, and total count correctness. All 7 failed as expected.

**GREEN:** Implemented the following changes in `src/tools/stocktake.ts`:

1. Extended `AssetEntry` interface with `origin: "config-hook"` and new optional fields: `mode`, `model`, `group`, `hidden`
2. Added `ConfigHookAgent` interface (exported) for the injection parameter
3. Added `configHookAgentToEntry` helper to convert config-hook agents to AssetEntry format
4. Extended `stocktakeCore` signature with optional third parameter `configHookAgents`
5. Added deduplication logic: filesystem agent names collected into a Set, config-hook agents only added if not already present
6. Added `configHook` count to the summary object
7. Updated `ocStocktake` wrapper to import and pass both `standardAgents` and `pipelineAgents` with group lookup from `AGENT_REGISTRY`
8. Renamed local `agents` array to `agentEntries` to avoid shadowing the imported `agents` map

**Commit:** ff8798b

## Verification

- `bun test tests/tools/stocktake.test.ts` -- 11/11 pass (4 existing + 7 new)
- `bun test tests/agents-visibility.test.ts` -- 9/9 pass (from Plan 01)
- `grep 'config-hook' src/tools/stocktake.ts` -- matches found
- `grep 'configHookAgents' src/tools/stocktake.ts` -- matches found
- `grep 'AGENT_REGISTRY' src/tools/stocktake.ts` -- match found
- Full test suite: 1179/1181 pass (2 pre-existing failures in unrelated agent config tests)

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all data flows are wired to real agent maps.

## Self-Check: PASSED
