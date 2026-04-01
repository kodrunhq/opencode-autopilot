---
phase: 08-testing-ci
plan: 01
subsystem: testing
tags: [typescript, tsc, coverage, bunfig, type-safety]

# Dependency graph
requires:
  - phase: 07-learning-resilience
    provides: Full codebase with all features implemented
provides:
  - Zero TypeScript errors across entire codebase
  - 90% coverage threshold enforcement via bunfig.toml
  - Tool registration smoke test for all 11 oc_* tools
affects: [08-02-ci-pipeline]

# Tech tracking
tech-stack:
  added: [bunfig.toml]
  patterns: [as-const permission narrowing, readonly-to-mutable spread pattern]

key-files:
  created: [bunfig.toml]
  modified: [src/agents/*.ts, src/agents/pipeline/*.ts, src/orchestrator/handlers/build.ts, src/review/memory.ts, src/tools/orchestrate.ts, src/tools/review.ts, tests/index.test.ts, tests/handlers-early.test.ts, tests/handlers-late.test.ts, tests/orchestrate-pipeline.test.ts, tests/orchestrator/forensics.test.ts, tests/orchestrator/handlers/retrospective.test.ts, tests/orchestrator/lesson-memory.test.ts, tests/review/tool.test.ts]

key-decisions:
  - "90% coverage floor (not 95%) provides regression protection while leaving headroom for WIP code"
  - "as const on permission objects is the minimal fix for Object.freeze literal widening"
  - "Spread readonly arrays at assignment sites rather than changing return types"

patterns-established:
  - "as const on permission objects in agent files to prevent literal widening through Object.freeze"
  - "Spread readonly arrays into mutable arrays at DispatchResult assignment sites"

requirements-completed: [TCID-01, TCID-02, TCID-03]

# Metrics
duration: 8min
completed: 2026-04-01
---

# Phase 08 Plan 01: Type Cleanup and Coverage Floor Summary

**Zero tsc errors across 26 source/test files with 90% coverage threshold enforced via bunfig.toml and 11-tool registration smoke test**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-01T10:51:51Z
- **Completed:** 2026-04-01T10:59:44Z
- **Tasks:** 2
- **Files modified:** 28

## Accomplishments
- Eliminated all TypeScript type errors across the codebase (was 59 errors in 27 files)
- Added bunfig.toml enforcing 90% line and function coverage floor
- Added smoke test verifying all 11 oc_* tool registrations (531 total tests, 0 failures)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix all TypeScript type errors** - `78c2076` (fix)
2. **Task 2: Add bunfig.toml coverage thresholds and tool registration smoke test** - `fc53aee` (feat)

## Files Created/Modified
- `bunfig.toml` - Coverage threshold configuration (90% lines/functions)
- `src/agents/*.ts` (5 files) - Added `as const` to permission objects
- `src/agents/pipeline/*.ts` (10 files) - Added `as const` to permission objects
- `src/orchestrator/handlers/build.ts` - Spread readonly task arrays into mutable arrays
- `src/review/memory.ts` - Replaced Object.freeze on inner arrays with spread
- `src/tools/orchestrate.ts` - Double-cast through unknown for DispatchResult
- `src/tools/review.ts` - Double-cast through unknown for SelectableAgent
- `tests/index.test.ts` - Added tool registration smoke test
- `tests/handlers-early.test.ts` - Replaced invalid `signal` with `area`+`rationale`
- `tests/handlers-late.test.ts` - Fixed task status type literal
- `tests/orchestrate-pipeline.test.ts` - Added non-null assertions for config.agent
- `tests/orchestrator/forensics.test.ts` - Loosened makeMinimalState overrides type
- `tests/orchestrator/handlers/retrospective.test.ts` - Fixed mock parameter typing
- `tests/orchestrator/lesson-memory.test.ts` - Cast through unknown for readonly tuple
- `tests/review/tool.test.ts` - Cast parsed.action to string for toContain

## Decisions Made
- Used `as const` on permission objects rather than explicit type annotations (minimal change, idiomatic TS)
- Spread readonly arrays at assignment sites rather than changing function return types (preserves immutability guarantees)
- Set 90% coverage floor rather than current ~97% to allow headroom for new WIP code
- Fixed all test type errors discovered during execution (not just the 19 source files in the plan)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed type errors in 6 additional test files not listed in plan**
- **Found during:** Task 1 (type error fixing)
- **Issue:** Plan listed 21 errors in 19 files, but `bunx tsc --noEmit` revealed 59 errors across 27 files. Additional errors in: handlers-late.test.ts, orchestrate-pipeline.test.ts, forensics.test.ts, retrospective.test.ts, lesson-memory.test.ts, review/tool.test.ts
- **Fix:** Fixed status type literals, added non-null assertions, loosened test helper types, fixed mock parameter typing, cast through unknown where needed
- **Files modified:** 6 additional test files
- **Verification:** `bunx tsc --noEmit` exits 0, all 531 tests pass
- **Committed in:** 78c2076 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Additional test file fixes were necessary to achieve the plan's goal of zero tsc errors. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None

## Next Phase Readiness
- Type-clean codebase ready for CI pipeline (Plan 02)
- Coverage thresholds in bunfig.toml ready to be enforced as CI gate
- All 531 tests passing with 0 failures

---
*Phase: 08-testing-ci*
*Completed: 2026-04-01*
