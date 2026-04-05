# Determinism & Idempotency Matrix

## Executive Summary

This matrix audits each phase handler for idempotency, resume safety, replay guarantees, and concurrency constraints. **Key finding**: Most phases are artifact-driven (idempotent on resume), but BUILD has complex state mutations that need hardening.

---

## Matrix: Phase-by-Phase Analysis

| Phase | Resume Behavior | Replay Guarantee | Concurrency | State Mutations | Side Effects | Idempotent? | Risk Level |
|-------|-----------------|------------------|-------------|-----------------|--------------|-------------|-----------|
| **RECON** | Checks artifact existence; re-dispatches if missing | ✅ Deterministic (file-based) | Sequential only | Writes `RECON/report.md` | Dispatches oc-researcher | ✅ YES | 🟢 LOW |
| **CHALLENGE** | Checks artifact existence; re-dispatches if missing | ✅ Deterministic (file-based) | Sequential only | Writes `CHALLENGE/brief.md` | Dispatches oc-challenger | ✅ YES | 🟢 LOW |
| **ARCHITECT** | 3-step arena: proposals → critic → complete (artifact-driven) | ✅ Deterministic (file-based) | Sequential only | Writes proposals, critique, or design | Dispatches architect(s) or critic | ✅ YES | 🟢 LOW |
| **EXPLORE** | Skipped (not implemented) | ✅ Deterministic (no-op) | N/A | None | None | ✅ YES | 🟢 LOW |
| **PLAN** | Loads tasks from JSON/markdown; writes normalized JSON | ⚠️ Partial (legacy fallback) | Sequential only | Writes `PLAN/tasks.json` + `PLAN/tasks.md` | Dispatches oc-planner | ⚠️ MOSTLY | 🟡 MEDIUM |
| **BUILD** | Wave-based task dispatch; strike tracking; review cycles | ❌ Complex (state-dependent) | Sequential dispatch (NOT parallel) | Mutates task status, strikes, wave assignments | Dispatches implementer/reviewer; modifies branch | ❌ NO | 🟡 MEDIUM |
| **SHIP** | Checks artifact existence; re-dispatches if missing | ✅ Deterministic (file-based) | Sequential only | Writes walkthrough, decisions, changelog | Dispatches oc-shipper | ✅ YES | 🟢 LOW |
| **RETROSPECTIVE** | Parses lessons; persists to memory (best-effort) | ⚠️ Partial (parse errors graceful) | Sequential only | Writes lessons to memory DB | Dispatches oc-retrospector; persists lessons | ⚠️ MOSTLY | 🟡 MEDIUM |

---

## Detailed Phase Analysis

### 1. RECON Phase

**Handler**: `handleRecon()`

**Resume Behavior**:
- On first call: Ensures phase dir, dispatches oc-researcher
- On resume (result provided): Checks if `RECON/report.md` exists
  - If exists: Returns `complete`
  - If missing: Warns but still completes (best-effort)

**Replay Guarantee**: ✅ **DETERMINISTIC**
- Artifact existence is the source of truth
- Same input (idea) → same dispatch → same artifact path
- No random state involved

**Concurrency**: Sequential only
- Single researcher agent per run
- No parallel dispatch

**State Mutations**:
- Writes `RECON/report.md` (via agent)
- No state.json mutations in handler

**Side Effects**:
- Dispatches oc-researcher agent
- Agent writes artifact to disk

**Idempotency**: ✅ **YES**
- Calling twice with same state: first call dispatches, second call completes
- Safe to replay: artifact existence check prevents re-dispatch

**Risk**: 🟢 **LOW**

---

### 2. CHALLENGE Phase

**Handler**: `handleChallenge()`

**Resume Behavior**:
- On first call: Ensures phase dir, dispatches oc-challenger
- On resume (result provided): Checks if `CHALLENGE/brief.md` exists
  - If exists: Returns `complete`
  - If missing: Warns but still completes

**Replay Guarantee**: ✅ **DETERMINISTIC**
- Artifact existence is the source of truth
- References RECON artifact (immutable)
- Same input → same dispatch

**Concurrency**: Sequential only
- Single challenger agent per run

**State Mutations**:
- Writes `CHALLENGE/brief.md` (via agent)
- No state.json mutations

**Side Effects**:
- Dispatches oc-challenger agent
- Agent writes artifact to disk

**Idempotency**: ✅ **YES**
- Artifact existence check prevents re-dispatch
- Safe to replay

**Risk**: 🟢 **LOW**

---

### 3. ARCHITECT Phase

**Handler**: `handleArchitect()`

**Resume Behavior**: 3-step arena flow (artifact-driven)
1. **Step 1** (no proposals/design): Dispatch architect(s) based on confidence depth
   - Depth 1: Single architect
   - Depth 2-3: Multiple architects (A, B, C proposals)
2. **Step 2** (proposals exist, no critique): Dispatch critic
3. **Step 3** (critique or design exists): Complete

**Replay Guarantee**: ✅ **DETERMINISTIC**
- Artifact existence determines step
- Confidence depth is deterministic (from RECON)
- Same state → same step → same dispatch

**Concurrency**: Sequential (within phase)
- Step 1: Can dispatch multiple architects in parallel (dispatch_multi)
- Step 2: Single critic
- Step 3: Complete

**State Mutations**:
- Writes `ARCHITECT/proposals/proposal-A.md`, etc. (via agents)
- Writes `ARCHITECT/critique.md` or `ARCHITECT/design.md` (via agents)
- No state.json mutations

**Side Effects**:
- Dispatches architect(s) or critic
- Agents write artifacts to disk

**Idempotency**: ✅ **YES**
- Artifact existence check prevents re-dispatch
- Safe to replay: same confidence depth → same dispatch

**Risk**: 🟢 **LOW**

---

### 4. EXPLORE Phase

**Handler**: `handleExplore()`

**Resume Behavior**:
- Always returns `complete` (not implemented)

**Replay Guarantee**: ✅ **DETERMINISTIC**
- No-op phase

**Concurrency**: N/A

**State Mutations**: None

**Side Effects**: None

**Idempotency**: ✅ **YES**

**Risk**: 🟢 **LOW**

---

### 5. PLAN Phase

**Handler**: `handlePlan()`

**Resume Behavior**:
- On first call: Dispatches oc-planner to write `PLAN/tasks.json`
- On resume (result provided):
  1. Tries to load `PLAN/tasks.json` (canonical)
  2. Falls back to `PLAN/tasks.md` (legacy)
  3. Normalizes and validates tasks
  4. If used legacy markdown: writes normalized `PLAN/tasks.json`
  5. If used JSON: renders and writes `PLAN/tasks.md`
  6. Returns `complete` with tasks in state

**Replay Guarantee**: ⚠️ **PARTIAL**
- **Deterministic if**: tasks.json exists and is valid
- **Non-deterministic if**: only tasks.md exists (parsing may vary)
- **Risk**: Legacy markdown parsing could produce different task IDs on replay

**Concurrency**: Sequential only
- Single planner agent

**State Mutations**:
- Writes `PLAN/tasks.json` (canonical)
- Writes `PLAN/tasks.md` (derived)
- **Mutates state.tasks** (loaded from artifact)
- Increments state.stateRevision

**Side Effects**:
- Dispatches oc-planner agent
- Agent writes tasks.json to disk
- Handler writes tasks.md (derived)

**Idempotency**: ⚠️ **MOSTLY**
- **Safe if**: tasks.json exists (artifact-driven)
- **Unsafe if**: only tasks.md exists (parsing side effects)
- **Issue**: Legacy fallback could produce different task IDs on replay

**Risk**: 🟡 **MEDIUM**

**Hardening needed**:
- Enforce tasks.json as canonical source
- Deprecate tasks.md parsing
- Add deterministic task ID generation

---

### 6. BUILD Phase

**Handler**: `handleBuild()`

**Resume Behavior**: Complex state machine with 3 cases
1. **No result, no review pending**: Find first pending wave, dispatch task
2. **Result provided, review pending**: Process review findings
   - If CRITICAL: Re-dispatch implementer with fixes (increment strikes)
   - If clean: Advance to next wave
3. **Result provided, not review pending**: Mark task done, trigger review if wave complete

**Replay Guarantee**: ❌ **NOT DETERMINISTIC**
- **Issues**:
  1. Wave assignment via `assignWaves()` is deterministic but depends on task.depends_on
  2. Strike count is mutable and persisted (non-idempotent)
  3. Task status mutations (PENDING → IN_PROGRESS → DONE) are order-dependent
  4. Review result parsing is non-deterministic (JSON parsing of agent output)
  5. ~~Concurrent wave execution creates race conditions on resume~~ (CORRECTED: Dispatch is sequential)

**Concurrency**: Sequential dispatch (NOT parallel)
- Tasks dispatched one at a time: "only the next task sequentially" (`build.ts:434-454`)
- **No race condition**: Sequential dispatch means no concurrent task execution
- **Idempotency issue**: Replay may re-dispatch already-completed tasks (deduplication needed)

**State Mutations**:
- Mutates `state.tasks[].status` (PENDING → IN_PROGRESS → DONE)
- Mutates `state.buildProgress.strikeCount` (incremented on CRITICAL)
- Mutates `state.buildProgress.currentTask` (tracks active task)
- Mutates `state.buildProgress.currentWave` (tracks active wave)
- Mutates `state.buildProgress.reviewPending` (boolean flag)
- Increments `state.stateRevision`

**Side Effects**:
- Dispatches oc-implementer (writes code to branch)
- Dispatches oc-reviewer (reads branch, produces findings)
- **Modifies git branch** (code changes are persisted)
- Parses review JSON (non-deterministic)

**Idempotency**: ❌ **NO**
- **Problem 1**: Task status mutations are not idempotent
  - Calling twice: first marks DONE, second tries to mark DONE again (safe but wasteful)
  - On crash/resume: may re-dispatch already-completed tasks
- **Problem 2**: Strike count is mutable
  - Replaying same review result increments strikes again
  - Non-idempotent: `strikeCount + 1` on each replay
- ~~**Problem 3**: Concurrent waves create TOCTOU race~~ (CORRECTED: Dispatch is sequential)
- **Problem 3**: Task result deduplication needed
  - Same task result replayed increment strikes multiple times
  - Need to track already-processed results
- **Problem 4**: Review result parsing is non-deterministic
  - Same agent output could parse differently on retry
  - CRITICAL detection depends on JSON structure

**Risk**: 🟡 **MEDIUM** (downgraded from HIGH after sequential dispatch confirmed)

**Hardening needed**:
1. **Idempotent task completion**: Use `processedResultIds` to deduplicate task results
2. **Immutable strike tracking**: Don't increment on replay; check if result already processed
~~3. **Wave-level locking**: Prevent concurrent task dispatch within same wave~~ (NOT NEEDED - already sequential)
3. **Deterministic review parsing**: Normalize JSON before CRITICAL detection
4. **Crash recovery**: On resume, check git branch state vs. task status
5. **Replay safety**: Detect if task result was already applied to branch

---

### 7. SHIP Phase

**Handler**: `handleShip()`

**Resume Behavior**:
- On first call: Dispatches oc-shipper to write walkthrough, decisions, changelog
- On resume (result provided): Returns `complete`

**Replay Guarantee**: ✅ **DETERMINISTIC**
- References immutable prior artifacts
- Same input → same dispatch

**Concurrency**: Sequential only
- Single shipper agent

**State Mutations**:
- Writes `SHIP/walkthrough.md`, `SHIP/decisions.md`, `SHIP/changelog.md` (via agent)
- No state.json mutations

**Side Effects**:
- Dispatches oc-shipper agent
- Agent writes artifacts to disk

**Idempotency**: ✅ **YES**
- Safe to replay: no artifact existence check needed (shipper always writes)
- Deterministic: same prior artifacts → same output

**Risk**: 🟢 **LOW**

---

### 8. RETROSPECTIVE Phase

**Handler**: `handleRetrospective()`

**Resume Behavior**:
- On first call: Dispatches oc-retrospector to extract lessons
- On resume (result provided):
  1. Parses JSON lessons from agent output
  2. Validates each lesson against schema
  3. Persists valid lessons to memory DB (best-effort)
  4. Returns `complete` (even if persistence fails)

**Replay Guarantee**: ⚠️ **PARTIAL**
- **Deterministic if**: JSON parsing succeeds
- **Non-deterministic if**: JSON parsing fails (graceful degradation)
- **Risk**: Same agent output could parse differently on retry

**Concurrency**: Sequential only
- Single retrospector agent

**State Mutations**:
- Writes lessons to memory DB (via `saveLessonMemory()`)
- No state.json mutations

**Side Effects**:
- Dispatches oc-retrospector agent
- Agent writes JSON lessons
- Handler persists to memory DB (SQLite)
- **Problem**: Persistence is best-effort; failures are silently swallowed

**Idempotency**: ⚠️ **MOSTLY**
- **Safe if**: JSON parsing succeeds (lessons are idempotent)
- **Unsafe if**: Persistence fails and is retried (could duplicate lessons)
- **Issue**: No deduplication in memory DB; replaying could add duplicate lessons

**Risk**: 🟡 **MEDIUM**

**Hardening needed**:
1. **Idempotent lesson persistence**: Use lesson hash or timestamp to deduplicate
2. **Deterministic JSON parsing**: Normalize before validation
3. **Explicit error handling**: Don't silently swallow persistence errors
4. **Replay safety**: Check if lessons already exist before persisting

---

## Cross-Phase Patterns

### State Revision & Conflict Detection

**Mechanism**: `stateRevision` field + kernel DB optimistic locking
- Each state save increments `stateRevision`
- Kernel DB enforces `expectedRevision` check
- **Prevents**: Concurrent writes from overwriting each other

**Idempotency Impact**:
- ✅ Prevents lost updates
- ❌ Doesn't prevent duplicate processing (see BUILD phase)

### Processed Result IDs

**Mechanism**: `processedResultIds` array (capped at 5000)
- Tracks which result IDs have been processed
- Prevents duplicate result processing

**Idempotency Impact**:
- ✅ Prevents duplicate dispatch processing
- ❌ Not used in BUILD phase (task status mutations are not deduplicated)

### Artifact-Driven Completion

**Pattern**: Most phases check artifact existence to determine completion
- RECON, CHALLENGE, ARCHITECT, SHIP: artifact-driven
- PLAN, RETROSPECTIVE: partial artifact-driven

**Idempotency Impact**:
- ✅ Safe to resume: artifact existence is source of truth
- ✅ Safe to replay: same state → same artifact path → same completion

---

## Concurrency Boundaries

### Sequential Phases
- RECON, CHALLENGE, ARCHITECT (within step), EXPLORE, PLAN, SHIP, RETROSPECTIVE
- Single agent dispatch per phase
- Safe to run sequentially

### Parallel Phases
- **BUILD**: ~~Waves can run in parallel~~ (CORRECTED: Dispatch is sequential)
  - Tasks dispatched one at a time
  - Wave sequencing still applies (wave N tasks before wave N+1)
  - **Issue**: Strike count and task status need idempotency (not a race)

### Concurrency Constraints
- **No cross-phase parallelism**: Phases must complete sequentially
- **No cross-run parallelism**: Only one run per project at a time
- **Sequential dispatch**: Tasks dispatched one at a time (not parallel)

---

## Idempotency Gaps & Hardening Plan

### Critical Issues (🟡 MEDIUM - downgraded after sequential dispatch confirmed)

**BUILD Phase**:
1. **Task result deduplication**: Use `processedResultIds` to prevent re-processing
2. **Strike count idempotency**: Don't increment on replay; check if result already processed
~~3. **Wave-level locking**: Prevent concurrent task dispatch within same wave~~ (NOT NEEDED - already sequential)
3. **Crash recovery**: Detect if task result was already applied to branch

### Medium Issues (🟡 MEDIUM)

**PLAN Phase**:
1. **Legacy markdown deprecation**: Enforce tasks.json as canonical
2. **Deterministic task ID generation**: Ensure same tasks → same IDs on replay

**RETROSPECTIVE Phase**:
1. **Idempotent lesson persistence**: Deduplicate by hash or timestamp
2. **Explicit error handling**: Don't silently swallow persistence errors

### Low Issues (🟢 LOW)

**RECON, CHALLENGE, ARCHITECT, EXPLORE, SHIP**:
- Already artifact-driven and idempotent
- No hardening needed

---

## Replay Safety Matrix

| Phase | Replay Safe? | Conditions | Notes |
|-------|-------------|-----------|-------|
| RECON | ✅ YES | Always | Artifact-driven |
| CHALLENGE | ✅ YES | Always | Artifact-driven |
| ARCHITECT | ✅ YES | Always | Artifact-driven |
| EXPLORE | ✅ YES | Always | No-op |
| PLAN | ⚠️ MOSTLY | tasks.json exists | Legacy markdown fallback is non-deterministic |
| BUILD | ❌ NO | Never | State mutations are not idempotent |
| SHIP | ✅ YES | Always | Artifact-driven |
| RETROSPECTIVE | ⚠️ MOSTLY | JSON parses | Persistence is best-effort |

---

## Resume Safety Matrix

| Phase | Resume Safe? | Conditions | Notes |
|-------|-------------|-----------|-------|
| RECON | ✅ YES | Always | Artifact existence check |
| CHALLENGE | ✅ YES | Always | Artifact existence check |
| ARCHITECT | ✅ YES | Always | Artifact existence check (3-step) |
| EXPLORE | ✅ YES | Always | No-op |
| PLAN | ✅ YES | Always | Loads from artifact |
| BUILD | ⚠️ MOSTLY | No concurrent tasks | May re-dispatch in-progress tasks |
| SHIP | ✅ YES | Always | Artifact-driven |
| RETROSPECTIVE | ✅ YES | Always | Graceful degradation on parse error |

---

## Recommendations

### Immediate (P0)
1. **BUILD phase hardening**: Implement task result deduplication using `processedResultIds`
2. **Strike count idempotency**: Check if result already processed before incrementing
~~3. **Wave-level locking**: Add distributed lock to prevent concurrent task dispatch~~ (NOT NEEDED - already sequential)

### Short-term (P1)
1. **PLAN phase**: Deprecate tasks.md parsing; enforce tasks.json
2. **RETROSPECTIVE phase**: Add lesson deduplication by hash
3. **Crash recovery**: Add git branch state validation in BUILD resume

### Long-term (P2)
1. **Deterministic review parsing**: Normalize JSON before CRITICAL detection
2. **Comprehensive replay testing**: Add test suite for all phases
3. **Observability**: Add idempotency metrics to orchestration logger
