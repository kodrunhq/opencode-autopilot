# Phase 15: Memory System - Context

**Gathered:** 2026-04-02
**Status:** Pending Phase 11 research

<domain>
## Phase Boundary

Smart memory system with two scopes: project-level patterns (coding conventions, architecture decisions, codebase style) and user-level preferences (workflow habits, tool preferences, communication style). All storage in global config space — repos stay clean. Relevance-scored retrieval to keep context lean. The more users use OpenCode, the better it gets.

</domain>

<decisions>
## Implementation Decisions

### Memory scopes
- **D-01:** Two scopes: project-level patterns + user-level preferences
- **D-02:** Project patterns: coding conventions, architecture decisions, codebase style, common errors, review feedback patterns
- **D-03:** User preferences: how the user works, preferred tools, common workflows, review style, communication preferences — applies across all projects
- **D-04:** Clear separation between scopes with different retention policies

### Storage location
- **D-05:** ALL memory stored in global config space (`~/.config/opencode/memory/`) — NEVER in the project repo
- **D-06:** Project-level memories are keyed by project identifier but stored globally
- **D-07:** Repos must stay clean — "adding memories there is gonna make it feel like a dumpster"

### Storage format
- **D-08:** Hybrid approach: markdown/JSON files as source of truth, with an index/cache for fast retrieval
- **D-09:** Human-readable files so users can inspect and edit their memories
- **D-10:** Index enables fast lookup without reading all memory files

### Retrieval strategy
- **D-11:** Relevance scoring — score memories by relevance to current task/file
- **D-12:** Only inject the top N most relevant memories into context — keeps token usage lean
- **D-13:** Must be token-efficient: "not to store everything in memory and end up consuming tokens for nothing"

### Quality bar
- **D-14:** "Gets better the more you use it" — memory accumulation must demonstrably improve agent behavior over time
- **D-15:** Memory system must be thoughtful — store only what's genuinely useful, not everything

### Claude's Discretion
- Memory schema design (what fields, how to categorize)
- Relevance scoring algorithm
- Retention policies per scope
- How memories are injected into agent prompts (format, placement)
- How to identify what's worth memorizing vs. noise
- Whether to use Phase 11 findings on claude-mem and ECC instincts as inspiration

</decisions>

<specifics>
## Specific Ideas

- "The more they use opencode the better it gets" — this is the north star
- "Not to store everything in memory and end up consuming tokens for nothing" — efficiency is non-negotiable
- "Not in the project repo" — strong feeling about repo cleanliness
- Look at how claude-mem and ECC's instinct system work — learn from their approaches
- Memory should serve both the autopilot autonomous flow AND general opencode usage

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 11 research output (memory patterns from competitors)
- `.planning/phases/11-ecosystem-research/` — Memory system analysis from claude-mem, ECC instincts, and others

### Existing learning system
- `src/pipeline/learning/` — Institutional memory for retrospective lessons (Phase 7)
- `src/pipeline/learning/types.ts` — Lesson schema, domain categories
- `src/pipeline/learning/memory.ts` — Load/save/prune with atomic writes

### Plugin config and global paths
- `src/utils/paths.ts` — `getGlobalConfigDir()` helper
- `src/config.ts` — Config schema (will need extension for memory settings)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Lesson memory system (`src/pipeline/learning/`) — already has load/save/prune pattern, could be generalized
- Global config directory helper (`getGlobalConfigDir()`) — already resolves `~/.config/opencode/`
- Atomic file writes pattern — use for memory persistence
- Config hook — could inject memory context into agent prompts

### Established Patterns
- Zod schemas for all persisted data
- Atomic writes via temp-file-then-rename
- Time-based pruning (lesson decay in Phase 7)
- Config migration chain for schema evolution

### Integration Points
- Config hook — inject relevant memories into agent system prompts
- Event hooks — capture events that generate memories
- `~/.config/opencode/memory/` — new directory for memory storage
- Plugin config — memory settings (retention, max tokens, scoring thresholds)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-memory-system*
*Context gathered: 2026-04-02*
