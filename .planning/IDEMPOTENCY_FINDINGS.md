# Idempotency Audit: Key Findings & Action Items

## Overview

Systematic audit of all 8 phase handlers identified **3 critical idempotency gaps** that need hardening before production deployment. Most phases are already artifact-driven and safe, but BUILD phase has complex state mutations that create non-deterministic behavior on crash/resume.

---

## Critical Findings

### 🟡 MEDIUM: BUILD Phase Non-Idempotency

**Status**: MEDIUM RISK - Requires hardening

**Problem**: BUILD phase has 2 interacting idempotency failures (NOT 4):

1. **Task Result Deduplication Missing**
   - Issue: `processedResultIds` exists but is NOT used in BUILD handler
   - Impact: Replaying same task result increments strikes again
   - Example: Task 1 completes → review finds CRITICAL → strike count = 1
     - Replay same result → strike count = 2 (non-idempotent)
   - Location: `src/orchestrator/handlers/build.ts` lines 220-245
   - **Status:** REAL BUG - needs fix

2. **Strike Count Mutation on Replay**
   - Issue: `strikeCount` is incremented without checking if result already processed
   - Impact: Replaying review findings causes false strike accumulation
   - Code: `strikeCount: buildProgress.strikeCount + 1` (line 242)
   - Fix: Check `processedResultIds` before incrementing
   - **Status:** REAL BUG - needs fix

3. **Sequential Dispatch** (CORRECTED - NOT A RACE)
   - Issue: Tasks are dispatched sequentially, not in parallel
   - Code: `build.ts:434-454` explicitly shows "only the next task sequentially"
   - **Status:** NOT A BUG - previous claim was incorrect

4. **Review Result Parsing Non-Determinism**
   - Issue: JSON parsing of review findings is non-deterministic
   - Impact: Same agent output could parse differently on retry
   - Code: `hasCriticalFindings()` function (lines 116-138)
   - Risk: CRITICAL detection depends on JSON structure
   - **Status:** Needs investigation

**Hardening Steps**:
1. Use `processedResultIds` to deduplicate task results in BUILD handler
2. Check if result already processed before incrementing strike count
3. ~~Add wave-level locking~~ (NOT NEEDED - dispatch is already sequential)
4. Normalize review JSON before CRITICAL detection

**Files to Modify**:
- `src/orchestrator/handlers/build.ts` - Add result deduplication
- `src/tools/orchestrate.ts` - Extend `markResultProcessed()` to BUILD context
~~- `src/orchestrator/plan.ts` - Add wave-level locking mechanism~~ (NOT NEEDED - dispatch is already sequential)

---

### 🟡 MEDIUM: PLAN Phase Legacy Fallback

**Status**: MEDIUM RISK - Needs deprecation path

**Problem**: PLAN handler has legacy markdown fallback that creates non-deterministic behavior

1. **Non-Deterministic Task ID Generation**
   - Issue: Legacy markdown parsing can produce different task IDs on replay
   - Code: `loadTasksFromMarkdown()` (lines 38-88)
   - Impact: Same plan could produce different task IDs on resume
   - Example:
     - First run: tasks.md exists → parses to [Task 1, Task 2, Task 3]
     - Replay: tasks.md exists → parses to [Task 1, Task 2] (if parsing differs)

2. **Canonical Source Ambiguity**
   - Issue: Both tasks.json and tasks.md can exist; unclear which is canonical
   - Code: Tries JSON first, falls back to markdown (lines 136-144)
   - Impact: Inconsistent state if both files diverge

**Hardening Steps**:
1. Enforce tasks.json as canonical source
2. Deprecate tasks.md parsing (warn on legacy fallback)
3. Add deterministic task ID generation (hash-based)
4. Migrate all legacy planners to output tasks.json

**Files to Modify**:
- `src/orchestrator/handlers/plan.ts` - Remove markdown fallback
- `src/orchestrator/renderers/tasks-markdown.ts` - Keep for rendering only
- Add migration guide for legacy planners

---

### 🟡 MEDIUM: RETROSPECTIVE Phase Lesson Deduplication

**Status**: MEDIUM RISK - Needs idempotent persistence

**Problem**: Lesson persistence is best-effort but not idempotent

1. **No Deduplication on Replay**
   - Issue: Replaying same lessons could add duplicates to memory DB
   - Code: `saveLessonMemory()` (line 94) doesn't check for existing lessons
   - Impact: Memory DB could accumulate duplicate lessons over time

2. **Silent Persistence Failures**
   - Issue: Persistence errors are caught but silently swallowed (lines 95-104)
   - Impact: Lessons could be lost without user awareness
   - Code: Returns `complete` even if persistence fails

3. **Non-Deterministic JSON Parsing**
   - Issue: Same agent output could parse differently on retry
   - Code: `parseAndValidateLessons()` (lines 22-58)
   - Impact: Different lessons extracted on replay

**Hardening Steps**:
1. Add lesson deduplication by hash or timestamp
2. Explicit error handling (don't silently swallow)
3. Normalize JSON before validation
4. Check if lessons already exist before persisting

**Files to Modify**:
- `src/orchestrator/handlers/retrospective.ts` - Add deduplication
- `src/orchestrator/lesson-memory.ts` - Add hash-based deduplication
- `src/orchestrator/lesson-schemas.ts` - Add lesson hash field

---

## Low-Risk Phases (No Action Needed)

### ✅ RECON, CHALLENGE, ARCHITECT, EXPLORE, SHIP

All these phases are **artifact-driven** and already idempotent:
- Artifact existence is the source of truth
- Same state → same dispatch → same artifact path
- Safe to resume and replay

**No hardening needed** - these phases are production-ready.

---

## Cross-Phase Patterns

### ✅ State Revision & Conflict Detection

**Status**: WORKING CORRECTLY

- `stateRevision` field prevents concurrent writes
- Kernel DB enforces optimistic locking
- No action needed

### ⚠️ Processed Result IDs

**Status**: PARTIALLY USED

- Mechanism exists but not used in BUILD phase
- Action: Extend to BUILD phase for task result deduplication

---

## Testing Recommendations

### Unit Tests (Add to test suite)

1. **BUILD Phase Idempotency**
   ```typescript
   // Test: Replaying same task result doesn't increment strikes
   // Test: Replaying same review finding doesn't re-dispatch
   // Test: Sequential dispatch is preserved on resume
   ```

2. **PLAN Phase Determinism**
   ```typescript
   // Test: Same plan → same task IDs on replay
   // Test: tasks.json is canonical source
   ```

3. **RETROSPECTIVE Phase Deduplication**
   ```typescript
   // Test: Replaying same lessons doesn't duplicate
   // Test: Persistence failures are explicit
   ```

### Integration Tests (Add to CI)

1. **Crash/Resume Scenarios**
   - Crash during BUILD wave 1 → resume → verify no re-dispatch
   - Crash during PLAN → resume → verify deterministic task IDs
   - Crash during RETROSPECTIVE → resume → verify no duplicate lessons

2. **Replay Scenarios**
   - Replay all phase results → verify deterministic output
   - Replay BUILD results → verify strike count doesn't increment

---

## Implementation Priority

### P0 (Immediate - Before Production)
1. BUILD phase task result deduplication
2. Strike count idempotency check
~~3. Wave-level locking mechanism~~ (NOT NEEDED - dispatch is already sequential)

### P1 (Short-term - Next Sprint)
1. PLAN phase legacy markdown deprecation
2. RETROSPECTIVE phase lesson deduplication
3. Crash recovery testing

### P2 (Long-term - Future)
1. Deterministic review JSON parsing
2. Comprehensive replay test suite
3. Idempotency observability metrics

---

## Code Locations

### BUILD Phase (High Priority)
- Handler: `src/orchestrator/handlers/build.ts`
- State: `src/orchestrator/types.ts` (BuildProgress)
- Orchestrate: `src/tools/orchestrate.ts` (markResultProcessed)

### PLAN Phase (Medium Priority)
- Handler: `src/orchestrator/handlers/plan.ts`
- Schemas: `src/orchestrator/schemas.ts` (taskSchema)
- Artifacts: `src/orchestrator/contracts/phase-artifacts.ts`

### RETROSPECTIVE Phase (Medium Priority)
- Handler: `src/orchestrator/handlers/retrospective.ts`
- Memory: `src/orchestrator/lesson-memory.ts`
- Schemas: `src/orchestrator/lesson-schemas.ts`

---

## Success Criteria

### BUILD Phase Hardening
- [ ] `processedResultIds` used to deduplicate task results
- [ ] Strike count only increments on first processing
- [x] ~~Wave-level locking prevents concurrent dispatch~~ (NOT NEEDED - already sequential)
- [ ] Crash/resume tests pass

### PLAN Phase Hardening
- [ ] tasks.json enforced as canonical
- [ ] tasks.md parsing deprecated with warning
- [ ] Task IDs deterministic on replay
- [ ] Legacy planner migration guide published

### RETROSPECTIVE Phase Hardening
- [ ] Lessons deduplicated by hash
- [ ] Persistence failures explicit (not silent)
- [ ] Replay tests pass
- [ ] No duplicate lessons in memory DB

---

## References

- Full matrix: `.planning/IDEMPOTENCY_MATRIX.md`
- Phase handlers: `src/orchestrator/handlers/`
- State management: `src/orchestrator/state.ts`
- Orchestration: `src/tools/orchestrate.ts`
