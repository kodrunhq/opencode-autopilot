# Phase 39: Context Injection System

**Goal:** Auto-discover and inject AGENTS.md, README.md, and hierarchical directory context
**Depends on:** Phase 36 (autonomy needs context), Phase 34 (logging)
**Effort:** 2 plans, 5 tasks, ~1.5 days
**Risk:** LOW — Additive injection, best-effort semantics
**PR Increment:** AGENTS.md and README.md auto-injected, re-injected after compaction

---

## Plan 39-01: Context Discovery (3 tasks)

### Task 1: File discovery engine
- **Files:** `src/context/discovery.ts` (new), `src/context/types.ts` (new), `src/context/index.ts` (new)
- **Dependencies:** Phase 34 (logging)
- **Action:** Walk directory tree upward from project root. Discover: AGENTS.md, README.md, CLAUDE.md, .opencode/. Hierarchical merging (deeper = higher priority).
- **Test:** `tests/context/discovery.test.ts` — discovers files in temp directory tree
- **Verification:** Correct priority ordering, missing files don't crash
- **Worktree:** No — additive module

### Task 2: Context budget allocator
- **Files:** `src/context/budget.ts` (new)
- **Dependencies:** Task 1
- **Action:** Allocate token budget: memory (2000), AGENTS.md (1000), README.md (500), skills (8000). Total configurable. Over-budget sources truncated with summary.
- **Test:** `tests/context/budget.test.ts` — budget allocation math correct
- **Verification:** Total injection never exceeds configured budget

### Task 3: Context injector
- **Files:** `src/context/injector.ts` (new)
- **Dependencies:** Tasks 1-2
- **Action:** Compose all context sources into single injection. Use `experimental.chat.system.transform` hook. Cache per session. Invalidate on file change.
- **Test:** `tests/context/injector.test.ts` — injection composition correct
- **Verification:** System prompt contains all discovered context within budget

---

## Plan 39-02: Compaction + Integration (2 tasks)

### Task 4: Re-injection on compaction
- **Files:** `src/context/compaction-handler.ts` (new)
- **Dependencies:** Task 3
- **Action:** Hook into `experimental.session.compacting`. After compaction: re-inject context (it was lost). Preserve critical context (current task, loop state).
- **Test:** `tests/context/compaction-handler.test.ts`
- **Verification:** Context survives compaction event

### Task 5: Wire into plugin lifecycle
- **Files:** `src/index.ts` (modify)
- **Dependencies:** Task 4
- **Action:** Replace existing memory-only injector with unified context injector. Memory injection becomes one source among many.
- **Test:** Existing memory injection tests still pass
- **Verification:** AGENTS.md in project root is auto-injected

---

## Success Criteria

- [ ] File discovery works
- [ ] Budget allocation correct
- [ ] Context injector composes all sources
- [ ] Re-injection on compaction works
- [ ] AGENTS.md auto-injected
- [ ] All tests pass