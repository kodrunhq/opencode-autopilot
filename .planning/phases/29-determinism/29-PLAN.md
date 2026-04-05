# Phase 29: Determinism Guarantee

**Goal**: Ensure 100% deterministic replay - same input produces same output
**Depends on**: Phase 28 (Concurrency Foundation)
**Effort**: 2 plans, 8 tasks, ~1.5 days
**Risk**: MEDIUM — Subtle non-determinism can hide in many places
**PR Increment**: Time-independent scoring, replay tests, reproducible results

---

## Plan 29-01: Time-Independent Scoring (4 tasks)

### Task 1: Extract time as dependency
- **Files**: `src/scoring/time-provider.ts` (new)
- **Dependencies**: Phase 28 complete
- **Action**: Create `TimeProvider` interface with `now(): number`. Production impl uses `Date.now()`. Test impl returns fixed values.
- **Test**: `tests/scoring/time-provider.test.ts` — provider returns configured values
- **Verification**: Time is injectable for testing
- **Worktree**: No — isolated change

### Task 2: Make scoring deterministic
- **Files**: `src/review/scoring.ts` (modify), `src/review/time-scoring.ts` (new)
- **Dependencies**: Task 1
- **Action**: Extract all time-dependent scoring into `time-scoring.ts`. Inject `TimeProvider`.
- **Test**: `tests/review/scoring.test.ts` — same input always produces same score
- **Verification**: Scoring is pure function of input + injected time

### Task 3: Deterministic replay test
- **Files**: `tests/review/deterministic-replay.test.ts` (new)
- **Dependencies**: Task 2
- **Action**: Test: replay same session twice → identical results.
- **Test**: Self-contained
- **Verification**: Determinism test passes

### Task 4: Fix non-deterministic review parsing
- **Files**: `src/review/parse-findings.ts` (new)
- **Dependencies**: Task 3
- **Action**: Normalize JSON parsing. Handle edge cases: missing fields, extra fields, malformed JSON.
- **Test**: `tests/review/parse-findings.test.ts` — all edge cases handled consistently
- **Verification**: Parsing is deterministic

---

## Plan 29-02: Reproducible Randomness (4 tasks)

### Task 5: Seeded RNG for diversity
- **Files**: `src/utils/random.ts` (new)
- **Dependencies**: None
- **Action**: Create seeded PRNG (`seedrandom` or similar). Use for review agent selection diversity.
- **Test**: `tests/utils/random.test.ts` — same seed = same sequence
- **Verification**: Randomness is reproducible

### Task 6: Make agent selection deterministic
- **Files**: `src/review/selection.ts` (modify)
- **Dependencies**: Task 5
- **Action**: Use seeded RNG for agent selection. Seed derived from session ID + phase.
- **Test**: `tests/review/selection.test.ts` — same seed = same agent order
- **Verification**: Agent selection is deterministic

### Task 7: Session replay command
- **Files**: `src/tools/replay.ts` (new)
- **Dependencies**: Tasks 1-6
- **Action**: `oc_replay` command: replay session with same seed, verify identical results.
- **Test**: `tests/tools/replay.test.ts` — replay produces identical output
- **Verification**: Replay command works

### Task 8: Determinism integration test
- **Files**: `tests/integration/determinism.test.ts` (new)
- **Dependencies**: Tasks 1-7
- **Action**: Run same session 3 times. Verify all outputs identical.
- **Test**: Self-contained integration test
- **Verification**: End-to-end determinism guaranteed

---

## Success Criteria

- [ ] Scoring is time-independent (injectable time)
- [ ] Same session replay produces identical results
- [ ] Seeded RNG for agent selection
- [ ] `oc_replay` command works
- [ ] 10+ determinism tests passing
- [ ] Integration test: 3 runs → identical outputs