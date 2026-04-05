# Phase 31: Logging Foundation

**Goal**: Structured logging system for all subsystems
**Depends on**: Phase 30 (UX Visibility)
**Effort**: 2 plans, 12 tasks, ~2 days
**Risk**: LOW — Logging is additive, no behavioral changes
**PR Increment**: Structured logger usable by all subsystems, existing forensic logs still work

---

## Plan 31-01: Structured Logger (6 tasks)

### Task 1: Logger interface and types
- **Files**: `src/logging/logger.ts` (new), `src/logging/types.ts` (new), `src/logging/index.ts` (new)
- **Dependencies**: Phase 30 complete
- **Action**: Define `Logger` interface: `debug()`, `info()`, `warn()`, `error()`. Each accepts structured metadata: `{ domain, subsystem, operation, ...extra }`.
- **Test**: `tests/logging/logger.test.ts` — all levels write correct structure
- **Verification**: Logger types compile cleanly
- **Worktree**: Yes — `wt/logging`

### Task 2: Forensic log integration
- **Files**: `src/logging/forensic-writer.ts` (new)
- **Dependencies**: Task 1
- **Action**: Logger writes to forensic log (existing format) and in-memory event store.
- **Test**: `tests/logging/forensic-writer.test.ts` — logs written to file
- **Verification**: Forensic log format unchanged (backward compat)

### Task 3: Domain-tagged loggers
- **Files**: `src/logging/domains.ts` (new)
- **Dependencies**: Task 2
- **Action**: Create domain-specific loggers: `memory`, `orchestrator`, `observability`, `review`, `tools`.
- **Test**: `tests/logging/domains.test.ts` — each domain logs correctly
- **Verification**: Subsystems use domain-tagged loggers

### Task 4: Log rotation and retention
- **Files**: `src/logging/rotation.ts` (new)
- **Dependencies**: Task 3
- **Action**: Max log size, time-based rotation, compressed archive.
- **Test**: `tests/logging/rotation.test.ts` — old logs compressed
- **Verification**: Retention policy enforced

### Task 5: Log query tool enhancement
- **Files**: `src/tools/logs.ts` (modify)
- **Dependencies**: Task 4
- **Action**: Add filters: by domain, by subsystem, by severity, by time range. Structured JSON output.
- **Test**: `tests/tools/logs.test.ts` — filter combinations work
- **Verification**: `oc_logs domain:memory severity:error` works

### Task 6: Performance metrics logging
- **Files**: `src/logging/performance.ts` (new)
- **Dependencies**: Task 5
- **Action**: Log phase duration, agent response times, memory usage.
- **Test**: `tests/logging/performance.test.ts` — metrics logged
- **Verification**: Performance metrics available

---

## Plan 31-02: Subsystem Migration (6 tasks)

### Task 7: Migrate observability to structured logger
- **Files**: `src/observability/event-handlers.ts` (modify), `src/observability/log-writer.ts` (modify)
- **Dependencies**: Tasks 1-6
- **Action**: Replace direct forensic log calls with `logger.info()` / `logger.error()`.
- **Test**: Existing observability tests still pass
- **Verification**: Observability uses structured logger

### Task 8: Migrate memory subsystem
- **Files**: `src/memory/capture.ts` (modify), `src/memory/injector.ts` (modify), `src/memory/retrieval.ts` (modify), `src/memory/repository.ts` (modify)
- **Dependencies**: Task 7
- **Action**: Replace silent `catch {}` blocks with `logger.warn()`. Best-effort semantics preserved.
- **Test**: Existing memory tests still pass
- **Verification**: Previously silent failures now logged

### Task 9: Migrate orchestrator
- **Files**: `src/orchestrator/handlers/*.ts` (modify), `src/orchestrator/fallback/*.ts` (modify)
- **Dependencies**: Task 8
- **Action**: Replace orchestration-logger calls with structured logger.
- **Test**: Existing orchestrator tests still pass
- **Verification**: All phase transitions logged with metadata

### Task 10: Migrate review subsystem
- **Files**: `src/review/*.ts` (modify)
- **Dependencies**: Task 9
- **Action**: Replace console.log with structured logger. Log review start, complete, errors.
- **Test**: Existing review tests still pass
- **Verification**: Review logs structured

### Task 11: Migrate tools
- **Files**: `src/tools/*.ts` (modify)
- **Dependencies**: Task 10
- **Action**: Replace console.log with structured logger in all tools.
- **Test**: Existing tool tests still pass
- **Verification**: Tool logs structured

### Task 12: Logging integration test
- **Files**: `tests/integration/logging.test.ts` (new)
- **Dependencies**: Tasks 7-11
- **Action**: Run full pipeline. Verify all subsystems log to structured format.
- **Test**: Self-contained integration test
- **Verification**: All logs have proper structure

---

## Success Criteria

- [ ] Structured logger with domain tagging
- [ ] All subsystems migrated
- [ ] Log rotation and retention working
- [ ] `oc_logs` with filters working
- [ ] Performance metrics logged
- [ ] Forensic log format unchanged (backward compat)
- [ ] All tests pass