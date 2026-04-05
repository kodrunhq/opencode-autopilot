# Phase 36: Autonomy Loop (Ralph)

**Goal**: Agent loops autonomously until task is done with verification
**Depends on**: Phase 35 (background manager)
**Effort**: 2 plans, 6 tasks, ~2 days
**Risk**: MEDIUM — Loop termination must be provably correct
**PR Increment**: `oc_loop` tool, agents can loop until done

---

## Plan 36-01: Loop Controller (3 tasks)

### Task 1: Loop state machine
- **Files**: `src/autonomy/state.ts` (new), `src/autonomy/types.ts` (new)
- **Dependencies**: Phase 35
- **Action**: States: idle, running, verifying, complete, failed, max_iterations. Transitions with iteration counter.
- **Test**: `tests/autonomy/state.test.ts` — all transitions, max iteration guard
- **Verification**: Loop ALWAYS terminates (max iterations is hard ceiling)
- **Worktree**: Yes — `wt/autonomy`

### Task 2: Completion detector
- **Files**: `src/autonomy/completion.ts` (new)
- **Dependencies**: Task 1
- **Action**: Analyze transcript for completion signals: explicit "done", all todos completed, no remaining actions. Return confidence (0-1).
- **Test**: `tests/autonomy/completion.test.ts` — various transcript patterns
- **Verification**: False positive rate < 5% on test corpus

### Task 3: Verification handler
- **Files**: `src/autonomy/verification.ts` (new)
- **Dependencies**: Task 2
- **Action:** Post-loop verification: run `bun test`, check lint, validate artifacts. On failure → re-enter loop with failure context.
- **Test**: `tests/autonomy/verification.test.ts` — pass/fail paths
- **Verification:** Verification failure triggers re-entry

---

## Plan 36-02: Loop Tool + Integration (3 tasks)

### Task 4: Loop controller orchestration
- **Files**: `src/autonomy/controller.ts` (new), `src/autonomy/index.ts` (new)
- **Dependencies**: Tasks 1-3
- **Action**: `start(task, options)`, `pause()`, `resume()`, `abort()`. Wires state machine + completion + verification.
- **Test**: `tests/autonomy/controller.test.ts`
- **Verification**: Full loop lifecycle: start → iterate → detect complete → verify → done

### Task 5: `oc_loop` tool
- **Files**: `src/tools/loop.ts` (new)
- **Dependencies**: Task 4
- **Action**: Tool actions: `status`, `abort`. Configurable: maxIterations, verifyOnComplete, cooldownMs.
- **Test**: `tests/tools/loop.test.ts`
- **Verification**: Loop respects max iterations

### Task 6: System prompt injection for loop context
- **Files**: `src/autonomy/injector.ts` (new), `src/index.ts` (modify)
- **Dependencies**: Task 5
- **Action**: Inject loop state via `experimental.chat.system.transform`: current iteration, remaining iterations, accumulated context.
- **Test**: `tests/autonomy/injector.test.ts`
- **Verification**: Agent sees loop context in system prompt

---

## Success Criteria

- [ ] Loop state machine defined
- [ ] Completion detector works
- [ ] Verification triggers re-entry on failure
- [ ] Controller orchestrates lifecycle
- [ ] `oc_loop` tool works
- [ ] Loop context injected
- [ ] Max iterations enforced (hard ceiling)
- [ ] All tests pass