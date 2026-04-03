---
phase: 24-coder-agent-built-in-replacements
plan: 03
subsystem: orchestrator
tags: [topological-sort, kahn-algorithm, wave-assignment, dependency-graph]

requires:
  - phase: 24-coder-agent-built-in-replacements
    provides: orchestrator pipeline with task/wave model

provides:
  - Automatic wave computation from task depends_on declarations
  - Cycle detection with BLOCKED status for circular dependencies
  - Backward-compatible schema extension (depends_on defaults to empty)

affects: [orchestrator, build-handler, planner-agents]

tech-stack:
  added: []
  patterns: [kahn-bfs-topological-sort, auto-wave-assignment]

key-files:
  created:
    - src/orchestrator/wave-assigner.ts
    - tests/orchestrator/wave-assigner.test.ts
  modified:
    - src/orchestrator/schemas.ts
    - src/orchestrator/handlers/build.ts
    - tests/handlers-late.test.ts
    - tests/orchestrate-pipeline.test.ts
    - tests/orchestrator/plan.test.ts
    - tests/tools/plan.test.ts

key-decisions:
  - "Kahn's BFS algorithm over DFS for natural wave-level grouping"
  - "Non-existent dependency IDs silently ignored for graceful degradation"
  - "Circular dependencies set task status to BLOCKED rather than erroring"

patterns-established:
  - "Wave auto-assignment: tasks declare depends_on, system computes waves via topological sort"
  - "effectiveTasks pattern: compute derived task list before wave grouping in build handler"

requirements-completed: []

duration: 4min
completed: 2026-04-03
---

# Phase 24 Plan 03: Wave Auto-Assignment Summary

**Kahn's algorithm wave assigner computes optimal wave numbers from task depends_on declarations, replacing manual wave assignment in the orchestrator pipeline**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-03T21:16:26Z
- **Completed:** 2026-04-03T21:20:06Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Wave-assigner module with Kahn's BFS topological sort, cycle detection, and 500-task hard cap
- taskSchema extended with depends_on field (backward compatible via .default([]))
- Build handler auto-assigns waves when tasks declare dependencies, marks cycles as BLOCKED
- 8 passing tests covering independent tasks, linear chains, diamond deps, cycles, empty lists, non-existent IDs, backward compat, and mixed scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Create wave-assigner module with Kahn's algorithm** - `5fd19b7` (feat)
2. **Task 2: Extend taskSchema with depends_on and wire wave-assigner into build handler** - `698d996` (feat)

## Files Created/Modified
- `src/orchestrator/wave-assigner.ts` - Kahn's algorithm wave assignment with cycle detection
- `tests/orchestrator/wave-assigner.test.ts` - 8 tests covering all wave assignment behaviors
- `src/orchestrator/schemas.ts` - Added depends_on field to taskSchema
- `src/orchestrator/handlers/build.ts` - Wired assignWaves call before wave dispatch
- `tests/handlers-late.test.ts` - Added depends_on to task fixtures
- `tests/orchestrate-pipeline.test.ts` - Added depends_on to task fixtures
- `tests/orchestrator/plan.test.ts` - Added depends_on to makeTask helper
- `tests/tools/plan.test.ts` - Added depends_on to task fixtures

## Decisions Made
- Used Kahn's BFS algorithm (not DFS) because it naturally produces wave-level grouping matching the existing wave model
- Non-existent dependency IDs are silently ignored rather than erroring, matching the graceful degradation pattern from dependency-resolver.ts
- Circular dependencies result in BLOCKED status on affected tasks rather than failing the entire build

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added depends_on to existing test fixtures**
- **Found during:** Task 2 (schema extension)
- **Issue:** Adding depends_on to taskSchema made it required in the inferred Task type, breaking existing test fixtures that didn't include the field
- **Fix:** Added `depends_on: []` to task objects in 4 test files (handlers-late, orchestrate-pipeline, plan, tools/plan)
- **Files modified:** tests/handlers-late.test.ts, tests/orchestrate-pipeline.test.ts, tests/orchestrator/plan.test.ts, tests/tools/plan.test.ts
- **Verification:** `bunx tsc --noEmit` passes clean
- **Committed in:** 698d996 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary fix for type safety after schema change. No scope creep.

## Issues Encountered
- Pre-existing biome lint configuration error from parallel agent worktrees (nested root config). Not caused by this plan's changes -- targeted file-level lint check passes clean.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired.

## Next Phase Readiness
- Wave auto-assignment is complete and integrated into the build handler
- Planners can now declare depends_on arrays and waves will be computed automatically
- Backward compatible: existing tasks without depends_on continue to work as before

---
*Phase: 24-coder-agent-built-in-replacements*
*Completed: 2026-04-03*
