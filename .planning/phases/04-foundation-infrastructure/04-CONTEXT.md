# Phase 4: Foundation Infrastructure - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Deterministic TypeScript tooling providing state management, confidence tracking, config extension, and validated agent dispatch. This is the bedrock that Phases 5-7 build on. No pipeline phases, no review agents, no orchestrator command -- just the infrastructure layer.

Requirements: ORCH-02, ORCH-03, ORCH-04, ORCH-05, TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06

</domain>

<decisions>
## Implementation Decisions

### State Persistence (TOOL-01, ORCH-02)
- **D-01:** Single JSON file (`state.json`) with full pipeline state: current phase, phase history, decisions array, confidence entries array. Zod schema validates on every read. Matches existing `config.ts` pattern.
- **D-02:** State file lives at `.opencode-autopilot/state.json` in the project root. The `.opencode-autopilot/` directory is the orchestrator's working directory (per-project, gitignored).
- **D-03:** State module provides: load, update, get, patch, and phase transition functions. All return Zod-validated typed objects. Failed validation throws (fail-fast).

### Agent Dispatch Pattern (Hard Gate)
- **D-04:** Tool-returns-instruction pattern. `oc_orchestrate` is a registered tool that reads state, determines the next action, and returns structured JSON: `{action: 'dispatch', agent: 'researcher', prompt: '...'}` or `{action: 'complete'}`.
- **D-05:** An orchestrator agent (injected via config hook, mode: subagent) has a lean prompt: "call oc_orchestrate, parse the JSON response, dispatch the named agent via Agent tool, repeat until `{action: 'complete'}`." All state machine logic lives in TypeScript, not in the agent prompt.
- **D-06:** Phase 4 must prove a FULL LOOP: orchestrator agent calls oc_orchestrate tool -> tool returns dispatch instruction -> agent dispatches subagent -> subagent completes and writes result -> agent calls oc_orchestrate again with result -> tool advances state -> tool returns next dispatch -> agent dispatches next subagent -> eventually tool returns `{action: 'complete'}` -> agent stops. This is the hard gate -- if it fails, architecture changes before Phase 5.

### Config Schema (TOOL-02, ORCH-04)
- **D-07:** Version bump from 1 to 2. New schema includes `orchestrator` namespace (autonomy level, phase toggles, strictness), `review` namespace (agent selection, severity threshold), `confidence` namespace (enabled, thresholds). Each namespace has its own Zod sub-schema.
- **D-08:** Migration function auto-upgrades v1 configs on load: adds defaults for all new fields, preserves existing `models` and `configured` values. Old `version: 1` files become `version: 2` after first load+save cycle.

### Artifact Storage
- **D-09:** `.opencode-autopilot/` in the project root. Structure: `state.json`, `phases/RECON/`, `phases/BUILD/`, etc. The directory is auto-created on first orchestrator invocation.
- **D-10:** Add `.opencode-autopilot/` to `.gitignore` automatically on first run (same pattern as hands-free's `.hands-free/` handling).

### Decision Logging (ORCH-03)
- **D-11:** Decisions are entries in the `decisions` array inside `state.json`. Each entry: `{timestamp, phase, agent, decision, rationale}`. No separate file -- keeps single-file simplicity.

### Confidence Ledger (ORCH-05, TOOL-03)
- **D-12:** Confidence entries are in the `confidence` array inside `state.json`. Each entry: `{timestamp, phase, agent, area, level: HIGH|MEDIUM|LOW, rationale}`. Summary function aggregates by phase. Filter function returns entries for a specific phase.

### Phase Tracking (TOOL-04)
- **D-13:** Phase module validates transitions against the allowed state machine graph (RECON -> CHALLENGE -> ARCHITECT -> EXPLORE -> PLAN -> BUILD -> SHIP -> RETROSPECTIVE). Invalid transitions throw. Phase completion marks status as DONE in state and timestamps it.

### Plan Module (TOOL-05)
- **D-14:** Plan module indexes task lists from a structured JSON format (not markdown parsing). Wave grouping assigns wave numbers to tasks based on dependency analysis. Tasks within the same wave can execute in parallel.

### Arena Module (TOOL-06)
- **D-15:** Arena module determines debate depth based on aggregate confidence from ARCHITECT phase. Low confidence -> 3 proposals. High confidence -> 1 proposal (no debate). Explorer trigger checks if any proposal confidence is below threshold.

### Carrying Forward from v1
- **D-16:** `node:fs/promises` for all file I/O (no Bun.file())
- **D-17:** Zod for all schema validation
- **D-18:** `Object.freeze()` + `Readonly<T>` for immutable configs
- **D-19:** Tool registration: each tool exports a `*Core` function (testable, accepts paths) and a `tool()` wrapper

### Claude's Discretion
- Internal TypeScript module structure (how to organize the 6 TOOL-* modules under src/)
- Zod schema field names and nesting depth within state.json
- Whether to use mitt event bus in Phase 4 or defer to Phase 6
- The exact Zod sub-schema field names for orchestrator/review/confidence config namespaces
- Test structure and organization for the new modules

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source Plugin Reference (Port From)
- `/home/joseibanez/develop/projects/claude-hands-free/bin/lib/state.cjs` -- State management patterns to port (YAML frontmatter -> JSON)
- `/home/joseibanez/develop/projects/claude-hands-free/bin/lib/config.cjs` -- Config patterns to port
- `/home/joseibanez/develop/projects/claude-hands-free/bin/lib/confidence.cjs` -- Confidence ledger patterns to port
- `/home/joseibanez/develop/projects/claude-hands-free/bin/lib/phase.cjs` -- Phase transition patterns to port
- `/home/joseibanez/develop/projects/claude-hands-free/bin/lib/plan.cjs` -- Plan/wave patterns to port
- `/home/joseibanez/develop/projects/claude-hands-free/bin/lib/arena.cjs` -- Arena depth patterns to port

### Existing Codebase (Build On)
- `src/config.ts` -- Existing config pattern with Zod validation (extend for v2)
- `src/utils/fs-helpers.ts` -- ensureDir, copyIfMissing, isEnoentError (reuse)
- `src/utils/paths.ts` -- getGlobalConfigDir (reuse, extend for project-local paths)
- `src/agents/index.ts` -- configHook pattern for agent injection (extend for orchestrator agent)
- `src/agents/researcher.ts` -- Reference pattern for agent config objects

### Research
- `.planning/research/STACK.md` -- Technology decisions (mitt, no XState, JSON+Zod)
- `.planning/research/ARCHITECTURE.md` -- Component boundaries, data flow, build order
- `.planning/research/PITFALLS.md` -- Critical risks (token budget, dispatch validation, state unification)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/config.ts` (loadConfig, saveConfig, pluginConfigSchema) -- extend schema, reuse load/save pattern with migration
- `src/utils/fs-helpers.ts` (ensureDir) -- reuse for creating .opencode-autopilot/ directory
- `src/utils/paths.ts` (getGlobalConfigDir) -- extend with getProjectArtifactDir() for .opencode-autopilot/
- `src/utils/validators.ts` (validateAssetName) -- reuse pattern for phase name validation

### Established Patterns
- Tool registration: `*Core` function + `tool()` wrapper (src/tools/create-agent.ts as reference)
- Agent config: `Readonly<AgentConfig>` + `Object.freeze()` (src/agents/researcher.ts)
- Config hook: mutate `config.agent` object (src/agents/index.ts)
- Zod validation on every load (src/config.ts)
- Atomic writes with `wx` flag (src/tools/create-agent.ts)

### Integration Points
- `src/index.ts` -- Register new tools (oc_orchestrate, oc_state, oc_confidence, etc.)
- `src/agents/index.ts` -- Add orchestrator agent to configHook injection
- `src/config.ts` -- Extend pluginConfigSchema from v1 to v2 with migration

</code_context>

<specifics>
## Specific Ideas

- The hf-tools.cjs library has 3301 lines across 13 modules with 161 accumulated bug fixes. Port the LOGIC, not the code -- rewrite from scratch in TypeScript following the codebase's established patterns.
- The orchestrator agent's prompt should be minimal (under 100 lines). All intelligence is in the tool's TypeScript code.
- The dispatch validation (D-06) is a real end-to-end test, not a unit test. It must run in an actual OpenCode session.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 04-foundation-infrastructure*
*Context gathered: 2026-03-31*
