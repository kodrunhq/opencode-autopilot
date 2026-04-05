# Phase 40: UX/UI Surfaces

**Goal:** Toast notifications, progress tracking, task status visibility
**Depends on:** Phase 35 (background tasks need status), Phase 34 (logging)
**Effort:** 2 plans, 6 tasks, ~1.5 days
**Risk:** LOW — UX is additive, uses existing hook system
**PR Increment:** Toast on key events, progress for long operations, session summary

---

## Plan 40-01: Notification System (3 tasks)

### Task 1: Toast notification infrastructure
- **Files:** `src/ux/notifications.ts` (new), `src/ux/types.ts` (new), `src/ux/index.ts` (new)
- **Dependencies:** Phase 34 (logging)
- **Action:** Centralized notification system. Toast types: info, success, warning, error. Delivered via tool `context.metadata()` or system prompt injection. Rate-limited (max 1 toast per 5 seconds per type).
- **Test:** `tests/ux/notifications.test.ts` — rate limiting works
- **Verification:** Toasts display in OpenCode UI
- **Worktree:** No — additive module

### Task 2: Progress tracking
- **Files:** `src/ux/progress.ts` (new)
- **Dependencies:** Task 1
- **Action:** Long-running operations report progress: phase transitions, review pipeline stages, background task completion. Format: `[2/8] Building wave 3...`
- **Test:** `tests/ux/progress.test.ts` — progress format correct
- **Verification:** Phase transitions show progress

### Task 3: Background task status display
- **Files:** `src/ux/task-status.ts` (new)
- **Dependencies:** Tasks 1-2
- **Action:** Background task summary: active count, queue depth, recent completions. Injected into system prompt so agent sees task landscape.
- **Test:** `tests/ux/task-status.test.ts`
- **Verification:** Agent can see running background tasks

---

## Plan 40-02: Session Experience (3 tasks)

### Task 4: Session summary generator
- **Files:** `src/ux/session-summary.ts` (new)
- **Dependencies:** Tasks 1-3
- **Action:** On session end: generate summary of work done, tokens used, phases completed, errors encountered, lessons learned. Format as structured markdown.
- **Test:** `tests/ux/session-summary.test.ts`
- **Verification:** Summary includes all key metrics

### Task 5: Context utilization warnings
- **Files:** `src/ux/context-warnings.ts` (new)
- **Dependencies:** Task 1
- **Action:** Toast when context utilization > 70%, > 85%, > 95%. Suggest compaction at 85%. Force compaction at 95%.
- **Test:** `tests/ux/context-warnings.test.ts` — thresholds trigger correctly
- **Verification:** Warning toast appears at correct utilization levels

### Task 6: Error remediation hints
- **Files:** `src/ux/error-hints.ts` (new)
- **Dependencies:** Task 1
- **Action:** When errors occur: append remediation hint to error message. "Rate limited → waiting 30s, will retry" instead of just "429 Too Many Requests".
- **Test:** `tests/ux/error-hints.test.ts`
- **Verification:** Errors include actionable next steps

---

## Success Criteria

- [ ] Toast notification system works
- [ ] Progress tracking shows phase transitions
- [ ] Background task status displayed
- [ ] Session summary generated on completion
- [ ] Context utilization warnings work
- [ ] Error remediation hints work
- [ ] All tests pass