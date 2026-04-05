# Phase 35: Background Agent Manager

**Goal**: Enable parallel task execution with up to 5 concurrent background agents
**Depends on**: Phase 32 (types), Phase 33 (concurrency proven), Phase 34 (logging)
**Effort**: 3 plans, 8 tasks, ~3 days
**Risk**: HIGH — Core new subsystem, concurrency is complex
**PR Increment**: `oc_background` tool functional, can spawn/monitor/cancel tasks

---

## Plan 35-01: Task Persistence Layer (3 tasks)

### Task 1: Background tasks SQLite table
- **Files**: `src/background/database.ts` (new), `src/kernel/migrations.ts` (modify)
- **Dependencies**: Phase 33 (retry wrapper)
- **Action**: Add `background_tasks` table: id, session_id, description, category, status (pending/running/completed/failed/cancelled), result, created_at, updated_at, agent, model.
- **Test**: `tests/background/database.test.ts` — CRUD operations, status transitions
- **Verification**: Schema migration idempotent, all status transitions valid
- **Worktree**: Yes — `wt/background`

### Task 2: Task repository with concurrency control
- **Files**: `src/background/repository.ts` (new)
- **Dependencies**: Task 1
- **Action**: `createTask()`, `updateStatus()`, `getActiveTasks()`, `getTaskResult()`, `cancelTask()`. Enforce max concurrent limit.
- **Test**: `tests/background/repository.test.ts` — concurrent creates respect limit
- **Verification**: `maxConcurrent` enforced at repository level

### Task 3: Task lifecycle state machine
- **Files**: `src/background/state-machine.ts` (new)
- **Dependencies**: Task 2
- **Action**: Valid transitions: pending→running, running→completed, running→failed, running→cancelled. Invalid transitions throw.
- **Test**: `tests/background/state-machine.test.ts` — all valid/invalid transitions
- **Verification**: State machine is pure, fully tested

---

## Plan 35-02: Agent Executor (3 tasks)

### Task 4: Agent slot manager
- **Files**: `src/background/slot-manager.ts` (new)
- **Dependencies**: Tasks 1-3
- **Action**: Manage N concurrent agent slots. Queue tasks when full. Emit events on slot acquire/release.
- **Test**: `tests/background/slot-manager.test.ts` — queue behavior, slot limits
- **Verification**: Never exceeds `maxConcurrent` slots

### Task 5: Background task executor
- **Files**: `src/background/executor.ts` (new)
- **Dependencies**: Task 4
- **Action**: Execute single background task: create agent context, run prompt, capture result, update status. Handle timeouts and errors.
- **Test**: `tests/background/executor.test.ts` — success, failure, timeout, cancellation
- **Verification**: All 4 paths tested

### Task 6: Background manager orchestration
- **Files**: `src/background/manager.ts` (new), `src/background/index.ts` (new)
- **Dependencies**: Tasks 4-5
- **Action**: Top-level: `spawn()`, `monitor()`, `cancel()`, `cancelAll()`, `list()`. Wires slot manager + executor + repository.
- **Test**: `tests/background/manager.test.ts` — full lifecycle
- **Verification**: spawn → monitor → complete lifecycle works

---

## Plan 35-03: Tool + Hook Integration (2 tasks)

### Task 7: `oc_background` tool
- **Files**: `src/tools/background.ts` (new)
- **Dependencies**: Task 6
- **Action**: Tool actions: `spawn`, `status`, `list`, `cancel`, `result`. Follows `*Core` pattern.
- **Test**: `tests/tools/background.test.ts`
- **Verification**: All 5 actions work through tool interface

### Task 8: Event hook integration
- **Files**: `src/index.ts` (modify)
- **Dependencies**: Task 7
- **Action**: Register background tool. Add event handler for task completion (toast notification). Cleanup on session end.
- **Test**: `tests/index.test.ts` — background tool registered
- **Verification**: Plugin loads with background manager

---

## Success Criteria

- [ ] Background tasks table created
- [ ] Repository with concurrency control
- [ ] State machine valid transitions
- [ ] Slot manager handles queuing
- [ ] Executor handles all paths
- [ ] Manager orchestrates lifecycle
- [ ] `oc_background` tool works
- [ ] Toast on task complete
- [ ] All tests pass