# Phase 15: Memory System - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Smart memory system with two scopes: project-level patterns (coding conventions, architecture decisions, codebase style) and user-level preferences (workflow habits, tool preferences, communication style). All storage in global config space — repos stay clean. Relevance-scored retrieval to keep context lean. The more users use OpenCode, the better it gets. Replaces existing lesson memory and review memory over time as the unified memory store.

</domain>

<decisions>
## Implementation Decisions

### Memory scopes
- **D-01:** Two scopes: project-level patterns + user-level preferences
- **D-02:** Project patterns: coding conventions, architecture decisions, codebase style, common errors, review feedback patterns
- **D-03:** User preferences: how the user works, preferred tools, common workflows, review style, communication preferences — applies across all projects
- **D-04:** Clear separation between scopes with different retention policies
- **D-05:** Project-isolated — each project's memories are fully separate. Cross-project patterns only exist in the user-level preferences scope (which is global by nature). No smart cross-pollination.

### Storage location
- **D-06:** ALL memory stored in global config space (`~/.config/opencode/memory/`) — NEVER in the project repo
- **D-07:** Project-level memories are keyed by project identifier but stored globally
- **D-08:** Repos must stay clean — "adding memories there is gonna make it feel like a dumpster"

### Storage format
- **D-09:** bun:sqlite with FTS5 as per Phase 11 architecture recommendation
- **D-10:** Human-readable export via oc_memory_status tool, but primary store is SQLite
- **D-11:** FTS5 validation spike MUST complete before schema design (blocking prerequisite)

### Project identification
- **D-12:** SHA-256 hash of absolute project root path as project key. Simple, deterministic, no config needed.

### Capture strategy
- **D-13:** Tap into Phase 13 observability event emitter as the primary capture source. Subscribe to structured events (errors, decisions, model switches) — no separate hook infrastructure.
- **D-14:** AI summarization at capture time — compress each observation to ~50 tokens before storing. Async, non-blocking, falls back to truncation if model unavailable.
- **D-15:** Respect explicit user cues — if user says "remember this pattern", boost observation confidence. If "forget X", mark for deletion. Natural language triggers via the memory observer.

### Retrieval strategy
- **D-16:** Relevance scoring — score memories by relevance to current task/file
- **D-17:** Only inject the top N most relevant memories into context — keeps token usage lean
- **D-18:** 3-layer progressive disclosure (adapted from claude-mem via Phase 11 research): Layer 1 Search (~50-100 tokens), Layer 2 Timeline (~200-500 tokens), Layer 3 Details (~500-1000 tokens)
- **D-19:** 2000-token default injection budget, configurable 500-5000

### User interaction
- **D-20:** Minimal tooling — one tool: oc_memory_status (shows stats, recent memories, storage size). Pruning and management happen automatically.
- **D-21:** No full toolset (search, forget, export) in this phase. Users can inspect SQLite directly if needed.

### Migration
- **D-22:** Skip migration — start fresh. No data migration from existing lesson/review memories.
- **D-23:** Replace over time — new memory system is intended to eventually replace lesson memory (`src/pipeline/learning/`) and review memory (`src/review/memory.ts`) as the unified store. Existing systems keep running in Phase 15 but new code should use the new system.

### Quality bar
- **D-24:** "Gets better the more you use it" — memory accumulation must demonstrably improve agent behavior over time
- **D-25:** Memory system must be thoughtful — store only what's genuinely useful, not everything
- **D-26:** Must not be token-wasteful: "not to store everything in memory and end up consuming tokens for nothing"

### Claude's Discretion
- Memory schema design (exact table definitions, indexes)
- Relevance scoring algorithm details (decay formula, type weights)
- Retention policies per scope (half-life, pruning thresholds)
- How memories are injected into agent prompts (format, placement)
- How to identify what's worth memorizing vs. noise from observability events
- Observation deduplication strategy
- Whether to implement the "instinct graduation" pattern from ECC (observations evolving into skills)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 11 memory architecture (primary design reference)
- `.planning/phases/11-ecosystem-research/11-MEMORY-ARCHITECTURE.md` — Complete architecture recommendation: SQLite schema, FTS5 setup, capture/retrieval/injection layers, decay formulas, token budget math, anti-patterns, migration paths, FTS5 validation spike requirements

### Phase 11 research (competitor analysis)
- `.planning/phases/11-ecosystem-research/` — Gap matrix, memory patterns from claude-mem v10.6.3, ECC instincts

### Phase 13 observability module (capture source)
- `src/observability/types.ts` — SessionEvent types (fallback, error, decision, model_switch)
- `src/observability/event-emitter.ts` — Event emitter to subscribe to
- `src/observability/schemas.ts` — Zod schemas for all event types
- `src/observability/session-logger.ts` — Session logging patterns

### Existing memory systems (replacement targets)
- `src/review/memory.ts` — Per-project review memory (atomic writes, Zod validation, pruning)
- `src/review/schemas.ts` — Review memory Zod schemas
- `src/review/types.ts` — Review memory types

### Plugin infrastructure
- `src/utils/paths.ts` — `getGlobalConfigDir()` helper for `~/.config/opencode/`
- `src/config.ts` — Plugin config schema (will need `memory` section)
- `src/orchestrator/skill-injection.ts` — Skill injection pattern (reusable for memory injection)
- `src/skills/adaptive-injector.ts` — Token-budgeted context injection pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Observability event emitter (`src/observability/event-emitter.ts`) — subscribe for capture events
- Global config directory helper (`getGlobalConfigDir()`) — resolves `~/.config/opencode/`
- Atomic file writes pattern (temp-file-then-rename) — review memory uses this
- Skill injection pattern (`src/orchestrator/skill-injection.ts`) — extend for memory injection
- Token-budgeted context building (`src/skills/adaptive-injector.ts`) — reusable for memory budget enforcement
- Zod schemas for all persisted data — established project pattern

### Established Patterns
- Tool registration: `*Core` function (testable, accepts `baseDir`) + `tool()` wrapper
- Config hook for prompt injection (used by skills)
- Time-based pruning (review memory has `THIRTY_DAYS_MS` pattern)
- Config migration chain for schema evolution (v1->v2->v3 exists)

### Integration Points
- Config hook — inject relevant memories into agent system prompts
- Observability event emitter — subscribe for capture events
- `~/.config/opencode/memory/memory.db` — new SQLite database location
- Plugin config — new `memory` section for settings (injectionBudget, decayHalfLife, etc.)
- `src/index.ts` — register oc_memory_status tool

</code_context>

<specifics>
## Specific Ideas

- "The more they use opencode the better it gets" — this is the north star
- "Not to store everything in memory and end up consuming tokens for nothing" — efficiency is non-negotiable
- "Not in the project repo" — strong feeling about repo cleanliness
- Look at how claude-mem and ECC's instinct system work — learn from their approaches (Phase 11 research)
- Memory should serve both the autopilot autonomous flow AND general opencode usage
- Phase 11 architecture doc is the primary design reference — follow it closely
- FTS5 validation spike is a hard prerequisite before any schema work

</specifics>

<deferred>
## Deferred Ideas

- **Full memory toolset** (search, forget, export) — potential Phase 17 polish if users need more control
- **Smart cross-pollination** — promoting high-confidence patterns across projects with matching stacks
- **Instinct graduation** — observations evolving into skills (ECC pattern). Interesting but needs user validation first.
- **Embedding-in-SQLite** for semantic search — if FTS5 keyword search proves insufficient

</deferred>

---

*Phase: 15-memory-system*
*Context gathered: 2026-04-02*
