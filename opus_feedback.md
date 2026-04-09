# opencode-autopilot — current-code audit and omo gap analysis

**Audited:** v1.27.3 (zip uploaded 2026-04-09)
**Method:** static analysis of `src/`, cross-checked against the design intent in `docs/`, validated against omo's public surface area (49.5k stars, 124k weekly npm downloads).
**Scope:** functional bugs only — performance and style observations excluded.
**Format:** for each bug, location → what it does → what should happen → proposed fix approach. No code patches.

---

## Calibration up front

A first pass at the session logs (`last_session2.md`, `feedback_sessions_2/*`) suggested a much grimmer picture than the code actually warrants. Several things I would have flagged from those logs are *already* implemented and working:

- **Intent gate** routing non-implementation work away from the pipeline (`src/routing/intent-types.ts`, enforced at `src/tools/orchestrate.ts:1099-1115`).
- **Per-phase circuit breaker** capping dispatch counts (`src/tools/orchestrate.ts:553-608`, `MAX_PHASE_DISPATCHES`).
- **Duplicate-dispatch guard** rejecting second pending of same `agent + phase` (`src/tools/orchestrate.ts:771-786, 921-937`).
- **Artifact-existence gate on phase completion** in `recon.ts`, `challenge.ts`, `ship.ts` — agent must actually have written the artifact, not just claim it did.
- **Conflict-safe state merge** for parallel BUILD with redundant-dispatch detection (`src/tools/orchestrate.ts:333-427`).
- **Stub-artifact backfill** for `oc_quick` mode that skips RECON/CHALLENGE/ARCHITECT (`src/tools/quick.ts:91-115`).
- **Plan handler resilience**: tries `tasks.json`, falls back to `tasks.md`, returns `E_PLAN_TASK_LOAD` on failure (`src/orchestrator/handlers/plan.ts:127-200`).

So the architecture has good bones. The bugs below are real and current, but they're concentrated in three handlers, one config map, one in-memory variable, and one missing CLI surface — not in the overall design.

---

## P0 — Active correctness bugs

### 1. ARCHITECT handler ignores result envelope, no completion-failure path

**Where:** `src/orchestrator/handlers/architect.ts:26-46`

```ts
export async function handleArchitect(
    state: Readonly<PipelineState>,
    artifactDir: string,
    _result?: string,                    // ← intentionally ignored
    _context?: PhaseHandlerContext,
): Promise<DispatchResult> {
    const phaseDir = getPhaseDir(...);
    const critiqueExists = await fileExists(join(phaseDir, "critique.md"));
    const designExists = await fileExists(join(phaseDir, "design.md"));

    if (critiqueExists || designExists) {
        return { action: "complete", phase: "ARCHITECT", ... };
    }
    // ... else: dispatch architect or critic again
}
```

**What it does:** the handler determines completion purely by file existence. The `_result` parameter — the actual envelope the architect agent submitted — is intentionally discarded (the underscore prefix is the convention for "unused"). When the agent submits a result envelope but never wrote `design.md` (e.g., because it ran out of tool budget mid-thought, or the response got truncated), the handler can't tell the difference between "agent never ran" and "agent ran but failed silently". It falls through to "dispatch architect again."

**Why it matters:** this is the only handler in the pipeline that doesn't check `result && !artifactExists → error`. Compare to `recon.ts:20-39` and `challenge.ts:20-39` which both have:

```ts
if (result) {
    if (!(await fileExists(artifactPath))) {
        return { action: "error", message: "agent returned a result but did not write the required artifact" };
    }
    return { action: "complete", ... };
}
```

The circuit breaker (`MAX_PHASE_DISPATCHES.ARCHITECT = 10`) eventually catches the infinite loop, but only after burning ~10 architect dispatches × tens of seconds each. That's the "186 seconds and nothing happens" pattern from the last session.

**What should happen:** when the architect submits a result envelope but neither `design.md` (depth=1) nor `proposal-*.md` files (depth>1) exist, the handler should return an error telling the agent its output was rejected and naming the missing artifact. The same pattern recon/challenge use. The error envelope is what makes the agent fix its behavior on the next attempt — silent re-dispatch is what makes it loop.

**Proposed approach:** add a `result`-branch at the top of `handleArchitect` that mirrors recon's. In depth=1 mode, require `design.md`. In depth>1 (Arena) mode, require `countProposalFiles(proposalsDir) >= depth` after the architect dispatch and `critique.md` after the critic dispatch. The existing `Step 2` proposal-count check on line 60-66 already has the logic for the latter — it just isn't triggered by the result-arrival path.

---

### 2. PLAN handler points the planner at `design.md` regardless of Arena mode

**Where:** `src/orchestrator/handlers/plan.ts:202`

```ts
const architectRef = getArtifactRef(artifactDir, "ARCHITECT", "design.md", state.runId);
// ...
const prompt = [
    "Read the architecture design at",
    architectRef,
    "and the challenge brief at",
    challengeRef,
    "then produce a task plan.",
    ...
].join(" ");
```

**What it does:** the plan handler instructs the planner to read `ARCHITECT/design.md`. But in Arena mode (when `getMemoryTunedDepth` returns > 1), `architect.ts:195-235` writes proposals to `proposals/proposal-A.md`, `proposals/proposal-B.md`, etc., and then the critic writes `critique.md`. **No `design.md` is ever written in Arena mode.** The planner is told to read a file that doesn't exist.

**Why it matters:** the planner agent will either (a) error out because the file doesn't exist, (b) make up a plan from the title alone, or (c) discover and read `proposals/` and `critique.md` on its own initiative if it's smart enough. None of these are the contract the orchestrator is implying. In quick mode this is masked because `quick.ts:96` writes a stub `design.md` ("_Skipped in quick mode._"), so the planner reads a useless stub.

**What should happen:** the plan handler should look at what artifacts ARCHITECT actually produced and reference them. If `critique.md` exists, reference it plus the `proposals/` directory. If `design.md` exists, reference it. If neither exists, return an error before dispatching the planner.

**Proposed approach:** at the top of `handlePlan` (before building the prompt), check `fileExists` for `critique.md`, `design.md`, and `readdir(proposals/)`. Build the `architectRef` portion of the prompt dynamically based on what's there. While you're at it, fix the same issue in `ship.ts` and `retrospective.ts` if they make the same assumption — I didn't audit those in detail.

---

### 3. Dispatch retry state lives only in process memory

**Where:** `src/orchestrator/dispatch-retry.ts:69`

```ts
const retryStates = new Map<string, DispatchRetryState>();
```

**What it does:** this module-level `Map` tracks per-`{phase, agent}` retry attempts. `decideRetry()` reads it (line 154) to check `attempts >= maxRetries`. `recordRetryAttempt()` writes to it (line 277).

**Why it matters:** every time the OpenCode process restarts (TUI quit, crash, machine reboot, even some session boundaries), the Map is empty. The "max 2 retries" cap then resets to 0. A flaky model can be retried forever as long as the user keeps reopening their session. Worse, the state isn't per-run — it's per-process, so retry counts from one run leak into the next run if they share the same `{phase, agent}` key.

**What should happen:** retry state should live alongside `pendingDispatches` in `pipelineStateSchema` so it persists with the rest of the run.

**Proposed approach:** add a `retryState: Record<string, { attempts: number; lastError: string|null; lastCategory: ErrorCategory|null }>` field to `pipelineStateSchema` in `src/orchestrator/schemas.ts`. Refactor `dispatch-retry.ts` to take a `state` argument and return `{decision, nextState}` instead of mutating the in-memory Map. Call sites in `orchestrate.ts` already thread `currentState` through everywhere, so the refactor is mechanical. The existing `clearRetryStateByKey`/`clearAllRetryState` functions become `patchState({ retryState: ... })` calls. Keep the in-memory Map as a deprecated shim during migration if needed for tests.

---

### 4. Dual agent namespace: `researcher` vs `oc-researcher` (and the same for planner, reviewer)

**Where:** `src/agents/index.ts:22-32` registers `agents` (unprefixed) and `pipeline/index.ts:12-21` registers `pipelineAgents` (oc-prefixed). Both are passed to `registerAgents()` in `configHook()` at `src/agents/index.ts:147-148`.

**What it does:** OpenCode ends up with both `researcher` AND `oc-researcher` available as `subagent_type` values. Same for `planner`/`oc-planner`, `reviewer`/`oc-reviewer`. The orchestrator dispatches via `AGENT_NAMES.RECON = "oc-researcher"` (`handlers/types.ts:5`), but a confused main agent — or one running on a model whose tool-use formatting drops the prefix — can call `task` with `subagent_type: "researcher"` and hit the unprefixed agent. The unprefixed agents resolve their model through a different path in the registry, so they can have different (potentially missing) model assignments.

**Why it matters:** this is what produced `ProviderModelNotFoundError` on the first dispatch in the most recent session. The intent gate also routes specialist intents to the unprefixed names (`intent-types.ts:49 targetAgent: "researcher"`, line 83 `targetAgent: "debugger"`, line 108 `targetAgent: "coder"`), so the unprefixed agents have a legitimate purpose — they're the destinations for non-pipeline intents. But the overlap with the pipeline agents creates ambiguity: which `researcher` is the right one?

**What should happen:** distinct namespaces for distinct purposes. The unprefixed agents are user-callable specialists; the `oc-` agents are pipeline subagents. They should not have overlapping role names.

**Proposed approach:** rename either side to eliminate the overlap. Two options:

- **Option A (less churn):** rename the three overlapping unprefixed agents — `researcher` → `specialist-researcher`, `planner` → `specialist-planner`, `reviewer` → `specialist-reviewer`. Update `intent-types.ts` `targetAgent` fields and the autopilot agent prompt. The 7 unprefixed agents that *don't* overlap (`coder`, `debugger`, `oracle`, `metaprompter`, `pr-reviewer`, `security-auditor`, `autopilot`) keep their names.
- **Option B (more correct):** drop the unprefixed `researcher`/`planner`/`reviewer` files entirely and have the intent gate route to `oc-researcher`/`oc-planner`/`oc-reviewer` directly. This means a single agent can be invoked both as a pipeline subagent and as a specialist, which is conceptually cleaner. The risk is that the pipeline agents have prompts tuned for "you are a phase in a larger pipeline" which doesn't fit the standalone-specialist use case. Read both prompts before deciding.

I'd go with A — less risky, faster to ship, doesn't require re-tuning prompts.

---

### 5. Stuck-run recovery has no user-facing exit

**Where:** `src/tools/orchestrate.ts:1168-1178`, `src/tools/quick.ts:43-49`

```ts
// orchestrate.ts:1168
if (args.result === undefined && state.pendingDispatches.length > 0) {
    const pending = state.pendingDispatches.at(-1);
    const msg = `Pending result required for dispatch ${pending?.dispatchId} (${pending?.agent} / ${pending?.phase}). Submit a typed result envelope before calling oc_orchestrate again.`;
    return asErrorJson(ORCHESTRATE_ERROR_CODES.PENDING_RESULT_REQUIRED, msg);
}

// quick.ts:43
if (existing !== null && existing.status === "IN_PROGRESS") {
    return { action: "error", message: "An orchestration run is already in progress. Complete or reset it before starting a quick task." };
}
```

**What it does:** when state has pending dispatches from a previous run (because OpenCode crashed mid-dispatch, the user closed the TUI before submitting a result, or a subagent died), every subsequent call to `oc_orchestrate` returns `E_PENDING_RESULT_REQUIRED`. Same for `oc_quick`. The error message tells the user to "submit a typed result envelope", which requires knowing the dispatchId, runId, agent, and phase — and constructing a fake envelope by hand. There is no `oc_orchestrate reset`, no `oc_quick --force`, no documented escape hatch. The user has to manually delete `.opencode-autopilot/state.json`.

`src/tools/recover.ts` has a `reset` action, but that resets the **error recovery orchestrator** state (per-session strategy attempts), not the **pipeline state** (`pendingDispatches`, `phaseDispatchCounts`). The names collide.

**Why it matters:** any session that hits a P0 bug above leaves a stuck state. Users hit the wall, don't know how to escape, and lose confidence in the tool. This isn't a hypothetical — it's what `feedback_sessions_2/opencode_autopilot_session.md:30` shows happening with a stale `oc-critic / ARCHITECT` pending blocking a fresh request.

**What should happen:** an explicit, documented way to abandon the current run.

**Proposed approach:** add an `abandon` (or `reset`, but disambiguated from `oc_recover reset`) subcommand to `oc_orchestrate` that sets `state.status = "INTERRUPTED"`, clears `pendingDispatches`, and writes a `decisions[]` entry recording the abandonment. Don't delete the state file — keep it for diagnostics. Subsequent `oc_orchestrate {idea}` then succeeds because `loadState` either returns the interrupted state (which the new-run path can detect and replace) or, if you want simpler logic, treats `status: "INTERRUPTED"` as equivalent to no state. Update the `E_PENDING_RESULT_REQUIRED` error message to mention the new command. Mirror the same in `oc_quick`.

---

## P1 — Integrity bugs that don't break the pipeline but degrade output

### 6. Per-phase dispatch counts conflate distinct agents

**Where:** `src/tools/orchestrate.ts:553-563, 579-608`

```ts
const MAX_PHASE_DISPATCHES = {
    RECON: 3, CHALLENGE: 3, ARCHITECT: 10, EXPLORE: 3,
    PLAN: 5, BUILD: 100, SHIP: 5, RETROSPECTIVE: 3,
};

async function checkCircuitBreaker(state, phase, ...) {
    const counts = { ...(state.phaseDispatchCounts ?? {}) };
    counts[phase] = (counts[phase] ?? 0) + 1;
    // ...
}
```

**What it does:** the breaker counts dispatches per phase, not per `{phase, agent}`. ARCHITECT contains both `oc-architect` and `oc-critic` dispatches, plus in Arena mode multiple `oc-architect` dispatches in parallel. They all share one counter. ARCHITECT's cap of 10 sounds generous until you realize Arena mode at depth=3 dispatches 3 architects in one go (counter += 3 in `dispatch_multi`? actually no — line 917 only increments by 1 per call regardless of agent count, which is a separate bug below) plus a critic, so the budget for "real" retries is small.

**Why it matters:** the cap doesn't bound what you actually want bounded. You want "no more than 2 retries of the same agent in the same phase", not "no more than 10 dispatches in this phase total". The latter is a much weaker guarantee.

**What should happen:** key the counter on `{phase, agent}` like the retry state already is, and lower the per-key cap to ~2-3.

**Proposed approach:** change `phaseDispatchCounts` from `Record<string, number>` to `Record<string, number>` keyed on `${phase}:${agent}` instead of just `${phase}`. Update `checkCircuitBreaker` to take an `agent` parameter and increment the composite key. Reduce caps: `ARCHITECT` per-agent → 3, others → 2. The schema change is backwards-compatible (still a `Record<string, number>`), only the key shape changes; old persisted state keys will simply never match, which is fine — they'll be re-counted from zero.

---

### 7. `dispatch_multi` increments the breaker by 1 instead of by the number of agents dispatched

**Where:** `src/tools/orchestrate.ts:910-920`

```ts
case "dispatch_multi": {
    const phase = ...;
    const { abortMsg, newCount: attempt, nextState } = await checkCircuitBreaker(currentState, phase, artifactDir);
    // ...
}
```

**What it does:** when the architect handler returns `action: "dispatch_multi"` with 3 architect agents in Arena mode, `checkCircuitBreaker` is called once and increments the counter by 1 — even though 3 actual subagent runs are about to be issued. The counter under-counts.

**Why it matters:** the breaker is supposed to estimate "how much compute have we burned in this phase". Dispatching 3 architects in parallel is 3× the work of dispatching one. Counting it as 1 makes the cap useless for parallel phases.

**What should happen:** increment by `agents.length` for `dispatch_multi`, by 1 for `dispatch`.

**Proposed approach:** pass the dispatch count as a parameter to `checkCircuitBreaker` (default 1, multi passes `agents.length`). Trivial change. Combines naturally with fix #6 — in the per-`{phase,agent}` model, multi dispatches each agent once into its own counter, which is even more accurate.

---

### 8. Skill injection gives architect, recon, challenge, explore, retrospective zero skills

**Where:** `src/skills/adaptive-injector.ts:48-57`

```ts
export const PHASE_SKILL_MAP = Object.freeze({
    RECON: [],
    CHALLENGE: [],
    ARCHITECT: [],
    PLAN: ["plan-writing", "plan-executing"],
    BUILD: ["coding-standards", "tdd-workflow"],
    SHIP: ["plan-executing"],
    RETROSPECTIVE: [],
    EXPLORE: [],
});
```

**What it does:** five of the eight phases have empty skill lists. The adaptive skill loader walks the user's `~/.config/opencode/skills/` directory and only injects skills whose names appear in the phase's allowlist. For RECON/CHALLENGE/ARCHITECT/EXPLORE/RETROSPECTIVE, the allowlist is empty, so nothing is injected. The agents run without any methodology guidance.

**Why it matters:** the entire point of the skill system is to give phase agents domain-specific best practices. The architect should get a "thinking-in-systems" or "architecture-decision-records" skill. The researcher should get "evidence-gathering" or "competitive-analysis" skills. Today they get nothing. The `docs/SKILLS_BENCHMARK.md` file (97KB!) suggests significant investment in skill curation — but the wiring excludes the phases that would benefit most.

**What should happen:** populate the map with phase-appropriate skills.

**Proposed approach:** decide which skills already exist in `assets/skills/` (or in user `~/.config/opencode/skills/`) that are appropriate for each phase. At minimum:
- RECON: a "domain-research" or "competitive-landscape" skill
- CHALLENGE: a "scope-pruning" or "ambitious-but-grounded" skill
- ARCHITECT: an "architecture-decision-records" or "component-design" skill
- EXPLORE: a "codebase-mapping" skill
- RETROSPECTIVE: a "lessons-learned" skill

If those skills don't exist yet, write them as part of the skill ecosystem buildout — that's an investment in the differentiator, not a fix. The map change itself is a one-line edit per phase.

---

### 9. Parallel BUILD execution shares one git working directory

**Where:** `src/orchestrator/handlers/branch-pr.ts:3-6, 25-40`

```ts
// ADR: Worktrees deferred. Parallel BUILD execution uses dispatch_multi on a
// single branch rather than per-task worktrees. The worktreePath field and
// recordWorktreePath utility are retained for future multi-branch support
// but are not invoked at runtime. See PR #90 for rationale.
```

**What it does:** when BUILD wave 1 has 5 independent tasks and the handler returns `dispatch_multi` with 5 implementer agents, all 5 subagents share the same git working directory and check out the same branch. They can step on each other's file edits, branch checkouts, and commits.

**Why it matters:** "parallel build" is one of autopilot's headline features but it's only safe when tasks touch fully disjoint files. The deadbolt session showed task #3 reporting "Branch Name: `feature/W8-T04-pwa-basics`" — which is clearly a branch from a different task in the same wave. The parallel execution stepped on itself. The ADR ("PR #90 for rationale") presumably acknowledged this and deferred — but the deferral has been in place long enough to be a steady-state bug rather than a temporary one.

**What should happen:** each parallel BUILD task should run in its own `git worktree`, isolated from siblings. The schema already has `worktreePath: string | null` in `BranchLifecycle` for this. The infrastructure is half-built — `recordWorktreePath` exists in `branch-pr.ts:66-74` but is unused.

**Proposed approach:** before dispatching a parallel wave in `build.ts`, create a worktree per task: `git worktree add .opencode-autopilot/worktrees/W1-T0X autopilot/<runId>/W1-T0X-branch`. Pass the worktree path into the implementer agent's prompt as the working directory. After the task completes successfully, merge the per-task branch back into the main run branch and remove the worktree. On failure, leave the worktree for debugging. This is genuinely non-trivial — there's transaction handling, merge-conflict resolution, and worktree cleanup to think through. But it's the difference between "parallel build is a demo" and "parallel build is a feature." If it's too much for one PR, gate it behind a config flag and ship it as opt-in first.

---

### 10. Build review's "max strikes" check requires `reviewPending && resultText` together

**Where:** `src/orchestrator/handlers/build.ts:70-77`

```ts
if (buildProgress.strikeCount > MAX_STRIKES && buildProgress.reviewPending && resultText) {
    return {
        action: "error",
        code: "E_BUILD_MAX_STRIKES",
        message: "Max retries exceeded — too many CRITICAL review findings",
    };
}
```

**What it does:** the build phase aborts after MAX_STRIKES critical review findings — but only when ALL THREE of these are simultaneously true: strike count exceeded, a review is pending, AND the handler was called with a result. If any one of them is false (e.g., the orchestrator re-enters the handler without a result because the wave is done), the abort condition is missed.

**Why it matters:** I don't have a session log demonstrating this fires incorrectly, so this is a code-smell observation rather than a confirmed live bug. The condition reads like "abort if we just got a fresh review result that pushed us over the limit." That's a reasonable interpretation. The risk is that the handler is sometimes re-entered without `resultText` (e.g., from a state-merge re-run path at `orchestrate.ts:738`), and if that re-entry happens after the strike limit was already exceeded, the abort is silently skipped.

**What should happen:** the abort should fire whenever `strikeCount > MAX_STRIKES`, regardless of whether the current call carries a result.

**Proposed approach:** split the condition. Check `strikeCount > MAX_STRIKES` first as an unconditional early return. The `reviewPending && resultText` part is doing duty for "we just consumed a review" — if that's the intent, separate it into its own state-update step rather than gating the strike check.

---

### 11. `oc_recover reset` does not reset what most users mean by "reset"

**Where:** `src/tools/recover.ts:100-115`

```ts
case "reset": {
    orchestrator.reset(sessionId);     // RecoveryOrchestrator (per-session strategy state)
    if (db) clearRecoveryState(db, sessionId);
    return { action: "recovery_reset", ... };
}
```

**What it does:** resets the per-session error-recovery state machine — the thing that decides "should I retry, fall back to a different model, or compact context." It does NOT touch `pipelineState.pendingDispatches`, `phaseDispatchCounts`, `tasks`, or any of the actual run state.

**Why it matters:** the user's mental model of "reset" is "throw away the broken run and start over." The tool is named `reset` but doesn't do that. This is a UX trap — users will run it, see "Recovery reset" success, then call `oc_orchestrate` and still get `E_PENDING_RESULT_REQUIRED`.

**What should happen:** either rename to something like `oc_recover clear-strategy-state` (ugly but accurate), or add a separate `oc_recover reset-pipeline` action that does what users actually want (and which also fixes bug #5).

**Proposed approach:** rename the existing action to `clear-strategies` and add a new `reset-pipeline` action that is the bug #5 fix. Keep `reset` as a deprecated alias that prints a warning telling users which one they probably want.

---

## P2 — Things I would have flagged but the code already handles

To save you time chasing ghosts, these are the things from my first pass that turned out to be already-working:

- **Intent gate / quick lane.** `intent-types.ts` + `quick.ts` handle the "small CLI fix shouldn't go through 8 phases" problem. Whether the *classifier* picks the right intent for any given user message is a separate concern — I'd test the classifier accuracy on a representative set of prompts before deciding it's broken. The mechanism exists.
- **Stale dispatch detection on parallel BUILD.** `orchestrate.ts:638-657 isStaleDispatch` plus the redundant-task tracking in `buildMergeTransform` look correct. Cross-wave ID collision should be caught.
- **Conflict-safe state writes.** `updatePersistedState` retries on `isStateConflictError` and re-runs the transform against the freshly-loaded state. This is well thought out.
- **Wave assignment.** `wave-assigner.ts` exists and the schema enforces `depends_on` arrays. Whether the planner agent populates dependencies correctly is an agent-quality issue, not a code bug.
- **Result envelope schema validation.** `parseTypedResultEnvelope` + the contracts in `orchestrator/contracts/` properly validate envelope shape, runId, dispatchId match. Stale results from previous runs are rejected.
- **Phase advancement and replay.** `phase.ts` has `getNextPhase`, `completePhase`, and the replay logic in `orchestrator/replay.ts` handles state-revision conflicts.

If anything in this list turns out to be broken, I'll happily eat my words — but the code I read is correct.

---

## Closing the gap to oh-my-openagent

omo's success isn't a single feature you can copy. It's three architectural choices that compound. Autopilot has analogues for some of them and gaps in others.

### omo bet 1: Sisyphus is the main agent, not a tool the main agent calls

In omo, the user talks directly to Sisyphus (Claude Opus 4.6 or Kimi K2.5). Sisyphus runs in the main session, holds the conversation, and calls `task` when it wants parallelism. There's no `oc_orchestrate` state machine sitting between the user and the agent. From `feedback_sessions_2/oh-my-openagent_session.md` what you see is Sisyphus running `bash`, reading test output, noticing pytest-asyncio is installed wrong, fixing it. Linear, conversational, no result-envelope ceremony.

In autopilot, the autopilot agent runs in the main session, but it talks to the orchestrator through `oc_orchestrate`. The orchestrator returns instructions ("dispatch oc-architect with this prompt"). The main agent then calls `task` with those instructions. The main agent has to honor a contract: receive dispatch instruction → call task → submit result envelope back to orchestrator → receive next dispatch instruction. **That contract is honor-system.** If the main agent decides to do the work itself instead of calling `task`, the orchestrator can't tell. If the main agent submits a fake-success envelope, the orchestrator believes it. If the main agent loses track of which dispatches are in flight (the deadbolt session showed this), the orchestrator's pendingDispatches and the main agent's mental model diverge.

**Proposal:** keep the orchestrator state machine, but reduce the contract surface. Two specific changes:

1. **The orchestrator should issue one dispatch and wait for one result, not return a "do this next" instruction that the main agent might never execute.** Have `oc_orchestrate` directly call the `task` tool itself (or call into the OpenCode subagent runtime) instead of returning a dispatch instruction. This eliminates the honor-system step. It's more work because it means the orchestrator tool needs subagent-spawning capability. But it's the only way to be sure the main agent isn't drifting from the script.
2. **For "small" tasks, skip the orchestrator entirely** — the intent gate already does this for `quick`/`fix`/`coder` paths. Lean into it. Make the unprefixed `coder` and `debugger` agents the *normal* path and the pipeline the *exceptional* path. Right now the autopilot agent's prompt treats the pipeline as the default and routing-elsewhere as the exception. Flip that bias.

### omo bet 2: agents declare categories, not models

In omo, an agent says "I need an `unspecified-high` model" and the harness picks `claude-opus-4-6` (or whatever the user has configured for that category). The agent doesn't know or care what model it's running on. The user reconfigures categories, all agents shift atomically. This is the same separation-of-concerns as Linux's `update-alternatives` — the consumer asks for "java", the system decides which java is on the path.

Autopilot has groups (`src/registry/types.ts` `GroupModelAssignment`) and per-agent overrides — the model resolver in `src/registry/resolver.ts` looks up `resolveModelForAgent(name, groups, overrides)`. So you have the abstraction. The gap is that **agents are still defined with model identities baked into the registration**, and the dispatch path doesn't pass a "category hint" — it just dispatches to a named agent and lets the resolver figure out the model statically.

**Proposal:** introduce per-agent `category` field that the dispatch path can override at runtime. The architect could say "I want `unspecified-high` for normal design, but for trivial designs I need `quick`." The handler decides the category based on the task complexity and passes it through the dispatch. Today this requires defining two architect agents with different model assignments and dispatching to whichever; tomorrow you'd dispatch to one architect with a category param.

This is medium-effort but it's what makes omo's user experience feel adaptive instead of static.

### omo bet 3: 11 agents, each does one thing

omo has Sisyphus (orchestrator), Hephaestus (deep worker), Prometheus (planner), Atlas (executor), Oracle (architecture consultant), Librarian (codebase search), Metis (plan validator), and four others. Each has a prompt that tells it explicitly *not* to do other agents' jobs. "Each agent does one thing exceptionally well. No jacks of all trades. Orchestrator runs independent verification on everything. Subagents don't get a free pass."

Autopilot has 8 phase handlers + 21 review auditors = 29+ agent roles. The phase handlers map to phases not specialties — `oc-researcher` is just "the agent that runs in RECON phase", not "the agent that knows how to research." If you wanted to invoke a researcher outside the pipeline, you'd use the unprefixed `researcher` (which is the dual-namespace bug from #4).

The 21 review auditors are autopilot's actual differentiator — those ARE specialized one-thing agents. omo doesn't have anything equivalent.

**Proposal:** lean into the 21-auditor system as the product. Three concrete moves:

1. **Make the auditors invokable standalone**, not just from the BUILD phase's review step. Add `oc_audit logic`, `oc_audit security`, `oc_audit react-patterns`, etc. — direct CLI surfaces that any user (with autopilot OR with omo OR with vanilla Claude Code) can call. This positions autopilot's auditors as a layer that complements other harnesses rather than replacing them.
2. **Publish the auditor catalog as a separate npm package** (`@kodrunhq/code-review-auditors` or similar). Same code, different distribution. This is the same move you made with `claudefy` and `dotai` — modular tools rather than monolith. Lets users adopt the auditors without committing to the whole pipeline.
3. **In the autopilot pipeline itself, position the auditors as the "deeper review than omo can do" message.** omo does its own review via Sisyphus's intelligence; autopilot does it via 21 specialized adversaries. That's a defensible difference.

### What NOT to copy from omo

A few things omo does that are easy to admire and harmful to copy:

- **Marketing voice.** "Anthropic blocked OpenCode because of us", "Claude Code's a nice prison", the X-account narrative. This works for code-yeongyu's audience and would actively hurt your positioning at Santander or for any enterprise pitch. Stay sober.
- **214k LOC, 1602 source files, 52 lifecycle hooks, 26 tools.** omo's surface area is enormous and that's part of why it's hard for newcomers to contribute. Your 38k LOC / 547 files is a feature, not a deficit. Don't grow for the sake of growing.
- **The dual-rename (`oh-my-opencode` → `oh-my-openagent`).** The compat layer is now an install footgun. Don't replicate.

### What to do this week

Concrete suggested order:
1. **Bug #1** (architect result-envelope check). One file, ~20 lines, kills the 186-second silent loop.
2. **Bug #5** (`oc_orchestrate abandon`). One file, ~30 lines, restores user control after any dead run.
3. **Bug #2** (plan handler reads wrong file in Arena mode). One file, ~15 lines.
4. **Bug #4** (dual agent namespace, option A rename). Mechanical refactor across `agents/index.ts`, `intent-types.ts`, autopilot.ts prompt.
5. **Bug #8** (populate skill maps). One file, but only worth doing once you have skills to point at.

That's the bleeding stopped. Bugs #3 (persisted retry state), #6/#7 (per-agent breaker keying), #9 (worktrees), and #11 (recover reset rename) are next-week material. Bug #10 (max strikes condition) is a watch item — tracker bug, not urgent fix.

The omo gap-closing moves are bigger and longer-term. Don't try to do them in the same sprint as the bug fixes.

---

## Audit summary

| # | Severity | Title | File | Effort |
|---|---|---|---|---|
| 1 | P0 | ARCHITECT ignores result envelope | `architect.ts:26-46` | S |
| 2 | P0 | PLAN reads `design.md` in Arena mode | `plan.ts:202` | S |
| 3 | P0 | Dispatch retry state in process memory | `dispatch-retry.ts:69` | M |
| 4 | P0 | Dual agent namespace | `agents/index.ts`, `pipeline/index.ts` | M |
| 5 | P0 | No stuck-run recovery exit | `orchestrate.ts:1168`, `quick.ts:43` | S |
| 6 | P1 | Breaker conflates agents in same phase | `orchestrate.ts:553-608` | S |
| 7 | P1 | `dispatch_multi` undercounts breaker | `orchestrate.ts:910-920` | XS |
| 8 | P1 | 5 phases get zero skills injected | `adaptive-injector.ts:48-57` | S+content |
| 9 | P1 | Parallel BUILD shares working dir | `branch-pr.ts:3-6` | L |
| 10 | P1 | Strike check needs all three conditions | `build.ts:70-77` | S |
| 11 | P1 | `oc_recover reset` is misnamed | `recover.ts:100-115` | XS |

Bones: solid. Surgery: targeted. Panic: not warranted.
