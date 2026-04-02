---
phase: 13-session-observability
plan: 02
subsystem: observability
tags: [token-tracking, context-monitoring, event-emitters, hook-handlers, session-events]

requires:
  - phase: 13-session-observability
    provides: Structured event types, session logger, retention (Plan 01)
  - phase: 09-model-fallback-integration
    provides: ErrorType enum and classifyErrorType for error event classification
provides:
  - Token accumulation from AssistantMessage shapes (accumulateTokens, accumulateTokensFromMessage)
  - Context utilization monitoring with one-time 80% warning (ContextMonitor)
  - In-memory SessionEventStore for per-session event/token/tool accumulation
  - 6 typed event emitter helpers (fallback, error, decision, model_switch, tool_complete, phase_transition)
  - Hook handler factories for event/tool.execute.before/tool.execute.after hooks
affects: [13-session-observability, 14-skills-commands, 17-integration-polish]

tech-stack:
  added: []
  patterns: [pure token accumulation, one-time context warning, in-memory event store with flush, handler factory pattern]

key-files:
  created:
    - src/observability/token-tracker.ts
    - src/observability/context-monitor.ts
    - src/observability/event-store.ts
    - src/observability/event-emitter.ts
    - src/observability/event-handlers.ts
    - src/observability/index.ts
    - tests/observability/token-tracker.test.ts
    - tests/observability/context-monitor.test.ts
    - tests/observability/event-handlers.test.ts
  modified: []

key-decisions:
  - "Created event-store.ts (SessionEventStore) as blocking dependency not created by Plan 01 -- in-memory store with flush-to-disk pattern"
  - "TokenAggregate uses Object.freeze for immutable returns, Partial<TokenAggregate> for flexible accumulation"
  - "ContextMonitor fires warning once per session via per-session warned flag (D-36)"
  - "Event handlers are pure observers -- read event data, append to store, never modify output"
  - "Tool success detection via metadata.error flag, title prefix, and output prefix heuristics"
  - "Default 200k context limit when provider metadata unavailable"

patterns-established:
  - "Token accumulation: pure spread-based accumulateTokens with Partial<T> incoming"
  - "One-time warning: per-session warned flag in ContextMonitor prevents repeated toasts"
  - "Handler factory: createXHandler(deps) returns handler function matching hook signature"
  - "Event emitter: pure function returning frozen ObservabilityEvent with timestamp"

requirements-completed: [OB-02, HK-04, HK-09, HK-10]

duration: 5min
completed: 2026-04-02
---

# Phase 13 Plan 02: Event Collection Layer Summary

**Token accumulation from AssistantMessage shapes, 80% context warning with one-time toast, error classification piping, tool metric collection, and hook handler factories for OpenCode event system**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-02T14:42:56Z
- **Completed:** 2026-04-02T14:48:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Pure token accumulation from SDK AssistantMessage shapes with immutable spread-based aggregation
- Context utilization monitoring that fires 80% warning toast exactly once per session
- In-memory SessionEventStore accumulating events, tokens, and tool metrics per session with flush-to-disk
- 6 typed event emitter helpers and 3 hook handler factories ready for index.ts wiring
- Error classification piped from existing fallback/error-classifier (no reimplementation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Token tracker and context monitor** - `f8f5ee8` (feat)
2. **Task 2: Event emitters and hook handler factories** - `d43a6b1` (feat)
3. **Formatting fix** - `febf602` (chore)

## Files Created/Modified
- `src/observability/token-tracker.ts` - Pure token accumulation (accumulateTokens, accumulateTokensFromMessage, createEmptyTokenAggregate)
- `src/observability/context-monitor.ts` - Context utilization tracking (checkContextUtilization, ContextMonitor class)
- `src/observability/event-store.ts` - In-memory SessionEventStore with ObservabilityEvent union type
- `src/observability/event-emitter.ts` - 6 typed event constructors (emitFallbackEvent, emitErrorEvent, etc.)
- `src/observability/event-handlers.ts` - 3 hook handler factories (event, tool.execute.before, tool.execute.after)
- `src/observability/index.ts` - Barrel export for all observability modules
- `tests/observability/token-tracker.test.ts` - 8 tests for token accumulation
- `tests/observability/context-monitor.test.ts` - 8 tests for context monitoring
- `tests/observability/event-handlers.test.ts` - 11 tests for hook handlers

## Decisions Made
- Created event-store.ts as blocking dependency -- Plan 01 did not create SessionEventStore or ObservabilityEvent union; these were needed for event-handlers.ts
- TokenAggregate uses Object.freeze for immutable returns per CLAUDE.md immutability constraint
- Default 200k context limit when provider metadata is unavailable (reasonable default for modern models)
- Tool success detection uses three heuristics: metadata.error flag, title starting with "Error", output starting with "Error:"
- classifyErrorType and isRetryableError imported from existing error-classifier (no duplication per D-37)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing event-store.ts dependency**
- **Found during:** Task 2 (Event emitters and hook handler factories)
- **Issue:** Plan interfaces reference SessionEventStore and ObservabilityEvent from src/observability/event-store.ts, but Plan 01 did not create this file
- **Fix:** Created event-store.ts with SessionEventStore class, ObservabilityEvent union type (9 event types), ToolMetrics interface, and SessionEvents snapshot type
- **Files modified:** src/observability/event-store.ts
- **Verification:** All 27 new tests pass, full suite 933 tests pass
- **Committed in:** d43a6b1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential dependency creation. No scope creep -- event-store.ts was described in the plan interfaces but not created by the prerequisite plan.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data paths are wired. Token accumulation receives real SDK data shapes. Context monitoring computes from actual input token counts. Event handlers produce complete events.

## Next Phase Readiness
- Event collection layer complete, ready for index.ts wiring (Plan 03 or future integration)
- SessionEventStore provides the in-memory buffer that session-logger.ts can persist to disk
- Handler factories return functions matching OpenCode hook signatures
- Context monitor ready to receive actual model context limits from provider metadata
- Tool metric collection ready for /session-stats command consumption

---
*Phase: 13-session-observability*
*Completed: 2026-04-02*
