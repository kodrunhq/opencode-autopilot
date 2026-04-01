---
phase: 09-model-fallback-integration
plan: 01
subsystem: orchestrator
tags: [fallback, error-classification, state-machine, message-replay, zod, config-migration]

# Dependency graph
requires:
  - phase: 04-orchestrator-config-state
    provides: pluginConfigSchemaV2, config load/save with v1->v2 migration, orchestrator sub-schemas
provides:
  - FallbackState, FallbackPlan, ErrorType, ContentTier, MessagePart types
  - Error classifier with 15 retryable error patterns and type classification
  - Immutable fallback state machine (create, plan, commit, recover)
  - 3-tier message replay degradation (all parts, text+images, text only)
  - Fallback config Zod schema with validated defaults
  - pluginConfigSchemaV3 with automatic v1->v3 and v2->v3 migration
affects: [09-02-fallback-manager, 09-03-plugin-hooks]

# Tech tracking
tech-stack:
  added: []
  patterns: [plan-then-commit state machine, 3-tier content degradation, chained config migration]

key-files:
  created:
    - src/orchestrator/fallback/types.ts
    - src/orchestrator/fallback/error-classifier.ts
    - src/orchestrator/fallback/fallback-state.ts
    - src/orchestrator/fallback/message-replay.ts
    - src/orchestrator/fallback/fallback-config.ts
    - src/orchestrator/fallback/index.ts
    - tests/orchestrator/fallback/error-classifier.test.ts
    - tests/orchestrator/fallback/fallback-state.test.ts
    - tests/orchestrator/fallback/message-replay.test.ts
    - tests/orchestrator/fallback/fallback-config.test.ts
  modified:
    - src/config.ts
    - tests/config.test.ts

key-decisions:
  - "Immutable state transitions via spread-based updates -- no Map.set() or direct property assignment on state"
  - "Config v3 migration chains v1->v2->v3 reusing existing migrateV1toV2 function"
  - "Pre-computed fallbackDefaults at module level for Zod v4 nested default compatibility"

patterns-established:
  - "Plan-then-commit state machine: planFallback returns plan without mutation, commitFallback applies it immutably"
  - "Chained config migration: each version migrates to next (v1->v2->v3) with auto-persist on load"

requirements-completed: [FLLB-01, FLLB-02, FLLB-03, FLLB-04]

# Metrics
duration: 7min
completed: 2026-04-01
---

# Phase 9 Plan 1: Fallback Core Summary

**Pure-function error classifier, immutable fallback state machine, 3-tier message replay, and Zod fallback config with v3 schema migration**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-01T12:18:21Z
- **Completed:** 2026-04-01T12:25:28Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Ported battle-tested error classification from opencode-fallback with 15 regex patterns, status code extraction, and error type classification
- Built immutable fallback state machine with plan-then-commit pattern preventing partial state on failed dispatches
- Implemented 3-tier message content degradation for maximum provider compatibility
- Upgraded pluginConfigSchema to v3 with automatic migration from v1 and v2 configs

## Task Commits

Each task was committed atomically:

1. **Task 1: Fallback types, error classifier, state machine, and message replay** - `e8f9cd0` (feat)
2. **Task 2: Fallback config schema and pluginConfigSchema v3 migration** - `4e039ef` (feat)

## Files Created/Modified
- `src/orchestrator/fallback/types.ts` - FallbackState, FallbackPlan, ErrorType, ContentTier, MessagePart types
- `src/orchestrator/fallback/error-classifier.ts` - isRetryableError, classifyErrorType, extractStatusCode, getErrorMessage with 15 patterns
- `src/orchestrator/fallback/fallback-state.ts` - createFallbackState, planFallback, commitFallback, recoverToOriginal (all pure, immutable)
- `src/orchestrator/fallback/message-replay.ts` - filterPartsByTier, replayWithDegradation with 3-tier content degradation
- `src/orchestrator/fallback/fallback-config.ts` - Zod schema for fallback settings with validated defaults
- `src/orchestrator/fallback/index.ts` - Barrel export for all fallback modules
- `src/config.ts` - Upgraded to pluginConfigSchemaV3 with fallback namespace, v2->v3 migration
- `tests/orchestrator/fallback/error-classifier.test.ts` - 18 tests for error classification
- `tests/orchestrator/fallback/fallback-state.test.ts` - 15 tests for state machine transitions
- `tests/orchestrator/fallback/message-replay.test.ts` - 10 tests for message replay degradation
- `tests/orchestrator/fallback/fallback-config.test.ts` - 9 tests for config schema validation
- `tests/config.test.ts` - Updated v1/v2/v3 migration tests (28 tests total)

## Decisions Made
- Immutable state transitions via spread-based updates -- failedModels uses `new Map([...existing])` instead of `.set()` to avoid mutation
- Config v3 migration chains v1->v2->v3 reusing the existing migrateV1toV2 function for composability
- Pre-computed fallbackDefaults at module level following the established pattern from orchestratorDefaults and confidenceDefaults

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed API key pattern matching for "No API key provided"**
- **Found during:** Task 1 (error classifier implementation)
- **Issue:** classifyErrorType regex for missing_api_key did not match "No API key provided" pattern (only matched "missing" not "no" prefix)
- **Fix:** Extended regex to include `no\s` alternative: `/missing|no\s|not\s+(?:provided|found|set|configured)/i`
- **Files modified:** src/orchestrator/fallback/error-classifier.ts
- **Verification:** Test "returns 'missing_api_key' for missing key errors" passes for both patterns
- **Committed in:** e8f9cd0 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor regex improvement for broader error pattern coverage. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all modules are fully implemented with no placeholder data or TODO markers.

## Next Phase Readiness
- All pure-function fallback modules are ready for Plan 02 (fallback-manager) to consume
- The fallbackConfigSchema is available for FallbackManager to read configuration
- The barrel export at src/orchestrator/fallback/index.ts provides all public APIs
- 595 tests across full suite pass with 0 regressions

## Self-Check: PASSED

All 12 created/modified files verified on disk. Both task commits (e8f9cd0, 4e039ef) found in git log.

---
*Phase: 09-model-fallback-integration*
*Completed: 2026-04-01*
