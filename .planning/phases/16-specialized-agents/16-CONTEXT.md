# Phase 16: Specialized Agents - Context

**Gathered:** 2026-04-02
**Status:** Pending Phase 11 research (research decides scope)

<domain>
## Phase Boundary

Implement specialized primary agents IF Phase 11 research validates clear value over existing tools. Candidates: MasterDebugger (systematic debugging with autonomous flow), Reviewer (comprehensive code review with skills integration). Research must demonstrate these fill a real gap — not just "nice to have."

</domain>

<decisions>
## Implementation Decisions

### Scope gate
- **D-01:** Research decides — Phase 11 must demonstrate clear value before any agent is built
- **D-02:** "Let's actually be critical about it, investigate, see if it makes sense and adds value"
- **D-03:** If research shows existing tools (built-in OpenCode agents, our review engine, etc.) already cover the need, this phase may be reduced or eliminated
- **D-04:** Each proposed agent must pass the test: "Does this do something meaningfully better than what users already have?"

### Candidate agents
- **D-05:** MasterDebugger — systematic debugging with proper skills, autonomous flow, breakpoint analysis, root cause identification
- **D-06:** Reviewer — comprehensive code review beyond what the review engine does, with skill integration and memory awareness
- **D-07:** Phase 11 research may propose entirely different agent archetypes that better fill gaps

### Quality requirements (if agents are built)
- **D-08:** Must be primary agents (mode: primary or mode: all) — directly accessible to users, not hidden subagents
- **D-09:** Must have proper skills integration — agents should use relevant skills during their workflow
- **D-10:** Must work with the autonomous flow — not just one-shot tools
- **D-11:** Must integrate with the memory system (Phase 15) — agents should benefit from learned patterns

### Claude's Discretion
- Final agent list (based on Phase 11 research findings)
- Agent prompt design and tool permissions
- Whether to build 0, 1, 2, or more agents
- Skill integration approach per agent

</decisions>

<specifics>
## Specific Ideas

- "A MasterDebugger and Reviewer that do those things perfectly, with proper skills, autonomous flow"
- "Just a thought, let's actually be critical about it" — user explicitly wants rigor, not assumption
- If built, these should feel like premium additions, not duplicates of existing functionality

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 11 research output (agent gap analysis)
- `.planning/phases/11-ecosystem-research/` — Agent archetype analysis, competitor agent catalogs

### Existing agent system
- `assets/agents/` — All current bundled agents (what we already have)
- `src/pipeline/agents/` — Pipeline agent configs and dispatch
- `src/config.ts` — Config hook agent injection pattern

### Review engine (potential overlap with Reviewer agent)
- `src/pipeline/review/` — Multi-agent review system already in place

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Config hook agent injection — established pattern for registering new agents
- Agent template (`src/templates/agent-template.ts`) — generates agent markdown with frontmatter
- Pipeline agent configs — pattern for structured agent prompts with Role/Steps/Output/Constraints

### Established Patterns
- Agent modes: primary (Tab cycle), subagent (@ only), hidden (internal), all (both)
- YAML frontmatter for agent metadata (model, tools, description)
- Structured prompt format from Phase 10: Role, Steps, Output Format, Constraints, Error Recovery

### Integration Points
- Config hook in `src/index.ts` — where new agents get injected
- Memory system (Phase 15) — agents should read relevant memories
- Skills system — agents should reference relevant skills in their prompts

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-specialized-agents*
*Context gathered: 2026-04-02*
