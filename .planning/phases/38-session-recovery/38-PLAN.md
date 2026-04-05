# Phase 38: Session Recovery System

**Goal**: 99% uptime through intelligent error recovery
**Depends on:** Phase 35 (background manager for task restart)
**Effort:** 2 plans, 6 tasks, ~2 days
**Risk:** MEDIUM — Recovery strategies must not cascade failures
**PR Increment:** Auto-recovery for common errors, manual recovery for edge cases

---

## Plan 38-01: Error Classification + Recovery (3 tasks)

### Task 1: Extended error classifier
- **Files:** `src/recovery/classifier.ts` (new), `src/recovery/types.ts` (new)
- **Dependencies:** Phase 32 (recovery types)
- **Action:** Extend fallback error classifier. New categories: `empty_content`, `thinking_block_error`, `tool_result_overflow`, `context_window_exceeded`, `session_corruption`, `agent_loop_stuck`.
- **Test:** `tests/recovery/classifier.test.ts` — all error types classified
- **Verification:** Every known error pattern maps to a category
- **Worktree:** No — additive module

### Task 2: Recovery strategy registry
- **Files:** `src/recovery/strategies.ts` (new)
- **Dependencies:** Task 1
- **Action:** Strategies: `retry_with_backoff`, `compact_and_retry`, `switch_model_and_retry`, `restart_session`, `reduce_context`, `skip_and_continue`. Pure functions: `(error, context) => RecoveryAction`.
- **Test:** `tests/recovery/strategies.test.ts` — each strategy produces valid action
- **Verification:** No strategy can trigger another strategy (no cascading)

### Task 3: Recovery orchestrator
- **Files:** `src/recovery/orchestrator.ts` (new), `src/recovery/index.ts` (new)
- **Dependencies:** Tasks 1-2
- **Action:** Top-level: classify error → select strategy → execute recovery → verify success. Max 3 attempts. Terminal fallback if exhausted.
- **Test:** `tests/recovery/orchestrator.test.ts` — full recovery lifecycle
- **Verification:** 3-attempt limit enforced

---

## Plan 38-02: Integration + Persistence (3 tasks)

### Task 4: Session state persistence
- **Files:** `src/recovery/persistence.ts` (new)
- **Dependencies:** Task 3
- **Action:** Persist session state to SQLite on every phase transition. On crash: load last state, determine recovery point, resume.
- **Test:** `tests/recovery/persistence.test.ts` — save/load round-trip
- **Verification:** State survives simulated crash (kill + restart)

### Task 5: Hook into event system
- **Files:** `src/index.ts` (modify), `src/recovery/event-handler.ts` (new)
- **Dependencies:** Task 4
- **Action:** Register recovery handler on `event` hook. On error events: classify → recover → resume. On session end: clean up recovery state.
- **Test:** `tests/recovery/event-handler.test.ts`
- **Verification:** Error events trigger recovery, not crashes

### Task 6: `oc_recover` tool
- **Files:** `src/tools/recover.ts` (new)
- **Dependencies:** Task 5
- **Action:** Manual recovery: `status` (show recovery state), `retry` (force retry), `reset` (clear recovery state), `history` (show recovery log).
- **Test:** `tests/tools/recover.test.ts`
- **Verification:** Manual recovery overrides work

---

## Success Criteria

- [ ] Extended error classifier works
- [ ] Recovery strategies defined
- [ ] Orchestrator handles 3-attempt limit
- [ ] Session state persists
- [ ] Error events trigger recovery
- [ ] `oc_recover` tool works
- [ ] All tests pass