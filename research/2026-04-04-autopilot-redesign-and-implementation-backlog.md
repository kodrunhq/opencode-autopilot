# Autopilot Redesign and Implementation Backlog

Date: 2026-04-04

Related report:
- `research/2026-04-04-gloomberg-autopilot-investigation-report.md`

Scope:
- turn the forensic findings into an implementation backlog
- challenge the current architecture instead of assuming every feature should survive
- decide what should stay deterministic, what can remain LLM-driven, what should be simplified,
  and what may deserve a rebuild

## Position

The current system should not be treated as "a basically good architecture with a few bad bugs".

That framing is too optimistic.

The plugin currently mixes too many roles into one runtime:

- autonomous orchestration engine
- code-review engine
- fallback supervisor
- project-local pipeline store
- global observability layer
- global long-term memory system
- installer and config product
- interactive CLI and in-session control surface

Each of these can be justified on its own. The problem is that they currently overlap without a
clear control-plane boundary or a single durable source of truth.

The result is not just bugs. The result is architectural ambiguity.

## Core Questions Reframed

Instead of asking only "how do we fix the current bug", the right questions are:

1. What is the actual product?
2. What absolutely must be deterministic?
3. Which features are nice-to-have but not essential to the control plane?
4. Which subsystems are mature enough to harden, and which should be rebuilt or removed?
5. Where are we pretending to have a system that we do not yet actually have?

## Problem Statement

The plugin is trying to be a local autonomous software delivery platform, but its persistence,
telemetry, and execution model are split across overlapping mechanisms. That split makes it hard
to guarantee correctness, hard to diagnose failures, and hard to reason about what state is
authoritative.

The immediate `gloomberg` bug is a `BUILD` multi-dispatch failure.

The deeper issue is that the current architecture has not cleanly separated:

- deterministic control-plane logic
- non-deterministic agent behavior
- local execution isolation
- durable telemetry
- optional memory/learning features

Until those boundaries are clarified, the project will continue to accumulate patches that feel
locally correct but globally unstable.

## Non-Negotiables

These are the parts that should be treated as hard requirements, not preferences.

### 1. The control plane must be deterministic

The following must not depend on LLM behavior, prompt phrasing, or best-effort parsing:

- phase transitions
- dispatch creation
- dispatch/result attribution
- task state transitions
- duplicate-result handling
- retry accounting
- review gating
- failure classification

### 2. One durable source of truth must exist for active runs

Right now truth is fragmented across:

- `state.json`
- `orchestration.jsonl`
- global session logs
- SQLite memory
- review memory JSON
- lesson memory JSON

This is too many persistence surfaces for one product.

### 3. Parallel code execution must be isolated or removed

Parallel `BUILD` without worktree isolation is not a product feature. It is an unsafe illusion.

### 4. Observability must explain a failure without manual archeology

If an hour-long run fails, the plugin should make it possible to answer:

- which run
- which phase
- which dispatch
- which task
- which child session
- which model or fallback event
- what input and output class were involved
- why the orchestrator made the next decision

without stitching together four storage systems by hand.

## What Should Stay Deterministic vs LLM-Driven

## Deterministic by default

These should be machine-enforced state transitions or pure functions.

### Control-plane logic

- run lifecycle
- phase machine
- dispatch identity and attribution
- envelope validation
- optimistic concurrency / transaction boundaries
- worktree allocation and cleanup
- result replay safety
- review pipeline stage transitions
- health checks
- config validation

### Error handling

- known error codes
- retryability decisions
- loop/circuit-breaker behavior
- stale result detection
- duplicate result rejection
- missing required fields
- invalid transition rejection

### Persistence

- state/event schema validation
- migration behavior
- atomic writes or DB transactions
- cleanup semantics

## LLM-driven where it actually makes sense

These are the places where probabilistic generation is appropriate.

### Research and architecture generation

- RECON findings
- challenge and ideation
- architecture alternatives
- planning narrative

### Code generation and review content

- implementation output
- review findings text
- documentation and retrospective prose

### Optional memory summarization

- summarizing historical observations
- compressing prior lessons for prompt injection

## Important principle

LLMs can generate content.

They should not be responsible for maintaining the correctness of the system's state machine.

## Architecture Options

This section explores genuinely different futures for the product instead of assuming the current
shape is sacred.

## Option A: Thin Autopilot

### Core idea

Aggressively simplify the product around one goal: a deterministic local orchestration engine with
typed dispatches, code review, and minimal forensics.

### Keep

- orchestrator
- review engine
- basic fallback
- installer/configure
- minimal forensics
- hashline editing if it proves useful

### Remove or defer

- SQLite long-term memory
- prompt-injection memory
- session analytics dashboard ambitions
- extra observability layers beyond what is needed for debugging runs
- complex profile/config sprawl

### Strengths

- shortest path to a trustworthy product
- much easier to test
- smaller surface for bugs
- easier OSS story

### Weaknesses

- loses some product differentiation
- less "intelligent assistant memory" narrative
- fewer advanced diagnostics features

### Effort

Medium

### My assessment

This is the safest short-term strategic path if the priority is to ship a reliable system soon.

## Option B: SQLite-First Local Kernel

### Core idea

Keep the local plugin architecture, but collapse all persistence into one SQLite-backed kernel.

That means one DB contains:

- runs
- phases
- tasks
- dispatches
- results
- orchestration events
- review state
- lessons
- optional memory observations

### Keep

- local-first plugin shape
- Bun/TypeScript runtime
- deterministic control plane
- optional memory and observability features

### Replace

- `state.json`
- `orchestration.jsonl`
- project-local review memory JSON
- lesson-memory JSON
- split session log persistence

### Strengths

- one source of truth
- transactional updates
- easier replay and forensics
- easiest migration from current code without changing product identity

### Weaknesses

- central DB can become a lock/contention point if implemented carelessly
- migration complexity from current JSON files
- still a fairly complex local product

### Effort

Medium-high

### My assessment

This is the strongest long-term path if the goal is to keep the product local-first without a full
rewrite.

## Option C: Unified Event Ledger

### Core idea

Move to an append-only event ledger where state is derived from events rather than patched into
multiple mutable stores.

Examples of events:

- run_started
- phase_dispatched
- dispatch_created
- result_received
- result_rejected
- task_completed
- review_requested
- review_failed
- phase_completed
- fallback_triggered

State becomes a projection.

### Strengths

- replayability becomes first-class
- debugging becomes more principled
- observability and state are unified conceptually
- easier to audit correctness and explain past behavior

### Weaknesses

- larger conceptual leap
- projection bugs can create confusing symptoms during migration
- overkill if the product remains a relatively small local plugin

### Effort

High

### My assessment

This is the cleanest control-plane design in principle, but it is probably too large as the first
repair step unless the team explicitly wants to invest in a real local orchestration platform.

## Option D: Local Control Plane Runtime

### Core idea

Split the product in two:

- the OpenCode plugin becomes a thin client
- a long-lived local daemon becomes the real orchestrator, logger, memory owner, and supervisor

### Strengths

- cleaner runtime boundaries
- easier multi-session coordination
- stronger lifecycle control
- better path toward industrial-grade orchestration

### Weaknesses

- much more operational complexity
- heavier installation story
- turns a plugin into a platform

### Effort

Very high

### My assessment

Not the right next move unless the vision is explicitly becoming a serious control-plane product,
not just a local plugin.

## Option E: Profile-Driven Appliance

### Core idea

Keep the current major features, but drastically reduce surface area by exposing only a few user
profiles such as:

- `fast`
- `balanced`
- `max-safety`
- `research-heavy`

Each profile would decide fallback, logging, memory, and review policy.

### Strengths

- simpler UX
- fewer misconfigurations
- easier support burden

### Weaknesses

- does not solve the deepest control-plane issues on its own
- may just simplify a broken architecture unless paired with deeper changes

### Effort

Medium

### My assessment

Useful as a product simplification layer, but not a substitute for fixing the control plane.

## Recommendation

## Primary recommendation

Adopt **Option B: SQLite-First Local Kernel** as the target architecture.

## Secondary simplification rule

Borrow the discipline of **Option A: Thin Autopilot** for the next few milestones.

That means:

- do not preserve every existing feature just because it exists
- prefer fewer features with stronger invariants
- keep memory and advanced observability only if they can justify their complexity

## Why this recommendation

It balances three realities:

1. We already have a local plugin and local SQLite usage.
2. The current biggest problems are control-plane correctness and fragmented persistence.
3. A full daemon rewrite is too large right now, while a pure event-sourced redesign is probably
   too ambitious as the first recovery step.

SQLite-first local kernel gives us:

- one durable source of truth
- transactions
- replay and forensics opportunities
- a clear migration path from the current code

without turning the product into a distributed system.

## Strategic Pushback

These are the things I would explicitly push back on.

## 1. Do not keep parallel `BUILD` just because it sounds powerful

Parallel code modification is one of the highest-risk features in the whole product.

If we cannot isolate it correctly, we should not offer it.

## 2. Do not keep legacy result parsing in the normal path

Legacy adapters are acceptable as migration shims.

They are not acceptable as a hidden production control path for a supposedly deterministic system.

## 3. Do not keep memory because it sounds intelligent

If memory is not materially improving outcomes and cannot be made trustworthy, it should be
removed or severely scoped down.

## 4. Do not over-invest in a fancy CLI if the control plane is still weak

The CLI is not the bottleneck. It is not where trust is won or lost.

## 5. Do not rewrite to another language to avoid making design decisions

The current failures are mostly architecture and protocol failures, not runtime-language failures.

## Technology and Language Assessment

## Keep Bun/TypeScript for now

I do not see a compelling reason to rewrite core subsystems into another language today.

### Orchestrator

This is a state-machine problem, not a CPU-bound problem.

TypeScript is sufficient if invariants, transactions, and contracts are improved.

### Logging and event ingestion

Current issues are semantic and durability-related, not due to JS performance.

### Memory

Embedded SQLite is a strong fit for a local plugin.

### CLI

The CLI is mostly config, file I/O, subprocess calls, and interactive prompts. There is no serious
performance case for another language.

## When a different runtime would make sense

Only if the product intentionally grows into one of these:

- a daemonized local control plane
- cross-device shared memory service
- centralized analytics or telemetry backend
- heavy semantic search or vector retrieval service

In that future, an external service may be appropriate.

That still would not prove Bun/TypeScript was wrong for the current plugin.

## What to Tear Down and Rebuild

This section answers the question directly.

## Rebuild from scratch

### 1. Active-run persistence model

The current split across JSON state, orchestration log, session logs, review memory, and lesson
memory should be replaced by one coherent persistence model.

This is not a patch target. This is a redesign target.

### 2. `BUILD` execution contract

The result-submission contract between autopilot and orchestrator should be redesigned so typed,
task-scoped, dispatch-scoped results are the only allowed production path.

### 3. Parallel execution model

This needs a clean go/no-go decision:

- either rebuild it around worktrees and deterministic reconciliation
- or remove it and commit to sequential `BUILD`

## Simplify heavily

### 4. Logging / observability product surface

Today there is too much conceptually and too little operational value.

Simplify around one question:

> Can we reconstruct what happened in a failed run?

Anything beyond that should be treated as optional.

### 5. Memory feature

Memory should be reduced to either:

- a small, explicit lessons system
- or a well-defined SQLite knowledge store with strong capture semantics

The current half-learning, half-observability hybrid is not convincing.

## Probably keep, but tighten

### 6. CLI and configure surface

The current CLI is not the main architectural problem.

It may be slightly too broad, but it does not need a rewrite. It needs a clearer role.

### 7. Review engine

The review engine is one of the more coherent subsystems conceptually.

Its integration with `BUILD` and multi-branch execution needs tightening, but the whole idea does
not need to be discarded.

## Structural Assessment by Subsystem

## Logging system

## Current issue

The logging system is trying to be both:

- runtime observability
- post-hoc analytics
- session summaries
- debugging trace

and it is not strong enough at the most important one: incident diagnosis.

## Recommendation

Redesign logging around a minimal event schema first.

Each event should include:

- run ID
- project root
- session ID
- parent session ID
- phase
- dispatch ID
- task ID
- event type
- timestamp
- machine-readable payload

Durable logging should be append-only and queryable.

Summaries should be projections, not the primary storage format.

## Keep or rebuild?

Rebuild the persistence model, keep the concept of local structured logs.

## DB memory

## Current issue

Memory is conceptually mixed up with observability and prompt injection.

It has no strong product boundary today.

## Recommendation

Split memory into two possible concepts and choose one.

### Path 1: explicit lessons only

- keep cross-run lessons
- remove adaptive memory retrieval and prompt injection
- focus on deterministic retrospective extraction

### Path 2: real local knowledge store

- keep SQLite
- define clear observation sources
- make capture session-safe
- make retrieval explainable
- make injection refreshable and budgeted

## My recommendation

Start with Path 1 unless there is strong evidence that the richer memory system meaningfully
improves outcomes.

## CLI

## Current issue

The CLI is fine technically, but the overall product has both:

- CLI commands
- in-session tools
- auto-installed commands

That can blur the mental model.

## Recommendation

Keep the CLI focused on:

- install
- configure
- doctor

Do not let the CLI become a second orchestration surface.

The in-session tools should remain the operational control plane for runs.

## Pipeline error handling

## Current issue

Pipeline error handling is still too much:

- best-effort
- swallow-and-log
- infer-after-the-fact

for a system that claims to be deterministic.

## Recommendation

Move to a fail-fast deterministic error model.

### Principles

1. every known failure must have a code
2. every code must have a recovery policy
3. no broad `catch {}` in control-plane paths
4. all non-fatal paths must be explicitly classified as non-fatal
5. the orchestrator should prefer stopping cleanly over progressing ambiguously

## Concrete Implementation Backlog

This backlog is intentionally opinionated and sequenced.

## Track 1: Immediate Stabilization

### 1. Disable parallel `BUILD`

Goal:
- stop the unsafe path immediately

Changes:
- make `BUILD` dispatch only one task at a time
- remove `dispatch_multi` from active production flow

Success criteria:
- one task agent at a time
- no multiple pending implementer dispatches
- `gloomberg`-style attribution failure cannot recur

### 2. Ban legacy result parsing for pipeline agents

Goal:
- end the silent degraded mode

Changes:
- require typed envelopes from orchestrated agents
- treat legacy result mode as migration-only or explicit debug mode

Success criteria:
- orchestrator never accepts raw string results for active pipeline dispatches

### 3. Remove fake waiting dispatches

Goal:
- stop creating ambiguity when nothing new should be dispatched

Changes:
- replace those paths with status/no-op/wait state

Success criteria:
- waiting does not create new implementer dispatches

### 4. Make result application atomic

Goal:
- stop lost updates and state overwrite races

Changes:
- require revision checking on every result application
- retry or fail cleanly on conflicts

Success criteria:
- concurrent results cannot silently clobber state

## Track 2: Control Plane Hardening

### 5. Redesign result envelope protocol

Goal:
- make the protocol explicit and unambiguous

Changes:
- dispatch carries a required schema
- result must include dispatch ID, task ID where relevant, kind, run ID
- validate `kind` against expected pending result kind

Success criteria:
- protocol mismatches fail fast with deterministic codes

### 6. Unify active-run persistence

Goal:
- create one source of truth

Preferred target:
- SQLite-first kernel for runs and events

Changes:
- design schema for runs, phases, tasks, dispatches, results, events
- add migration path from JSON state/logs

Success criteria:
- active-run state no longer depends on multiple ad hoc files

### 7. Tighten phase completion semantics

Goal:
- make phase transitions as strong as any other state update

Changes:
- route phase completion through same transactional revisioned mechanism
- define pending-dispatch cleanup rules

Success criteria:
- no stale dispatches survive phase boundaries unless intentionally allowed

## Track 3: Product Simplification

### 8. Decide memory scope

Decision needed:
- explicit lessons only
- or real local memory system

Recommended first step:
- reduce to explicit lessons only until the richer memory design is justified

### 9. Simplify config surface

Goal:
- reduce support and correctness burden

Changes:
- introduce profiles or reduce knobs
- separate user-facing config from internal tuning

Success criteria:
- smaller config schema
- fewer migration branches

### 10. Simplify observability to forensic essentials

Goal:
- make logs explain failures first, dashboards second

Changes:
- define minimal durable event schema
- remove or defer low-value telemetry paths

Success criteria:
- one failed run can be reconstructed from logs alone

## Track 4: Conditional Future Work

These should not begin until the control plane is stable.

### 11. Reintroduce parallel `BUILD` only if worktrees are real

Requirements:
- runtime worktree manager
- task-to-worktree binding
- deterministic naming
- cleanup
- review aggregation strategy
- regression tests

If those are not implemented, parallel `BUILD` should stay off.

### 12. Strengthen `oc_hashline_edit` if it remains a core promise

Requirements:
- initial anchor generation path
- clear new-file story
- tool-usage observability
- end-to-end agent workflow tests

## Decision Matrix

| Area | Keep | Simplify | Rebuild | Remove |
|------|------|----------|---------|--------|
| CLI install/configure | Yes | Yes | No | No |
| In-session tools | Yes | Yes | No | No |
| Orchestrator control plane | Yes | No | Yes | No |
| Parallel `BUILD` | No | No | Yes, if isolated | Yes, if not isolated |
| Review engine | Yes | Some | No | No |
| Logging persistence model | No | No | Yes | No |
| Memory lessons | Yes | Yes | Maybe | No |
| Rich memory DB/injection | Maybe | Yes | Maybe | Maybe |
| Legacy result path | No | No | No | Yes |
| Fake waiting dispatches | No | No | No | Yes |

## Proposed Decision Log

## Decision: Product direction for Autopilot core

Date: 2026-04-04

Selected:
- move toward a SQLite-first local kernel
- apply Thin Autopilot discipline during recovery

Rationale:
- The current failures come from fragmented control-plane state, not lack of features.
- SQLite-first unifies local persistence without requiring a platform rewrite.
- Thin Autopilot discipline prevents the team from preserving features that add complexity without
  enough operational value.

Rejected alternatives:
- Full daemonized control plane now: too heavy for the current recovery phase.
- Immediate event-sourced rewrite: conceptually strong, but too large as the first step.
- Keep architecture and patch around edges: not credible given the number of structural faults.

Risks and mitigations:
- Migration complexity: do it incrementally, starting with run/event storage.
- Feature regression fear: explicitly label some features as deferred, not silently broken.
- Scope creep: require each retained subsystem to justify itself against control-plane simplicity.

## Open Strategic Questions

These should be answered explicitly before implementation starts.

### 1. Is memory a core product feature or an experiment?

If it is core, it needs a clear contract and proper capture semantics.

If it is not core, reduce it to lessons only.

### 2. Is parallel `BUILD` a must-have or a vanity feature?

If it is must-have, worktrees and deterministic reconciliation become mandatory.

If it is not must-have, delete it now and move on.

### 3. Is the plugin meant to be a local tool or an orchestration platform?

If it stays a local plugin, keep the architecture lean.

If it becomes a platform, a daemonized control plane may eventually make sense.

### 4. How much product surface do we actually want to support?

The current repo suggests too many ambitions at once.

We should be explicit about what the first trustworthy version of the product really is.

## Suggested Implementation Sequence

This is the order I would actually execute.

### Phase 1: Stability first

1. disable parallel `BUILD`
2. require typed result envelopes
3. remove fake waiting dispatches
4. make result application atomic
5. add regression tests for the `gloomberg` failure mode

### Phase 2: Persistence redesign

1. design SQLite schema for active runs and events
2. migrate orchestrator active state into SQLite
3. migrate orchestration event log into same kernel
4. adapt tools to read from the kernel

### Phase 3: Product simplification

1. decide memory scope
2. simplify config surface
3. simplify observability surface

### Phase 4: Reconsider advanced features

1. evaluate whether parallel `BUILD` should return
2. evaluate whether hashline workflow needs expansion
3. evaluate whether a daemonized control plane is still necessary

## Final Recommendation

Do not spend the next iteration just patching edge cases around the current `BUILD` flow.

Fix the immediate correctness failures, yes, but use that work as the on-ramp to a clearer
architecture:

- deterministic control plane
- one durable source of truth
- optional features that justify themselves
- no fake concurrency
- no legacy parser in the main path

If we do that, the plugin can become simpler and more trustworthy at the same time.

If we do not do that, we will keep adding features faster than we increase confidence.
