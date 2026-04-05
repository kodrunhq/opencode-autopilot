# Phase 30: UX Visibility

**Goal**: Show users what's happening - phase progress, task status, summaries
**Depends on**: Phase 29 (Determinism Guarantee)
**Effort**: 2 plans, 7 tasks, ~1 day
**Risk**: LOW — Additive features, no behavioral changes
**PR Increment**: Phase progress strings, session summary, context utilization display

---

## Plan 30-01: Progress Indicators (4 tasks)

### Task 1: Phase progress during execution
- **Files**: `src/orchestrator/progress.ts` (new)
- **Dependencies**: Phase 29 complete
- **Action**: Create progress string generator: `[2/8] Building wave 3...`. Derive from current phase and wave.
- **Test**: `tests/orchestrator/progress.test.ts` — progress strings correct
- **Verification**: Phase progress visible during execution
- **Worktree**: No — additive module

### Task 2: Hook progress into phase handlers
- **Files**: `src/orchestrator/handlers/*.ts` (modify)
- **Dependencies**: Task 1
- **Action**: Each handler calls `progress.report(phase, wave, task)`. Progress stored in state.
- **Test**: `tests/orchestrator/handlers/progress.test.ts` — progress updates correctly
- **Verification**: Progress state updated on each phase transition

### Task 3: Context utilization display
- **Files**: `src/observability/context-display.ts` (new)
- **Dependencies**: Task 2
- **Action**: Display context budget: `[35% used] 6500 / 20000 tokens`. Inject into system prompt or toast.
- **Test**: `tests/observability/context-display.test.ts` — utilization calculated correctly
- **Verification**: Users see context utilization

### Task 4: Error context enrichment
- **Files**: `src/orchestrator/error-context.ts` (new)
- **Dependencies**: Task 3
- **Action**: On error, include phase, wave, task, recent actions in error message.
- **Test**: `tests/orchestrator/error-context.test.ts` — errors have context
- **Verification**: Error messages include phase context

---

## Plan 30-02: Session Summary (3 tasks)

### Task 5: Session summary generator
- **Files**: `src/ux/session-summary.ts` (new)
- **Dependencies**: Phases 1-4
- **Action**: On session end, generate summary: phases completed, tokens used, errors encountered, lessons learned.
- **Test**: `tests/ux/session-summary.test.ts` — summary includes all key metrics
- **Verification**: Session summary generated on completion

### Task 6: Hook into session lifecycle
- **Files**: `src/index.ts` (modify)
- **Dependencies**: Task 5
- **Action**: On `session.end` event, call `generateSessionSummary()`. Display via toast or save to file.
- **Test**: `tests/integration/session-summary.test.ts` — summary displayed on end
- **Verification**: Users see summary when session ends

### Task 7: Summary command
- **Files**: `src/tools/summary.ts` (new)
- **Dependencies**: Task 6
- **Action**: `oc_summary` command: show session summary on demand.
- **Test**: `tests/tools/summary.test.ts` — command returns summary
- **Verification**: Users can request summary anytime

---

## Success Criteria

- [ ] Phase progress strings visible during execution
- [ ] Context utilization displayed
- [ ] Errors include phase context
- [ ] Session summary generated on completion
- [ ] `oc_summary` command works
- [ ] All tests pass