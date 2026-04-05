# v6.0 Strategic Roadmap: Engineering Excellence

**Created:** 2026-04-05
**Prerequisite:** Phase 26 (Pipeline Hardening) — 2 plans, 29 tasks, already planned
**Milestone:** v6.0 — Phases 27-31
**Scope:** Systemic architectural, concurrency, determinism, UX, and reliability improvements

---

## Executive Summary

v6.0 addresses the fundamental architectural debt identified through live failure analysis (Gloomberg session), competitive gap analysis (oh-my-openagent), and comprehensive codebase audit (24,459 LOC, **~1,455 tests (estimate)**, 193 source files). The milestone transforms the plugin from "functional but fragile" to "production-grade with provable guarantees."

**Five Pillars:**

| # | Phase | Pillar | Key Metric | Effort |
|---|-------|--------|-----------|--------|
| 27 | Architecture Simplification | Split god files, flatten config | Max file <300 LOC (from 1008) | 3 plans |
| 28 | Concurrency Foundation | Prove thread-safety, fix races | 40+ concurrency tests (current: 7) | 2 plans |
| 29 | Determinism Guarantee | Time-independent scoring, replay | 100% deterministic replay | 2 plans |
| 30 | UX Transformation | Progress, context visibility, diagnostics | Every operation has user feedback | 2 plans |
| 31 | Reliability Engineering | Unified logging, error taxonomy, metrics | Zero silent failures | 2 plans |

**Total:** 11 plans across 5 phases (~55 tasks)

---

## Architectural Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| AD-01 | Architecture FIRST, then concurrency | Modular files are easier to test for races. Split before adding concurrency tests. |
| AD-02 | Config V7 with thin V1-V3 compatibility | Auto-migrate V1-V3 → V4 silently on load. V4→V7 is the canonical chain. Never break existing users. |
| AD-03 | Phase 26 is prerequisite, not merged | Pipeline hardening (artifact paths, circuit breaker, JSONL logging) is foundation for all v6.0 work. |
| AD-04 | Single-threaded assumption documented, not fixed | Bun is single-threaded. Concurrency tests PROVE safety and catch regressions if runtime model changes. |
| AD-05 | God files split via extraction, not rewrite | Move sections to new files with identical API. Zero behavioral changes during extraction. |
| AD-06 | Determinism via reference timestamps | Pass `referenceTime` through decay/retrieval/capture chain. No event-sourcing rewrite. |
| AD-07 | UX via existing hook system | Use `experimental.chat.system.transform` and tool response fields. No TUI modifications. |
| AD-08 | Extract then test (TDD-adjacent) | For extractions: extract module → write tests for extracted module → verify existing tests still pass. For new behavior: write test first → implement → verify. |

---

## Dependency Graph

```
Phase 26 (Pipeline Hardening)        ← PREREQUISITE (already planned)
         │
         ▼
Phase 27 (Architecture Simplification) ← Split god files, flatten config
         │
         ▼
Phase 28 (Concurrency Foundation)      ← Add concurrency tests to new modules
         │
         ▼
Phase 29 (Determinism Guarantee)       ← Deterministic scoring in simplified arch
         │
         ├────────────────┐
         ▼                ▼
Phase 30 (UX)        Phase 31 (Reliability)   ← Can run in parallel
```

**Critical path:** 26 → 27 → 28 → 29 → 31
**Parallel opportunity:** Phases 30 and 31 after Phase 29

---

## Atomic Commit Strategy

Every task produces exactly one commit. Commit message format:

```
<type>(<scope>): <description>

<body — what changed and why>

Refs: Phase <N>, Task <M>
```

Types: `refactor` (extraction), `test` (new tests), `fix` (bug fix), `feat` (new capability)
Scopes: `orchestrate`, `build`, `memory`, `config`, `fallback`, `review`, `observability`, `skills`

**Rules:**
1. Every commit must leave `bun test` green (1455+ tests passing, 0 failures)
2. Every commit must leave `bun run lint` clean
3. Extraction commits change ZERO behavior — only move code
4. Test commits add tests that pass against current code (TDD green phase)
5. Fix commits include the test that would have caught the bug

---

## Phase 27: Architecture Simplification

**Goal:** No source file exceeds 300 lines. God files split into focused, single-responsibility modules. Config migration chain consolidated from 6 versions to a clean V4→V7 path with thin V1-V3 compatibility.

**Depends on:** Phase 26 (pipeline hardening complete)
**Risk:** MEDIUM — Pure extraction carries low behavioral risk, but import path changes can cascade. Mitigated by running full test suite after each extraction.
**Effort:** 3 plans, ~18 tasks, ~3 days

### Success Criteria

1. `src/tools/orchestrate.ts` reduced from 812 to <250 lines (core entry + tool registration only)
2. `src/orchestrator/handlers/build.ts` reduced from 454 to <200 lines (main handler + delegation only)
3. `src/memory/repository.ts` reduced from 1008 to <200 lines (facade re-exporting domain modules)
4. `src/config.ts` reduced from 383 to <200 lines (V7 schema + load/save + thin migration)
5. All 1455+ existing tests pass without modification (extraction changes zero behavior)
6. Zero new dependencies introduced

### Plan 27-01: Extract orchestrate.ts and build.ts

**Wave 1 — Orchestrate Extractions (parallel, no interdependencies)**

#### Task 1: Extract dispatch validation module

**Files:**
- `src/orchestrator/dispatch-validator.ts` (new) — extracted from orchestrate.ts lines 46-165
- `src/tools/orchestrate.ts` (modify) — replace inline functions with imports
- `tests/orchestrator/dispatch-validator.test.ts` (new)

**Action:**
1. Extract `createDispatchId()`, `findPendingDispatch()`, `withPendingDispatch()`, `removePendingDispatch()`, `expectedResultKindForPending()`, `detectPhaseFromPending()`, `detectAgentFromPending()`, `detectDispatchFromPending()` into new module.
2. Export all functions. Import in orchestrate.ts.
3. Write focused unit tests for each extracted function.

**Verification:** `bun test` — all existing tests pass + new dispatch-validator tests pass.
**Commit:** `refactor(orchestrate): extract dispatch validation to dedicated module`

---

#### Task 2: Extract context injection module

**Files:**
- `src/orchestrator/context-injector.ts` (new) — extracted from orchestrate.ts lines 262-317
- `src/tools/orchestrate.ts` (modify)
- `tests/orchestrator/context-injector.test.ts` (new)

**Action:**
1. Extract `injectLessonContext()` and `injectSkillContext()` into new module.
2. Unify error handling: both functions follow same try/catch pattern with 5 error categories.
3. Add explicit return type `Promise<string>` (empty string on any error).

**Verification:** `bun test` — all existing tests pass + new context-injector tests pass.
**Commit:** `refactor(orchestrate): extract context injection to dedicated module`

---

#### Task 3: Extract circuit breaker module

**Files:**
- `src/orchestrator/circuit-breaker.ts` (new) — extracted from orchestrate.ts lines 320-382
- `src/tools/orchestrate.ts` (modify)
- `tests/orchestrator/circuit-breaker.test.ts` (new)

**Action:**
1. Extract `MAX_PHASE_DISPATCHES`, `checkCircuitBreaker()`, `buildUserProgress()`.
2. Make `MAX_PHASE_DISPATCHES` configurable (accept overrides from config, default to current hardcoded values).
3. Add tests: breaker triggers at limit, breaker allows below limit, custom limits override defaults.

**Verification:** `bun test` — all existing tests pass + new circuit-breaker tests pass.
**Commit:** `refactor(orchestrate): extract circuit breaker to dedicated module`

---

#### Task 4: Extract result processor module

**Files:**
- `src/orchestrator/result-processor.ts` (new) — extracted from orchestrate.ts lines 388-632
- `src/tools/orchestrate.ts` (modify)
- `tests/orchestrator/result-processor.test.ts` (new)

**Action:**
1. Extract `processHandlerResult()` and its helper functions (`applyResultEnvelope()`, `parseErrorCode()`, `applyStateUpdates()`).
2. Define clear interface: `ProcessHandlerResultInput` (state, handler result, config, injectors) → `ProcessHandlerResultOutput` (next action, updated state, user progress).
3. This is the largest extraction (~244 lines). Preserve exact behavior.

**Verification:** `bun test` — all existing tests pass + new result-processor tests pass.
**Commit:** `refactor(orchestrate): extract result processor to dedicated module`

---

**Wave 2 — Build Handler Extractions (parallel, no interdependencies)**

#### Task 5: Extract wave manager module

**Files:**
- `src/orchestrator/handlers/wave-manager.ts` (new) — extracted from build.ts lines 15-46 + 108-138
- `src/orchestrator/handlers/build.ts` (modify)
- `tests/orchestrator/handlers/wave-manager.test.ts` (new)

**Action:**
1. Extract `findCurrentWave()`, `findPendingTasks()`, `findInProgressTasks()`, `isWaveComplete()`, `hasCriticalFindings()`.
2. Pure functions, no state mutation. Easy to test in isolation.

**Verification:** `bun test` — all existing tests pass + new wave-manager tests pass.
**Commit:** `refactor(build): extract wave manager to dedicated module`

---

#### Task 6: Extract task executor module

**Files:**
- `src/orchestrator/handlers/task-executor.ts` (new) — extracted from build.ts lines 48-103
- `src/orchestrator/handlers/build.ts` (modify)
- `tests/orchestrator/handlers/task-executor.test.ts` (new)

**Action:**
1. Extract `buildTaskPrompt()`, `markTasksInProgress()`, `markTaskDone()`, `buildPendingResultError()`.
2. Functions that mutate task state. Carefully preserve mutation semantics.

**Verification:** `bun test` — all existing tests pass + new task-executor tests pass.
**Commit:** `refactor(build): extract task executor to dedicated module`

---

#### Task 7: Extract strike system module

**Files:**
- `src/orchestrator/handlers/strike-system.ts` (new) — extracted from build.ts lines 140-300 (strike-related sections)
- `src/orchestrator/handlers/build.ts` (modify)
- `tests/orchestrator/handlers/strike-system.test.ts` (new)

**Action:**
1. Extract strike counting logic, CRITICAL finding detection, max retries enforcement.
2. Define `StrikeState` type: `{ count: number; maxStrikes: number; findings: CriticalFinding[] }`.
3. Export `checkStrike()`, `recordStrike()`, `isMaxStrikesExceeded()`.

**Verification:** `bun test` — all existing tests pass + new strike-system tests pass.
**Commit:** `refactor(build): extract strike system to dedicated module`

---

**Wave 3 — Verify orchestrate.ts and build.ts size targets**

#### Task 8: Verify extraction targets and update imports

**Files:**
- `src/tools/orchestrate.ts` (verify) — should be <250 lines
- `src/orchestrator/handlers/build.ts` (verify) — should be <200 lines

**Action:**
1. Verify line counts meet targets.
2. Clean up any redundant imports.
3. Add module-level JSDoc comments to each new file describing its single responsibility.
4. Run full test suite + lint.

**Verification:** `bun test && bun run lint` — all green. `wc -l` confirms targets.
**Commit:** `refactor(orchestrate): finalize extraction and verify size targets`

---

### Plan 27-02: Split memory/repository.ts into domain modules

**Wave 1 — Extract domain repositories (parallel)**

#### Task 1: Extract observation repository

**Files:**
- `src/memory/repositories/observation-repository.ts` (new) — from repository.ts lines 280-410
- `src/memory/repository.ts` (modify) — re-export for backward compatibility
- `tests/memory/repositories/observation-repository.test.ts` (new)

**Action:**
1. Extract `insertObservation()`, `searchObservations()`, `getObservationsByProject()`, `deleteObservation()`, `updateAccessCount()`.
2. Move row mapper `rowToObservation()` and helper `parseObservationType()`.
3. Re-export from `repository.ts` for backward compat.

**Verification:** `bun test tests/memory/` — all existing tests pass.
**Commit:** `refactor(memory): extract observation repository to domain module`

---

#### Task 2: Extract preference repository

**Files:**
- `src/memory/repositories/preference-repository.ts` (new) — from repository.ts lines 413-923
- `src/memory/repository.ts` (modify)
- `tests/memory/repositories/preference-repository.test.ts` (new)

**Action:**
1. Extract `upsertPreferenceRecord()`, `getPreferenceRecordById()`, `listPreferenceRecords()`, `deletePreferenceRecord()`, `deletePreferencesByKey()`, `prunePreferences()`, `upsertPreference()`, `getAllPreferences()`, `getConfirmedPreferencesForProject()`.
2. Move row mappers `rowToPreferenceRecord()`, `rowToPreferenceEvidence()`, `recordToPreference()`.
3. Move helpers `makePreferenceId()`, `makeEvidenceId()`, `makeStatementHash()`, `normalizePreferenceProjectId()`.
4. This is the largest extraction (~510 lines). Preserve exact behavior.

**Verification:** `bun test tests/memory/` — all existing tests pass.
**Commit:** `refactor(memory): extract preference repository to domain module`

---

#### Task 3: Extract lesson repository

**Files:**
- `src/memory/repositories/lesson-repository.ts` (new) — from repository.ts lines 243-288
- `src/memory/repository.ts` (modify)
- `tests/memory/repositories/lesson-repository.test.ts` (new)

**Action:**
1. Extract `listLegacyLessons()`, `buildLessonsFromRows()`, `listRelevantLessons()`.
2. Small extraction (~45 lines), but isolates lesson query logic.

**Verification:** `bun test tests/memory/` — all existing tests pass.
**Commit:** `refactor(memory): extract lesson repository to domain module`

---

#### Task 4: Extract project repository

**Files:**
- `src/memory/repositories/project-repository.ts` (new) — from repository.ts lines 342-395
- `src/memory/repository.ts` (modify)
- `tests/memory/repositories/project-repository.test.ts` (new)

**Action:**
1. Extract `upsertProject()`, `getProjectByPath()`.
2. Move row mapper `rowToProject()`.

**Verification:** `bun test tests/memory/` — all existing tests pass.
**Commit:** `refactor(memory): extract project repository to domain module`

---

#### Task 5: Extract shared helpers module

**Files:**
- `src/memory/repositories/helpers.ts` (new) — from repository.ts lines 58-229
- All domain repositories (modify) — import helpers
- `tests/memory/repositories/helpers.test.ts` (new)

**Action:**
1. Extract `resolveDb()`, `withWriteTransaction()`, `buildPlaceholders()`, `tableExists()`.
2. Add transaction nesting guard from `projects/repository.ts` pattern (check `PRAGMA transaction_state` before `BEGIN IMMEDIATE`).
3. All domain repositories import from this module.

**Verification:** `bun test tests/memory/` — all existing tests pass.
**Commit:** `refactor(memory): extract shared repository helpers with transaction guard`

---

**Wave 2 — Convert repository.ts to facade**

#### Task 6: Convert repository.ts to re-export facade

**Files:**
- `src/memory/repository.ts` (rewrite) — becomes barrel file re-exporting all domain modules

**Action:**
1. Replace all function implementations with re-exports from domain modules.
2. Verify `repository.ts` is <50 lines (pure re-exports).
3. Every existing import of `repository.ts` continues to work without changes.

**Verification:** `bun test` — all 1455+ tests pass. `wc -l src/memory/repository.ts` < 50.
**Commit:** `refactor(memory): convert repository to re-export facade`

---

### Plan 27-03: Consolidate config migration chain

**Wave 1 — Schema and migration work (sequential)**

#### Task 1: Create V7 schema with consolidated structure

**Files:**
- `src/config.ts` (modify) — add `pluginConfigSchemaV7`
- `tests/config.test.ts` (modify) — add V7 validation tests

**Action:**
1. Define `pluginConfigSchemaV7` extending V6 with:
   - New `schemaVersion: z.literal(7)` field
   - Flattened `orchestrator` section (remove indirection through `groups` for simple cases)
   - Add `configMigratedFrom` field (tracks which version was auto-migrated, for diagnostics)
2. V7 is backward-compatible with V6 (all V6 fields remain valid).
3. Write tests: V7 validates, V6 data passes V7 validation, new fields have defaults.

**Verification:** `bun test tests/config.test.ts`
**Commit:** `feat(config): add V7 schema with migration provenance tracking`

---

#### Task 2: Consolidate V1-V3 into single migration function

**Files:**
- `src/config.ts` (modify) — replace `migrateV1toV2()` + `migrateV2toV3()` with `migrateV1V2V3toV4()`
- `tests/config.test.ts` (modify) — add consolidated migration tests

**Action:**
1. Create `migrateV1V2V3toV4(raw: unknown): PluginConfigV4` that handles V1, V2, or V3 input.
2. Detects version from `raw.version` field (or absence of it for V1).
3. Applies all transformations in sequence internally.
4. Logs deprecation notice: `"Config auto-migrated from v${version} to v4. This compatibility layer will be removed in v7.0."`.
5. Remove individual `migrateV1toV2()`, `migrateV2toV3()` functions.

**Verification:** `bun test tests/config.test.ts` — existing migration tests pass.
**Commit:** `refactor(config): consolidate V1-V3 migrations into single function`

---

#### Task 3: Add V6→V7 migration and simplify loadConfig

**Files:**
- `src/config.ts` (modify) — add `migrateV6toV7()`, simplify `loadConfig()` cascade
- `tests/config.test.ts` (modify) — add V6→V7 migration tests

**Action:**
1. Add `migrateV6toV7()`: adds `schemaVersion: 7`, sets `configMigratedFrom` if migrating.
2. Simplify `loadConfig()` cascade:
   - Try V7 parse first
   - Try V4/V5/V6 parse → migrate to V7
   - Try V1/V2/V3 parse → `migrateV1V2V3toV4()` → migrate through V4→V7
   - Invalid → return default V7 config
3. Auto-save migrated config (existing behavior preserved).

**Verification:** `bun test tests/config.test.ts` — full migration chain tests pass.
**Commit:** `feat(config): add V6-to-V7 migration and simplify load cascade`

---

#### Task 4: Extract migration functions to dedicated module

**Files:**
- `src/config/migrations.ts` (new) — all migration functions
- `src/config.ts` (modify) — import migrations, keep schema + load/save
- `tests/config/migrations.test.ts` (new)

**Action:**
1. Move all `migrateVXtoVY()` functions to `src/config/migrations.ts`.
2. `config.ts` retains: V7 schema definition, `loadConfig()`, `saveConfig()`, type exports.
3. Target: `config.ts` < 200 lines.

**Verification:** `bun test` — all tests pass. `wc -l src/config.ts` < 200.
**Commit:** `refactor(config): extract migrations to dedicated module`

---

## Phase 28: Concurrency Foundation

**Goal:** Prove that the plugin is safe under concurrent access. Add 40+ concurrency tests. Fix identified race conditions. Document the single-threaded assumption with explicit guards.

**Depends on:** Phase 27 (modular code is easier to test for concurrency)
**Risk:** LOW — Bun is single-threaded, so most "races" are impossible in practice. Tests document assumptions and catch regressions.
**Effort:** 2 plans, ~12 tasks, ~2 days

### Success Criteria

1. 40+ new concurrency-focused tests added across all subsystems
2. `acquireRetryLock()` in fallback-manager.ts uses atomic check-and-set pattern
3. Transaction nesting guard applied consistently across all repositories (memory, kernel, projects)
4. SQLite `busy_timeout` exhaustion handled with retry logic (not silent failure)
5. All new tests pass reliably (no flaky tests from timing dependencies)
6. `CONCURRENCY.md` document in `.planning/research/` explaining the threading model

### Plan 28-01: Fix race conditions and add synchronization guards

**Wave 1 — Fix identified races (parallel, different files)**

#### Task 1: Fix acquireRetryLock atomicity in fallback-manager

**Files:**
- `src/orchestrator/fallback/fallback-manager.ts` (modify) — lines 96-102
- `tests/orchestrator/fallback/fallback-manager.test.ts` (modify)

**Action:**
1. Replace check-then-act pattern with atomic operation. Since Bun is single-threaded, the current code is technically safe, but the pattern is fragile. Refactor to single-expression guard:
   ```typescript
   acquireRetryLock(sessionID: string): boolean {
     if (this.sessionRetryInFlight.has(sessionID)) return false;
     this.sessionRetryInFlight.add(sessionID);
     return true;
   }
   ```
   Add JSDoc comment: `// Safe: Bun event loop is single-threaded. No interleaving between has() and add().`
2. Add test: "acquireRetryLock is idempotent — second call returns false".
3. Add test: "releaseRetryLock followed by acquireRetryLock returns true".

**Verification:** `bun test tests/orchestrator/fallback/fallback-manager.test.ts`
**Commit:** `fix(fallback): document single-threaded safety of retry lock acquisition`

---

#### Task 2: Add transaction nesting guard to memory repositories

**Files:**
- `src/memory/repositories/helpers.ts` (modify) — `withWriteTransaction()` from Plan 27-02
- `tests/memory/repositories/helpers.test.ts` (modify)

**Action:**
1. Copy the `PRAGMA transaction_state` check from `src/projects/repository.ts` (lines 45-48) into the shared `withWriteTransaction()` helper.
2. If already in a transaction, execute callback directly without `BEGIN IMMEDIATE`.
3. Add tests: "nested withWriteTransaction does not double-begin", "rollback in nested transaction does not affect outer".

**Verification:** `bun test tests/memory/`
**Commit:** `fix(memory): add transaction nesting guard to shared write helper`

---

#### Task 3: Add SQLite busy_timeout retry wrapper

**Files:**
- `src/memory/database.ts` (modify) — add `withBusyRetry()` utility
- `tests/memory/database.test.ts` (new)

**Action:**
1. Create `withBusyRetry<T>(fn: () => T, maxRetries = 3, baseDelay = 100): T`.
2. Catches `SQLITE_BUSY` errors, retries with exponential backoff (100ms, 200ms, 400ms).
3. After max retries, throws descriptive error: `"SQLite busy after ${maxRetries} retries (${totalMs}ms). Possible write contention."`.
4. Export for use in high-contention paths (upsertPreferenceRecord, savePipelineStateToKernel).

**Verification:** `bun test tests/memory/database.test.ts`
**Commit:** `feat(memory): add SQLite busy retry wrapper with exponential backoff`

---

#### Task 4: Guard singleton database initialization

**Files:**
- `src/memory/database.ts` (modify) — line 7 (`let db`) and lines 138-155 (`getMemoryDb()`)
- `tests/memory/database.test.ts` (modify)

**Action:**
1. Add initialization guard using a `let initializing: Promise<Database> | null = null` pattern.
2. If `getMemoryDb()` is called while initialization is in-progress, return the same Promise (deduplication).
3. Add JSDoc documenting the singleton lifecycle: init → use → never closed (process lifecycle).
4. Add test: "concurrent getMemoryDb calls return same instance".

**Verification:** `bun test tests/memory/database.test.ts`
**Commit:** `fix(memory): guard singleton database against concurrent initialization`

---

### Plan 28-02: Concurrency test suite

**Wave 1 — State concurrency tests (parallel, different domains)**

#### Task 5: Add fallback-manager concurrency tests

**Files:**
- `tests/orchestrator/fallback/concurrency.test.ts` (new)

**Action:**
1. Test: "rapid sequential handleError calls — only first triggers fallback plan".
2. Test: "acquireRetryLock + releaseRetryLock cycle under rapid fire (100 iterations)".
3. Test: "TTFT timer does not fire after recordFirstToken called".
4. Test: "cleanupSession during handleError does not throw".
5. Test: "100 simultaneous session initializations — all get unique state".

**Verification:** `bun test tests/orchestrator/fallback/concurrency.test.ts`
**Commit:** `test(fallback): add concurrency test suite (5 tests)`

---

#### Task 6: Add state persistence concurrency tests

**Files:**
- `tests/orchestrator/state-concurrency.test.ts` (new)

**Action:**
1. Test: "two sequential updatePersistedState calls — second sees first's revision".
2. Test: "updatePersistedState with stale revision — triggers retry and succeeds".
3. Test: "updatePersistedState exceeding maxConflicts — throws ConflictError".
4. Test: "legacy mirror sync failure — kernel state preserved, warning logged once".
5. Test: "rapid state updates (50 iterations) — all succeed, final revision is correct".

**Verification:** `bun test tests/orchestrator/state-concurrency.test.ts`
**Commit:** `test(state): add persistence concurrency test suite (5 tests)`

---

#### Task 7: Add SQLite write contention tests

**Files:**
- `tests/memory/write-contention.test.ts` (new)

**Action:**
1. Test: "withBusyRetry succeeds after simulated SQLITE_BUSY".
2. Test: "withBusyRetry exhausts retries and throws descriptive error".
3. Test: "concurrent observation inserts (20 parallel) — all succeed".
4. Test: "concurrent preference upserts for same key — last write wins, no corruption".
5. Test: "FTS5 trigger fires correctly during batch insert".
6. Test: "WAL mode verified on database open".

**Verification:** `bun test tests/memory/write-contention.test.ts`
**Commit:** `test(memory): add SQLite write contention test suite (6 tests)`

---

#### Task 8: Add kernel repository concurrency tests

**Files:**
- `tests/kernel/concurrency.test.ts` (new)

**Action:**
1. Test: "savePipelineStateToKernel with correct revision — succeeds".
2. Test: "savePipelineStateToKernel with stale revision — throws conflict error".
3. Test: "sequential saves increment revision monotonically".
4. Test: "multi-table write atomicity — partial failure rolls back all tables".
5. Test: "concurrent reads during write — readers see consistent snapshot (WAL isolation)".

**Verification:** `bun test tests/kernel/concurrency.test.ts`
**Commit:** `test(kernel): add repository concurrency test suite (5 tests)`

---

**Wave 2 — Cross-subsystem concurrency tests**

#### Task 9: Add cross-subsystem concurrency tests

**Files:**
- `tests/integration/concurrency.test.ts` (new)

**Action:**
1. Test: "memory write during fallback handler — no deadlock".
2. Test: "state update during memory capture — both complete".
3. Test: "rapid session init + cleanup cycle (50 iterations) — no leaked state".
4. Test: "config load during state save — no file corruption".
5. Test: "event store append during log writer flush — no data loss".

**Verification:** `bun test tests/integration/concurrency.test.ts`
**Commit:** `test(integration): add cross-subsystem concurrency test suite (5 tests)`

---

#### Task 10: Document concurrency model

**Files:**
- `.planning/research/CONCURRENCY.md` (new)

**Action:**
1. Document Bun's single-threaded event loop model and implications.
2. Document SQLite WAL mode guarantees and limitations.
3. Document OCC pattern used in state.ts and kernel/repository.ts.
4. Document the singleton database lifecycle.
5. Document which operations are safe for concurrent async execution and which are not.
6. Reference all concurrency tests as living documentation.

**Verification:** File exists and is comprehensive.
**Commit:** `docs: add concurrency model documentation`

---

## Phase 29: Determinism Guarantee

**Goal:** Given identical inputs and a reference timestamp, every subsystem produces identical outputs. Time-dependent calculations accept injectable timestamps. Ordering is deterministic across platforms.

**Depends on:** Phase 28 (concurrency guards in place before determinism tests)
**Risk:** LOW — Changes are parameter additions and sort stabilization. No algorithmic rewrites.
**Effort:** 2 plans, ~10 tasks, ~2 days

### Success Criteria

1. `computeRelevanceScore()` accepts optional `referenceTime` parameter — identical inputs + same referenceTime = identical score
2. `readdir()` results sorted alphabetically before processing in adaptive-injector.ts
3. `queueMicrotask()` replaced with deterministic async pattern in capture.ts
4. Replay test suite: 10+ tests proving deterministic output given fixed inputs
5. All time-dependent functions have `referenceTime` parameter with `Date.now()` as default

### Plan 29-01: Make time-dependent functions injectable

**Wave 1 — Core time injection (sequential — decay feeds retrieval feeds injector)**

#### Task 1: Add referenceTime parameter to decay scoring

**Files:**
- `src/memory/decay.ts` (modify) — line 39 (`Date.now()`)
- `tests/memory/decay.test.ts` (modify)

**Action:**
1. Add `referenceTime?: number` parameter to `computeRelevanceScore()` (default: `Date.now()`).
2. Replace `Date.now()` at line 39 with `referenceTime ?? Date.now()`.
3. Same for `pruneStaleObservations()` — add `referenceTime` parameter.
4. Add tests: "same inputs + same referenceTime = identical score", "different referenceTime = different score".

**Verification:** `bun test tests/memory/decay.test.ts`
**Commit:** `feat(memory): make decay scoring time-injectable for deterministic replay`

---

#### Task 2: Thread referenceTime through retrieval chain

**Files:**
- `src/memory/retrieval.ts` (modify) — `scoreAndRankObservations()`, `retrieveMemoryContext()`
- `tests/memory/retrieval.test.ts` (modify)

**Action:**
1. Add `referenceTime?: number` to `scoreAndRankObservations()` and `retrieveMemoryContext()`.
2. Pass through to `computeRelevanceScore()`.
3. Add test: "retrieveMemoryContext with fixed referenceTime returns deterministic context".

**Verification:** `bun test tests/memory/retrieval.test.ts`
**Commit:** `feat(memory): thread referenceTime through retrieval chain`

---

#### Task 3: Thread referenceTime through memory injector

**Files:**
- `src/memory/injector.ts` (modify) — `createMemoryInjector()`
- `tests/memory/injector.test.ts` (modify)

**Action:**
1. Add `referenceTime?: number` to injection options.
2. Pass through to `retrieveMemoryContext()`.
3. Cache key includes referenceTime when provided (for testing/replay scenarios).
4. Add test: "injection with fixed referenceTime is deterministic".

**Verification:** `bun test tests/memory/injector.test.ts`
**Commit:** `feat(memory): thread referenceTime through injector for deterministic injection`

---

#### Task 4: Make pruning functions time-injectable

**Files:**
- `src/memory/repositories/preference-repository.ts` (modify) — lines 695, 816 (`Date.now()`)
- `src/memory/capture.ts` (modify) — line 201 (`const now = () => new Date().toISOString()`)
- Tests for each (modify)

**Action:**
1. Add `referenceTime?: number` to `selectPrunablePreferenceRecords()`, `prunePreferenceEvidence()`.
2. In `capture.ts`: snapshot `Date.now()` once at handler entry, pass through to all timestamp uses.
3. Replace `queueMicrotask()` at line 281 with explicit `await` in the pruning path.
4. Add test: "pruning with fixed referenceTime is deterministic".

**Verification:** `bun test tests/memory/`
**Commit:** `feat(memory): make pruning time-injectable, replace queueMicrotask with await`

---

### Plan 29-02: Fix ordering non-determinism and add replay tests

**Wave 1 — Fix ordering (parallel, different files)**

#### Task 5: Sort readdir results in adaptive-injector

**Files:**
- `src/skills/adaptive-injector.ts` (modify) — line 97 (`readdir()`)
- `tests/skills/adaptive-injector.test.ts` (modify)

**Action:**
1. After `readdir()` at line 97, sort entries alphabetically: `.sort((a, b) => a.name.localeCompare(b.name))`.
2. Add test: "manifest detection order is alphabetical regardless of filesystem".
3. Add test: "skill injection order is deterministic across calls".

**Verification:** `bun test tests/skills/adaptive-injector.test.ts`
**Commit:** `fix(skills): sort readdir results for deterministic manifest detection`

---

#### Task 6: Stabilize preference deduplication ordering

**Files:**
- `src/memory/capture.ts` (modify) — `extractExplicitPreferenceCandidates()` line 174
- `tests/memory/capture.test.ts` (modify)

**Action:**
1. Sort preference candidates by key before deduplication (currently relies on regex match order).
2. Add test: "preference extraction order is stable regardless of input order".

**Verification:** `bun test tests/memory/capture.test.ts`
**Commit:** `fix(memory): stabilize preference deduplication ordering`

---

**Wave 2 — Replay test suite**

#### Task 7: Add deterministic replay test suite

**Files:**
- `tests/memory/deterministic-replay.test.ts` (new)

**Action:**
1. Test: "identical observations + same referenceTime = identical memory context string".
2. Test: "identical skills + same project = identical skill injection string".
3. Test: "same preferences + same referenceTime = identical preference context".
4. Test: "decay score ordering is stable for tied scores" (add secondary sort by observation ID).
5. Test: "token budgeting produces identical truncation given identical input + budget".
6. Test: "end-to-end: identical session events → identical injected context".

**Verification:** `bun test tests/memory/deterministic-replay.test.ts`
**Commit:** `test(memory): add deterministic replay test suite (6 tests)`

---

#### Task 8: Add secondary sort for tied relevance scores

**Files:**
- `src/memory/retrieval.ts` (modify) — line 50 (`.sort()`)
- `tests/memory/retrieval.test.ts` (modify)

**Action:**
1. Change sort from `(a, b) => b.relevanceScore - a.relevanceScore` to `(a, b) => b.relevanceScore - a.relevanceScore || a.id.localeCompare(b.id)`.
2. This ensures stable ordering when two observations have identical scores.
3. Add test: "tied scores sort by observation ID".

**Verification:** `bun test tests/memory/retrieval.test.ts`
**Commit:** `fix(memory): add secondary sort by ID for tied relevance scores`

---

## Phase 30: UX Transformation

**Goal:** Every operation provides real-time user-visible feedback. Token usage is transparent. Errors are actionable. Progress is continuous.

**Depends on:** Phase 29 (deterministic outputs before exposing them to users)
**Risk:** MEDIUM — UX changes depend on OpenCode's hook system capabilities, which may have undocumented limitations.
**Effort:** 2 plans, ~10 tasks, ~2 days

### Success Criteria

1. Every orchestrate dispatch includes human-readable progress with phase number, attempt count, and phase description
2. Token budget breakdown visible in doctor output (memory chars, skill chars, lesson chars, total)
3. Context utilization warning fires as toast when >80% threshold reached
4. Fallback events produce user-visible toast notifications
5. Session summary includes: phases completed, total dispatches, review findings count, fallback events count
6. Error messages include actionable remediation steps (not just error codes)

### Plan 30-01: Progress and context visibility

#### Task 1: Enhance user progress with rich phase descriptions

**Files:**
- `src/orchestrator/circuit-breaker.ts` (modify) — `buildUserProgress()` from Phase 27 extraction
- `src/tools/orchestrate.ts` (modify) — pass phase metadata to progress builder
- `tests/orchestrator/circuit-breaker.test.ts` (modify)

**Action:**
1. Add `PHASE_DESCRIPTIONS` map: `{ RECON: "Researching domain", CHALLENGE: "Proposing enhancements", ARCHITECT: "Designing architecture", ... }`.
2. Enrich `_userProgress` format: `"[2/8] CHALLENGE — Proposing enhancements (attempt 1)"`.
3. On phase complete, add transition message: `"Completed CHALLENGE (2/8) → advancing to ARCHITECT"`.
4. Add elapsed time per phase: `"[2/8] CHALLENGE — Proposing enhancements (12s elapsed)"`.

**Verification:** `bun test tests/orchestrator/circuit-breaker.test.ts`
**Commit:** `feat(orchestrate): enrich user progress with phase descriptions and timing`

---

#### Task 2: Add token budget breakdown to doctor

**Files:**
- `src/tools/doctor.ts` (modify) — add memory/skill/lesson budget section
- `src/memory/retrieval.ts` (modify) — expose budget consumption metrics
- `src/skills/adaptive-injector.ts` (modify) — expose injection metrics
- `tests/tools/doctor.test.ts` (modify)

**Action:**
1. Add `getMemoryBudgetMetrics()`: returns `{ memoryChars, skillChars, lessonChars, totalChars, budgetLimit }`.
2. Add doctor section: "Context Budget" with breakdown and utilization percentage.
3. Format: `"Memory: 1,200 chars | Skills: 3,400 chars | Lessons: 800 chars | Total: 5,400/16,000 (34%)"`.

**Verification:** `bun test tests/tools/doctor.test.ts`
**Commit:** `feat(doctor): add context token budget breakdown`

---

#### Task 3: Wire context utilization warning to toast

**Files:**
- `src/observability/context-monitor.ts` (modify) — fire toast event
- `src/observability/event-handlers.ts` (modify) — handle context warning event
- `tests/observability/context-monitor.test.ts` (modify)

**Action:**
1. When `checkContextUtilization()` returns `shouldWarn: true`, emit event to event store.
2. Format warning: `"Context utilization at ${pct}% — responses may lose coherence. Consider starting a new session."`.
3. Add test: "warning fires at 80% threshold", "warning does not fire at 79%".

**Verification:** `bun test tests/observability/context-monitor.test.ts`
**Commit:** `feat(observability): fire context utilization warning toast at 80% threshold`

---

#### Task 4: Add fallback event toast notifications

**Files:**
- `src/orchestrator/fallback/event-handler.ts` (modify) — add toast on model switch
- `tests/orchestrator/fallback/event-handler.test.ts` (modify)

**Action:**
1. On successful fallback: `"Model switched: ${from} → ${to} (reason: ${errorType})"`.
2. On fallback chain exhausted: `"All fallback models exhausted for ${agent}. Original error: ${errorType}"`.
3. Toast messages are concise, actionable, and include the error classification.

**Verification:** `bun test tests/orchestrator/fallback/event-handler.test.ts`
**Commit:** `feat(fallback): add user-visible toast notifications for model switches`

---

### Plan 30-02: Session summaries and actionable errors

#### Task 5: Add session completion summary

**Files:**
- `src/observability/session-summary.ts` (new)
- `src/observability/event-store.ts` (modify) — add summary computation
- `tests/observability/session-summary.test.ts` (new)

**Action:**
1. Create `buildSessionSummary(events: ObservabilityEvent[]): SessionSummary`.
2. Summary includes: phases completed, total dispatches, review findings by severity, fallback events, errors by type, total duration, top 3 slowest tools.
3. Format as human-readable markdown block.
4. Wire into session end event.

**Verification:** `bun test tests/observability/session-summary.test.ts`
**Commit:** `feat(observability): add session completion summary with metrics`

---

#### Task 6: Enhance error messages with remediation steps

**Files:**
- `src/orchestrator/fallback/error-classifier.ts` (modify) — add remediation map
- `tests/orchestrator/fallback/error-classifier.test.ts` (modify)

**Action:**
1. Add `ERROR_REMEDIATION` map:
   - `rate_limit`: `"Wait 60s or configure fallback models in groups."`
   - `quota_exceeded`: `"Check billing at provider dashboard. Configure fallback chain."`
   - `model_not_found`: `"Verify model ID. Run 'oc_doctor' to check available models."`
   - `context_length`: `"Reduce context. Start new session or exclude files from context."`
   - `missing_api_key`: `"Set API key: export OPENAI_API_KEY=... or ANTHROPIC_API_KEY=..."`
2. Add `getRemediation(errorType: ErrorType): string`.
3. Include remediation in fallback toast messages and forensics output.

**Verification:** `bun test tests/orchestrator/fallback/error-classifier.test.ts`
**Commit:** `feat(fallback): add actionable remediation steps to error messages`

---

#### Task 7: Expose log file path in session output

**Files:**
- `src/observability/log-writer.ts` (modify) — return log path after write
- `src/tools/orchestrate.ts` (modify) — include log path in completion response

**Action:**
1. `writeSessionLog()` returns `{ logPath: string; eventsWritten: number }`.
2. Include in orchestrate completion: `"Session log: ~/.config/opencode/logs/${filename} (${count} events)"`.

**Verification:** `bun test tests/observability/log-writer.test.ts`
**Commit:** `feat(observability): expose session log path in completion response`

---

## Phase 31: Reliability Engineering

**Goal:** Zero silent failures. Every error is classified, logged, and surfaced. Every subsystem has circuit breakers. Unified structured logging across all modules.

**Depends on:** Phase 28 (concurrency guards), Phase 29 (deterministic outputs)
**Risk:** MEDIUM — Logging changes touch many files. Mitigated by using a central logger that existing code opts into incrementally.
**Effort:** 2 plans, ~12 tasks, ~2 days

### Success Criteria

1. Unified structured logger used across all subsystems (replaces console.warn scattered calls)
2. Error classifier covers 5 new error types: auth (401), forbidden (403), timeout (504), malformed (400), concurrent_limit
3. Review pipeline has circuit breaker (max 5 dispatches per review)
4. Fallback chain exhaustion produces structured error event (not silent)
5. All silent `catch {}` blocks either log or rethrow (zero swallowed errors without logging)
6. Health check endpoint in doctor reports: memory DB status, SQLite WAL mode, config version, event store size

### Plan 31-01: Unified logging and error taxonomy

#### Task 1: Create structured logger module

**Files:**
- `src/observability/logger.ts` (new)
- `tests/observability/logger.test.ts` (new)

**Action:**
1. Create `StructuredLogger` class with levels: `debug`, `info`, `warn`, `error`.
2. Each log entry: `{ timestamp, level, module, message, context: Record<string, unknown> }`.
3. Output to: event store (in-memory) + JSONL file (append-only).
4. Factory: `createLogger(module: string): StructuredLogger`.
5. Replace `console.warn` pattern across codebase incrementally.

**Verification:** `bun test tests/observability/logger.test.ts`
**Commit:** `feat(observability): add structured logger with JSONL persistence`

---

#### Task 2: Expand error classifier taxonomy

**Files:**
- `src/orchestrator/fallback/error-classifier.ts` (modify) — add 5 new error types
- `src/orchestrator/fallback/types.ts` (modify) — extend `ErrorType` union
- `tests/orchestrator/fallback/error-classifier.test.ts` (modify)

**Action:**
1. Add error types: `auth_failure` (401), `forbidden` (403), `timeout` (504 + request timeout), `malformed_request` (400), `concurrent_limit` (429 with concurrent_requests pattern).
2. Add retryability: `auth_failure` = not retryable, `forbidden` = not retryable, `timeout` = retryable, `malformed_request` = not retryable, `concurrent_limit` = retryable with backoff.
3. Add tests for each new error type (status code + regex pattern).

**Verification:** `bun test tests/orchestrator/fallback/error-classifier.test.ts`
**Commit:** `feat(fallback): expand error taxonomy with auth, timeout, malformed, concurrent types`

---

#### Task 3: Add review pipeline circuit breaker

**Files:**
- `src/review/pipeline.ts` (modify) — add dispatch counter + max limit
- `tests/review/pipeline.test.ts` (modify)

**Action:**
1. Add `MAX_REVIEW_DISPATCHES = 5` constant.
2. Track dispatch count per review session.
3. If exceeded: return error finding `"Review circuit breaker triggered: exceeded ${max} dispatches"`.
4. Prevents infinite review loops (same pattern as orchestrate circuit breaker).
5. Add test: "circuit breaker triggers at max dispatches".

**Verification:** `bun test tests/review/pipeline.test.ts`
**Commit:** `feat(review): add circuit breaker to prevent infinite review loops`

---

#### Task 4: Surface fallback chain exhaustion as structured event

**Files:**
- `src/orchestrator/fallback/fallback-manager.ts` (modify) — emit structured event on exhaustion
- `src/orchestrator/fallback/event-handler.ts` (modify) — handle exhaustion event
- `tests/orchestrator/fallback/fallback-manager.test.ts` (modify)

**Action:**
1. When fallback chain is exhausted (all models tried), emit structured event: `{ type: "fallback_exhausted", agent, models_tried, original_error, session_id }`.
2. Event handler surfaces as toast + logs to JSONL.
3. Add test: "chain exhaustion emits structured event with all tried models".

**Verification:** `bun test tests/orchestrator/fallback/fallback-manager.test.ts`
**Commit:** `feat(fallback): emit structured event on chain exhaustion`

---

### Plan 31-02: Silent failure audit and health checks

**Wave 1 — Silent failure audit (parallel, different modules)**

#### Task 5: Audit and fix silent catch blocks in memory subsystem

**Files:**
- `src/memory/capture.ts` (modify) — add logging to catch blocks
- `src/memory/injector.ts` (modify) — add logging to catch blocks
- `src/memory/retrieval.ts` (modify) — add logging to catch blocks

**Action:**
1. Search for `catch` blocks that swallow errors without logging.
2. Add structured logging: `logger.warn("memory.capture", "Failed to capture observation", { error, eventType })`.
3. Preserve best-effort semantics (don't rethrow), but ensure every failure is visible.
4. Add tests verifying log entries appear on error paths.

**Verification:** `bun test tests/memory/`
**Commit:** `fix(memory): add structured logging to all silent catch blocks`

---

#### Task 6: Audit and fix silent catch blocks in fallback subsystem

**Files:**
- `src/orchestrator/fallback/event-handler.ts` (modify) — replace console.warn with structured logger
- `src/orchestrator/fallback/fallback-manager.ts` (modify) — same
- Tests for each (modify)

**Action:**
1. Replace all `console.warn()` calls with `logger.warn("fallback.handler", ...)`.
2. Ensure error context includes: session ID, agent name, model, error type, attempt number.
3. Add tests verifying structured log entries.

**Verification:** `bun test tests/orchestrator/fallback/`
**Commit:** `fix(fallback): replace console.warn with structured logging`

---

#### Task 7: Audit and fix silent catch blocks in skills subsystem

**Files:**
- `src/skills/adaptive-injector.ts` (modify) — add logging to catch blocks
- `src/skills/loader.ts` (modify) — add logging to catch blocks

**Action:**
1. Search for `catch` blocks that return empty strings without logging.
2. Add structured logging: `logger.warn("skills.injector", "Skill injection failed", { error, skillName })`.
3. Preserve best-effort semantics.

**Verification:** `bun test tests/skills/`
**Commit:** `fix(skills): add structured logging to all silent catch blocks`

---

**Wave 2 — Enhanced health checks**

#### Task 8: Add comprehensive health check to doctor

**Files:**
- `src/tools/doctor.ts` (modify) — add subsystem health checks
- `src/health/runner.ts` (modify) — add new check functions
- `tests/tools/doctor.test.ts` (modify)

**Action:**
1. Add checks:
   - Memory DB: open, WAL mode active, table count correct, FTS5 index present
   - SQLite: busy_timeout set, journal mode, foreign keys on
   - Config: current version, migrated from (if applicable), validation status
   - Event store: event count, oldest event, memory usage estimate
   - Fallback: active sessions, models in cooldown, chain status per group
2. Format as table with status indicators: `[OK]`, `[WARN]`, `[FAIL]`.

**Verification:** `bun test tests/tools/doctor.test.ts`
**Commit:** `feat(doctor): add comprehensive subsystem health checks`

---

## Risk Assessment

| Phase | Risk | Impact | Likelihood | Mitigation |
|-------|------|--------|-----------|-----------|
| 27 Architecture | Import path cascades break tests | HIGH | LOW | Run full suite after each extraction. Re-export from original for compat. |
| 27 Architecture | Config V7 migration corrupts user config | HIGH | LOW | Write migrated config to `.bak` first. Validate V7 output before save. |
| 28 Concurrency | Flaky tests from timing dependencies | MEDIUM | MEDIUM | Use deterministic mocks, not real timers. Avoid `setTimeout` in tests. |
| 28 Concurrency | Race condition fixes change behavior | HIGH | LOW | Each fix is minimal (add guard, not rewrite). Existing tests catch regressions. |
| 29 Determinism | referenceTime threading misses a call site | MEDIUM | MEDIUM | Grep for all `Date.now()` in memory/ — ensure every one accepts optional param. |
| 30 UX | OpenCode hook limitations block toast | MEDIUM | MEDIUM | Fall back to tool response fields if hooks unavailable. |
| 31 Reliability | Structured logger adds latency | LOW | LOW | Async JSONL append. Benchmark: <1ms per log entry. |

---

## Effort Summary

| Phase | Plans | Tasks | Estimated Days | Cumulative |
|-------|-------|-------|---------------|-----------|
| 26 Pipeline Hardening | 2 | 29 | 4 | 4 |
| 27 Architecture | 3 | 18 | 3 | 7 |
| 28 Concurrency | 2 | 10 | 2 | 9 |
| 29 Determinism | 2 | 8 | 2 | 11 |
| 30 UX Transformation | 2 | 7 | 2 | 13 |
| 31 Reliability | 2 | 12 | 2 | 15 |
| **Total** | **13** | **84** | **15 days** | |

---

## Test Coverage Targets

| Phase | New Tests | Category | Running Total |
|-------|-----------|----------|--------------|
| Baseline | ~1,455 | ESTIMATE | ~1,455 |
| Phase 26 | ~30 | Pipeline, replay | ~1,485 |
| Phase 27 | ~24 | Extraction, migration | ~1,509 |
| Phase 28 | ~40 | Concurrency | ~1,549 |
| Phase 29 | ~16 | Determinism, replay | ~1,565 |
| Phase 30 | ~14 | UX, summary | ~1,579 |
| Phase 31 | ~20 | Logging, health | ~1,599 |
| **Target** | **~144** | | **~1,599** |

---

## Definition of Done (Milestone-Level)

- [ ] No source file exceeds 300 lines (measured by `wc -l`)
- [ ] 40+ concurrency tests, all passing reliably (no flaky tests)
- [ ] `computeRelevanceScore()` is deterministic given fixed `referenceTime`
- [ ] Every orchestrate operation returns user-visible progress
- [ ] Zero `console.warn` calls remain (replaced with structured logger)
- [ ] Error classifier covers 13 error types (8 existing + 5 new)
- [ ] Review pipeline has circuit breaker
- [ ] Doctor reports subsystem health for memory, SQLite, config, events, fallback
- [ ] Config migration chain: V1-V3 → V4 (single function), V4 → V7 (3 hops)
- [ ] All tests pass: `bun test` (1,599+ tests, 0 failures)
- [ ] All lint passes: `bun run lint` (0 errors)
- [ ] Documentation: CONCURRENCY.md covers threading model
