# Phase 6: Orchestrator Pipeline - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

The full 8-phase autonomous SDLC pipeline. Phase 4 built the dispatch skeleton (oc_orchestrate returns {action, agent, prompt}). Phase 6 creates the real subagent definitions, phase-specific logic, and artifact management that makes each pipeline phase produce meaningful output. Integrates the Phase 5 review engine into the BUILD phase.

Requirements: ORCH-01, PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07, PIPE-08

</domain>

<decisions>
## Implementation Decisions

### Phase Subagent Design (ORCH-01, PIPE-01..08)
- **D-01:** All 8 pipeline subagents are injected via configHook as `mode: "subagent"`. They are visible in @ autocomplete and can be called directly by users. Names: `oc-researcher`, `oc-challenger`, `oc-architect`, `oc-planner`, `oc-implementer`, `oc-reviewer` (delegates to oc_review), `oc-shipper`, `oc-retrospector`.
- **D-02:** Lean prompts (~200-500 chars) with context injection. Each agent has a short role description. The `oc_orchestrate` tool injects phase-specific context (idea, prior phase results, artifact file references) into the dispatch instruction. Agents are role-defined; context is tool-injected.
- **D-03:** Agent configs follow the existing `Readonly<AgentConfig> + Object.freeze()` pattern from Phase 3. Each agent is defined in `src/agents/pipeline/` (separate directory from v1 curated agents).

### BUILD Phase Integration (PIPE-05, PIPE-06)
- **D-04:** Task-per-dispatch cycle. BUILD phase returns one task at a time via `oc_orchestrate`. Orchestrator dispatches `oc-implementer` for task 1, gets result, calls `oc_orchestrate` with result, gets task 2, repeat until all tasks done.
- **D-05:** Review runs after each wave/batch of tasks (not per individual task). After a group of related tasks completes, the orchestrator calls `oc_review` on the changes. If CRITICAL findings: fix cycle runs before next wave.
- **D-06:** Wave-based parallel build is supported through the task dispatch model. The `oc_orchestrate` tool returns multiple tasks grouped by wave (from the plan module). Tasks within the same wave can be dispatched concurrently by the orchestrator agent.

### Arena Architecture (PIPE-03)
- **D-07:** Confidence-gated activation. Arena activates based on confidence from RECON phase. LOW confidence -> 3 proposals + critic. MEDIUM -> 2 proposals + critic. HIGH -> single proposal (no debate). Uses `getDebateDepth()` from the Phase 4 arena module.
- **D-08:** Adversarial critic agent evaluates competing proposals. A dedicated `oc-critic` agent receives all proposals and stress-tests each against criteria (feasibility, complexity, risk). Produces ranked recommendation. The `oc_orchestrate` tool picks the winner based on the critic's ranking.
- **D-09:** `oc-critic` is a configHook subagent (visible). Used by the Arena and potentially by users for ad-hoc architecture evaluation.

### Artifact Management
- **D-10:** Phase artifacts stored at `.opencode-assets/phases/{PHASE_NAME}/`. Each phase writes to its own directory (e.g., `.opencode-assets/phases/RECON/report.md`, `.opencode-assets/phases/ARCHITECT/design.md`, `.opencode-assets/phases/BUILD/tasks.json`).
- **D-11:** File reference context flow. The dispatch prompt tells the agent "read .opencode-assets/phases/RECON/report.md for context." The agent reads the file itself. No content serialized into the dispatch prompt. Minimal token cost.
- **D-12:** The `oc_orchestrate` tool manages artifact directory creation and references. Each phase handler in the tool creates the directory, constructs the dispatch prompt with file references, and expects the subagent to write its output to the designated location.

### Orchestrate Tool Enhancement
- **D-13:** The existing `orchestrateCore` in `src/tools/orchestrate.ts` needs significant enhancement. Currently it has a simple dispatch skeleton. Phase 6 adds: per-phase prompt templates, artifact directory management, BUILD task cycling, Arena logic, and review integration.
- **D-14:** Each phase handler is a separate function (e.g., `handleRecon()`, `handleChallenge()`, `handleArchitect()`, `handlePlan()`, `handleBuild()`, `handleShip()`, `handleRetrospective()`) called from the main switch in `orchestrateCore`. Keeps the switch clean.

### Carrying Forward
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source Plugin Reference (Port From)
- `/home/joseibanez/develop/projects/claude-hands-free/commands/hands-free.md` -- Full orchestrator command (8-phase state machine logic)
- `/home/joseibanez/develop/projects/claude-hands-free/agents/hf-researcher.md` -- RECON agent prompt
- `/home/joseibanez/develop/projects/claude-hands-free/agents/hf-challenge.md` -- CHALLENGE agent prompt
- `/home/joseibanez/develop/projects/claude-hands-free/agents/hf-proposer.md` -- ARCHITECT proposal agent
- `/home/joseibanez/develop/projects/claude-hands-free/agents/hf-critic.md` -- Arena critic agent
- `/home/joseibanez/develop/projects/claude-hands-free/agents/hf-planner.md` -- PLAN agent (task decomposition)
- `/home/joseibanez/develop/projects/claude-hands-free/agents/hf-implementer.md` -- BUILD implementer agent
- `/home/joseibanez/develop/projects/claude-hands-free/agents/hf-reviewer.md` -- Review agent (replaced by oc_review)
- `/home/joseibanez/develop/projects/claude-hands-free/agents/hf-shipper.md` -- SHIP agent
- `/home/joseibanez/develop/projects/claude-hands-free/agents/hf-retrospective.md` -- RETROSPECTIVE agent

### Existing Codebase (Build On)
- `src/tools/orchestrate.ts` -- Dispatch skeleton to enhance
- `src/orchestrator/phase.ts` -- Phase transitions (VALID_TRANSITIONS)
- `src/orchestrator/arena.ts` -- getDebateDepth, shouldTriggerExplorer
- `src/orchestrator/plan.ts` -- Task indexing, wave grouping
- `src/orchestrator/schemas.ts` -- State schema (extend for phase artifacts)
- `src/agents/orchestrator.ts` -- Lean dispatch loop agent
- `src/agents/index.ts` -- ConfigHook pattern for agent injection
- `src/tools/review.ts` -- Review engine (called from BUILD phase)
- `src/review/pipeline.ts` -- 4-stage review pipeline

### Research
- `.planning/research/FEATURES.md` -- Hands-free feature mapping (essential vs nice-to-have)
- `.planning/research/ARCHITECTURE.md` -- Component boundaries, data flow
- `.planning/research/PITFALLS.md` -- Token budget, dispatch cascade risk

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/tools/orchestrate.ts` -- Extend with per-phase handlers (currently simple dispatch)
- `src/orchestrator/arena.ts` -- getDebateDepth() for Arena confidence gating
- `src/orchestrator/plan.ts` -- groupByWave() for BUILD wave-based execution
- `src/agents/index.ts` -- configHook pattern for injecting pipeline agents
- `src/tools/review.ts` -- reviewCore() for BUILD-phase review gate
- `src/review/pipeline.ts` -- advancePipeline() for multi-agent review
- `src/orchestrator/state.ts` -- appendDecision() for decision logging

### Established Patterns
- Tool registration: *Core + tool() wrapper
- Agent config: Readonly<AgentConfig> + Object.freeze()
- Config hook: mutate config.agent (src/agents/index.ts)
- Dispatch: tool returns {action, agent, prompt} JSON
- Atomic file writes: tmp + rename

### Integration Points
- `src/tools/orchestrate.ts` -- Major enhancement (per-phase handlers)
- `src/agents/index.ts` -- Register 9 new pipeline agents (8 phases + critic)
- `src/agents/pipeline/` -- New directory for pipeline agent definitions
- `src/orchestrator/schemas.ts` -- Extend state with phase artifact tracking

</code_context>

<specifics>
## Specific Ideas

- The hands-free orchestrator command is 2400+ lines of markdown. Phase 6 puts that logic in TypeScript (per-phase handler functions), keeping agent prompts lean.
- BUILD phase should call reviewCore() directly (typed function call), not dispatch oc_review as a separate tool call. This avoids the JSON serialization round-trip flagged in the Phase 5 architecture review.
- EXPLORE phase is optional per the state machine. Implementation can be deferred to Phase 7 if it's too complex. The shouldTriggerExplorer() function from arena.ts determines if it's needed.
- SHIP phase should produce markdown files (walkthrough, decisions, changelog) in .opencode-assets/phases/SHIP/, not JSON.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 06-orchestrator-pipeline*
*Context gathered: 2026-04-01*
