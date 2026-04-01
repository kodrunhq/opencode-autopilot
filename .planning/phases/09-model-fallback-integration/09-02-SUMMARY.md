---
phase: 09-model-fallback-integration
plan: 02
subsystem: orchestrator
tags: [fallback, concurrency, session-management, state-machine, ttft-timeout]

# Dependency graph
requires:
  - phase: 09-model-fallback-integration (plan 01)
    provides: Pure function modules (error-classifier, fallback-state, message-replay, fallback-config, types)
provides:
  - FallbackManager class encapsulating per-session fallback orchestration
  - Concurrency guards for dual event handler race, self-abort suppression, stale error filtering
  - TTFT timeout management with callback-based design
  - Session lifecycle (init, cleanup, parent-child mapping)
affects: [09-03-hook-integration, orchestrator-fallback]

# Tech tracking
tech-stack:
  added: []
  patterns: [callback-injection for testability, per-session Map/Set state encapsulation, guard-chain pattern for error handling]

key-files:
  created:
    - src/orchestrator/fallback/fallback-manager.ts
    - tests/orchestrator/fallback/fallback-manager.test.ts
  modified:
    - src/orchestrator/fallback/index.ts

key-decisions:
  - "Callback injection (resolveFallbackChain) keeps FallbackManager testable without OpenCode runtime"
  - "Guard-chain pattern in handleError: self-abort -> stale -> retryable -> lock -> state -> plan"
  - "TTFT timeout uses real setTimeout with callback injection (no fake timers needed in tests)"

patterns-established:
  - "Guard-chain: sequential early-return checks before core logic in handleError"
  - "Callback injection: SDK operations passed as constructor callbacks for testability"
  - "Per-session Maps/Sets: all concurrency state encapsulated in private class fields"

requirements-completed: [FLLB-05, FLLB-06]

# Metrics
duration: 3min
completed: 2026-04-01
---

# Phase 9 Plan 2: FallbackManager Summary

**FallbackManager class with 17 public methods encapsulating per-session concurrency guards, TTFT timeout, and self-abort suppression via callback injection**

## Performance

- **Duration:** 3min
- **Started:** 2026-04-01T12:29:06Z
- **Completed:** 2026-04-01T12:32:40Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- FallbackManager class with full per-session state lifecycle (init, get, cleanup)
- Concurrency guards preventing dual event handler race (Pitfall 1), self-abort errors (Pitfall 2), and stale errors (Pitfall 5)
- handleError orchestrating the complete error-to-plan flow with 6 guard checks
- TTFT timeout management with callback-based design, cancellation on first token
- 36 new tests covering all concurrency scenarios including concurrent handleError race
- Barrel export updated with FallbackManager and FallbackManagerOptions

## Task Commits

Each task was committed atomically:

1. **Task 1: FallbackManager class (RED)** - `e3d8ea9` (test)
2. **Task 1: FallbackManager class (GREEN)** - `4413e99` (feat)
3. **Task 2: Barrel export and lint fixes** - `ddd0157` (feat)

_Note: TDD task has separate test and implementation commits._

## Files Created/Modified
- `src/orchestrator/fallback/fallback-manager.ts` - FallbackManager class with 17 public methods, 8 private Maps/Sets
- `tests/orchestrator/fallback/fallback-manager.test.ts` - 36 tests covering session lifecycle, concurrency guards, TTFT timeout, handleError orchestration
- `src/orchestrator/fallback/index.ts` - Updated barrel export with FallbackManager and FallbackManagerOptions

## Decisions Made
- Used callback injection (resolveFallbackChain) to keep FallbackManager testable without mocking the OpenCode runtime
- Guard-chain pattern in handleError: ordered checks (self-abort, stale, retryable, lock, state, plan) with early returns
- Small real timeouts (50ms) in TTFT tests rather than fake timer mocking for simplicity and reliability

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Biome lint reported pre-existing nested root configuration error from worktree setup; verified by running Biome directly on changed files (all clean)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- FallbackManager ready for hook integration in Plan 03
- All pure function modules (Plan 01) and coordination layer (Plan 02) complete
- 97 tests passing across 5 fallback test files

## Self-Check: PASSED

All 3 created/modified files verified present. All 3 commit hashes verified in git log.

---
*Phase: 09-model-fallback-integration*
*Completed: 2026-04-01*
