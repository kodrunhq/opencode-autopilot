# Revised Phase 5 Implementation Plan

Date: 2026-04-04
Status: proposed

Related documents:

- `research/2026-04-04-autopilot-implementation-plan.md`
- `research-outputs/2026-04-04-revised-phase-5-memory-and-inspection-proposal.md`

## Goal

Implement a project-aware learning store that:

- improves over time from explicit user preferences and project lessons
- preserves durable run and forensic history across multiple repositories
- stores authoritative state outside the repo checkout
- exposes a read-only inspection surface through shared queries and CLI commands

## Decision Updates

This plan supersedes the original Phase 5 fork in the April 4 implementation plan.

Updated direction:

1. keep memory as a real feature, but narrow it to explicit product value
2. move authoritative persistence to one user-level SQLite database
3. replace path-hash project identity with a stable project registry
4. allow a read-only CLI inspection surface

This plan also partially updates the original Phase 6 assumption that the CLI should stay limited to
`install`, `configure`, and `doctor`.

New CLI rule:

- CLI remains read-only for operational inspection
- CLI does not become a second orchestration write surface

## Scope Boundaries

In scope:

- unified user-level SQLite storage
- project identity and relinking
- project-aware active-run persistence
- project-aware review and lesson persistence
- explicit preference capture and retrieval
- shared inspection query layer
- CLI inspection commands
- migration from legacy repo-local and global stores

Out of scope for this phase:

- TUI inspection UI
- cloud sync or remote storage
- automatic cross-machine project relinking beyond path history and Git fingerprint heuristics
- worktree or parallel `BUILD` restoration

## Delivery Principles

1. no authoritative SQLite file should remain inside the repo checkout
2. all reads and writes must be project-aware before multi-project claims are made
3. injected memory must be attributable to structured sources
4. CLI inspection must ship before asking users to trust the new storage model
5. legacy imports must be automatic and loss-aware

## Wave 1: Unified Storage Foundation

### Task 1: Unify DB bootstrap around one user-level SQLite file

Files:

- `src/kernel/database.ts`
- `src/memory/database.ts`
- `src/utils/paths.ts`
- create `tests/kernel/database.test.ts`
- `tests/memory/database.test.ts`

Action:

- add a single default runtime DB location at `~/.config/opencode/autopilot.db`
- keep test-time support for explicit `:memory:` and temp DB paths
- make kernel and memory modules open the same DB file in normal runtime
- preserve `WAL`, foreign key enforcement, and busy timeout behavior

Depends on:

- none

Verify:

- `bun test tests/kernel/database.test.ts tests/memory/database.test.ts`
- `bunx tsc --noEmit`

Done when:

- normal runtime uses one user-level DB file
- tests can still inject isolated databases without using the real app-data location

### Task 2: Add project registry schema and repository

Files:

- `src/kernel/schema.ts`
- `src/kernel/types.ts`
- create `src/projects/schemas.ts`
- create `src/projects/types.ts`
- create `src/projects/repository.ts`
- create `tests/projects/repository.test.ts`

Action:

- add project registry tables for:
  - `projects`
  - `project_paths`
  - `project_git_fingerprints`
- define Zod schemas and TypeScript types for project identity records
- add repository functions for create, update, lookup, path-history writes, and fingerprint writes

Depends on:

- Task 1

Verify:

- `bun test tests/projects/repository.test.ts tests/kernel/repository.test.ts`
- `bunx tsc --noEmit`

Done when:

- the codebase has an explicit project registry instead of relying on per-project DB separation

## Wave 2: Stable Project Identity

### Task 3: Implement project resolution and relinking

Files:

- create `src/projects/resolve.ts`
- `src/memory/project-key.ts`
- create `tests/projects/resolve.test.ts`
- `tests/memory/project-key.test.ts`

Action:

- implement stable `project_id` resolution using:
  - current path
  - historical paths
  - Git fingerprint when available
- demote `computeProjectKey()` from primary identity logic
- keep any hash helper only for legacy import compatibility if still needed

Depends on:

- Task 2

Verify:

- `bun test tests/projects/resolve.test.ts tests/memory/project-key.test.ts`
- `bunx tsc --noEmit`

Done when:

- project identity survives path changes when a clear relinking signal exists
- ambiguous matches do not silently merge unrelated projects

### Task 4: Wire project resolution into runtime entry points

Files:

- `src/index.ts`
- `src/tools/orchestrate.ts`
- `src/tools/quick.ts`
- `src/tools/state.ts`
- `src/tools/review.ts`
- `tests/tools/orchestrate.test.ts`
- `tests/tools/quick.test.ts`
- `tests/tools/state.test.ts`
- `tests/review/tool.test.ts`

Action:

- resolve the active project once from the runtime project root
- stop scattering ad hoc project lookup assumptions across tools
- ensure runtime components pass resolved project identity into persistence and query layers

Depends on:

- Task 3

Verify:

- `bun test tests/tools/orchestrate.test.ts tests/tools/quick.test.ts tests/tools/state.test.ts tests/review/tool.test.ts`
- `bunx tsc --noEmit`

Done when:

- runtime entry points use one consistent project resolution path

## Wave 3: Multi-Project Kernel Safety

### Task 5: Make pipeline state storage project-aware

Files:

- `src/kernel/schema.ts`
- `src/kernel/types.ts`
- `src/kernel/repository.ts`
- `src/orchestrator/state.ts`
- `tests/kernel/repository.test.ts`
- `tests/orchestrator/state.test.ts`

Action:

- add `project_id` scoping to active-run tables and lookups
- stop using "latest run in the DB" as an unscoped read path
- keep compare-and-swap state semantics intact under the shared DB model

Depends on:

- Task 4

Verify:

- `bun test tests/kernel/repository.test.ts tests/orchestrator/state.test.ts`
- `bunx tsc --noEmit`

Done when:

- one DB can safely store active runs for multiple repositories without collisions

### Task 6: Make forensic event storage project-aware

Files:

- `src/kernel/schema.ts`
- `src/kernel/types.ts`
- `src/kernel/repository.ts`
- `src/observability/forensic-log.ts`
- `tests/orchestrator/forensics.test.ts`
- `tests/tools/logs.test.ts`
- `tests/tools/pipeline-report.test.ts`
- `tests/tools/session-stats.test.ts`

Action:

- add `project_id` scoping to forensic events
- preserve run/session filters under the shared DB model
- keep JSONL files as compatibility exports only if they still serve a user-visible purpose

Depends on:

- Task 5

Verify:

- `bun test tests/orchestrator/forensics.test.ts tests/tools/logs.test.ts tests/tools/pipeline-report.test.ts tests/tools/session-stats.test.ts`
- `bunx tsc --noEmit`

Done when:

- event queries no longer depend on one DB per repo for correctness

### Task 7: Make review state and review memory project-aware

Files:

- `src/kernel/schema.ts`
- `src/kernel/types.ts`
- `src/kernel/repository.ts`
- `src/review/memory.ts`
- `src/tools/review.ts`
- `tests/review/memory.test.ts`
- `tests/review/tool.test.ts`

Action:

- replace `slot = 1` assumptions with `project_id` keyed storage
- keep review-state and review-memory mirrors only as compatibility exports during migration

Depends on:

- Task 5

Verify:

- `bun test tests/review/memory.test.ts tests/review/tool.test.ts`
- `bunx tsc --noEmit`

Done when:

- review state and review memory are safe in one shared DB across multiple projects

### Task 8: Make lesson persistence queryable and project-aware

Files:

- `src/kernel/schema.ts`
- `src/kernel/repository.ts`
- `src/orchestrator/lesson-memory.ts`
- `src/orchestrator/handlers/retrospective.ts`
- `src/orchestrator/lesson-injection.ts`
- `tests/orchestrator/lesson-memory.test.ts`
- `tests/orchestrator/lesson-injection.test.ts`

Action:

- stop treating lessons as an opaque blob that is only writable through a per-project DB assumption
- store lessons in a form that can later be listed and filtered by project, domain, and source
- preserve lesson injection behavior while making lessons inspection-friendly

Depends on:

- Task 5

Verify:

- `bun test tests/orchestrator/lesson-memory.test.ts tests/orchestrator/lesson-injection.test.ts`
- `bunx tsc --noEmit`

Done when:

- lessons remain usable for injection and become directly inspectable

## Wave 4: Explicit Learning Model

### Task 9: Add structured preference storage with evidence

Files:

- `src/memory/schemas.ts`
- `src/memory/types.ts`
- `src/memory/repository.ts`
- create `src/memory/preferences.ts`
- create `tests/memory/preferences.test.ts`
- `tests/memory/repository.test.ts`

Action:

- add explicit support for:
  - global user preferences
  - project-scoped preferences
  - evidence rows linking a preference to a user statement, run, or confirmation source
- define update and retrieval APIs that keep provenance intact

Depends on:

- Task 2

Verify:

- `bun test tests/memory/preferences.test.ts tests/memory/repository.test.ts`
- `bunx tsc --noEmit`

Done when:

- preferences are structured, attributable, and queryable

### Task 10: Narrow memory capture and retrieval to explicit product value

Files:

- `src/memory/capture.ts`
- `src/memory/retrieval.ts`
- `src/memory/injector.ts`
- `src/index.ts`
- `tests/memory/capture.test.ts`
- `tests/memory/retrieval.test.ts`
- `tests/memory/injector.test.ts`
- `tests/integration/cross-feature.test.ts`

Action:

- stop treating generic free-form observations as the main learning path
- inject only bounded, provenance-aware content:
  - confirmed global preferences
  - confirmed project preferences
  - phase-relevant lessons
  - small failure-avoidance notes when justified by recent incidents
- keep any generic observation logic only if it still has a clear supporting role

Depends on:

- Task 8
- Task 9

Verify:

- `bun test tests/memory/capture.test.ts tests/memory/retrieval.test.ts tests/memory/injector.test.ts tests/integration/cross-feature.test.ts`
- `bunx tsc --noEmit`

Done when:

- every injected memory item has a traceable source and a bounded format

## Wave 5: Shared Inspection Surface

### Task 11: Build the shared inspection query layer

Files:

- create `src/inspect/repository.ts`
- create `src/inspect/formatters.ts`
- create `tests/inspect/repository.test.ts`

Action:

- add shared read queries for:
  - projects
  - paths
  - runs
  - events
  - lessons
  - preferences
- ensure the query layer is project-aware and reusable from both plugin tools and CLI commands

Depends on:

- Task 6
- Task 8
- Task 9

Verify:

- `bun test tests/inspect/repository.test.ts`
- `bunx tsc --noEmit`

Done when:

- there is one authoritative read model for inspection workflows

### Task 12: Switch plugin inspection tools to the shared query layer

Files:

- `src/tools/logs.ts`
- `src/tools/forensics.ts`
- `src/tools/pipeline-report.ts`
- `src/tools/session-stats.ts`
- `src/tools/memory-status.ts`
- `tests/tools/logs.test.ts`
- `tests/tools/pipeline-report.test.ts`
- `tests/tools/session-stats.test.ts`
- `tests/tools/memory-status.test.ts`
- `tests/orchestrator/forensics.test.ts`

Action:

- rebase inspection tools onto `src/inspect/repository.ts`
- expand memory inspection beyond coarse summary counts
- keep tool behavior human-readable while preserving structured JSON outputs

Depends on:

- Task 11

Verify:

- `bun test tests/tools/logs.test.ts tests/tools/pipeline-report.test.ts tests/tools/session-stats.test.ts tests/tools/memory-status.test.ts tests/orchestrator/forensics.test.ts`
- `bunx tsc --noEmit`

Done when:

- plugin inspection tools and future CLI commands read through the same query surface

### Task 13: Add read-only CLI inspection commands

Files:

- `bin/cli.ts`
- create `bin/inspect.ts`
- `README.md`
- `tests/cli/cli.test.ts`

Action:

- add an `inspect` command family with project, run, event, lesson, preference, and path views
- support human-readable output by default and `--json` for automation
- keep all inspect commands read-only

Depends on:

- Task 11

Verify:

- `bun test tests/cli/cli.test.ts`
- `bunx tsc --noEmit`

Done when:

- a user can inspect the learning store and run history from CLI without SQL

## Wave 6: Migration and Cleanup

### Task 14: Add legacy importers and migration journaling

Files:

- `src/kernel/migrations.ts`
- `src/kernel/repository.ts`
- create `src/kernel/importers.ts`
- `src/memory/database.ts`
- `src/orchestrator/state.ts`
- `src/observability/forensic-log.ts`
- `src/review/memory.ts`
- `src/orchestrator/lesson-memory.ts`
- create `tests/kernel/importers.test.ts`

Action:

- import legacy sources into the unified DB:
  - existing global memory DB
  - repo-local `kernel.db`
  - `state.json`
  - `orchestration.jsonl`
  - `review-memory.json`
  - `lesson-memory.json`
- record imported sources in a migration journal to avoid silent double-imports

Depends on:

- Task 13

Verify:

- `bun test tests/kernel/importers.test.ts tests/kernel/repository.test.ts tests/memory/database.test.ts`
- `bunx tsc --noEmit`

Done when:

- existing installs migrate automatically into the unified DB without silent data loss

### Task 15: Remove repo-local authoritative DB writes

Files:

- `src/kernel/database.ts`
- `src/utils/paths.ts`
- `src/orchestrator/state.ts`
- `src/observability/forensic-log.ts`
- `src/review/memory.ts`
- `src/orchestrator/lesson-memory.ts`
- docs and tests affected by storage-path changes

Action:

- stop treating repo-local SQLite as authoritative
- keep `.opencode-autopilot/` only for non-authoritative artifacts and compatibility exports that
  still have a user-facing purpose
- update docs to reflect the new storage boundary clearly

Depends on:

- Task 14

Verify:

- `bun test`
- `bun run lint`
- `bunx tsc --noEmit`

Done when:

- no authoritative SQLite database is created inside project roots
- the repo-local artifact directory is clearly non-authoritative

## Exit Criteria

Phase 5 is complete when all of the following are true:

1. one user-level DB is authoritative for runs, forensics, lessons, and preferences
2. multiple repos can operate concurrently without collisions in that DB
3. project identity survives path changes when relinking signals are available
4. injected memory is explicit, bounded, and traceable to stored sources
5. users can inspect project history and learned state from the CLI without SQL
6. repo-local storage is no longer authoritative

## Recommended Execution Order

Start with Wave 1 and Wave 2 before any retrieval or CLI work.

Reason:

- project identity and storage shape determine everything else
- inspection work is wasted if it lands on the wrong storage contract
- memory quality work is wasted if the system still cannot attribute data to the right project

## First Implementation Slice

If execution starts immediately, the best first slice is:

1. Task 1
2. Task 2
3. Task 3

That slice establishes the storage path, project registry, and identity resolution model that the
rest of the phase depends on.
