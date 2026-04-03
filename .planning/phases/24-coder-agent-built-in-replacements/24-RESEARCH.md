# Phase 24: Coder Agent, Hash-Anchored Edits & Wave Automation - Research

**Researched:** 2026-04-03
**Domain:** Agent registration, edit validation tooling, dependency-based wave computation, config hook agent suppression
**Confidence:** HIGH

## Summary

Phase 24 adds four capabilities: (1) a new primary Coder agent following the established Phase 20 pattern, (2) an `oc_hashline_edit` tool using omo's CID alphabet for stale-line-safe edits, (3) automatic wave assignment from task dependencies, and (4) suppression of OpenCode's built-in Plan agent via the `disable` field on `AgentConfig`.

All four areas are well-understood. The Coder agent is a straightforward copy of the debugger/planner pattern with different skills embedded. The hash-anchored edit tool follows the existing `*Core` + `tool()` registration pattern. The wave auto-assigner reuses the proven topological sort from `dependency-resolver.ts`. Built-in Plan suppression is confirmed possible via the `disable: true` field on `AgentConfig` (verified in `@opencode-ai/sdk` type definitions).

**Primary recommendation:** Implement in order -- Coder agent first (simplest, unblocks `/oc-tdd` routing), then `oc_hashline_edit` (standalone tool, no cross-dependencies), then wave auto-assignment (schema + handler changes), then Plan suppression + wiring audit (verification layer).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Agent named `coder`. Tab cycle becomes: autopilot, coder, debugger, planner, reviewer.
- **D-02:** Pure implementer scope -- writes code, runs tests, fixes builds. Does NOT self-review or handle frontend design.
- **D-03:** Statically embeds `tdd-workflow` and `coding-standards` skills (same pattern as Phase 20: strip YAML frontmatter, embed full content).
- **D-04:** Permissions: `read: allow`, `write: allow`, `edit: allow`, `bash: allow`. No webfetch/websearch.
- **D-05:** Mode: `"all"` -- appears in both Tab cycle and @ autocomplete.
- **D-06:** Routes `/oc-tdd` command to this agent via `agent: coder` frontmatter.
- **D-07:** New standalone `oc_hashline_edit` tool. Coexists with OpenCode's built-in edit.
- **D-08:** Uses omo's CID alphabet (`ZPMQVRWSNKTXJBYH`) for LINE#ID format. Two-char hashes (e.g., `42#VK`). 16^2 = 256 unique values per file.
- **D-09:** Validation pipeline: parse LINE#ID -> compute hash for current file content -> compare -> match = proceed, mismatch = reject with updated anchors.
- **D-10:** Three operation types: `replace` (single line or range), `append` (insert after anchor), `prepend` (insert before anchor).
- **D-11:** Error recovery returns updated LINE#ID references so the agent can retry with correct anchors.
- **D-12:** All code-writing agents use this tool: Coder, Autopilot, Debugger, and pipeline oc-implementer. Agent prompts updated to prefer `oc_hashline_edit` over built-in edit.
- **D-13:** Add `depends_on: z.array(z.number()).default([])` field to `taskSchema` in `src/orchestrator/schemas.ts`.
- **D-14:** New `src/orchestrator/wave-assigner.ts` -- topological sort of tasks by `depends_on`, automatic wave number computation. Reuse pattern from `src/skills/dependency-resolver.ts`.
- **D-15:** Build handler (`src/orchestrator/handlers/build.ts`) calls wave-assigner before dispatching. Planners declare deps, system computes waves.
- **D-16:** Git-based completion verification: after `dispatch_multi` completes, verify each task made commits.
- **D-17:** Suppress OpenCode's built-in Plan agent via config hook.
- **D-18:** Custom Planner already exists and is sufficient -- built-in Plan is redundant Tab clutter.
- **D-19:** Final plan: run oc_stocktake + oc_doctor, verify all wiring. Fix gaps found.
- **D-20:** Currently `/oc-tdd` is the only unrouted command -- will be fixed by D-06.

### Claude's Discretion
- Exact system prompt content for Coder agent (within the skill-embedded, role-scoped constraints)
- `maxSteps` value for Coder agent (reference: Autopilot uses 50)
- Hash computation implementation details (hashing algorithm for CID alphabet mapping)
- Bottom-up edit ordering strategy (highest line numbers first vs sequential)
- Wave-assigner cycle detection and error handling
- Git verification implementation (commit message parsing vs ref counting)
- How to detect/suppress built-in Plan agent in OpenCode's config API

### Deferred Ideas (OUT OF SCOPE)
- Content expansion (skills, commands, agents) -- Phase 25
- Frontend engineer agent
- TDD enforcement hook
- Context engineering improvements
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BFIX-04 | Clarify/remove ambiguous "general" and "explore" agents -- replace with well-defined primary agents | Coder agent adds a well-defined primary agent to replace ambiguous built-ins |
| AGNT-14 | Config-hook agents appear in Tab cycle correctly for primary mode agents | Coder as `mode: "all"` + Plan suppression via `disable: true` ensures correct Tab cycle |
| PIPE-06 | BUILD phase supports wave-based parallel execution where independent tasks within a wave build concurrently | Wave auto-assignment from `depends_on` enables automatic wave computation |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Runtime:** Bun only -- plugins run inside the OpenCode process via Bun
- **No standalone Zod install:** Use `tool.schema` for tool arg schemas; `import { z } from "zod"` for non-tool validation
- **No `Bun.file()`/`Bun.write()`:** Use `node:fs/promises` for portability and testability
- **Model agnostic:** Never hardcode model identifiers in bundled agents
- **Global target:** Assets always write to `~/.config/opencode/`
- **`oc_` prefix:** All plugin tool names must start with `oc_`
- **Tool pattern:** Each tool exports a `*Core` function (testable, accepts `baseDir`) and a `tool()` wrapper
- **Atomic file writes:** `writeFile(path, content, { flag: "wx" })` for no-clobber
- **Immutability:** `Object.freeze()`, `readonly` arrays, conditional spreads -- never mutate after creation
- **Agent skill embedding:** Strip YAML frontmatter, embed full content as template literal (Phase 20 pattern)

## Architecture Patterns

### Coder Agent (follows established pattern)

**Reference:** `src/agents/debugger.ts`, `src/agents/planner.ts`

The pattern for a primary agent with embedded skills:

```typescript
// src/agents/coder.ts
import type { AgentConfig } from "@opencode-ai/sdk";

export const coderAgent: Readonly<AgentConfig> = Object.freeze({
  description: "...",
  mode: "all",          // D-05: Tab cycle + @ autocomplete
  maxSteps: 30,         // Recommendation: between debugger (25) and autopilot (50)
  prompt: `You are the coder agent. ...

<skill name="tdd-workflow">
... (stripped frontmatter, full content)
</skill>

<skill name="coding-standards">
... (stripped frontmatter, full content)
</skill>

## Rules
...`,
  permission: {
    edit: "allow",       // D-04
    bash: "allow",       // D-04
    webfetch: "deny",    // No web access
  } as const,
});
```

**Registration in `src/agents/index.ts`:**
- Add `coder` to the alphabetically-ordered `agents` map
- Alphabetical order ensures Tab cycle: autopilot, **coder**, debugger, planner, reviewer

**Skill embedding pattern (Phase 20):**
1. Read `assets/skills/tdd-workflow/SKILL.md` content
2. Strip everything before the first `#` heading (removes YAML frontmatter)
3. Wrap in `<skill name="tdd-workflow">...</skill>` tags
4. Same for `coding-standards`

### Hash-Anchored Edit Tool

**Tool file:** `src/tools/hashline-edit.ts`

The tool follows the `*Core` + `tool()` pattern from `create-agent.ts`:

```typescript
// Core function (testable)
export async function hashlineEditCore(args: HashlineEditArgs): Promise<string> { ... }

// Tool wrapper
export const ocHashlineEdit = tool({
  description: "...",
  args: { ... },
  async execute(args) {
    return hashlineEditCore(args);
  },
});
```

**CID Alphabet Hash Computation:**

The omo CID alphabet is `ZPMQVRWSNKTXJBYH` (16 characters). Two-char hashes yield 256 unique values.

Algorithm to compute LINE#ID for a given line:
1. Take the line content (trimmed or raw -- recommendation: use raw content including whitespace for maximum sensitivity)
2. Compute a numeric hash (e.g., simple CRC or FNV-1a for speed -- crypto not needed)
3. Map to two CID chars: `hash % 16` -> first char, `(hash >> 4) % 16` -> second char

**Recommendation for hash function:** Use FNV-1a (32-bit). It is fast, well-distributed, and deterministic. No need for cryptographic hashing -- the purpose is change detection, not security.

```typescript
const CID_ALPHABET = "ZPMQVRWSNKTXJBYH";

function fnv1a(str: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0; // ensure unsigned
}

function computeLineHash(content: string): string {
  const h = fnv1a(content);
  return CID_ALPHABET[h & 0xf] + CID_ALPHABET[(h >> 4) & 0xf];
}
```

**Validation pipeline:**
1. Parse `pos` as `"LINE#HASH"` -- extract line number and hash
2. Read file, split into lines
3. Compute hash for the referenced line
4. Compare computed vs provided hash
5. Match -> apply operation (replace/append/prepend)
6. Mismatch -> return error with updated LINE#ID references for surrounding context

**Edit ordering:** Process edits bottom-up (highest line numbers first) to prevent line number shifts from invalidating subsequent edits.

**Tool schema (using `tool.schema`):**

```typescript
args: {
  file: tool.schema.string().describe("Absolute path to the file"),
  edits: tool.schema.array(
    tool.schema.object({
      op: tool.schema.enum(["replace", "append", "prepend"]),
      pos: tool.schema.string().describe("LINE#HASH anchor (e.g., '42#VK')"),
      end: tool.schema.string().optional().describe("End anchor for range replace"),
      lines: tool.schema.union([
        tool.schema.string(),
        tool.schema.array(tool.schema.string()),
        tool.schema.null(),
      ]).describe("New content (null to delete)"),
    })
  ).describe("Array of edit operations"),
}
```

### Wave Auto-Assignment

**New file:** `src/orchestrator/wave-assigner.ts`

Reuse the topological sort pattern from `src/skills/dependency-resolver.ts` but adapted for tasks:

```typescript
interface TaskNode {
  readonly id: number;
  readonly depends_on: readonly number[];
}

interface WaveAssignment {
  readonly assignments: ReadonlyMap<number, number>; // taskId -> wave
  readonly cycles: readonly number[]; // task IDs in cycles
}

export function assignWaves(tasks: readonly TaskNode[]): WaveAssignment { ... }
```

**Algorithm (Kahn's algorithm -- better fit than DFS for wave assignment):**
1. Build adjacency list and in-degree map from `depends_on`
2. All tasks with in-degree 0 -> Wave 1
3. Remove Wave 1, decrement in-degrees
4. Repeat for Wave 2, 3, etc.
5. Any remaining tasks (in-degree never reaches 0) are in cycles

**Integration with build handler:**
- Call `assignWaves()` in `handleBuild` before the first dispatch
- Set each task's `wave` field based on the computed assignment
- Backward compatible: tasks without `depends_on` (empty array default) all go to Wave 1

### Built-in Plan Agent Suppression

**Key finding:** `AgentConfig` in `@opencode-ai/sdk` has a `disable?: boolean` field.

The `registerAgents` function in `src/agents/index.ts` already skips agents where `agentRef[name] !== undefined`. This means if we set the built-in Plan agent's entry in the config hook, we can control it.

**Approach:** In `configHook()`, after registering our agents, check if a built-in "Plan" agent exists and set `disable: true`:

```typescript
// In configHook, after registerAgents calls:
// Suppress built-in Plan agent (our planner agent replaces it)
if (config.agent) {
  const builtInPlan = config.agent["Plan"];
  if (builtInPlan !== undefined) {
    config.agent["Plan"] = { ...builtInPlan, disable: true };
  }
}
```

**Note:** The exact name of OpenCode's built-in Plan agent needs verification at runtime. It could be "Plan", "plan", or another variant. The implementation should try common variants or use a case-insensitive search.

**Alternative approach (if `disable` does not work):** Set `mode: "subagent"` and `hidden: true` to remove it from the Tab cycle without fully disabling it.

### Agent Prompt Updates (D-12)

Four agents need prompt additions to prefer `oc_hashline_edit`:

1. **Coder** (`src/agents/coder.ts`) -- new agent, include from the start
2. **Autopilot** (`src/agents/autopilot.ts`) -- add note to prompt
3. **Debugger** (`src/agents/debugger.ts`) -- add note to prompt
4. **oc-implementer** (`src/agents/pipeline/oc-implementer.ts`) -- add note to prompt

Prompt addition pattern:
```
## Editing Files

When editing files, prefer oc_hashline_edit over the built-in edit tool. Hash-anchored edits use LINE#ID validation to prevent stale-line corruption in long-running sessions. The built-in edit is still available as a fallback.
```

### Command Routing (D-06)

**File:** `assets/commands/oc-tdd.md`

Current content lacks `agent` frontmatter. Add `agent: coder`:

```yaml
---
description: Implement a feature using strict RED-GREEN-REFACTOR TDD methodology
agent: coder
---
```

### Wiring Audit (D-19)

The wiring audit verifies:
1. All commands in `assets/commands/` have `agent:` frontmatter (or are intentionally unrouted)
2. All agents in `src/agents/index.ts` `agents` map are registered in `configHook`
3. All skills referenced in agent prompts exist in `assets/skills/`
4. `oc_stocktake` reports correct counts and no lint errors
5. `oc_doctor` passes all health checks

Current `stocktakeCore` already detects config-hook agents alongside filesystem agents (added in Phase 19). The audit should verify the new coder agent appears in both stocktake output and doctor checks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Topological sort | Custom graph traversal | Adapt `dependency-resolver.ts` pattern | Proven cycle detection, handles edge cases |
| Hash function for CID | Crypto hash (SHA, MD5) | FNV-1a (32-bit) | Fast, deterministic, well-distributed, no crypto overhead |
| YAML frontmatter stripping | Custom regex parser | Simple `indexOf('#')` slice | YAML frontmatter is always before the first `#` heading |
| File read/write | `Bun.file()`/`Bun.write()` | `node:fs/promises` | CLAUDE.md constraint: portability and testability |

## Common Pitfalls

### Pitfall 1: Agent Map Ordering Matters for Tab Cycle
**What goes wrong:** Adding `coder` in the wrong alphabetical position causes unexpected Tab cycle order.
**Why it happens:** OpenCode's Tab cycle follows the order agents appear in the config object. Our `agents` map uses alphabetical ordering.
**How to avoid:** Insert `coder` between `autopilot` and `debugger` in the `agents` map. Verify Tab cycle in testing.
**Warning signs:** Tab cycle shows agents in wrong order during QA.

### Pitfall 2: Hash Collision in Small Files
**What goes wrong:** Two lines in a small file get the same 2-char hash, making LINE#ID ambiguous.
**Why it happens:** With only 256 possible hashes, birthday paradox kicks in around ~20 lines for a 50% collision chance.
**How to avoid:** The LINE#ID format includes both the line number AND the hash. `42#VK` and `58#VK` are distinct because the line number disambiguates. The hash validates content, not identity.
**Warning signs:** None -- the design handles this correctly by combining line number with hash.

### Pitfall 3: Wave Auto-Assignment vs Manual Waves
**What goes wrong:** Tasks that already have manually-assigned wave numbers get reassigned by the auto-assigner, breaking existing pipeline state.
**Why it happens:** Auto-assignment runs on every `handleBuild` call without checking if waves were already set.
**How to avoid:** Only run wave auto-assignment when `depends_on` is present on any task. If all `depends_on` arrays are empty and waves are already set, preserve existing wave assignments.
**Warning signs:** Existing pipelines break after the update.

### Pitfall 4: Built-in Agent Name Mismatch
**What goes wrong:** The suppression code targets "Plan" but the built-in is named "plan" or "Planner".
**Why it happens:** OpenCode's built-in agent naming convention is not documented.
**How to avoid:** Log all agent names in the config during development. Use case-insensitive matching or check multiple variants.
**Warning signs:** Built-in Plan agent still appears in Tab cycle after the change.

### Pitfall 5: Circular Dependencies in Tasks
**What goes wrong:** Task A depends on Task B which depends on Task A. Wave assignment fails or infinite loops.
**Why it happens:** Planners create circular task dependencies.
**How to avoid:** The wave-assigner must detect cycles (like `dependency-resolver.ts` does) and report them as errors rather than silently dropping tasks.
**Warning signs:** Tasks stuck in PENDING status forever.

## Code Examples

### Existing Agent Registration Pattern (verified from source)

```typescript
// src/agents/index.ts -- agents map (alphabetically ordered)
export const agents = {
  autopilot: autopilotAgent,
  // coder goes here (D-01)
  debugger: debuggerAgent,
  documenter: documenterAgent,
  metaprompter: metaprompterAgent,
  planner: plannerAgent,
  "pr-reviewer": prReviewerAgent,
  researcher: researcherAgent,
  reviewer: reviewerAgent,
} as const;
```

### Existing Dependency Resolver Pattern (verified from source)

```typescript
// src/skills/dependency-resolver.ts -- key interface
export interface DependencyNode {
  readonly requires: readonly string[];
}
export interface ResolutionResult {
  readonly ordered: readonly string[];
  readonly cycles: readonly string[];
}
```

### AgentConfig Disable Field (verified from @opencode-ai/sdk types)

```typescript
// node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts line 835
export type AgentConfig = {
  model?: string;
  temperature?: number;
  prompt?: string;
  disable?: boolean;     // <-- Key field for Plan suppression
  description?: string;
  mode?: "subagent" | "primary" | "all";
  maxSteps?: number;
  permission?: { ... };
  // ...
};
```

### Existing Task Schema (verified from source)

```typescript
// src/orchestrator/schemas.ts
export const taskSchema = z.object({
  id: z.number(),
  title: z.string().max(2048),
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "FAILED", "SKIPPED", "BLOCKED"]),
  wave: z.number(),
  attempt: z.number().default(0),
  strike: z.number().default(0),
  // D-13: Add depends_on: z.array(z.number()).default([])
});
```

### Build Handler Wave Dispatch Pattern (verified from source)

```typescript
// src/orchestrator/handlers/build.ts -- dispatch_multi for parallel tasks
if (pendingTasks.length > 1) {
  const dispatchedIds = pendingTasks.map((t) => t.id);
  return Object.freeze({
    action: "dispatch_multi",
    agents: pendingTasks.map((task) => ({
      agent: AGENT_NAMES.BUILD,
      prompt: buildTaskPrompt(task),
    })),
    phase: "BUILD",
    progress: `Wave ${currentWave} - ${pendingTasks.length} concurrent tasks`,
    _stateUpdates: {
      tasks: [...markTasksInProgress(tasks, dispatchedIds)],
      buildProgress: { ...updatedProgress, currentTask: null },
    },
  } satisfies DispatchResult);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual wave assignment by planners | Auto-computed waves from depends_on | This phase | Planners declare deps, system computes optimal waves |
| Line-number-only edits | Hash-anchored LINE#ID validation | This phase (from omo) | 10x edit success rate in autonomous sessions |
| Built-in Plan + custom Planner both visible | Built-in Plan suppressed via disable | This phase | Clean Tab cycle without redundant agents |

## Open Questions

1. **Built-in Plan agent exact name**
   - What we know: OpenCode has built-in agents. Our config hook mutates `config.agent`.
   - What's unclear: The exact string key used for the built-in Plan agent ("Plan", "plan", "Planner")
   - Recommendation: Log `Object.keys(config.agent)` during development to discover the name. Implement with a common-variants check. If no built-in Plan is found, skip suppression silently.

2. **Git-based completion verification details (D-16)**
   - What we know: After `dispatch_multi`, we want to verify each task made commits.
   - What's unclear: Best method -- check `git log` for recent commits mentioning task ID, or count refs since dispatch start?
   - Recommendation: Use `git log --oneline --since=<dispatch_start>` and grep for task ID in commit messages. Simple and reliable given our commit message convention.

3. **Hash sensitivity to whitespace/encoding**
   - What we know: FNV-1a hashes the raw string bytes.
   - What's unclear: Should we normalize line endings (CRLF vs LF) or trailing whitespace before hashing?
   - Recommendation: Hash raw content as-is. Normalization would mask legitimate changes. If a formatter changes whitespace, the hash should change to flag the drift.

## Sources

### Primary (HIGH confidence)
- `@opencode-ai/sdk` v0.x types.gen.d.ts -- `AgentConfig.disable` field verified
- `src/agents/index.ts` -- config hook registration pattern verified
- `src/agents/debugger.ts`, `src/agents/planner.ts` -- agent pattern with embedded skills verified
- `src/skills/dependency-resolver.ts` -- topological sort with cycle detection verified
- `src/orchestrator/schemas.ts` -- current taskSchema verified
- `src/orchestrator/handlers/build.ts` -- wave dispatch pattern verified
- `src/tools/create-agent.ts` -- *Core + tool() pattern verified
- `docs/gap-analysis-deep-dive.md` -- CID alphabet, LINE#ID format, validation pipeline documented

### Secondary (MEDIUM confidence)
- omo hashline_edit documentation -- CID alphabet `ZPMQVRWSNKTXJBYH`, edit operations, validation pipeline

### Tertiary (LOW confidence)
- Built-in Plan agent exact name -- needs runtime verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns established in prior phases
- Architecture: HIGH -- follows existing patterns (agent registration, tool registration, dependency resolver)
- Pitfalls: HIGH -- well-understood from prior phases (20, 19) and documented in gap analysis
- Plan suppression: MEDIUM -- `disable` field exists in types but runtime behavior needs verification

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable -- all patterns are internal to this project)
