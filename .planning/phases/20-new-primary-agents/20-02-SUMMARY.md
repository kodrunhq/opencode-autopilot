---
phase: 20-new-primary-agents
plan: 02
subsystem: agents
tags: [config-hook, tab-cycle, primary-agents, visibility]

requires:
  - phase: 20-new-primary-agents/01
    provides: debuggerAgent, plannerAgent, reviewerAgent module definitions
provides:
  - 8-entry agents map with 4 primary Tab-cycleable agents
  - Updated visibility tests covering new agent count and permissions
affects: [agent-expansion, config-hook, tab-cycle-ordering]

tech-stack:
  added: []
  patterns: [alphabetical agent map ordering for Tab-cycle consistency]

key-files:
  created: []
  modified:
    - src/agents/index.ts
    - tests/agents-visibility.test.ts
    - tests/orchestrate-pipeline.test.ts

key-decisions:
  - "Alphabetical ordering in agents map ensures Tab-cycle order matches: autopilot, debugger, planner, reviewer"

patterns-established:
  - "Primary agents use mode 'all' for both Tab-cycle and @-mention visibility"
  - "Agent map entries ordered alphabetically for predictable Tab-cycle"

requirements-completed: [AGNT-13]

duration: 2min
completed: 2026-04-03
---

# Phase 20 Plan 02: Agent Wiring and Visibility Tests Summary

**Wired debugger, planner, reviewer into the agents map (8 total) with Tab-cycle ordering verified alphabetically**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-03T14:44:27Z
- **Completed:** 2026-04-03T14:46:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Wired three new primary agents (debugger, planner, reviewer) into the agents map exported from index.ts
- Updated agents map from 5 to 8 entries in alphabetical order for Tab-cycle consistency
- Updated all test assertions: 8 standard, 10 pipeline, 18 total agents
- Added permission tests for new agents (edit/bash/webfetch)
- Added Tab-cycle alphabetical ordering verification test (AGNT-13)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire agents into index.ts and add re-exports** - `1fbfc0d` (feat)
2. **Task 2: Update agents-visibility tests for new agent count and primary set** - `ba58051` (test)

## Files Created/Modified
- `src/agents/index.ts` - Added imports, map entries, and re-exports for debugger, planner, reviewer
- `tests/agents-visibility.test.ts` - Updated count assertions, added primary agent set and permission tests
- `tests/orchestrate-pipeline.test.ts` - Updated configHook test to expect 18 agents (was 15)

## Decisions Made
- Alphabetical ordering in agents map ensures predictable Tab-cycle order

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed configHook pipeline test expecting stale agent count**
- **Found during:** Task 2 (visibility test updates)
- **Issue:** `tests/orchestrate-pipeline.test.ts` expected 15 total agents (5 standard + 10 pipeline) but now 18 (8 + 10)
- **Fix:** Updated assertion to expect 18 and added assertions for the 3 new agents
- **Files modified:** tests/orchestrate-pipeline.test.ts
- **Verification:** `bun test` passes with 1188/1188 tests
- **Committed in:** ba58051 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary correction for test suite consistency. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 8 agents wired and tested, ready for asset expansion phases
- Tab-cycle ordering confirmed alphabetical: autopilot, debugger, planner, reviewer
- Full test suite passes (1188 tests, 0 failures)

---
*Phase: 20-new-primary-agents*
*Completed: 2026-04-03*
