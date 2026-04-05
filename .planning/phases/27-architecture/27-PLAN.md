# Phase 27: Architecture Simplification

**Goal**: Split god files (>300 LOC) into focused modules, flatten config migration chain
**Depends on**: Phase 26 (Pipeline Hardening)
**Effort**: 3 plans, 18 tasks, ~3 days
**Risk**: MEDIUM — Large refactor touches core files, but behavior unchanged
**PR Increment**: Split files, simpler config, no behavior change

---

## Plan 27-01: Split God Files (6 tasks)

### Task 1: Split config.ts (1008 → ~250 LOC)
- **Files**: `src/config.ts` (modify), `src/config/v1-to-v2.ts` (new), `src/config/v2-to-v3.ts` (new), `src/config/v3-to-v4.ts` (new), `src/config/v4-to-v5.ts` (new), `src/config/v5-to-v6.ts` (new), `src/config/migrations.ts` (new)
- **Dependencies**: None
- **Action**: Extract migration chain into separate files. Main config.ts keeps schema + load + save.
- **Test**: `tests/config.test.ts` — v1-v6 migrations still work
- **Verification**: `wc -l src/config.ts` < 300, all tests pass
- **Worktree**: Yes — `wt/architecture`

### Task 2: Split memory/capture.ts (336 → ~150 LOC)
- **Files**: `src/memory/capture.ts` (modify), `src/memory/observation-builder.ts` (new), `src/memory/session-tracker.ts` (new)
- **Dependencies**: Task 1
- **Action**: Extract observation building and session tracking into modules.
- **Test**: `tests/memory/capture.test.ts` — capture still works
- **Verification**: `wc -l src/memory/capture.ts` < 200
- **Worktree**: Yes (same)

### Task 3: Split memory/repository.ts (507 → ~300 LOC)
- **Files**: `src/memory/repository.ts` (modify), `src/memory/observations.ts` (new), `src/memory/preferences.ts` (new)
- **Dependencies**: Task 2
- **Action**: Extract observation ops and preference ops into focused modules.
- **Test**: `tests/memory/repository.test.ts` — repository still works
- **Verification**: `wc -l src/memory/repository.ts` < 350
- **Worktree**: Yes (same)

### Task 4: Split observability/context-monitor.ts (350+ → ~200 LOC)
- **Files**: `src/observability/context-monitor.ts` (modify), `src/observability/token-tracker.ts` (new), `src/observability/budget-calculator.ts` (new)
- **Dependencies**: Task 3
- **Action**: Extract token tracking and budget calculation.
- **Test**: `tests/observability/context-monitor.test.ts` — monitor still works
- **Verification**: `wc -l src/observability/context-monitor.ts` < 250
- **Worktree**: Yes (same)

### Task 5: Split orchestrator/handlers/build.ts (454 → ~300 LOC)
- **Files**: `src/orchestrator/handlers/build.ts` (modify), `src/orchestrator/handlers/build-task-prompt.ts` (new), `src/orchestrator/handlers/build-result-processor.ts` (new)
- **Dependencies**: Task 4
- **Action**: Extract task prompt building and result processing.
- **Test**: `tests/orchestrator/handlers/build.test.ts` — build still works
- **Verification**: `wc -l src/orchestrator/handlers/build.ts` < 350
- **Worktree**: Yes (same)

### Task 6: Flatten config imports
- **Files**: `src/index.ts` (modify), `src/config/index.ts` (new)
- **Dependencies**: Tasks 1-5
- **Action**: Create barrel export for config modules. Update index imports.
- **Test**: `tests/index.test.ts` — plugin still loads
- **Verification**: Clean imports, no circular dependencies

---

## Plan 27-02: Flatten Config Chain (6 tasks)

### Task 7: Create config/index.ts barrel
- **Files**: `src/config/index.ts` (new)
- **Dependencies**: Task 6
- **Action**: Export all config modules: schema, migrations, types, defaults.
- **Test**: `src/config/index.ts` imports cleanly
- **Verification**: Single import path for all config needs

### Task 8: Lazy-load migrations
- **Files**: `src/config/migrations.ts` (modify)
- **Dependencies**: Task 7
- **Action**: Dynamically import migrations only when needed. Don't bundle v1-v5 for new users.
- **Test**: New users don't load v1-v5 code
- **Verification**: Bundle size reduced

### Task 9: Add v6→v7 stub
- **Files**: `src/config/v6-to-v7.ts` (new), `src/config/migrations.ts` (modify)
- **Dependencies**: Task 8
- **Action**: Create v6→v7 migration stub (no-op). Foundation for v7 config.
- **Test**: v6 config auto-migrates to v7
- **Verification**: Round-trip: save v6 → load → verify v7 fields present

### Task 10: Document config structure
- **Files**: `docs/config-structure.md` (new)
- **Dependencies**: Task 9
- **Action**: Document v7 config schema, all sections, migration path.
- **Test**: Asset linter passes
- **Verification**: Documentation matches code

### Task 11: Add config doctor checks
- **Files**: `src/health/checks.ts` (modify)
- **Dependencies**: Task 10
- **Action**: Add checks: v7 migration successful, no stale migration state, config valid.
- **Test**: `tests/health/checks.test.ts` — new checks work
- **Verification**: `oc_doctor` reports config health

### Task 12: Config validation tests
- **Files**: `tests/config/validation.test.ts` (new)
- **Dependencies**: Task 11
- **Action**: Test all config validation paths: missing sections, invalid values, migration failures.
- **Test**: Self-contained test file
- **Verification**: `bun test tests/config/validation.test.ts` passes

---

## Plan 27-03: Extract Utilities (6 tasks)

### Task 13: Extract file utilities
- **Files**: `src/utils/fs-helpers.ts` (modify), `src/utils/file-ops.ts` (new)
- **Dependencies**: None
- **Action**: Extract common file operations: ensureDir, copyIfMissing, isEnoentError.
- **Test**: `tests/utils/file-ops.test.ts`
- **Verification**: All existing tests still pass

### Task 14: Extract path utilities
- **Files**: `src/utils/paths.ts` (modify), `src/utils/path-helpers.ts` (new)
- **Dependencies**: Task 13
- **Action**: Extract path operations: getGlobalConfigDir, getAssetsDir, joinPaths.
- **Test**: `tests/utils/path-helpers.test.ts`
- **Verification**: Path utilities work cross-platform

### Task 15: Extract string utilities
- **Files**: `src/utils/strings.ts` (new)
- **Dependencies**: None
- **Action**: Extract common string ops: truncate, hash, camelCase, etc.
- **Test**: `tests/utils/strings.test.ts`
- **Verification**: String utilities well-tested

### Task 16: Extract validation utilities
- **Files**: `src/utils/validators.ts` (modify), `src/utils/schemas.ts` (new)
- **Dependencies**: Task 15
- **Action**: Extract common validation patterns into reusable schemas.
- **Test**: `tests/utils/schemas.test.ts`
- **Verification**: Validation utilities reusable

### Task 17: Update all imports
- **Files**: `src/**/*.ts` (multiple)
- **Dependencies**: Tasks 13-16
- **Action**: Update imports to use new utility modules.
- **Test**: All tests still pass
- **Verification**: `bun run lint` clean

### Task 18: Architecture tests
- **Files**: `tests/architecture/loc-limits.test.ts` (new)
- **Dependencies**: Task 17
- **Action**: Test that all files stay under 300 LOC. Fail if any exceed.
- **Test**: `bun test tests/architecture/loc-limits.test.ts`
- **Verification**: Architecture constraint enforced

---

## Success Criteria

- [ ] All god files split to <300 LOC
- [ ] Config v6→v7 stub ready
- [ ] All tests pass
- [ ] `bun run lint` clean
- [ ] Architecture tests enforce LOC limits
- [ ] Documentation updated