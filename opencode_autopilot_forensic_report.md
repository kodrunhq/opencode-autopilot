# OpenCode Autopilot forensic analysis

## Executive summary

Your plugin is not failing for one single reason. It is failing because **three subsystems are misaligned at the same time**:

1. **The project kernel DB is being discovered by path, not by project identity.** The CLI expects `./.opencode-autopilot/kernel.db`. If `kernel.db` is in the repo root, `inspect runs/events/lessons` falls back to the global DB and reports emptiness even when the run data exists elsewhere.
2. **Memory and orchestration data are split across two different databases with no unified inspect layer.** Global `autopilot.db` holds observations/preferences/memories; project `kernel.db` holds runs/events/lessons. The current CLI makes this look like one store, but it is not.
3. **The previous run died mid-PLAN and the orchestrator had no reliable way to correlate the dead subagent session back to the pending dispatch.** The run stayed `IN_PROGRESS`, `RETROSPECTIVE` never ran, and therefore no lessons were extracted.

## What the uploaded artifacts prove

### Global DB (`autopilot.db`)

Observed rows:
- `projects`: 1
- `observations`: 1
- `memories`: 0
- `preference_records`: 0
- `project_lessons`: 0

The only captured memory-side artifact is a single error observation:
- session: `ses_2821e2f17ffeDs9NUwo8w5qinT`
- type: `error`
- content: `unknown: Unknown error`
- created_at: `2026-04-11T18:52:12.947Z`

### Project kernel DB (`kernel.db`)

Observed rows:
- `pipeline_runs`: 1
- `forensic_events`: 23
- `run_phases`: 8
- `run_pending_dispatches`: 1
- `run_processed_results`: 3
- `project_lessons`: 0

The stored run is:
- run id: `run_59d559b3256f2322`
- status: `IN_PROGRESS`
- current phase: `PLAN`
- last successful phases: RECON, CHALLENGE, ARCHITECT, EXPLORE
- pending dispatch: `dispatch_de9c3136789b` for `PLAN` / `oc-planner`

### Why the CLI looked empty

The CLI output showed:
- projects: 0 runs / 0 events / 0 lessons
- no runs found
- no events found
- no lessons found
- memory overview: 1 error observation, 0 preferences

That output is consistent with the plugin reading the **global** DB for memory and, because it could not find a local project kernel at the expected location, also using the wrong DB for runs/events/lessons.

## Root causes

### 1. Kernel DB path contract is too fragile

The codebase’s intended contract is:
- global memory DB: `~/.config/opencode/autopilot.db`
- project kernel DB: `<repo>/.opencode-autopilot/kernel.db`

The current implementation still exposes a footgun API that accepts a generic `artifactDirOrProjectRoot` and simply appends `kernel.db`. That means passing a project root instead of the artifact dir silently yields `<repo>/kernel.db`.

Consequence:
- one bad caller, one legacy migration, or one external script can create a root-level kernel DB
- `inspect` does **not** search the repo root for `kernel.db`; it only checks `.opencode-autopilot/kernel.db`
- therefore the data exists, but the CLI cannot see it

### 2. The plugin has two project registries with different IDs

The same repo exists in two databases with different project IDs:
- `autopilot.db`: `da954ffc-16ed-4d36-8aee-95d6601e7361`
- `kernel.db`: `200d2a57-0755-4779-9667-256caae1971a`

That is happening because project identity is resolved independently per DB, using generated UUIDs. The plugin does not maintain a deterministic cross-DB project key.

Consequence:
- there is no reliable way to produce a unified project summary from both DBs
- `inspect projects` / `inspect project` show counts from whichever DB is selected, not from both
- the UI/CLI *looks* coherent, but the storage model is not coherent

### 3. `inspect memory` does not actually expose memories

The CLI only supports:
- `inspect memory` → overview
- `inspect preferences`

It does **not** support listing/searching actual V2 `memories` records, even though the plugin ships `oc_memory_search`, `oc_memory_save`, and `oc_memory_forget` tools and stores real records in the `memories` table.

Consequence:
- from the CLI, there is effectively “no way to look at memory” in detail
- even if memories existed, the default formatter omits the actual memory list
- the overview emphasizes observations/preferences, which makes the V2 memory system feel invisible

### 4. Lessons are only filled at RETROSPECTIVE, and the run never reached RETROSPECTIVE

The run is stuck in `PLAN`. `RETROSPECTIVE` is still pending. Lesson extraction only happens when:
1. the pipeline reaches `RETROSPECTIVE`
2. the retrospector returns valid JSON
3. persistence succeeds

Because the run died at `PLAN`, `project_lessons` is correctly empty.

Consequence:
- empty lessons are expected for this failed run
- the empty lessons are not the primary bug; the stuck pending dispatch is

### 5. Memory/preferences are model-driven and sparse by design

Preferences and V2 memories are filled by either:
- explicit memory tools (`oc_memory_save` / `oc_memory_search`)
- narrow auto-capture heuristics from assistant output
- session error/decision/pattern observations

This specific run produced only one captured error observation and no successful memory save.

Consequence:
- empty preferences/memories are not evidence of broken SQLite writes
- they are evidence that the run aborted before producing save-worthy outputs and that the CLI lacks a real memory browser

### 6. The orchestrator cannot reliably recover a dead pending dispatch

The strongest structural bug is in pending dispatch recovery.

What we have:
- `run_pending_dispatches` stores `dispatch_id`, `phase`, `agent`, `issued_at`, `result_kind`, `task_id`
- forensic events store dispatches and session events

What we do **not** have:
- a stable link from pending dispatch → spawned session id
- a stable link from spawned session id → pending dispatch

In your uploaded kernel data, the planner dispatch exists and the planner session errors exist, but they are not joined in the state model. The run stays `IN_PROGRESS` with a stale pending dispatch.

Consequence:
- if a subagent aborts before returning a typed result envelope, the pipeline can remain wedged forever
- no automatic retry, interruption, or failure finalization happens
- the user must manually abandon or recover the run

### 7. The “general agent over and over again” issue was not caused by the plugin’s model-group registry

Your plugin config is set up for multiple groups and different primary models:
- architects → `zai-coding-plan/glm-5`
- challengers → `kimi-for-coding/kimi-k2-thinking`
- builders → `openai/gpt-5.3-codex`
- researchers → `openai/gpt-5.4`
- communicators/utilities → `openai/gpt-5.1-codex-mini`

The uploaded last-session transcript shows a different problem: the outer executor repeatedly called the generic `task` tool with `subagent_type: "general"` for RECON / CHALLENGE / ARCHITECT, then switched to `specialist-planner` for PLAN, which returned an empty task result.

Consequence:
- the plugin’s routing selected the right phase agents
- the execution layer then bypassed that by manually spawning generic tasks
- this is an integration/executor problem, not proof that the plugin registry itself collapsed everything to one model

## Direct answers to your questions

### Why are all the CLI commands empty?

They are not all empty. They are reading **different databases**.

- `inspect memory` and `inspect preferences` read the global `autopilot.db`
- `inspect runs/events/lessons` try to read `<repo>/.opencode-autopilot/kernel.db`
- if that file is missing, they fall back to the global DB, which has no pipeline runs/events/lessons

Because your `kernel.db` is in the repo root instead of the expected artifact directory, the CLI is looking in the wrong place.

### Why is there no way to look at the memory?

Because the CLI has no `inspect memories` or `inspect memory-search` view. It only has a **memory overview** and **preferences**. The real V2 memory browser exists only as runtime tools, not as an inspect command.

### How are lessons, preferences, runs and events even filled?

- **runs**: persisted from orchestrator state transitions into `kernel.db`
- **events**: appended to `kernel.db` and mirrored to `orchestration.jsonl` during orchestration/session activity
- **lessons**: written only when RETROSPECTIVE completes successfully
- **preferences/memories**: written into `autopilot.db` via explicit memory tools or narrow capture heuristics

### What is wrong with the plugin?

The main defects are:
1. brittle kernel DB path handling
2. split storage with no unified inspect layer
3. no CLI memory browser
4. no deterministic cross-DB project identity
5. no robust dispatch-to-session correlation for crash recovery
6. weak stuck-run recovery when a phase subagent aborts mid-flight

## Production-grade fixes

### Priority 0 — Stop the data visibility failures

1. **Harden kernel path APIs**
   - remove the ambiguous `artifactDirOrProjectRoot` API shape
   - `openKernelDb` should accept only an artifact dir or explicit file path
   - `openProjectKernelDb(projectRoot)` should be the only project-scoped entrypoint
   - add runtime guards that reject `<repo>` when `.opencode-autopilot` is expected

2. **Add automatic legacy-path migration**
   - on startup / inspect, if `<repo>/kernel.db` exists and `<repo>/.opencode-autopilot/kernel.db` does not, migrate or at least warn loudly
   - support one-time auto-move of `kernel.db`, `kernel.db-wal`, `kernel.db-shm`

3. **Teach `inspect` to detect both locations**
   - artifact dir first
   - repo-root legacy fallback second, with a warning banner
   - never silently fall back to global DB if a legacy root kernel exists

### Priority 1 — Make inspect honest

4. **Add `inspect memories`**
   - list actual V2 memory rows
   - filters: `--project`, `--kind`, `--scope`, `--query`, `--limit`

5. **Fix `inspect memory` output**
   - show `totalMemories`
   - show `memoriesByKind`
   - optionally surface the latest N memories inline

6. **Unify project summaries across DBs**
   - either merge global+kernel counts by canonical path/fingerprint
   - or make the DB scope explicit in every project summary so the counts cannot be misread

### Priority 2 — Fix run recovery

7. **Store session_id on pending dispatch records**
   - extend `run_pending_dispatches` with `session_id`
   - when dispatching a subagent, record the spawned session id
   - on `session.error` / `session.deleted`, resolve back to the pending dispatch

8. **Add automatic stuck-run finalization**
   - if pending dispatch session aborts without a typed result envelope:
     - mark run `INTERRUPTED` or `FAILED`
     - persist `failureContext`
     - clear stale pending dispatch
     - optionally trigger retry/fallback if configured

9. **Add `inspect stuck` / `oc_recover --auto`**
   - enumerate runs with pending dispatches older than threshold
   - offer repair actions: retry, abandon, mark interrupted

### Priority 3 — Fix project identity

10. **Adopt deterministic project IDs**
    - derive from normalized git remote + branch fallback to canonical realpath hash
    - use the same ID in both DBs
    - migrate existing rows by path/fingerprint

This removes the current situation where the same repo is `da95...` in one DB and `200d...` in another.

## Minimum code changes by file

- `src/kernel/database.ts`
  - remove ambiguous path API
  - add legacy-path detection/migration helpers

- `bin/inspect.ts`
  - detect repo-root legacy kernel
  - expose explicit DB scope in normal output
  - add `memories` view

- `src/inspect/repository.ts`
  - list/search memories
  - optionally aggregate global + project DB summaries

- `src/inspect/format-overview.ts`
  - include total memories and memory kinds

- `src/kernel/schema.ts`
  - add `session_id` to `run_pending_dispatches`

- `src/kernel/repository.ts`
  - persist pending dispatch session linkage

- `src/tools/orchestrate.ts`
  - record spawned session id for dispatches
  - auto-finalize failed pending dispatches

- `src/recovery/*`
  - add stale pending-dispatch repair path

- `src/projects/resolve.ts`
  - move from random UUID to deterministic project key

## What is a bug vs what is expected

### Real bugs
- repo-root kernel DB is invisible to inspect
- inspect has no memory browser
- memory overview hides memory counts already computed in code
- stale pending dispatch survives subagent abort
- project identity differs across DBs for the same repo

### Expected behavior in this failed run
- lessons are empty because RETROSPECTIVE never ran
- preferences/memories are empty because there was no successful save-worthy capture
- one error observation exists because the run aborted

## Bottom line

The plugin is **partially working**:
- it routed and persisted a real orchestration run
- it wrote RECON / CHALLENGE / ARCHITECT / EXPLORE artifacts
- it logged forensic events

But it is **not production-grade yet** because:
- storage discovery is brittle
- inspect is incomplete and misleading
- memory is not inspectable from the CLI
- crash recovery for pending dispatches is structurally incomplete

The fastest path to restore trust is:
1. migrate `kernel.db` into `.opencode-autopilot/`
2. add legacy-path detection so this never silently breaks again
3. add `inspect memories`
4. add pending-dispatch session correlation and stuck-run recovery
5. move to deterministic project IDs
