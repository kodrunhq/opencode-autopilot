# Autopilot Implementation Plan

Date: 2026-04-04

Related documents:
- `research/2026-04-04-gloomberg-autopilot-investigation-report.md`
- `research/2026-04-04-autopilot-redesign-and-implementation-backlog.md`

Goal:
- convert the redesign direction into a sequenced implementation plan
- keep execution disciplined
- prevent the team from patching symptoms while leaving the control plane ambiguous

## Goal

When this plan is complete, the plugin will have:

- a deterministic orchestrator control plane for active runs
- one authoritative persistence model for active-run state and events
- incident-grade observability that explains failures without manual log archeology
- a clear product boundary around memory, CLI, and advanced features
- no aspirational parallel build claims without real isolation and reconciliation

## Scope Boundaries

This plan covers:

- orchestrator control-plane correctness
- active-run persistence redesign
- observability redesign
- memory scope decision
- CLI/config simplification
- conditional worktree and hashline work

This plan does not assume:

- that every current feature must survive
- that parallel `BUILD` must return
- that rich memory must remain a core feature
- that a new language/runtime is required

## Relevant Existing Modules

### Control plane

- `src/tools/orchestrate.ts`
- `src/orchestrator/handlers/build.ts`
- `src/orchestrator/contracts/result-envelope.ts`
- `src/orchestrator/contracts/legacy-result-adapter.ts`
- `src/orchestrator/contracts/invariants.ts`
- `src/orchestrator/state.ts`
- `src/orchestrator/phase.ts`
- `src/orchestrator/replay.ts`
- `src/orchestrator/types.ts`
- `src/orchestrator/schemas.ts`

### Agent / prompt contract

- `src/agents/autopilot.ts`
- `src/agents/pipeline/oc-implementer.ts`

### Observability / logs / forensics

- `src/index.ts`
- `src/observability/event-store.ts`
- `src/observability/event-handlers.ts`
- `src/observability/log-writer.ts`
- `src/observability/session-logger.ts`
- `src/observability/log-reader.ts`
- `src/observability/schemas.ts`
- `src/observability/types.ts`
- `src/tools/logs.ts`
- `src/tools/pipeline-report.ts`
- `src/tools/session-stats.ts`
- `src/tools/forensics.ts`

### Memory

- `src/memory/database.ts`
- `src/memory/capture.ts`
- `src/memory/injector.ts`
- `src/memory/retrieval.ts`
- `src/memory/repository.ts`
- `src/tools/memory-status.ts`
- `src/orchestrator/lesson-memory.ts`
- `src/orchestrator/lesson-injection.ts`

### Review

- `src/tools/review.ts`
- `src/review/pipeline.ts`
- `src/review/memory.ts`

### CLI / configuration

- `bin/cli.ts`
- `bin/configure-tui.ts`
- `src/config.ts`
- `src/tools/configure.ts`
- `src/tools/doctor.ts`

## Relevant Existing Tests

### Orchestrator / build / state

- `tests/tools/orchestrate.test.ts`
- `tests/orchestrate-pipeline.test.ts`
- `tests/handlers-late.test.ts`
- `tests/handlers-early.test.ts`
- `tests/orchestrator/deterministic-replay.test.ts`
- `tests/orchestrator/result-envelope.test.ts`
- `tests/orchestrator/phase.test.ts`
- `tests/tools/phase.test.ts`
- `tests/orchestrator/state.test.ts`
- `tests/tools/state.test.ts`
- `tests/orchestrator/forensics.test.ts`

### Observability

- `tests/observability/event-handlers.test.ts`
- `tests/observability/log-writer.test.ts`
- `tests/observability/log-reader.test.ts`
- `tests/observability/session-logger.test.ts`
- `tests/tools/logs.test.ts`
- `tests/tools/pipeline-report.test.ts`
- `tests/tools/session-stats.test.ts`

### Memory

- `tests/memory/capture.test.ts`
- `tests/memory/database.test.ts`
- `tests/memory/retrieval.test.ts`
- `tests/memory/injector.test.ts`
- `tests/tools/memory-status.test.ts`
- `tests/orchestrator/lesson-memory.test.ts`
- `tests/integration/cross-feature.test.ts`

### CLI / config

- `tests/cli/cli.test.ts`
- `tests/config.test.ts`
- `tests/integration/config-migration.test.ts`

## Delivery Principles

1. No feature work should precede control-plane stabilization.
2. Every phase must leave the codebase in a shippable, testable state.
3. New persistence layers must be introduced behind compatibility boundaries, then old paths must
   be removed quickly.
4. Best-effort behavior is acceptable for optional enrichment, not for run correctness.
5. If a subsystem cannot justify itself against complexity, simplify or remove it.

## Guiding Decision

Implementation should follow this strategic direction:

1. Stabilize the current control plane immediately.
2. Move toward a SQLite-first local kernel for active-run state and events.
3. Use Thin Autopilot discipline while migrating: fewer features, stronger invariants.
4. Do not re-enable parallel `BUILD` until isolation and deterministic reconciliation are real.

## Phase 0: Safety Freeze

Objective:
- stop unsafe behavior before structural work begins

Tasks:

1. Disable parallel `BUILD`
   - What: force `BUILD` to dispatch one implementer task at a time
   - Files:
     - `src/orchestrator/handlers/build.ts`
     - `tests/handlers-late.test.ts`
     - `tests/orchestrate-pipeline.test.ts`
     - `tests/orchestrator/deterministic-replay.test.ts`
   - Depends on: none
   - Verify:
     - `bun test tests/handlers-late.test.ts -t "handleBuild"`
     - `bun test tests/orchestrate-pipeline.test.ts`
   - Done when:
     - `BUILD` no longer returns `dispatch_multi` for production task execution
     - pending implementer dispatches never exceed one during normal build flow

2. Remove fake waiting dispatches
   - What: replace "wait" implementer dispatches with deterministic status/no-op behavior
   - Files:
     - `src/orchestrator/handlers/build.ts`
     - `src/tools/orchestrate.ts`
     - `tests/handlers-late.test.ts`
     - `tests/tools/orchestrate.test.ts`
   - Depends on: task 1
   - Verify:
     - `bun test tests/handlers-late.test.ts -t "wait"`
     - `bun test tests/tools/orchestrate.test.ts`
   - Done when:
     - no code path dispatches `oc-implementer` just to wait or poll
     - waiting/resume behavior does not create new pending task work

3. Reject legacy results for pipeline dispatches
   - What: treat legacy result parsing as unsupported for active pipeline agent results
   - Files:
     - `src/tools/orchestrate.ts`
     - `src/orchestrator/contracts/legacy-result-adapter.ts`
     - `src/agents/autopilot.ts`
     - `tests/tools/orchestrate.test.ts`
     - `tests/orchestrate-pipeline.test.ts`
   - Depends on: none
   - Verify:
     - `bun test tests/tools/orchestrate.test.ts`
     - `bun test tests/orchestrate-pipeline.test.ts`
   - Done when:
     - orchestrated pipeline agents cannot advance a run with legacy/raw result strings
     - errors explicitly instruct callers to send typed envelopes

4. Add a regression fixture for the `gloomberg` failure mode
   - What: encode the exact multi-dispatch attribution failure as a named test scenario
   - Files:
     - `tests/tools/orchestrate.test.ts`
     - optionally new file `tests/orchestrator/build-regressions.test.ts`
   - Depends on: tasks 1-3
   - Verify:
     - `bun test tests/tools/orchestrate.test.ts`
   - Done when:
     - the exact historical failure has a stable test name and expected deterministic outcome

Exit criteria:
- the `gloomberg` failure mode is impossible under the shipped build path
- the repo has an explicit regression test for that failure mode

## Phase 1: Protocol Hardening

Objective:
- make the orchestrator protocol explicit and machine-enforced

Tasks:

1. Redesign dispatch/result envelope contract
   - What: require typed envelopes for all orchestrated agent results
   - Files:
     - `src/agents/autopilot.ts`
     - `src/tools/orchestrate.ts`
     - `src/orchestrator/contracts/result-envelope.ts`
     - `src/orchestrator/types.ts`
     - `tests/tools/orchestrate.test.ts`
   - Depends on: Phase 0 complete
   - Verify:
     - `bun test tests/tools/orchestrate.test.ts`
     - `bun test tests/orchestrate-pipeline.test.ts`
   - Done when:
     - autopilot prompt instructions and orchestrator input contract are aligned
     - typed envelope fields are documented in code and enforced in tests

2. Validate result `kind` against pending expected kind
   - What: reject mismatched typed results before mutating state
   - Files:
     - `src/tools/orchestrate.ts`
     - `src/orchestrator/contracts/result-envelope.ts`
     - `tests/orchestrator/result-envelope.test.ts`
     - `tests/tools/orchestrate.test.ts`
   - Depends on: task 1
   - Verify:
     - `bun test tests/orchestrator/result-envelope.test.ts`
     - `bun test tests/tools/orchestrate.test.ts`
   - Done when:
     - mismatched `kind` values are rejected with a deterministic error code

3. Add protocol-focused regression tests
   - What: add end-to-end tests for raw vs typed, stale results, duplicate results, out-of-order typed task results
   - Files:
     - `tests/tools/orchestrate.test.ts`
     - `tests/orchestrator/deterministic-replay.test.ts`
     - `tests/handlers-late.test.ts`
     - optionally new `tests/orchestrator/protocol.test.ts`
   - Depends on: tasks 1-2
   - Verify:
     - `bun test tests/tools/orchestrate.test.ts`
     - `bun test tests/orchestrator/deterministic-replay.test.ts`
   - Done when:
     - protocol failures and success cases are covered by direct tests

4. Remove pipeline dependence on the legacy adapter
   - What: keep legacy parsing only as an explicit migration utility or remove it entirely from active run flow
   - Files:
     - `src/orchestrator/contracts/legacy-result-adapter.ts`
     - `src/tools/orchestrate.ts`
     - `src/tools/doctor.ts`
     - docs/tests affected by legacy warnings
   - Depends on: tasks 1-3
   - Verify:
     - `bun test tests/tools/doctor.test.ts`
     - `bun test tests/tools/orchestrate.test.ts`
   - Done when:
     - legacy result parser warnings are no longer part of normal pipeline execution

Exit criteria:
- pipeline results are no longer best-effort strings but a real protocol
- legacy parsing is not part of the normal active-run path

## Phase 2: Atomic State Transitions

Objective:
- eliminate silent overwrite races and weak transition semantics

Tasks:

1. Make result application revision-guarded
   - What: require compare-and-swap semantics on every read-modify-write path
   - Files:
     - `src/tools/orchestrate.ts`
     - `src/orchestrator/state.ts`
     - `tests/orchestrator/state.test.ts`
     - `tests/orchestrator/deterministic-replay.test.ts`
   - Depends on: Phase 1 complete
   - Verify:
     - `bun test tests/orchestrator/state.test.ts`
     - `bun test tests/orchestrator/deterministic-replay.test.ts`
   - Done when:
     - concurrent or duplicated result applications cannot silently overwrite newer state

2. Move phase completion to the same revisioned update path
   - What: stop bypassing `patchState()` semantics
   - Files:
     - `src/orchestrator/phase.ts`
     - `src/tools/orchestrate.ts`
     - `src/tools/phase.ts`
     - `tests/orchestrator/phase.test.ts`
     - `tests/tools/phase.test.ts`
   - Depends on: task 1
   - Verify:
     - `bun test tests/orchestrator/phase.test.ts`
     - `bun test tests/tools/phase.test.ts`
   - Done when:
     - phase completion increments revision and uses the same mutation discipline as other state changes

3. Define pending-dispatch cleanup rules
   - What: clear or explicitly scope pending dispatches across phase boundaries
   - Files:
     - `src/tools/orchestrate.ts`
     - `src/orchestrator/contracts/invariants.ts`
     - `src/orchestrator/types.ts`
     - `tests/orchestrator/invariants.test.ts`
     - `tests/orchestrate-pipeline.test.ts`
   - Depends on: tasks 1-2
   - Verify:
     - `bun test tests/orchestrator/invariants.test.ts`
     - `bun test tests/orchestrate-pipeline.test.ts`
   - Done when:
     - phase boundaries have explicit pending-dispatch semantics enforced by tests

4. Strengthen failure metadata capture in control-plane errors
   - What: ensure every fatal control-plane failure records deterministic failure context and recent error codes
   - Files:
     - `src/tools/orchestrate.ts`
     - `src/tools/forensics.ts`
     - `tests/orchestrator/forensics.test.ts`
   - Depends on: tasks 1-3
   - Verify:
     - `bun test tests/orchestrator/forensics.test.ts`
   - Done when:
     - failed runs reliably expose actionable deterministic recovery metadata

Exit criteria:
- active-run state transitions are atomic and invariant-driven
- failed runs preserve enough control-plane metadata for deterministic diagnosis

## Phase 3: Observability Reset

Objective:
- make failures explainable without manual archeology

Tasks:

1. Define a minimal forensic event schema
   - What: include run ID, project, phase, dispatch, task, session lineage, event type, code, and payload
   - Files:
     - new `src/observability/forensic-types.ts` or similar
     - new `src/observability/forensic-schemas.ts` or similar
     - `src/observability/types.ts`
     - `src/observability/schemas.ts`
     - `tests/observability/*` as needed
   - Depends on: Phase 2 complete
   - Verify:
     - `bun test tests/observability/log-writer.test.ts`
     - `bun test tests/observability/log-reader.test.ts`
   - Done when:
     - there is one explicit schema for durable run/event forensics

2. Persist the right events, not just the currently convenient ones
   - What: stop dropping critical runtime signals before disk
   - Files:
     - `src/index.ts`
     - `src/observability/event-store.ts`
     - `src/observability/event-handlers.ts`
     - `src/observability/log-writer.ts`
     - `src/observability/session-logger.ts`
     - `tests/observability/event-handlers.test.ts`
     - `tests/observability/log-writer.test.ts`
     - `tests/observability/session-logger.test.ts`
   - Depends on: task 1
   - Verify:
     - `bun test tests/observability/event-handlers.test.ts`
     - `bun test tests/observability/log-writer.test.ts`
     - `bun test tests/observability/session-logger.test.ts`
   - Done when:
     - durable logs include the critical control-plane events needed for incident diagnosis

3. Simplify log surface around forensics
   - What: adjust `oc_logs` and `oc_pipeline_report` to operate on forensic truth, not weak summaries
   - Files:
     - `src/tools/logs.ts`
     - `src/tools/pipeline-report.ts`
     - `src/tools/session-stats.ts`
     - `src/tools/forensics.ts`
     - `src/observability/log-reader.ts`
     - `src/observability/summary-generator.ts`
     - `tests/tools/logs.test.ts`
     - `tests/tools/pipeline-report.test.ts`
     - `tests/tools/session-stats.test.ts`
     - `tests/orchestrator/forensics.test.ts`
   - Depends on: task 2
   - Verify:
     - `bun test tests/tools/logs.test.ts`
     - `bun test tests/tools/pipeline-report.test.ts`
     - `bun test tests/tools/session-stats.test.ts`
     - `bun test tests/orchestrator/forensics.test.ts`
   - Done when:
     - one failed run can be reconstructed from tool output alone without opening raw files manually

4. Remove split-brain logging design
   - What: converge snapshot JSON vs JSONL session logging into one coherent durable model
   - Files:
     - `src/observability/log-writer.ts`
     - `src/observability/session-logger.ts`
     - `src/observability/log-reader.ts`
     - `src/observability/retention.ts`
     - tests in `tests/observability/`
   - Depends on: tasks 1-3
   - Verify:
     - `bun test tests/observability`
   - Done when:
     - the codebase has one clear durable logging approach for session/run evidence

Exit criteria:
- a failed run is debuggable from durable plugin-generated evidence
- log persistence model is conceptually unified

## Phase 4: Persistence Redesign

Objective:
- replace fragmented active-run persistence with a SQLite-first local kernel

Tasks:

1. Design kernel schema
   - What: model runs, phases, tasks, dispatches, results, review state, and events in SQLite
   - Files:
     - new `src/kernel/` or `src/runtime-store/` directory
     - proposed starting files:
       - `src/kernel/database.ts`
       - `src/kernel/schema.ts`
       - `src/kernel/repository.ts`
       - `src/kernel/types.ts`
       - `src/kernel/migrations.ts`
     - new test files under `tests/kernel/`
   - Depends on: Phase 3 complete
   - Verify:
     - `bun test tests/kernel`
   - Done when:
     - schema supports active-run and event queries without fallback to JSON state

2. Migrate orchestrator state into kernel
   - What: stop using `state.json` as the primary active-run store
   - Files:
     - `src/orchestrator/state.ts`
     - `src/tools/orchestrate.ts`
     - `src/tools/state.ts`
     - `src/tools/plan.ts`
     - `src/tools/phase.ts`
     - tests touching state consumers
   - Depends on: task 1
   - Verify:
     - `bun test tests/orchestrator/state.test.ts`
     - `bun test tests/tools/state.test.ts`
     - `bun test tests/tools/phase.test.ts`
     - `bun test tests/tools/orchestrate.test.ts`
   - Done when:
     - active runs survive restart from kernel persistence alone

3. Migrate orchestration log into kernel-backed event storage
   - What: retire `orchestration.jsonl` as primary truth
   - Files:
     - `src/orchestrator/orchestration-logger.ts`
     - `src/tools/forensics.ts`
     - `src/tools/logs.ts`
     - `src/tools/pipeline-report.ts`
     - `src/tools/session-stats.ts`
     - kernel event repository files from task 1
   - Depends on: tasks 1-2
   - Verify:
     - `bun test tests/orchestrator/forensics.test.ts`
     - `bun test tests/tools/logs.test.ts`
   - Done when:
     - event consumers read from the kernel-backed event store rather than raw orchestration JSONL

4. Migrate review/lesson persistence or explicitly leave them outside the kernel with a strong reason
   - What: avoid ad hoc JSON sprawl
   - Files:
     - `src/review/memory.ts`
     - `src/orchestrator/lesson-memory.ts`
     - `src/orchestrator/lesson-injection.ts`
     - optionally kernel modules if moved
     - `tests/review/memory.test.ts`
     - `tests/orchestrator/lesson-memory.test.ts`
   - Depends on: task 1
   - Verify:
     - `bun test tests/review/memory.test.ts`
     - `bun test tests/orchestrator/lesson-memory.test.ts`
   - Done when:
     - every remaining persistence surface has an explicit architectural reason to exist

5. Remove old JSON truth paths after migration
   - What: delete or demote `state.json` and `orchestration.jsonl` once compatibility window closes
   - Files:
     - `src/orchestrator/state.ts`
     - `src/orchestrator/orchestration-logger.ts`
     - tools/docs/tests still assuming JSON artifacts
   - Depends on: tasks 1-4
   - Verify:
     - full test suite and migration tests pass
   - Done when:
     - there is no ambiguity about whether JSON files or SQLite are authoritative

Exit criteria:
- one storage engine is authoritative for active runs and their events
- JSON artifact sprawl is eliminated or explicitly limited to non-authoritative exports

## Phase 5: Memory Scope Decision

Objective:
- stop carrying an ambiguous memory system

Decision checkpoint:
- choose one of two paths

Path A: lessons only
- keep explicit retrospective lessons
- remove rich memory capture/injection for now

Path B: real local knowledge store
- keep SQLite memory
- redesign capture sources and retrieval semantics
- make session handling concurrency-safe

Recommended initial move:
- take Path A unless strong evidence shows Path B materially improves outcomes

Tasks if Path A:

1. Remove adaptive memory injection from core flow
   - Files:
     - `src/index.ts`
     - `src/memory/injector.ts`
     - `src/memory/index.ts`
     - tests in `tests/memory/` and `tests/integration/cross-feature.test.ts`
   - Verify:
     - `bun test tests/memory`
     - `bun test tests/integration/cross-feature.test.ts`
2. Keep or improve lesson extraction and injection only
   - Files:
     - `src/orchestrator/lesson-memory.ts`
     - `src/orchestrator/lesson-injection.ts`
     - `tests/orchestrator/lesson-memory.test.ts`
   - Verify:
     - `bun test tests/orchestrator/lesson-memory.test.ts`
3. Remove dead preference/memory code paths
   - Files:
     - `src/memory/repository.ts`
     - `src/memory/retrieval.ts`
     - `src/tools/memory-status.ts`
     - docs/tests affected
   - Verify:
     - `bun test tests/tools/memory-status.test.ts`

Tasks if Path B:

1. Replace global mutable session tracking in `memory/capture.ts`
   - Files:
     - `src/memory/capture.ts`
     - `tests/memory/capture.test.ts`
2. Capture orchestrator decisions directly from control-plane events
   - Files:
     - `src/index.ts`
     - `src/memory/capture.ts`
     - `src/observability/*` or kernel event consumer layer
3. Refresh memory injection during long sessions
   - Files:
     - `src/memory/injector.ts`
     - `tests/memory/injector.test.ts`
4. Add transaction rollback and lock handling
   - Files:
     - `src/memory/retrieval.ts`
     - `src/memory/database.ts`
     - `tests/memory/retrieval.test.ts`
     - `tests/memory/database.test.ts`
5. Add concurrency and live-session integration tests
   - Files:
     - `tests/memory/*`
     - `tests/integration/cross-feature.test.ts`

Decision gate:
- before starting Path B, produce evidence that rich memory improves build/review outcomes enough
  to justify its complexity

Exit criteria:
- memory has a clear contract and measurable value
- there is no ambiguous hybrid between observability, prompt injection, and lessons

## Phase 6: Product Surface Simplification

Objective:
- reduce support burden and configuration ambiguity

Tasks:

1. Audit current config schema and deprecate low-value knobs
   - Files: `src/config.ts`, `src/tools/configure.ts`, `bin/cli.ts`, docs
   - Depends on: Phase 4 complete, Phase 5 decision made
   - Verify:
     - `bun test tests/config.test.ts`
     - `bun test tests/integration/config-migration.test.ts`
   - Done when:
     - config reflects the actual product, not every historical experiment

2. Decide whether to introduce operational profiles
   - Example profiles: `fast`, `balanced`, `max-safety`
   - Files:
     - `src/config.ts`
     - `src/tools/configure.ts`
     - `bin/cli.ts`
     - `README.md`
     - configure/doctor tests as needed
   - Depends on: task 1
   - Verify:
     - `bun test tests/cli/cli.test.ts`
     - `bun test tests/config.test.ts`
   - Done when:
     - user-facing setup path is simpler and harder to misconfigure

3. Keep CLI focused
   - Scope: install, configure, doctor
   - Avoid turning CLI into a second orchestration control plane
   - Files:
     - `bin/cli.ts`
     - `README.md`
     - CLI tests/docs
   - Depends on: tasks 1-2
   - Verify:
     - `bun test tests/cli/cli.test.ts`
   - Done when:
     - CLI has a clearly bounded role and docs reflect that role

Exit criteria:
- user-facing surface area is smaller and clearer
- config and CLI no longer imply capabilities the core does not yet reliably support

## Phase 7: Conditional Reintroduction of Advanced Features

Objective:
- only restore advanced behavior if it is real, not aspirational

### Worktrees and parallel `BUILD`

Only start this phase if parallel build is still a product requirement.

Decision gate:
- before implementation, explicitly decide yes/no on whether parallel `BUILD` is required for the
  product vision

Tasks:

1. Implement runtime worktree manager
   - Files:
     - new `src/worktrees/` or `src/orchestrator/worktrees/` modules
     - likely files:
       - `manager.ts`
       - `naming.ts`
       - `lifecycle.ts`
       - `types.ts`
     - new tests under `tests/worktrees/`
2. Bind each task to one branch and one worktree deterministically
   - Files:
     - `src/orchestrator/handlers/build.ts`
     - new persistence fields in kernel or orchestrator types
     - tests in orchestrator/worktree suites
3. Define cleanup lifecycle
   - Files:
     - worktree manager modules
     - likely `src/tools/doctor.ts` if health checks need worktree awareness
4. Define aggregation/review strategy before branch-scope review
   - Files:
     - `src/tools/review.ts`
     - `src/orchestrator/handlers/build.ts`
     - possibly new aggregation helper modules
5. Add end-to-end worktree tests
   - Files:
     - new `tests/worktrees/*.test.ts`
     - possibly `tests/integration/*.test.ts`

Verify:
- targeted worktree tests
- full orchestration/build integration tests

Exit criteria:
- parallel `BUILD` is isolated, attributable, and reviewable
- product docs only mention parallel build once this phase is real

### Hashline workflow completion

Tasks:

1. Add initial anchor-generation path
   - Files:
     - new `src/tools/hashline-read.ts` or equivalent
     - `src/tools/hashline-edit.ts`
     - `src/index.ts`
     - new tests under `tests/tools/`
2. Define new-file creation behavior
   - Files:
     - `src/tools/hashline-edit.ts`
     - tests
3. Add observability for hashline usage
   - Files:
     - `src/index.ts`
     - observability modules or kernel event ingestion
     - tests
4. Add end-to-end autonomous editing tests
   - Files:
     - new tests under `tests/tools/` and `tests/integration/`

Decision gate:
- only do this if hashline editing remains a core product claim rather than a nice-to-have tool

Exit criteria:
- `oc_hashline_edit` is a complete workflow, not just a standalone edit primitive

## Suggested Milestones

## Milestone 1: Build No Longer Lies

Includes:
- sequential `BUILD`
- typed result protocol
- no fake waiting dispatches
- atomic result application

Primary files:
- `src/orchestrator/handlers/build.ts`
- `src/tools/orchestrate.ts`
- `src/agents/autopilot.ts`
- `src/orchestrator/state.ts`
- `src/orchestrator/phase.ts`

Definition of done:
- the exact `gloomberg` failure class is closed by tests

## Milestone 2: Forensics We Can Trust

Includes:
- minimal forensic event schema
- durable event persistence
- useful `oc_logs` and `oc_pipeline_report`

Primary files:
- `src/index.ts`
- `src/observability/*`
- `src/tools/logs.ts`
- `src/tools/pipeline-report.ts`
- `src/tools/session-stats.ts`
- `src/tools/forensics.ts`

Definition of done:
- one failed run can be diagnosed from plugin-generated evidence alone

## Milestone 3: One Source of Truth

Includes:
- SQLite-first active-run kernel
- reduced JSON sprawl

Primary files:
- new `src/kernel/*`
- `src/orchestrator/state.ts`
- `src/tools/orchestrate.ts`
- state/log consumer tools

Definition of done:
- active orchestration no longer depends on fragmented persistence

## Milestone 4: Product Simplified

Includes:
- memory scope decision
- config simplification
- CLI scope discipline

Primary files:
- `src/memory/*` or lesson-only equivalents
- `src/config.ts`
- `src/tools/configure.ts`
- `bin/cli.ts`
- `README.md`

Definition of done:
- the product has a clearer core and fewer ambiguous features

## Milestone 5: Advanced Features, If Earned

Includes:
- real worktrees
- possibly restored parallel `BUILD`
- completed hashline workflow

Primary files:
- new worktree modules
- `src/orchestrator/handlers/build.ts`
- `src/tools/review.ts`
- new hashline read path

Definition of done:
- advanced claims are backed by actual runtime behavior

## Risks and Mitigations

## Risk: scope explosion during redesign

Mitigation:
- require each phase to end with a shippable simplification, not just more infrastructure

## Risk: attachment to existing features

Mitigation:
- explicitly classify features as core, optional, deferred, or removed

## Risk: migration churn

Mitigation:
- keep migration layers thin and temporary
- do not support both old and new control-plane paths indefinitely

## Risk: overbuilding the kernel

Mitigation:
- build only what current plugin workflows need
- avoid turning the kernel into a general platform too early

## Risk: reintroducing parallelism too early

Mitigation:
- require worktree lifecycle, attribution, and review integration before enabling it

## Immediate Next Tasks

These are the next concrete tasks I would start with.

1. Remove `BUILD` `dispatch_multi` from active path.
2. Remove fake waiting dispatches from `build.ts`.
3. Make typed envelopes mandatory for orchestrated results.
4. Add regression tests for the `gloomberg` failure mode.
5. Design the minimal forensic event schema.
6. Draft the SQLite kernel schema for active runs and events.

## Suggested Verification Commands by Phase

### Phase 0-2

```bash
bun test tests/handlers-late.test.ts -t "handleBuild"
bun test tests/tools/orchestrate.test.ts
bun test tests/orchestrate-pipeline.test.ts
bun test tests/orchestrator/deterministic-replay.test.ts
bun test tests/orchestrator/state.test.ts
bun test tests/orchestrator/phase.test.ts
bun test tests/orchestrator/forensics.test.ts
```

### Phase 3

```bash
bun test tests/observability
bun test tests/tools/logs.test.ts
bun test tests/tools/pipeline-report.test.ts
bun test tests/tools/session-stats.test.ts
```

### Phase 4+

```bash
bun test
bun run lint
bunx tsc --noEmit
```

## Ownership Notes

This plan is intentionally written so it can be executed incrementally by one engineer or divided
across a small team. If multiple people work in parallel, Phase 0 and Phase 1 should stay tightly
coordinated because they define the protocol and state guarantees that everything else depends on.

## Final Note

The purpose of this plan is not to preserve the current architecture with better duct tape.

The purpose is to recover a trustworthy core, then rebuild upward from there.

The project should not optimize for feature count right now.
It should optimize for confidence.
