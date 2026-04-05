# Phase 32: Configuration v7 + Foundation

**Goal**: Extend config schema to v7 with sections for background agents, category routing, session recovery, and MCP support. Foundation types and interfaces for subsequent phases.
**Depends on**: Phase 31 (Logging Foundation)
**Effort**: 2 plans, 6 tasks, ~1 day
**Risk**: LOW — Pure schema extension, no behavior changes
**PR Increment**: Config v7 migration, new types importable, all features unchanged

---

## Plan 32-01: Config v7 Schema + Migration (4 tasks)

### Task 1: Define v7 schema types
- **Files**: `src/config.ts` (modify), `src/types/background.ts` (new), `src/types/routing.ts` (new), `src/types/recovery.ts` (new), `src/types/mcp.ts` (new)
- **Dependencies**: Phase 31 complete
- **Action**: Add Zod schemas for `background`, `routing`, `recovery`, `mcp` sections. Each with `enabled: boolean + section-specific settings with defaults.
- **Test**: `tests/config.test.ts` — v7 schema validates, defaults populate
- **Verification**: `bun test tests/config.test.ts` passes
- **Worktree**: No — additive types only

### Task 2: v6→v7 migration function
- **Files**: `src/config.ts` (modify)
- **Dependencies**: Task 1
- **Action**: Add `migrateV6toV7()`. Adds `background: { enabled: false, maxConcurrent: 5, persistence: true }`, `routing: { enabled: false, categories: {} }`, `recovery: { enabled: true, maxRetries: 3 }`, `mcp: { enabled: false, skills: {} }`.
- **Test**: `tests/integration/config-migration.test.ts` — v6 config auto-migrates
- **Verification**: Round-trip: save v6 → load → verify v7 fields present

### Task 3: Foundation interfaces for background types
- **Files**: `src/types/background.ts` (modify)
- **Dependencies**: Task 1
- **Action**: Define `BackgroundTask`, `TaskStatus`, `TaskResult`, `AgentSlot`, `ConcurrencyLimits` with Zod schemas.
- **Test**: `tests/types/background.test.ts` — schema validation, freeze semantics
- **Verification**: All types export cleanly

### Task 4: Foundation interfaces for routing + recovery types
- **Files**: `src/types/routing.ts` (modify), `src/types/recovery.ts` (modify)
- **Dependencies**: Task 1
- **Action**: Define `Category`, `CategoryConfig`, `RoutingDecision` for routing. Define `RecoveryStrategy`, `ErrorCategory`, `RecoveryAction` for recovery.
- **Test**: `tests/types/routing.test.ts`, `tests/types/recovery.test.ts`
- **Verification**: All types export cleanly, enums validated

---

## Plan 32-02: Config Doctor + Health Checks (2 tasks)

### Task 5: Extend doctor for v7 config
- **Files**: `src/health/checks.ts` (modify), `src/tools/doctor.ts` (modify)
- **Dependencies**: Tasks 1-2
- **Action**: Add health checks: v7 migration successful, background config valid, routing config valid, recovery config valid.
- **Test**: `tests/health/checks.test.ts` — new checks detect invalid v7 configs
- **Verification**: `oc_doctor` reports v7 config health

### Task 6: Config v7 documentation
- **Files**: `assets/commands/oc-doctor.md` (modify)
- **Dependencies**: Task 5
- **Action**: Update doctor command doc to mention v7 config checks.
- **Test**: Manual — `/oc_doctor` shows new checks
- **Verification**: Asset linter passes

---

## Success Criteria

- [ ] v7 schema validates
- [ ] v6→v7 migration works
- [ ] Foundation types defined
- [ ] Doctor reports v7 health
- [ ] All tests pass