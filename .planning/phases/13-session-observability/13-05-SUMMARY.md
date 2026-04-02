---
phase: 13-session-observability
plan: 05
subsystem: testing
tags: [mock-provider, fallback, error-classifier, test-utility]

# Dependency graph
requires:
  - phase: 09-model-fallback-integration
    provides: error-classifier, FallbackManager, ErrorType, isRetryableError
provides:
  - Mock provider generating deterministic error objects for 5 failure modes
  - oc_mock_fallback tool for manual fallback chain exploration
  - Integration tests verifying mock errors against real error classifier
affects: [13-session-observability, 14-skills-commands]

# Tech tracking
tech-stack:
  added: []
  patterns: [mock-error-generation, frozen-error-objects, classifier-integration-testing]

key-files:
  created:
    - src/observability/mock/types.ts
    - src/observability/mock/mock-provider.ts
    - src/tools/mock-fallback.ts
    - tests/observability/mock-provider.test.ts
    - tests/tools/mock-fallback.test.ts
  modified: []

key-decisions:
  - "Timeout mock uses message pattern 'service unavailable (504)' instead of status-only 504 because real classifier matches by message regex, not by HTTP status for non-429 codes"
  - "Mock errors use Object.freeze on both outer and nested error objects for deep immutability"

patterns-established:
  - "Mock error generation: createMockError returns frozen error-like objects matching SDK shapes"
  - "Integration testing against real classifier: mock tests import actual classifyErrorType, not test doubles"

requirements-completed: [TS-03]

# Metrics
duration: 4min
completed: 2026-04-02
---

# Phase 13 Plan 05: Mock Provider & Fallback Test Tool Summary

**Deterministic mock error generator with 5 failure modes plus oc_mock_fallback tool for fallback chain testing and exploration**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-02T14:35:08Z
- **Completed:** 2026-04-02T14:39:17Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Mock provider generates frozen, deterministic error objects for rate_limit, quota_exceeded, timeout, malformed, and service_unavailable modes
- Each mock error verified against the real error classifier and isRetryableError functions (integration tests, not mocks)
- oc_mock_fallback tool provides list mode (shows all modes with descriptions) and simulation mode (generates, classifies, reports retryability)
- All 33 new tests pass, full suite remains at 893 tests with 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Mock provider types and error generator** - `6f6661a` (feat)
2. **Task 2: oc_mock_fallback tool** - `7e94a09` (feat)

## Files Created/Modified
- `src/observability/mock/types.ts` - MockFailureMode type, FAILURE_MODES frozen array, MockProviderConfig interface
- `src/observability/mock/mock-provider.ts` - createMockError function generating frozen error objects matching SDK error shapes
- `src/tools/mock-fallback.ts` - mockFallbackCore + ocMockFallback tool wrapper for fallback chain testing
- `tests/observability/mock-provider.test.ts` - 22 tests verifying classification, retryability, structure, immutability
- `tests/tools/mock-fallback.test.ts` - 11 tests verifying list mode, error mode, invalid mode, all failure modes

## Decisions Made
- Timeout mock error uses message pattern "service unavailable (504)" rather than relying on HTTP 504 status code alone. The real classifier (`classifyErrorType`) checks `/service.?unavailable/i` message pattern for the service_unavailable classification -- it does not map 504 status to service_unavailable. The plan assumed 504 would map directly, but the classifier only checks status 429 explicitly.
- Mock errors freeze both outer object and nested `error.message` objects for deep immutability.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed timeout mock error classification mismatch**
- **Found during:** Task 1 (mock provider implementation)
- **Issue:** Plan specified status 504 would classify as service_unavailable, but the real error classifier only checks status 429 by code; all other classifications use message pattern matching. A 504 with message "Request timeout" classified as "unknown".
- **Fix:** Changed timeout default message to include "service unavailable" pattern that the real classifier matches: "Request timeout -- service unavailable (504)"
- **Files modified:** src/observability/mock/mock-provider.ts
- **Verification:** All 22 mock provider tests pass, timeout correctly classified as service_unavailable
- **Committed in:** 6f6661a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary correction to match real classifier behavior. No scope creep.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all code paths are fully wired to real classifier functions.

## Next Phase Readiness
- Mock provider is ready for use in fallback chain integration tests
- oc_mock_fallback tool file created but not yet registered in index.ts (Plan 04's wiring task handles registration)
- src/observability/ directory established for future observability modules

## Self-Check: PASSED

All 6 files verified present. Both commit hashes (6f6661a, 7e94a09) confirmed in git log.

---
*Phase: 13-session-observability*
*Completed: 2026-04-02*
