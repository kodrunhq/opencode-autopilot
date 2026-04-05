# Phase 43: Integration Testing + Polish

**Goal:** End-to-end integration tests covering all v7 subsystems. Performance benchmarks. Documentation updates.
**Depends on:** All previous phases complete
**Effort:** 2 plans, 6 tasks, ~2 days
**Risk:** LOW — Testing and documentation
**PR Increment:** Comprehensive test suite, updated README, release notes

---

## Plan 43-01: Integration Tests (4 tasks)

### Task 1: Background + routing + loop integration test
- **Files:** `tests/integration/background-routing-loop.test.ts` (new)
- **Dependencies:** Phases 35-37 complete
- **Action:** End-to-end: delegate task with category → background manager spawns → agent loops until done → result collected. Verify full lifecycle.
- **Test:** Self-contained integration test
- **Verification:** Full delegation → completion lifecycle works

### Task 2: Recovery + logging integration test
- **Files:** `tests/integration/recovery-logging.test.ts` (new)
- **Dependencies:** Phases 34, 38 complete
- **Action:** Simulate error → recovery classifier → strategy selection → recovery execution → structured log entries. Verify end-to-end.
- **Test:** Self-contained
- **Verification:** Error recovery produces correct log entries

### Task 3: Context injection + compaction integration test
- **Files:** `tests/integration/context-compaction.test.ts` (new)
- **Dependencies:** Phase 39 complete
- **Action:** Inject context → simulate compaction → verify re-injection → verify budget enforcement.
- **Test:** Self-contained
- **Verification:** Context survives compaction within budget

### Task 4: Full pipeline integration test
- **Files:** `tests/integration/full-pipeline-v7.test.ts` (new)
- **Dependencies:** All phases complete
- **Action:** RECON → CHALLENGE → ARCHITECT → PLAN → BUILD → SHIP with background agents, routing, recovery, logging, context injection all active. Smoke test.
- **Test:** Self-contained (may use mocked LLM responses)
- **Verification:** Pipeline completes without errors

---

## Plan 43-02: Documentation + Release (2 tasks)

### Task 5: Update README and docs
- **Files:** `README.md` (modify), `docs/guide/installation.md` (modify)
- **Dependencies:** Task 4
- **Action:** Document: new tools (oc_background, oc_loop, oc_delegate, oc_recover), new config sections, agent consolidation changes, MCP support.
- **Test:** Links resolve, examples are valid
- **Verification:** README accurately describes v7 features

### Task 6: Release preparation
- **Files:** `package.json` (modify), `CHANGELOG.md` (modify)
- **Dependencies:** Task 5
- **Action:** Bump version to 7.0.0. Write changelog with all phases summarized. Tag release candidate.
- **Test:** `bun test` passes, `bun run lint` clean
- **Verification:** `npm publish --dry-run` succeeds

---

## Success Criteria

- [ ] Background + routing + loop integration test passes
- [ ] Recovery + logging integration test passes
- [ ] Context + compaction integration test passes
- [ ] Full pipeline integration test passes
- [ ] README and docs updated
- [ ] CHANGELOG written
- [ ] Version bumped to 7.0.0
- [ ] All tests pass
- [ ] Lint clean
- [ ] `npm publish --dry-run` succeeds