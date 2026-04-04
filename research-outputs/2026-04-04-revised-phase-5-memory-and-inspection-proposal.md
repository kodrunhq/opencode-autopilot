# Revised Phase 5 Proposal: Learning Store and Inspection Surface

Date: 2026-04-04
Status: proposed

## Goal

The plugin should get better over time by learning:

- explicit user preferences
- project-specific lessons from mistakes
- durable run and failure history that can be inspected later

This learning model must work across multiple active repositories without putting authoritative state
inside the repo checkout.

## Decision

Replace the original Phase 5 choice with a narrower and more explicit design:

1. Keep memory as a real product feature.
2. Move authoritative persistence to one user-level SQLite database in app data.
3. Make project identity explicit and stable instead of path-hash driven.
4. Treat CLI inspection as a first-class requirement, not an afterthought.
5. Stop relying on generic free-form memory capture as the main learning mechanism.

Recommended database location:

- `~/.config/opencode/autopilot.db`

Recommended repo-local directory role:

- keep `.opencode-autopilot/` only for user-visible artifacts and compatibility exports
- do not store authoritative database state there

## Why The Current Design Falls Short

Current gaps observed in the codebase:

- preferences exist in storage and retrieval, but there is no active runtime path writing them
- lessons from retrospectives are the only learning path that is clearly working end to end
- generic memory capture listens for events like `app.decision` and `app.phase_transition`, but those
  do not appear to be the main runtime source of learning today
- project identity is derived from a hash of the current path, so moving or renaming a repo can
  break continuity
- project-local `kernel.db` avoids collisions, but it creates an avoidable risk of accidental Git
  commits and makes cross-project inspection harder

The result is an ambiguous memory system: parts of it look rich, but the product promise is only
partially delivered.

## Revised Phase 5 Objective

When Phase 5 is complete, the system should have:

- one authoritative user-level database for active runs, forensics, lessons, and preferences
- explicit project identity that survives path changes
- memory that is inspectable, attributable, and grounded in real product value
- a CLI inspection surface that lets a user understand what the plugin learned and how it behaved

## Authoritative Storage Model

### Database placement

Use one user-level SQLite database:

- `~/.config/opencode/autopilot.db`

Rationale:

- no Git commit risk
- simple backup and migration story
- easy cross-project inspection
- no need for hashed filenames
- simpler CLI query surface

### What remains in `.opencode-autopilot/`

Keep only non-authoritative project-local artifacts such as:

- phase output files the user may want to open directly
- optional exported summaries for compatibility
- temporary working artifacts if needed by the orchestrator

Do not keep any authoritative copies of:

- active run state
- forensic event history
- review state
- review memory
- lesson memory
- learned preferences

## Project Identity Strategy

Path must not be identity.

Introduce a stable `project_id` and resolve projects using a registry.

### Required behavior

1. Opening the same repo at the same path resolves to the same `project_id`.
2. Renaming or moving the repo on disk does not lose history.
3. Importing the DB on another machine allows the same project to reconnect when possible.
4. Ambiguous matches are surfaced explicitly instead of silently merging the wrong projects.

### Proposed model

Primary identity:

- `project_id` as a generated UUID

Matching inputs:

- exact current path
- historical known paths
- Git fingerprint when available

Recommended lookup order:

1. match current path exactly
2. match historical path exactly
3. match normalized Git remote fingerprint if there is one clear candidate
4. otherwise create a new `project_id`

### Git fingerprint guidance

Use Git data only as a relinking aid, not as the only identity source.

Store normalized repository signals such as:

- canonical remote URL
- default branch when available
- current repo root name for operator visibility

If multiple projects share the same remote and the match is ambiguous, require explicit user action
to relink rather than guessing.

## What The System Should Learn

The system should learn three explicit things.

### 1. User preferences

These are statements about how the user wants the assistant to behave.

Examples:

- prefers small diffs
- wants tests run after non-trivial changes
- dislikes repo-local hidden databases
- prefers a particular frontend or backend style

Rules:

- preferences can be global or project-scoped
- preferences should come from explicit user statements or repeated confirmed behavior
- each preference should carry evidence, confidence, and last-confirmed time
- preferences should be reviewable and removable by the user

### 2. Project lessons

These are lessons learned from work in one project.

Examples:

- always run a specific verification command before shipping
- avoid a known flaky migration path
- a particular build step frequently fails unless a cache is cleared
- a recurring review issue should be checked during BUILD

Rules:

- lessons are project-scoped
- lessons should be tied to a run, phase, or forensic source when possible
- lessons should be structured by domain and source
- lessons should be easy to inspect and prune

### 3. Durable run history

This is the forensic record of what happened.

Examples:

- pipeline runs
- phase transitions
- dispatches
- deterministic control-plane errors
- recovery attempts

Rules:

- run history is not prompt memory by default
- run history is the evidence base for lessons and diagnostics
- inspection tools should be able to explain a failed run without SQL

## What Should Stop Being Core

Generic free-form observation capture should stop being the central learning model.

It can remain as:

- a migration source
- an experimental subsystem
- a future enrichment layer

It should not remain the main product claim unless it is shown to improve outcomes in a measurable
way.

## Injection Strategy

Prompt injection should be deterministic, bounded, and provenance-aware.

Inject only these categories:

1. confirmed global preferences
2. confirmed project preferences
3. phase-relevant project lessons
4. small, explicit failure-avoidance notes derived from recent project incidents when useful

Do not inject:

- raw forensic logs
- generic session trivia
- large unstructured observation dumps

Every injected item should have a traceable source in storage.

## Inspection Surface

The user should be able to inspect everything important from the CLI.

### CLI goals

- no SQL required
- no path spelunking required
- human-readable output by default
- machine-readable `--json` output for automation

### Proposed command family

- `opencode-autopilot inspect projects`
- `opencode-autopilot inspect project <selector>`
- `opencode-autopilot inspect runs --project <selector>`
- `opencode-autopilot inspect run <run-id>`
- `opencode-autopilot inspect events --project <selector> [--run <run-id>]`
- `opencode-autopilot inspect lessons --project <selector>`
- `opencode-autopilot inspect preferences`
- `opencode-autopilot inspect preferences --project <selector>`
- `opencode-autopilot inspect paths --project <selector>`
- `opencode-autopilot inspect export --project <selector> --format json`

### Shared query layer

The CLI and plugin tools should use the same read layer.

That means:

- `oc_logs`
- `oc_forensics`
- `oc_pipeline_report`
- `oc_session_stats`
- future memory inspection tools

should all sit on top of the same project-aware repository queries instead of each tool inventing
its own storage access path.

## Schema Direction

The exact schema can evolve, but the core model should look like this.

### Project registry

- `projects`
  - `project_id`
  - `display_name`
  - `current_path`
  - `first_seen_at`
  - `last_seen_at`
- `project_paths`
  - `project_id`
  - `path`
  - `first_seen_at`
  - `last_seen_at`
  - `is_current`
- `project_git_fingerprints`
  - `project_id`
  - `normalized_remote_url`
  - `default_branch`
  - `first_seen_at`
  - `last_seen_at`

### Active run kernel

- `pipeline_runs`
  - add `project_id`
- `run_phases`
- `run_tasks`
- `run_pending_dispatches`
- `run_processed_results`

### Durable forensics

- `forensic_events`
  - add `project_id`
  - keep `run_id`, `session_id`, `phase`, `dispatch_id`, `task_id`, `code`, `message`, `payload`

### Review and lesson state

- `active_review_state`
  - key by `project_id` instead of a global `slot = 1`
- `project_review_memory`
  - key by `project_id`
- `project_lessons`
  - one row per lesson, not one opaque blob per project

### Preferences

- `user_preferences`
  - global preferences
- `project_preferences`
  - project-scoped preferences
- `preference_evidence`
  - links a preference to source messages, runs, or user confirmations

### Migration journal

- `migration_journal`
  - records what legacy sources were imported and when

## Migration Principles

1. Import legacy data, then stop writing to legacy authoritative stores.
2. Keep compatibility exports only while they are needed.
3. Never require the user to manually copy raw SQLite rows.
4. Provide CLI inspection before asking the user to trust the new model.

### Legacy sources to import

- existing global memory DB
- repo-local `kernel.db`
- `lesson-memory.json`
- `review-memory.json`
- `state.json`
- `orchestration.jsonl`

## Revised Implementation Sequence

### Wave 1: create the unified user-level store

Files:

- `src/kernel/database.ts`
- `src/kernel/schema.ts`
- `src/kernel/migrations.ts`
- `src/kernel/repository.ts`
- new `src/projects/identity.ts`
- new tests under `tests/kernel/` and `tests/projects/`

Action:

- move kernel storage from repo-local artifact dirs to a user-level DB
- add project registry tables and project-aware keys
- change review state and review memory tables to be keyed by `project_id`

Done when:

- active runs and forensic queries are project-aware without relying on one DB per repo

### Wave 2: replace path-hash identity with project registry resolution

Files:

- `src/memory/project-key.ts`
- `src/index.ts`
- `src/memory/capture.ts`
- `src/memory/retrieval.ts`
- new `src/projects/repository.ts`
- tests in `tests/memory/` and `tests/projects/`

Action:

- remove path-hash identity as the primary lookup mechanism
- resolve the current repo to a stable `project_id`
- record historical paths and Git fingerprints for relinking

Done when:

- moving a repo does not create silent memory loss

### Wave 3: narrow memory to explicit product learning

Files:

- `src/memory/capture.ts`
- `src/memory/repository.ts`
- `src/memory/retrieval.ts`
- new `src/memory/preferences.ts`
- `src/orchestrator/handlers/retrospective.ts`
- `src/orchestrator/lesson-memory.ts`
- `src/orchestrator/lesson-injection.ts`
- tests in `tests/memory/` and `tests/orchestrator/`

Action:

- add explicit preference capture and evidence tracking
- keep lessons as the primary project learning path
- demote generic observations from primary product behavior

Done when:

- the system can explain what it learned and why it was injected

### Wave 4: build the shared inspection query layer

Files:

- new `src/inspect/repository.ts`
- new `src/inspect/formatters.ts`
- `src/tools/logs.ts`
- `src/tools/forensics.ts`
- `src/tools/pipeline-report.ts`
- `src/tools/session-stats.ts`
- `src/tools/memory-status.ts`
- new tests under `tests/inspect/` and affected tool tests

Action:

- create project-aware read queries that back both CLI and plugin tools
- improve memory inspection beyond summary counts

Done when:

- logs, lessons, preferences, and runs can all be inspected through one consistent query model

### Wave 5: expose inspection in the CLI

Files:

- `bin/cli.ts`
- new `bin/inspect.ts` or equivalent shared command module
- `README.md`
- `tests/cli/cli.test.ts`

Action:

- add the `inspect` command family
- keep the CLI away from orchestration writes, but allow read-only operational inspection

Done when:

- a user can inspect project state, learned preferences, lessons, and run history from the CLI

### Wave 6: migrate and remove repo-local authoritative DB state

Files:

- `src/kernel/database.ts`
- `src/kernel/repository.ts`
- `src/orchestrator/state.ts`
- `src/observability/forensic-log.ts`
- `src/review/memory.ts`
- `src/orchestrator/lesson-memory.ts`
- docs/tests affected by migration

Action:

- import legacy repo-local kernel data into the user-level DB
- stop treating repo-local DB files as authoritative
- keep compatibility exports only if they have a clear user-facing purpose

Done when:

- no authoritative SQLite database lives inside the repo checkout

## Verification Expectations

At minimum, the finished Phase 5 work should prove:

- multiple repos can run concurrently against one user-level DB without collisions
- project identity survives path changes when relinking signals are available
- preferences and lessons are inspectable and removable
- failed runs can be explained from CLI inspection output
- importing existing local data does not silently lose project history

Suggested verification commands after implementation:

- `bun test tests/kernel tests/projects tests/memory tests/orchestrator tests/tools tests/cli`
- `bun run lint`
- `bunx tsc --noEmit`

## Recommendation

Proceed with a revised Phase 5 based on one user-level SQLite database and explicit project-aware
inspection.

This preserves the real product promise of learning over time, removes the Git-risk of repo-local
databases, and gives the plugin a path to a serious inspection UX instead of a pile of hidden files.
