# Phase 11: Ecosystem Research & Gap Analysis - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Deep competitive research across the OpenCode plugin ecosystem to produce a gap matrix identifying missing skills, commands, hooks, agents, memory patterns, and workflows. This phase outputs a research report and gap matrix that defines the exact scope of Phases 12-17. No implementation in this phase — research and analysis only.

</domain>

<decisions>
## Implementation Decisions

### Milestone scope
- **D-01:** New milestone: **v3.0 Intelligence & Polish** — plugin goes from feature-complete to best-in-class
- **D-02:** Quality bar is production-ready and best-in-class — no shortcuts, no rough edges, no "good enough"
- **D-03:** Research can propose new phases beyond the initial 11-17 structure if significant gaps are discovered
- **D-04:** Phase 11 findings directly define the implementation scope of Phases 14 (Skills & Commands), 15 (Memory System), and 16 (Specialized Agents)

### Competitor plugins to analyze
- **D-05:** Five plugins to research in depth:
  1. **get-shit-done (GSD)** — workflow orchestration, state management, phase execution
  2. **superpowers** — brainstorming, TDD, code review, git worktrees, plan mode
  3. **oh-my-openagent** — agent injection, config hooks, curated agents
  4. **everything-claude-code (ECC)** — massive skill library (300+), continuous learning, instincts
  5. **claude-mem** — memory management, persistence, recall mechanisms

### Research output format
- **D-06:** Gap matrix — feature-by-feature comparison showing what each plugin has vs. what we have, with priority recommendations
- **D-07:** Matrix should cover: skills, commands, hooks, agents, memory, workflows, observability, testing tools
- **D-08:** Each gap should have a priority rating (CRITICAL/HIGH/MEDIUM/LOW) and a recommendation for which phase should address it

### Research areas mapped to user items
- **D-09:** Skills gap (#4) — identify missing skills, especially brainstorming-style creative tools, research what workflows users need
- **D-10:** Commands gap (#5) — PR comment review, update-docs, validate-agents-md, and whatever else research surfaces
- **D-11:** Competitive flows & hooks (#6) — what automation patterns (pre-commit, post-session, auto-format) do competitors offer that we don't
- **D-12:** Specialized agents (#8) — critical assessment of MasterDebugger, Reviewer, and any other agent archetypes. Research decides whether to build them, not gut feeling. Must demonstrate clear value over existing tools
- **D-13:** Memory patterns — how do competitors handle memory? What works, what's token-wasteful? Inform Phase 15 architecture

### Claude's Discretion
- Research methodology and tool selection (web search, GitHub code search, plugin source reading)
- How to structure the gap matrix columns and scoring
- Which additional plugins to glance at beyond the five listed (if any seem relevant during research)
- Depth of analysis per competitor — deeper for more relevant plugins

</decisions>

<specifics>
## Specific Ideas

- User wants to "think outside the box" — research should surface things we haven't thought of, not just confirm the 8 items listed
- Research should be creative and forward-looking, not just feature matching
- The plugin should "set the standard" — research should identify opportunities to do things BETTER than competitors, not just match them
- Pay attention to memory systems (claude-mem, ECC instincts) — this is a key differentiator for v3.0
- ECC has hundreds of skills — don't just list them all, identify the PATTERNS and categories that matter

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Plugin architecture
- `.planning/PROJECT.md` — Core value proposition, current architecture, context about OpenCode plugin system
- `.planning/REQUIREMENTS.md` — Existing requirements (v1.0 + v2.0), out-of-scope items
- `.planning/ROADMAP.md` — Full phase history, what was built in v1.0 and v2.0
- `CLAUDE.md` — Architecture overview, key patterns, constraints

### Existing implementation (know what we have before finding gaps)
- `src/index.ts` — Plugin entry point, all registered tools and hooks
- `src/tools/` — All tool implementations (what tools exist today)
- `assets/agents/` — All bundled agent definitions
- `assets/commands/` — All bundled command definitions
- `assets/skills/` — All bundled skill definitions

### Prior phase context (decisions that constrain research)
- `.planning/phases/09-model-fallback-integration/` — Fallback system architecture (relevant to observability phase)
- `.planning/phases/10-ux-polish-metaprompting/` — Agent modes, prompt structure, skill injection (relevant to skills/agents research)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Config hook system (`src/config.ts`) — already injects agents programmatically, can be extended for new agents
- Asset installer (`src/installer.ts`) — copies bundled assets, could be extended for new skills/commands
- Tool registration pattern (`src/tools/*.ts`) — established pattern for adding new tools
- Template system (`src/templates/`) — generates markdown for agents/skills/commands

### Established Patterns
- Tool-returns-instruction dispatch pattern — all orchestrator tools follow this
- Zod schema validation on all tool inputs and config
- Atomic file writes (`wx` flag) for no-clobber creation
- Config hook for agent injection (not filesystem copying)

### Integration Points
- Plugin entry (`src/index.ts`) — where new tools/hooks get registered
- Config hook chain — where new agents would be injected
- Event hook system — where logging/observability would tap in
- `~/.config/opencode/` — global config directory for user-scoped data (logs, memory)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-ecosystem-research*
*Context gathered: 2026-04-02*
