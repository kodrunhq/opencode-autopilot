# Phase 16: Autopilot Integration (Skills + Memory) - Context

**Gathered:** 2026-04-02
**Updated:** 2026-04-02 (post Phase 11 research)
**Status:** Ready for planning (scope defined by 11-AGENT-VERDICT.md)

<domain>
## Phase Boundary

Integrate new skills/commands (Phase 14) and memory capabilities (Phase 15) into the existing Autopilot agent. Phase 11 research concluded that all 6 agent candidates (MasterDebugger, Reviewer, Planner, TDD Guide, Doc Updater, Background Task) are better served as skills or commands — no new dedicated agents will be built. This phase focuses on making the Autopilot smarter by leveraging the new capabilities.

</domain>

<decisions>
## Implementation Decisions

### Research verdict (from 11-AGENT-VERDICT.md)
- **D-01:** All 6 agent candidates assessed as SKIP — implement as skills/commands instead (Phase 14)
- **D-02:** Skills > agents for methodology transfer — superpowers (131k stars) validated this pattern
- **D-03:** Phase 16 scoped down from "specialized agents" to "autopilot integration"
- **D-04:** If deliverables are too thin, remaining work merges into Phase 17

### Concrete deliverables
- **D-05:** Memory injection into autopilot dispatch prompts — relevant memories injected per task type
- **D-06:** Skill-aware routing logic — select relevant skills per task type during autonomous pipeline
- **D-07:** Confidence threshold tuning — adjust pipeline depth based on learned patterns from memory

### Quality requirements
- **D-08:** Must integrate with skills from Phase 14 — autopilot should leverage brainstorming, TDD, debugging skills
- **D-09:** Must integrate with memory from Phase 15 — autopilot should benefit from learned project patterns
- **D-10:** Must not regress existing autopilot functionality

### Claude's Discretion
- How memory injection is structured in dispatch prompts
- Skill selection algorithm design
- Confidence threshold calibration values

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
