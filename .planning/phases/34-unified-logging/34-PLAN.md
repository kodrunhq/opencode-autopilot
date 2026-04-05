# Phase 34: Unified Logging System

**Goal**: Replace ad-hoc console.log/forensic logging with structured logger
**Depends on**: Phase 32 (Config v7)
**Effort**: 2 plans, 6 tasks, ~1.5 days
**Risk**: LOW — Logging is additive, no behavior changes
**PR Increment**: Structured logger usable by all subsystems
**Can run parallel with Phase 33**

---

## Plan 34-01: Structured Logger Core (3 tasks)

### Task 1: Logger interface and implementation
- **Files**: `src/logging/logger.ts` (new), `src/logging/types.ts` (new), `src/logging/index.ts` (new)
- **Dependencies**: Phase 31 (logging foundation types)
- **Action**: Define `Logger` interface with `debug()`, `info()`, `warn()`, `error()`. Implementation writes to forensic log + event store.
- **Test**: `tests/logging/logger.test.ts` — all levels write correct structure
- **Verification**: Logger instances created per-subsystem with domain tag

### Task 2: Log rotation and retention
- **Files**: `src/logging/rotation.ts` (new)
- **Dependencies**: Task 1
- **Action**: Extend retention system. Configurable max log size, time-based rotation, compressed archive.
- **Test**: `tests/logging/rotation.test.ts`
- **Verification**: Old logs compressed, retention enforced

### Task 3: Log query tool enhancement
- **Files**: `src/tools/logs.ts` (modify)
- **Dependencies**: Task 1
- **Action**: Add filters: by domain, by subsystem, by severity, by time range. Structured JSON output.
- **Test**: `tests/tools/logs.test.ts` — filter combinations work
- **Verification**: `oc_logs domain:memory severity:error` returns filtered results

---

## Plan 34-02: Subsystem Migration (3 tasks)

### Task 4: Migrate observability to structured logger
- **Files**: `src/observability/event-handlers.ts` (modify), `src/observability/log-writer.ts` (modify)
- **Dependencies**: Task 1
- **Action**: Replace direct forensic log calls with `logger.info()` / `logger.error()`.
- **Test**: Existing observability tests pass
- **Verification**: Forensic log format unchanged

### Task 5: Migrate memory subsystem to structured logger
- **Files**: `src/memory/capture.ts` (modify), `src/memory/injector.ts` (modify), `src/memory/retrieval.ts` (modify)
- **Dependencies**: Task 1
- **Action**: Replace silent `catch {}` blocks with `logger.warn()`. Best-effort preserved.
- **Test**: Existing memory tests pass
- **Verification**: Previously silent failures now logged

### Task 6: Migrate orchestrator to structured logger
- **Files**: `src/orchestrator/handlers/*.ts` (modify), `src/orchestrator/fallback/*.ts` (modify)
- **Dependencies**: Task 1
- **Action**: Replace orchestration-logger calls with structured logger.
- **Test**: Existing orchestrator tests pass
- **Verification**: All phase transitions logged with metadata

---

## Success Criteria

- [ ] Structured logger interface defined
- [ ] Log rotation working
- [ ] `oc_logs` with filters working
- [ ] All subsystems migrated
- [ ] Forensic logs unchanged (backward compat)
- [ ] All tests pass