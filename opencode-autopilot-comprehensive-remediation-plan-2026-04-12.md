# OpenCode Autopilot — Comprehensive Remediation Plan

**Date:** 2026-04-12  
**Audience:** coding agents, maintainers, reviewers, product owner  
**Purpose:** convert the current failure evidence into an implementation-grade redesign plan that is explicit enough to execute without creative reinterpretation.

---

## 1. Scope of this document

This document addresses the full failure pattern observed in the attached run, screenshots, logs, config, and repository snapshot.

It is not a patch note and not a prompt tweak memo.

It defines:

- what is actually broken,
- why the current system behaves that way,
- which source files are most likely involved,
- the target architecture that must replace the current behavior,
- the workstreams and PR sequence required to get there,
- the acceptance tests that must exist before this can be called usable.

This plan is intentionally strict. The current issues are structural, so any implementation that stops at “better prompts” or “small UX cleanup” will fail again.

---

## 2. Evidence reviewed

Primary evidence used for this plan:

- repository snapshot from `opencode-autopilot-main.zip`
- full failing session transcript from `opencode_autopilot_ast_session20260412.md`
- `orchestration.jsonl`
- `opencode-autopilot.json`
- `opencode.json`
- attached screenshots showing:
  - root-level artifacts,
  - poor PR branch/title/body,
  - raw parent-session tool spam and `_Thinking:` leakage,
  - missing plan/sidebar projection,
  - modified-file footprint and PR shape

Key code areas inspected from the repository snapshot:

- `src/config.ts`
- `src/agents/autopilot.ts`
- `src/agents/planner.ts`
- `src/agents/pipeline/oc-reviewer.ts`
- `src/agents/oracle.ts`
- `src/tools/route.ts`
- `src/tools/orchestrate.ts`
- `src/orchestrator/handlers/build.ts`
- `src/orchestrator/handlers/ship.ts`
- `src/orchestrator/handlers/branch-pr.ts`
- `src/orchestrator/oracle-gate.ts`
- `src/orchestrator/state.ts`
- `src/orchestrator/schemas.ts`
- `src/orchestrator/renderers/tasks-markdown.ts`
- `src/kernel/database.ts`
- `src/utils/paths.ts`
- `bin/inspect.ts`
- `src/index.ts`
- `src/autonomy/controller.ts`
- `src/autonomy/verification.ts`
- `src/autonomy/oracle-bridge.ts`
- `src/tools/review.ts`

---

## 3. Executive diagnosis

The product is currently behaving like an **interactive orchestration assistant** that can sometimes automate implementation.

What you want is a **programmatic autonomous delivery controller** that:

- decomposes a broad dossier into a backlog of tranches,
- works through them without user intervention,
- runs real review and quality gates,
- refuses to ship when verification is blocked or failing,
- shows a clean operator surface instead of raw control-plane traffic.

Those are different systems.

The current system has six core structural defects:

1. **Contradictory execution semantics.**  
   Configuration and prompts say “full autonomy,” but runtime control flags disable autonomy, background execution, and routing, while the agent prompts still authorize clarifying questions and pipeline deferral.

2. **Single-run controller instead of program controller.**  
   The pipeline plans one run, builds one task list, ships one branch/PR, and stops. There is no persistent concept of “program backlog,” “remaining tranche,” or “continue until dossier is complete.”

3. **QA gates are advisory instead of authoritative.**  
   Review and Oracle exist, but they are not mandatory ship/completion sign-offs. Verification exists, but absent or blocked checks do not stop shipping.

4. **Delivery metadata is generated from raw request text instead of structured delivery state.**  
   That is why branch names, commits, and PR bodies are poor.

5. **Control plane and operator UX are conflated.**  
   The parent session is effectively the orchestration bus, so typed envelopes, internal status, raw tool payloads, and model meta-output spill into the UI.

6. **State exists, but projection is incomplete.**  
   Plans exist as `tasks.json` / `tasks.md` and pipeline state exists in `state.json`, but there is no finished sidebar implementation that renders them as an operator-facing plan view.

The correct remediation is therefore a **control-plane redesign**, not a wording adjustment.

---

## 4. Complaint-by-complaint diagnosis

### OPA-001 — Root-level artifact boundary is still not trustworthy

**User complaint:** root `kernel.db` and root `opencode.json` / `opencode`-related artifacts still appear and make no sense.

**What the code says now**

- `src/kernel/database.ts` already defines the project kernel DB path as `<repo>/.opencode-autopilot/kernel.db` via `openProjectKernelDb(projectRoot)`.
- `src/utils/paths.ts` defines `.opencode-autopilot` as the canonical project artifact directory.
- `bin/inspect.ts` already contains logic to detect legacy root `kernel.db`, migrated DBs, and mixed states.

**Why the field behavior is still unacceptable**

The fact that you still observed root-level artifacts means at least one of the following is true:

- an installed build is still calling an older path,
- a code path outside the intended happy path still writes to the repo root,
- migration/cleanup behavior is incomplete,
- artifact generation is not covered by installed-package end-to-end tests,
- plugin bootstrap/config generation is still allowed to write project-root files that users perceive as autopilot byproducts.

`opencode.json` is especially problematic from a product perspective even if it is technically a plugin bootstrap file. The user should never be left guessing which files are control-plane internals versus which files are expected OpenCode configuration.

**Root cause**

Artifact boundary invariants are not enforced end-to-end. They are partly implemented in code, but not made authoritative at runtime or release-validation time.

**Required fix**

- Make `.opencode-autopilot/` the only autopilot-owned project artifact root.
- Treat any repo-root `kernel.db*`, `state.json`, `current-review.json`, or other autopilot runtime file as invariant violations.
- Stop generating project-root OpenCode config from autopilot flows unless explicitly requested by the operator.
- Add startup doctor checks and end-of-run cleanup/verification.
- Add installed-package E2E tests, not just source-level unit tests.

**Primary files**

- `src/kernel/database.ts`
- `src/utils/paths.ts`
- `bin/inspect.ts`
- `bin/cli.ts`
- `src/tools/orchestrate.ts`
- `tests/kernel/project-kernel-path.test.ts`
- new E2E coverage under `tests/integration/` and `tests/cli/`

---

### OPA-002 — “Autonomous mode” is semantically contradictory

**User complaint:** Autopilot still asked for user input; that defeats the point.

**What the code says**

- `src/config.ts` defines `orchestrator.autonomy` with values like `full`, but also separately defines:
  - `background.enabled`
  - `autonomy.enabled`
  - `routing.enabled`
  - `verification.commandChecks`
- The attached config shows the contradiction directly:
  - orchestrator autonomy set to full,
  - but `background.enabled=false`,
  - `autonomy.enabled=false`,
  - `routing.enabled=false`,
  - and `verification.commandChecks=[]`.
- `src/agents/autopilot.ts` explicitly instructs the agent to ask for clarity when choices imply a large effort difference.
- `src/agents/planner.ts` explicitly tells the planner to ask one clarifying question when the goal is ambiguous.

**Root cause**

There is no single authoritative “mode contract.” Instead, there are multiple flags that partially overlap and can contradict each other.

**Required fix**

Replace the current semantic mess with a single mode model.

### Required mode model

```text
interactionMode = interactive | autonomous
executionMode   = foreground | background
visibilityMode  = summary | debug
verificationMode = strict | normal | lenient
```

Rules:

- `interactionMode=autonomous` forbids discretionary user questions.
- `interactionMode=autonomous` requires a non-empty verification profile.
- `interactionMode=autonomous` requires background-capable orchestration or an equivalent internal sub-session controller.
- `interactionMode=autonomous` requires backlog continuation semantics.
- `interactionMode=interactive` is allowed to ask the user for tranche choice or scope clarification.

**Hard policy**

In autonomous mode, the system may only stop for:

- missing credentials,
- destructive action approval,
- missing external access that cannot be inferred,
- mutually exclusive business decisions with no safe default.

Everything else must be handled internally.

**Primary files**

- `src/config.ts`
- `src/agents/autopilot.ts`
- `src/agents/planner.ts`
- `src/tools/route.ts`
- `src/tools/orchestrate.ts`
- `src/autonomy/controller.ts`
- `src/autonomy/types.ts`

---

### OPA-003 — Broad requests degrade into “choose one tranche” instead of autonomous continuation

**User complaint:** agents thought the scope was too big and asked to do just one part. Even if separate PRs are desirable, the system should continue through all tranches autonomously.

**What the current implementation does**

- `PipelineState` in `src/orchestrator/schemas.ts` represents a single run with one task list.
- `handlePlan` loads one `tasks.json` / `tasks.md` plan.
- `handleBuild` completes tasks/waves for that run.
- `handleShip` opens a PR for that run.
- The pipeline then completes.

There is no concept of:

- `ProgramRun`
- `Tranche`
- `Backlog`
- `Remaining dossier scope`
- `Continue to next PR`

**Root cause**

The controller is run-scoped, not program-scoped.

**Required fix**

Introduce a persistent program controller.

### New state model

Add these persistent entities:

- `ProgramRun`
  - original request
  - normalized objective
  - dossier reference(s)
  - backlog summary
  - completion status
- `Tranche`
  - tranche id
  - title
  - rationale
  - dependencies
  - status
  - target PR size
  - verification profile
- `WorkItem`
  - file/module targets
  - acceptance criteria
  - linked tranche
- `ProgramDecision`
  - why a tranche boundary exists
  - why a tranche was blocked, skipped, or deferred

### New control loop

```text
INTAKE
-> PLAN_PROGRAM
-> EXECUTE_TRANCHE
-> REVIEW_TRANCHE
-> ORACLE_TRANCHE
-> VERIFY_TRANCHE
-> SHIP_TRANCHE
-> ADVANCE_TO_NEXT_TRANCHE
-> ...
-> ORACLE_PROGRAM
-> COMPLETE
```

This is the missing behavior that would have prevented the session from stopping after only the first slice.

**Primary files**

- `src/tools/orchestrate.ts`
- `src/orchestrator/state.ts`
- `src/orchestrator/schemas.ts`
- `src/orchestrator/types.ts`
- `src/orchestrator/handlers/plan.ts`
- `src/orchestrator/handlers/build.ts`
- new `src/program/*` or equivalent program-controller module

---

### OPA-004 — Reviewer agents exist, but review is not a real stage with authority

**User complaint:** many reviewer agents exist, but the review process was not visibly or authoritatively run.

**What the code does now**

- `handleBuild` dispatches `AGENT_NAMES.REVIEW` once a wave completes.
- The prompt is only: `Review completed wave. Scope: branch. Report any CRITICAL findings.`
- `oc-reviewer` in `src/agents/pipeline/oc-reviewer.ts` delegates to `oc_review` and loops until complete.
- Only **critical** findings materially influence flow in `handleBuild`.

**Why that is insufficient**

- Review is nested inside BUILD, not modeled as a first-class stage.
- Non-critical findings are effectively not part of shipping policy.
- There is no structured review report attached to ship metadata.
- There is no visible reviewer roster / per-reviewer completion state in the operator UI.
- There is no explicit “required reviewers satisfied” gate.

**Root cause**

Review exists as a tool-driven subflow, not an authoritative pipeline contract.

**Required fix**

Create a real review runner and review state model.

### Required review model

- `ReviewRun`
  - scope
  - selected reviewers
  - startedAt / completedAt
  - verdict
- `ReviewFinding`
  - reviewer
  - severity
  - file
  - line
  - title
  - detail
  - status: open / accepted / fixed
- `ReviewPolicy`
  - required reviewers
  - severity thresholds
  - allowed waivers

### Required behavior

- Review must be visible as its own stage.
- Required reviewers must actually execute.
- Ship cannot proceed while required review findings remain open above policy threshold.
- Review results must be summarized in PR metadata and sidebar state.

**Primary files**

- `src/orchestrator/handlers/build.ts`
- `src/tools/review.ts`
- `src/review/*`
- `src/agents/pipeline/oc-reviewer.ts`
- new `src/orchestrator/review-runner.ts`
- `tests/review/*`
- new integration tests for build->review->ship gating

---

### OPA-005 — Oracle exists, but it is not the sign-off loop you want

**User complaint:** the Oracle loop that signs the pipeline complete against quality and user intent is missing.

**What the code does now**

- `src/orchestrator/oracle-gate.ts` is a heuristic helper.
- It decides whether to consult Oracle based on attempt count, strike count, “complex” keywords, and ambiguous review language.
- Oracle is consulted only inside BUILD, usually after critical review findings.
- `src/agents/oracle.ts` is a recommendation generator, not a completion authority.
- `src/autonomy/oracle-bridge.ts` exists for autonomy loop verification, but it is not wired as a mandatory ship/program sign-off contract.

**Why that is insufficient**

This is advisory consultation. It is not final intent-validation.

You want two distinct quality authorities:

1. **Tranche Oracle Signoff** — did this PR actually satisfy the intended tranche to acceptable quality?
2. **Program Oracle Signoff** — did the full sequence of tranches satisfy the user’s original intent?

Those do not exist as hard completion gates today.

**Required fix**

Implement explicit sign-off states and schemas.

### Required Oracle contract

For each tranche:

- inputs:
  - original intent
  - tranche intent
  - diff summary
  - review report
  - verification results
  - remaining backlog
- outputs:
  - `PASS`
  - `PASS_WITH_NEXT_TRANCHE`
  - `FAIL`
  - rationale
  - blocking conditions

For the full program:

- inputs:
  - original dossier request
  - all tranche results
  - unresolved risks / accepted waivers
- outputs:
  - `COMPLETE`
  - `INCOMPLETE`
  - `FAILED`

**Hard rule**

- No PR opens without tranche Oracle pass.
- No pipeline is reported complete without program Oracle pass.

**Primary files**

- `src/orchestrator/oracle-gate.ts`
- `src/agents/oracle.ts`
- `src/autonomy/oracle-bridge.ts`
- `src/autonomy/controller.ts`
- `src/orchestrator/handlers/build.ts`
- `src/orchestrator/handlers/ship.ts`
- new `src/orchestrator/signoff.ts`

---

### OPA-006 — Branch names, commits, PR body, and CI state are not delivery-grade

**User complaint:** bad branch name, poor PR body, single commit, CI failing.

**What the code does now**

- `computeBranchName()` in `src/orchestrator/handlers/branch-pr.ts` creates branch names from `autopilot/<runId>/<slugified idea>`.
- `buildPrBody()` uses the raw idea and a numbered list of task IDs.
- `handleShip()` uses `state.idea.slice(0, 72)` as the PR title.
- `BranchLifecycle` only tracks pushed task IDs, not delivery semantics.
- There is no evidence of GitHub check polling or mandatory CI wait before completion.

**Root cause**

There is no delivery manifest.

The shipping layer has no structured knowledge of:

- human title,
- tranche ID,
- commit plan,
- review summary,
- Oracle verdict,
- verification evidence,
- known remaining work,
- next tranche.

**Required fix**

Introduce a `DeliveryManifest` and make ship consume it.

### Required delivery manifest

- `programId`
- `trancheId`
- `humanTitle`
- `branchName`
- `commitPlan`
- `reviewSummary`
- `oracleSummary`
- `verificationSummary`
- `residualRisks`
- `remainingBacklog`
- `nextTranche`

### Delivery policy

- Branch names must be short, human-readable, and stable.
- Commits must be deliberate:
  - one commit per task, or
  - one commit per wave,
  - but never “everything in one opaque commit” by default.
- PR body must be rendered from the delivery manifest, not from raw request text.
- Pipeline completion must not occur until required verification and CI checks pass.

**Primary files**

- `src/orchestrator/handlers/branch-pr.ts`
- `src/orchestrator/handlers/ship.ts`
- `src/tools/orchestrate.ts`
- `src/autonomy/verification.ts`
- new `src/orchestrator/delivery-manifest.ts`
- new GitHub checks integration / polling module

---

### OPA-007 — Verification is available, but not enforced as a hard ship gate

**User complaint:** PR was created even though CI was failing; the run also reported success even when environment verification was blocked.

**What the code supports**

- `src/autonomy/verification.ts` supports command-based verification.
- `src/config.ts` supports `verification.commandChecks` and project overrides.

**What failed in practice**

- The attached config had `verification.commandChecks=[]`.
- The observed run still shipped despite blocked Docker verification and failing health probe.

**Root cause**

Verification is configurable but not mandatory for implementation/autonomous delivery.

**Required fix**

Make verification mandatory in autonomous implementation mode.

### Required verification policy

Each tranche must declare a verification profile:

- required local checks
- optional local checks
- required remote checks
- required CI checks

Each check must finish in one of these states:

- `PASSED`
- `FAILED`
- `BLOCKED`
- `SKIPPED_WITH_REASON`

### Hard rules

- `FAILED` blocks ship.
- `BLOCKED` blocks ship unless an explicit operator override is allowed by policy; in autonomous mode default is no override.
- empty verification profile is invalid for autonomous implementation runs.
- SHIP and COMPLETE must display the verification summary explicitly.

**Primary files**

- `src/config.ts`
- `src/autonomy/verification.ts`
- `src/autonomy/controller.ts`
- `src/tools/orchestrate.ts`
- `src/orchestrator/handlers/ship.ts`
- tests under `tests/autonomy/verification.test.ts` and new ship-gating tests

---

### OPA-008 — Parent-session tool chatter pollutes the UX

**User complaint:** tool calling in the parent session is huge and pollutes the entire UX.

**What the code/prompt design currently encourages**

- `src/agents/autopilot.ts` tells the agent to preserve the full agent output in `payload.text` and repeatedly return typed result envelopes.
- `src/tools/orchestrate.ts` tracks pending dispatches and progress but still fundamentally uses the active chat session as the orchestration bus.
- `_userProgress` exists, and task toasts/progress tracking exist, but they do not replace the raw control-plane traffic.

**Root cause**

The parent session is both:

- the operator interface, and
- the transport for orchestration internals.

That is the wrong boundary.

**Required fix**

Separate the control plane from the operator surface.

### Required visibility model

Create a structured `VisibilityEvent` bus with events like:

- `phase_started`
- `phase_completed`
- `tranche_started`
- `task_started`
- `task_completed`
- `review_started`
- `review_blocked`
- `oracle_passed`
- `oracle_failed`
- `verification_passed`
- `ship_created`
- `program_completed`

Parent session sees only summarized visibility events.

Internal control-plane artifacts stay in:

- `.opencode-autopilot/state.json`
- `.opencode-autopilot/phases/*`
- `.opencode-autopilot/orchestration.jsonl`
- background/internal child sessions

Never in the normal user transcript.

**Primary files**

- `src/tools/orchestrate.ts`
- `src/index.ts`
- `src/orchestrator/progress.ts`
- `src/hooks/*`
- `src/background/*`
- new `src/ux/visibility.ts`

---

### OPA-009 — Internal thoughts and typed envelopes are leaking to the user

**User complaint:** the user should not see actual autopilot LLM thoughts, only intentionally surfaced visibility.

**Current evidence**

The attached run transcript shows `_Thinking:` blocks, raw orchestration envelopes, and control-flow chatter in the parent session.

**Root cause**

There is no hard “reasoning redaction / visibility projection” boundary in the orchestration path.

**Required fix**

- Normal mode must never show raw chain-of-thought-like content or typed result JSON.
- Debug mode may expose internal trace, but only behind an explicit operator setting.
- Hidden subagents must remain hidden from the operator transcript.
- Child session artifacts can exist, but the UI must render curated status only.

This is a product contract, not a best-effort guideline.

**Primary files**

- `src/index.ts`
- `src/tools/orchestrate.ts`
- `src/agents/autopilot.ts`
- any UI/SDK integration that currently mirrors raw tool payloads
- new visibility/redaction transformer

---

### OPA-010 — The sidebar plan is missing because the integration is unfinished

**User complaint:** there was no actual plan shown in the right sidebar.

**What the repository says**

- Plan artifacts already exist: `tasks.json` and `tasks.md`.
- Pipeline state already stores phases, tasks, and build progress.
- `src/index.ts` literally ends with the comment `// Export TUI plugin for sidebar integration` and then stops.

That is the answer.

The data exists. The state projection is unfinished.

**Required fix**

Build a sidebar state exporter and renderer driven directly from persisted orchestration state.

### Minimum sidebar contract

The sidebar must show:

- program objective
- current tranche
- all tranches and status
- current phase
- current wave and active tasks
- review status
- Oracle status
- verification status
- branch / PR / CI status
- blocked reasons

The sidebar must not scrape transcript text.
It must read structured orchestration state.

**Primary files**

- `src/index.ts`
- `src/orchestrator/state.ts`
- `src/orchestrator/schemas.ts`
- `src/orchestrator/progress.ts`
- new `src/ux/sidebar.ts`
- new sidebar-focused tests

---

## 5. Cross-cutting structural conclusions

The nine complaints collapse into five architectural mandates.

### Mandate A — One authoritative mode model

No more contradictory `orchestrator.autonomy=full` while autonomy/background/routing are disabled elsewhere.

### Mandate B — One authoritative artifact boundary

Everything autopilot owns at project scope lives under `.opencode-autopilot/`.

### Mandate C — One authoritative quality contract

Review, Oracle, verification, and CI are gates, not suggestions.

### Mandate D — One authoritative program controller

Broad requests become autonomous tranche backlogs, not “pick one PR” questionnaires.

### Mandate E — One authoritative operator surface

The user sees curated visibility and plan projection, not orchestration guts.

---

## 6. Target architecture

## 6.1 Control-plane layering

### Layer 1 — Intake and mode selection

Responsibilities:

- classify request,
- choose interactive vs autonomous mode,
- create `ProgramRun` if request is broad,
- create `SingleTrancheRun` only for narrow requests.

### Layer 2 — Program controller

Responsibilities:

- maintain tranche backlog,
- pick next tranche,
- enforce continuation until done or blocked,
- maintain global progress.

### Layer 3 — Tranche pipeline

Responsibilities:

- RECON
- CHALLENGE
- ARCHITECT
- PLAN
- BUILD
- REVIEW
- ORACLE
- VERIFY
- SHIP

Note: REVIEW / ORACLE / VERIFY should be first-class states, not just incidental BUILD/SHIP branches.

### Layer 4 — Delivery manager

Responsibilities:

- branch strategy,
- commit strategy,
- PR metadata,
- CI/check polling,
- publish status.

### Layer 5 — Visibility projection

Responsibilities:

- operator summaries,
- sidebar state,
- toast/progress events,
- audit-friendly logs,
- debug mode separation.

---

## 6.2 Proposed persistent entities

### ProgramRun

- `programId`
- `originatingRequest`
- `mode`
- `createdAt`
- `status`
- `successCriteria`
- `tranches[]`
- `currentTrancheId`
- `finalOracleVerdict`

### Tranche

- `trancheId`
- `title`
- `objective`
- `scope`
- `dependencies`
- `status`
- `verificationProfile`
- `deliveryManifestId`

### ReviewRun

- `reviewRunId`
- `trancheId`
- `reviewers[]`
- `findings[]`
- `verdict`

### OracleSignoff

- `signoffId`
- `scope = tranche | program`
- `inputsDigest`
- `verdict`
- `reasoning`
- `blockingConditions[]`

### DeliveryManifest

- `manifestId`
- `branchName`
- `commitPlan`
- `prTitle`
- `prBody`
- `verificationSummary`
- `reviewSummary`
- `oracleSummary`
- `nextTranche`

### VisibilityState

- `phase`
- `activeTasks`
- `currentWave`
- `reviewStatus`
- `oracleStatus`
- `verificationStatus`
- `shipStatus`
- `blockedReason`

---

## 7. Implementation workstreams and PR sequence

This sequence is designed to minimize churn while fixing the real failure modes.

---

## PR-1 — Canonical mode model and artifact invariants

### Objective

Remove contradictory autonomy semantics and make `.opencode-autopilot/` the only autopilot-owned project artifact root.

### Primary files

- `src/config.ts`
- `src/utils/paths.ts`
- `src/kernel/database.ts`
- `bin/inspect.ts`
- `bin/cli.ts`
- `src/tools/orchestrate.ts`
- `src/index.ts`
- tests under `tests/kernel/`, `tests/utils/`, `tests/cli/`, `tests/integration/`

### Detailed tasks

1. Replace overlapping autonomy flags with a single validated mode model.
2. Add config invariant validation:
   - autonomous mode requires verification profile,
   - autonomous mode forbids contradictory disable flags,
   - invalid combinations fail fast.
3. Add a `doctor` / preflight path that reports:
   - legacy root kernel DB present,
   - mixed artifact states,
   - missing verification profile,
   - disabled routing/background/autonomy contradictions.
4. Make autopilot runtime refuse to generate project-root artifacts outside `.opencode-autopilot/`.
5. Add cleanup of untracked/autogenerated runtime files inside `.opencode-autopilot/` on session completion where safe.
6. Add installed-package E2E tests that verify a real local run does not create repo-root `kernel.db*` or stray autopilot files.

### Acceptance criteria

- Autonomous mode cannot be configured into a self-contradictory state.
- A real run does not emit repo-root `kernel.db*` or runtime state files.
- Mixed legacy/artifact states are detected and reported clearly.

### Non-goals

- no tranche backlog yet,
- no sidebar yet,
- no PR-body redesign yet.

---

## PR-2 — Autonomous program controller and question policy

### Objective

Stop asking the user to choose tranches in autonomous mode and add program-level continuation across multiple PRs.

### Primary files

- `src/agents/autopilot.ts`
- `src/agents/planner.ts`
- `src/tools/route.ts`
- `src/tools/orchestrate.ts`
- `src/orchestrator/state.ts`
- `src/orchestrator/schemas.ts`
- `src/orchestrator/types.ts`
- `src/orchestrator/handlers/plan.ts`
- new `src/program/*`
- tests under `tests/orchestrator/`, `tests/tools/`, `tests/integration/`

### Detailed tasks

1. Add `ProgramRun` and `Tranche` persistence.
2. Add autonomous tranche planning from broad requests.
3. Define automatic tranche-size heuristics.
4. Remove planner/autopilot permission to ask discretionary questions in autonomous mode.
5. Replace “which tranche do you want first?” with automatic tranche selection plus visible rationale.
6. On successful ship of tranche N, automatically queue tranche N+1.

### Acceptance criteria

- A broad dossier request in autonomous mode starts a multi-tranche program without asking the user to pick tranche 1.
- The controller continues after the first PR instead of stopping.
- Any stop condition is classified explicitly as blocked, not silently treated as completion.

### Non-goals

- full review/oracle redesign not yet complete,
- no UI cleanup yet.

---

## PR-3 — Review runner as a first-class stage

### Objective

Make review visible, structured, and authoritative.

### Primary files

- `src/orchestrator/handlers/build.ts`
- `src/tools/review.ts`
- `src/review/*`
- `src/agents/pipeline/oc-reviewer.ts`
- new `src/orchestrator/review-runner.ts`
- tests under `tests/review/`, `tests/orchestrator/`, `tests/integration/`

### Detailed tasks

1. Pull review out of ad hoc BUILD subflow semantics into a structured stage model.
2. Persist review runs and findings.
3. Support required reviewer policy.
4. Require review closure before SHIP.
5. Add structured summaries for delivery/visibility layers.
6. Surface reviewer execution status in visibility state.

### Acceptance criteria

- Review is visible as its own stage.
- Required reviewers actually execute.
- Ship blocks on open findings above policy threshold.

---

## PR-4 — Oracle signoff redesign

### Objective

Turn Oracle from heuristic consultant into explicit quality sign-off authority.

### Primary files

- `src/orchestrator/oracle-gate.ts`
- `src/agents/oracle.ts`
- `src/autonomy/oracle-bridge.ts`
- `src/autonomy/controller.ts`
- `src/orchestrator/handlers/build.ts`
- `src/orchestrator/handlers/ship.ts`
- new `src/orchestrator/signoff.ts`
- tests under `tests/autonomy/`, `tests/orchestrator/`

### Detailed tasks

1. Add `TrancheOracleSignoff` and `ProgramOracleSignoff` schemas.
2. Change Oracle prompt contract from freeform advice to structured signoff output.
3. Require tranche signoff before SHIP.
4. Require program signoff before final COMPLETE.
5. Persist signoff results and surface them in visibility state.

### Acceptance criteria

- No PR opens without tranche Oracle pass.
- No overall program completion without program Oracle pass.
- Oracle decisions are stored as structured artifacts.

---

## PR-5 — Delivery manifest, commit strategy, and CI/verification gates

### Objective

Fix branch naming, PR quality, single-commit shipping, and false-positive completion.

### Primary files

- `src/orchestrator/handlers/branch-pr.ts`
- `src/orchestrator/handlers/ship.ts`
- `src/tools/orchestrate.ts`
- `src/autonomy/verification.ts`
- new `src/orchestrator/delivery-manifest.ts`
- new GitHub checks integration module
- tests under `tests/orchestrator/`, `tests/autonomy/`, `tests/integration/`

### Detailed tasks

1. Add `DeliveryManifest` generation from structured tranche state.
2. Replace raw-idea branch name generation.
3. Define commit strategy policy:
   - commit per task by default,
   - squash only via explicit policy.
4. Replace PR title/body generation with manifest renderer.
5. Add GitHub check polling / status integration.
6. Block SHIP completion until required local verification and required remote CI checks pass.

### Acceptance criteria

- Branch names are human-readable and bounded.
- PR body contains meaningful scope, review, Oracle, and verification sections.
- One-commit opaque deliveries stop being the default.
- Pipeline cannot report success while CI is red or verification is blocked.

---

## PR-6 — Parent-session visibility cleanup

### Objective

Stop polluting the user-facing session with control-plane traffic and reasoning leakage.

### Primary files

- `src/tools/orchestrate.ts`
- `src/index.ts`
- `src/orchestrator/progress.ts`
- `src/hooks/*`
- `src/background/*`
- new `src/ux/visibility.ts`
- tests under `tests/ux/`, `tests/tools/orchestrate-ux.test.ts`, `tests/integration/`

### Detailed tasks

1. Add a structured `VisibilityEvent` bus.
2. Route parent session output through visibility projection instead of raw envelopes.
3. Keep typed result envelopes internal only.
4. Add `visibilityMode=summary|debug`.
5. Ensure `_Thinking:` or equivalent internal reasoning is not surfaced in normal mode.
6. Keep deep trace accessible through artifact/log surfaces, not standard chat.

### Acceptance criteria

- Normal user session shows concise progress, not raw tool chatter.
- Typed result envelopes do not appear in operator view.
- Internal reasoning leakage is absent in normal mode.

---

## PR-7 — Sidebar plan and state projection

### Objective

Render the actual plan and runtime state into the right sidebar from structured state.

### Primary files

- `src/index.ts`
- `src/orchestrator/state.ts`
- `src/orchestrator/schemas.ts`
- `src/orchestrator/progress.ts`
- new `src/ux/sidebar.ts`
- tests under `tests/ux/`, `tests/orchestrator/`

### Detailed tasks

1. Define sidebar state schema.
2. Map `ProgramRun`, `Tranche`, `Phase`, `Task`, `Review`, `Oracle`, and `Verification` into that schema.
3. Export sidebar integration from `src/index.ts`.
4. Update state on every phase/task/review/oracle transition.
5. Render blocked reasons and remaining backlog.

### Acceptance criteria

- Sidebar shows plan from the beginning of the run.
- Sidebar updates live without scraping transcript text.
- Current tranche, phase, tasks, review, Oracle, and ship status are all visible.

---

## PR-8 — End-to-end acceptance harness for the full nine-complaint matrix

### Objective

Make the current failure pattern impossible to reintroduce silently.

### Test matrix

1. No repo-root autopilot runtime artifacts.
2. Autonomous mode never asks discretionary tranche-selection questions.
3. Broad requests create and continue a tranche backlog automatically.
4. Reviewers execute and can block ship.
5. Oracle signoff is mandatory.
6. Required verification and CI checks gate ship.
7. Parent transcript remains curated and concise.
8. Reasoning leakage is absent in normal mode.
9. Sidebar shows the plan and live progress.
10. Branch/PR metadata comes from delivery manifest, not raw idea text.

### Primary files

- new E2E / integration tests across:
  - `tests/integration/`
  - `tests/ux/`
  - `tests/orchestrator/`
  - `tests/autonomy/`
  - `tests/review/`
  - `tests/kernel/`

### Acceptance criteria

This PR is the final definition of done for the redesign.

---

## 8. Detailed coding instructions by subsystem

## 8.1 Configuration and mode subsystem

### Mandatory changes

- Remove overlapping semantics between:
  - `orchestrator.autonomy`
  - `autonomy.enabled`
  - `background.enabled`
  - `routing.enabled`
- Replace with one validated mode contract.
- Add parse-time invariant errors.

### Mandatory tests

- reject contradictory config combinations,
- reject autonomous implementation mode with empty verification profile,
- accept interactive planning mode with no verification profile,
- accept debug visibility without exposing it by default.

---

## 8.2 Program controller subsystem

### Mandatory changes

- Add persistent backlog state.
- Add continuation after ship.
- Add block-state persistence.
- Add resume-from-program-state behavior.

### Mandatory tests

- broad dossier -> multiple tranches,
- first tranche shipped -> second tranche automatically begins,
- blocked tranche -> program pauses with explicit blocked reason,
- completed backlog -> program Oracle signoff required.

---

## 8.3 Review subsystem

### Mandatory changes

- expose selected reviewers,
- store findings structurally,
- allow severity thresholds by policy,
- surface accepted waivers explicitly.

### Mandatory tests

- no reviewers skipped silently,
- critical findings block ship,
- non-critical findings appear in PR/report,
- review state survives resume/restart.

---

## 8.4 Oracle subsystem

### Mandatory changes

- change Oracle output to structured signoff contract,
- store signoff artifacts,
- separate tranche signoff and program signoff.

### Mandatory tests

- no PR without tranche pass,
- no overall completion without program pass,
- fail path stores blocking rationale,
- parse failures are fatal, not silently ignored.

---

## 8.5 Delivery subsystem

### Mandatory changes

- add delivery manifest,
- add commit plan,
- add CI/check polling,
- fail ship on blocked verification.

### Mandatory tests

- branch naming rules,
- PR body renderer output quality,
- ship blocked when CI pending/failing,
- no “complete” when Docker/local verification is blocked.

---

## 8.6 Visibility and UX subsystem

### Mandatory changes

- summary-mode projection only,
- raw typed envelopes hidden,
- raw reasoning hidden,
- sidebar fed from structured state.

### Mandatory tests

- normal mode transcript contains no internal JSON envelopes,
- no `_Thinking:` leakage,
- sidebar shows plan and live tranche/task state,
- debug mode explicitly opt-in.

---

## 9. Mandatory implementation rules for coding agents

These rules are not optional.

1. **Do not try to solve this with prompt edits only.**
2. **Do not ship partial control-plane changes without acceptance tests.**
3. **Do not leave contradictory config semantics in place during transition.**
4. **Do not scrape transcript text to build UI. Use structured state only.**
5. **Do not let SHIP succeed when verification is failed or blocked.**
6. **Do not let BUILD/SHIP treat review or Oracle as informational.**
7. **Do not emit repo-root autopilot runtime artifacts.**
8. **Do not expose typed result envelopes or internal reasoning in normal mode.**
9. **Do not let broad autonomous requests terminate after tranche 1 unless blocked.**
10. **Do not declare the redesign finished without the PR-8 acceptance harness.**

---

## 10. Recommended implementation order for teams

If different coding agents work in parallel, use this dependency order:

### Team A — Control plane and state

- PR-1
- PR-2 core state model

### Team B — QA gates

- PR-3
- PR-4
- PR-5 verification/CI portions

### Team C — UX and visibility

- PR-6
- PR-7

### Team D — Test harness and release hardening

- PR-8
- release validation on installed package, not only source tree

Parallelism is allowed only after PR-1 establishes the new mode and artifact invariants.

---

## 11. Release / rollout strategy

### Phase 1 — feature-flagged internal rollout

- new mode model behind feature flag,
- old path kept only where unavoidable,
- telemetry and forensic comparison enabled.

### Phase 2 — autonomous controller default for autopilot mode

- program controller becomes default for autonomous runs,
- old interactive tranche-selection behavior allowed only in interactive mode.

### Phase 3 — strict ship gating

- no PR creation without verification/CI and tranche Oracle signoff,
- no completion without program Oracle signoff.

### Phase 4 — visibility cleanup and sidebar enablement

- normal mode uses summary-only projection,
- debug mode available for maintainers,
- sidebar on by default.

### Phase 5 — legacy path removal

- remove temporary compatibility paths once migration metrics confirm safety.

---

## 12. Final definition of done

This redesign is done only when all statements below are true in real end-to-end runs:

- no root-level autopilot runtime artifacts appear,
- autonomous mode never asks the user to choose tranche boundaries,
- broad requests become multi-tranche autonomous programs,
- reviewer agents visibly execute and can block ship,
- Oracle provides mandatory tranche and program signoff,
- required verification and CI checks block ship until green,
- branch names, commits, and PR bodies are delivery-grade,
- parent-session UX is clean and intentionally surfaced,
- internal reasoning and raw orchestration payloads are hidden in normal mode,
- the right sidebar shows the actual plan and live state from the start of the run,
- the full nine-complaint acceptance harness passes.

Anything less is still a prototype.

---

## 13. Immediate next action

The best immediate next move is:

1. land **PR-1** first,
2. then implement **PR-2** immediately after,
3. block any further “autonomous” claims in product docs until PR-3 through PR-5 are done.

That is the shortest path from the current failure state to something credible.
