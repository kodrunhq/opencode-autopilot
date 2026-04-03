# Phase 20: New Primary Agents - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Add three new primary agents — Debugger, Planner, and Code Reviewer — to the Tab cycle alongside the existing Autopilot agent. Each agent embeds its relevant skill(s) directly in its prompt and has role-scoped permissions. Tab-cycle ordering follows OpenCode's mechanism (research needed to confirm).

</domain>

<decisions>
## Implementation Decisions

### Skill Loading Strategy
- **D-01:** Embed skill content statically in each agent's source file as template literal content. No file I/O at load time, no runtime dependency on the adaptive injector. Debugger embeds `systematic-debugging`, Planner embeds `plan-writing` + `plan-executing`, Reviewer embeds `code-review`.
- **D-02:** Skills are copy-pasted into agent source, not read from `assets/skills/` at runtime. If a skill changes, the corresponding agent source must be updated too. This trades DRY for simplicity and zero I/O.

### Tab-Cycle Ordering
- **D-03:** Research OpenCode source code to understand the exact Tab-cycle ordering mechanism before committing to a strategy. This is a prerequisite task — don't assume insertion order or alphabetical.
- **D-04:** If OpenCode sorts alphabetically, accept the natural order of the chosen names. The names autopilot/debugger/planner/reviewer already sort alphabetically in the desired order (a < d < p < r).

### Agent Naming
- **D-05:** Use plain names: `debugger`, `planner`, `reviewer`. Consistent with existing user-facing agents (researcher, metaprompter, documenter, autopilot). No `oc-` prefix — that's reserved for pipeline agents.
- **D-06:** Keep the existing `pr-reviewer` subagent alongside the new `reviewer` primary agent. Different scopes: `reviewer` is interactive code review with oc_review tool invocation; `pr-reviewer` is GitHub PR-specific review via gh commands. No overlap.

### Agent Permissions (Role-Scoped)
- **D-07:** Debugger — `read: allow`, `bash: allow`, `edit: allow`. Can inspect code, run tests/reproduce bugs, and apply fixes. No write (new files) or webfetch.
- **D-08:** Planner — `read: allow`, `write: allow`, `bash: allow`. Can analyze codebase, run read-only commands for context (git log, ls, etc.), and write plan files. No edit or webfetch.
- **D-09:** Reviewer — `read: allow`, `bash: allow`. Can read code and run git/oc_review commands. No edit (review only, no fixes), no write, no webfetch.

### Agent Behavior
- **D-10:** Code Reviewer agent auto-invokes oc_review tool when the user asks for a review. Fully autonomous like the Autopilot pattern — no guidance-only mode.
- **D-11:** All three agents use `mode: "all"` to appear in both Tab cycle and @ autocomplete.

### Claude's Discretion
- Exact prompt content for each agent (within the skill-embedded, role-scoped constraints)
- `maxSteps` value for each agent (Autopilot uses 50 — new agents likely need fewer)
- Whether to add `temperature` settings
- Internal structure of agent source files (single export vs helper functions)
- How Planner structures its output (markdown plan files vs inline guidance)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Agent Registration
- `src/agents/index.ts` — Config hook entry point, `agents` map, `registerAgents()` function
- `src/agents/autopilot.ts` — Reference primary agent pattern: `mode: "all"`, prompt structure, permission shape
- `src/agents/pipeline/index.ts` — Pipeline agent map (for contrast — these are `mode: "subagent"`)

### Skills to Embed
- `assets/skills/systematic-debugging/SKILL.md` — Content to embed in Debugger agent prompt
- `assets/skills/plan-writing/SKILL.md` — Content to embed in Planner agent prompt
- `assets/skills/plan-executing/SKILL.md` — Content to embed in Planner agent prompt
- `assets/skills/code-review/SKILL.md` — Content to embed in Reviewer agent prompt

### Existing Agent Patterns
- `src/agents/researcher.ts` — Subagent pattern (for contrast with primary)
- `src/agents/pr-reviewer.ts` — PR reviewer subagent (coexists with new reviewer primary)

### OpenCode Tab-Cycle Research (D-03)
- OpenCode source code — research required to confirm Tab-cycle ordering mechanism
- `src/agents/index.ts` `agents` const — registration order of agents in the map

### Review Tool
- `src/tools/review.ts` — `oc_review` tool that the Reviewer agent will auto-invoke (D-10)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `agents` map in `src/agents/index.ts`: currently 5 entries — will grow to 8 with new primary agents
- `registerAgents()` function handles model resolution and deep-copy — works for any agent config shape
- `autopilotAgent` in `src/agents/autopilot.ts`: reference pattern for `mode: "all"` primary agents with full prompts
- 4 skill SKILL.md files ready to embed: systematic-debugging, plan-writing, plan-executing, code-review

### Established Patterns
- Agent configs are `Readonly<AgentConfig>` with `Object.freeze()` — immutable after creation
- Prompts are multi-line template literals with structured sections (## headings, rules, examples)
- Permission objects use `"allow"` / `"deny"` / `"ask"` values
- Config hook registers all agents in one pass via `registerAgents(agentMap, config, groups, overrides)`

### Integration Points
- `agents` const in `src/agents/index.ts` — add three new entries (debugger, planner, reviewer)
- `configHook()` — no changes needed (already calls `registerAgents(agents, ...)`)
- Agent module files: create `src/agents/debugger.ts`, `src/agents/planner.ts`, `src/agents/reviewer.ts`
- Tests: extend `tests/agents-visibility.test.ts` to cover new primary agents

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for prompt design within the constraints above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 20-new-primary-agents*
*Context gathered: 2026-04-03*
