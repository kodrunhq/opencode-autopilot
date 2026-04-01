---
phase: 07-learning-resilience
plan: 03
subsystem: orchestrator
tags: [forensics, failure-diagnosis, resilience, pipeline-state, zod]

requires:
  - phase: 07-01
    provides: lesson schemas and types (lessonDomainSchema, lessonSchema, lessonMemorySchema)
  - phase: 06-04
    provides: orchestrateCore with handler dispatch, PHASE_HANDLERS, state management
provides:
  - failureContextSchema on pipelineStateSchema for failure metadata persistence
  - oc_forensics tool for post-mortem failure diagnosis
  - isRecoverable/getSuggestedAction classification logic
affects: [07-02, 07-04, orchestrator-recovery]

tech-stack:
  added: []
  patterns: [failure-metadata-capture, best-effort-save-in-catch, recoverable-vs-terminal-classification]

key-files:
  created:
    - src/tools/forensics.ts
    - tests/orchestrator/forensics.test.ts
  modified:
    - src/orchestrator/schemas.ts
    - src/orchestrator/types.ts
    - src/tools/orchestrate.ts
    - src/index.ts

key-decisions:
  - "BUILD failures terminal, all other phases recoverable (strike overflow = unrecoverable)"
  - "RECON failure suggests restart (nothing to resume from), other recoverable phases suggest resume"
  - "Best-effort failure metadata save in catch block -- inner errors swallowed to preserve original error"

patterns-established:
  - "Failure metadata capture: catch block persists failureContext before returning error JSON"
  - "Nullable default pattern: failureContext uses .nullable().default(null) for backward compat"

requirements-completed: [LRNR-03, LRNR-04]

duration: 4min
completed: 2026-04-01
---

# Phase 07 Plan 03: Failure Capture & Forensics Summary

**failureContext schema on pipeline state with best-effort catch-block persistence, plus oc_forensics tool classifying failures as recoverable/terminal with suggested actions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-01T07:43:24Z
- **Completed:** 2026-04-01T07:47:36Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added failureContextSchema to pipelineStateSchema with nullable default for backward compatibility
- Enhanced orchestrateCore catch block to persist failedPhase, errorMessage, lastSuccessfulPhase before returning error
- Created oc_forensics tool with recoverable/terminal classification and suggested recovery actions
- 15 tests covering schema validation, backward compat, failure capture, and all forensics paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Add failureContext to schema and capture failure metadata in orchestrateCore** - `bef5312` (feat)
2. **Task 2: Create oc_forensics tool and register in plugin** - `483f54d` (feat)

## Files Created/Modified
- `src/orchestrator/schemas.ts` - Added failureContextSchema and failureContext field on pipelineStateSchema
- `src/orchestrator/types.ts` - Added FailureContext type export
- `src/tools/orchestrate.ts` - Enhanced catch block with best-effort failure metadata persistence
- `src/tools/forensics.ts` - New tool: forensicsCore + ocForensics with isRecoverable/getSuggestedAction
- `src/index.ts` - Registered oc_forensics in plugin tool map
- `tests/orchestrator/forensics.test.ts` - 15 tests for schema, capture logic, and forensics diagnosis

## Decisions Made
- BUILD failures classified as terminal (strike overflow is unrecoverable), all other phases recoverable
- RECON failure suggests "restart" since there is nothing to resume from; other recoverable phases suggest "resume"
- Best-effort failure metadata save in catch block: inner save errors swallowed so original error takes priority

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed unused PipelineState import from forensics.ts**
- **Found during:** Task 2 (lint check)
- **Issue:** Unused type import triggered lint error
- **Fix:** Removed `import type { PipelineState }` since forensicsCore only uses loadState return type implicitly
- **Files modified:** src/tools/forensics.ts
- **Verification:** `bun run lint` passes with no errors
- **Committed in:** 483f54d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Trivial unused import removal. No scope creep.

## Issues Encountered
- PHASE_HANDLERS is Object.freeze'd so handler mocking via assignment fails in tests. Solved by testing the failure capture logic directly through state utilities rather than integration-testing through orchestrateCore with mocked handlers.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all functionality is fully wired.

## Next Phase Readiness
- failureContext is available on PipelineState for lesson extraction (07-02 dependency)
- oc_forensics tool ready for user-facing pipeline diagnosis
- No blockers for remaining 07 plans

---
*Phase: 07-learning-resilience*
*Completed: 2026-04-01*
