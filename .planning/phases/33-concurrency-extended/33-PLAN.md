# Phase 33: Concurrency Foundation (Extended)

**Goal**: Extend v6 Phase 28 concurrency work with SQLite contention tests for background agent workload
**Depends on**: Phase 32 (Config v7), Phase 28 (Concurrency Foundation)
**Effort**: 2 plans, 6 tasks, ~1.5 days
**Risk**: MEDIUM — SQLite under concurrent writes needs WAL tuning
**PR Increment**: 20+ new concurrency tests, SQLite busy_timeout wrapper proven

---

## Plan 33-01: SQLite Contention Tests (3 tasks)

### Task 1: Concurrent insert stress test
- **Files**: `tests/kernel/concurrency.test.ts` (new)
- **Dependencies**: Phase 28 complete
- **Action**: 10 parallel `Promise.all()` inserts into kernel DB. Verify all succeed or fail gracefully with busy_timeout.
- **Test**: Self-contained test file
- **Verification**: 0 data loss under concurrent writes

### Task 2: Read-write contention test
- **Files**: `tests/kernel/concurrency.test.ts` (modify)
- **Dependencies**: Task 1
- **Action**: Concurrent reads while writes in progress. Verify WAL isolation.
- **Test**: Self-contained
- **Verification**: Reads never see partial writes

### Task 3: Transaction nesting guard
- **Files**: `src/kernel/database.ts` (modify), `tests/kernel/concurrency.test.ts` (modify)
- **Dependencies**: Task 2
- **Action**: Add guard that detects nested transaction attempts and throws descriptive error.
- **Test**: `expect(() => nestedTransaction()).toThrow(/nested/i)`
- **Verification**: No silent deadlocks

---

## Plan 33-02: Memory Subsystem Contention (3 tasks)

### Task 4: Concurrent observation inserts
- **Files**: `tests/memory/concurrency.test.ts` (new)
- **Dependencies**: Task 1
- **Action**: 10 parallel `insertObservation()` calls. Verify all persist.
- **Test**: Count rows after parallel inserts
- **Verification**: Row count matches insert count

### Task 5: Concurrent retrieval under writes
- **Files**: `tests/memory/concurrency.test.ts` (modify)
- **Dependencies**: Task 4
- **Action**: Read `retrieveMemoryContext()` while writes in progress. Verify consistent results.
- **Test**: Retrieval returns stable results
- **Verification**: No FTS5 index corruption

### Task 6: Busy timeout retry wrapper
- **Files**: `src/kernel/retry.ts` (new), `tests/kernel/retry.test.ts` (new)
- **Dependencies**: Tasks 1-5
- **Action**: Generic `withRetry(fn, { maxRetries, backoff })` for SQLite busy_timeout exhaustion.
- **Test**: Mock busy_timeout failure, verify retry + eventual success
- **Verification**: Wrapper used in memory repository

---

## Success Criteria

- [ ] 20+ new concurrency tests passing
- [ ] No data loss under concurrent writes
- [ ] No deadlocks
- [ ] Busy timeout wrapper tested
- [ ] All tests pass