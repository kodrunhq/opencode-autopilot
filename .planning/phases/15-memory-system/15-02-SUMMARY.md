---
phase: 15-memory-system
plan: 02
subsystem: memory
tags: [capture, decay, retrieval, progressive-disclosure, token-budget]
dependency_graph:
  requires: [15-01]
  provides: [memory-capture, memory-decay, memory-retrieval]
  affects: [15-03]
tech_stack:
  added: []
  patterns: [event-subscriber, exponential-decay, progressive-disclosure, token-budgeting]
key_files:
  created:
    - src/memory/capture.ts
    - src/memory/decay.ts
    - src/memory/retrieval.ts
    - tests/memory/capture.test.ts
    - tests/memory/decay.test.ts
    - tests/memory/retrieval.test.ts
  modified:
    - src/memory/index.ts
decisions:
  - Event capture uses app.decision and app.phase_transition event types (not raw observability events) to avoid tight coupling with event-store internals
  - Noisy events filtered via CAPTURE_EVENT_TYPES set (whitelist) rather than blacklist for safety
  - Observations sorted within buildMemoryContext for defensive correctness even if caller pre-sorts
metrics:
  duration: 6m30s
  completed: "2026-04-02T20:37:51Z"
  tasks: 2
  files: 7
  tests_added: 32
  tests_total: 83
---

# Phase 15 Plan 02: Capture & Retrieval Layers Summary

Event capture handler extracts memory observations from session events (decision, error, phase_transition) with exponential decay scoring and 3-layer progressive disclosure retrieval within configurable token budget.

## What Was Built

### Event Capture Handler (src/memory/capture.ts)
- Factory function `createMemoryCaptureHandler(deps)` returns async event handler matching OpenCode hook signature
- Routes `session.created` (registers session, upserts project), `session.error` (extracts error observations), `session.deleted` (triggers deferred pruning)
- Captures `app.decision` events as decision observations and `app.phase_transition` as pattern observations
- Filters out noisy events: tool_complete, context_warning, session.idle, session.compacted, message.updated
- All observation inserts wrapped in try/catch (best-effort, never breaks session)
- Pruning deferred via `setTimeout(fn, 0)` on session.deleted

### Decay Scoring (src/memory/decay.ts)
- `computeRelevanceScore(lastAccessed, accessCount, type, halfLifeDays)`: exponential time decay formula
  - `timeDecay = exp(-ageDays / halfLifeDays)` with default 90-day half-life
  - `frequencyWeight = max(log2(accessCount + 1), 1)` for access boost
  - `typeWeight = TYPE_WEIGHTS[type]` (decision=1.5, pattern=1.2, error=1.0, tool_usage=0.4)
- `pruneStaleObservations(projectId, db)`: removes below-threshold observations and enforces 10k cap

### 3-Layer Progressive Disclosure Retrieval (src/memory/retrieval.ts)
- `scoreAndRankObservations`: scores and sorts observations by composite relevance
- `buildMemoryContext`: builds markdown within token budget using 3 layers:
  - Layer 1 (always): summaries grouped by type (Key Decisions, Patterns, Recent Errors)
  - Layer 2 (budget > 500 chars remaining): Recent Activity timeline
  - Layer 3 (budget > 1000 chars remaining): full content for top 1-2 observations
- `retrieveMemoryContext`: convenience function tying project lookup + scoring + context building
- `ScoredObservation` type extends Observation with relevanceScore
- Preferences section for user-level preferences

## Commits

| Hash | Type | Description |
|------|------|-------------|
| c36e7d0 | test | Failing tests for capture handler and decay scoring |
| 79f39fb | feat | Event capture handler and decay scoring implementation |
| df2e19f | test | Failing tests for 3-layer progressive disclosure retrieval |
| 07db844 | feat | 3-layer progressive disclosure retrieval with token budget |

## Test Results

- 83 tests across 6 memory test files (32 new tests added)
- All tests pass
- No lint issues in new files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Internal sorting in buildMemoryContext**
- **Found during:** Task 2 GREEN phase
- **Issue:** Test expected observations sorted by relevance within each type group, but groupByType preserved insertion order
- **Fix:** Added explicit sort by relevanceScore before grouping in buildMemoryContext for defensive correctness
- **Files modified:** src/memory/retrieval.ts

**2. [Rule 2 - Missing] Event type naming convention**
- **Found during:** Task 1 implementation
- **Issue:** Plan referenced observability event types directly (decision, error, phase_transition), but the OpenCode event system uses different event type strings (session.error, session.created, etc.). Decision and phase_transition events from the pipeline are not directly routed through the same event system.
- **Fix:** Used `app.decision` and `app.phase_transition` as custom event types for pipeline-generated events, and `session.error` for error capture from the OpenCode event hook. This decouples memory capture from the observability event store internals.
- **Files modified:** src/memory/capture.ts, tests/memory/capture.test.ts

## Known Stubs

None. All functions are fully wired with real data sources and produce real output.

## Self-Check: PASSED

All 6 created files exist. All 4 commits verified in git log.
