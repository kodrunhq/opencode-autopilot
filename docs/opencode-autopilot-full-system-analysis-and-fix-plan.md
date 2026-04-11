# OpenCode Autopilot — Full System Analysis, Root Causes, and Fix Plan

## Purpose

This document is the implementation base for the current failure state of the OpenCode Autopilot plugin.

It is based on:

- the current repository zip,
- the attached last-session transcripts,
- the attached CLI inspect output,
- the attached `kernel.db`, `autopilot.db`, and `orchestration.jsonl`,
- the current OpenCode plugin/tool/server model.

This is not a patch memo. It is a system diagnosis.

---

## Executive diagnosis

The plugin is failing for structural reasons, not because the idea is impossible.

The current system has four independent classes of failure:

1. **Storage topology is inconsistent.**
   The plugin writes different categories of state into different databases and locations with inconsistent defaults. That is why you have a `kernel.db` inside the project folder, a separate global `autopilot.db`, and a JSONL forensic mirror.

2. **Pipeline start authorization is broken.**
   `oc_route` issues a durable route ticket, but `oc_orchestrate` validates it against a message identity that is not stable across the two tool calls. The practical result is repeated `E_ROUTE_TOKEN_MISMATCH` errors before a run is ever created.

3. **There are still multiple control-plane gates at once.**
   The plugin currently mixes a durable route-ticket system with a legacy in-memory intent gate. Even where the durable gate is more correct, the legacy gate still exists and can fail independently.

4. **Logging is architecturally wrong for plugin runtime.**
   Module-level loggers are instantiated before logging is initialized. The fallback logger writes to `console.log`, so debug strings leak into the OpenCode TUI instead of staying in forensic logs or proper toast surfaces.

The consequence is exactly what you are seeing:

- pipeline start fails before creating a run,
- debug text contaminates the UI,
- inspect views appear incoherent,
- state is split across databases,
- operator trust is destroyed.

---

## Direct answers to your three main questions

### 1. Why is there a `kernel.db` within the project folder?

Because the current code still opens the kernel database using the **project root** in key control-plane paths instead of the project artifact directory.

The critical problem is this pattern:

- `src/tools/route.ts` opens the kernel DB with `openKernelDb(context.projectRoot)`
- `src/tools/orchestrate.ts` also opens the kernel DB with `openKernelDb(context.projectRoot)`

But `openKernelDb(base)` simply does `join(base, "kernel.db")`.

So if `base === /path/to/repo`, the file is created as:

- `/path/to/repo/kernel.db`

not:

- `/path/to/repo/.opencode-autopilot/kernel.db`

This is not a mystery file. It is exactly what the code currently tells Bun SQLite to do.

### 2. Why is the pipeline not working?

Because the route-ticket validation contract is wrong.

The current logic is:

- `oc_route` creates a durable route ticket in `route_tickets`
- that ticket is bound to:
  - `projectId`
  - `sessionId`
  - `messageId`
  - `intent`
- then `oc_orchestrate` tries to validate and consume that ticket
- validation requires the **same `messageId`**

That is the breaking point.

In practice, the `messageID` visible to `oc_route` and the `messageID` visible to `oc_orchestrate` are not stable enough to serve as a strict equality key for pipeline-start authorization.

So the system repeatedly issues fresh route tickets and then rejects them with:

- `E_ROUTE_TOKEN_MISMATCH`
- reason: `Route ticket message mismatch`

This failure happens **before** the pipeline creates a run.

The attached local `kernel.db` confirms that:

- project registry contains the one repo,
- route tickets exist,
- route tickets remain unconsumed,
- `pipeline_runs` is empty.

That means start authorization fails before orchestration state is persisted.

### 3. Why are there so many projects in `inspect projects` if we only tested one repo/session?

Because `inspect` is reading the **global** `autopilot.db`, not the local project kernel DB.

That global database already contains hundreds of project records, including temporary test directories such as:

- `forensics-project-*`
- `review-tool-*`
- `lesson-test-*`
- `log-writer-*`
- `session-logs-*`
- `orchestrate-tool-test-*`
- `report-test-*`
- `stats-test-*`
- `replay-a-*`

These names match the temp-directory prefixes used by the repository test suite and helper tests.

So the inspect output is not lying. It is just reading the wrong scope by default for your current debugging purpose.

---

## Evidence from the attached runtime state

### Attached `kernel.db`

Inspection shows:

- only **1 project** registered: the real repo (`gloomberg`)
- **5 route tickets** in `route_tickets`
- **0 pipeline runs** in `pipeline_runs`
- **0 forensic events** in that local kernel snapshot

Interpretation:

- route issuance worked,
- run creation did not,
- the failure is at pipeline start authorization, not deep inside the pipeline.

### Attached `autopilot.db`

Inspection shows roughly:

- **699 projects**
- **24 pipeline runs**
- **1830 forensic events**

Interpretation:

- the global DB is shared state,
- it has historical/test pollution,
- it is not a clean representation of the current repo/session,
- using it as the default inspect target creates operator confusion.

### Attached `orchestration.jsonl`

The attached JSONL shows normal session-start and tool-complete events, but not a real pipeline start sequence for the failing session. That again fits the failure mode: start authorization breaks before orchestration meaningfully begins.

---

## Root cause cluster A — storage topology is split and internally inconsistent

### Current stores

The current system effectively has three state planes:

1. **Global SQLite store**
   - `autopilot.db`
   - used by memory, project registry, and inspect by default

2. **Kernel SQLite store**
   - `kernel.db`
   - intended for project-scoped pipeline/runtime state
   - but currently sometimes written to project root, sometimes artifact dir

3. **Forensic JSONL mirror**
   - `orchestration.jsonl`
   - project-scoped append-only log mirror

### Why this is bad

This creates all of the following problems:

- a user cannot tell which DB is authoritative,
- inspect defaults to the global DB even when the user is debugging one repo,
- project-local control-plane state and global memory/project identity drift apart,
- temp/test repos contaminate real operator views,
- forensic evidence is duplicated across SQLite and JSONL,
- path-based debugging becomes guesswork.

### Files involved

- `src/utils/paths.ts`
- `src/kernel/database.ts`
- `src/memory/database.ts`
- `src/inspect/repository.ts`
- `bin/inspect.ts`
- `src/observability/forensic-log.ts`
- `src/tools/route.ts`
- `src/tools/orchestrate.ts`

### Required fix

Adopt one explicit storage topology:

#### Global DB
Only for **user-scoped** and **cross-project** state:

- preferences
- user memory
- maybe global provider/cache metadata

Path:

- `~/.config/opencode/autopilot.db`

#### Project DB
Only for **repo-scoped** operational state:

- route tickets
- pipeline runs
- forensic events
- background tasks
- graph index
- review state
- project lessons/review memory

Path:

- `<repo>/.opencode-autopilot/kernel.db`

#### Project JSONL mirror
Optional, secondary, never primary.

Path:

- `<repo>/.opencode-autopilot/orchestration.jsonl`

### Non-negotiable implementation rule

Every project-scoped tool must resolve:

- `projectRoot`
- `artifactDir = getProjectArtifactDir(projectRoot)`

and pass **artifactDir**, not projectRoot, into kernel operations.

---

## Root cause cluster B — the route-ticket contract is wrong

### Current behavior

`oc_route` creates a ticket with:

- `projectId`
- `sessionId`
- `messageId`
- `intent`
- `usePipeline`

`oc_orchestrate` validates using the same tuple.

### Why it fails

The strict equality on `messageId` is not reliable for this flow.

A route ticket should authorize a pipeline start for the **same user turn / same session / same repo / same intent**.

It should not depend on a fragile assistant/tool-call message identifier unless OpenCode guarantees that `messageID` remains identical across both `oc_route` and the subsequent `oc_orchestrate` call in the same turn.

The attached session shows repeated fresh tickets being rejected with message mismatch. That proves the assumption is false in practice for this plugin runtime.

### Files involved

- `src/tools/route.ts`
- `src/tools/orchestrate.ts`
- `src/routing/route-ticket-repository.ts`
- `src/routing/route-token.ts`

### Correct fix

There are two acceptable designs.

#### Option A — remove `messageId` from route-ticket validation entirely

Bind tickets only to:

- `projectId`
- `sessionId`
- `intent`
- TTL
- single-use

This is the simplest correct fix.

It is strong enough because the ticket is already:

- session-bound,
- project-bound,
- intent-bound,
- short-lived,
- single-use.

#### Option B — bind to a stable user-turn identifier, not `messageID`

If strict turn binding is required, create and persist a dedicated `turnId` when a new user message is detected from `message.updated`. Then use that same `turnId` in both `oc_route` and `oc_orchestrate`.

This is more complex and only worth it if you truly need per-turn strictness.

### Recommended decision

Use **Option A** now.

Reason:

- it fixes the actual failure quickly,
- it removes the unstable field,
- it is enough for the current threat model,
- it greatly simplifies reasoning about start authorization.

---

## Root cause cluster C — two authorization systems still exist

The plugin still has two separate start-authorization systems:

1. **Durable route tickets** in SQLite
2. **Legacy in-memory intent tracking** in `IntentTracker`

### Why this is bad

A pipeline should have exactly one authoritative start gate.

Right now:

- `tool.execute.before` still runs `enforceIntentGate(...)`
- `oc_orchestrate` also validates a route ticket internally

This means you can fail:

- in the hook layer,
- in the tool layer,
- for different reasons,
- with different persistence models,
- and with different observability traces.

That is not hardened autonomy. That is overlapping control logic.

### Files involved

- `src/routing/intent-gate.ts`
- `src/hooks/intent-storage.ts`
- `src/index.ts`
- `src/tools/orchestrate.ts`

### Required fix

Make the durable route-ticket system the **only** implementation-start authority.

That means:

- remove `oc_orchestrate` implementation gating from `IntentTracker`
- keep lightweight intent classification for diagnostics if you want
- but do not block pipeline starts on it

The only valid implementation start check should be:

- valid route ticket
- same session
- same project
- correct intent
- not expired
- not consumed

Nothing else.

---

## Root cause cluster D — logger initialization is broken, and it pollutes the UI

This is the reason for the horrible UX screenshots.

### The actual design bug

`getLogger(...)` returns a fallback logger that writes to `console.log(...)` when `rootLogger` has not been initialized yet.

But many modules create loggers at module scope:

- `const logger = getLogger(...)`

Those module-level constants are instantiated **during import time**, before `initLoggers(projectRoot)` is called in `src/index.ts`.

So those modules permanently capture the fallback console logger.

Later logger initialization does not fix them, because the logger objects were already created.

### Why the screenshot matches this exactly

The strings shown in the UI include:

- `Intent tracking reset for user message`
- `Enhanced read line with hash`

Those messages exist as logger calls in:

- `src/routing/intent-gate.ts`
- `src/hooks/hashline-read-enhancer.ts`

Because those modules use module-level loggers, and because fallback logging uses `console.log`, their debug logs leak into the runtime surface.

### Why this becomes a UX catastrophe in OpenCode

In an OpenCode plugin runtime, random `console.log` output is not a harmless developer convenience.

It can contaminate:

- TUI session surfaces,
- prompt-adjacent UI,
- intermediate tool output,
- user-visible debugging areas.

### Files involved

- `src/logging/domains.ts`
- `src/logging/logger.ts`
- any module with `const logger = getLogger(...)` at top level
- clearly including:
  - `src/routing/intent-gate.ts`
  - `src/hooks/hashline-read-enhancer.ts`
  - many orchestrator, memory, recovery, UX modules

### Required fix

#### Do not allow fallback loggers to write to `console.log`

Change fallback behavior to:

- silent no-op sink, or
- buffered sink flushed after init, or
- explicit diagnostic-only sink not attached to user-visible output

#### Also remove module-scope logger capture

Use one of these patterns:

##### Pattern 1 — lazy logger access inside functions

Instead of:

```ts
const logger = getLogger("routing", "intent-gate")
```

use:

```ts
function logger() {
  return getLogger("routing", "intent-gate")
}
```

and call `logger().debug(...)`.

##### Pattern 2 — logger factory per handler construction

Create loggers inside plugin initialization or handler factories, after `initLoggers(...)`.

### Non-negotiable rule

No plugin runtime path may use raw `console.log`, `console.warn`, or `console.error` for normal operational logging.

User-facing status must go to:

- proper OpenCode TUI toast/show APIs,
- notification manager surfaces,
- or structured forensic sinks.

---

## Root cause cluster E — inspect defaults are wrong for operators

### Current behavior

`inspect` opens:

- the explicitly passed DB path, or
- the global `autopilot.db`

So `inspect projects` is currently a global historical dump.

### Why this is wrong

When a user is standing inside one repo and trying to debug one failing session, the useful default is not:

- every temp project ever written into the global DB.

The useful default is:

- the current project.

### Files involved

- `src/inspect/repository.ts`
- `bin/inspect.ts`
- `src/memory/database.ts`

### Required fix

Change inspect semantics:

#### Default mode
Current repo first.

If run inside a repo/worktree, default inspect target should be that repo’s project kernel DB and project identity.

#### Explicit global mode
Add:

- `inspect projects --global`
- `inspect memory --global`

or equivalent.

#### Ephemeral project suppression
Add filtering for obvious temporary/test project roots such as:

- `/tmp/...`
- `/var/folders/.../T/...`

unless explicitly requested.

#### Cleanup support
Add:

- `inspect projects --prune-ephemeral`
- or a dedicated maintenance command

so operators can clean polluted historical state.

---

## File-by-file critical findings

### `src/utils/paths.ts`

What is right:

- defines global config dir,
- defines global `autopilot.db`,
- defines project artifact dir `.opencode-autopilot`.

What is wrong:

- the rest of the system does not consistently honor the artifact-dir abstraction.

Fix:

- all project-scoped storage must use `getProjectArtifactDir(projectRoot)` consistently.

---

### `src/kernel/database.ts`

What is right:

- simple kernel DB abstraction,
- migrations and WAL enabled.

What is wrong:

- `getKernelDbPath(base)` treats any passed path as the direct parent directory of `kernel.db`.
- callers are passing project root in some places and artifact dir in others.

Fix:

- stop accepting ambiguous `artifactDirOrProjectRoot`.
- replace with explicit helpers:
  - `openProjectKernelDb(projectRoot)`
  - `openKernelDbAtArtifactDir(artifactDir)`
- eliminate call-site ambiguity.

---

### `src/tools/route.ts`

What is right:

- durable route tickets are the correct direction.

What is wrong:

- opens kernel DB at `context.projectRoot`, not artifact dir,
- binds route tickets to `messageId`,
- therefore writes `kernel.db` into the repo root and issues over-strict tickets.

Fix:

- resolve `artifactDir` first,
- stop binding tickets to unstable `messageId`.

---

### `src/tools/orchestrate.ts`

What is right:

- durable validation/consume step exists,
- route token errors are explicit.

What is wrong:

- validates against `messageId`,
- opens kernel DB at `context.projectRoot`,
- catches validation/setup exceptions too broadly in the startup path,
- still coexists with legacy intent gating.

Fix:

- validate durable ticket only,
- remove messageId strictness,
- use artifactDir,
- fail deterministically and visibly if project kernel cannot be opened.

---

### `src/routing/route-ticket-repository.ts`

What is right:

- durable ticket table,
- TTL,
- single-use consumption.

What is wrong:

- `messageId` is part of the validation contract.

Fix:

- remove `messageId` from validation,
- optionally keep it as advisory metadata only.

---

### `src/routing/intent-gate.ts`

What is right:

- the original goal made sense before durable tickets existed.

What is wrong:

- in-memory gate remains live,
- duplicates the durable route-ticket system,
- module-level logger leaks through console fallback.

Fix:

- demote to diagnostics only or remove from start gating,
- eliminate module-scope logger capture.

---

### `src/hooks/intent-storage.ts`

What is right:

- stores route classification after `oc_route`.

What is wrong:

- this still supports the legacy gate path,
- it adds no value once durable route tickets are authoritative.

Fix:

- keep only if needed for analytics/debugging,
- otherwise remove from operational control-plane logic.

---

### `src/logging/domains.ts`

What is right:

- root logger and multiplex sink concept are fine.

What is wrong:

- fallback logger writes to `console.log`.

Fix:

- fallback must be silent or buffered, never console-visible.

---

### `src/logging/logger.ts`

What is right:

- structured log entries.

What is wrong:

- nothing here directly; the problem is how fallback loggers are created and retained.

Fix:

- pair with lazy logger pattern or mutable sink design.

---

### `src/hooks/hashline-read-enhancer.ts`

What is right:

- enhancement behavior is feature-gated.

What is wrong:

- logs every enhanced line at debug level,
- module-scope logger causes those messages to leak to console.

Fix:

- remove per-line debug spam entirely,
- keep only aggregate metrics in forensic logs if needed.

---

### `src/memory/database.ts`

What is right:

- global DB abstraction is clear.

What is wrong:

- project registry lives inside the same global DB used for memory,
- this is the DB inspect uses by default,
- temp/test project records therefore pollute operator-facing views.

Fix:

- keep global DB only for user/global memory,
- move project-scoped operational registry into project kernel or explicitly segregate tables and default views.

---

### `src/inspect/repository.ts`

What is right:

- readonly access pattern is reasonable.

What is wrong:

- default DB selection favors the global DB,
- not the current project,
- causing misleading inspect output.

Fix:

- current-project-first default,
- explicit global mode,
- hide ephemeral test/temp projects by default.

---

### `bin/inspect.ts`

What is right:

- useful command surface.

What is wrong:

- operator defaults are bad for local debugging.

Fix:

- make scope explicit and sane.

---

### `src/projects/resolve.ts`

What is right:

- Git fingerprinting and path history are useful.

What is wrong:

- in combination with the global DB default, any temp directory can become a permanent project record.

Fix:

- add optional project classification:
  - `normal`
  - `ephemeral`
  - `test`
- suppress ephemeral/test projects in operator views.

---

## What the attached sessions prove

The attached last session proves the current route-ticket contract is broken.

The pattern is:

1. `oc_route` returns a valid-looking route token
2. `oc_orchestrate` is called with that exact token
3. `oc_orchestrate` rejects it with `E_ROUTE_TOKEN_MISMATCH`
4. the model retries with new tokens and varied wording
5. the same mismatch repeats
6. no run starts

This means the failure is not prompt quality, not user phrasing, and not scope. It is the authorization contract itself.

---

## Why the UI looks worse than before

Because the system currently lets internal implementation diagnostics escape into the user surface.

There are two direct reasons:

1. **fallback console logger**
2. **too many verbose debug logs in live operational paths**

This is why the user sees strings that should have remained:

- in a forensic log,
- in a debug-only developer channel,
- or in a toast.

OpenCode supports dedicated TUI/plugin hook surfaces, including toast-related events, and plugin hook phases such as `tool.execute.before`, `tool.execute.after`, and `message.updated`. The plugin should use those structured surfaces instead of raw console output.

---

## Required repair sequence

This order matters.

### P0 — stop the bleeding

1. Remove console fallback logging from `getLogger()`
2. convert module-scope loggers to lazy/runtime loggers in high-noise modules
3. remove or disable per-line debug logging in hashline enhancement
4. make `inspect` clearly state which DB it is reading

### P1 — fix pipeline start for real

1. remove `messageId` from route-ticket validation
2. use artifactDir for route/orchestrate kernel access
3. keep route tickets as the single implementation-start authority
4. demote/remove legacy `IntentTracker` gating from `tool.execute.before`

### P2 — fix storage topology

1. define global-vs-project storage boundaries explicitly
2. migrate project-scoped operational tables into project kernel only
3. keep global DB for user/global memory only
4. add migration or compatibility layer for existing polluted data

### P3 — fix inspect UX

1. default inspect to current project
2. add `--global`
3. add ephemeral/test suppression
4. add prune/cleanup command

---

## Exact acceptance criteria

### Route/pipeline start

A fresh implementation request must satisfy all of these:

- `oc_route` returns route ticket
- `oc_orchestrate` accepts that ticket on first call
- one `pipeline_runs` row is created
- ticket becomes consumed
- no message-mismatch error occurs

### Kernel location

Starting a pipeline in a repo must create/update:

- `<repo>/.opencode-autopilot/kernel.db`

and must **not** create/update:

- `<repo>/kernel.db`

### Logging/UI

During a normal session:

- no raw debug logs appear in the prompt area,
- no raw `console.log`-style operational lines appear in the user conversation surface,
- only intended notifications/toasts/status surfaces are user-visible.

### Inspect

Inside a repo:

- `inspect projects` defaults to current-project scope,
- `inspect --global` shows global records,
- temp test projects are hidden unless explicitly requested.

---

## Required tests

### Route ticket tests

Add or update tests covering:

- route ticket creation
- route ticket single-use consumption
- route ticket session mismatch
- route ticket project mismatch
- route ticket success across `oc_route` -> `oc_orchestrate`
- no dependence on unstable `messageId`

### Kernel path tests

Add tests proving:

- `route.ts` uses artifactDir
- `orchestrate.ts` uses artifactDir
- no project-root `kernel.db` creation occurs

### Logger tests

Add tests proving:

- module import before `initLoggers()` does not emit to console
- lazy/runtime logger resolves after init
- noisy debug logs do not hit user-visible output channels

### Inspect tests

Add tests proving:

- default inspect scope is current project
- global inspect is opt-in
- temp project names are filtered by default

### Integration test

One end-to-end plugin lifecycle test must do this:

1. initialize plugin
2. detect user message
3. call `oc_route`
4. capture returned route ticket
5. call `oc_orchestrate` with that ticket
6. assert run is created
7. assert ticket is consumed
8. assert no console/log leakage into returned UI output

---

## Recommended implementation decisions

### Decision 1

**Delete message-bound route-ticket validation.**

Do not try to salvage it.

### Decision 2

**Make durable route tickets the only pipeline-start gate.**

Keep intent classification as advisory, not blocking.

### Decision 3

**Make artifactDir the only valid project-scoped kernel parent.**

Never pass project root directly into kernel path resolution.

### Decision 4

**Remove console fallback logging from production plugin runtime.**

No exceptions.

### Decision 5

**Change inspect defaults from global-history-first to current-project-first.**

Global should be explicit.

---

## Final conclusion

This is solvable.

The plugin is not failing because autonomous orchestration is impossible.
It is failing because the current implementation still has:

- split storage authority,
- a bad route-ticket key,
- overlapping control-plane gates,
- and a logger initialization bug that spills internal diagnostics into the UI.

The most important point is this:

**the current failure is deterministic and localizable.**

It is not “the model being dumb.”
It is not “the plugin concept being impossible.”
It is not “too much scope.”

The core break is:

- wrong ticket binding,
- wrong DB location usage,
- wrong default inspect scope,
- wrong logger fallback.

Fix those four, and the system stops feeling haunted.

