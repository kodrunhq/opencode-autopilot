# Phase 11: Ecosystem Research & Gap Analysis - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 11-ecosystem-research
**Areas discussed:** Milestone structure, competitor scope, research output, log detail, CLI navigation, data retention, mock provider, memory scopes, memory storage, retrieval strategy, specialized agents, hooks, flexibility, quality bar

---

## Milestone Structure

| Option | Description | Selected |
|--------|-------------|----------|
| v3.0 Intelligence & Polish | Emphasizes the plugin getting smarter (memory, logging, agents) while filling gaps | :heavy_check_mark: |
| v3.0 Ecosystem Parity | Emphasizes catching up and surpassing what other plugins offer | |
| v2.1 Refinement | Smaller version bump — extends v2.0 rather than new major direction | |

**User's choice:** v3.0 Intelligence & Polish
**Notes:** None

## Research Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Research phase first | Dedicate Phase 11 to deep competitive research, then use findings to define subsequent phases | :heavy_check_mark: |
| Research inline per phase | Each phase does its own targeted research before implementation | |
| Research in parallel | Spawn research for all areas simultaneously, then organize into phases | |

**User's choice:** Research phase first (Recommended)
**Notes:** None

## Phase Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Looks good, let's refine | The 7-phase structure works — drill into details | :heavy_check_mark: |
| Too many phases | Consolidate — 7 phases feels heavy | |
| Reorder or regroup | Grouping doesn't feel right | |

**User's choice:** Looks good, let's refine
**Notes:** None

## Competitor Plugins

| Option | Description | Selected |
|--------|-------------|----------|
| Those three + discover more | Start with GSD, superpowers, oh-my-openagent and let research surface others | :heavy_check_mark: |
| Just those three | Focus deeply on the three mentioned | |

**User's choice:** Those three + everything-claude-code and claude-mem
**Notes:** User added two more plugins: everything-claude-code (massive skill library) and claude-mem (memory management)

## Research Output Format

| Option | Description | Selected |
|--------|-------------|----------|
| Gap matrix | Feature-by-feature comparison with priority recommendations | :heavy_check_mark: |
| Narrative report | Detailed write-up per competitor | |
| Actionable backlog | Skip analysis, go straight to prioritized build list | |

**User's choice:** Gap matrix (Recommended)
**Notes:** None

## Zen Model Display Fix

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, the configure wizard | The /configure wizard shows models without Zen prefix | :heavy_check_mark: |
| It's broader than that | Affects more than just the wizard | |

**User's choice:** Yes, the configure wizard
**Notes:** None

## Log Detail Level

| Option | Description | Selected |
|--------|-------------|----------|
| Structured events | JSON event log per discrete occurrence | |
| Session summary | One human-readable summary per session | |
| Both levels | Structured events + human-readable summaries generated from them | :heavy_check_mark: |

**User's choice:** Both levels
**Notes:** None

## CLI Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| View + filter + search | /logs, /logs last, /logs search, /logs --since 7d | |
| Simple viewer only | /logs and /logs <id> | |
| Full dashboard | Rich TUI with session timeline, error highlighting, filterable columns | :heavy_check_mark: |

**User's choice:** Full dashboard
**Notes:** None

## Data Retention

| Option | Description | Selected |
|--------|-------------|----------|
| Time-based (30 days) | Auto-prune logs older than 30 days, configurable | :heavy_check_mark: |
| Count-based (last 100) | Keep last 100 sessions | |
| Size-based (50MB cap) | Prune oldest when size cap exceeded | |

**User's choice:** Time-based (30 days)
**Notes:** None

## Mock Provider

| Option | Description | Selected |
|--------|-------------|----------|
| Configurable failure mode | Simulate specific failures: rate limit, quota, timeout, malformed response | :heavy_check_mark: |
| Always-fail provider | Simple always-error provider | |
| Chaos mode | Random failures at configurable probability | |

**User's choice:** Configurable failure mode
**Notes:** None

## Memory Scopes

| Option | Description | Selected |
|--------|-------------|----------|
| Project patterns | Learn coding patterns per project | |
| User preferences | Learn how the user works across all projects | |
| Both scopes | Project-level patterns + user-level preferences with clear separation | :heavy_check_mark: |

**User's choice:** Both scopes
**Notes:** None

## Memory Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Structured files | Markdown/JSON in ~/.config/opencode/memory/ and .opencode/memory/ | |
| SQLite database | Lightweight DB for fast querying | |
| Hybrid | Markdown files as source of truth with index/cache for fast retrieval | :heavy_check_mark: |

**User's choice:** Hybrid — but NOT in project repos
**Notes:** "I'm not sure I like the idea of adding memories to the projects github repo, it should be reserved for the software, adding memories there is gonna make it feel like a dumpster"

## Memory Retrieval

| Option | Description | Selected |
|--------|-------------|----------|
| Relevance scoring | Score by relevance to current task, inject top N only | :heavy_check_mark: |
| Always inject core | Always include core preferences, add task-specific contextually | |
| User controls it | Tags: 'always', 'contextual', 'archive' | |

**User's choice:** Relevance scoring
**Notes:** None

## Specialized Agents

| Option | Description | Selected |
|--------|-------------|----------|
| Research decides | Phase 11 determines if agents fill a real gap | :heavy_check_mark: |
| Lean toward yes | Dedicated agents would be a significant upgrade | |
| Lean toward no | Too much overlap with existing tools | |

**User's choice:** Research decides
**Notes:** None

## Hooks Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, hooks are important | Whatever research identifies as valuable | |
| Only if high-value | Include only if research shows significant gap | :heavy_check_mark: |
| Separate phase if needed | Create dedicated phase for hook gaps | |

**User's choice:** Only if high-value
**Notes:** None

## Research Flexibility

| Option | Description | Selected |
|--------|-------------|----------|
| Research can propose new phases | If research reveals major gaps, recommend adding phases | :heavy_check_mark: |
| Absorb into existing phases | No new phases after roadmap lock | |
| Backlog for v3.1 | Unexpected findings go to backlog | |

**User's choice:** Research can propose new phases
**Notes:** None

## Quality Bar

| Option | Description | Selected |
|--------|-------------|----------|
| Production-ready release | Fully tested, documented, polished | |
| Solid beta | Core features work, rough edges acceptable | |
| Best-in-class | Not just feature-complete but genuinely better than competitors | :heavy_check_mark: |

**User's choice:** "Production-ready and best in class, there's no room for failure here, let's do this perfectly and do it right, no matter what"
**Notes:** Strong emphasis on perfection — no shortcuts

---

## Claude's Discretion

- Research methodology and tool selection for Phase 11
- Gap matrix structure and scoring system
- JSON event schema for session logging
- TUI dashboard layout and interactions
- Memory schema design and relevance scoring algorithm
- Final agent list for Phase 16 (research-dependent)
- Which hooks to implement in Phase 17

## Deferred Ideas

None — discussion stayed within milestone scope
