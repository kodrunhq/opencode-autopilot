# OpenCode Autopilot — Comprehensive Architecture, Product, and Implementation Audit

_Date:_ 2026-04-10  
_Audit basis:_ uploaded repository snapshot `opencode-autopilot-main-3.zip`, current official OpenCode/Bun/MCP documentation, and current public reference repositories named as inspiration sources by the project owner.  
_Audit goal:_ produce an implementation-grade document that can be used as the blueprint for hardening this plugin into a credible autonomous software-development system.

---

## 1. Executive summary

This project is substantial. It is not a prompt pack, not a toy plugin, and not an empty marketing shell. The repository contains a serious amount of architecture, code, tests, schemas, persistence, orchestration, review logic, memory logic, health checks, observability, recovery, graph tooling, and LSP tooling.

That said, the current system is **not yet a trustworthy “overnight autonomous product factory.”** It is better described as:

> a broad, ambitious orchestration framework with several strong subsystems, several partially-realized subsystems, and a critical mismatch between the autonomy it claims and the autonomy it can currently guarantee.

That mismatch is the central reason it “doesn’t work as well as it should.”

### Bottom line

The concept is correct. The current implementation is over-broad, under-hardened, and too dependent on prompt compliance in places where the controller should own the contract.

The main issues are:

1. **Execution integrity is incomplete.**  
   The background/delegation path marks tasks “completed” after dispatch, not after verified child execution.

2. **Several critical capabilities are present only as partial infrastructure or prompt conventions.**  
   Worktree/PR lifecycle, MCP lifecycle, and parts of review evidence flow are not fully controller-owned.

3. **Config, docs, and runtime behavior have drifted.**  
   Some documented knobs are stale, some real knobs are not wired, and several counts/claims no longer match the source.

4. **The system is too wide for its current reliability budget.**  
   It is trying to be an orchestrator, memory system, review engine, background executor, MCP manager, graph toolchain, LSP client, observability platform, and UX layer simultaneously.

5. **The product promise is too aggressive for the current proof model.**  
   “Wake up to a fully functioning high-quality product” requires hard evidence and hard completion gates. At present, parts of the system still rely on “the agent should do X,” which is not the same thing as “the controller guarantees X.”

### What should happen next

This project should **not** be scrapped. It should be narrowed, hardened, and turned into a system that is explicit about what is real, what is inferred, and what is enforced.

The correct strategic move is:

> preserve the strongest subsystems, replace the pseudo-autonomous ones with supervised execution, and formalize the run contract from “agent behavior” into “typed artifacts + verified lifecycle + hard acceptance gates.”

---

## 2. Restating the intended product from a product-owner perspective

The target product is not just “a plugin with many cool tools.”

The intended product is:

- an **OpenCode-native** open-source plugin,
- that consolidates the **best practical ideas** from the top agent/plugin ecosystems,
- with a strong focus on **autonomous software delivery**,
- where the user gives a high-level idea,
- the system performs research, architecture, planning, implementation, review, validation, and packaging,
- and the next morning the user receives a usable result with minimal or no human intervention.

That implies a very specific product standard.

### The actual product promise hidden inside your description

What you want is effectively:

1. **Idea intake**
2. **Spec extraction / scope freeze**
3. **Plan generation**
4. **Parallelizable execution**
5. **Safe editing**
6. **Memory across runs**
7. **Autonomous verification**
8. **Autonomous review**
9. **Acceptance evidence**
10. **Recovery / resume**
11. **Morning handoff**

This is not “just an AI coding plugin.” It is an **autonomous delivery operating system** sitting on top of OpenCode.

That distinction matters, because it changes how the system must be designed.

A plugin can get away with rough edges.  
An overnight autonomous delivery system cannot.

### The real user expectation

A user who uses this in the intended way will not judge it by how many tools it registers or how clever its prompts are.

They will judge it by five questions:

1. Did it actually finish the right thing?
2. Did it break anything?
3. Can I trust the result without rereading the whole repo?
4. Can I see evidence of what it did and why?
5. If it failed, can it resume cleanly without starting over?

That is the bar this project must meet.

---

## 3. Methodology and scope of this audit

This document is based on three inputs:

### 3.1 Repository inspection

I inspected the uploaded repository snapshot directly. The codebase is large enough to support a real architecture review.

Approximate shape of the repository snapshot:

- `src/`: 342 TypeScript source files
- `tests/`: 229 TypeScript test files
- `docs/`: 16 markdown documents

Approximate source concentration by top-level area:

- `src/tools/`: 6,570 LOC
- `src/orchestrator/`: 5,937 LOC
- `src/memory/`: 3,525 LOC
- `src/lsp/`: 2,468 LOC
- `src/observability/`: 2,383 LOC
- `src/review/`: 2,221 LOC
- `src/graph/`: 1,465 LOC
- `src/background/`: 1,349 LOC
- `src/agents/`: 1,355 LOC
- `src/autonomy/`: 1,071 LOC
- `src/index.ts`: 880 LOC

Largest implementation hotspots include:

- `src/tools/orchestrate.ts` — 1,591 LOC
- `src/inspect/repository.ts` — 912 LOC
- `src/index.ts` — 880 LOC
- `src/health/checks.ts` — 818 LOC
- `src/memory/preferences.ts` — 718 LOC

### 3.2 Static validation limits

This was primarily a **code-and-architecture audit**, not a full live runtime certification.

Important limitation:

- Bun is not installed in this audit container, so I did **not** execute the plugin end-to-end under Bun/OpenCode.
- I did run a plain `tsc --noEmit` check in the generic environment, which failed immediately due to the repo’s `bun-types` compiler configuration.

That means this audit should be read as:

> a high-confidence implementation review grounded in source code and current upstream platform docs, with a few targeted environment checks, but not a full runtime acceptance test against a live OpenCode instance.

### 3.3 External references checked

I validated against current upstream documentation for:

- OpenCode plugin architecture
- OpenCode server APIs
- OpenCode tool/permission behavior
- OpenCode provider credential storage
- Bun TypeScript guidance
- MCP architecture and transport model

I also reviewed the current public positioning of the inspiration systems you explicitly referenced:

- oh-my-openagent
- everything-claude-code
- get-shit-done
- obra superpowers
- claude-mem
- MemPalace

This comparison matters because your stated goal is not generic autonomy. It is specifically to unify the strongest ideas from the most effective agent ecosystems.

---

## 4. Current system inventory: what this project already has

One of the most important corrections to make is this:

> the project is not missing architecture; it is missing execution integrity and product discipline.

There is already a lot here worth preserving.

### 4.1 There is a real pipeline

The orchestrator already models a multi-phase pipeline.

`src/orchestrator/schemas.ts:8-17` defines the phases:

- `RECON`
- `CHALLENGE`
- `ARCHITECT`
- `EXPLORE`
- `PLAN`
- `BUILD`
- `SHIP`
- `RETROSPECTIVE`

This is a legitimate skeleton for an autonomous SDLC pipeline.

### 4.2 There is already an artifact spine

This is important because earlier, more superficial reviews could easily miss it.

The project already has meaningful run-scoped artifact discipline:

- phase directories under `.opencode-autopilot/phases/<run_id>/<PHASE>/`
- canonical artifact refs via `getArtifactRef(...)`
- required artifact checks in multiple phase handlers
- typed plan task artifacts in `src/orchestrator/contracts/phase-artifacts.ts`

Relevant evidence:

- `src/orchestrator/artifacts.ts:10-40`
- `src/orchestrator/artifacts.ts:58-66`
- `src/orchestrator/contracts/phase-artifacts.ts:5-58`
- `src/orchestrator/handlers/recon.ts`
- `src/orchestrator/handlers/plan.ts`
- `src/orchestrator/handlers/ship.ts`

This means the correct move is **not** “invent artifacts from scratch.”  
The correct move is to **expand and harden the existing artifact system**.

### 4.3 There is already an Oracle-style verification gate

Another important correction: the project does already implement a meaningful Oracle post-completion loop.

Evidence:

- `src/autonomy/controller.ts:154-184`
- `src/autonomy/controller.ts:226-284`
- `src/index.ts:340-390`

The controller can:

- run verification,
- dispatch Oracle consultation through a child session,
- enter `oracle_verification_pending`,
- poll for the result,
- either mark verified and complete,
- or feed failure guidance back into the loop until max attempts are reached.

That is real value. It should be kept and strengthened, not replaced.

### 4.4 There is already a serious memory subsystem

The memory system is materially more advanced than a simple preferences file.

There are dedicated modules for:

- capture
- injection
- retrieval
- lessons
- memories
- observations
- preferences
- decay
- dedup
- project scoping

Relevant files include:

- `src/memory/capture.ts`
- `src/memory/injector.ts`
- `src/memory/retrieval.ts`
- `src/memory/memories.ts`
- `src/memory/preferences.ts`
- `src/orchestrator/lesson-memory.ts`
- `src/review/memory.ts`

This is a real differentiator.

### 4.5 There is already a substantial review system

The review system is not decorative.

There are:

- multiple review stages,
- review state persistence,
- cross-verification,
- fix-cycle logic,
- review memory,
- specialist review agents.

Relevant areas include:

- `src/tools/review.ts`
- `src/review/pipeline.ts`
- `src/review/cross-verification.ts`
- `src/review/fix-cycle.ts`
- `src/review/memory.ts`

The problem is not that review does not exist.  
The problem is that it is starved of the right evidence in key places.

### 4.6 There are graph, LSP, health, observability, and recovery subsystems

The project also includes meaningful implementation in:

- code graph indexing and query
- LSP tools
- health diagnostics
- observability and forensic logs
- recovery orchestration
- hash-anchored edits
- background queueing infrastructure
- routing and intent logic

This matters because the right conclusion is not “the repo is mostly fake.”

The right conclusion is:

> the repo contains several advanced subsystems, but some of the most important ones for autonomy are still either incomplete, mismatched, or not enforced end-to-end.

---

## 5. What is strong and should be preserved

This section is critical. A hardening project should not destroy its best assets.

### 5.1 Preserve the pipeline shape and run-scoped artifacts

The pipeline phases are structurally sensible.  
The artifact directory structure is good.  
The typed `tasks.json` artifact is good.

Do **not** throw this away.

Instead:

- add a top-level run manifest,
- add acceptance artifacts,
- tighten phase contracts,
- enforce mandatory evidence production.

### 5.2 Preserve the Oracle loop

The Oracle pattern is one of the most valuable parts of the system because it creates a second-order completion check.

Keep it, but strengthen the evidence it sees.

### 5.3 Preserve hash-anchored editing

Your system is explicitly trying to adopt one of the strongest ideas from oh-my-openagent: make file edits less brittle and less stale.

The `oc_hashline_edit` concept is absolutely worth keeping. This is one of the best practical anti-corruption features in the project.

### 5.4 Preserve memory, but broaden its scope

The current memory architecture is good enough to serve as the “curated memory layer.”

Do not replace it wholesale.

Instead, add a second memory mode:

- curated memory for distilled reusable knowledge
- verbatim or near-verbatim run ledger for exact reconstruction and citation

### 5.5 Preserve observability and recovery

The project already has more operational introspection than many agent systems:

- session logs
- event store
- forensic logging
- health checks
- recovery orchestration
- retention

That is the right instinct. It should become part of the reliability program, not just debugging convenience.

### 5.6 Preserve the review idea, but fix the evidence contract

Multi-agent review can be valuable.  
It only becomes credible when every reviewer gets concrete evidence.

The architecture should stay. The evidence feed must change.

---

## 6. Detailed findings

---

### 6.1 Packaging, release, and runtime integrity

This is a P0 area.

#### 6.1.1 Missing runtime dependency: `zod`

`zod` is imported throughout runtime code, but it is not declared in `package.json`.

Evidence:

- `package.json:34-39,59-65`
- `src/config.ts`
- `src/types/background.ts`
- `src/tools/background.ts`
- `src/tools/loop.ts`
- many more runtime imports under `src/`

Why this matters:

- OpenCode installs npm plugins through Bun based on the package manifest.
- If a runtime dependency is missing from the manifest, the install contract is broken even if local development happened to work.
- This is not cosmetic. It is release integrity.

**Assessment:** hard defect.  
**Priority:** P0.

#### 6.1.2 Runtime import of `typescript`, but only declared as a dev dependency

`src/graph/parser.ts` imports `typescript` at runtime:

- `src/graph/parser.ts:8-10`

But `package.json` declares `typescript` only under `devDependencies`:

- `package.json:34-39`

Why this matters:

- the graph subsystem is not just a compile-time tool; it is wired into actual plugin features (`oc_graph_index`, `oc_graph_query`)
- if production install omits dev dependencies, runtime graph features break

**Assessment:** hard defect for graph features.  
**Priority:** P0.

#### 6.1.3 TypeScript/Bun config is stale

`tsconfig.json` uses:

- `"types": ["bun-types"]` at `tsconfig.json:11`

Current Bun guidance is to install `@types/bun` and use:

- `"types": ["bun"]`

In this audit environment, running `tsc --noEmit` failed immediately with:

- `TS2688: Cannot find type definition file for 'bun-types'`

Why this matters:

- this repo’s typecheck contract is out of sync with current Bun guidance
- build friction at the foundation level destroys trust fast

**Assessment:** correctness drift / build hygiene defect.  
**Priority:** P0.

#### 6.1.4 Missing explicit `@opencode-ai/sdk` dependency

The source imports many types from `@opencode-ai/sdk`, but the package manifest does not declare it explicitly.

Evidence:

- type imports across `src/agents/*` and `tests/index.test.ts`
- `package.json` does not list `@opencode-ai/sdk`

This is not necessarily a runtime failure if the dependency is supplied transitively somewhere else in the author’s environment, but that is exactly the problem: the contract is implicit.

**Assessment:** dependency hygiene / portability defect.  
**Priority:** P1, but should be fixed with P0 packaging cleanup.

#### Recommendation

- Add `zod` to `dependencies`
- Move `typescript` to `dependencies` if the graph parser remains runtime-bound
- Declare `@opencode-ai/sdk` explicitly
- Update `tsconfig.json` to current Bun guidance
- Add a CI check that validates the published package can install and load as an OpenCode plugin in a clean environment

---

### 6.2 OpenCode integration correctness

The repo is trying to be deeply OpenCode-native. That is correct. But several integrations are only partially aligned with the platform.

#### 6.2.1 The background SDK dispatch path ignores `agent`

The background task system stores both `agent` and `model`, but the SDK runner only forwards `model` and text parts.

Evidence:

- task creation stores both:
  - `src/tools/delegate.ts:195-199`
- SDK runner interface only accepts `(sessionId, model, parts)`:
  - `src/background/sdk-runner.ts:4-10`
- implementation logs `task.agent` but does not forward it:
  - `src/background/sdk-runner.ts:27-38`
- index background adapter also only forwards model:
  - `src/index.ts:323-335`

This is a direct mismatch with the current OpenCode server API, which allows both `model` and `agent` in session message bodies and applies the same body shape to `prompt_async`.

#### 6.2.2 The background SDK dispatch path invents an invalid model shape

`src/index.ts:329-333` creates:

```ts
{ providerID: "", modelID: model }
```

and force-casts it into the expected model shape.

This is not a robust model resolution strategy. It is a type escape hatch.

#### 6.2.3 Group IDs are being used where model IDs should be used

Delegation currently passes:

- `model: routing.modelGroup`

Evidence:

- `src/tools/delegate.ts:195-199`
- routing definitions use group names like `builders`, `architects`, `utilities`
- config schema for groups expects concrete assignments with `primary` and `fallbacks`:
  - `src/config.ts:138-141`

That means routing is producing **group abstractions**, but background execution is treating them like **concrete executable model identifiers**.

This is conceptually wrong.

#### 6.2.4 Project/worktree scoping is inconsistent

The plugin entrypoint correctly derives:

- `const projectRoot = input.worktree ?? input.directory ?? process.cwd();`
  - `src/index.ts:214`

But many operations still use `process.cwd()` directly instead of the resolved project/worktree root.

Examples:

- `src/index.ts:183`
- `src/index.ts:196`
- `src/index.ts:264`
- `src/index.ts:279`
- `src/index.ts:501-556`
- `src/tools/orchestrate.ts:625`
- `src/tools/orchestrate.ts:1589`
- several observability and tool modules

Why this matters:

- OpenCode explicitly provides both `directory` and `worktree`
- this plugin wants parallelism and autonomy
- global cwd leakage weakens project isolation and makes worktree-based execution less trustworthy

#### Recommendation

Create a single execution adapter that owns:

- session ID
- parent/child session relations
- concrete agent resolution
- concrete model resolution
- directory/worktree root
- diff retrieval
- fork/session lifecycle
- telemetry

Everything that touches OpenCode runtime execution should go through that adapter.

---

### 6.3 Background and delegation: the biggest autonomy illusion in the codebase

This is the single most important engineering problem in the repo.

#### What the code does today

`oc_delegate` can route work and spawn a background task.

The background manager can queue tasks, manage concurrency, and record task status in SQLite.

But the execution substrate currently behaves like this:

1. create a task record
2. call `promptAsync(...)`
3. return `"Dispatched ..."`
4. mark the task completed

Evidence:

- `src/background/sdk-runner.ts:34-38`
- `src/background/executor.ts:128-141`

That means the system currently treats **dispatch completion** as **task completion**.

That is a false-completion bug.

#### Why this is fatal to the overnight vision

An overnight autonomous system must never tell itself “done” when it has only sent work into the void.

That creates:

- false success
- unreliable orchestration
- misleading status dashboards
- broken retries
- corrupted dependency scheduling
- untrustworthy user handoff

This is the exact kind of defect that makes autonomous systems feel “almost good” while being impossible to trust.

#### Additional defects in the same subsystem

##### 6.3.1 Default timeout is unrealistically low

- `src/background/executor.ts:107-110` defaults timeout to `1_000ms`

That makes no sense for real agent work.

##### 6.3.2 Config knobs are not wired

Schema defines:

- `background.enabled`
- `background.maxConcurrent`
- `background.persistence`

Evidence:

- `src/types/background.ts:45-49`

But default manager construction ignores them:

- `src/tools/background.ts:28-35`
- `src/tools/background.ts:42-48`
- `src/tools/delegate.ts` follows the same pattern for manager acquisition

Manager itself falls back to:

- `maxConcurrent ?? 5`
  - `src/background/manager.ts:75-79`

I found no runtime consumption of `background.enabled` or `background.persistence` outside schema/docs.

##### 6.3.3 Background persistence defaults to a global DB, not a project DB

Default manager construction uses:

- `openKernelDb()` with no project root
  - `src/tools/background.ts:34`
  - `src/kernel/database.ts:9-19`

`openKernelDb()` with no argument resolves to the global config location, not `.opencode-autopilot/` inside the project.

That means default background task persistence is cross-project/global by default.

##### 6.3.4 Documentation drift compounds the problem

README still refers to:

- `background.maxSlots`
- `background.defaultTimeout`
- `routing.defaultCategory`

Evidence:

- `README.md:215-216`
- `README.md:345-347`

Meanwhile `src/ux/error-hints.ts:68` still tells users to increase `maxSlots`, which is not the current config shape.

#### Recommendation: replace queue completion with real supervised execution

The correct model is:

- each delegated task becomes a real child session or tracked run
- the system stores child session ID / attempt ID
- status updates are driven by actual session lifecycle and/or verified outputs
- completion only occurs after:
  - child session is truly idle/completed,
  - outputs are collected,
  - required artifacts are present,
  - verification passes

This is not optional. It is the foundation of the product.

---

### 6.4 Autonomy loop: strong concept, incomplete configuration and proof model

This subsystem is one of the stronger parts of the repo, but it still has important issues.

#### 6.4.1 Strength: Oracle loop is real

The Oracle verification path is a genuine strength.

Evidence:

- `src/autonomy/controller.ts:154-184`
- `src/autonomy/controller.ts:226-284`
- `src/index.ts:340-390`

This already moves the project beyond simple “done when the agent says so.”

#### 6.4.2 Weakness: autonomy config drift

Autonomy defaults disagree.

- `src/autonomy/config.ts:7-10` sets `maxIterations: 100`
- `src/config.ts:241-247` sets plugin config default to `maxIterations: 10`

`oc_loop` only forwards an explicit per-call `maxIterations` if provided:

- `src/tools/loop.ts:31-35`

The general controller construction path does not appear to consistently propagate the plugin-configured autonomy defaults into the controller.

#### 6.4.3 Weakness: verification is real, but still too basic for the product promise

The current verification handler is better than nothing and clearly useful:

- package-manager-aware default test/lint command resolution
- project-local verification overrides
- artifact existence checks

Evidence:

- `src/autonomy/verification.ts:46-81`
- `src/autonomy/verification.ts:97-176`
- `src/autonomy/verification.ts:189-234`

That is a good starting point.

But for an overnight delivery system, it is still not enough.

Missing from the ship contract:

- browser acceptance flows
- API smoke verification
- screenshot or user-facing artifact evidence
- migration sanity checks
- dependency health / install sanity
- risk ledger
- explicit critical finding blocker from review
- proof that the requested outcome, not just the code health, has been achieved

#### Recommendation

Keep the autonomy loop. Expand the proof model.

The right trajectory is:

- retain test/lint/artifact verification
- retain Oracle consultation
- add acceptance evaluators
- add product-output evidence
- add severity-based release blocking
- add “false complete” detection metrics

---

### 6.5 Pipeline/orchestrator: strong structure, too much protocol in prompts

This is the second most important architectural issue after background execution.

#### 6.5.1 Strength: the orchestrator is real and substantial

`src/tools/orchestrate.ts` is not fake. It is a serious stateful controller.

There is clearly real effort around:

- phase progression
- persistence
- pending dispatch tracking
- retries
- circuit breakers
- review inlining
- lesson injection
- progress tracking
- user-facing status

This is good.

#### 6.5.2 Weakness: controller complexity is too concentrated

`src/tools/orchestrate.ts` is 1,591 lines.  
`src/index.ts` is 880 lines.

That is not automatically bad, but it is a smell here because the plugin is also carrying a very large number of subsystems and runtime hooks.

It becomes too easy for:

- config drift
- dead flags
- implicit coupling
- partial feature paths
- hidden invariants

to accumulate.

#### 6.5.3 Weakness: too much of the global behavior lives in agent prompts

The `autopilot` agent prompt is highly procedural and protocol-heavy.

Evidence:

- `src/agents/autopilot.ts:8-118`
- `src/agents/autopilot.ts:146-149`

The `oc-implementer` prompt also carries branch, PR, and execution-mode governance that the controller should own.

Evidence:

- `src/agents/pipeline/oc-implementer.ts:10-105`

This is the wrong ownership boundary.

Prompts should contain:

- local role guidance
- style/quality expectations
- specific task instructions

Controllers should own:

- lifecycle
- state transitions
- retries
- artifact paths
- workdir binding
- branch/worktree binding
- PR lifecycle
- completion gates

#### 6.5.4 Weakness: one of the advertised phases is not implemented

`EXPLORE` currently resolves to:

- `progress: "EXPLORE skipped (not yet implemented)"`
  - `src/orchestrator/handlers/explore.ts:3-9`

This matters for two reasons:

1. the docs and product story present an 8-phase autonomous pipeline
2. one of the phases is explicitly a stub

This should be either:
- implemented properly, or
- removed from the marketed pipeline until it is real

#### Recommendation

Do not replace the pipeline.  
Refactor it around clearer hard contracts:

- phase inputs
- phase outputs
- required artifacts
- required evidence
- allowed failure modes
- retry semantics
- completion criteria

And move more control out of the prompts.

---

### 6.6 Review system: strong architecture, insufficient evidence

The review system can become one of the strongest parts of the product, but it is currently underfed.

#### 6.6.1 Strength: real multi-stage review architecture

There is a meaningful staged review design.

That is worth preserving.

#### 6.6.2 Weakness: stage 1 does not get real diffs

In `src/tools/review.ts`, stage 1 review prompts replace `{{DIFF}}` with a placeholder string:

- `src/tools/review.ts:203-208`

That means the specialist reviewers do **not** get actual diff hunks there.

#### 6.6.3 Weakness: stage 3 also degrades diff evidence

In `src/review/pipeline.ts`, stage 3 prompt construction replaces `{{DIFF}}` with a sanitized scope string, not actual diff evidence.

Evidence:

- `src/review/pipeline.ts:88-96`

#### 6.6.4 Why this matters

Review quality depends heavily on evidence density.

A reviewer that has to reconstruct the patch from scratch is slower, less consistent, and more likely to hallucinate context.

This system already has access to much better sources of truth:

- git diffs
- changed files
- session diffs
- task-level outputs
- test failures
- artifact references
- graph references
- LSP references

It should use them.

#### Recommendation

Build a formal review evidence bundle containing:

- exact diff hunks
- changed file list
- affected symbols
- failing test/lint output
- task IDs
- architecture refs
- risk flags
- runtime assumptions

Then feed that evidence bundle to every reviewer.

---

### 6.7 MCP integration: currently a simulated lifecycle manager

This is one of the clearest examples of a subsystem that looks more complete than it is.

#### 6.7.1 What exists today

There is an `McpLifecycleManager` with state transitions and health checks.

Evidence:

- `src/mcp/manager.ts:68-206`

#### 6.7.2 What it actually does

`startServer(...)`:

- validates config
- stores internal metadata
- transitions state
- calls `healthCheck(...)`

`healthCheck(...)`:

- checks whether a command or URL is present
- updates timestamps
- marks server healthy or unhealthy

What it does **not** do:

- spawn a stdio server process
- open a real transport
- perform MCP initialization negotiation
- register or consume tools/resources/prompts from a real server
- connect to OpenCode’s runtime MCP layer

#### 6.7.3 The tests confirm the shallow contract

The tests treat a “valid stdio server” as healthy purely from config validity.

Evidence:

- `tests/mcp/manager.test.ts:29-35`
- `tests/mcp/manager.test.ts:60-80`

This is not a real lifecycle integration test.

#### 6.7.4 MCP enablement is inconsistently respected

The adaptive injector defaults `mcpEnabled` to `true`:

- `src/skills/adaptive-injector.ts:196-200`
- `src/skills/adaptive-injector.ts:261-265`

`injectSkillContext(...)` in orchestrate does not pass `mcpEnabled`:

- `src/tools/orchestrate.ts:623-629`

That means skill-triggered MCP activation can still occur through the adaptive path even when the feature should be conceptually disabled.

#### 6.7.5 Product and security implication

Right now the MCP subsystem is in an awkward middle state:

- too substantial to be called “not started”
- too shallow to be trusted as a real server manager

This is dangerous because it creates false confidence.

#### Recommendation

Pick one of two paths:

##### Path A — honest minimalism
Remove the pseudo-lifecycle claims and reduce this subsystem to:
- config parsing
- inventory display
- maybe documentation helpers

##### Path B — real integration
Use either:
- OpenCode’s host-managed MCP capabilities directly, or
- a real MCP client implementation with stdio/HTTP lifecycle, capability negotiation, health, tool inventory, and error handling

Until one of those is done, this subsystem should not be marketed as a real MCP server manager.

---

### 6.8 Branch, worktree, and PR automation: strong intent, partially latent implementation

This area is especially important because it directly affects safe parallelism.

#### 6.8.1 There is real groundwork

The repo contains real code for:

- branch lifecycle structures
- worktree creation/removal
- worktree cleanup
- branch metadata
- PR body formatting

Evidence:

- `src/orchestrator/handlers/branch-pr.ts:148-218`
- `src/orchestrator/types.ts:17-26`
- `src/orchestrator/schemas.ts:99-144`

#### 6.8.2 But the `useWorktrees` path is effectively dormant

`useWorktrees` exists in pipeline state:

- `src/orchestrator/schemas.ts:144`

But I found no code path that sets it to `true`.

Search evidence from the snapshot shows only:

- schema declaration
- read usage in build handlers

No write path.

That means the worktree execution mode appears to be present in structure but not actually turned on by the current system.

#### 6.8.3 Even when worktrees are prepared, execution binding is weak

Parallel dispatch can include a `workdir` field:

- `src/orchestrator/handlers/build-utils.ts:240-260`

But I found no plugin-side consumer of `workdir` beyond:
- the dispatch result type declaration
- this returned payload

That means actual execution context still depends on:
- the agent reading the prompt correctly,
- honoring the instruction,
- and staying inside the intended worktree

That is weaker than a true child-session/workdir binding.

#### 6.8.4 PR lifecycle is still mostly prompt-owned

The implementer prompt contains rules about:

- commit
- push
- PR creation/update
- no merge

Evidence:

- `src/agents/pipeline/oc-implementer.ts:36-65`

The `SHIP` handler emits PR instructions as text:

- `src/orchestrator/handlers/ship.ts:7-23`
- `src/orchestrator/handlers/ship.ts:60-75`

But plugin-side PR lifecycle state helpers such as `recordPrCreation(...)` are not actually consumed anywhere.

Evidence:

- helper defined at `src/orchestrator/handlers/branch-pr.ts:56-66`
- no usage found in current source

Likewise `recordWorktreePath(...)` is defined but unused.

#### Recommendation

Treat worktree and PR management as a controller-owned execution layer, not as prompt etiquette.

That means:

- child sessions or child executors bound to concrete worktrees
- controller-owned git branch creation
- controller-owned worktree cleanup
- controller-owned PR lifecycle state
- prompt only sees the assigned worktree/task context

---

### 6.9 Memory system: good curated memory, missing run-ledger memory

This subsystem is strong, but it does not yet fully satisfy the intended product.

#### 6.9.1 What is already good

Current memory design includes:

- structured memories
- observations
- preferences
- lessons
- project scoping
- retrieval/injection
- capture hooks
- dedup / decay / ranking

This is a legitimate foundation.

#### 6.9.2 What is missing for the target product

Overnight autonomy needs two distinct kinds of memory:

##### A. Curated reusable knowledge
Examples:
- “this repo prefers Zod over io-ts”
- “tests are run via `pnpm test:unit`”
- “avoid touching legacy billing paths without migration review”

You already have the beginnings of this.

##### B. High-fidelity run history
Examples:
- exactly what was tried last night
- which commands ran
- what failed
- why an architectural decision was made
- what evidence justified the final completion status

The current system has observability and logs, but it does not yet expose a first-class run-history memory model with strong retrieval semantics and clean citations into future runs.

#### 6.9.3 Recommended direction

Add a second memory lane:

- **Curated memory lane** — keep current distilled memory system
- **Run ledger lane** — append-only, provenance-rich, citation-friendly, searchable history of runs

The curated system should optimize for low-noise recall.  
The run ledger should optimize for traceability and resumability.

This is one of the clearest opportunities to borrow from the memory-oriented inspiration systems without copying their marketing.

---

### 6.10 Graph and LSP: promising differentiators, but not yet first-class inputs to autonomy

This subsystem cluster is strategically valuable.

#### 6.10.1 Why it matters

Most agent frameworks stop at:
- search
- grep
- file edits
- tests

A serious code graph and LSP layer can materially improve:

- architecture analysis
- impact analysis
- rename/refactor safety
- review scoping
- task decomposition
- regression prediction

#### 6.10.2 Current state

The project already has:

- graph parser/index/query logic
- LSP tools
- diagnostics and symbol operations

That is good.

#### 6.10.3 Current limitation

Graph and LSP are still more like tool islands than mandatory inputs to the main execution contract.

Also, graph parsing depends on a runtime TypeScript import that is not packaged correctly today.

#### Recommendation

Use graph/LSP as structured evidence for:

- planning
- risk scoring
- review evidence bundles
- acceptance impact analysis
- regression watchlists

This is where they create compound value.

---

### 6.11 Observability, health, and recovery: very good substrate, underused as a quality system

This subsystem is one of the best signs in the repo.

You already have:

- event store
- forensic logs
- session log writing
- retention
- health checks
- recovery orchestration

This is stronger than many comparable projects.

#### The missed opportunity

Right now these systems mostly support introspection and debugging.

They should also support:

- benchmark generation
- run quality scoring
- false-completion detection
- phase timing analysis
- retry-pattern analysis
- escape-defect analysis
- operator dashboards
- automated regression detection between releases

#### Recommendation

Turn observability from “logs for debugging” into “the basis of the reliability program.”

---

### 6.12 Documentation, counts, config surface, and messaging drift

This area is hurting trust.

#### 6.12.1 Tool count drift

Current docs disagree with the source:

- `README.md:164` says “All 33 `oc_*` tools”
- `docs/README.md:52` says “all 27 `oc_*` tools”
- current source registry count is 39 `oc_*` tools in `src/index.ts`

Actual names found in `src/index.ts` include 39 registered `oc_*` tools.

#### 6.12.2 Config drift

README still documents stale background/routing keys:

- `background.maxSlots`
- `background.defaultTimeout`
- `routing.defaultCategory`

Evidence:

- `README.md:215-216`
- `README.md:345-347`

But current schemas use:
- `background.maxConcurrent`
- `background.persistence`
- category-based routing config

And `src/ux/error-hints.ts:68` still refers to `maxSlots`.

#### 6.12.3 Product-story drift

The repo positions itself as:
- fully autonomous
- 8-phase pipeline
- background task management
- deep MCP support

But at least some advertised paths are:
- stubbed (`EXPLORE`)
- simulated (`MCP`)
- only partially real (`background completion semantics`, `worktree/PR execution`)

#### Recommendation

Make the docs source-of-truth generated where possible.

At minimum:

- generate tool counts from the registry
- generate config docs from Zod schemas
- generate phase inventory from orchestrator schema/constants
- fail CI if docs drift from source

This is not nice-to-have. It is trust infrastructure.

---

## 7. Security assessment

Your product goal makes security non-negotiable because the system is designed for unattended execution.

### 7.1 Sensitive platform facts that matter

OpenCode itself is powerful:

- plugins can use the OpenCode SDK client
- plugins can run shell commands through Bun’s shell API
- OpenCode tools are enabled by default unless permissions are configured otherwise
- the OpenCode server can be protected with `OPENCODE_SERVER_PASSWORD`
- provider credentials are stored locally under `~/.local/share/opencode/auth.json`

Those facts turn this plugin into part of the local trusted execution base.

### 7.2 Current security posture of this plugin

#### Strengths

- review tool uses `execFile` for git commands rather than raw shell string execution
- there is clear awareness of prompt injection / context issues in some parts of the design
- hash-anchored edits are a real integrity improvement

#### Weaknesses

##### 7.2.1 Autonomous agents are granted broad powers

Examples:

- `src/agents/autopilot.ts:146-149`
- `src/agents/pipeline/oc-implementer.ts:106-110`

These include permissions such as:
- `edit`
- `bash`
- `webfetch`
- `todowrite`

For unattended autonomy, prompt rules are not enough. The system needs hard policy.

##### 7.2.2 No strong built-in secret boundary is visible

OpenCode’s docs explicitly show how to block `.env` reads with a plugin hook, but I did not find an equivalent hard-deny policy in this plugin.

That means the system does not currently appear to ship with a first-class secret-file guardrail.

##### 7.2.3 Background and MCP surfaces are not yet safely hardened

The current MCP manager is not a real runtime integration, but if completed later, it will become a code-execution and network-access surface.

The background system is likewise a place where “fire-and-forget autonomy” can bypass clear operator visibility if not redesigned carefully.

##### 7.2.4 Worktree isolation is not yet a hard sandbox

Even where worktree preparation exists, it is not universally enforced as an actual execution boundary.

#### 7.2.5 Global persistence paths create cross-project risk

Default background persistence uses a global DB path when no project root is provided.

That is not ideal for isolation or hygiene.

### 7.3 Security recommendations

#### P0 / P1 security actions

1. Add a **secret-file denylist** by default  
   At minimum:
   - `.env`
   - `.env.*`
   - credential JSON files
   - SSH config / keys
   - cloud credentials
   - common token stores

2. Add **execution policy profiles**
   - conservative
   - balanced
   - aggressive

3. Add **phase-based tool policies**
   - research can use web/search, not edit/bash by default
   - implementation can edit/bash, but with command allowlists
   - review can read/diff/test, not mutate unless in explicit fix cycle

4. Add **command policy**
   - allowlist/denylist for shell commands
   - explicit blocking of destructive commands unless in approved recovery/admin paths

5. Add **network policy**
   - explicit external access profiles
   - track/cite every external fetch used in a run

6. Add **project isolation defaults**
   - per-project persistence
   - per-run workspaces/worktrees
   - no default global task mixing

7. Add **operator attestation logs**
   - every bash command
   - every web fetch
   - every MCP server activation
   - every write outside artifact dirs

### 7.4 Security product stance

For a system like this, “secure enough” means:

- no silent secret reads
- no silent cross-project state contamination
- no silent external network dependence
- no silent false completion
- no mutation of user code without attributable evidence

That should be the standard.

---

## 8. Comparison against the inspiration systems you named

This section matters because the repo goal is explicitly comparative and synthetic.

### 8.1 oh-my-openagent

What is strong there conceptually:

- strong intent gate
- background specialist execution
- hash-anchored edits
- “doesn’t stop until done” framing
- integrated LSP/AST thinking
- stronger sense of a supervising discipline layer

What your repo already has in that direction:

- intent/routing infrastructure
- hashline edit
- Oracle verification loop
- multi-phase orchestrator
- graph/LSP subsystems

What is still missing relative to that standard:

- a truly reliable supervising execution substrate
- strict end-to-end completion semantics
- fewer latent/dead paths
- more deterministic enforcement outside prompts

### 8.2 everything-claude-code

What is strong there conceptually:

- memory persistence hooks
- continuous learning
- security thinking as a first-class topic
- verification/evals/parallelization mindset
- research-first development posture

What your repo already has:

- memory subsystem
- lessons learned
- observability
- some verification
- some parallelization groundwork

What is missing:

- a stronger reliability/evals program
- stronger security-as-architecture
- less prompt-owned operational behavior
- better lifecycle discipline around parallel execution

### 8.3 get-shit-done

The most important lesson from GSD is not specific tooling. It is the product stance:

> the complexity should live in the system, not in the user workflow.

That is exactly the right lens for this project.

Your repo currently exposes a very rich internal surface, but the primary UX is still too “operator-y” for the intended overnight-product-factory positioning.

### 8.4 obra superpowers

The lesson here is not just “skills are useful.”  
It is that a methodology layer can be productized well when installation and mental model stay simple.

Your skills layer is promising, but the plugin still feels like a large platform rather than a sharply optimized workflow product.

### 8.5 claude-mem / MemPalace-style memory systems

The useful lessons are:

- automatic capture
- automatic reinjection
- searchable historical context
- progressive disclosure
- citation/provenance
- memory as an always-on infrastructure layer, not a manual note-taking feature

Your current memory system is closer to a curated memory engine. That is good. What is missing is a stronger exact-history retrieval lane and better provenance visibility in future runs.

### Conclusion from the comparison

The problem is **not** that this repo copied the wrong ideas.

The problem is that it imported many of the right ideas **as features**, but not all of them **as operating principles**.

The biggest missing operating principles are:

- supervisor-owned lifecycle
- hard proof-of-work
- simplicity of user workflow
- security as architecture
- evidence-backed completion

---

## 9. What is missing

This section is not about bugs. It is about capability gaps.

### 9.1 A true run manifest

The project already has artifacts, but it still needs a stronger top-level run contract.

Recommended new artifact:

- `run-manifest.json`

Contents should include at minimum:

- run ID
- user objective
- normalized spec
- acceptance criteria
- constraints
- repo fingerprint
- environment fingerprint
- model assignments
- enabled tools/policies
- phase plan
- verifier requirements
- risk level
- human escalation rules

This should be the spine that everything else reads and writes.

### 9.2 A spec-freeze gate

The system needs an explicit early step that turns “user idea” into:

- objective
- scope
- non-goals
- constraints
- acceptance criteria
- open questions
- assumptions

Then it needs to freeze that into a machine-checked artifact before build execution starts.

Without that, the build phase is always more fragile than it needs to be.

### 9.3 A hard ship contract

Current verification is a start.  
The product needs a real ship contract.

Example components:

- tests pass
- typecheck passes
- lint passes
- required artifacts exist
- review has no unresolved critical findings
- acceptance evaluator passes
- no blocked migrations/config hazards
- final risk summary produced
- evidence bundle attached

### 9.4 Acceptance evaluators

This is the biggest product gap relative to the “wake up with a working product” goal.

The system needs specialized acceptance evaluators depending on target output:

#### Web application
- spin up app
- navigate critical flows
- capture screenshots
- detect fatal UI/runtime errors

#### API/service
- boot service
- run smoke requests
- validate schemas/status codes
- capture response examples

#### CLI/tooling
- run golden commands
- compare outputs
- validate error paths

Without this, the plugin can at best say:
- “the code looks plausible”
- “tests passed”

That is not the same as:
- “the requested product works”

### 9.5 A real supervisor for child execution

This is the single most important missing architectural piece.

Delegated work should be represented by:

- child sessions
- child branches/worktrees
- tracked attempt IDs
- explicit lifecycle state
- diff retrieval
- evidence retrieval
- retry history

The system currently has pieces of this, but not the unified supervisor abstraction.

### 9.6 A first-class morning report

For the intended UX, the final output of a run should be a concise operator-quality handoff artifact containing:

- what was built
- whether it passed ship gates
- how to run it
- screenshots or smoke evidence
- files changed
- open risks
- blocked items
- exact resume command or next step

This should be a first-class deliverable, not an emergent summary.

---

## 10. What is plainly wrong right now

This section is intentionally blunt and limited to issues directly supported by the current source.

1. **The package manifest is incomplete for runtime use.**  
   `zod` is runtime-imported but not declared. `typescript` is runtime-imported by graph parsing but only declared as a dev dependency.

2. **The Bun TypeScript config is stale.**  
   `tsconfig.json` still uses `bun-types`; plain `tsc --noEmit` fails immediately in the audit environment.

3. **Background tasks are marked complete after dispatch, not after real execution.**  
   This is a false-completion defect.

4. **Delegation stores `agent`, but background execution ignores it.**  
   The system logs the agent label but does not actually dispatch with it.

5. **Routing model groups are being treated like concrete model IDs.**  
   `builders`, `architects`, `utilities`, etc. are abstractions, not executable model specs.

6. **Background config fields exist but are not meaningfully wired into manager construction.**  
   At minimum `background.enabled`, `background.maxConcurrent`, and `background.persistence` are not functioning as trustworthy runtime knobs.

7. **One pipeline phase is explicitly not implemented.**  
   `EXPLORE` is stubbed and returns “skipped (not yet implemented).”

8. **Review stages are not consistently fed real diffs.**  
   Placeholder/scope substitutions are used instead of concrete change evidence.

9. **The MCP lifecycle manager is not a real MCP runtime integration.**  
   It validates config and marks state healthy/unhealthy, but does not actually launch or negotiate MCP connections.

10. **MCP enablement is inconsistently enforced.**  
    Orchestrator skill injection does not pass through `mcpEnabled`, while adaptive skill injection defaults to enabled.

11. **Worktree support is structurally present but operationally dormant.**  
    `useWorktrees` exists in schema but I found no code path setting it.

12. **PR lifecycle state helpers are partially dead.**  
    `recordPrCreation(...)` and `recordWorktreePath(...)` exist but are unused.

13. **Docs and source disagree on counts and config.**  
    Tool counts and several config keys are out of sync across README/docs/source.

14. **Project/worktree scoping is inconsistent.**  
    Many runtime paths still use `process.cwd()` even though plugin context provides project/worktree roots.

---

## 11. Preserve vs replace

This section is the shortest useful transformation map.

## Preserve

- pipeline phase model
- run-scoped artifact directory structure
- Oracle verification loop
- hash-anchored edit tooling
- memory / lessons / review-memory foundations
- observability / forensic logging / health checks / recovery
- graph and LSP subsystems
- multi-agent review idea
- typed Zod contracts

## Replace or re-architect

- background task completion semantics
- delegation execution substrate
- pseudo-MCP lifecycle manager
- prompt-owned branch/PR/worktree governance
- docs/config source-of-truth generation
- model-group-to-model resolution handling
- hard acceptance proof model
- user-facing surface area and workflow simplification

---

## 12. Radical changes that would make this much better

These are not “small fixes.” These are high-leverage structural changes.

### 12.1 Build one golden lane before optimizing breadth

The project currently tries to solve too many modes at once.

Pick one lane and make it excellent:

> contained feature development in a JS/TS repo with tests, on a feature branch, with verifier-gated completion and a strong morning handoff.

Everything else should be subordinate to that lane until reliability is proven.

### 12.2 Replace prompt choreography with supervised execution

Current autonomy leans too much on “the model should follow this operational protocol.”

Instead:

- create child sessions explicitly
- assign agent explicitly
- resolve model explicitly
- bind workdir explicitly
- track lifecycle explicitly
- collect outputs explicitly
- verify explicitly
- mark completion explicitly

Models should reason.  
Controllers should enforce.

### 12.3 Introduce a run-manifest architecture

Prompts are not the right place to store the state of a long autonomous run.

Use typed artifacts instead:

- `run-manifest.json`
- `spec.json`
- `plan.json`
- `taskgraph.json`
- `execution-report.json`
- `review-report.json`
- `acceptance-report.json`
- `handoff.md`

The current artifact spine gives you a head start. Expand it into the full contract.

### 12.4 Add a product-owner acceptance judge

Code review is not enough.

Add a dedicated acceptance judge that asks:

- Does the output satisfy the requested user outcome?
- Can I prove it with evidence?
- Is the result usable by a human who did not watch the run?

This judge should consume screenshots, smoke results, API samples, docs, and risk summaries.

### 12.5 Split the project into core plus capability packs

This repo is becoming monolithic in plugin form.

A better long-term architecture is:

- `autopilot-core`
- `autopilot-review`
- `autopilot-memory`
- `autopilot-graph`
- `autopilot-lsp`
- `autopilot-ux`
- `autopilot-security`

Even if you keep one repo, the runtime and config architecture should move in this direction.

### 12.6 Make memory dual-lane and provenance-rich

Keep the current curated memory system, but add:

- append-only run ledger
- exact citations/provenance
- privacy/secret exclusions
- poisoning resistance / trust scoring
- retrieval modes optimized for:
  - quick recall
  - exact reconstruction
  - operator audit

### 12.7 Stop marketing “bug-free” and start engineering “evidence-backed”

The external or internal positioning should move away from:
- “bug free”

and toward:
- verifier-gated
- evidence-backed
- resumable
- policy-controlled
- artifact-rich
- autonomy with explicit confidence and risk

That is how trust is earned.

---

## 13. Phased implementation roadmap

This roadmap is intended to be directly actionable.

---

### P0 — hard blockers

These are mandatory before the plugin can credibly move toward the stated product.

#### P0.1 Fix package/install/type integrity

- add `zod` to `dependencies`
- move `typescript` to `dependencies` or remove runtime dependence from graph parser
- declare `@opencode-ai/sdk` explicitly
- update `tsconfig.json` to current Bun conventions
- add clean-environment install validation in CI

#### P0.2 Replace background/delegate false-completion behavior

- do not mark tasks complete when dispatch returns
- create a real child-execution record
- store real child session/run identifiers
- poll actual lifecycle and/or collect explicit results
- only mark complete after verified completion criteria are met

#### P0.3 Resolve model groups into concrete model specs

- `builders`, `architects`, etc. must be mapped to concrete models before execution
- remove the fake `{ providerID: "", modelID: model }` bridge
- stop force-casting partial model specs

#### P0.4 Feed review stages real evidence

- use git/session diffs
- include changed files
- include failing output
- include relevant plan/design refs
- make review payload generation controller-owned

#### P0.5 Fix `EXPLORE`

Pick one:
- implement it fully
- remove it from the marketed pipeline
- explicitly mark it experimental and off by default

#### P0.6 Make MCP status honest

Pick one:
- simplify it to config inventory only
- or implement real MCP lifecycle integration

Do not leave it in its current ambiguous state.

#### P0.7 Reconcile docs/config/runtime source of truth

- generate config docs from schema
- generate tool list from registry
- remove stale knobs (`maxSlots`, `defaultTimeout`, etc.)
- add CI drift checks

#### P0.8 Fix project/worktree scoping

- pass project/worktree root consistently
- stop defaulting important runtime actions to `process.cwd()`
- stop default background persistence from going global without explicit intent

---

### P1 — reliability and safety hardening

#### P1.1 Add run manifest + spec freeze

Before build execution:
- normalize objective
- define acceptance criteria
- define non-goals
- freeze assumptions
- persist manifest

#### P1.2 Add a hard ship contract

Gate completion on:
- tests
- lint
- typecheck
- required artifacts
- review findings
- acceptance evaluator
- final risk report

#### P1.3 Make worktree execution real

- child sessions bound to worktree roots
- controller-owned lifecycle
- cleanup guarantees
- per-task isolation
- no reliance on prompt etiquette for path discipline

#### P1.4 Add default security profiles

- secret-file denies
- command restrictions
- network restrictions
- MCP trust modes
- mutation policies by phase

#### P1.5 Simplify the primary UX

User-facing surface should shrink to a few primary actions:

- start overnight run
- inspect status
- resume / retry
- show morning report
- doctor / diagnostics

The rest should be internal or advanced.

---

### P2 — capability expansion after reliability

#### P2.1 Dual memory

- curated memory
- run ledger
- provenance/citations
- privacy control
- retrieval modes

#### P2.2 Acceptance evaluators by product type

- web
- API
- CLI
- library/package

#### P2.3 Graph/LSP as orchestration inputs

Use graph/LSP for:
- task planning
- blast-radius scoring
- refactor safety
- review targeting
- regression watchlists

#### P2.4 Reliability benchmark suite

Build a repeatable harness that measures:
- completion rate
- false-complete rate
- verifier failure rate
- escaped defect rate
- intervention count
- recovery success rate

---

### P3 — strategic architecture evolution

#### P3.1 Modularize runtime capabilities

Refactor toward a core/capability-pack architecture.

#### P3.2 Add operator-facing dashboards and morning report UX

The “go to sleep, wake up with a result” experience needs a polished handoff surface.

#### P3.3 Add unattended-mode policy engine

Support explicit run modes such as:

- read-only analysis
- implementation without PR
- implementation with PR
- full overnight build with acceptance evaluation

Each mode should have clear security and completion semantics.

---

## 14. Definition of done for the transformation

This project is “fixed” only when the following are true.

### 14.1 No false completion

The system must never mark work complete when it has only dispatched it.

### 14.2 No config lies

Every documented config field must either:
- work as documented, or
- be removed

### 14.3 No stubbed marketed phases

Anything marketed as part of the main pipeline must be real.

### 14.4 Completion is evidence-backed

Every completed run must include:
- artifacts
- verification output
- review output
- acceptance evidence
- final risk statement

### 14.5 Default operation is safe enough for unattended use

At minimum:
- no secret-file reads by default
- no uncontrolled shell behavior
- no silent network dependencies
- no cross-project task pollution

### 14.6 The primary user workflow is simple

A serious product here should feel like:

1. describe goal
2. choose run mode
3. sleep
4. inspect morning report
5. accept / resume / reject

If the user has to understand 39 tools to get value, the product has failed its UX objective.

---

## 15. Suggested target architecture

This is the architecture I would recommend aiming for.

## Layer 1 — Platform adapter
Owns all OpenCode interactions:

- session create/fork
- prompt/message async
- diff retrieval
- model resolution
- agent resolution
- worktree binding
- telemetry hooks

## Layer 2 — Supervisor
Owns child execution:

- child sessions
- retries
- time budgets
- cancellation
- state transitions
- completion detection
- artifact collection

## Layer 3 — Run contract
Typed artifact model:

- run manifest
- spec
- plan
- task graph
- execution reports
- review reports
- acceptance reports
- handoff

## Layer 4 — Capability engines
Reusable subsystems:

- review
- memory
- graph
- LSP
- observability
- recovery
- MCP integration

## Layer 5 — Policy engine
Owns safety and mode rules:

- permissions by phase
- secret boundaries
- command rules
- network rules
- escalation rules

## Layer 6 — UX layer
Exposes simple product workflows:

- overnight run
- progress/status
- morning report
- resume/fix mode
- doctor

This preserves your modular ambitions while preventing the current “everything is everywhere” problem.

---

## 16. Specific implementation notes by subsystem

This section is intended to make the later implementation phase easier.

### 16.1 Background/delegate redesign sketch

Replace today’s background task record with something like:

```json
{
  "taskId": "...",
  "parentSessionId": "...",
  "childSessionId": "...",
  "agentId": "oc-implementer",
  "model": { "providerID": "...", "modelID": "..." },
  "status": "queued|running|awaiting_verification|completed|failed|cancelled",
  "artifacts": [...],
  "verification": {...},
  "attempts": [...]
}
```

Status transitions should be controller-owned and auditable.

### 16.2 Review evidence bundle sketch

```json
{
  "runId": "...",
  "phase": "BUILD",
  "taskIds": [1, 2],
  "changedFiles": [...],
  "diffHunks": [...],
  "failingChecks": [...],
  "symbolsTouched": [...],
  "designRefs": [...],
  "riskFlags": [...]
}
```

This becomes the standard input to all review agents.

### 16.3 Run manifest sketch

```json
{
  "runId": "...",
  "objective": "...",
  "spec": {
    "scope": [...],
    "nonGoals": [...],
    "acceptanceCriteria": [...],
    "constraints": [...]
  },
  "execution": {
    "mode": "overnight",
    "policyProfile": "balanced",
    "useWorktrees": true,
    "prMode": "single_branch"
  },
  "models": {...},
  "verifier": {...},
  "createdAt": "..."
}
```

### 16.4 Morning report sketch

The morning report should include:

- summary
- completion status
- acceptance evidence
- changed files
- tests run
- screenshots / examples
- open risks
- resume instructions
- exact diff/PR references

---

## 17. Recommended success metrics

If this plugin is going to be taken seriously, track the following per release.

### Reliability

- run completion rate
- false-complete rate
- recovery success rate
- average human interventions per run
- percentage of runs ending in verified completion

### Quality

- escaped defect rate
- review critical-finding precision
- acceptance-evaluator pass rate
- user rework rate after “complete”

### Product

- time to first trustworthy result
- time from idea to morning report
- operator comprehension time
- percent of users using only the primary workflow

### Security / safety

- blocked secret-file accesses
- blocked dangerous commands
- cross-project contamination incidents
- unauthorized network access attempts

---

## 18. Final judgment

The project has enough real engineering in it to justify a serious hardening effort.

It also has enough partial, drifted, or prompt-owned behavior that it cannot yet be treated as a reliable autonomous product-delivery system.

The key insight is this:

> the repo is not failing because the idea is wrong. It is failing because the control plane is not yet strict enough for the claim.

The path forward is not more clever prompting.

The path forward is:

- real supervisor semantics
- real evidence bundles
- real acceptance gates
- real safety policy
- real source-of-truth docs/config
- less breadth, more reliability

If you do that, this can become very good.

If you do not, it will remain one of those repos that feels impressive in architecture reviews but underperforms in actual autonomous delivery.

---

## 19. File-level evidence appendix

This appendix lists the most important repo evidence anchors used in this audit.

### Packaging / build

- `package.json:34-39`
- `package.json:59-65`
- `tsconfig.json:1-14`
- `src/graph/parser.ts:8-10`

### OpenCode execution integration

- `src/index.ts:214`
- `src/index.ts:323-335`
- `src/index.ts:340-390`
- `src/index.ts:501-556`

### Background / delegation

- `src/tools/delegate.ts:178-199`
- `src/background/sdk-runner.ts:4-38`
- `src/background/executor.ts:103-141`
- `src/background/manager.ts:75-80`
- `src/tools/background.ts:28-35`
- `src/tools/background.ts:42-48`
- `src/types/background.ts:45-49`
- `src/kernel/database.ts:9-19`

### Autonomy / verification

- `src/autonomy/config.ts:7-10`
- `src/config.ts:241-247`
- `src/tools/loop.ts:31-35`
- `src/autonomy/controller.ts:154-184`
- `src/autonomy/controller.ts:226-284`
- `src/autonomy/verification.ts:46-81`
- `src/autonomy/verification.ts:189-234`

### Pipeline / artifacts

- `src/orchestrator/schemas.ts:8-17`
- `src/orchestrator/artifacts.ts:10-40`
- `src/orchestrator/artifacts.ts:58-66`
- `src/orchestrator/contracts/phase-artifacts.ts:5-58`
- `src/orchestrator/handlers/explore.ts:3-9`
- `src/tools/orchestrate.ts` (large central controller)
- `src/agents/autopilot.ts:8-118`
- `src/agents/pipeline/oc-implementer.ts:10-105`

### Review

- `src/tools/review.ts:203-208`
- `src/review/pipeline.ts:88-96`

### MCP

- `src/mcp/manager.ts:77-182`
- `tests/mcp/manager.test.ts:29-35`
- `tests/mcp/manager.test.ts:60-80`
- `src/tools/orchestrate.ts:623-629`
- `src/skills/adaptive-injector.ts:196-200`
- `src/skills/adaptive-injector.ts:261-265`

### Worktrees / PR lifecycle

- `src/orchestrator/schemas.ts:144`
- `src/orchestrator/handlers/build-utils.ts:240-260`
- `src/orchestrator/handlers/branch-pr.ts:148-218`
- `src/orchestrator/handlers/branch-pr.ts:56-66`
- `src/orchestrator/handlers/branch-pr.ts:68-76`
- `src/orchestrator/handlers/ship.ts:7-23`
- `src/agents/pipeline/oc-implementer.ts:36-65`

### Docs / config drift

- `README.md:164`
- `README.md:215-216`
- `README.md:345-347`
- `README.md:357`
- `docs/README.md:52`
- `src/ux/error-hints.ts:68`

---

## 20. External reference appendix

These are the upstream references that informed the platform and comparison portions of this audit.

### Official platform docs

- OpenCode Plugins — https://opencode.ai/docs/plugins/
- OpenCode Server — https://opencode.ai/docs/server/
- OpenCode Tools — https://opencode.ai/docs/tools/
- OpenCode Providers — https://opencode.ai/docs/providers/
- Bun TypeScript docs — https://bun.sh/docs/runtime/typescript
- MCP Architecture — https://modelcontextprotocol.io/docs/learn/architecture

### Reference systems explicitly named as inspiration

- oh-my-openagent — https://github.com/code-yeongyu/oh-my-openagent
- everything-claude-code — https://github.com/affaan-m/everything-claude-code
- get-shit-done — https://github.com/gsd-build/get-shit-done
- obra superpowers — https://github.com/obra/superpowers
- claude-mem — https://github.com/thedotmack/claude-mem
- MemPalace — https://github.com/milla-jovovich/mempalace

---

## 21. Recommended next document after this one

The next implementation document should be:

> **“OpenCode Autopilot P0 Remediation Spec”**

It should contain:

- exact file changes
- target behavior after each change
- migration steps
- tests to add/update
- rollout order
- rollback strategy
- acceptance criteria per P0 item

That should be the working implementation blueprint for the first hardening phase.
