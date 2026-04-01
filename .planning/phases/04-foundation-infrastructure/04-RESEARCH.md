# Phase 4: Foundation Infrastructure - Research

**Researched:** 2026-03-31
**Domain:** State management, confidence tracking, config extension, phase transitions, plan indexing, arena depth, agent dispatch validation -- all as TypeScript modules for an OpenCode plugin
**Confidence:** HIGH

## Summary

Phase 4 builds the deterministic TypeScript infrastructure layer that the orchestrator pipeline (Phase 6) and review engine (Phase 5) will depend on. The work involves creating six new modules (state, confidence, phase, plan, arena, config v2), exposing them as registered OpenCode tools (`oc_state`, `oc_confidence`, `oc_phase`, `oc_plan`, `oc_orchestrate`), injecting an orchestrator agent via the config hook, and proving the tool-returns-instruction dispatch pattern end-to-end.

The existing codebase provides clear, well-tested patterns to follow: `*Core` function + `tool()` wrapper for tool registration, `Object.freeze()` + `Readonly<T>` for immutability, Zod schemas for validation, `node:fs/promises` for all I/O, and config hook mutation for agent injection. The reference implementations in claude-hands-free's CJS modules (state.cjs, confidence.cjs, phase.cjs, plan.cjs, arena.cjs, config.cjs) provide the logic to port -- rewritten from scratch in TypeScript using JSON+Zod instead of regex-parsed markdown.

**Primary recommendation:** Build bottom-up (state store -> modules -> tools -> orchestrator agent -> dispatch proof), testing each layer before proceeding. The dispatch validation (D-06) is the hard gate -- build everything else first, then prove the full loop.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Single JSON file (`state.json`) with full pipeline state: current phase, phase history, decisions array, confidence entries array. Zod schema validates on every read.
- D-02: State file lives at `.opencode-autopilot/state.json` in the project root.
- D-03: State module provides: load, update, get, patch, and phase transition functions. All return Zod-validated typed objects. Failed validation throws (fail-fast).
- D-04: Tool-returns-instruction pattern. `oc_orchestrate` returns structured JSON: `{action: 'dispatch', agent: 'researcher', prompt: '...'}` or `{action: 'complete'}`.
- D-05: Orchestrator agent (injected via config hook, mode: subagent) has lean prompt: "call oc_orchestrate, parse JSON, dispatch named agent via Agent tool, repeat until complete." All state machine logic lives in TypeScript.
- D-06: Phase 4 must prove a FULL LOOP end-to-end. Hard gate -- architecture changes before Phase 5 if it fails.
- D-07: Version bump from 1 to 2. New schema includes orchestrator, review, confidence namespaces with Zod sub-schemas.
- D-08: Migration function auto-upgrades v1 configs on load.
- D-09: `.opencode-autopilot/` in project root for artifacts. Structure: `state.json`, `phases/RECON/`, etc.
- D-10: Add `.opencode-autopilot/` to `.gitignore` automatically on first run.
- D-11: Decisions are entries in the `decisions` array inside `state.json`. Each: `{timestamp, phase, agent, decision, rationale}`.
- D-12: Confidence entries in `confidence` array inside `state.json`. Each: `{timestamp, phase, agent, area, level: HIGH|MEDIUM|LOW, rationale}`.
- D-13: Phase module validates transitions against allowed state machine graph (RECON -> CHALLENGE -> ARCHITECT -> EXPLORE -> PLAN -> BUILD -> SHIP -> RETROSPECTIVE). Invalid transitions throw.
- D-14: Plan module indexes task lists from structured JSON format (not markdown parsing). Wave grouping assigns wave numbers to tasks based on dependency analysis.
- D-15: Arena module determines debate depth based on aggregate confidence from ARCHITECT phase. Low confidence -> 3 proposals. High confidence -> 1 proposal (no debate).
- D-16: `node:fs/promises` for all file I/O.
- D-17: Zod for all schema validation.
- D-18: `Object.freeze()` + `Readonly<T>` for immutable configs.
- D-19: Tool registration: each tool exports a `*Core` function (testable, accepts paths) and a `tool()` wrapper.

### Claude's Discretion
- Internal TypeScript module structure (how to organize the 6 TOOL-* modules under src/)
- Zod schema field names and nesting depth within state.json
- Whether to use mitt event bus in Phase 4 or defer to Phase 6
- The exact Zod sub-schema field names for orchestrator/review/confidence config namespaces
- Test structure and organization for the new modules

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORCH-02 | Orchestrator persists state to JSON so interrupted runs resume from last completed phase | State store module with Zod-validated JSON, phase status tracking, idempotent resume via artifact existence check |
| ORCH-03 | Every autonomous decision logged with timestamp, phase, agent, decision, rationale | Decisions array in state.json, appendDecision() function, exposed via oc_state tool |
| ORCH-04 | User can configure orchestrator settings via plugin config schema | Config v2 schema with orchestrator/review/confidence namespaces, v1->v2 migration |
| ORCH-05 | Confidence ledger tracks agent decisions as HIGH/MEDIUM/LOW with rationale | Confidence array in state.json, append/summarize/filter functions, exposed via oc_confidence tool |
| TOOL-01 | State management module: load, update, get, patch, phase transitions with Zod | State store module pattern from hands-free state.cjs, ported to JSON+Zod |
| TOOL-02 | Config module extends pluginConfigSchema with orchestrator and review settings | Extend existing config.ts with v2 schema, migration function, new namespaces |
| TOOL-03 | Confidence module: read, append, summarize, filter by phase | Confidence functions from hands-free confidence.cjs, ported to typed TypeScript |
| TOOL-04 | Phase module: track completion status, validate transitions | Phase transition map from hands-free phase.cjs, ported with discriminated union types |
| TOOL-05 | Plan module: index task lists, group into dependency waves | Plan parsing from hands-free plan.cjs, ported to JSON-based task format |
| TOOL-06 | Arena module: determine debate depth, trigger explorer based on confidence | Arena depth map from hands-free arena.cjs, ported with confidence ledger integration |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Runtime:** Bun only -- plugins run inside the OpenCode process via Bun
- **No standalone Zod install:** Use `import { z } from "zod"` (transitive dep of `@opencode-ai/plugin`)
- **No `Bun.file()`/`Bun.write()`:** Use `node:fs/promises` for portability and testability
- **Model agnostic:** Never hardcode model identifiers in bundled agents
- **Global target for assets:** `~/.config/opencode/` (but orchestrator artifacts go to project-local `.opencode-autopilot/`)
- **`oc_` prefix:** All plugin tool names must start with `oc_`
- **Immutability:** Build objects declaratively with conditional spreads, never mutate after creation
- **Tool registration pattern:** `*Core` function (testable, accepts `baseDir`) + `tool()` wrapper
- **Atomic file writes:** Use `writeFile(path, content, { flag: "wx" })` for no-clobber or write-temp+rename for updates
- **Biome:** Lint and format with `bun run lint` / `bun run format`
- **Tests:** `bun test` with bun:test (Jest-compatible)

## Standard Stack

### Core (already installed, no new deps needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bun | 1.2.x+ | Runtime, test runner | Project runtime |
| TypeScript | 5.8.x (via Bun) | Language | Project language |
| @opencode-ai/plugin | ^1.3.8 | Tool registration, config hook, event hooks | Plugin SDK |
| Zod | transitive via plugin | Schema validation for state, config, all data | Project constraint |
| node:fs/promises | built-in | All file I/O | Project constraint (no Bun.file) |
| node:path, node:os | built-in | Path manipulation, homedir | Project standard |
| bun:test | built-in | Test runner | Project standard |

### Phase 4 Specific (zero new dependencies)

| Module | Purpose | Implementation Pattern |
|--------|---------|----------------------|
| src/orchestrator/state.ts | State store: load/save/patch state.json | Extend config.ts pattern with Zod + atomic writes |
| src/orchestrator/confidence.ts | Confidence ledger: append/summarize/filter | Port confidence.cjs logic to typed TS |
| src/orchestrator/phase.ts | Phase transitions: validate + advance | Port phase.cjs with transition map |
| src/orchestrator/plan.ts | Task indexing and wave grouping | Port plan.cjs from JSON (not markdown) |
| src/orchestrator/arena.ts | Debate depth from confidence | Port arena.cjs depth map |
| src/config.ts (modified) | Config v2 with orchestrator namespaces | Extend existing schema with migration |

### Decision: Defer mitt to Phase 6

mitt (200B event bus) is useful for lifecycle events but not required by any Phase 4 requirement. The six foundation modules communicate through direct function calls and shared state.json. Deferring mitt avoids adding a dependency before it has a consumer. Phase 6 (pipeline phases) introduces the event-driven patterns that justify mitt.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single state.json | Separate files per concern (state.json, confidence.json, decisions.json) | Single file is simpler for atomic updates, avoids partial-write inconsistency. D-01 locks this. |
| JSON + Zod | bun:sqlite | Overkill for ~8 writes per run. JSON matches existing config.ts pattern exactly. |
| Hand-rolled FSM | XState v5 | 8-phase linear pipeline doesn't need statecharts. Custom transition map is ~30 lines. |
| Write-temp+rename | writeFileSync | Async is fine; single-writer (no concurrency in plugin context). Temp+rename prevents corruption on crash. |

## Architecture Patterns

### Recommended Module Structure

```
src/
  orchestrator/              NEW: Foundation infrastructure modules
    state.ts                 State store: loadState, saveState, patchState, appendDecision
    confidence.ts            Confidence: appendEntry, summarize, filterByPhase
    phase.ts                 Phase transitions: validateTransition, completePhase, getStatus
    plan.ts                  Plan: indexTasks, groupByWave, countByStatus
    arena.ts                 Arena: getDepth, shouldTriggerExplore
    schemas.ts               Zod schemas for state.json, confidence entries, decisions, tasks
    types.ts                 TypeScript types derived from Zod schemas (z.infer<>)
  tools/                     NEW tools alongside existing ones
    orchestrate.ts           oc_orchestrate: main dispatch driver (TOOL-returns-instruction)
    state.ts                 oc_state: state read/update/patch
    confidence.ts            oc_confidence: ledger read/append/summary
    phase.ts                 oc_phase: phase transition + status
    plan.ts                  oc_plan: task index/wave query
  agents/
    index.ts                 MODIFIED: add orchestrator agent to configHook
    orchestrator.ts          NEW: orchestrator agent definition (lean prompt, mode: subagent)
  config.ts                  MODIFIED: v1->v2 schema migration
  utils/
    paths.ts                 MODIFIED: add getProjectArtifactDir()
```

**Rationale for `src/orchestrator/` directory:** All six TOOL-* modules share the same state.json and Zod schemas. Grouping them under `orchestrator/` keeps imports short and makes the dependency boundary clear. The `tools/` directory stays thin -- each tool file just calls the corresponding `orchestrator/` function.

### Pattern 1: State Store (JSON + Zod + Atomic Write)

**What:** A single module handles all reads/writes to `.opencode-autopilot/state.json` with Zod validation on every load and atomic write-temp-rename on every save.

**When to use:** Any state mutation in the pipeline.

**Example:**
```typescript
// src/orchestrator/state.ts
import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { ensureDir, isEnoentError } from "../utils/fs-helpers";

// Schema defined in schemas.ts, imported here
import { pipelineStateSchema, type PipelineState } from "./schemas";

export async function loadState(artifactDir: string): Promise<PipelineState | null> {
  const statePath = join(artifactDir, "state.json");
  try {
    const raw = await readFile(statePath, "utf-8");
    const parsed = JSON.parse(raw);
    return pipelineStateSchema.parse(parsed);
  } catch (error: unknown) {
    if (isEnoentError(error)) return null;
    throw error;
  }
}

export async function saveState(
  state: PipelineState,
  artifactDir: string,
): Promise<void> {
  const validated = pipelineStateSchema.parse(state);
  const statePath = join(artifactDir, "state.json");
  const tmpPath = `${statePath}.tmp.${Date.now()}`;
  await ensureDir(artifactDir);
  await writeFile(tmpPath, JSON.stringify(validated, null, 2), "utf-8");
  await rename(tmpPath, statePath);
}

export function patchState(
  current: Readonly<PipelineState>,
  updates: Partial<PipelineState>,
): PipelineState {
  return {
    ...current,
    ...updates,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function appendDecision(
  current: Readonly<PipelineState>,
  decision: { phase: string; agent: string; decision: string; rationale: string },
): PipelineState {
  return {
    ...current,
    decisions: [
      ...current.decisions,
      { ...decision, timestamp: new Date().toISOString() },
    ],
    lastUpdatedAt: new Date().toISOString(),
  };
}
```

### Pattern 2: Tool-Returns-Instruction for Agent Dispatch

**What:** The `oc_orchestrate` tool reads state, determines the next action, and returns structured JSON. The orchestrator agent parses this and dispatches the named subagent. This is the core dispatch pattern (D-04).

**When to use:** Every orchestrator tool invocation.

**Example:**
```typescript
// src/tools/orchestrate.ts
import { tool } from "@opencode-ai/plugin";
import { loadState, saveState, patchState } from "../orchestrator/state";
import { getNextAction } from "../orchestrator/phase";

const orchestrateResultSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("dispatch"),
    agent: z.string(),
    prompt: z.string(),
    phase: z.string(),
    progress: z.string(),
  }),
  z.object({
    action: z.literal("complete"),
    summary: z.string(),
  }),
  z.object({
    action: z.literal("error"),
    message: z.string(),
  }),
]);

export async function orchestrateCore(
  args: { idea?: string; result?: string },
  artifactDir: string,
): Promise<string> {
  const state = await loadState(artifactDir);

  if (!state && !args.idea) {
    return JSON.stringify({ action: "error", message: "No active run. Provide an idea to start." });
  }

  if (!state && args.idea) {
    // Initialize new run
    const initial = createInitialState(args.idea);
    await saveState(initial, artifactDir);
    return JSON.stringify({
      action: "dispatch",
      agent: "oc-researcher",
      prompt: `Research the following idea: ${args.idea}`,
      phase: "RECON",
      progress: "Starting new orchestration run",
    });
  }

  // Advance based on current state
  const nextAction = getNextAction(state!, args.result);
  if (nextAction.action === "dispatch") {
    const updated = patchState(state!, { lastUpdatedAt: new Date().toISOString() });
    await saveState(updated, artifactDir);
  }
  return JSON.stringify(nextAction);
}

export const ocOrchestrate = tool({
  description: "Drive the orchestrator pipeline. Returns JSON instructions for agent dispatch.",
  args: {
    idea: tool.schema.string().optional().describe("Initial idea to start a new orchestration run"),
    result: tool.schema.string().optional().describe("Result from the last dispatched agent"),
  },
  async execute(args) {
    const artifactDir = join(process.cwd(), ".opencode-autopilot");
    return orchestrateCore(args, artifactDir);
  },
});
```

### Pattern 3: Orchestrator Agent (Lean Prompt)

**What:** The orchestrator agent is injected via config hook with a minimal prompt (~60 lines) that instructs it to loop: call oc_orchestrate -> parse JSON -> dispatch agent -> repeat.

**When to use:** Single orchestrator agent definition.

**Example:**
```typescript
// src/agents/orchestrator.ts
import type { AgentConfig } from "@opencode-ai/sdk";

export const orchestratorAgent: Readonly<AgentConfig> = Object.freeze({
  description: "Autonomous pipeline orchestrator. Drives ideas through 8 phases to completion.",
  mode: "subagent",
  prompt: `You are the orchestrator agent. Your job is to drive an idea through an 8-phase pipeline to completion.

## How You Work

1. Call the oc_orchestrate tool to get your next instruction
2. Parse the JSON response
3. If action is "dispatch": invoke the named agent using the Agent tool with the provided prompt
4. After the agent completes, call oc_orchestrate again with the result
5. Repeat until action is "complete"

## Rules

- NEVER skip calling oc_orchestrate. It is the brain -- you are the hands.
- NEVER make pipeline decisions yourself. The tool handles all state logic.
- ALWAYS pass agent results back to oc_orchestrate so it can advance state.
- If action is "error", report the error message to the user and stop.

## Loop Pattern

\`\`\`
result = call oc_orchestrate(idea="user's idea")
while result.action == "dispatch":
  agent_output = call Agent(name=result.agent, prompt=result.prompt)
  result = call oc_orchestrate(result=agent_output)
report result.summary
\`\`\``,
  permission: {
    edit: "allow",
    bash: "allow",
    webfetch: "allow",
  },
});
```

### Pattern 4: Config v1 to v2 Migration

**What:** Extend `pluginConfigSchema` from version 1 to version 2, adding orchestrator/review/confidence namespaces with defaults, and a migration function that auto-upgrades v1 configs on load.

**When to use:** Config load path.

**Example:**
```typescript
// src/config.ts (extended)
const orchestratorConfigSchema = z.object({
  autonomy: z.enum(["full", "supervised", "manual"]).default("full"),
  strictness: z.enum(["strict", "normal", "lenient"]).default("normal"),
  phases: z.object({
    recon: z.boolean().default(true),
    challenge: z.boolean().default(true),
    architect: z.boolean().default(true),
    explore: z.boolean().default(true),
    plan: z.boolean().default(true),
    build: z.boolean().default(true),
    ship: z.boolean().default(true),
    retrospective: z.boolean().default(true),
  }).default({}),
});

const confidenceConfigSchema = z.object({
  enabled: z.boolean().default(true),
  thresholds: z.object({
    proceed: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
    abort: z.enum(["HIGH", "MEDIUM", "LOW"]).default("LOW"),
  }).default({}),
});

const pluginConfigSchemaV2 = z.object({
  version: z.literal(2),
  configured: z.boolean(),
  models: z.record(z.string(), z.string()),
  orchestrator: orchestratorConfigSchema.default({}),
  confidence: confidenceConfigSchema.default({}),
});

// Migration: v1 -> v2
function migrateV1toV2(v1: PluginConfigV1): PluginConfigV2 {
  return {
    ...v1,
    version: 2 as const,
    orchestrator: orchestratorConfigSchema.parse({}),
    confidence: confidenceConfigSchema.parse({}),
  };
}
```

### Pattern 5: Phase Transition Validation

**What:** A const transition map defines valid phase progressions. The transition function validates against this map and throws on invalid transitions.

```typescript
// src/orchestrator/phase.ts
const PHASES = [
  "RECON", "CHALLENGE", "ARCHITECT", "EXPLORE",
  "PLAN", "BUILD", "SHIP", "RETROSPECTIVE",
] as const;

type Phase = typeof PHASES[number];

const VALID_TRANSITIONS: Readonly<Record<Phase, Phase | null>> = {
  RECON: "CHALLENGE",
  CHALLENGE: "ARCHITECT",
  ARCHITECT: "EXPLORE",
  EXPLORE: "PLAN",
  PLAN: "BUILD",
  BUILD: "SHIP",
  SHIP: "RETROSPECTIVE",
  RETROSPECTIVE: null,
};

export function validateTransition(from: Phase, to: Phase): void {
  const expected = VALID_TRANSITIONS[from];
  if (expected !== to) {
    throw new Error(`Invalid phase transition: ${from} -> ${to}. Expected: ${from} -> ${expected ?? "END"}`);
  }
}
```

### Anti-Patterns to Avoid

- **Markdown-as-state:** Do NOT use markdown tables or regex parsing for machine state (the hands-free CJS approach). Use JSON + Zod. Markdown is for human-readable artifacts only.
- **Monolithic orchestrator prompt:** Do NOT put state machine logic in the agent prompt. Keep it under 100 lines. All intelligence lives in TypeScript tool code.
- **Mutating state objects:** ALWAYS create new state objects with spread. Never `state.currentPhase = "BUILD"`.
- **Synchronous file I/O:** Use async `node:fs/promises` consistently. No `fs.readFileSync` (the hands-free CJS pattern exists because CJS tools needed synchronous determinism; the plugin context is async-safe).
- **Hard-coded project paths:** Always accept `artifactDir` / `baseDir` as a parameter for testability. Use `process.cwd()` only in the thin `tool()` wrapper.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema validation | Custom type checking | Zod schemas with `.parse()` | Already available, type inference, detailed errors |
| Atomic file writes | Custom lock files | Write-to-temp + `rename()` | Atomic on POSIX, no lock file cleanup needed |
| Config migration | Manual field checking | Zod `.default()` + migration function | Defaults handle missing fields; migration handles version bump |
| Phase name validation | String comparison | `z.enum(PHASES)` | Compile-time + runtime safety in one |
| Directory creation | Manual mkdir chains | `ensureDir()` from existing `fs-helpers.ts` | Already tested, handles recursive creation |

**Key insight:** Phase 4 adds zero new runtime dependencies. Every capability is built from existing project patterns (Zod, node:fs, ensureDir) and pure TypeScript logic ported from the hands-free CJS modules.

## Common Pitfalls

### Pitfall 1: State File Corruption on Concurrent Access

**What goes wrong:** If the orchestrator agent dispatches a subagent that also calls `oc_state` or `oc_orchestrate`, two writers can race on state.json.
**Why it happens:** OpenCode agents run in the same process. A subagent calling a state tool while the orchestrator is mid-save creates a read-modify-write race.
**How to avoid:** Use write-temp-rename for atomicity. The pipeline is designed as single-threaded (one phase at a time), so concurrent access should not occur by design. Add a runtime check: if the orchestrator detects a subagent trying to write state, return an error.
**Warning signs:** State.json contains stale phase data after a run, or decisions array has missing entries.

### Pitfall 2: Config Migration Breaks Existing v1 Users

**What goes wrong:** Existing users have `opencode-autopilot.json` with `version: 1`. If the v2 schema rejects v1 format, the plugin fails to load.
**Why it happens:** `pluginConfigSchema.parse()` is called on every plugin load. If it only accepts v2, existing configs throw.
**How to avoid:** Use a version-discriminated union: try v2 parse first, fall back to v1 parse + migration. Save the migrated v2 config back to disk. Test with fixture v1 configs.
**Warning signs:** Plugin crashes on load for existing users after upgrade.

### Pitfall 3: Tool-Returns-Instruction Pattern Fails in OpenCode

**What goes wrong:** The orchestrator agent receives JSON from oc_orchestrate but cannot dispatch the named agent because OpenCode's Agent tool does not work as expected (different API, different permission model, or subagents cannot call tools).
**Why it happens:** The tool-returns-instruction pattern (D-04) is an architectural hypothesis. It has not been validated in the OpenCode plugin context.
**How to avoid:** Build the dispatch proof (D-06) early. Start with a minimal two-agent loop: orchestrator calls oc_orchestrate -> tool returns dispatch for a dummy agent -> orchestrator dispatches dummy agent -> dummy agent writes a file -> orchestrator calls oc_orchestrate again -> tool detects file and returns complete. If this fails, the architecture must change before Phase 5.
**Warning signs:** Agent tool invocation from orchestrator agent returns errors, or subagent output is not accessible to the parent agent.

### Pitfall 4: Zod Schema Too Strict Rejects Partially-Written State

**What goes wrong:** After a crash mid-pipeline, state.json has valid JSON but may be missing fields that later phases populate (e.g., `confidence` array is empty, `phases` array has incomplete entries). Strict Zod parsing rejects this as invalid.
**Why it happens:** Zod schemas with required fields reject partial states. The hands-free CJS approach used lenient regex parsing that silently defaulted missing fields.
**How to avoid:** Use `.default([])` for arrays, `.optional()` for fields populated by later phases, and `.catch()` for graceful degradation. The schema should accept the state at any point in the pipeline, not just after completion.
**Warning signs:** `loadState()` throws on a state.json that was valid when written.

### Pitfall 5: `.opencode-autopilot/` Not Added to .gitignore

**What goes wrong:** Users commit their pipeline state, confidence ledger, and intermediate artifacts to version control.
**Why it happens:** The auto-gitignore logic (D-10) is easy to forget or implement incorrectly (e.g., file already has content but no `.opencode-autopilot/` entry, or `.gitignore` doesn't exist).
**How to avoid:** Implement gitignore-appending in the state initialization path. Check if `.opencode-autopilot/` is already in any `.gitignore` in the project hierarchy before appending.
**Warning signs:** `git status` shows `.opencode-autopilot/` as untracked after first run.

## Code Examples

### Complete State Schema (Zod)

```typescript
// src/orchestrator/schemas.ts
import { z } from "zod";

export const PHASES = [
  "RECON", "CHALLENGE", "ARCHITECT", "EXPLORE",
  "PLAN", "BUILD", "SHIP", "RETROSPECTIVE",
] as const;

export const phaseSchema = z.enum(PHASES);

export const phaseStatusSchema = z.object({
  name: phaseSchema,
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "SKIPPED"]),
  completedAt: z.string().nullable().default(null),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).nullable().default(null),
});

export const decisionEntrySchema = z.object({
  timestamp: z.string(),
  phase: z.string(),
  agent: z.string(),
  decision: z.string(),
  rationale: z.string(),
});

export const confidenceEntrySchema = z.object({
  timestamp: z.string(),
  phase: z.string(),
  agent: z.string(),
  area: z.string(),
  level: z.enum(["HIGH", "MEDIUM", "LOW"]),
  rationale: z.string(),
});

export const taskSchema = z.object({
  id: z.number(),
  title: z.string(),
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "FAILED", "SKIPPED", "BLOCKED"]),
  wave: z.number(),
  attempt: z.number().default(0),
  strike: z.number().default(0),
});

export const pipelineStateSchema = z.object({
  schemaVersion: z.literal(2),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "FAILED"]),
  idea: z.string(),
  currentPhase: phaseSchema.nullable(),
  startedAt: z.string(),
  lastUpdatedAt: z.string(),
  phases: z.array(phaseStatusSchema),
  decisions: z.array(decisionEntrySchema).default([]),
  confidence: z.array(confidenceEntrySchema).default([]),
  tasks: z.array(taskSchema).default([]),
  arenaConfidence: z.enum(["HIGH", "MEDIUM", "LOW"]).nullable().default(null),
  exploreTriggered: z.boolean().default(false),
});

export type PipelineState = z.infer<typeof pipelineStateSchema>;
export type Phase = z.infer<typeof phaseSchema>;
export type DecisionEntry = z.infer<typeof decisionEntrySchema>;
export type ConfidenceEntry = z.infer<typeof confidenceEntrySchema>;
export type Task = z.infer<typeof taskSchema>;
```

### Confidence Module Functions

```typescript
// src/orchestrator/confidence.ts
import type { PipelineState, ConfidenceEntry, Phase } from "./schemas";

export function appendConfidence(
  state: Readonly<PipelineState>,
  entry: Omit<ConfidenceEntry, "timestamp">,
): PipelineState {
  return {
    ...state,
    confidence: [
      ...state.confidence,
      { ...entry, timestamp: new Date().toISOString() },
    ],
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function summarizeConfidence(
  entries: readonly ConfidenceEntry[],
): { HIGH: number; MEDIUM: number; LOW: number; total: number; dominant: "HIGH" | "MEDIUM" | "LOW" } {
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const entry of entries) {
    counts[entry.level]++;
  }
  const total = entries.length;

  // Tie-break: prefer higher confidence
  let dominant: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
  if (counts.HIGH >= counts.MEDIUM && counts.HIGH >= counts.LOW) dominant = "HIGH";
  else if (counts.LOW > counts.MEDIUM && counts.LOW > counts.HIGH) dominant = "LOW";

  return { ...counts, total, dominant };
}

export function filterByPhase(
  entries: readonly ConfidenceEntry[],
  phase: Phase,
): readonly ConfidenceEntry[] {
  return entries.filter(e => e.phase === phase);
}
```

### Tool Registration (Following create-agent.ts Pattern)

```typescript
// src/tools/state.ts
import { tool } from "@opencode-ai/plugin";
import { join } from "node:path";
import { loadState, saveState, patchState, appendDecision } from "../orchestrator/state";

export async function stateCore(
  args: { subcommand: string; field?: string; value?: string; phase?: string; agent?: string; decision?: string; rationale?: string },
  artifactDir: string,
): Promise<string> {
  switch (args.subcommand) {
    case "load": {
      const state = await loadState(artifactDir);
      return state ? JSON.stringify(state, null, 2) : JSON.stringify({ error: "no_state" });
    }
    case "get": {
      if (!args.field) return JSON.stringify({ error: "field required" });
      const state = await loadState(artifactDir);
      if (!state) return JSON.stringify({ error: "no_state" });
      const value = state[args.field as keyof typeof state] ?? null;
      return JSON.stringify({ field: args.field, value });
    }
    // ... update, patch, append-decision subcommands
    default:
      return JSON.stringify({ error: `Unknown subcommand: ${args.subcommand}` });
  }
}

export const ocState = tool({
  description: "Read or update orchestrator pipeline state. Returns JSON.",
  args: {
    subcommand: tool.schema.enum(["load", "get", "update", "patch", "append-decision"])
      .describe("State operation to perform"),
    field: tool.schema.string().optional().describe("Field name for get/update"),
    value: tool.schema.string().optional().describe("Value for update"),
    phase: tool.schema.string().optional().describe("Phase for append-decision"),
    agent: tool.schema.string().optional().describe("Agent for append-decision"),
    decision: tool.schema.string().optional().describe("Decision text"),
    rationale: tool.schema.string().optional().describe("Rationale text"),
  },
  async execute(args) {
    const artifactDir = join(process.cwd(), ".opencode-autopilot");
    return stateCore(args, artifactDir);
  },
});
```

### Initial State Factory

```typescript
// src/orchestrator/state.ts (continued)
import { PHASES, type PipelineState } from "./schemas";

export function createInitialState(idea: string): PipelineState {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2 as const,
    status: "IN_PROGRESS",
    idea,
    currentPhase: "RECON",
    startedAt: now,
    lastUpdatedAt: now,
    phases: PHASES.map((name) => ({
      name,
      status: name === "RECON" ? ("IN_PROGRESS" as const) : ("PENDING" as const),
      completedAt: null,
      confidence: null,
    })),
    decisions: [],
    confidence: [],
    tasks: [],
    arenaConfidence: null,
    exploreTriggered: false,
  };
}
```

## OpenCode SDK Insights

### AgentConfig Type (from @opencode-ai/sdk)

```typescript
type AgentConfig = {
  model?: string;
  temperature?: number;
  top_p?: number;
  prompt?: string;
  tools?: { [key: string]: boolean };
  disable?: boolean;
  description?: string;
  mode?: "subagent" | "primary" | "all";
  color?: string;
  maxSteps?: number;
  permission?: {
    edit?: "ask" | "allow" | "deny";
    bash?: ("ask" | "allow" | "deny") | { [key: string]: "ask" | "allow" | "deny" };
    webfetch?: "ask" | "allow" | "deny";
    doom_loop?: "ask" | "allow" | "deny";
    external_directory?: "ask" | "allow" | "deny";
  };
};
```

**Key observations for the orchestrator agent:**
- `maxSteps` controls iteration limit -- set this high enough for a full 8-phase pipeline (default may be too low)
- `tools` can selectively enable/disable tools -- the orchestrator needs `oc_orchestrate` enabled
- `permission.bash` supports per-command granularity via object form
- `mode: "subagent"` is correct -- user invokes orchestrator by name, not as the primary agent
- The `[key: string]: AgentConfig | undefined` index signature on Config.agent allows arbitrary agent names via config hook

### Config Hook Pattern (from existing agents/index.ts)

The config hook mutates `config.agent` directly. This is the intended API -- not a hack. The orchestrator agent registration follows exactly the same pattern as existing agents with deep-copy of permission object.

### Plugin Input (PluginInput type)

The plugin receives `directory` and `worktree` in its input, which provide the project root. Use `directory` (the project root) for constructing the `.opencode-autopilot/` path rather than `process.cwd()`.

## State of the Art

| Old Approach (hands-free CJS) | New Approach (Phase 4 TypeScript) | Why Changed |
|-------------------------------|-----------------------------------|-------------|
| Markdown tables with regex parsing | JSON + Zod schemas | Type safety, atomic reads, no regex fragility |
| Synchronous file I/O (readFileSync) | Async node:fs/promises | Plugin context is async; follows project constraint |
| Separate files (state.md, confidence.md, decision-log.md) | Single state.json | Atomic updates, no partial-write inconsistency (D-01) |
| CLI tool invoked via shell | TypeScript functions called directly | In-process, type-safe, testable |
| Key-value config in markdown | Zod-validated JSON with namespaces | Typed, versioned, migratable |

## Open Questions

1. **PluginInput.directory availability in tool execute()**
   - What we know: The plugin function receives `PluginInput` with `directory` (project root). Tool `execute()` functions receive only `args`.
   - What's unclear: Whether `directory` should be captured in a module-level variable during plugin init, or if `process.cwd()` is reliable within tool execution context.
   - Recommendation: Capture `PluginInput.directory` during plugin initialization and expose via a getter in `utils/paths.ts`. Fall back to `process.cwd()`. Test both paths.

2. **Agent tool availability for subagent dispatch**
   - What we know: OpenCode has an Agent tool concept (agents can invoke other agents). The existing agent definitions use `mode: "subagent"`.
   - What's unclear: The exact API surface -- does the orchestrator agent call an `Agent` tool by name, or use a different mechanism? The SDK types show `AgentPart` but not the dispatch mechanism.
   - Recommendation: This is exactly what D-06 (full loop proof) tests. Build the orchestrator agent and try dispatching. If it fails, investigate OpenCode's agent dispatch docs at that point.

3. **maxSteps default for orchestrator agent**
   - What we know: AgentConfig has `maxSteps?: number`. The default is unknown.
   - What's unclear: Whether the default is sufficient for an 8-phase pipeline that may require 16+ tool calls (2 per phase: dispatch + result).
   - Recommendation: Set `maxSteps: 50` explicitly on the orchestrator agent to avoid premature termination. Adjust based on D-06 proof results.

## Sources

### Primary (HIGH confidence)
- Direct source analysis of `src/config.ts` (44 lines) -- existing config pattern with Zod validation
- Direct source analysis of `src/tools/create-agent.ts` (82 lines) -- *Core + tool() registration pattern
- Direct source analysis of `src/agents/index.ts` (36 lines) -- config hook injection pattern
- Direct source analysis of `src/agents/researcher.ts` (43 lines) -- agent definition pattern
- Direct source analysis of `src/utils/fs-helpers.ts` (39 lines) -- ensureDir, isEnoentError utilities
- Direct source analysis of `src/utils/paths.ts` (11 lines) -- path helpers to extend
- Direct source analysis of `@opencode-ai/sdk` types -- AgentConfig, Config, PluginInput types
- Direct source analysis of `@opencode-ai/plugin` types -- Hooks, Plugin, ToolDefinition types

### Secondary (HIGH confidence -- direct source analysis of reference implementations)
- `claude-hands-free/bin/lib/state.cjs` (321 lines) -- State management patterns to port
- `claude-hands-free/bin/lib/confidence.cjs` (240 lines) -- Confidence ledger patterns
- `claude-hands-free/bin/lib/phase.cjs` (192 lines) -- Phase transition patterns
- `claude-hands-free/bin/lib/plan.cjs` (238 lines) -- Plan/wave grouping patterns
- `claude-hands-free/bin/lib/arena.cjs` (129 lines) -- Arena depth mapping
- `claude-hands-free/bin/lib/config.cjs` (188 lines) -- Config management patterns

### Tertiary (from prior research -- HIGH confidence, direct analysis)
- `.planning/research/STACK.md` -- Technology stack decisions (mitt deferred, no XState, JSON+Zod)
- `.planning/research/ARCHITECTURE.md` -- Build order, component boundaries, data flow
- `.planning/research/PITFALLS.md` -- 16 pitfalls with prevention strategies

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, extends proven patterns
- Architecture: HIGH -- module structure follows existing codebase conventions, patterns ported from battle-tested CJS
- Pitfalls: HIGH -- derived from direct analysis of both source codebases and their accumulated bug fixes
- Dispatch pattern (D-06): MEDIUM -- the tool-returns-instruction pattern is logically sound but unvalidated in OpenCode context. D-06 exists specifically to validate this.

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable domain -- patterns unlikely to change)
