# Phase 6: Orchestrator Pipeline - Research

**Researched:** 2026-03-31
**Domain:** 8-phase autonomous SDLC pipeline with subagent dispatch, artifact management, and review integration
**Confidence:** HIGH

## Summary

Phase 6 transforms the Phase 4 dispatch skeleton (`orchestrateCore` in `src/tools/orchestrate.ts`) into a fully functional 8-phase pipeline. The current skeleton handles state creation, phase transitions, and generic dispatch prompts. Phase 6 adds: (1) per-phase handler functions with phase-specific prompt construction and artifact management, (2) nine new pipeline subagent definitions injected via configHook, (3) Arena logic for the ARCHITECT phase with confidence-gated debate depth, (4) BUILD phase task-cycling with wave-based execution and review integration via `reviewCore()`, and (5) artifact directory management under `.opencode-assets/phases/`.

The source plugin (claude-hands-free) has a 2400-line markdown orchestrator command and 12 markdown agent definitions. Phase 6 ports the LOGIC (phase handlers, dispatch prompts, artifact flow) into TypeScript functions while keeping agent prompts lean (200-500 chars per D-02). The key architectural insight: hands-free puts all orchestration logic in a massive system prompt that the LLM interprets; our design puts orchestration logic in TypeScript handler functions that deterministically construct dispatch instructions. This is more reliable and cheaper.

**Primary recommendation:** Implement per-phase handler functions as separate modules in `src/orchestrator/handlers/`, define 9 pipeline agents in `src/agents/pipeline/`, and extend `orchestrateCore` to route through handlers. Each handler reads state + prior artifacts (file references, not content), constructs a dispatch prompt, and returns the standard `{action, agent, prompt}` JSON.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** All 8 pipeline subagents are injected via configHook as `mode: "subagent"`. They are visible in @ autocomplete and can be called directly by users. Names: `oc-researcher`, `oc-challenger`, `oc-architect`, `oc-challenger`, `oc-planner`, `oc-implementer`, `oc-reviewer` (delegates to oc_review), `oc-shipper`, `oc-retrospector`.
- **D-02:** Lean prompts (~200-500 chars) with context injection. Each agent has a short role description. The `oc_orchestrate` tool injects phase-specific context (idea, prior phase results, artifact file references) into the dispatch instruction. Agents are role-defined; context is tool-injected.
- **D-03:** Agent configs follow the existing `Readonly<AgentConfig> + Object.freeze()` pattern from Phase 3. Each agent is defined in `src/agents/pipeline/` (separate directory from v1 curated agents).
- **D-04:** Task-per-dispatch cycle. BUILD phase returns one task at a time via `oc_orchestrate`. Orchestrator dispatches `oc-implementer` for task 1, gets result, calls `oc_orchestrate` with result, gets task 2, repeat until all tasks done.
- **D-05:** Review runs after each wave/batch of tasks (not per individual task). After a group of related tasks completes, the orchestrator calls `oc_review` on the changes. If CRITICAL findings: fix cycle runs before next wave.
- **D-06:** Wave-based parallel build is supported through the task dispatch model. The `oc_orchestrate` tool returns multiple tasks grouped by wave (from the plan module). Tasks within the same wave can be dispatched concurrently by the orchestrator agent.
- **D-07:** Confidence-gated activation. Arena activates based on confidence from RECON phase. LOW confidence -> 3 proposals + critic. MEDIUM -> 2 proposals + critic. HIGH -> single proposal (no debate). Uses `getDebateDepth()` from the Phase 4 arena module.
- **D-08:** Adversarial critic agent evaluates competing proposals. A dedicated `oc-critic` agent receives all proposals and stress-tests each against criteria (feasibility, complexity, risk). Produces ranked recommendation. The `oc_orchestrate` tool picks the winner based on the critic's ranking.
- **D-09:** `oc-critic` is a configHook subagent (visible). Used by the Arena and potentially by users for ad-hoc architecture evaluation.
- **D-10:** Phase artifacts stored at `.opencode-assets/phases/{PHASE_NAME}/`. Each phase writes to its own directory (e.g., `.opencode-assets/phases/RECON/report.md`, `.opencode-assets/phases/ARCHITECT/design.md`, `.opencode-assets/phases/BUILD/tasks.json`).
- **D-11:** File reference context flow. The dispatch prompt tells the agent "read .opencode-assets/phases/RECON/report.md for context." The agent reads the file itself. No content serialized into the dispatch prompt. Minimal token cost.
- **D-12:** The `oc_orchestrate` tool manages artifact directory creation and references. Each phase handler in the tool creates the directory, constructs the dispatch prompt with file references, and expects the subagent to write its output to the designated location.
- **D-13:** The existing `orchestrateCore` in `src/tools/orchestrate.ts` needs significant enhancement. Currently it has a simple dispatch skeleton. Phase 6 adds: per-phase prompt templates, artifact directory management, BUILD task cycling, Arena logic, and review integration.
- **D-14:** Each phase handler is a separate function (e.g., `handleRecon()`, `handleChallenge()`, `handleArchitect()`, `handlePlan()`, `handleBuild()`, `handleShip()`, `handleRetrospective()`) called from the main switch in `orchestrateCore`. Keeps the switch clean.
- **D-15:** `node:fs/promises` for all I/O
- **D-16:** Zod for all validation
- **D-17:** Immutability (Object.freeze, Readonly, spreads)
- **D-18:** `*Core` + `tool()` wrapper for tools
- **D-19:** Atomic writes for state persistence

### Claude's Discretion
- Exact prompt content for each of the 8 pipeline subagents
- Internal structure of phase handler functions
- Exact artifact file naming conventions per phase
- How the BUILD phase tracks task progress within a run
- How SHIP generates the architecture walkthrough vs decision summary vs changelog
- EXPLORE phase: whether to implement or defer (currently optional in the pipeline)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORCH-01 | User can invoke `oc_orchestrate` with an idea and the orchestrator drives an 8-phase pipeline to completion autonomously | Per-phase handler functions route each phase; existing state machine handles transitions; enhanced `orchestrateCore` adds phase-specific logic |
| PIPE-01 | RECON phase dispatches a researcher subagent that produces a structured domain research report | `handleRecon()` creates `.opencode-assets/phases/RECON/` dir, dispatches `oc-researcher` with idea + file reference instructions |
| PIPE-02 | CHALLENGE phase proposes enhancements the user did not articulate, capped at 3 additions | `handleChallenge()` dispatches `oc-challenger` with references to RECON artifacts |
| PIPE-03 | ARCHITECT phase produces a system design; when Arena is enabled, 2-3 parallel proposals evaluated by adversarial critic | `handleArchitect()` uses `getDebateDepth()` to determine proposal count, dispatches `oc-architect` (single) or multiple proposals + `oc-critic` |
| PIPE-04 | PLAN phase decomposes architecture into ordered tasks with wave numbers, max 300-line diffs | `handlePlan()` dispatches `oc-planner` with references to architecture artifacts |
| PIPE-05 | BUILD phase implements tasks iteratively with branch/commit per task, running review after each task | `handleBuild()` manages task-per-dispatch cycle, integrates `reviewCore()` after wave completion |
| PIPE-06 | BUILD phase supports wave-based parallel execution where independent tasks within a wave build concurrently | `handleBuild()` uses `groupByWave()` from existing plan module to return wave-grouped tasks |
| PIPE-07 | SHIP phase produces a ship package (architecture walkthrough, decision summary, changelog) | `handleShip()` dispatches `oc-shipper` with references to all prior phase artifacts |
| PIPE-08 | RETROSPECTIVE phase extracts lessons learned and writes them to institutional memory | `handleRetrospective()` dispatches `oc-retrospector` with run summary and artifact references |
</phase_requirements>

## Architecture Patterns

### Recommended Project Structure

```
src/
  orchestrator/
    handlers/              # NEW: Per-phase handler functions
      recon.ts             # handleRecon(state, artifactDir) -> DispatchResult
      challenge.ts         # handleChallenge(state, artifactDir) -> DispatchResult
      architect.ts         # handleArchitect(state, artifactDir) -> DispatchResult
      plan.ts              # handlePlan(state, artifactDir) -> DispatchResult
      build.ts             # handleBuild(state, artifactDir) -> DispatchResult
      ship.ts              # handleShip(state, artifactDir) -> DispatchResult
      retrospective.ts     # handleRetrospective(state, artifactDir) -> DispatchResult
      index.ts             # Handler dispatch map: Phase -> handler function
    artifacts.ts           # NEW: Artifact directory management (ensurePhaseDir, getArtifactPath)
    phase.ts               # EXISTING: Phase transitions (unchanged)
    arena.ts               # EXISTING: getDebateDepth (unchanged)
    plan.ts                # EXISTING: groupByWave, indexTasks (unchanged)
    state.ts               # EXISTING: loadState, saveState, patchState (unchanged)
    schemas.ts             # EXISTING: Extend with artifact tracking fields
    confidence.ts          # EXISTING: appendConfidence, summarizeConfidence (unchanged)
    types.ts               # EXISTING: Extend with handler result types
  agents/
    pipeline/              # NEW: Pipeline subagent definitions
      oc-researcher.ts     # RECON agent config
      oc-challenger.ts     # CHALLENGE agent config
      oc-architect.ts      # ARCHITECT agent config (also serves as proposer)
      oc-critic.ts         # Arena critic agent config
      oc-planner.ts        # PLAN agent config
      oc-implementer.ts    # BUILD agent config
      oc-reviewer.ts       # Thin wrapper: delegates to oc_review tool
      oc-shipper.ts        # SHIP agent config
      oc-retrospector.ts   # RETROSPECTIVE agent config
      index.ts             # Export all pipeline agents for configHook
    index.ts               # MODIFIED: Import + register pipeline agents
  tools/
    orchestrate.ts         # MODIFIED: Route through per-phase handlers
```

### Pattern 1: Per-Phase Handler Functions

**What:** Each phase has a dedicated handler function that takes pipeline state + artifact directory and returns a dispatch result (or completion signal). The main `orchestrateCore` switch delegates to these handlers.

**When to use:** Always -- this is the locked decision (D-14).

**Example:**

```typescript
// src/orchestrator/handlers/recon.ts
import { join } from "node:path";
import { ensureDir } from "../../utils/fs-helpers";
import type { PipelineState } from "../types";

export interface DispatchResult {
  readonly action: "dispatch" | "dispatch_multi" | "complete" | "error";
  readonly agent?: string;
  readonly agents?: readonly { readonly agent: string; readonly prompt: string }[];
  readonly prompt?: string;
  readonly phase?: string;
  readonly progress?: string;
  readonly message?: string;
}

const RECON_DIR = "phases/RECON";

export async function handleRecon(
  state: Readonly<PipelineState>,
  artifactDir: string,
): Promise<DispatchResult> {
  const phaseDir = join(artifactDir, RECON_DIR);
  await ensureDir(phaseDir);

  return Object.freeze({
    action: "dispatch" as const,
    agent: "oc-researcher",
    prompt: [
      `Research the following idea thoroughly and write your findings to ${RECON_DIR}/report.md`,
      `Idea: ${state.idea}`,
      `Output location: ${RECON_DIR}/report.md`,
      `Include sections: Market Analysis, Technology Options, UX Considerations, Feasibility Assessment, Confidence`,
    ].join("\n"),
    phase: "RECON",
    progress: "Dispatching researcher for domain analysis",
  });
}
```

### Pattern 2: Handler Dispatch Map

**What:** A lookup table mapping Phase -> handler function, called from orchestrateCore's switch statement.

**Example:**

```typescript
// src/orchestrator/handlers/index.ts
import type { Phase } from "../types";
import type { DispatchResult } from "./recon";
import { handleRecon } from "./recon";
import { handleChallenge } from "./challenge";
import { handleArchitect } from "./architect";
import { handlePlan } from "./plan";
import { handleBuild } from "./build";
import { handleShip } from "./ship";
import { handleRetrospective } from "./retrospective";
import type { PipelineState } from "../types";

type PhaseHandler = (
  state: Readonly<PipelineState>,
  artifactDir: string,
  result?: string,
) => Promise<DispatchResult>;

export const PHASE_HANDLERS: Readonly<Record<Phase, PhaseHandler>> = Object.freeze({
  RECON: handleRecon,
  CHALLENGE: handleChallenge,
  ARCHITECT: handleArchitect,
  EXPLORE: handleExplore,  // or stub that skips
  PLAN: handlePlan,
  BUILD: handleBuild,
  SHIP: handleShip,
  RETROSPECTIVE: handleRetrospective,
});
```

### Pattern 3: Artifact Directory Management

**What:** Centralized functions for creating phase directories and resolving artifact paths.

**Example:**

```typescript
// src/orchestrator/artifacts.ts
import { join } from "node:path";
import { ensureDir } from "../utils/fs-helpers";
import type { Phase } from "./types";

export function getPhaseDir(artifactDir: string, phase: Phase): string {
  return join(artifactDir, "phases", phase);
}

export async function ensurePhaseDir(artifactDir: string, phase: Phase): Promise<string> {
  const dir = getPhaseDir(artifactDir, phase);
  await ensureDir(dir);
  return dir;
}

export function getArtifactRef(phase: Phase, filename: string): string {
  return `phases/${phase}/${filename}`;
}
```

### Pattern 4: BUILD Phase Task Cycling

**What:** The BUILD handler maintains task state. First call returns the first pending task. Subsequent calls (with result) mark the task done and return the next task. After a wave completes, triggers review.

**Key insight from hands-free source:** The hands-free orchestrator tracks `currentTask`, `currentWave`, `attemptCount`, and `strikeCount` in state. Our implementation should extend `pipelineStateSchema` with these fields.

**Example:**

```typescript
// src/orchestrator/handlers/build.ts (conceptual)
export async function handleBuild(
  state: Readonly<PipelineState>,
  artifactDir: string,
  result?: string,
): Promise<DispatchResult> {
  // If result provided: mark current task done, check if wave complete
  if (result) {
    // Mark task done in state.tasks
    // If all tasks in current wave are done -> trigger review
    // If review has CRITICAL findings -> return fix dispatch
    // Otherwise -> return next task dispatch
  }

  // Find next pending task
  const waves = groupByWave(state.tasks);
  const currentWave = findCurrentWave(waves);
  const nextTask = findNextPendingTask(currentWave);

  if (!nextTask) {
    // All tasks done -> advance to SHIP
    return { action: "complete", ... };
  }

  return {
    action: "dispatch",
    agent: "oc-implementer",
    prompt: buildTaskPrompt(nextTask, state, artifactDir),
  };
}
```

### Pattern 5: Arena Dispatch (ARCHITECT Phase)

**What:** When Arena is enabled (depth > 1), the ARCHITECT handler returns `dispatch_multi` with multiple proposals, followed by a critic dispatch. This requires multi-step handling within the phase.

**Key insight:** The handler needs to track Arena progress within the ARCHITECT phase. Options: (a) use sub-states in pipeline state, or (b) check for artifact existence to determine progress.

**Recommended approach:** Artifact-existence checks (idempotency pattern from hands-free). If `proposals/proposal-A.md` exists but `critique.md` does not, we're at the critic step.

```typescript
// Conceptual: ARCHITECT handler multi-step flow
export async function handleArchitect(
  state: Readonly<PipelineState>,
  artifactDir: string,
  result?: string,
): Promise<DispatchResult> {
  const depth = getDebateDepth(filterByPhase(state.confidence, "RECON"));
  const phaseDir = join(artifactDir, "phases/ARCHITECT");

  if (depth === 1) {
    // Single proposal, no debate
    return { action: "dispatch", agent: "oc-architect", prompt: "..." };
  }

  // Multi-proposal Arena: check progress via artifacts
  // Step 1: Dispatch proposers (return dispatch_multi)
  // Step 2: After proposals, dispatch critic
  // Step 3: After critique, synthesize winner and advance
}
```

### Pattern 6: Lean Agent Configs (200-500 chars)

**What:** Pipeline agents have short role descriptions. Context is injected by the orchestrate tool, not baked into the agent prompt.

**Example from hands-free -> compressed:**

```typescript
// hf-researcher is 130 lines of markdown. Our oc-researcher is ~10 lines:
export const ocResearcherAgent: Readonly<AgentConfig> = Object.freeze({
  description: "RECON phase researcher for the autonomous pipeline",
  mode: "subagent",
  maxSteps: 30,
  prompt: `You are oc-researcher. Conduct domain research for a software product idea.
Write structured findings to the artifact path specified in your task.
Include: Market Analysis, Technology Options, UX Considerations, Feasibility Assessment.
End with a ## Confidence section rating overall research confidence as HIGH/MEDIUM/LOW.
Completeness over brevity. Present options with tradeoffs, do not make implementation decisions.`,
  permission: { edit: "allow", bash: "allow", webfetch: "allow" },
});
```

### Anti-Patterns to Avoid

- **Embedding content in dispatch prompts:** D-11 explicitly forbids this. Use file references ("read .opencode-assets/phases/RECON/report.md") not content injection ("Here are the research findings: ..."). The hands-free source injects up to 3000 chars of content per dispatch -- do NOT port this pattern.

- **Giant handler functions:** Each handler should be 50-100 lines max. If a handler needs sub-steps (like ARCHITECT Arena), use artifact-existence checks for state, not a massive function with nested conditionals.

- **Mutating state in handlers:** Handlers return `DispatchResult`. State mutation happens in `orchestrateCore` after the handler returns. Handlers receive `Readonly<PipelineState>`.

- **Dispatching review as a tool call from BUILD handler:** Per the CONTEXT.md specific idea, BUILD should call `reviewCore()` directly (typed function call), not dispatch `oc_review` as a separate tool call. This avoids JSON serialization round-trip.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase transitions | Custom state machine | Existing `completePhase()`, `getNextPhase()`, `validateTransition()` | Already tested, handles edge cases |
| Arena debate depth | Custom confidence logic | Existing `getDebateDepth()` from `arena.ts` | Already maps LOW->3, MEDIUM->2, HIGH->1 |
| Task wave grouping | Custom task sorting | Existing `groupByWave()` from `plan.ts` | Returns ReadonlyMap<number, readonly Task[]> |
| State persistence | Custom file I/O | Existing `saveState()` with atomic tmp+rename | Already handles validation + atomic writes |
| Confidence tracking | Custom ledger logic | Existing `appendConfidence()`, `summarizeConfidence()` | Already tested with proper immutability |
| Review pipeline | Custom review dispatch | Existing `reviewCore()` from `review.ts` | 4-stage pipeline already implemented |
| Agent config pattern | Custom agent format | `Readonly<AgentConfig> + Object.freeze()` | Established project pattern |
| Dir creation | Manual mkdir | Existing `ensureDir()` from `fs-helpers.ts` | Already handles ENOENT |

## Common Pitfalls

### Pitfall 1: Token Budget Explosion from Content Injection

**What goes wrong:** The hands-free orchestrator injects 3000+ chars of prior phase content directly into dispatch prompts. If ported naively, each dispatch carries growing context from all prior phases, consuming the context window.
**Why it happens:** Temptation to "give the agent everything it needs" in one prompt.
**How to avoid:** D-11 mandates file reference flow. Dispatch prompts say "read file X for context" not "here is the content of file X." Each agent reads what it needs.
**Warning signs:** Dispatch prompt strings exceeding 500 chars of non-structural content.

### Pitfall 2: Arena Multi-Step Handling

**What goes wrong:** The ARCHITECT handler needs to coordinate multiple dispatches (proposers -> critic -> synthesis). If modeled as a single handler call, it tries to do everything in one step. If modeled as sub-states, state complexity explodes.
**Why it happens:** The hands-free orchestrator is a giant markdown program that runs sequentially in one agent session. Our tool returns after each dispatch and gets called back.
**How to avoid:** Use artifact-existence checks for idempotency. If `proposals/` has files but no `critique.md`, dispatch critic. If `critique.md` exists but no `design.md`, synthesize winner. Each `oc_orchestrate(result=...)` call advances one Arena step.
**Warning signs:** Handler function exceeding 100 lines; state schema gaining Arena-specific sub-states.

### Pitfall 3: BUILD Phase Infinite Loop

**What goes wrong:** BUILD dispatches task -> gets result -> dispatches next task -> repeat. If task completion is not tracked properly, the same task gets dispatched forever, or the loop never terminates.
**Why it happens:** The hands-free orchestrator tracks `currentTask` in state.md and checks task status. If our implementation doesn't update task status atomically, state can get out of sync.
**How to avoid:** Each `handleBuild(state, artifactDir, result)` call: (1) marks current task DONE in state.tasks, (2) saves state, (3) finds next PENDING task. Use `countByStatus()` from `plan.ts` to detect completion.
**Warning signs:** Tests where BUILD dispatches the same task ID twice; state.tasks showing PENDING after result was provided.

### Pitfall 4: Review Integration Timing

**What goes wrong:** Per D-05, review runs after wave completion, not per-task. But the BUILD handler dispatches one task at a time. If the handler triggers review after every task instead of every wave, it over-reviews and wastes tokens.
**Why it happens:** Confusion between "task completed" and "wave completed."
**How to avoid:** After marking a task DONE, check if ALL tasks in the current wave are DONE. Only then call `reviewCore()`. Track current wave number in state.
**Warning signs:** Review dispatches outnumbering wave count.

### Pitfall 5: Agent Name Mismatch

**What goes wrong:** `PHASE_AGENTS` map in `orchestrate.ts` uses names like `oc-researcher`, but agent configs in `configHook` must use the same key. If the configHook key is `oc-researcher` but the agent's internal name differs, dispatch fails silently.
**Why it happens:** Two separate registrations (PHASE_AGENTS map and configHook) with no compile-time check that they match.
**How to avoid:** Define agent names as constants shared between `PHASE_AGENTS` and the pipeline agent configs. Use a single source of truth.
**Warning signs:** Dispatch returns `{action: "dispatch", agent: "oc-researcher"}` but no agent with that name exists in the config.

### Pitfall 6: EXPLORE Phase Confusion

**What goes wrong:** EXPLORE is optional -- it only triggers when `shouldTriggerExplorer()` returns true (LOW confidence from critic). Implementing it prematurely adds complexity with low value.
**Why it happens:** The hands-free source has full EXPLORE support (divergent branches, comparator agent). Tempting to port.
**How to avoid:** Per discretion area: EXPLORE handler should SKIP by default (mark phase SKIPPED, advance to PLAN). Can be implemented in Phase 7 or later if needed. The `shouldTriggerExplorer()` function already exists but just doesn't need a full handler yet.
**Warning signs:** Three or more new agents just for EXPLORE; handler function exceeding 150 lines.

## Code Examples

### Enhanced orchestrateCore Switch

```typescript
// src/tools/orchestrate.ts -- enhanced main function (conceptual)
export async function orchestrateCore(args: OrchestrateArgs, artifactDir: string): Promise<string> {
  const state = await loadState(artifactDir);

  if (state === null && !args.idea) {
    return JSON.stringify({ action: "error", message: "No active run. Provide an idea to start." });
  }

  if (state === null && args.idea) {
    const newState = createInitialState(args.idea);
    await saveState(newState, artifactDir);
    try { await ensureGitignore(join(artifactDir, "..")); } catch { /* non-critical */ }
    const handler = PHASE_HANDLERS[newState.currentPhase as Phase];
    const result = await handler(newState, artifactDir);
    return JSON.stringify(result);
  }

  if (state !== null) {
    if (state.currentPhase === null) {
      return JSON.stringify({ action: "complete", summary: `Pipeline completed. Idea: ${state.idea}` });
    }

    if (args.result) {
      // Phase-specific result handling (BUILD needs special cycling)
      const handler = PHASE_HANDLERS[state.currentPhase];
      const dispatchResult = await handler(state, artifactDir, args.result);

      if (dispatchResult.action === "complete") {
        // Advance to next phase
        const updated = completePhase(state);
        await saveState(updated, artifactDir);
        if (updated.currentPhase === null) {
          return JSON.stringify({ action: "complete", summary: `Pipeline completed all phases.` });
        }
        const nextHandler = PHASE_HANDLERS[updated.currentPhase];
        const nextResult = await nextHandler(updated, artifactDir);
        return JSON.stringify(nextResult);
      }

      // Handler wants to dispatch (possibly with state updates)
      return JSON.stringify(dispatchResult);
    }

    // Resume
    const handler = PHASE_HANDLERS[state.currentPhase];
    const result = await handler(state, artifactDir);
    return JSON.stringify(result);
  }

  return JSON.stringify({ action: "error", message: "Unexpected state" });
}
```

### Pipeline Agent Config

```typescript
// src/agents/pipeline/oc-researcher.ts
import type { AgentConfig } from "@opencode-ai/sdk";

export const pipelineResearcherAgent: Readonly<AgentConfig> = Object.freeze({
  description: "RECON phase: conducts domain research for the autonomous pipeline",
  mode: "subagent",
  maxSteps: 30,
  prompt: `You are oc-researcher. Research the software idea given in your task.
Write findings to the artifact path specified. Include: Market Analysis, Technology Options,
UX Considerations, Feasibility Assessment. End with ## Confidence (HIGH/MEDIUM/LOW).
Present options with tradeoffs. Do not make implementation decisions.`,
  permission: { edit: "allow", bash: "allow", webfetch: "allow" },
});
```

### Pipeline Agent Registration in configHook

```typescript
// src/agents/pipeline/index.ts
import { pipelineResearcherAgent } from "./oc-researcher";
import { pipelineChallengerAgent } from "./oc-challenger";
// ... all 9 agents

export const pipelineAgents = {
  "oc-researcher": pipelineResearcherAgent,
  "oc-challenger": pipelineChallengerAgent,
  "oc-architect": pipelineArchitectAgent,
  "oc-critic": pipelineCriticAgent,
  "oc-planner": pipelinePlannerAgent,
  "oc-implementer": pipelineImplementerAgent,
  "oc-reviewer": pipelineReviewerAgent,
  "oc-shipper": pipelineShipperAgent,
  "oc-retrospector": pipelineRetrospectorAgent,
} as const;

// In src/agents/index.ts -- add to configHook:
// for (const [name, agentConfig] of Object.entries(pipelineAgents)) { ... }
```

### Schema Extension for Phase Artifacts

```typescript
// Extend pipelineStateSchema with BUILD tracking fields
const buildProgressSchema = z.object({
  currentTask: z.string().max(128).nullable().default(null),
  currentWave: z.number().nullable().default(null),
  attemptCount: z.number().default(0),
  strikeCount: z.number().default(0),
});

// Add to pipelineStateSchema:
//   buildProgress: buildProgressSchema.default({ currentTask: null, currentWave: null, attemptCount: 0, strikeCount: 0 }),
```

### Artifact Path Constants

```typescript
// Artifact naming convention per phase
export const PHASE_ARTIFACTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  RECON: ["report.md"],
  CHALLENGE: ["brief.md", "backlog.md"],
  ARCHITECT: ["design.md", "proposals/", "critique.md"],
  PLAN: ["tasks.md", "dod.md"],
  BUILD: ["tasks.json"],  // task status tracked in state.json
  SHIP: ["walkthrough.md", "decisions.md", "changelog.md"],
  RETROSPECTIVE: ["lessons.md"],
});
```

## State of the Art

| Old Approach (hands-free) | New Approach (opencode-assets) | Impact |
|---------------------------|-------------------------------|--------|
| 2400-line markdown system prompt | TypeScript handler functions | Logic is deterministic, not LLM-interpreted |
| 130-line agent markdown files | 10-line AgentConfig objects | 90% prompt reduction per D-02 |
| Content injection in prompts (3000 chars) | File reference instructions | Token cost scales O(1) not O(phases) |
| CJS regex-based state parsing | Zod-validated JSON state | Type-safe, no parsing edge cases |
| `Agent` tool dispatch in Claude Code | `configHook` subagent dispatch in OpenCode | Different mechanism, same agent-dispatch result |
| Markdown state.md | JSON state.json | Already implemented in Phase 4 |
| Synchronous fs I/O | Async with atomic tmp+rename | Already implemented in Phase 4 |

## Open Questions

1. **ARCHITECT Arena multi-dispatch: How does `oc_orchestrate` return multiple parallel dispatches?**
   - What we know: Current dispatch result is `{action: "dispatch", agent: "...", prompt: "..."}` -- singular.
   - What's unclear: For Arena proposals (2-3 parallel), we need `dispatch_multi` or the orchestrator agent calls `oc_orchestrate` once per proposal.
   - Recommendation: Add `dispatch_multi` action with `agents` array. The orchestrator agent dispatches all agents in the array concurrently, then calls `oc_orchestrate` with combined results. This is cleaner than N round-trips. Alternatively, keep single dispatch but have the handler track Arena step in state (first call = proposal A, second = proposal B, etc.).

2. **BUILD review integration: Does `reviewCore()` need modification to accept programmatic scope?**
   - What we know: `reviewCore` accepts `{scope: "staged"|"unstaged"|"branch"|"all"|"directory"}` as string enum. BUILD phase needs to review a specific wave's changes.
   - What's unclear: Whether "staged" or "branch" scope is appropriate after a wave of commits.
   - Recommendation: Use `"branch"` scope for review after wave completion. The implementer's commits on the feature branch are the diff to review.

3. **EXPLORE phase: implement or defer?**
   - What we know: `shouldTriggerExplorer()` exists. Hands-free EXPLORE requires divergent branches + comparator agent.
   - Recommendation: Implement as SKIP-only stub. The handler checks `shouldTriggerExplorer()` and always marks EXPLORE as SKIPPED, advancing to PLAN. Full implementation can be Phase 7 if needed. This reduces Phase 6 scope significantly.

## Project Constraints (from CLAUDE.md)

- **Runtime:** Bun only -- plugins run inside the OpenCode process via Bun
- **No standalone Zod install:** Use `z` from transitive dep of `@opencode-ai/plugin`
- **No `Bun.file()`/`Bun.write()`:** Use `node:fs/promises`
- **Model agnostic:** Never hardcode model identifiers in agent configs. Omit `model` field.
- **Global target for assets:** `~/.config/opencode/` (not project-local)
- **`oc_` prefix:** All plugin tool names must start with `oc_`
- **Dependency flow:** Strictly top-down, no cycles: `index.ts` -> `tools/*` -> `templates/*` + `utils/*`
- **Atomic file writes:** `writeFile(path, content, { flag: "wx" })` or tmp+rename pattern
- **Immutability:** `Object.freeze()`, `Readonly<>`, spread-based updates
- **`*Core` + `tool()` wrapper:** For all tool definitions
- **Biome:** Lint and format via `bun run lint` and `bun run format`
- **Tests:** `bun test` -- Bun's native test runner

## Sources

### Primary (HIGH confidence)
- **Source plugin analysis:** `/home/joseibanez/develop/projects/claude-hands-free/commands/hands-free.md` -- Full 2400-line orchestrator (read sections 1-8)
- **Source agent definitions:** All 12 agents in `/home/joseibanez/develop/projects/claude-hands-free/agents/` -- Role descriptions, output contracts, behavioral rules
- **Existing codebase:** `src/tools/orchestrate.ts`, `src/orchestrator/*.ts`, `src/agents/*.ts`, `src/tools/review.ts`, `src/review/pipeline.ts` -- Current implementation to extend
- **Phase context:** `.planning/phases/06-orchestrator-pipeline/06-CONTEXT.md` -- Locked decisions
- **Prior research:** `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/research/FEATURES.md`

### Secondary (MEDIUM confidence)
- **OpenCode plugin API:** Inferred from existing code patterns (`@opencode-ai/plugin`, `@opencode-ai/sdk`) -- actual API docs not consulted

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies needed; all building on existing modules
- Architecture: HIGH -- per-phase handler pattern is well-understood; source plugin provides complete reference implementation
- Pitfalls: HIGH -- identified from hands-free source analysis and existing project pitfall research

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable -- architecture locked by CONTEXT.md decisions)
