# OpenCode Autopilot — Full Failure Analysis and Implementation Base

## Status of this document

This document is intended to be the implementation base for the next stabilization pass of the plugin.

It is written against:

- the current `opencode-autopilot-main.zip` codebase provided in this chat
- the failing session transcript for the Phase 6 PR request
- the screenshot showing an inline UI message reading `Intent tracking reset for user message`
- current official OpenCode documentation for plugins, custom tools, server APIs, SDK session APIs, and TUI toast controls

This is not a marketing document.
This is a corrective engineering document.

---

## 1. Executive summary

The plugin is no longer failing for the exact same reasons as the first audit. Some important earlier defects have been corrected. However, the execution spine is still not deterministic enough to support the product promise.

### 1.1 What has actually improved

The current codebase has clearly absorbed part of the previous remediation work:

- runtime dependencies are materially cleaner now
  - `zod` is present in `dependencies`
  - `typescript` is present in `dependencies`
  - `tsconfig.json` now uses `"types": ["bun"]`
- the review subsystem now injects real git diff evidence instead of placeholder text
  - `src/tools/review.ts`
  - `src/review/diff-evidence.ts`
- background config wiring is better than before
  - `background.maxConcurrent` and `background.persistence` are now consulted in `src/tools/background.ts` and `src/tools/delegate.ts`
- a kernel DB and persistence model exist and are not superficial

That work should be preserved.

### 1.2 Why it still feels like a nightmare

The project still fails at the control-plane level.

The most damaging defects are now:

1. **Intent routing is still nondeterministic.**
   `oc_route` and `oc_orchestrate` are still coupled through hidden side effects instead of an explicit durable contract.

2. **Internal diagnostics still leak into the user-facing UI.**
   The screenshot is not a random cosmetic issue. It is evidence that runtime logs are still escaping through the wrong surface.

3. **Project path resolution is still split-brain.**
   Different tools still disagree on what the project root is.

4. **Background execution is still not a real supervised autonomous runtime.**
   It is better wired than before, but it is still not an isolated child-run model.

5. **The controller is still not authoritative enough.**
   When the orchestrator fails, the agent can still drift into manual ungoverned work.

6. **The test suite still over-validates internals and under-validates lifecycle behavior.**
   The current session failure should have been caught by an end-to-end plugin lifecycle test.

### 1.3 Bottom line

The plugin still behaves too much like a bundle of clever subsystems and not enough like a reliable operating system for autonomous development.

The next implementation must prioritize:

- determinism over feature breadth
- explicit contracts over hook side effects
- durable state over in-memory heuristics
- correct UI surfaces over incidental console output
- supervisor-controlled execution over same-session prompt tricks

---

## 2. Product reality check

The target product is not “a nice OpenCode helper.”
It is:

> a unified open-source OpenCode-native autonomous development plugin where a user can launch an idea, leave, and return to a working product outcome.

That means the minimum viable product is not “many tools.”
It is:

- correct intent capture
- deterministic controller start
- isolated execution
- durable resumability
- evidence-based verification
- non-chaotic UX
- safe failure behavior

Today the repo has many of the right nouns:

- orchestrator
- review engine
- background manager
- routing
- recovery
- memory
- observability
- LSP
- MCP
- notifications

But the nouns are still not joined by one authoritative runtime contract.

That is why the system can look sophisticated and still fail in a very primitive way.

---

## 3. Evidence summary from the current repo

### 3.1 Current session failure

Observed session behavior:

1. user requests implementation work from a PRD
2. agent correctly calls `oc_route`
3. `oc_route` returns a valid implementation route
4. agent calls `oc_orchestrate`
5. `oc_orchestrate` is blocked by the intent gate
6. agent then escapes into ad hoc manual work

This proves the control contract from route to orchestrate is still broken.

### 3.2 Screenshot failure

The screenshot shows a user-facing inline UI line containing:

> `Intent tracking reset for user message`

That exact string exists in:

- `src/routing/intent-gate.ts`

This is not a hypothetical correlation. The screenshot matches a real runtime log message in the repo.

### 3.3 Repo-wide indicators

Current code scan highlights:

- **30 module-scope logger declarations** are created with `getLogger(...)` in imported modules
- **7 production source files** still contain direct `console.*` calls
- **18 tool files** still use `process.cwd()` in the execution path
- **32 total `process.cwd()` usages** remain across `src/`

These are not isolated defects. They are systemic indicators of unstable runtime boundaries.

---

## 4. Root cause analysis — intent routing and orchestration start

## 4.1 Current design

The current route/orchestrate authorization chain is spread across four places:

- `src/tools/route.ts`
- `src/hooks/intent-storage.ts`
- `src/routing/intent-gate.ts`
- `src/index.ts`

The effective design is:

1. `oc_route` returns JSON only
2. `tool.execute.after` later parses that JSON
3. the hook stores intent authorization in an in-memory `Map`
4. `tool.execute.before` later checks the `Map` before allowing `oc_orchestrate`

This is still a hidden side-channel design.

## 4.2 Why the current design fails

The visible route decision and the actual authorization state are still separate things.

The user and the model can see:

- `primaryIntent: implementation`
- `usePipeline: true`
- `instruction: Proceed with oc_orchestrate ...`

But the controller actually depends on:

- post-tool hook execution
- correct hook parsing
- shared process memory
- no plugin reload
- no reset race
- no ordering surprises

That means the user-visible route success is not equivalent to controller authorization success.

That is architecturally wrong.

## 4.3 Current in-memory tracker defects

`src/routing/intent-gate.ts` still uses in-memory maps:

- `sessionIntentMap`
- `sessionUserMessageMap`

Additional problems:

- `recordUserMessage()` exists but is not wired into the critical path
- `sessionUserMessageMap` is effectively dead logic
- reset is still session-wide, not authorization-record scoped

This is evidence of a half-completed design, not a finished one.

## 4.4 Turn reset is still heuristic

The code still resets authorization on `message.updated` when it believes a user message was detected.

Current problem areas:

- reset uses event inference rather than a durable per-turn contract
- reset clears session authorization broadly
- `message.updated` is not a safe substitute for a consumed route grant

This is exactly the wrong place to encode a pipeline-start permission model.

## 4.5 The correct replacement

The authorization contract must become explicit, durable, and single-use.

### Proposed replacement: route tickets

`oc_route` should create and return a **route ticket** for pipeline-start cases.

Suggested semantics:

- only returned when `primaryIntent === "implementation"` and `usePipeline === true`
- bound to:
  - `sessionID`
  - `messageID`
  - `project root`
  - `intent`
  - `created_at`
  - `expires_at`
- single-use
- atomically consumed by `oc_orchestrate`

### Proposed database table

Add a kernel table such as:

```sql
CREATE TABLE route_tickets (
  route_token TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  intent TEXT NOT NULL,
  use_pipeline INTEGER NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  metadata_json TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

Indexes:

```sql
CREATE INDEX idx_route_tickets_session_message ON route_tickets(session_id, message_id, issued_at DESC);
CREATE INDEX idx_route_tickets_project ON route_tickets(project_id, issued_at DESC);
CREATE INDEX idx_route_tickets_unconsumed ON route_tickets(consumed_at, expires_at);
```

### Tool contract changes

#### `oc_route`

Change `execute(args)` to `execute(args, context)` and:

- validate classification as today
- when pipeline start is authorized, issue a route token
- persist it immediately inside `execute`
- return it in the tool result

Suggested response extension:

```json
{
  "action": "route",
  "primaryIntent": "implementation",
  "usePipeline": true,
  "routeToken": "rtk_xxx",
  "routeTokenMode": "single_use",
  "routeTokenExpiresAt": "2026-04-11T09:12:00Z"
}
```

#### `oc_orchestrate`

For new starts:

- require `routeToken`
- validate it against session, message, project, and intent
- consume it atomically
- only then start a run

For resumes:

- if `result` is present, token is not required
- this remains machine-driven continuation

### What to remove from the critical path

Remove these from pipeline-start authorization:

- `src/hooks/intent-storage.ts`
- in-memory `sessionIntentMap` authorization checks
- `message.updated` authorization resets

They may remain as diagnostics or telemetry if genuinely useful, but not as the gate that controls pipeline start.

## 4.6 Files to change

Primary files:

- `src/tools/route.ts`
- `src/tools/orchestrate.ts`
- `src/index.ts`
- `src/routing/intent-gate.ts`
- `src/kernel/schema.ts`
- `src/kernel/migrations.ts`
- new `src/routing/route-tickets.ts` or similar
- new `src/kernel/route-ticket-repository.ts` or similar

## 4.7 Acceptance criteria

- `oc_route` followed immediately by `oc_orchestrate` succeeds in the same session
- repeated `message.updated` events do not invalidate a valid route ticket
- a used ticket cannot be replayed
- a ticket from another message/session/project is rejected
- orchestration start does not depend on `tool.execute.after`

---

## 5. Root cause analysis — user-facing log leakage and broken UX surface selection

## 5.1 What the screenshot really means

The screenshot is not just “a popup bug.”
It indicates that internal diagnostic output is reaching a user-visible interactive surface.

That is a strict UX violation.

The plugin already contains a legitimate user-notification path:

- `client.tui.showToast(...)`
- `NotificationManager`

So if internal runtime strings are appearing inline, the problem is not a missing notification system.
The problem is that the plugin is still writing to the wrong output channel.

## 5.2 Primary root cause: module-scope logger initialization bug

### Current logging design

`src/logging/domains.ts` currently does this:

- `initLoggers(projectRoot)` initializes `rootLogger`
- `getLogger(...)` returns a fallback logger that writes via `console.log(entry.level, entry.message)` when `rootLogger` is not initialized yet

That alone would be survivable if loggers were created only after initialization.

### But the repo creates loggers at module import time

There are about 30 module-scope declarations like:

```ts
const logger = getLogger("routing", "intent-gate")
```

Those modules are imported before the plugin factory runs `initLoggers(projectRoot)`.

That means many logger objects are permanently created against the fallback console sink.

### Why this directly explains the screenshot

`src/routing/intent-gate.ts` contains:

```ts
logger.debug("Intent tracking reset for user message", { sessionID })
```

Because `logger` is created at module scope, it can capture the fallback `console.log(...)` sink before runtime initialization.

So when `resetIntentForUserMessage(...)` runs, the message can escape to stdout.

That is the most credible explanation for the screenshot, and it is strongly supported by the code.

## 5.3 Secondary root cause: direct `console.*` in production runtime code

Production `src/` still contains direct console usage in files such as:

- `src/logging/domains.ts`
- `src/observability/forensic-log.ts`
- `src/skills/adaptive-injector.ts`
- `src/agents/index.ts`
- `src/lsp/process-cleanup.ts`
- `src/lsp/temp-cleanup.ts`
- `src/lsp/lsp-client-transport.ts`

Even after the logger factory bug is fixed, these direct writes remain capable of surfacing in the wrong place.

## 5.4 Required runtime policy

The plugin needs a hard runtime output policy:

### Allowed user-facing surfaces

Only these should be used for user-visible messaging:

- normal assistant/tool output intentionally returned to the session
- `client.tui.showToast(...)` for ephemeral notifications
- optionally OS-level notifications through the existing notification subsystem

### Allowed diagnostic surfaces

Only these should be used for diagnostics:

- forensic log files
- kernel DB event records
- optional server/app log sink

### Forbidden in production runtime

- `console.log`
- `console.warn`
- `console.error`
- any logger fallback that writes to stdout/stderr
- any hidden hook that writes directly into the prompt or text input surface for diagnostics

## 5.5 Correct logging redesign

### Option A — proxy logger with dynamic sink lookup

This is the least invasive fix.

`getLogger(...)` should return a proxy logger whose methods resolve the current root sink at call time, not at logger creation time.

High-level behavior:

- before `initLoggers()`: writes go to a no-op or in-memory ring buffer
- after `initLoggers()`: writes go to the configured sinks
- existing module-scope logger declarations remain valid

### Option B — lazy logger factory usage only inside functions

This is cleaner long-term but more invasive.

It requires replacing many module-scope `const logger = ...` declarations with function-local or getter-based log acquisition.

### Recommended approach

Do both in phases:

- **P0:** implement proxy logger and remove fallback console sink entirely
- **P1:** gradually eliminate module-scope logger instances from hot paths

## 5.6 Additional UX policy

Define a strict notification taxonomy.

### Debug

- never user-visible
- file/server log only

### Informational toast

- short, actionable, non-spammy
- examples: “Background task completed”, “Recovery resumed pipeline”

### Warning toast

- only when user action or awareness is needed soon

### Error toast

- only when operation failed in a way the user should know immediately

The screenshot string is debug-level telemetry and should never have reached the UI.

## 5.7 Files to change

Primary files:

- `src/logging/domains.ts`
- `src/logging/logger.ts`
- all `src/**` files with module-scope loggers
- all `src/**` files with `console.*`
- `src/index.ts` for final notification policy wiring

## 5.8 Acceptance criteria

- no debug log text ever appears in the prompt, composer, transcript, or inline status surface
- snapshot/replay test reproducing the screenshot string shows zero user-visible output
- runtime contains no direct `console.*` in `src/` except behind explicitly test-only guards
- toasts remain functional through `client.tui.showToast(...)`

---

## 6. Root cause analysis — project root and artifact path integrity

## 6.1 The current problem is worse than “some tools use cwd”

The repo still has mixed path semantics:

- some tools use `process.cwd()`
- `oc_orchestrate` uses `context.directory`
- the plugin factory computes `projectRoot = input.worktree ?? input.directory ?? process.cwd()`

This is not just inconsistency. It is a misunderstanding of scope.

### Session working directory is not the same thing as project root

For OpenCode custom tools:

- `context.directory` is the session working directory
- `context.worktree` is the git worktree root

Project-wide state should almost always live under the **worktree root**, not the current subdirectory.

## 6.2 Current failure patterns this causes

### Failure pattern A — invisible state

`oc_orchestrate` may write state to one artifact directory while `oc_state` or `oc_phase` reads another.

### Failure pattern B — nested-directory split

If a session starts from a subdirectory, `context.directory` may point below the repository root.
If pipeline artifacts are stored there, the run becomes local to that subdirectory rather than the project.

### Failure pattern C — cross-project contamination

When `process.cwd()` is used in plugin runtime, behavior can depend on launch context rather than actual session/worktree context.

## 6.3 Required fix: unified project context resolver

Introduce one canonical resolver used by every project-scoped tool.

Suggested contract:

```ts
interface ProjectContext {
  projectRoot: string
  sessionDirectory: string
  artifactDir: string
}
```

Suggested resolution rules:

- `projectRoot = context.worktree ?? context.directory`
- `sessionDirectory = context.directory ?? projectRoot`
- `artifactDir = getProjectArtifactDir(projectRoot)`

### Important rule

- pipeline state
- kernel DB
- review state
- memory state
- background task DB
- graph DB
- logs
- forensic data

should all default to **projectRoot/worktree-scoped artifacts**, not session-directory artifacts.

## 6.4 Legacy migration requirement

Because current builds may already have created `.opencode-autopilot/` under session directories, the fix requires a compatibility pass.

Suggested migration behavior:

1. resolve canonical artifact dir at worktree root
2. if canonical dir is missing but legacy dir under `context.directory` exists, migrate or adopt it
3. write a migration stamp
4. thereafter always use canonical worktree-root artifact dir

Do not silently keep dual locations alive.

## 6.5 Known affected tool files

Current `src/tools/` files using `process.cwd()` include:

- `memory-preferences.ts`
- `state.ts`
- `memory-save.ts`
- `session-stats.ts`
- `update-docs.ts`
- `memory-search.ts`
- `logs.ts`
- `summary.ts`
- `forensics.ts`
- `delegate.ts`
- `background.ts`
- `graph-query.ts`
- `graph-index.ts`
- `pipeline-report.ts`
- `quick.ts`
- `confidence.ts`
- `plan.ts`
- `phase.ts`

There are additional `process.cwd()` usages outside `src/tools/` in observability, LSP, health, fallback, and utilities.

## 6.6 Files to change

Primary files:

- new `src/utils/project-context.ts`
- all affected `src/tools/*.ts`
- `src/index.ts`
- `src/observability/*`
- `src/orchestrator/fallback/event-handler.ts`
- other project-scoped runtime modules that still default to cwd

## 6.7 Acceptance criteria

- all project-scoped tools agree on one artifact root
- starting from a nested subdirectory still uses the repository worktree root for state
- `oc_orchestrate`, `oc_state`, `oc_phase`, `oc_plan`, `oc_confidence`, `oc_logs`, memory tools, and graph tools all see the same project data
- legacy session-directory artifact dirs are migrated once and no longer duplicated

---

## 7. Root cause analysis — background tasks and delegation are still not true autonomous execution

## 7.1 What improved

Background config wiring is materially better than in the earlier audit.

`src/tools/background.ts` and `src/tools/delegate.ts` now consult:

- `background.persistence`
- `background.maxConcurrent`

That part is real improvement.

## 7.2 What is still fundamentally wrong

The runtime model is still not a real supervised child-run system.

### Current naming/behavior mismatch

In `src/index.ts`, the block is labeled:

> `Background task SDK wiring (enables real dispatch via promptAsync)`

But the implementation currently calls:

```ts
await client.session.prompt({ ... })
```

not `client.session.promptAsync(...)`.

So even the code comment and method name no longer match the actual behavior.

### Current execution model

The background/delegate path currently behaves like this:

1. route a task
2. queue it in the background manager
3. call `client.session.prompt(...)` in the **same session**
4. wait for that call to return
5. mark the task completed

This is not “background” in the product sense.

It is just managed prompt dispatch inside the current session.

## 7.3 Why same-session prompting is a bad substrate

### It pollutes the main session context

Delegated work should not contaminate the parent controller transcript by default.

### It is not independently supervised

There is no child session ID recorded as the execution unit.

### It does not model resumable autonomous work correctly

A real autonomous background run should have:

- its own execution identity
- its own session lifecycle
- its own transcript
- its own diff/artifact evidence
- its own status monitoring

### It is still vulnerable to session collision

If the parent session is busy or receives additional messages, same-session “background” work becomes fragile.

## 7.4 The correct execution model

Background tasks should become **supervised child runs**.

### Suggested model

For delegated/autonomous work:

1. create or fork a child session from the parent session/message snapshot
2. record the child session ID on the task
3. dispatch work to that child session
4. monitor child session lifecycle and transcript
5. collect final evidence when the child session reaches idle/complete state
6. only then mark the task terminal

### Why child sessions are the right primitive

They create a real execution boundary.
They also align with the product promise much better than same-session prompting.

## 7.5 Suggested data model changes

Extend background tasks with execution identity:

```ts
interface SupervisedTaskExecution {
  taskId: string
  parentSessionId: string
  parentMessageId: string | null
  childSessionId: string | null
  executionMode: "child_session" | "same_session_legacy"
  startedAt: string | null
  completedAt: string | null
  lastObservedStatus: string | null
  finalMessageId: string | null
  finalDiffCaptured: boolean
}
```

Suggested DB columns or related table:

- `parent_message_id`
- `child_session_id`
- `execution_mode`
- `last_observed_status`
- `final_message_id`
- `final_diff_json`

## 7.6 Suggested supervisor lifecycle

### Spawn

- create/fork child session
- store child session id
- set task state to `queued`

### Start

- send prompt to child session
- set task state to `running`

### Observe

- poll session state and/or consume events
- capture messages and diff

### Complete

- mark complete only when the child execution is actually done and final evidence is captured

### Fail

- mark failed on real execution failure, timeout, abort, or invalid result envelope

## 7.7 Required design decision: `prompt` vs `prompt_async`

The implementation should stop pretending these are interchangeable.

Use them deliberately:

- `prompt(...)` when synchronous wait is explicitly desired
- `prompt_async(...)` when using a supervisor that separately monitors lifecycle

Right now the code blurs that distinction.

## 7.8 Recommended implementation target

### P1 target

- background tasks use child sessions
- delegation records child session ID
- completion is based on supervised lifecycle, not merely prompt return
- same-session mode remains only as a temporary compatibility fallback

### P2 target

- remove same-session background execution entirely for delegated autonomous work

## 7.9 Files to change

Primary files:

- `src/index.ts`
- `src/background/sdk-runner.ts`
- `src/background/executor.ts`
- `src/background/manager.ts`
- `src/tools/background.ts`
- `src/tools/delegate.ts`
- `src/background/database.ts`
- `src/background/repository.ts`
- possibly new `src/background/supervisor.ts`

## 7.10 Acceptance criteria

- background task spawn returns a tracked execution unit with child session identity
- main session remains usable and not polluted by delegated work
- task completion is based on real child-run completion, not just a returned prompt call
- final task result includes transcript/diff evidence or structured result metadata

---

## 8. Controller authority is still insufficient

## 8.1 The current failure mode

When `oc_orchestrate` failed in the session, the agent continued by using generic tools and manual repo exploration.

That is unacceptable for the target product.

Once the controller is chosen, the system cannot silently fall back to uncontrolled manual work.

## 8.2 Why this is still happening

The current design still relies too much on the agent prompt to obey the controller instead of structuring the system so that the controller is the only execution path for pipeline-mode work.

Current evidence:

- tests assert that the autopilot prompt contains various routing instructions
- the session shows that when controller start failed, the agent still improvised outside the intended path

This means prompt governance still outruns runtime governance.

## 8.3 Minimum fix

When `usePipeline === true` and `oc_orchestrate` cannot start, the agent should stop and return a structured controller error, not improvise.

Suggested response envelope:

```json
{
  "action": "controller_error",
  "code": "PIPELINE_START_BLOCKED",
  "message": "Pipeline start failed because the route token was invalid or unavailable.",
  "nextAction": "retry_route"
}
```

## 8.4 Real fix: split controller and worker powers

This is the stronger long-term move.

### Proposed role split

#### Controller agent

- can read
- can inspect state
- can call plugin tools
- cannot directly edit or bash except in narrowly defined diagnostic cases

#### Worker agents

- do actual build/research/review work
- run only when dispatched by the controller

This prevents the controller from defecting into ad hoc coding when the orchestrator is broken.

That is much closer to the intended product behavior.

## 8.5 Acceptance criteria

- pipeline-mode failure returns a controller error and halts
- no manual repo-edit workflow occurs after pipeline authorization failure
- autonomous work is performed by dispatched worker contexts, not by the controller improvising in the parent turn

---

## 9. Remaining config and documentation inconsistencies

## 9.1 Autonomy config is still not fully wired

`src/config.ts` exposes autonomy config, but the plugin bootstrap still does not pass config-driven autonomy values into controller creation in `src/index.ts`.

The controller currently gets:

- `sessionId`
- `logger`
- `verificationHandler`
- `dispatchOracleTask`

But not the configured autonomy values.

This means config can exist without actually controlling runtime behavior.

## 9.2 Misleading comments and docs remain

Examples:

- background wiring comment says promptAsync while calling `client.session.prompt(...)`
- `docs/background-and-routing.md` claims tasks run independently of primary chat flow, which is not true under the current same-session implementation

These are not harmless documentation issues.
They hide runtime truth.

## 9.3 Corrective policy

No architecture doc or README section should describe behavior that is not true in the current code.

Update docs only after the implementation is real.

---

## 10. Security and operational concerns still relevant to this fix

## 10.1 MCP auto-start from skill frontmatter

`src/skills/adaptive-injector.ts` can start MCP servers declared in skill frontmatter.

That is powerful, but it is also a process-execution surface.

Requirements:

- disabled by default for untrusted skill sources
- explicit allowlist or trust model
- audit logging of MCP server auto-starts
- clear operator documentation

## 10.2 Server exposure and authentication

The plugin is built around OpenCode’s client/server model.
If the server is reachable beyond localhost assumptions, authentication must be considered mandatory.

Requirements:

- document server auth requirement for non-local exposure
- add operator checklist entry for server protection

## 10.3 Autonomous execution isolation

Any serious autonomous implementation mode should run in:

- a dedicated branch
- preferably a dedicated worktree or sandbox
- with explicit cleanup behavior

Without that, overnight autonomy is an operational liability.

## 10.4 Logging confidentiality

User-facing log leakage is also a confidentiality problem.

Debug strings may include:

- session IDs
- error payloads
- model details
- filesystem paths
- operational hints

This is another reason to eliminate console leakage completely.

---

## 11. The next target architecture

The correct end-state is not “make the current hooks slightly less flaky.”
It is a cleaner runtime model.

## 11.1 Target architecture overview

```text
user message
  -> oc_route
      -> validate classification
      -> issue single-use route ticket if pipeline start is allowed
  -> oc_orchestrate
      -> atomically consume route ticket
      -> create run manifest
      -> persist run state under worktree artifact root
      -> dispatch supervised worker runs / child sessions
      -> collect evidence
      -> verify
      -> handoff / PR / report
```

## 11.2 Required runtime principles

1. **No hidden start authorization state**
2. **No stdout/stderr diagnostics in production runtime paths**
3. **One canonical project root per session**
4. **One canonical artifact root per project**
5. **Background work is isolated and supervised**
6. **Controller failures stop execution cleanly**
7. **Every major behavior has a lifecycle test**

---

## 12. File-by-file implementation plan

## 12.1 P0 — deterministic start and UI hygiene

### A. Logging subsystem

#### `src/logging/domains.ts`

Replace fallback console logger behavior.

Target behavior:

- `getLogger()` never binds directly to `console.*`
- pre-init logging goes to:
  - no-op sink, or
  - bounded in-memory buffer flushed after init
- logger instances resolve active sink at call time

#### `src/logging/logger.ts`

Add proxy logger or sink resolver support.

#### All `src/**` with module-scope loggers

No urgent mass rewrite required if proxy logger is implemented correctly.
But add a tracked cleanup backlog to gradually remove module-scope logger creation in hot paths.

#### All `src/**` with direct `console.*`

Replace with:

- structured logger
- forensic event sink
- app/server log sink
- or silent swallow when best-effort failure is intentionally invisible

### B. Routing / orchestration authorization

#### `src/tools/route.ts`

- accept `context`
- issue route tickets for pipeline starts
- persist within execute
- return token metadata

#### `src/tools/orchestrate.ts`

- require `routeToken` for new starts
- validate and consume ticket atomically
- return structured controller error when invalid

#### `src/routing/intent-gate.ts`

- remove in-memory session authorization as critical gate
- either replace file entirely or reduce it to non-critical diagnostics

#### `src/hooks/intent-storage.ts`

- remove from critical path
- likely delete

#### `src/index.ts`

- remove `message.updated` reset-based authorization logic
- remove intent-storage hook invocation from the orchestration start path

#### `src/kernel/schema.ts` and `src/kernel/migrations.ts`

- add route-ticket persistence

### C. Project context unification

#### New `src/utils/project-context.ts`

Create canonical resolver:

- `projectRoot`
- `sessionDirectory`
- `artifactDir`

#### All project-scoped tools

Replace `process.cwd()` and inappropriate `context.directory` usage.

Priority tools:

- `oc_orchestrate`
- `oc_state`
- `oc_phase`
- `oc_plan`
- `oc_confidence`
- memory tools
- logs/session-report tools
- forensics
- background
- delegate
- graph tools

### D. P0 tests

Add lifecycle tests for:

- route -> orchestrate success using actual plugin hooks
- route token replay rejection
- no stdout leakage when calling `resetIntentForUserMessage(...)`
- nested `context.directory` with worktree-root artifact resolution

## 12.2 P1 — supervised child execution

### A. Background runtime redesign

#### `src/background/*`

- add child session execution identity
- distinguish queued/running/completed from prompt return semantics
- monitor child lifecycle

#### `src/tools/delegate.ts`

- delegate to supervised child sessions
- store child session ID

#### `src/index.ts`

- stop calling same-session `client.session.prompt(...)` for background tasks
- choose explicit synchronous or asynchronous dispatch semantics

### B. Controller authority

- pipeline-mode failure halts cleanly
- no manual fallback behavior in controller path
- begin separating controller and worker responsibilities

### C. P1 tests

- background spawn creates child execution identity
- completion requires actual terminal lifecycle
- parent session does not accumulate delegated execution chatter by default

## 12.3 P2 — UX hardening and doc truthfulness

### A. Notification policy

- classify all toasts by user value
- remove noisy or debug-like notifications
- verify rate limits still work

### B. Documentation updates

After implementation is real, update:

- `docs/background-and-routing.md`
- README tool descriptions
- architecture docs
- QA playbook

### C. Config wiring cleanup

- wire `config.autonomy.*` into controller creation in `src/index.ts`
- audit all config fields for real runtime usage

## 12.4 P3 — structural redesign

This is optional for the immediate patch, but it is the correct medium-term direction.

- split controller and worker capabilities
- introduce run manifest and artifact-driven state transitions
- move toward evidence-based PR handoff packs
- add branch/worktree isolation for autonomous runs

---

## 13. Test strategy that actually matches production reality

## 13.1 Missing today

The current test suite is heavy on isolated unit tests and prompt-content assertions.
It is light on real plugin lifecycle tests.

That imbalance has to change.

## 13.2 Required test layers

### Layer 1 — unit tests

Keep:

- pure routing logic
- schema validation
- state transitions
- review selection logic
- DB repository behavior

### Layer 2 — plugin lifecycle integration tests

New required flows:

1. plugin init
2. `oc_route` execute
3. `tool.execute.after` runs if still used for telemetry
4. `oc_orchestrate` execute in same session/message
5. verify run state exists

Also add:

- repeated `message.updated` noise does not break route ticket flow
- plugin re-init between route and orchestrate still succeeds when token is durable

### Layer 3 — path-scope tests

- nested session directory under a worktree root
- ensure all tools resolve same artifact root

### Layer 4 — UX contract tests

- no `console.*` in production runtime
- no debug logger text reaches user-visible output
- toast calls use `client.tui.showToast(...)`

### Layer 5 — supervised execution tests

- background child session creation
- task completion after actual lifecycle
- recovery after interruption
- result evidence capture

### Layer 6 — release gates

CI should fail if:

- production `src/` contains `console.*`
- new project-scoped code introduces `process.cwd()` without an explicit allowlist reason
- docs describe behavior that current integration tests do not prove

---

## 14. Suggested static guards

Add hard repo checks.

## 14.1 No console rule

Fail CI when `src/` contains:

- `console.log`
- `console.warn`
- `console.error`
- `console.info`
- `console.debug`

unless explicitly allowed in a small allowlist file.

## 14.2 No project-scoped `process.cwd()` rule

Fail CI when project-scoped runtime code uses `process.cwd()` outside approved global utility locations.

## 14.3 Hook-side-effect warning rule

Flag tools whose correctness depends on `tool.execute.after` or `message.updated` to produce mandatory state for another tool call.

That pattern should be treated as suspect by default.

---

## 15. Radical changes worth considering

These are not all mandatory for the immediate stabilization patch, but they are strategically strong.

## 15.1 Split the plugin into core plus capability packs

Suggested packages or internal modules:

- `autopilot-core`
- `autopilot-review`
- `autopilot-memory`
- `autopilot-lsp`
- `autopilot-ux`
- `autopilot-runtime`

This reduces blast radius and makes it easier to stabilize the controller independently of optional capability packs.

## 15.2 Separate controller from implementer at the agent-permission level

This is one of the highest-value changes.

The controller should not be allowed to improvise as a full coder when pipeline control fails.

## 15.3 Add a real run manifest

Every run should produce and mutate explicit artifacts such as:

- `run-manifest.json`
- `spec.json`
- `plan.json`
- `taskgraph.json`
- `execution-report.json`
- `verification-report.json`
- `handoff.md`

This reduces the amount of protocol state that currently lives in prompt text and transient memory.

## 15.4 Move from “background task” language to “supervised run” language

The current wording suggests generic async jobs.
The product actually needs supervised autonomous executions with identity, evidence, and lifecycle.

Rename accordingly once implementation matches.

## 15.5 Add branch/worktree isolation to autonomous implementation mode

This is the cleanest way to move toward the “launch it and sleep” promise without turning the user’s live branch into an unsafe execution surface.

---

## 16. Recommended phased roadmap

## P0 — must do now

Goal: stop the visible breakage and make pipeline start deterministic.

Deliverables:

- route ticket system
- removal of intent side-channel gating
- no stdout/stderr diagnostics in production paths
- canonical worktree-root artifact resolution
- lifecycle tests for route/start
- no-console and no-cwd static guards

## P1 — must do next

Goal: make delegated/background work real.

Deliverables:

- supervised child-session execution model
- task completion based on lifecycle observation
- controller halts instead of improvising on pipeline failure

## P2 — should do after runtime is stable

Goal: fix UX truthfulness and operator reliability.

Deliverables:

- toast taxonomy and UX cleanup
- docs updated to reflect actual runtime
- config wiring audit and cleanup

## P3 — strategic hardening

Goal: move from clever plugin to reliable autonomous platform layer.

Deliverables:

- controller/worker split
- run manifest model
- worktree isolation
- capability-pack modularization

---

## 17. Final recommendation

Do **not** try to fix everything at once in one uncontrolled refactor.

Do this in order:

1. **Stop the user-visible leak.**
   Eliminate logger fallback stdout behavior and ban direct console writes.

2. **Make route-to-orchestrate explicit and durable.**
   Replace side-channel authorization with a single-use route ticket.

3. **Unify project context.**
   Move all project state to worktree-root artifact resolution.

4. **Then rebuild background execution as supervised child runs.**

That ordering matters.

If you do P1 before P0, you will build more complexity on top of a controller that still cannot reliably start and still leaks internal state into the UI.

If you do P0 well, the plugin will stop feeling haunted and start behaving like a controlled system.

---

## Appendix A — specific current code evidence to preserve

These areas are materially better than in the earlier audit and should not be regressed:

- `package.json` dependency hygiene improvements
- `tsconfig.json` Bun type alignment
- real git diff evidence in review pipeline
  - `src/review/diff-evidence.ts`
  - `src/tools/review.ts`
- background config wiring for persistence and concurrency
  - `src/tools/background.ts`
  - `src/tools/delegate.ts`

---

## Appendix B — current production files with direct `console.*`

At the time of this analysis, production `src/` contains direct console writes in files including:

- `src/agents/index.ts`
- `src/lsp/lsp-client-transport.ts`
- `src/lsp/temp-cleanup.ts`
- `src/lsp/process-cleanup.ts`
- `src/observability/forensic-log.ts`
- `src/skills/adaptive-injector.ts`
- `src/logging/domains.ts`

These should be treated as remediation targets.

---

## Appendix C — current project-scoped tool files using `process.cwd()`

At the time of this analysis, tool files using `process.cwd()` include:

- `src/tools/memory-preferences.ts`
- `src/tools/state.ts`
- `src/tools/memory-save.ts`
- `src/tools/session-stats.ts`
- `src/tools/update-docs.ts`
- `src/tools/memory-search.ts`
- `src/tools/logs.ts`
- `src/tools/summary.ts`
- `src/tools/forensics.ts`
- `src/tools/delegate.ts`
- `src/tools/background.ts`
- `src/tools/graph-query.ts`
- `src/tools/graph-index.ts`
- `src/tools/pipeline-report.ts`
- `src/tools/quick.ts`
- `src/tools/confidence.ts`
- `src/tools/plan.ts`
- `src/tools/phase.ts`

This list should be re-audited after the project context resolver lands.

---

## Appendix D — official OpenCode references used for design validation

The implementation guidance in this document is aligned against current official OpenCode behavior in these areas:

- plugin hook lifecycle and event surfaces
- custom tool context (`sessionID`, `messageID`, `directory`, `worktree`)
- server session APIs, child sessions, message APIs, `prompt_async`, and session status
- SDK session operations and TUI toast controls
- server/app logging endpoint and TUI show-toast support

Those references should continue to be checked during implementation in case OpenCode evolves further.
