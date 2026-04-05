# v7.0 Strategic Roadmap: OMO Feature Parity

**Created**: 2026-04-05
**Milestone**: v7.0 — Phases 27-43
**Scope**: Architecture simplification + OMO feature parity with full autonomy

---

## Executive Summary

v7.0 delivers **production-grade OMO feature parity** through 17 phases:

| # | Phase | Pillar | Key Deliverable | Effort |
|---|-------|--------|-----------------|--------|
| 27 | Architecture Simplification | Foundation | Split god files, flatten config | 3 plans |
| 28 | Concurrency Foundation | Reliability | Prove thread-safety, fix races | 2 plans |
| 29 | Determinism Guarantee | Reliability | Time-independent scoring, replay | 2 plans |
| 30 | UX Visibility | Experience | Phase progress, summaries | 2 plans |
| 31 | Logging Foundation | Observability | Structured event logging | 2 plans |
| 32 | Configuration v7 | Foundation | Extended schema for new subsystems | 2 plans |
| 33 | Concurrency Extended | Reliability | SQLite contention tests proven | 2 plans |
| 34 | Unified Logging | Observability | Structured logging system | 2 plans |
| 35 | Background Agent Manager | Parallelism | 5+ concurrent tasks | 3 plans |
| 36 | Ralph Loop | Autonomy | Agent loops until done | 2 plans |
| 37 | Category Routing | Performance | Intelligent model/agent selection | 2 plans |
| 38 | Session Recovery | Reliability | 99% uptime through auto-recovery | 2 plans |
| 39 | Context Injection | Intelligence | AGENTS.md + README.md auto-injection | 2 plans |
| 40 | UX/UI Surfaces | Visibility | Toasts, progress, session summary | 2 plans |
| 41 | Agent Consolidation | Simplification | 21→11 utility + review consolidation | 2 plans |
| 42 | Skill-Embedded MCPs | Extensibility | On-demand MCP servers per skill | 2 plans |
| 43 | Integration + Polish | Quality | E2E tests, documentation, release | 2 plans |

**Total**: 35 plans, ~100 tasks, 25-30 days

---

## Architecture Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| AD-01 | Split god files first | 1000+ line files are unmaintainable - must simplify before adding features |
| AD-02 | Concurrency tests before parallel agents | Can't run 5 agents safely without proving thread-safety |
| AD-03 | Determinism before autonomy | Loops can't work if results vary on replay |
| AD-04 | UX before advanced features | Users need visibility into what's happening |
| AD-05 | Log foundation before new subsystems | All new code needs structured logging |
| AD-09 | v6 pillars (27-31) are prerequisites | Building parallel agents on god files is technical debt squared |
| AD-10 | Config v7 extends v6 | Add new sections via v6→v7 migration, maintain backward compat |
| AD-11 | Background Agent Manager uses existing SQLite | Reuse `bun:sqlite`, new `background_tasks` table |
| AD-12 | Ralph Loop as a hook | Loop autonomy uses `experimental.chat.system.transform` |
| AD-13 | Category routing via tool delegation | New `oc_delegate` tool routes tasks by category |
| AD-14 | Session recovery extends fallback system | Same error classifier, broader recovery actions |
| AD-15 | Context injection stacks | Memory + AGENTS.md + README.md + skills, token budgets per source |
| AD-16 | Agent consolidation includes review | Consolidate 21→fewer reviewers, preserve adversarial + red-team |
| AD-17 | TDD-first for new subsystems | Write test stubs first, then implement |
| AD-18 | MCP skills are optional | Skill-embedded MCPs only load when `config.mcp.enabled = true` |
| AD-19 | Sequential phase execution | Phases 36/37/38 sequential (not parallel) for easier review |
| AD-20 | Hybrid TDD approach | TDD for new subsystems, extract-then-test for modifications |

---

## Architecture Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| AD-09 | v6 pillars (27-31) are prerequisites | Building parallel agents on god files is technical debt squared |
| AD-10 | Config v7 extends v6 | Add new sections via v6→v7 migration, maintain backward compat |
| AD-11 | Background Agent Manager uses existing SQLite | Reuse `bun:sqlite`, new `background_tasks` table |
| AD-12 | Ralph Loop as a hook | Loop autonomy uses `experimental.chat.system.transform` |
| AD-13 | Category routing via tool delegation | New `oc_delegate` tool routes tasks by category |
| AD-14 | Session recovery extends fallback system | Same error classifier, broader recovery actions |
| AD-15 | Context injection stacks | Memory + AGENTS.md + README.md + skills, token budgets per source |
| AD-16 | Agent consolidation preserves review engine | 21 review agents stay, pipeline agents consolidated |
| AD-17 | TDD-first for new subsystems | Write test stubs first, then implement |
| AD-18 | MCP skills are optional | Skill-embedded MCPs only load when `config.mcp.enabled = true` |

---

## Dependency Graph

```
Phase 27 (Architecture Simplification)
         │
         ▼
Phase 28 (Concurrency Foundation)
         │
         ▼
Phase 29 (Determinism Guarantee)
         │
         ▼
Phase 30 (UX Visibility)
         │
         ▼
Phase 31 (Logging Foundation)
         │
         ▼
Phase 32 (Config v7)
         │
    ┌────┴────────────────────┐
    ▼                         ▼
Phase 33 (Concurrency+)   Phase 34 (Unified Logging)
    │                         │
    └──────────┬──────────────┘
               ▼
        Phase 35 (Background Agent Manager)
               │
               ▼
        Phase 36 (Ralph Loop)
               │
               ▼
        Phase 37 (Category Routing)
               │
               ▼
        Phase 38 (Session Recovery)
               │
    ┌──────────┴──────────┐
    ▼                     ▼
Phase 39 (Context)   Phase 40 (UX/UI)
    │                     │
    └──────────┬──────────┘
               ▼
        Phase 41 (Agent Consolidation)
               │
               ▼
        Phase 42 (Skill-Embedded MCPs)
               │
               ▼
        Phase 43 (Integration + Polish)
```

**Critical path**: 27 → 28 → 29 → 30 → 31 → 32 → 33 → 35 → 36 → 37 → 38 → 39/40 → 41 → 42 → 43
**Parallel opportunities**: 33 ∥ 34, 39 ∥ 40

---

## New Tools

| Tool | Phase | Purpose |
|------|-------|---------|
| `oc_background` | 35 | Spawn/monitor/cancel background tasks |
| `oc_loop` | 36 | Start autonomous loop until completion |
| `oc_delegate` | 37 | Delegate task with category-based routing |
| `oc_recover` | 38 | Manual recovery status/retry/reset/history |

---

## New Subsystems

| Subsystem | Phase | Purpose |
|-----------|-------|---------|
| `src/background/` | 35 | Background agent manager |
| `src/autonomy/` | 36 | Ralph loop controller |
| `src/routing/` | 37 | Category-based task routing |
| `src/recovery/` | 38 | Session recovery system |
| `src/context/` | 39 | Context discovery and injection |
| `src/ux/` | 40 | Toast notifications, progress tracking |
| `src/mcp/` | 42 | Skill-embedded MCP lifecycle |

---

## Worktree Isolation Strategy

| Phase | Worktree Required? | Branch Name | Reason |
|-------|-------------------|-------------|--------|
| 27 (Architecture) | Yes | `wt/architecture` | Modifies many large files |
| 28 (Concurrency) | No | `concurrency-foundation` | Test-focused, isolated changes |
| 29 (Determinism) | Yes | `wt/determinism` | Touches core orchestrator |
| 30 (UX Visibility) | No | `ux-visibility` | Additive new features |
| 31 (Logging) | Yes | `wt/logging` | Touches observability, memory, orchestrator |
| 32 (Config v7) | No | `config-v7` | Additive schema, no conflicts |
| 33 (Concurrency Extended) | No | `concurrency-extended` | Test-only, no source conflicts |
| 34 (Unified Logging) | No | `logging-v2` | Uses work from Phases 31/33 |
| 35 (Background Manager) | Yes | `wt/background` | New subsystem, many new files |
| 36 (Ralph Loop) | Yes | `wt/autonomy` | New subsystem |
| 37 (Routing) | No | `category-routing` | Sequential after Phase 36 |
| 38 (Recovery) | No | `session-recovery` | Sequential after Phase 37 |
| 39 (Context) | No | `context-injection` | Small changes, new module |
| 40 (UX) | No | `ux-surfaces` | Additive new module |
| 41 (Agents) | Yes | `wt/agents` | Modifies many agent files |
| 42 (MCP) | Yes | `wt/mcp` | New subsystem |
| 43 (Polish) | No | `v7.0-rc` | Tests and docs only |

---

## Test Coverage Targets

| Metric | Baseline | v7 Target |
|--------|----------|-----------|
| Total tests | ~1,455 | ~1,800+ |
| Concurrency tests | 7 | 50+ |
| New subsystem tests | 0 | 200+ |
| Integration tests | ~30 | 60+ |
| Module coverage | 51% | 85%+ |

---

## Atomic Commit Strategy

Continues v6 convention:

```
<type>(<scope>): <description>

<body — what changed and why>

Refs: Phase <N>, Task <M>
```

**Types**: `feat` (new capability), `refactor` (extraction), `test` (new tests), `fix` (bug fix), `docs` (documentation)

**New scopes**: `background`, `ralph`, `routing`, `recovery`, `context`, `ux`, `mcp`, `agents`

**Rules**:
1. Every commit leaves `bun test` green
2. Every commit leaves `bun run lint` clean
3. TDD commits: RED (failing test) → GREEN (implementation) → REFACTOR (cleanup) as separate commits
4. New subsystems: test file committed FIRST with stubs
5. Each task = 1-3 commits max

---

## Phase Details

See individual phase plan files in `.planning/phases/`:

### v6 Foundation (Phases 27-31)
- [Phase 27](./phases/27-architecture/) - Architecture Simplification
- [Phase 28](./phases/28-concurrency/) - Concurrency Foundation
- [Phase 29](./phases/29-determinism/) - Determinism Guarantee
- [Phase 30](./phases/30-ux-visibility/) - UX Visibility
- [Phase 31](./phases/31-logging/) - Logging Foundation

### v7 OMO Feature Parity (Phases 32-43)
- [Phase 32](./phases/32-config-v7/) - Configuration v7 + Foundation
- [Phase 33](./phases/33-concurrency-extended/) - Concurrency Foundation Extended
- [Phase 34](./phases/34-unified-logging/) - Unified Logging System
- [Phase 35](./phases/35-background-manager/) - Background Agent Manager
- [Phase 36](./phases/36-autonomy-loop/) - Autonomy Loop (Ralph)
- [Phase 37](./phases/37-category-routing/) - Category-Based Routing
- [Phase 38](./phases/38-session-recovery/) - Session Recovery System
- [Phase 39](./phases/39-context-injection/) - Context Injection System
- [Phase 40](./phases/40-ux-surfaces/) - UX/UI Surfaces
- [Phase 41](./phases/41-agent-consolidation/) - Agent Consolidation
- [Phase 42](./phases/42-mcp-skills/) - Skill-Embedded MCPs
- [Phase 43](./phases/43-integration-polish/) - Integration Testing + Polish

---

## Success Criteria

v7.0 is complete when:

**v6 Foundation (Phases 27-31)**:
- [ ] All god files split to <300 lines
- [ ] 50+ concurrency tests passing
- [ ] 100% deterministic replay
- [ ] Phase progress visible to users
- [ ] Structured logging working

**v7 OMO Features (Phases 32-43)**:
- [ ] Background agent manager spawns 5+ concurrent tasks
- [ ] Ralph loop completes tasks autonomously with verification
- [ ] Category routing delegates to correct model/agent
- [ ] Session recovery handles common errors gracefully
- [ ] AGENTS.md and README.md auto-inject on session start
- [ ] Toast notifications show on key events
- [ ] Agent count consolidated, adversarial + red-team preserved
- [ ] Skill-embedded MCPs load on-demand
- [ ] All tests pass
- [ ] Documentation updated
- [ ] `bun test` green
- [ ] `bun run lint` clean