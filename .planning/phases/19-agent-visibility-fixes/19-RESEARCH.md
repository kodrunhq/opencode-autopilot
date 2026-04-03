# Phase 19: Agent Visibility & Fixes - Research

**Researched:** 2026-04-03
**Domain:** Stocktake agent detection, config-hook agent introspection, OpenCode agent modes
**Confidence:** HIGH

## Summary

Phase 19 fixes the stocktake blindspot where config-hook-injected agents are invisible, clarifies what "general" and "explore" agents are, and ensures pipeline agents stay out of the Tab cycle. The core technical challenge is extending `stocktakeCore()` to merge filesystem-scanned agents with the programmatic agent registry, and extending `AssetEntry` to include `mode` and `model` fields for diagnostic completeness.

The critical discovery in this research is that **"general" and "explore" are OpenCode built-in agents**, not plugin-created ones. The SDK type definition (`@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts` line 1273-1274) explicitly names `general`, `explore`, `title`, `summary`, and `compaction` as named keys in the `Config.agent` map. Our plugin does NOT register agents named "general" or "explore" -- we register `oc-explorer` (a pipeline subagent). These built-in agents exist in every OpenCode session regardless of plugin installation.

**Primary recommendation:** Import `agents` and `pipelineAgents` maps directly into stocktake (as decided in D-01), add `origin: "config-hook"` to the `AssetEntry` union, extend with `mode`/`model` fields, and document "general"/"explore" as OpenCode built-ins that the plugin does not control.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Import the agent registry directly from `src/agents/index.ts` and `src/agents/pipeline/index.ts` into stocktake. This provides compile-time accuracy and auto-syncs when agents are added or removed. No static manifest or runtime config query needed.
- **D-02:** Report ALL agents -- both user-facing (researcher, autopilot, etc.) and pipeline-internal (oc-architect, oc-builder, etc.). Complete picture, not filtered.
- **D-03:** Investigate whether "general" and "explore" are OpenCode built-in agents or something our plugin accidentally registers. Act based on findings: if we control them, remove or replace; if they're OpenCode built-ins, document the limitation.
- **D-04:** The existing `oc-explorer` pipeline agent is fine as-is -- it's already `mode: "subagent"` + `hidden: true`. No rename needed.
- **D-05:** Verify and test that the existing `mode: "subagent"` + `hidden: true` pattern on all pipeline agents correctly excludes them from the Tab cycle. Add a test that asserts every pipeline agent has these fields set.
- **D-06:** Only agents with `mode: "all"` (currently just autopilot) should appear in the Tab cycle. Phase 20 will add more primary agents -- this phase ensures the infrastructure is correct.
- **D-07:** Three origin values: `built-in` (filesystem bundled), `config-hook` (programmatic via plugin), `user-created` (user's own files). Clear distinction between all sources.
- **D-08:** Add `mode` field (all/subagent) and `model` field (assigned model from config) to stocktake agent output. Full diagnostic picture alongside name, type, origin.

### Claude's Discretion
- How to import the agent registry without creating circular dependencies
- Whether to add a `group` field to indicate which model group an agent belongs to
- Test file structure for the new stocktake functionality

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BFIX-01 | Stocktake detects config-hook-injected agents alongside filesystem agents | Direct import of `agents` + `pipelineAgents` maps into stocktakeCore; new `origin: "config-hook"` value; merge with filesystem scan |
| BFIX-04 | Clarify/remove ambiguous "general" and "explore" agents -- replace with well-defined primary agents | SDK type analysis confirms these are OpenCode built-ins (line 1273-1274 of types.gen.d.ts); plugin does NOT create them; document as limitation |
| AGNT-14 | Config-hook agents appear in Tab cycle correctly for primary mode agents | Current `mode: "all"` on autopilot, researcher, metaprompter enables Tab cycle; D-06 says only autopilot should be `mode: "all"` -- researcher and metaprompter need mode correction |
</phase_requirements>

## Standard Stack

No new libraries needed. This phase modifies existing TypeScript modules only.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @opencode-ai/sdk | (installed) | AgentConfig type definition | Defines mode, hidden, model fields |
| @opencode-ai/plugin | (installed) | Tool registration, Config type | Plugin hook API |
| bun:test | (built-in) | Test framework | Project standard per CLAUDE.md |

### Supporting
No new supporting libraries. Zero-dependency phase per v4.0 constraint.

## Architecture Patterns

### Current Agent Registration Data Flow
```
src/agents/autopilot.ts          -> agents map (index.ts)     -> configHook -> config.agent
src/agents/researcher.ts         -> agents map (index.ts)     -> configHook -> config.agent
src/agents/metaprompter.ts       -> agents map (index.ts)     -> configHook -> config.agent
src/agents/documenter.ts         -> agents map (index.ts)     -> configHook -> config.agent
src/agents/pr-reviewer.ts       -> agents map (index.ts)     -> configHook -> config.agent
src/agents/pipeline/*.ts         -> pipelineAgents (pipeline/index.ts) -> configHook -> config.agent
```

### Current Stocktake Data Flow (THE BUG)
```
stocktakeCore(args, baseDir)
  -> readdir(baseDir/agents/) -> only finds .md files on filesystem
  -> NEVER sees config-hook agents (they exist only in memory)
```

### Fixed Stocktake Data Flow
```
stocktakeCore(args, baseDir, configHookAgents)
  -> readdir(baseDir/agents/)     -> filesystem agents (origin: built-in | user-created)
  -> iterate configHookAgents     -> programmatic agents (origin: config-hook)
  -> merge: filesystem wins on name collision (user may have customized)
  -> enrich with mode/model from agent config objects
```

### Import Strategy (No Circular Dependencies)

The dependency flow is strictly top-down: `index.ts -> tools/* -> templates/* + utils/*`. The stocktake tool is in `src/tools/stocktake.ts`. The agent maps are in `src/agents/index.ts` and `src/agents/pipeline/index.ts`.

**Potential circular dependency concern:** `src/agents/index.ts` imports from `src/config.ts` (for `loadConfig`). If stocktake also imports from `src/agents/index.ts`, does that create a cycle?

**Analysis:** No cycle exists. The dependency chain would be:
- `src/tools/stocktake.ts` imports from `src/agents/index.ts` (agent maps only)
- `src/agents/index.ts` imports from `src/config.ts`, `src/registry/resolver.ts`, agent definition files
- `src/tools/stocktake.ts` already imports from `src/skills/linter.ts` and `src/utils/paths.ts`

None of these form a cycle. The agent map exports (`agents`, `pipelineAgents`) are const declarations that don't depend on stocktake.

**Recommended approach:** Export the agent maps and individual agent configs from `src/agents/index.ts`. Stocktake imports only the data it needs (agent name, config object). No need to import `configHook` or `registerAgents`.

```typescript
// src/tools/stocktake.ts - new imports
import { agents } from "../agents/index";          // 5 standard agents
import { pipelineAgents } from "../agents/pipeline/index";  // 10 pipeline agents
import { AGENT_REGISTRY } from "../registry/model-groups";  // group assignments
```

### AssetEntry Extension

Current interface:
```typescript
interface AssetEntry {
  readonly name: string;
  readonly type: "skill" | "command" | "agent";
  readonly origin: "built-in" | "user-created";
  readonly lint?: { ... };
}
```

Extended interface:
```typescript
interface AssetEntry {
  readonly name: string;
  readonly type: "skill" | "command" | "agent";
  readonly origin: "built-in" | "config-hook" | "user-created";
  readonly mode?: "all" | "primary" | "subagent";    // agents only
  readonly model?: string;                              // agents only, resolved model
  readonly group?: string;                              // agents only, from AGENT_REGISTRY
  readonly hidden?: boolean;                            // agents only
  readonly lint?: { ... };
}
```

### Pattern: Config-Hook Agent to AssetEntry Mapping

```typescript
function configHookAgentToEntry(
  name: string,
  agentConfig: Readonly<AgentConfig>,
  groups: Readonly<Record<string, GroupModelAssignment>>,
  overrides: Readonly<Record<string, AgentOverride>>,
): AssetEntry {
  const registryEntry = AGENT_REGISTRY[name];
  const resolved = resolveModelForAgent(name, groups, overrides);
  return {
    name,
    type: "agent",
    origin: "config-hook",
    mode: (agentConfig.mode as "all" | "primary" | "subagent") ?? "all",
    model: resolved?.primary,
    group: registryEntry?.group,
    hidden: agentConfig.hidden ?? false,
    // No lint for config-hook agents (no YAML frontmatter)
  };
}
```

### Anti-Patterns to Avoid
- **Writing agents to filesystem for stocktake visibility:** Duplicates configHook mechanism, creates two sources of truth
- **Querying runtime Config object in stocktake:** stocktakeCore is a pure function of baseDir; passing the live Config couples it to plugin lifecycle
- **Modifying `configHook` to also write agent .md files:** Installer uses COPYFILE_EXCL; writing then copying creates race conditions

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent name-to-group mapping | Custom lookup table | `AGENT_REGISTRY` from `src/registry/model-groups.ts` | Already maps all 20 agents to 8 groups |
| Model resolution for agents | Custom model lookup | `resolveModelForAgent()` from `src/registry/resolver.ts` | 3-tier resolution (override, group, default) already built |
| Agent mode extraction | Parse from strings | `AgentConfig.mode` field from SDK type | Type-safe, well-defined union: `"subagent" \| "primary" \| "all"` |

## Key Finding: "general" and "explore" Are OpenCode Built-ins

**Confidence: HIGH** -- verified directly from the SDK type definition.

The `@opencode-ai/sdk` package (`node_modules/@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts` lines 1270-1278) defines the `Config.agent` type as:

```typescript
agent?: {
    plan?: AgentConfig;
    build?: AgentConfig;
    general?: AgentConfig;    // <-- OpenCode built-in
    explore?: AgentConfig;    // <-- OpenCode built-in
    title?: AgentConfig;      // <-- OpenCode built-in
    summary?: AgentConfig;    // <-- OpenCode built-in
    compaction?: AgentConfig; // <-- OpenCode built-in
    [key: string]: AgentConfig | undefined;
};
```

These are **named keys** in the Config type, meaning OpenCode itself creates and uses these agents. Our plugin's `configHook` does NOT register agents named "general" or "explore". The `oc-explorer` agent is our pipeline agent -- completely separate.

**Implications for BFIX-04:**
1. We cannot "remove" or "replace" general/explore -- they are OpenCode framework agents
2. Stocktake should detect these as OpenCode built-ins when present in the config
3. The phase success criteria should be updated: document the finding, ensure stocktake accurately reports their existence and origin
4. If the user wants different behavior from "general" or "explore", they can override them in their opencode.json config (the `[key: string]` index signature allows any agent name)

**Full list of OpenCode built-in agent names:** `plan`, `build`, `general`, `explore`, `title`, `summary`, `compaction`

## Key Finding: Mode Audit of Current Agents

| Agent | Mode | Hidden | Tab Cycle? | Should Be in Tab? |
|-------|------|--------|-----------|-------------------|
| autopilot | `"all"` | not set | YES | YES (D-06) |
| researcher | `"all"` | not set | YES | NO (D-06) |
| metaprompter | `"all"` | not set | YES | NO (D-06) |
| documenter | `"subagent"` | not set | No (@ only) | Correct |
| pr-reviewer | `"subagent"` | not set | No (@ only) | Correct |
| All 10 pipeline agents | `"subagent"` | `true` | No (invisible) | Correct |

**Action required:** `researcher` and `metaprompter` must change from `mode: "all"` to `mode: "subagent"` to remove them from the Tab cycle. Per D-06, only `autopilot` should be in the Tab cycle. This directly addresses AGNT-14 -- ensuring only intended primary agents appear in the Tab cycle.

**Note on `mode: "all"` vs `mode: "primary"`:** Per the SDK type, both `"primary"` and `"all"` put an agent in the Tab cycle. The difference is: `"all"` means the agent is BOTH Tab-cycleable and @-mentionable, while `"primary"` means Tab-cycleable only. Since `autopilot` should also be @-mentionable, keeping it as `mode: "all"` is correct.

## Common Pitfalls

### Pitfall 1: Filesystem-Registry Name Collision Handling
**What goes wrong:** A user creates `~/.config/opencode/agents/researcher.md` manually. Stocktake finds it via filesystem scan AND via the config-hook agent map. Without dedup logic, the agent appears twice in the report.
**Why it happens:** Two independent data sources enumerate the same logical agent.
**How to avoid:** Filesystem scan runs first, collects names into a Set. Config-hook iteration skips any name already in the Set. This gives filesystem (user-customized) version priority.
**Warning signs:** Duplicate agent names in stocktake output.

### Pitfall 2: Model Resolution Requires Config State
**What goes wrong:** `resolveModelForAgent()` needs `groups` and `overrides` from the plugin config. Stocktake currently does not load plugin config. If stocktake calls `resolveModelForAgent()` without loading config first, all agents report `model: undefined`.
**Why it happens:** Stocktake was designed as a filesystem-only scanner. Adding model resolution requires access to plugin config.
**How to avoid:** Call `loadConfig()` in the stocktake tool wrapper (not in `stocktakeCore`). Pass resolved model data as a parameter to keep the core function testable. Or accept that model info requires config and make it optional.
**Warning signs:** All agents show `model: null` in stocktake output.

### Pitfall 3: Breaking the `stocktakeCore` Signature
**What goes wrong:** Adding parameters to `stocktakeCore()` breaks existing tests that call it with `(args, baseDir)` only.
**Why it happens:** The function signature changes from 2 required params to 2 required + additional optional params.
**How to avoid:** Make new parameters optional with sensible defaults (empty map). Existing tests continue to work with 2 args. New tests exercise the extended signature.
**Warning signs:** `bun test tests/tools/stocktake.test.ts` fails after the change.

### Pitfall 4: `agents` Map Not Currently Exported
**What goes wrong:** `src/agents/index.ts` defines `const agents = { ... }` but does NOT export it. Only individual agent exports and `configHook` are exported.
**Why it happens:** The map was only needed internally by `registerAgents`.
**How to avoid:** Add `export` to the `agents` const. Similarly, `pipelineAgents` in `pipeline/index.ts` IS already exported. Verify both are accessible.
**Warning signs:** TypeScript compilation error when stocktake tries to import `agents`.

## Code Examples

### Extended AssetEntry Interface
```typescript
// Source: current stocktake.ts + SDK AgentConfig type
interface AssetEntry {
  readonly name: string;
  readonly type: "skill" | "command" | "agent";
  readonly origin: "built-in" | "config-hook" | "user-created";
  readonly mode?: "all" | "primary" | "subagent";
  readonly model?: string;
  readonly group?: string;
  readonly hidden?: boolean;
  readonly lint?: {
    readonly valid: boolean;
    readonly errors: readonly string[];
    readonly warnings: readonly string[];
  };
}
```

### Config-Hook Agent Collection
```typescript
// Source: src/agents/index.ts (agents map) + src/agents/pipeline/index.ts (pipelineAgents)
// Combine both maps for stocktake consumption
import { agents } from "../agents/index";
import { pipelineAgents } from "../agents/pipeline/index";
import { AGENT_REGISTRY } from "../registry/model-groups";

const allConfigHookAgents = { ...agents, ...pipelineAgents };
// Result: 15 agents (5 standard + 10 pipeline)
```

### Stocktake Summary Extension
```typescript
// Current summary has: total, builtIn, userCreated, lintErrors, lintWarnings
// Extended summary adds: configHook count
const summary = {
  total: allAssets.length,
  builtIn,
  configHook: allAssets.filter((a) => a.origin === "config-hook").length,
  userCreated,
  lintErrors,
  lintWarnings,
};
```

### Pipeline Agent Mode Assertion Test
```typescript
// Source: pattern from tests/agents-pipeline.test.ts
import { pipelineAgents } from "../src/agents/pipeline/index";

describe("pipeline agents Tab-cycle exclusion", () => {
  it("every pipeline agent has mode: subagent and hidden: true", () => {
    for (const [name, config] of Object.entries(pipelineAgents)) {
      expect(config.mode).toBe("subagent");
      expect(config.hidden).toBe(true);
    }
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Filesystem-only agent scan | Must also scan config-hook agents | Phase 19 | Stocktake reports complete agent inventory |
| Two origins (built-in, user-created) | Three origins (+ config-hook) | Phase 19 | Clear provenance for all assets |
| researcher/metaprompter as `mode: "all"` | Should be `mode: "subagent"` | Phase 19 | Only autopilot in Tab cycle |

## Open Questions

1. **Should stocktake also detect OpenCode built-in agents (general, explore, title, summary, compaction)?**
   - What we know: These are framework agents defined in the SDK Config type. They always exist.
   - What's unclear: Whether they appear in `config.agent` as actual objects at runtime, or only exist as type hints.
   - Recommendation: Skip them for now. Stocktake reports plugin-managed assets. Built-in OpenCode agents are outside the plugin's scope. Document this as a known limitation.

2. **Should the `group` field be added to AssetEntry?**
   - What we know: AGENT_REGISTRY maps every config-hook agent to a group (architects, builders, etc.). This is useful diagnostic info.
   - Recommendation: YES -- include it. Low cost (one field), high diagnostic value. Helps users understand which model assignment applies to which agent.

3. **Where should the mode correction for researcher/metaprompter happen?**
   - What we know: D-06 says only autopilot should be in Tab cycle. Researcher and metaprompter currently have `mode: "all"`.
   - Recommendation: Change them to `mode: "subagent"` in their respective source files (`src/agents/researcher.ts`, `src/agents/metaprompter.ts`). This is a one-line change per file but has user-visible impact -- users who Tab to researcher will lose that ability. Document as intentional.

## Project Constraints (from CLAUDE.md)

- **Runtime:** Bun only -- all tests via `bun test`
- **No standalone Zod install:** Use transitive dep from `@opencode-ai/plugin`
- **No `Bun.file()`/`Bun.write()`:** Use `node:fs/promises`
- **Model agnostic:** Never hardcode model identifiers
- **Global target:** Assets write to `~/.config/opencode/`
- **`oc_` prefix:** All plugin tool names start with `oc_`
- **Immutability:** Build objects declaratively, never mutate after creation
- **Atomic writes:** Use `writeFile` with `wx` flag for no-clobber
- **Best-effort injection:** Never block or crash the pipeline on injection errors
- **Top-down dependency flow:** `index.ts -> tools/* -> templates/* + utils/*` -- no cycles

## Sources

### Primary (HIGH confidence)
- `@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts` lines 971-1012 -- AgentConfig type with mode, hidden, model fields
- `@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts` lines 1270-1278 -- Config.agent type showing general/explore as named built-ins
- `src/tools/stocktake.ts` -- current filesystem-only scanning logic, AssetEntry interface
- `src/agents/index.ts` -- agents map (5 standard), configHook, registerAgents
- `src/agents/pipeline/index.ts` -- pipelineAgents map (10 pipeline)
- `src/registry/model-groups.ts` -- AGENT_REGISTRY with all 20 agents mapped to 8 groups
- `src/registry/resolver.ts` -- resolveModelForAgent with 3-tier resolution
- `src/health/checks.ts` -- EXPECTED_AGENTS pattern (already tracks all agent names)
- `.planning/research/ARCHITECTURE.md` -- root cause analysis of stocktake blindness
- `.planning/research/PITFALLS.md` -- Pitfall 2 (stocktake), Pitfall 3 (Tab pollution)

### Secondary (MEDIUM confidence)
- `.planning/phases/19-agent-visibility-fixes/19-CONTEXT.md` -- user decisions and canonical references

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, pure TypeScript modifications
- Architecture: HIGH -- all data sources already exist, just need wiring
- Pitfalls: HIGH -- based on direct code analysis, no speculation
- "general"/"explore" finding: HIGH -- verified directly from SDK type definitions

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable codebase, no fast-moving dependencies)
