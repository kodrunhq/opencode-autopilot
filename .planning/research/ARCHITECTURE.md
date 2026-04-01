# Architecture Patterns

**Domain:** Autonomous SDLC orchestrator with embedded code review engine (OpenCode plugin)
**Researched:** 2026-03-31

## Recommended Architecture

The v2.0 architecture merges two distinct systems -- the hands-free orchestrator (state machine + subagent dispatch) and the ace review engine (phased review pipeline) -- into the existing opencode-autopilot plugin. The core design principle: **everything is a registered tool or config-hook-injected agent**, matching the existing plugin patterns exactly.

### High-Level Structure

```
src/
  index.ts                    Plugin entry (MODIFIED: register new tools)
  config.ts                   Plugin config (MODIFIED: add orchestrator settings)
  installer.ts                Asset installer (UNCHANGED)

  agents/                     Config-hook injected agents (MODIFIED: add 12+ new agents)
    index.ts                  Agent registry + configHook (MODIFIED)
    researcher.ts             (existing, unchanged)
    metaprompter.ts           (existing, unchanged)
    documenter.ts             (existing, unchanged)
    pr-reviewer.ts            (existing, unchanged)
    --- new orchestrator agents ---
    hf-researcher.ts          RECON phase researcher
    hf-challenge.ts           CHALLENGE phase enhancement proposer
    hf-proposer.ts            Architecture Arena proposer
    hf-critic.ts              Architecture Arena critic
    hf-planner.ts             PLAN phase task planner
    hf-implementer.ts         BUILD phase code writer
    hf-reviewer.ts            BUILD phase PR reviewer
    hf-mediator.ts            Dispute resolver
    hf-comparator.ts          EXPLORE phase branch comparator
    hf-qa.ts                  SHIP phase QA verifier
    hf-shipper.ts             SHIP phase release packager
    hf-retrospective.ts       RETROSPECTIVE phase learner
    --- new review agents ---
    ace-team-lead.ts          Review agent selector
    ace-logic-auditor.ts      Core review agent
    ace-test-interrogator.ts  Core review agent
    ace-contract-verifier.ts  Core review agent
    ace-security-auditor.ts   Parallel review specialist
    ace-code-quality.ts       Parallel review specialist
    (... additional ace specialists)

  tools/                      Registered tools (MODIFIED: add new tools)
    create-agent.ts           (existing, unchanged)
    create-skill.ts           (existing, unchanged)
    create-command.ts         (existing, unchanged)
    placeholder.ts            (existing, remove when orchestrator ready)
    --- new ---
    orchestrate.ts            oc_orchestrate: main state machine driver
    review.ts                 oc_review: standalone review pipeline
    state.ts                  oc_state: state read/update/patch
    confidence.ts             oc_confidence: ledger read/append/summary
    phase.ts                  oc_phase: phase transition
    plan.ts                   oc_plan: task index/wave query

  orchestrator/               NEW: State machine + pipeline logic
    state-machine.ts          Phase transition logic, valid transitions map
    phase-handlers.ts         Handler dispatch table (phase -> handler function)
    phases/
      recon.ts                RECON phase handler
      challenge.ts            CHALLENGE phase handler
      architect.ts            ARCHITECT phase handler (Arena)
      explore.ts              EXPLORE phase handler (Divergent Explorer)
      plan.ts                 PLAN phase handler
      build.ts                BUILD phase handler (wave executor)
      ship.ts                 SHIP phase handler
      retrospective.ts        RETROSPECTIVE phase handler

  review/                     NEW: Ace review engine
    pipeline.ts               Review pipeline orchestration
    team-selection.ts         Agent selection logic
    cross-verification.ts     Phase 2 cross-check logic
    fix-cycle.ts              Auto-fix + re-verify loop
    verdict.ts                Verdict computation
    agent-catalog.ts          Agent metadata registry

  state/                      NEW: State management (replaces hf-tools CJS CLI)
    state-store.ts            Read/write .hands-free/state.json
    confidence-ledger.ts      Read/append/summarize confidence entries
    decision-log.ts           Append decisions
    run-log.ts                Append run events
    metrics.ts                Timing + cost tracking

  templates/                  (existing + new)
    agent-template.ts         (existing, unchanged)
    skill-template.ts         (existing, unchanged)
    command-template.ts       (existing, unchanged)
    --- new ---
    state-template.ts         Initial state content
    review-finding.ts         Finding format template
    review-report.ts          Final report template

  utils/                      (existing + new)
    validators.ts             (existing, unchanged)
    paths.ts                  (existing, MODIFIED: add .hands-free paths)
    fs-helpers.ts             (existing, unchanged)
    --- new ---
    markdown-parser.ts        Parse markdown tables, extract fields
    slug.ts                   Text to URL-safe slug
    timestamp.ts              ISO 8601 timestamp helpers

  references/                 NEW: Embedded reference data
    severity-definitions.ts   Critical/Warning/Nitpick definitions
    agent-hard-gates.ts       Per-agent verification requirements
    stack-gate.ts             Stack-to-agent relevance mapping
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `index.ts` | Plugin entry, registers tools + config hook | tools/*, agents/index |
| `agents/index.ts` | Config hook: injects all agents into OpenCode config | All agent definition files |
| `tools/orchestrate.ts` | Entry point tool `oc_orchestrate` | orchestrator/state-machine |
| `tools/review.ts` | Entry point tool `oc_review` | review/pipeline |
| `tools/state.ts` | State query/mutation tool | state/state-store |
| `tools/confidence.ts` | Confidence ledger tool | state/confidence-ledger |
| `orchestrator/state-machine.ts` | Phase transitions, resume detection, circuit breakers | state/*, orchestrator/phases/* |
| `orchestrator/phases/*` | Individual phase execution logic | state/* |
| `review/pipeline.ts` | Review execution flow (selection -> parallel -> cross-verify -> fix) | review/*, state/* |
| `state/state-store.ts` | Atomic read/write of `.hands-free/state.json` | utils/fs-helpers |
| `state/confidence-ledger.ts` | Confidence tracking and aggregation | utils/markdown-parser |
| `config.ts` | Plugin configuration (autonomy, strictness, model routing) | state/state-store |

### Dependency Flow (strictly top-down, no cycles)

```
index.ts
  |
  +-- tools/*
  |     |
  |     +-- orchestrator/*  (orchestrate.ts only)
  |     +-- review/*        (review.ts only)
  |     +-- state/*         (state.ts, confidence.ts, phase.ts, plan.ts)
  |     +-- templates/*     (existing creation tools)
  |     +-- utils/*
  |
  +-- agents/index.ts       (config hook)
        |
        +-- agents/*.ts     (agent definitions: pure data, no logic)

orchestrator/*
  |
  +-- state/*               (read/write state, confidence, decisions)
  +-- review/*              (BUILD phase invokes review pipeline)
  +-- utils/*

review/*
  |
  +-- state/*               (write findings, read config)
  +-- references/*          (severity defs, hard gates, stack gate)
  +-- utils/*

state/*
  |
  +-- utils/*               (markdown parser, fs-helpers, paths)

templates/*
  |
  +-- Node built-ins + yaml

utils/*
  |
  +-- Node built-ins only
```

**Critical constraint:** `agents/*.ts` files are pure data (frozen AgentConfig objects with string prompts) with no imports from orchestrator/, review/, or state/. The orchestrator constructs dynamic prompts at runtime and dispatches agents by name.

### Data Flow

#### Orchestration Flow

```
User invokes oc_orchestrate("Build a task tracker app")
  |
  v
tools/orchestrate.ts
  |-- Calls orchestrator/state-machine.ts.run(idea)
  |
  v
state-machine.ts
  |-- Checks .hands-free/state.json (resume or fresh start)
  |-- If fresh: creates .hands-free/ directory structure + initial state
  |-- Reads currentPhase, dispatches to phase handler
  |
  v
phases/recon.ts (example phase)
  |-- Idempotency check: .hands-free/RECON/research.md exists?
  |-- Constructs prompt with idea + institutional memory
  |-- Returns { status: "dispatch", agent, prompt } to state-machine
  |
  v
state-machine.ts
  |-- Returns dispatch instruction to orchestrate.ts tool
  |
  v
tools/orchestrate.ts
  |-- Returns structured result to calling agent
  |-- Calling agent (orchestrator agent) dispatches hf-researcher via Agent tool
  |-- Calling agent re-invokes oc_orchestrate to advance state
  |
  v
Next phase...
```

**Key architectural insight:** The orchestrator tool cannot directly invoke subagents because tools in OpenCode run in a sandboxed context without Agent tool access. Only agents can spawn other agents. The solution:

1. A config-hook-injected `orchestrator` agent has `tools: Agent` permission
2. Its static prompt instructs it to: call `oc_orchestrate` -> read dispatch instructions -> dispatch the named subagent via Agent tool -> call `oc_orchestrate` again to advance
3. The tool is the brain (all state logic), the agent is the hands (agent dispatch)

This mirrors how hands-free works: the `hands-free.md` command IS an agent that calls `hf-tools.cjs` for every decision.

#### Review Pipeline Flow

```
oc_review invoked (standalone or from BUILD phase handler)
  |
  v
review/pipeline.ts
  |-- Gathers diff (via git commands in utils)
  |-- Detects stack (via file analysis in utils)
  |-- Loads project memory
  |
  v
review/team-selection.ts
  |-- Scores all agents against project + diff
  |-- Returns selected parallel + sequenced agent names
  |
  v
review/pipeline.ts
  |-- Returns list of dispatch instructions:
  |   { agents: ["ace-logic-auditor", "ace-security-auditor", ...],
  |     prompts: { "ace-logic-auditor": "...", ... },
  |     phase: "parallel-review" }
  |-- Caller dispatches all in parallel via Agent tool
  |-- Caller re-invokes oc_review with phase 1 findings
  |
  v
review/cross-verification.ts (Phase 2)
  |-- Creates cross-verification prompts per agent
  |-- Returns dispatch instructions for re-dispatch
  |
  v
review/fix-cycle.ts (Phase 5, if mode=fix)
  |-- Sorts findings by severity + domain priority
  |-- Returns fix instructions (which files, which edits)
  |-- Iterates up to 3 re-verify cycles
  |
  v
review/verdict.ts
  |-- Aggregates all findings
  |-- Computes verdict: CLEAN / APPROVED / CONCERNS / BLOCKED
  |-- Returns structured report
```

#### State Data Flow

```
.hands-free/                    Project-local working directory (.gitignored)
  state.json                    Current phase, status, timestamps (machine-readable)
  state.md                      Human-readable state view (generated from .json)
  confidence.json               Confidence ledger entries
  decision-log.md               All decisions with rationale (append-only)
  run-log.md                    Chronological event log (append-only)
  metrics.json                  Timing, PR counts, token estimates
  idea.md                       Original user input (immutable after creation)
  config.json                   Per-project config overrides
  RECON/research.md             Research output
  CHALLENGE/brief.md            Enhancement proposals
  CHALLENGE/backlog.md          Deferred items
  ARCHITECT/
    proposals/proposal-A.md     Arena proposals
    proposals/proposal-B.md
    critique.md                 Critic output
    debate.md                   Deliberation transcript
    architecture.md             Winning architecture
    stack.md                    Technology stack decisions
  EXPLORE/
    branch-a/                   Exploratory spike A
    branch-b/                   Exploratory spike B
    comparison.md               Comparison result
  PLAN/
    tasks.json                  Wave-grouped task list (machine-readable)
    tasks.md                    Human-readable task view
    dod.md                      Definition of Done
    verification-dimensions.md  QA verification criteria
  BUILD/
    {task-id}.md                Per-task implementation report
    {task-id}-rebuttal.md       Implementer rebuttals
  review/
    {task-id}-review.md         Review verdicts
  SHIP/                         Release artifacts
  RETROSPECTIVE/                Lessons learned

~/.config/opencode/             Global config (existing)
  opencode-autopilot.json          Plugin config (MODIFIED: add orchestrator settings)

~/.claude/hands-free-memory/    Institutional memory (cross-project)
  {domain}/                     Domain-specific lessons
```

**Design decision: JSON for machine state, Markdown for human artifacts.** The hands-free source uses markdown tables parsed with regex for ALL state -- fragile and error-prone. The TypeScript port uses JSON for anything the code reads/writes programmatically (`state.json`, `confidence.json`, `tasks.json`, `metrics.json`, `config.json`). Markdown is reserved for human-readable artifacts that agents produce and consume (research, architecture, reviews, decisions).

## Patterns to Follow

### Pattern 1: Tool-Returns-Instruction

**What:** Tools compute state and return structured instructions; agents execute them.
**When:** Whenever the orchestrator or review pipeline needs to dispatch a subagent.
**Why:** OpenCode tools cannot call the Agent tool directly. Only agents can spawn subagents.

```typescript
// tools/orchestrate.ts
interface OrchestrateResult {
  readonly status: "dispatch" | "complete" | "error";
  readonly agent?: string;
  readonly prompt?: string;
  readonly phase?: string;
  readonly progress?: string;
}

export async function orchestrateCore(
  args: { idea?: string; resume?: boolean },
  baseDir: string,
): Promise<OrchestrateResult> {
  const state = await loadState(baseDir);
  if (!state) {
    await initializeProject(args.idea!, baseDir);
    return reconHandler(baseDir);
  }
  const handler = phaseHandlers[state.currentPhase];
  return handler(state, baseDir);
}
```

### Pattern 2: Agent Definition as Pure Data

**What:** Agent definitions are readonly frozen objects with no runtime logic.
**When:** Every agent registered via config hook.
**Why:** Matches existing pattern in `agents/researcher.ts`. Keeps agent registry side-effect-free.

```typescript
// agents/hf-researcher.ts
import type { AgentConfig } from "@opencode-ai/sdk";

export const hfResearcherAgent: Readonly<AgentConfig> = Object.freeze({
  description: "Conducts domain research during RECON phase",
  mode: "subagent",
  prompt: `You are hf-researcher. Your job is to conduct exhaustive domain
research for a software product idea...

## Output Contract
Write your research to: .hands-free/RECON/research.md
...`,
  permission: {
    read: "allow",
    write: "allow",
    bash: "allow",
  },
});
```

### Pattern 3: Idempotent Phase Handlers

**What:** Every phase handler checks for existing artifacts before dispatching.
**When:** Every phase in the state machine.
**Why:** Enables resume after interruption. Prevents duplicate agent invocations.

```typescript
// orchestrator/phases/recon.ts
export async function handleRecon(
  state: PipelineState,
  baseDir: string,
): Promise<OrchestrateResult> {
  const researchPath = join(baseDir, ".hands-free/RECON/research.md");

  // Idempotency: if output exists, advance to next phase
  if (await fileExists(researchPath)) {
    const newState = await transitionPhase(state, "RECON", "CHALLENGE", baseDir);
    return handleChallenge(newState, baseDir);
  }

  const idea = await readFile(join(baseDir, ".hands-free/idea.md"), "utf-8");
  const memory = await getInstitutionalMemory("researcher", baseDir);

  return {
    status: "dispatch",
    agent: "hf-researcher",
    prompt: buildReconPrompt(idea, memory),
    phase: "RECON",
    progress: "Dispatching researcher for domain analysis",
  };
}
```

### Pattern 4: Immutable State Transitions

**What:** State updates create new state objects; file writes are atomic via write-rename.
**When:** Every state mutation in the pipeline.
**Why:** Matches project immutability constraint. Prevents corrupted state on crash.

```typescript
// state/state-store.ts
export async function transitionPhase(
  currentState: Readonly<PipelineState>,
  fromPhase: Phase,
  toPhase: Phase,
  baseDir: string,
): Promise<PipelineState> {
  if (!VALID_TRANSITIONS[fromPhase]?.includes(toPhase)) {
    throw new Error(`Invalid transition: ${fromPhase} -> ${toPhase}`);
  }

  const timestamp = new Date().toISOString();
  const newState: PipelineState = {
    ...currentState,
    currentPhase: toPhase,
    lastUpdatedAt: timestamp,
    phases: currentState.phases.map((p) =>
      p.name === fromPhase
        ? { ...p, status: "DONE" as const, completedAt: timestamp }
        : p.name === toPhase
          ? { ...p, status: "IN_PROGRESS" as const }
          : p,
    ),
  };

  await writeStateAtomic(newState, baseDir);
  return newState;
}
```

### Pattern 5: Confidence-Gated Depth

**What:** The confidence ledger controls pipeline depth (Arena proposals, critique rounds, Explorer trigger).
**When:** ARCHITECT phase (Arena depth) and post-Critic (Explorer trigger).
**Why:** Avoids wasting compute on well-understood problems while investing more on uncertain ones.

```typescript
// orchestrator/phases/architect.ts
function determineArenaDepth(
  confidenceSummary: ConfidenceSummary,
): { proposalCount: number; critiqueRounds: number } {
  switch (confidenceSummary.dominant) {
    case "HIGH":
      return { proposalCount: 2, critiqueRounds: 1 };
    case "MEDIUM":
    case "LOW":
    default:
      return { proposalCount: 3, critiqueRounds: 2 };
  }
}
```

### Pattern 6: Tool Registration Following Existing Convention

**What:** Each tool exports a `*Core` function (testable, accepts `baseDir`) and a `tool()` wrapper.
**When:** Every new tool.
**Why:** Matches the established pattern in `create-agent.ts` exactly.

```typescript
// tools/state.ts
export async function stateCore(
  args: { subcommand: string; field?: string; value?: string },
  baseDir: string,
): Promise<string> {
  // Pure logic, testable with temp directories
}

export const ocState = tool({
  description: "Read or update orchestrator pipeline state",
  args: { /* Zod schema */ },
  async execute(args) {
    return stateCore(args, getProjectDir());
  },
});
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Tool Calling Agent Tool

**What:** Trying to dispatch subagents from within a tool's `execute` function.
**Why bad:** OpenCode tools run in a sandboxed context. They do not have access to the Agent tool. Only agents can spawn other agents.
**Instead:** Return structured dispatch instructions from the tool. The orchestrator agent (injected via config hook) interprets and executes them.

### Anti-Pattern 2: Monolithic Orchestrator Prompt

**What:** Putting the entire 800-line hands-free.md orchestrator logic into a single agent prompt.
**Why bad:** Agent prompts via config hook are static strings set at plugin load time. The hands-free orchestrator needs dynamic context injection (idea content, research output, confidence scores) at each phase. A static mega-prompt with all 8 phase handlers wastes context and cannot adapt to runtime state.
**Instead:** Use a lean orchestrator agent prompt (~50 lines) that instructs the agent to call `oc_orchestrate` for every decision. The tool returns phase-specific context and dispatch instructions dynamically. The agent prompt is a loop: call tool -> dispatch agent -> call tool -> dispatch agent.

### Anti-Pattern 3: Markdown Files as Machine State

**What:** Parsing and writing markdown tables with regex for every state operation (the hf-tools CJS approach).
**Why bad:** Regex parsing of markdown tables is fragile -- whitespace, missing columns, and malformed rows cause silent data corruption. No type safety. No atomic writes. The CJS CLI approach exists because Claude Code commands cannot use native TypeScript modules or import npm packages.
**Instead:** Use JSON files for machine state (`state.json`, `confidence.json`, `tasks.json`). JSON.parse/stringify is deterministic, atomic write-rename is trivial, and Zod validates the schema. Generate markdown views for human readability as a separate (lossy) step.

### Anti-Pattern 4: Shell Scripts for Deterministic Logic

**What:** Using bash scripts for diff-scope, stack detection, change classification (the ace approach with `scripts/diff-scope.sh`, `scripts/detect-stack.sh`, etc.).
**Why bad:** In the plugin context, TypeScript functions are testable with `bun test`, type-safe, and do not require shell execution or path resolution. The ace scripts exist because Claude Code skills cannot bundle TypeScript modules -- they must use shell scripts and the Agent tool.
**Instead:** Port all deterministic logic (diff gathering, stack detection, change classification) to TypeScript functions in `utils/` or domain-specific modules. Run `git diff` via `node:child_process` when needed.

### Anti-Pattern 5: Global Mutable State via Config Mutation

**What:** Storing runtime orchestrator state (current phase, confidence scores) in the Config object that the config hook mutates.
**Why bad:** The config hook runs once at plugin load. It cannot track state changes during a session. Config mutation is reserved for agent registration.
**Instead:** Config hook injects agents only (static data). All runtime state lives in `.hands-free/state.json` managed by `state/state-store.ts`.

## Integration Points with Existing Code

### Modified Files (5 files)

| File | Change | Risk |
|------|--------|------|
| `src/index.ts` | Register 6 new tools in the `tool` object | LOW -- additive, no existing behavior changed |
| `src/agents/index.ts` | Import and register 15+ new agents in configHook | LOW -- same deep-copy pattern, more entries |
| `src/config.ts` | Extend pluginConfigSchema with v2 orchestrator settings | MEDIUM -- schema migration from version 1 to 2 |
| `src/utils/paths.ts` | Add `getHandsFreeDir()` and `getProjectRoot()` helpers | LOW -- additive exports |
| `package.json` | Add no new runtime deps (all Node built-ins) | LOW |

### Unchanged Files (8 files)

| File | Why Unchanged |
|------|---------------|
| `src/installer.ts` | Orchestrator state is project-local, not global assets |
| `src/tools/create-agent.ts` | v1 creation tooling preserved as-is |
| `src/tools/create-skill.ts` | v1 creation tooling preserved as-is |
| `src/tools/create-command.ts` | v1 creation tooling preserved as-is |
| `src/templates/agent-template.ts` | Existing template patterns unchanged |
| `src/templates/skill-template.ts` | Existing template patterns unchanged |
| `src/templates/command-template.ts` | Existing template patterns unchanged |
| `src/utils/fs-helpers.ts` | Existing helpers reused, not modified |

### New Directories (5 directories, ~40 files)

| Directory | Purpose | Estimated Files |
|-----------|---------|-----------------|
| `src/orchestrator/` | State machine + phase dispatch | 2 files |
| `src/orchestrator/phases/` | Individual phase handler modules | 8 files |
| `src/review/` | Ace review engine | 6 files |
| `src/state/` | State management layer | 5 files |
| `src/references/` | Embedded reference data | 3 files |

Plus ~18 new agent definition files in `src/agents/` and ~6 new tool files in `src/tools/`.

## Suggested Build Order

The build order respects the dependency flow (bottom-up) and provides testable increments at each step. Each layer can be fully tested before building the next.

### Layer 1: Foundation Utilities (no new dependencies)

**Build first -- everything else depends on these.**

1. `src/utils/markdown-parser.ts` -- Port hf-tools `core.cjs` markdown table parsing + field extraction to TypeScript
2. `src/utils/slug.ts` -- Port slug generation from core.cjs
3. `src/utils/timestamp.ts` -- Port timestamp formatting from core.cjs
4. `src/utils/paths.ts` (modification) -- Add `getHandsFreeDir()`, `getProjectRoot()`

**Test gate:** Unit tests for each utility. Pure functions, zero side effects.

### Layer 2: State Management (depends on Layer 1)

**Build second -- orchestrator and review engine both need persistent state.**

5. `src/state/state-store.ts` -- Read/write pipeline state as JSON with atomic write-rename
6. `src/state/confidence-ledger.ts` -- Confidence tracking, aggregation, phase filtering
7. `src/state/decision-log.ts` -- Append-only decision logging to markdown
8. `src/state/run-log.ts` -- Append-only event logging
9. `src/state/metrics.ts` -- Timing, PR counts, token/cost estimates

**Test gate:** Integration tests with temp directories. Verify atomic writes, resume detection, confidence math.

### Layer 3: State Tools (depends on Layer 2)

**Build third -- exposes state management as registered OpenCode tools.**

10. `src/tools/state.ts` -- `oc_state` tool (load, get, update, patch)
11. `src/tools/confidence.ts` -- `oc_confidence` tool (read, append, summary)
12. `src/tools/phase.ts` -- `oc_phase` tool (complete, status)
13. `src/tools/plan.ts` -- `oc_plan` tool (index, wave-group)

**Test gate:** Tool unit tests following create-agent.ts pattern (`*Core` function + tool wrapper).

### Layer 4: Review Engine Core (depends on Layers 1-2)

**Build fourth -- needed by BUILD phase, also usable standalone.**

14. `src/references/severity-definitions.ts` -- Severity level data
15. `src/references/agent-hard-gates.ts` -- Per-agent verification requirements
16. `src/references/stack-gate.ts` -- Stack-to-agent relevance mapping
17. `src/review/agent-catalog.ts` -- Agent metadata registry
18. `src/review/team-selection.ts` -- Agent scoring and selection logic
19. `src/review/cross-verification.ts` -- Phase 2 cross-check prompt generation
20. `src/review/fix-cycle.ts` -- Auto-fix + re-verify loop logic
21. `src/review/verdict.ts` -- Verdict computation (CLEAN/APPROVED/CONCERNS/BLOCKED)
22. `src/review/pipeline.ts` -- Review pipeline orchestration

**Test gate:** Unit tests for selection logic, verdict computation, severity sorting. Integration tests for pipeline dispatch instruction generation.

### Layer 5: Review Tool + Agents (depends on Layer 4)

**Build fifth -- standalone review capability is usable before orchestrator.**

23. `src/tools/review.ts` -- `oc_review` tool
24. `src/agents/ace-team-lead.ts` -- Team lead agent definition
25. `src/agents/ace-logic-auditor.ts` -- Core squad agent
26. `src/agents/ace-test-interrogator.ts` -- Core squad agent
27. `src/agents/ace-contract-verifier.ts` -- Core squad agent
28. `src/agents/ace-*.ts` -- Remaining review specialist agents (batch: security-auditor, code-quality, dead-code-scanner, wiring-inspector, type-soundness, database-auditor, auth-flow-verifier, state-mgmt-auditor, concurrency-checker, scope-intent-verifier, spec-checker, product-thinker, red-team)

**Test gate:** Review pipeline end-to-end test: given a diff, produces correct team selection and dispatch instructions.

### Layer 6: Orchestrator State Machine (depends on Layers 2-3)

**Build sixth -- the core state machine without phase implementations.**

29. `src/orchestrator/state-machine.ts` -- Phase transitions, resume detection, circuit breakers, valid transition map
30. `src/orchestrator/phase-handlers.ts` -- Handler dispatch table mapping Phase -> handler function
31. `src/templates/state-template.ts` -- Initial state.json content factory

**Test gate:** State machine unit tests covering: fresh start, resume from each phase, invalid transition rejection, circuit breaker at 3 attempts, idempotent re-entry.

### Layer 7: Phase Handlers (depends on Layers 2, 4, 6)

**Build seventh -- individual phase implementations. Order follows pipeline sequence.**

32. `src/orchestrator/phases/recon.ts`
33. `src/orchestrator/phases/challenge.ts`
34. `src/orchestrator/phases/architect.ts` (includes Arena depth logic, proposer/critic dispatch)
35. `src/orchestrator/phases/explore.ts` (includes Divergent Explorer, branch comparison)
36. `src/orchestrator/phases/plan.ts` (includes scope fidelity check)
37. `src/orchestrator/phases/build.ts` (depends on `review/pipeline.ts` for PR review integration)
38. `src/orchestrator/phases/ship.ts` (depends on QA verification)
39. `src/orchestrator/phases/retrospective.ts` (includes institutional memory writes)

**Test gate:** Per-phase unit tests with mocked state and agent responses. Verify idempotency, correct dispatch instructions, state transitions.

### Layer 8: Orchestrator Agents + Tool (depends on Layers 6-7)

**Build eighth -- the orchestrator's own subagents and entry tool.**

40. `src/agents/hf-researcher.ts` through `src/agents/hf-retrospective.ts` (12 agent definitions)
41. `src/tools/orchestrate.ts` -- `oc_orchestrate` tool (the main entry point)

**Test gate:** Full integration test: `orchestrateCore` returns correct dispatch instruction for each phase with mocked filesystem.

### Layer 9: Registration + Config (depends on all above)

**Build last -- ties everything together.**

42. `src/agents/index.ts` (modification) -- Import and register all 15+ new agents in configHook
43. `src/config.ts` (modification) -- Extend schema to version 2 with orchestrator settings (autonomy level, review strictness, model routing, phase toggles)
44. `src/index.ts` (modification) -- Register all 6 new tools

**Test gate:** Plugin load test: all tools registered, all agents injected via config hook, config schema validates both v1 and v2.

### Build Order Rationale

- **Bottom-up construction:** Each layer depends only on layers below it. No forward references or circular dependencies.
- **Testable at every layer:** Each layer has clear test gates before proceeding. Catching bugs in the foundation prevents cascade failures.
- **Review engine before orchestrator:** The review engine is simpler (stateless pipeline, no state machine), independently useful (standalone `/review` command), and required by the BUILD phase handler. Building it first delivers value early.
- **State management as shared foundation:** Both orchestrator and review need to read/write state. Centralizing it in Layer 2 prevents duplication and ensures consistent atomic write patterns.
- **Agents last:** Agent definitions are pure data objects with string prompts. They have zero runtime logic and can be written at any point, but registering them in the config hook should happen after the tools they interact with are tested and stable.
- **Config migration last:** Extending the config schema is a breaking change that should happen only after all components are proven to work individually.

## Scalability Considerations

| Concern | Single Project | 10 Concurrent Projects | Notes |
|---------|---------------|----------------------|-------|
| State isolation | `.hands-free/` per project | Each project has own state dir | No conflict -- state is project-local |
| Agent count in config | 20+ agents registered | Same 20+ agents | Agents registered once globally via config hook |
| Review parallelism | 10-20 agents per review | Same per review | Bounded by OpenCode Agent tool concurrency |
| Memory usage | JSON state loaded on demand | One orchestration at a time | OpenCode is single-session; no multi-project concern |
| Institutional memory | `~/.claude/hands-free-memory/` | Shared across projects | Cross-project learning is intentional |
| Config schema | v2 schema | Same | Backward-compatible migration from v1 |

## Sources

- hands-free orchestrator command: `/home/joseibanez/develop/projects/claude-hands-free/commands/hands-free.md` -- 800+ line state machine with 8 phases, Arena, Divergent Explorer (HIGH confidence: direct source analysis)
- hands-free deterministic tools: `/home/joseibanez/develop/projects/claude-hands-free/bin/hf-tools.cjs` + `bin/lib/*.cjs` -- 13 CJS modules for state, config, confidence, phase, plan, arena, commit, validate (HIGH confidence: direct source analysis)
- hands-free agents: `/home/joseibanez/develop/projects/claude-hands-free/agents/*.md` -- 12 specialized agents with output contracts and behavioral rules (HIGH confidence: direct source analysis)
- hands-free hooks: `/home/joseibanez/develop/projects/claude-hands-free/hooks/hooks.json` -- SessionStart resume, PreCompact checkpoint, Stop recovery (HIGH confidence: direct source analysis)
- ace review skill: `/home/joseibanez/develop/projects/claude-ace/skills/ace-full/SKILL.md` -- 7-phase review pipeline with team selection, parallel dispatch, cross-verification, auto-fix (HIGH confidence: direct source analysis)
- ace orchestrator agent: `/home/joseibanez/develop/projects/claude-ace/agents/orchestrator.md` -- Programmatic dispatch for review-gateway (HIGH confidence: direct source analysis)
- ace agent catalog: `/home/joseibanez/develop/projects/claude-ace/references/agent-catalog.md` -- 16 parallel specialists + 2 sequenced + 3 core squad (HIGH confidence: direct source analysis)
- ace severity definitions: `/home/joseibanez/develop/projects/claude-ace/references/severity-definitions.md` -- Critical/Warning/Nitpick (HIGH confidence: direct source analysis)
- existing plugin architecture: `/home/joseibanez/develop/projects/opencode-autopilot/src/` -- Current tool registration, config hook, agent definitions (HIGH confidence: direct source analysis)
- OpenCode plugin API: `@opencode-ai/plugin` dist/index.d.ts -- Hooks interface with tool, config, event, chat.message, chat.params hooks (HIGH confidence: direct type analysis)
- Tool-returns-instruction pattern: MEDIUM confidence -- this is the logical design given OpenCode's constraints, but untested in this plugin context. May need adjustment based on how OpenCode handles agent dispatch from tool responses.
