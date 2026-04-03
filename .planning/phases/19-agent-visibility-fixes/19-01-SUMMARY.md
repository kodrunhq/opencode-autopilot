---
phase: 19-agent-visibility-fixes
plan: 01
subsystem: agents
tags: [bugfix, visibility, tab-cycle, testing]
dependency_graph:
  requires: []
  provides: [agent-visibility-fix, agents-map-export]
  affects: [19-02-stocktake-fix]
tech_stack:
  added: []
  patterns: [frozen-agent-config, mode-subagent]
key_files:
  created:
    - tests/agents-visibility.test.ts
  modified:
    - src/agents/researcher.ts
    - src/agents/metaprompter.ts
    - src/agents/index.ts
decisions:
  - "Researcher and metaprompter changed from mode 'all' to 'subagent' per D-06"
  - "Agents map exported for Plan 02 stocktake consumption"
  - "general and explore documented as OpenCode built-ins, not plugin agents"
metrics:
  duration: 1min
  completed: 2026-04-03
---

# Phase 19 Plan 01: Agent Visibility Fixes Summary

Fixed Tab-cycle pollution by correcting researcher and metaprompter modes from "all" to "subagent", exported agents map for stocktake, and added 9-test visibility suite covering all 15 plugin agents.

## What Was Done

### Task 1: Fix agent modes and export agents map
- Changed `mode: "all"` to `mode: "subagent"` in `src/agents/researcher.ts`
- Changed `mode: "all"` to `mode: "subagent"` in `src/agents/metaprompter.ts`
- Added `export` keyword to `const agents` in `src/agents/index.ts`
- Commit: `501e0e3`

### Task 2: Add agent visibility test suite
- Created `tests/agents-visibility.test.ts` with 9 tests and 41 assertions
- Covers all 10 pipeline agents (subagent + hidden), all 5 standard agents (mode checks), count validation, and built-in agent documentation
- Commit: `8989f3c`

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **Mode correction approach**: Direct edit of frozen config objects (mode property only), no changes to prompts, permissions, or descriptions
2. **Built-in documentation**: Used test assertions as permanent documentation that "general" and "explore" are OpenCode built-ins (BFIX-04)
3. **Export addition**: Added export keyword to existing `agents` const (no structural change) for Plan 02 consumption

## Known Stubs

None.

## Verification Results

- All 9 visibility tests pass (41 assertions)
- `grep` confirms researcher: subagent, metaprompter: subagent, autopilot: all
- `export const agents` confirmed in index.ts
- No new lint warnings introduced

## Self-Check: PASSED
