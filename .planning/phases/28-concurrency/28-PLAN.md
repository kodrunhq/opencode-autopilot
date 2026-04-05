# Phase 28: Concurrency Foundation

**Goal**: Prove thread-safety, fix identified race conditions, add 40+ concurrency tests
**Depends on**: Phase 27 (Architecture Simplification)
**Effort**: 2 plans, 10 tasks, ~2 days
**Risk**: MEDIUM — Concurrency bugs are subtle, but modular code is easier to test
**PR Increment**: 40+ concurrency tests, 1 real bug fix (insertObservation transaction)

---

## Plan 28-01: SQLite Contention Tests (5 tasks)

### Task 1: Add SQLite busy_timeout configuration
- **Files**: `src/kernel/database.ts` (modify)
- **Dependencies**: Phase 27 complete
- **Action**: Configure `busy_timeout` for SQLite to handle concurrent writes gracefully. Default 5000ms.
- **Test**: `tests/kernel/busy-timeout.test.ts` — busy_timeout configured
- **Verification**: `PRAGMA busy_timeout` returns configured value
- **Worktree**: No — isolated change

### Task 2: Transaction wrapper with retry
- **Files**: `src/kernel/transaction.ts` (new)
- **Dependencies**: Task 1
- **Action**: Create `withTransaction(fn, { maxRetries, backoff })` wrapper. Retry on SQLITE_BUSY.
- **Test**: `tests/kernel/transaction.test.ts` — retry on busy, fail after max retries
- **Verification**: Transaction wrapper tested with mock busy

### Task 3: Fix insertObservation transaction
- **Files**: `src/memory/repository.ts` (modify)
- **Dependencies**: Task 2
- **Action**: Wrap insertObservation in `withTransaction`. Uses `BEGIN IMMEDIATE` to prevent races.
- **Test**: `tests/memory/concurrency.test.ts` — 10 parallel inserts succeed
- **Verification**: No ID collisions under concurrent writes
- **Worktree**: No — test covers correctness

### Task 4: Concurrent write stress test
- **Files**: `tests/kernel/concurrency.test.ts` (new)
- **Dependencies**: Task 3
- **Action**: 100 parallel writes to kernel database. Verify all succeed or fail gracefully.
- **Test**: Self-contained stress test
- **Verification**: 0 data loss, 0 deadlocks

### Task 5: Memory subsystem contention tests
- **Files**: `tests/memory/concurrency.test.ts` (new)
- **Dependencies**: Task 4
- **Action**: Concurrent `insertObservation`, `upsertPreference`, `retrieveMemoryContext`. Verify consistency.
- **Test**: Self-contained
- **Verification**: Memory ops thread-safe

---

## Plan 28-02: Hook Race Tests (5 tasks)

### Task 6: Concurrent hook execution test
- **Files**: `tests/hooks/concurrency.test.ts` (new)
- **Dependencies**: Phase 27 complete
- **Action**: Fire 10 concurrent events through all hooks. Verify no cross-contamination, no crashes.
- **Test**: Self-contained
- **Verification**: Hook handlers handle concurrent events safely

### Task 7: Event store concurrent append test
- **Files**: `tests/observability/event-store.test.ts` (modify)
- **Dependencies**: Task 6
- **Action**: 100 concurrent `appendEvent` calls. Verify all events persisted, no corruption.
- **Test**: Existing tests + new concurrent append test
- **Verification**: Event store handles concurrent writes

### Task 8: Fallback manager concurrent error test
- **Files**: `tests/orchestrator/fallback/fallback-manager.test.ts` (modify)
- **Dependencies**: Task 7
- **Action**: Add test: 10 concurrent `handleError` calls, only first returns fallback plan.
- **Test**: Existing tests + new concurrent error test
- **Verification**: Locking prevents duplicate fallback dispatches

### Task 9: Memory capture concurrent write test
- **Files**: `tests/memory/capture.test.ts` (modify)
- **Dependencies**: Task 8
- **Action**: 10 concurrent `memoryCaptureHandler` calls. Verify all observations captured, no duplicates.
- **Test**: Existing tests + new concurrent capture test
- **Verification**: Memory capture thread-safe after transaction fix

### Task 10: Integration test: full pipeline under concurrency
- **Files**: `tests/integration/concurrency.test.ts` (new)
- **Dependencies**: Tasks 6-9
- **Action**: Run full pipeline (RECON→RETROSPECTIVE) while firing concurrent events.
- **Test**: Full pipeline under load
- **Verification**: Pipeline completes, no race conditions

---

## Success Criteria

- [x] `insertObservation` wrapped in transaction
- [x] 40+ new concurrency tests passing
- [x] 100 concurrent writes succeed without data loss
- [x] No deadlocks under load
- [x] All existing tests still pass
- [x] SQLite busy_timeout configured