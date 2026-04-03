# Phase 19: Agent Visibility & Fixes - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Stocktake correctly detects all agents (filesystem AND config-hook-injected) with accurate origin, mode, and model information. Ambiguous agents ("general", "explore") are investigated and resolved. All pipeline agents verified to have `mode: "subagent"` + `hidden: true` so they stay out of the Tab cycle.

</domain>

<decisions>
## Implementation Decisions

### Stocktake Detection Strategy
- **D-01:** Import the agent registry directly from `src/agents/index.ts` and `src/agents/pipeline/index.ts` into stocktake. This provides compile-time accuracy and auto-syncs when agents are added or removed. No static manifest or runtime config query needed.
- **D-02:** Report ALL agents — both user-facing (researcher, autopilot, etc.) and pipeline-internal (oc-architect, oc-builder, etc.). Complete picture, not filtered.

### Ambiguous Agent Replacement
- **D-03:** Investigate whether "general" and "explore" are OpenCode built-in agents or something our plugin accidentally registers. Act based on findings: if we control them, remove or replace; if they're OpenCode built-ins, document the limitation.
- **D-04:** The existing `oc-explorer` pipeline agent is fine as-is — it's already `mode: "subagent"` + `hidden: true`. No rename needed.

### Tab Cycle Control
- **D-05:** Verify and test that the existing `mode: "subagent"` + `hidden: true` pattern on all pipeline agents correctly excludes them from the Tab cycle. Add a test that asserts every pipeline agent has these fields set.
- **D-06:** Only agents with `mode: "all"` (currently just autopilot) should appear in the Tab cycle. Phase 20 will add more primary agents — this phase ensures the infrastructure is correct.

### Stocktake Output Format
- **D-07:** Three origin values: `built-in` (filesystem bundled), `config-hook` (programmatic via plugin), `user-created` (user's own files). Clear distinction between all sources.
- **D-08:** Add `mode` field (all/subagent) and `model` field (assigned model from config) to stocktake agent output. Full diagnostic picture alongside name, type, origin.

### Claude's Discretion
- How to import the agent registry without creating circular dependencies
- Whether to add a `group` field to indicate which model group an agent belongs to
- Test file structure for the new stocktake functionality

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Agent Registration
- `src/agents/index.ts` — Config hook entry point, agent map (`agents` const), `registerAgents()` function
- `src/agents/pipeline/index.ts` — Pipeline agent map (`pipelineAgents` const), all `AGENT_NAMES` entries
- `src/agents/autopilot.ts` — Primary agent pattern: `mode: "all"`, no `hidden` field

### Stocktake Tool
- `src/tools/stocktake.ts` — Current filesystem-only scanning logic, `AssetEntry` interface, `stocktakeCore()` function
- `src/health/checks.ts` — Health check patterns that may need similar agent visibility

### Agent Config Pattern
- `src/agents/pipeline/oc-architect.ts` — Pipeline agent pattern: `mode: "subagent"`, `hidden: true`
- `src/orchestrator/handlers/types.ts` — `AGENT_NAMES` const with all pipeline agent name strings

### Research
- `.planning/research/ARCHITECTURE.md` — Root cause analysis of stocktake blindness to config-hook agents
- `.planning/research/PITFALLS.md` — Stocktake detection pitfalls and prevention strategies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `agents` map in `src/agents/index.ts`: 5 user-facing agents (researcher, metaprompter, documenter, pr-reviewer, autopilot)
- `pipelineAgents` map in `src/agents/pipeline/index.ts`: 10 pipeline agents (oc-architect, oc-builder, etc.)
- `AGENT_NAMES` const in `src/orchestrator/handlers/types.ts`: canonical pipeline agent name strings
- `resolveModelForAgent()` in `src/registry/resolver.ts`: maps agent names to model assignments

### Established Patterns
- `AssetEntry` interface in stocktake: `{ name, type, origin, lint? }` — needs extension for mode/model
- Config-hook agents use `config.agent!` mutation pattern (required by OpenCode SDK)
- Pipeline agents consistently use `mode: "subagent"` + `hidden: true`
- `builtInCache` in stocktake uses filesystem scanning — separate path needed for config-hook agents

### Integration Points
- `stocktakeCore()` return value is JSON — callers (including the `/oc-stocktake` command) parse this
- `configHook()` in `src/agents/index.ts` is called during plugin init — agents are registered here
- `loadConfig()` in `src/config.ts` loads user config including model assignments

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for the import and output expansion.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 19-agent-visibility-fixes*
*Context gathered: 2026-04-03*
