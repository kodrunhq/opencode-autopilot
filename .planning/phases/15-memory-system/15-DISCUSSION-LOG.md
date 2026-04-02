# Phase 15: Memory System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 15-memory-system
**Areas discussed:** Capture triggers, User interaction, Migration strategy, Scope boundaries

---

## Capture Triggers

| Option | Description | Selected |
|--------|-------------|----------|
| Tap observability (Recommended) | Subscribe to Phase 13's event emitter as the primary capture source | ✓ |
| Separate hooks | Register independent plugin hooks for memory capture | |
| Hybrid | Observability events + dedicated hooks for explicit memories | |
| You decide | Claude picks | |

**User's choice:** Tap observability
**Notes:** Phase 13 already emits structured events — no need to duplicate infrastructure.

### AI Summarization Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Capture-time (Recommended) | Compress each observation to ~50 tokens before storing | ✓ |
| Retrieval-time | Store full content, compress when injecting | |
| Skip summarization | No AI compression at all | |
| You decide | Claude picks | |

**User's choice:** Capture-time
**Notes:** Saves DB space and makes retrieval faster.

---

## User Interaction

### Tooling Level

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal tools (Recommended) | One tool: oc_memory_status (stats, recent memories, storage size) | ✓ |
| Full toolset | Multiple tools: search, forget, status, export | |
| Zero tools | Completely invisible, no user-facing tools | |
| You decide | Claude picks | |

**User's choice:** Minimal tools
**Notes:** One status tool is enough. Users can inspect SQLite directly if curious.

### Explicit User Cues

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, respect explicit cues | Boost confidence on "remember this", mark deletion on "forget X" | ✓ |
| No, automatic only | Purely event-driven capture | |
| You decide | Claude picks | |

**User's choice:** Yes, respect explicit cues
**Notes:** Natural language triggers via the memory observer.

---

## Migration Strategy

### Data Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy auto-migrate (Recommended) | Auto-migrate on first session after deploy | |
| Opt-in prompt | Prompt user before migrating | |
| Skip migration | Start fresh, no data migration | ✓ |
| You decide | Claude picks | |

**User's choice:** Skip migration
**Notes:** Start fresh. Simplifies implementation significantly.

### Coexistence

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both running | Existing systems stay untouched, new system is additive | |
| Replace over time | New system eventually replaces lesson memory and review memory | ✓ |
| You decide | Claude picks | |

**User's choice:** Replace over time
**Notes:** Unified memory store long-term. Existing systems keep running in Phase 15 but new code uses the new system.

---

## Scope Boundaries

### Project Identification

| Option | Description | Selected |
|--------|-------------|----------|
| Directory path hash (Recommended) | SHA-256 of absolute project root path | ✓ |
| Git remote URL | Use git remote origin URL | |
| Explicit config | User sets project ID manually | |
| You decide | Claude picks | |

**User's choice:** Directory path hash
**Notes:** Simple, deterministic, no config needed.

### Cross-Project Learning

| Option | Description | Selected |
|--------|-------------|----------|
| Project-isolated (Recommended) | Each project's memories fully separate | ✓ |
| Smart cross-pollination | Promote patterns appearing in 2+ projects with matching stacks | |
| You decide | Claude picks | |

**User's choice:** Project-isolated
**Notes:** Cross-project patterns only exist in user-level preferences (global by nature). No automatic cross-pollination.

---

## Claude's Discretion

- Memory schema design (exact table definitions, indexes)
- Relevance scoring algorithm details
- Retention policies per scope
- Injection format and placement in prompts
- Signal vs noise filtering from observability events
- Observation deduplication strategy
- Whether to implement instinct graduation pattern

## Deferred Ideas

- Full memory toolset (search, forget, export) — potential Phase 17
- Smart cross-pollination across projects
- Instinct graduation (observations evolving into skills)
- Embedding-in-SQLite for semantic search
