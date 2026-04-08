# Gloomberg Autopilot Investigation Report

Date: 2026-04-04

Investigated repositories:
- Plugin: `/Users/joseibanezortiz/develop/projects/opencode-autopilot`
- Runtime target: `/Users/joseibanezortiz/develop/projects/gloomberg`

Status: forensic report for discussion and implementation planning

## Executive Summary

This investigation found that the current plugin does not deliver a reliable, deterministic,
or debuggable `BUILD` phase under parallel execution.

The main failure in `gloomberg` was not random instability. It was a direct contract mismatch
between how the autopilot agent submits child-agent results and how the orchestrator expects
to attribute those results during `BUILD` multi-dispatch.

In short:

1. `BUILD` launched 7 parallel `oc-implementer` agents.
2. The autopilot agent was instructed to send raw child output back into `oc_orchestrate`.
3. The orchestrator rejects raw or legacy results when more than one pending dispatch exists.
4. Task status therefore never reconciled, even though branches and commits were produced.
5. The build handler then made things worse by creating extra `oc-implementer` dispatches whose
   purpose was only to "wait", increasing attribution ambiguity.

The investigation also found that the surrounding architecture is not ready for safe parallel
build execution:

- There is no runtime worktree implementation in `src/`, despite a `git-worktrees` skill asset
  and several docs claiming worktree-based isolation as a pattern.
- `oc_hashline_edit` exists and is registered, but it is only partially operational in practice:
  it has no companion runtime anchor-generation path, cannot create new files, and is not wired
  into a full end-to-end editing workflow.
- Logging and observability are too weak for incident diagnosis.
- The SQLite memory subsystem is present but did not capture useful `gloomberg` runtime state.
- Parallel state updates are not guarded with optimistic concurrency in the main result path.

The result is a system that can appear autonomous while silently diverging from its own state
machine.

## Severity Summary

| ID | Severity | Confidence | Finding |
|----|----------|------------|---------|
| F1 | Critical | High | `BUILD` multi-dispatch is broken by a raw-result vs typed-envelope contract mismatch |
| F2 | Critical | High | Parallel `BUILD` runs in a shared checkout without runtime worktree isolation |
| F3 | High | High | `BUILD` creates fake extra implementer dispatches just to wait for in-progress tasks |
| F4 | High | High | Result application is not atomic under parallel completions |
| F5 | High | Medium | Phase completion bypasses revision semantics and does not clear stale pending dispatches |
| F6 | High | High | Observability is too sparse to diagnose orchestrator incidents reliably |
| F7 | High | High | SQLite memory is present but effectively non-functional for this workflow |
| F8 | Medium | Medium | Fallback integration contains incomplete handoff logic (`fallbackPending`) |
| F9 | Medium | High | `oc_hashline_edit` is real but only partially usable in live autonomous sessions |
| F10 | Medium | High | Review model is incompatible with multi-branch or multi-worktree parallel `BUILD` |

## Scope and Questions

This investigation focused on the following questions:

1. Are pipeline phases deterministic and idempotent?
2. Are tasks and statuses properly persisted and updated?
3. Did `oc-implementer` agents actually run, and if so, why were results not reconciled?
4. Are logging and forensics good enough to explain failures?
5. Is the SQL memory system working in practice?
6. Are worktrees and hash-based editing actually wired into the runtime architecture?
7. What concrete fixes are required before the plugin should be trusted again on large builds?

## Evidence Reviewed

### Runtime Artifacts in `gloomberg`

- `.opencode-autopilot/state.json`
- `.opencode-autopilot/orchestration.jsonl`
- `.opencode-autopilot/phases/PLAN/tasks.json`
- `.opencode-autopilot/phases/PLAN/task_completion_W1-T01.md`
- `git branch --all`
- `git worktree list`
- `git log --oneline --decorate --graph --all --max-count 40`
- `git status --short --branch`

### Global OpenCode Artifacts on This Machine

- `~/.config/opencode/logs/*.json`
- `~/.config/opencode/memory/memory.db`
- `~/.config/opencode/memory/memory.db-wal`
- `~/.config/opencode/memory/memory.db-shm`

### Plugin Code Paths

- `src/tools/orchestrate.ts`
- `src/orchestrator/handlers/build.ts`
- `src/orchestrator/contracts/legacy-result-adapter.ts`
- `src/orchestrator/contracts/result-envelope.ts`
- `src/orchestrator/state.ts`
- `src/orchestrator/phase.ts`
- `src/agents/autopilot.ts`
- `src/agents/pipeline/oc-implementer.ts`
- `src/tools/review.ts`
- `src/tools/hashline-edit.ts`
- `src/skills/adaptive-injector.ts`
- `src/observability/*`
- `src/memory/*`
- relevant tests under `tests/`

## Reconstructed Timeline of the `gloomberg` Failure

### 1. Early pipeline phases completed under legacy compatibility

`/Users/joseibanezortiz/develop/projects/gloomberg/.opencode-autopilot/orchestration.jsonl`
shows:

- `RECON`, `CHALLENGE`, `ARCHITECT`, and `PLAN` all dispatched and completed.
- Each of those phases logged:

```json
{"action":"error","message":"Legacy result parser path used. Submit typed envelopes for deterministic replay guarantees."}
```

This means the system was already operating through the legacy result adapter before `BUILD`
started. It did not fail immediately because those phases were effectively single-dispatch.

### 2. `BUILD` launched a concurrent wave

At `2026-04-04T13:26:38.626Z`, `orchestration.jsonl` recorded:

```json
{"phase":"BUILD","action":"dispatch_multi","agent":"7 agents","attempt":1}
```

`state.json` confirms 7 pending `oc-implementer` dispatches for wave-1 tasks.

### 3. Result attribution failed repeatedly

The same `orchestration.jsonl` then recorded repeated failures such as:

```json
{"phase":"BUILD","action":"error","message":"E_INVALID_RESULT: Legacy result payload cannot be attributed with multiple pending dispatches. Provide typed envelope with dispatchId[PATH]"}
```

and:

```json
{"phase":"BUILD","action":"error","message":"E_INVALID_RESULT: Invalid input: expected string, received undefined"}
```

This directly matches the orchestrator code path in `src/tools/orchestrate.ts`.

### 4. State remained stuck even while work happened elsewhere

`state.json` remained in:

- `status: "IN_PROGRESS"`
- `currentPhase: "BUILD"`
- tasks `1-7` all `IN_PROGRESS`
- 8 pending dispatches remaining

It also contains a confidence note:

> `Wave 1 tasks have been implemented across multiple branches but orchestrator state not updated`

That confidence entry is effectively the system acknowledging its own drift.

### 5. Repository evidence shows branches and commits were produced anyway

The `gloomberg` repo contained multiple feature branches and remote task branches, including:

- `feature/W1-T02-ml-orm-final`
- `feature/W1-T03-orm-models`
- `feature/W1-T06-backtest-scaffolds`
- `origin/feature/W1-T04-api-schemas`
- `origin/feature/W1-T05-ml-module-scaffolds`
- `origin/feature/W1-T07-frontend-nextjs-init`

`git worktree list` showed only one worktree:

```text
/Users/joseibanezortiz/develop/projects/gloomberg  15990f3 [feature/W1-T03-orm-models]
```

So work was being attempted in a single checkout while the orchestrator believed 7 parallel
task agents were independently progressing.

## Confirmed Root Causes

## F1. `BUILD` Multi-Dispatch Is Broken by a Contract Mismatch

### What the code says

`src/agents/autopilot.ts:12-30` instructs the autopilot agent to:

- call `oc_orchestrate`
- dispatch the requested child agent
- pass that child agent's full output back as the `result`

The key instruction is on `src/agents/autopilot.ts:27`:

> `ALWAYS pass the full agent output back as the result parameter.`

But `src/tools/orchestrate.ts:682-692` explicitly rejects legacy or raw results when more than
one pending dispatch exists:

```ts
if (parsed.legacy && state.pendingDispatches.length > 1) {
  const msg =
    "Legacy result payload cannot be attributed with multiple pending dispatches. Provide typed envelope with dispatchId/taskId.";
  ...
  return asErrorJson(E_INVALID_RESULT, msg);
}
```

The legacy result path comes from `src/orchestrator/contracts/legacy-result-adapter.ts:10-45`,
which wraps raw text into a synthetic typed envelope only when true typed data is absent.

### Why it failed in `gloomberg`

The first 5 phases were able to limp along through the legacy parser because they had a single
active dispatch at a time.

`BUILD` was the first phase that actually needed multi-dispatch attribution. As soon as 7
pending implementer dispatches existed simultaneously, raw child output was no longer enough.

This is the central failure mode of the session.

### Impact

- child work can succeed while orchestrator state remains stuck
- task completion cannot be mapped back to the correct task
- retry loops and follow-up dispatches become ambiguous
- deterministic replay is impossible

### Confidence

High. The runtime logs and the source code agree exactly.

## F2. Parallel `BUILD` Has No Runtime Worktree Isolation

### What was expected

Based on prior design intent and the existence of a `git-worktrees` skill, parallel build agents
should ideally run in isolated worktrees.

### What actually exists

There is no runtime worktree implementation in `src/`.

Search results across `src/**/*.ts` found:

- no worktree manager
- no worktree allocator
- no worktree lifecycle tool
- no worktree-aware branch dispatch logic
- no tests for worktree orchestration

What does exist is only:

- a skill asset: `assets/skills/git-worktrees/SKILL.md`
- documentation and planning notes mentioning worktree patterns

### Why this matters

`src/agents/pipeline/oc-implementer.ts:16-21` tells each implementer to:

1. create a feature branch
2. edit code
3. commit
4. push

That instruction is unsafe for parallel execution in a shared checkout.

In `gloomberg`, `git worktree list` showed only one worktree, while multiple task branches were
active or had been created. This means the orchestrator was attempting parallel branch-based work
without filesystem isolation.

### Architectural consequence

Even if typed envelope attribution had worked perfectly, the current runtime architecture still
does not provide a safe execution model for parallel code modification.

### Confidence

High. This is confirmed by both code search and live repo state.

## F3. `BUILD` Creates Fake Extra Implementer Dispatches Just to Wait

`src/orchestrator/handlers/build.ts` contains two problematic "wait" paths:

- `build.ts:382-399`
- `build.ts:419-436`

In both cases, the handler dispatches `oc-implementer` even though no new implementation task is
being assigned. The prompt is effectively:

> continue working on remaining tasks

or:

> wait for agent results and pass them back

These dispatches use `resultKind: "phase_output"`, not `task_completion`.

### Why this is a bug

This increases pending dispatch count without increasing actual task capacity.

It also creates a new pending dispatch that is not cleanly aligned with the rest of the `BUILD`
state machine, which expects task-scoped completions.

### Evidence in `gloomberg`

`state.json` contains an extra pending dispatch:

- `dispatch_380e708a6e8c`
- `agent: oc-implementer`
- `resultKind: phase_output`
- issued at `2026-04-04T14:45:22.038Z`

That dispatch is not one of the original 7 task-specific wave-1 dispatches.

### Confidence

High.

## F4. Result Application Is Not Atomic Under Parallel Completions

`src/orchestrator/state.ts:54-76` supports optimistic concurrency through `expectedRevision`.

However, the main result-processing path in `src/tools/orchestrate.ts:694-699` does this:

```ts
const nextState = applyResultEnvelope(state, parsed.envelope, { allowMissingPending });
await saveState(nextState, artifactDir);
state = nextState;
```

There is no `expectedRevision` check here.

### Why this matters

If two task completions arrive near the same time:

1. both can load the same state revision
2. both can remove different pending dispatches in memory
3. the later write can overwrite the earlier write

Potential consequences:

- lost `processedResultIds`
- resurrected pending dispatches
- lost task completion state
- stuck or duplicated review transitions

### Confidence

High. This is a direct correctness issue in code, even if it was not the first failure in
`gloomberg`.

## F5. Phase Completion Bypasses Revision Semantics and Leaves Pending Dispatch Risk

`src/orchestrator/phase.ts:55-80` returns a plain object rather than calling `patchState()`.

This means phase completion:

- does not increment `stateRevision`
- does not reuse the same invariant update mechanism as other state changes
- does not clear `pendingDispatches`

`src/tools/orchestrate.ts:577-592` calls `completePhase(currentState)` and saves the result.

### Why this matters

If stale `BUILD` dispatches still exist when the phase changes, later results can become hard to
classify or can pollute the next phase.

This also weakens the meaning of `stateRevision` around one of the most important transitions in
the whole state machine.

### Confidence

Medium-high. The code is clear; the exact runtime blast radius depends on result timing.

## F6. Typed Result Validation Is Incomplete

`src/tools/orchestrate.ts:150-183` validates:

- duplicate `resultId`
- known `dispatchId`
- phase match
- task ID match when `taskId` is present

It does not validate that the typed result `kind` matches the pending dispatch's `resultKind`.

### Why this matters

An incorrectly typed envelope can still clear a pending dispatch before later logic realizes the
payload does not belong to that flow.

This is another determinism hole.

### Confidence

High.

## F7. Legacy Parsing Is Still on the Critical Path

The plugin still treats the legacy adapter as an active control path, not a narrowly scoped
migration fallback.

Evidence:

- `src/orchestrator/contracts/legacy-result-adapter.ts:10-45` is used on every result parse.
- `gloomberg/.opencode-autopilot/orchestration.jsonl` shows repeated legacy parser usage in real
  runtime, not just tests.

### Why this matters

As long as the normal runtime can depend on the legacy adapter, the system cannot honestly claim
strict replayability or deterministic state transitions.

### Confidence

High.

## Concurrency Architecture Assessment

## Parallel `BUILD` Is Conceptually Over-Promised

The current architecture assumes all of the following at the same time:

1. multiple task agents can run concurrently
2. each can create branches and commits
3. their outputs can be reconciled deterministically
4. a later `branch` review can evaluate the result coherently

Today, none of those assumptions are fully satisfied.

### Evidence of drift in `gloomberg`

Branch and task identity do not line up cleanly:

- the completion report `task_completion_W1-T01.md` says W1-T01 lives on
  `feature/W1-T04-api-schemas`
- branch `feature/W1-T02-ml-orm-final` points to commit `91ead31`, whose subject is a W1-T01
  configuration change
- `main` points to `15990f3`, a backtest scaffolding commit

This is not healthy parallel orchestration. It is evidence of execution drift.

## Worktree Feature Investigation

### What exists

- `assets/skills/git-worktrees/SKILL.md` contains a strong methodology document for isolated
  parallel development.
- the installer copies skill assets into `~/.config/opencode/skills/`
- the repository contains docs and planning notes that reference worktrees as an important pattern

### What does not exist

The runtime plugin code under `src/` does not contain:

- a worktree creation tool
- a worktree cleanup tool
- a worktree assignment layer for task agents
- worktree-aware prompt generation
- worktree-specific artifact mapping
- tests for worktree lifecycle or orchestration

### Critical wiring gap

`src/skills/adaptive-injector.ts:26-35` maps `BUILD` to these injected skills only:

- `coding-standards`
- `tdd-workflow`

`git-worktrees` is not part of the `BUILD` phase skill map.

`src/orchestrator/handlers/build.ts:59-71` also hardcodes only the coding standards skill in the
build prompt:

> `Check ~/.config/opencode/skills/coding-standards/SKILL.md for coding standards.`

So even the existing worktree skill asset is not being injected into `BUILD` prompts.

### Conclusion

The codebase contains a worktree skill and worktree design intent, but not a runtime worktree
system. Parallel `BUILD` is therefore not actually backed by worktree isolation.

## Review Model Is Not Compatible with Parallel Branch Execution

`src/orchestrator/handlers/build.ts:188-193` and `:341-356` dispatch review as:

> `Review completed wave. Scope: branch. Report any CRITICAL findings.`

`src/tools/review.ts:65-67` implements `branch` scope with:

```ts
git diff-tree --no-commit-id --name-only --root -r HEAD
```

This reviews the current `HEAD` of the current checkout.

### Why this is a problem

If multiple task branches or worktrees exist, a single `branch` review of one checkout is not a
coherent review strategy unless all task outputs have already been merged into one review branch.

The current plugin does not implement that merge or aggregation layer.

## Hashline Editing Investigation

## What is implemented

`src/tools/hashline-edit.ts` implements a real hash-anchored edit tool with:

- FNV-1a hashing
- 2-character CID alphabet hashes
- `replace`, `append`, and `prepend`
- stale-anchor validation
- surrounding-anchor error recovery
- overlap detection
- bottom-up edit application

It is registered in the plugin at `src/index.ts:39` and `src/index.ts:218`.

There is also direct test coverage in `tests/tools/hashline-edit.test.ts`.

### What is wired

Prompt references exist in:

- `src/agents/autopilot.ts`
- `src/agents/pipeline/oc-implementer.ts`
- `src/agents/coder.ts`
- `src/agents/debugger.ts`

Those prompts instruct agents to prefer `oc_hashline_edit` over the built-in edit tool.

## What is missing

### 1. No runtime anchor-generation or hashline-read path

I found no runtime tool in `src/` that produces initial `LINE#HASH` anchors for a file read.

`hashline-edit.ts` can validate provided anchors and can return updated nearby anchors on failure,
but it does not solve the initial-anchor acquisition problem.

This gap is reinforced by planning artifacts that refer to a future `hashline-read` tool, while no
such runtime implementation exists.

### 2. The tool cannot create new files

`src/tools/hashline-edit.ts:113-117` reads the target file up front and returns an error if the
file does not exist.

That means:

- file creation still requires another editing mechanism
- new-file workflows cannot be fully hashline-driven

### 3. No evidence of orchestrator-specific adoption

The existence of the tool does not mean the autonomous build stack actually used it during the
`gloomberg` session.

There is no orchestration-level telemetry linking `oc_hashline_edit` calls to task runs, and the
observability system currently drops `tool_complete` events before persistence.

### Practical conclusion

`oc_hashline_edit` is a real tool, but only partially operational as a complete autonomous editing
workflow. It is best described as "implemented but not fully productized".

## Logging and Observability Assessment

## Main finding

The plugin's observability layer collects more than it persists, and what it persists is too thin
to explain orchestrator incidents.

## The event store is richer than the durable logs

`src/observability/event-store.ts:17-91` defines support for:

- `fallback`
- `error`
- `decision`
- `model_switch`
- `context_warning`
- `tool_complete`
- `phase_transition`
- `session_start`
- `session_end`

But `src/index.ts:184-198` filters persisted session events down to only:

- `fallback`
- `error`
- `decision`
- `model_switch`

This means the following useful signals are collected in memory but dropped before persistence:

- tool completions and durations
- context warnings
- session start and end context
- phase transition records

## Final flush is not awaited

`src/observability/event-handlers.ts:189-208` writes logs on `session.idle` and
`session.deleted`, but uses fire-and-forget `.catch(...)` behavior rather than awaiting the write.

This creates a real risk of missing or incomplete logs during session teardown.

## Real-world evidence from this machine

Most files in `~/.config/opencode/logs` are nearly empty. Representative examples:

- `ses_2a77bfae0ffegWU9z5gbzU3lXt.json` contains zero events
- `ses_2a7c27245ffeUakDYI27JWY1ST.json` contains zero events
- `ses_2a83265dbffe53gBSAJ9By7u4R.json` contains only a compaction decision

The likely `gloomberg` session log, `ses_2a759ed43ffe47q2vQPmPnJWMN.json`, covers the correct
time window but contains only 2 `unknown` errors with empty messages.

It does not tell us:

- which project it belonged to
- which task or dispatch failed
- which tool calls ran
- whether `oc_hashline_edit` was used
- which child session produced the failure

## Additional design smell: split logging implementations

There are two different log persistence concepts in the codebase:

- snapshot JSON logs via `observability/log-writer.ts`
- JSONL session logs via `observability/session-logger.ts`

They currently resolve to the same directory, but this split design adds confusion and weakens the
mental model of where truth is stored.

## Conclusion

`oc_logs` is not yet a trustworthy forensic tool for orchestration incidents.

## Memory and SQLite Assessment

## Main finding

The SQLite memory subsystem exists, but it did not capture useful operational memory for the
`gloomberg` run.

## What exists

`src/memory/database.ts` creates a global Bun SQLite database at:

- `~/.config/opencode/memory/memory.db`

The DB is configured with:

- WAL mode
- foreign keys
- busy timeout

## What the live DB showed

The database contained:

- 4 projects
- 3 observations
- 0 preferences

There was a valid `gloomberg` project row, but no useful `gloomberg` observations. The only
aggregated observations I could confirm belonged to the plugin repo itself, and they were `error`
type observations.

Further live queries hit:

```text
database is locked (5)
```

That does not prove the DB is corrupted, but it does show that lock contention or transaction
handling deserves investigation.

## Why memory capture is weak in code

### 1. Session tracking is global, not per session

`src/memory/capture.ts:70-74` stores:

- `currentSessionId`
- `currentProjectKey`

as single mutable variables for the entire handler.

That is not safe for concurrent sessions.

### 2. Capture depends on events that are not actually emitted

`src/memory/capture.ts:33-40` listens for:

- `app.decision`
- `app.phase_transition`

I found typed emitter helpers in `src/observability/event-emitter.ts`, but no runtime call sites
that emit those events in the live orchestration path.

### 3. Memory injection is cached once per session and never refreshed

`src/memory/injector.ts:53-80` caches memory context by `sessionID` and never refreshes it.

So even if new observations are inserted mid-session, the injected memory context can remain stale
for the rest of that session.

### 4. Retrieval swallows transaction failures and does not roll back

`src/memory/retrieval.ts:275-285` begins a transaction, updates access counts, and swallows any
error without issuing an explicit rollback.

That is a correctness smell and a plausible contributor to lock weirdness.

### 5. Preferences appear unused

The repository layer includes `upsertPreference()`, but I found no production runtime caller.
The live DB also had zero preference rows.

## Conclusion

The SQL memory subsystem is present, but not working in a way that materially helped this
`gloomberg` session.

## Fallback and Hook Integration Assessment

## Main finding

Fallback is not the primary root cause of the `gloomberg` failure, but its integration is
incomplete and may create additional stuck states or invisible delays.

## `fallbackPending` is written but not meaningfully consumed

`src/orchestrator/fallback/tool-execute-handler.ts:21-40` adds `fallbackPending: true` metadata
to empty task outputs when a child session fallback is still in progress.

I did not find a corresponding orchestrator path that interprets `fallbackPending` and retries or
waits accordingly.

This makes the handoff incomplete.

## Fallback telemetry is not durably connected to observability

The event store supports fallback and model-switch events, but the durable logs do not provide a
useful end-to-end fallback trace for orchestration incidents.

## Errors are swallowed at the fallback handler boundary

`src/orchestrator/fallback/event-handler.ts:231-234` catches broadly and only releases the retry
lock. Root-cause context is lost.

## Conclusion

Fallback should be treated as a secondary reliability problem, not the first issue to fix.

## Performance and Slowness Assessment

## Main conclusion

The hour-long bad behavior in `gloomberg` was mostly control-flow failure and state drift, not just
"heavy computation".

That said, the code does contain several performance contributors.

## Likely primary slowness contributors

### 1. Orchestration loops around invalid results

Once `BUILD` entered the invalid-attribution state, the system kept receiving and rejecting work
without converging.

This is the biggest explanation for the long-running failure.

### 2. Synchronous orchestration logging in the hot path

`src/orchestrator/orchestration-logger.ts:23-32` uses `appendFileSync()`.

This is not catastrophic alone, but it is an unnecessary event-loop blocker in a tight dispatch and
error loop.

### 3. Repeated state writes

`src/tools/orchestrate.ts` performs multiple saves across a single cycle:

- dispatch count increment
- pending dispatch update
- result application
- phase transition save

This amplifies disk churn in noisy loops.

### 4. Session log listing is serial

`src/observability/log-reader.ts:74-119` reads and parses log files one by one.

This is a smaller concern, but it will degrade operational tooling over time.

### 5. Memory pruning is heavier than it needs to be

`src/memory/decay.ts:55-104` scores many rows, deletes row-by-row, and runs FTS optimize.

This is not likely the root cause of the `gloomberg` build stall, but it is part of the overall
cost profile.

## Pushback on the "hooks are the main problem" hypothesis

Hooks may add some overhead, but the primary failure was not hook overhead. The primary failure was
that the orchestrator could no longer attribute child results while parallel agents were still
running and producing side effects.

## Gloomberg-Specific Evidence of State Drift

## 1. State says wave-1 tasks are still `IN_PROGRESS`

`gloomberg/.opencode-autopilot/state.json` shows tasks 1 through 7 all `IN_PROGRESS`.

## 2. Branches and commits say work happened anyway

The repo had multiple feature branches and remote branches that align with wave-1 task themes.

## 3. Completion artifact exists, but state did not ingest it

`gloomberg/.opencode-autopilot/phases/PLAN/task_completion_W1-T01.md` documents a completed W1-T01
task and names a branch containing the implementation.

This means the orchestrator did not fail because no work happened. It failed because completed work
was not correctly reconciled back into state.

## 4. Branch/task identity is inconsistent

The W1-T01 completion report references branch `feature/W1-T04-api-schemas`, and branch naming in
the repo does not align cleanly with commit subjects or task IDs.

This is consistent with a system that allowed uncontrolled parallel branch drift.

## Test Coverage Gaps

## Existing coverage

The repo does have meaningful test coverage for:

- result envelopes
- deterministic replay basics
- `BUILD` handler scenarios
- `oc_hashline_edit`
- memory modules in isolation
- orchestration logger basics

## Critical missing coverage

### 1. No end-to-end test for autopilot raw outputs during `dispatch_multi`

This exact `gloomberg` failure mode should have been a regression test.

### 2. No concurrency test for simultaneous typed task completions

The non-atomic save path under parallel results is not protected by tests.

### 3. No worktree orchestration tests

There are no worktree runtime tests because there is no runtime worktree implementation.

### 4. No test that `BUILD` wait paths do not create fake new implementers

The current behavior should be considered suspicious enough to require explicit tests.

### 5. No end-to-end logging tests for real orchestrator incidents

There is no test that a failed multi-dispatch incident produces enough durable metadata to debug.

### 6. No integration test for memory capture during orchestration

Memory modules are tested in isolation, but not as a live orchestrator session with meaningful
decision and phase events.

### 7. No `kind` vs expected result-kind validation tests

This correctness gap should be covered explicitly.

## Direct Answers to the Original Questions

## Are pipelines deterministic and idempotent?

Not currently.

The single-dispatch path is closer to deterministic, but the real `BUILD` concurrency path is not.
Legacy result parsing, non-atomic state writes, incomplete result validation, and stale pending
dispatch behavior all weaken determinism.

## Are tools crashing and delaying everything else?

Some tool and hook integrations are incomplete, especially around fallback and observability, but
the main failure was not general tool crashes. The main failure was orchestration contract and
concurrency failure.

## Are phases and tasks properly stored and updated through status?

Stored: yes.

Updated reliably: no.

`gloomberg` is the proof. Work progressed in git, while the state machine stayed stuck.

## Is the SQL memory system working?

Not in a way that can be trusted operationally for this workflow.

The DB exists, but capture was sparse, session handling is not concurrency-safe, and the live data
did not help explain the incident.

## Are worktrees actually wired?

No, not as a runtime feature.

There is a worktree skill asset and worktree documentation, but no runtime worktree orchestration
in `src/`.

## Is hashline editing wired?

Partially.

The tool exists and is registered. Agent prompts mention it. But the surrounding workflow is
incomplete because there is no runtime initial-anchor generation path and no support for new-file
creation within the tool.

## Recommended Remediation Roadmap

## Priority 0: Stop the Bleeding

1. Disable parallel `BUILD` immediately.
2. Force `BUILD` to run one task at a time until concurrency is safe.
3. Remove or gate the fake "wait" implementer dispatch paths in `build.ts`.
4. Refuse legacy result submission for pipeline agents, especially `BUILD`.

## Priority 1: Fix the Core Orchestration Contract

1. Change the autopilot-to-orchestrator contract so child-agent results are submitted as typed
   envelopes, not raw strings.
2. Validate typed `kind` against pending `resultKind`.
3. Make every state transition use optimistic concurrency or an explicit compare-and-swap retry
   loop.
4. Move phase completion through the same revisioned patch path as other updates.
5. Clear stale `pendingDispatches` on phase completion or make them phase-scoped with strict rules.

## Priority 2: Decide the Parallelism Model Explicitly

Two acceptable options exist.

### Option A: keep `BUILD` sequential

This is the smaller and safer fix.

### Option B: reintroduce parallelism only with real worktree isolation

If parallel `BUILD` remains a product goal, then implement all of the following before turning it
back on:

1. worktree allocation per task
2. deterministic worktree naming
3. branch-to-task identity binding
4. cleanup rules
5. worktree-aware artifact paths
6. merge or aggregation strategy before branch-scope review
7. tests for worktree lifecycle and reconciliation

Until then, parallel `BUILD` should be considered unsafe.

## Priority 3: Repair Observability

Persist the following durably for each orchestration event:

- project root
- run ID
- session ID
- parent and child session IDs
- phase
- dispatch ID
- task ID
- expected result kind
- tool name and duration
- fallback decisions
- phase transitions

Also:

1. await the final session log flush
2. unify snapshot and JSONL logging design
3. make `oc_logs` project-aware

## Priority 4: Repair Memory

1. key capture state by session, not globally
2. capture orchestrator decisions directly instead of depending on absent app events
3. refresh memory injection during long sessions
4. add explicit rollback on transaction failure
5. either wire preferences fully or remove the unused abstraction

## Priority 5: Strengthen Hashline Editing or Re-scope It Honestly

If `oc_hashline_edit` is meant to be a core safety feature:

1. add a companion anchor-generation read path
2. support file creation or clearly define the fallback path
3. log actual tool usage durably
4. add end-to-end agent tests using the hashline workflow

If those are not implemented, the product should stop implying that hashline editing is the main
editing safety mechanism for autonomous runs.

## Proposed Validation Plan After Fixes

## Phase 1: Deterministic replay and concurrency

1. start a multi-task `BUILD`
2. complete typed results out of order
3. complete typed results concurrently
4. restart the process mid-wave
5. confirm state remains correct

## Phase 2: Worktree validation

1. allocate one worktree per task
2. verify branch exclusivity
3. run independent edits and tests in each worktree
4. reconcile outputs into a review branch
5. confirm cleanup works

## Phase 3: Observability validation

1. provoke a known invalid result
2. confirm logs show project, run, phase, dispatch, task, and child session lineage
3. use `oc_logs` to recover the full incident without opening raw files manually

## Phase 4: Memory validation

1. run two simultaneous sessions on different projects
2. confirm observations are attributed correctly
3. insert new observations mid-session
4. confirm later prompt injections refresh accordingly

## Appendix A: Key Code References

### Orchestration and `BUILD`

- `src/agents/autopilot.ts:12-30`
- `src/tools/orchestrate.ts:150-183`
- `src/tools/orchestrate.ts:650-717`
- `src/tools/orchestrate.ts:682-692`
- `src/orchestrator/contracts/legacy-result-adapter.ts:10-45`
- `src/orchestrator/contracts/result-envelope.ts:6-20`
- `src/orchestrator/handlers/build.ts:59-71`
- `src/orchestrator/handlers/build.ts:341-399`
- `src/orchestrator/handlers/build.ts:419-436`
- `src/orchestrator/state.ts:54-76`
- `src/orchestrator/phase.ts:55-80`

### Worktrees and review model

- `assets/skills/git-worktrees/SKILL.md`
- `src/skills/adaptive-injector.ts:26-35`
- `src/agents/pipeline/oc-implementer.ts:16-21`
- `src/tools/review.ts:51-76`

### Hashline editing

- `src/tools/hashline-edit.ts:102-285`
- `tests/tools/hashline-edit.test.ts`

### Observability and memory

- `src/index.ts:184-198`
- `src/observability/event-store.ts:17-91`
- `src/observability/event-handlers.ts:189-208`
- `src/observability/log-writer.ts:79-92`
- `src/observability/log-reader.ts:74-119`
- `src/observability/session-logger.ts`
- `src/memory/capture.ts:33-40`
- `src/memory/capture.ts:70-100`
- `src/memory/injector.ts:53-80`
- `src/memory/retrieval.ts:246-288`
- `src/memory/database.ts:76-92`
- `src/orchestrator/fallback/tool-execute-handler.ts:21-40`

## Appendix B: Selected Runtime Evidence

### `gloomberg/.opencode-autopilot/orchestration.jsonl`

Key observations:

- early phases completed through legacy parser warnings
- `BUILD` started with `dispatch_multi`
- repeated `E_INVALID_RESULT` attribution failures followed
- later `undefined` validation failures also appeared

### `gloomberg/.opencode-autopilot/state.json`

Key observations:

- `currentPhase: BUILD`
- tasks `1-7` stuck `IN_PROGRESS`
- 8 pending dispatches remain
- state explicitly notes work happened across branches but was not reconciled

### `gloomberg` git state

Key observations:

- multiple task-related branches existed
- only one worktree existed
- branch names, task IDs, and commit subjects drifted out of sync

### Global session logs

Key observations:

- many session logs were effectively empty
- the relevant `gloomberg`-window session log did not contain enough context to debug the failure

### Global memory DB

Key observations:

- `gloomberg` project row existed
- useful `gloomberg` observations did not
- further live queries encountered lock errors

## Final Judgment

The plugin is not currently failing because of one small bug. It is failing because the current
product promise exceeds the runtime implementation in several critical areas.

The most important mismatch is this:

- the product promises deterministic autonomous orchestration
- the runtime still relies on a legacy result path
- `BUILD` concurrency assumes branch-isolated task execution
- the runtime does not implement worktree isolation
- status reconciliation is not atomic
- observability is too weak to explain what went wrong

This is fixable, but the correct order matters.

The right next move is not to add more parallelism. The right next move is to re-establish a
single trustworthy control plane for result attribution, state transitions, and runtime evidence.
