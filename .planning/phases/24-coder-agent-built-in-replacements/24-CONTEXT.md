# Phase 24: Coder Agent, Hash-Anchored Edits & Wave Automation - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a dedicated primary Coder agent (replaces built-in Build, routes /oc-tdd), implement a hash-anchored edit validation tool (`oc_hashline_edit`) for autonomous session safety, automate wave assignment from task dependencies in the build handler, suppress OpenCode's built-in Plan agent via config hook, and run a wiring audit to verify all agents/commands/skills are properly connected.

</domain>

<decisions>
## Implementation Decisions

### Coder Agent
- **D-01:** Agent named `coder`. Tab cycle becomes: autopilot, coder, debugger, planner, reviewer.
- **D-02:** Pure implementer scope — writes code, runs tests, fixes builds. Does NOT self-review or handle frontend design.
- **D-03:** Statically embeds `tdd-workflow` and `coding-standards` skills (same pattern as Phase 20: strip YAML frontmatter, embed full content).
- **D-04:** Permissions: `read: allow`, `write: allow`, `edit: allow`, `bash: allow`. No webfetch/websearch — that's the researcher's job.
- **D-05:** Mode: `"all"` — appears in both Tab cycle and @ autocomplete.
- **D-06:** Routes `/oc-tdd` command to this agent via `agent: coder` frontmatter.

### Hash-Anchored Edit Tool
- **D-07:** New standalone `oc_hashline_edit` tool. Coexists with OpenCode's built-in edit. Agents are prompted to prefer it for autonomous/long-running sessions.
- **D-08:** Uses omo's CID alphabet (`ZPMQVRWSNKTXJBYH`) for LINE#ID format. Two-char hashes (e.g., `42#VK`). 16² = 256 unique values per file.
- **D-09:** Validation pipeline: parse LINE#ID → compute hash for current file content → compare → match = proceed, mismatch = reject with updated anchors.
- **D-10:** Three operation types: `replace` (single line or range), `append` (insert after anchor), `prepend` (insert before anchor).
- **D-11:** Error recovery returns updated LINE#ID references so the agent can retry with correct anchors.
- **D-12:** All code-writing agents use this tool: Coder, Autopilot, Debugger, and pipeline oc-implementer. Agent prompts updated to prefer `oc_hashline_edit` over built-in edit.

### Wave Auto-Assignment
- **D-13:** Add `depends_on: z.array(z.number()).default([])` field to `taskSchema` in `src/orchestrator/schemas.ts`.
- **D-14:** New `src/orchestrator/wave-assigner.ts` — topological sort of tasks by `depends_on`, automatic wave number computation. Reuse pattern from `src/skills/dependency-resolver.ts`.
- **D-15:** Build handler (`src/orchestrator/handlers/build.ts`) calls wave-assigner before dispatching. Planners declare deps, system computes waves.
- **D-16:** Git-based completion verification: after `dispatch_multi` completes, verify each task made commits. If no commits found, mark as potentially failed and retry once.

### Built-in Replacements
- **D-17:** Suppress OpenCode's built-in Plan agent via config hook. Research OpenCode's config API to find the mechanism (e.g., setting agent to `null` or `disabled`).
- **D-18:** Custom Planner already exists and is sufficient — built-in Plan is redundant Tab clutter.

### Wiring Audit
- **D-19:** Final plan in the phase: run oc_stocktake + oc_doctor, verify all commands routed to agents, all agents registered in config hook, all skills loading via adaptive injector. Fix any gaps found.
- **D-20:** Currently `/oc-tdd` is the only unrouted command — will be fixed by D-06 (routes to coder agent).

### Claude's Discretion
- Exact system prompt content for Coder agent (within the skill-embedded, role-scoped constraints)
- `maxSteps` value for Coder agent (reference: Autopilot uses 50)
- Hash computation implementation details (hashing algorithm for CID alphabet mapping)
- Bottom-up edit ordering strategy (highest line numbers first vs sequential)
- Wave-assigner cycle detection and error handling
- Git verification implementation (commit message parsing vs ref counting)
- How to detect/suppress built-in Plan agent in OpenCode's config API

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Agent Registration (reference pattern)
- `src/agents/index.ts` — Config hook entry point, `agents` map, `registerAgents()` function
- `src/agents/autopilot.ts` — Reference primary agent pattern (mode: "all", prompt structure, permissions)
- `src/agents/debugger.ts` — Another primary agent reference (Phase 20 pattern)
- `src/agents/planner.ts` — Primary agent with plan-writing + plan-executing skills embedded

### Skills to Embed in Coder
- `assets/skills/tdd-workflow/SKILL.md` — TDD workflow skill content to embed
- `assets/skills/coding-standards/SKILL.md` — Coding standards skill content to embed

### Hash-Anchored Edits Research
- `docs/gap-analysis-deep-dive.md` §2 — Full hash-anchored edit specification (LINE#ID format, CID alphabet, validation pipeline, error recovery, edit operations)

### Wave Execution (existing infrastructure)
- `src/orchestrator/schemas.ts` — Task schema with existing `wave` field (add `depends_on`)
- `src/orchestrator/plan.ts` — `groupByWave()`, `countByStatus()`, `indexTasks()` utilities
- `src/orchestrator/handlers/build.ts` — Wave-aware build handler with `dispatch_multi`
- `src/skills/dependency-resolver.ts` — Reusable topological sort with cycle detection

### Commands to Update
- `assets/commands/oc-tdd.md` — Needs `agent: coder` frontmatter added

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/skills/dependency-resolver.ts` — Topological sort with cycle detection. Reuse pattern for task wave assignment.
- `src/orchestrator/handlers/build.ts` — Already has `findCurrentWave()`, `findPendingTasks()`, `isWaveComplete()`, and `dispatch_multi` action. Wave auto-assignment plugs into this.
- `src/agents/autopilot.ts` — Reference pattern for primary agent with skill embedding.

### Established Patterns
- Static skill embedding: Strip YAML frontmatter, embed full content as template literal (Phase 20 pattern)
- Tool registration: `*Core` function (testable) + `tool()` wrapper (calls core with `getGlobalConfigDir()`)
- Atomic file writes: `writeFile(path, content, { flag: "wx" })` for no-clobber
- Immutability: `Object.freeze()`, `readonly` arrays, conditional spreads

### Integration Points
- `src/agents/index.ts` — Add `coder` to the `agents` map
- `src/orchestrator/schemas.ts` — Extend `taskSchema` with `depends_on`
- `src/orchestrator/handlers/build.ts` — Call wave-assigner before dispatch
- `src/tools/` — New `hashline-edit.ts` tool file
- `assets/commands/oc-tdd.md` — Add `agent: coder` frontmatter

</code_context>

<specifics>
## Specific Ideas

- Hash format must match omo's CID alphabet exactly (`ZPMQVRWSNKTXJBYH`) for ecosystem compatibility
- Coder agent embeds tdd-workflow + coding-standards — no other skills
- All code-writing agents (coder, autopilot, debugger, oc-implementer) get `oc_hashline_edit` in their prompts
- Wave auto-assignment reuses the proven DFS topological sort pattern from `dependency-resolver.ts`

</specifics>

<deferred>
## Deferred Ideas

- **Content expansion (skills, commands, agents)** — User wants more skills and commands to match competitors. Track as Phase 25. Current count: 18 skills, 11 commands. Competitors have 50-150+ skills (though many are bloat per gap analysis).
- **Frontend engineer agent** — The `frontend-design` skill exists but has no dedicated agent. Could be added in Phase 25's content expansion.
- **TDD enforcement hook** — A PostToolUse hook that warns when Write tool is used without prior test execution. Partial overlap with tdd-workflow skill but adds runtime enforcement. Consider for Phase 25.
- **Context engineering improvements** — Selective history loading, structured context files with size limits. Our token budgeting is already strong; this is incremental. Future phase.

</deferred>

---

*Phase: 24-coder-agent-built-in-replacements*
*Context gathered: 2026-04-03*
