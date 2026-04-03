# Roadmap: OpenCode Assets Plugin

## Milestones

- **v1.0 MVP** - Phases 1-3 (shipped)
- **v2.0 Autonomous Orchestrator** - Phases 4-10 (shipped)
- **v3.0 Intelligence & Polish** - Phases 11-17 (shipped)
- **v4.0 Production Quality** - Phases 18-23 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 MVP (Phases 1-3) - SHIPPED</summary>

- [x] **Phase 1: Plugin Infrastructure** - Scaffolding, tool registration, asset installer, and npm package structure
- [x] **Phase 2: Creation Tooling** - In-session commands and tools for scaffolding new agents, skills, and commands
- [x] **Phase 3: Curated Assets** - Bundled agents, commands, and skills that ship with the plugin

</details>

### v2.0 Autonomous Orchestrator

- [x] **Phase 4: Foundation Infrastructure** - State machine, deterministic tooling, config schema, and agent dispatch validation
- [x] **Phase 5: Review Engine** - Standalone multi-agent code review with parallel dispatch, cross-verification, and fix cycle
- [x] **Phase 6: Orchestrator Pipeline** - Full 8-phase autonomous SDLC pipeline integrating review engine
- [x] **Phase 7: Learning & Resilience** - Institutional memory, retrospective extraction, and failure forensics
- [x] **Phase 8: Testing & CI** - Zero-regression CI pipeline with type safety, lint, and 90% coverage
- [x] **Phase 9: Model Fallback Integration** - Per-agent model fallback with error classification and state machine
- [x] **Phase 10: UX Polish & Metaprompting** - Severity alignment, agent modes, prompt rewrite, skill injection, fallback chain, smart review

## Phase Details

<details>
<summary>v1.0 MVP Phase Details (Phases 1-3)</summary>

### Phase 1: Plugin Infrastructure
**Goal**: A working plugin package that registers tools with OpenCode, installs bundled assets to the correct filesystem paths, and works with any configured provider
**Depends on**: Nothing (first phase)
**Requirements**: PLGN-01, PLGN-02, PLGN-03, PLGN-04
**Success Criteria** (what must be TRUE):
  1. User can add one line to opencode.json and the plugin loads without errors on next OpenCode start
  2. Plugin registers at least one tool visible in the OpenCode session (placeholder is fine)
  3. Bundled asset files are copied to the correct `.opencode/` directories on install without overwriting user modifications
  4. Agents created by the plugin work regardless of which LLM provider the user has configured
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Scaffold npm package, utility modules, and placeholder tool registration
- [x] 01-02-PLAN.md -- Asset installer, config system, bundled assets, and plugin wiring

### Phase 2: Creation Tooling
**Goal**: Users can scaffold new agents, skills, and commands from within an OpenCode session without leaving the TUI
**Depends on**: Phase 1
**Requirements**: CRTL-01, CRTL-02, CRTL-03, CRTL-04, CRTL-05
**Success Criteria** (what must be TRUE):
  1. User can type `/new-agent` in-session and get a correctly-formatted agent markdown file with proper frontmatter, prompt section, and tool permissions
  2. User can type `/new-skill` in-session and get a new skill directory with a valid SKILL.md file
  3. User can type `/new-command` in-session and get a correctly-formatted command markdown file
  4. Creation tools reject invalid names (uppercase, special chars, too long) and warn on path conflicts before writing
  5. User can choose between project-local (`.opencode/`) and global (`~/.config/opencode/`) as the installation target
**Plans**: 2 plans

Plans:
- [x] 02-01: Creation tooling core
- [x] 02-02: Creation tooling commands

### Phase 3: Curated Assets
**Goal**: The plugin ships with a useful set of subagents (injected via config hook), a command, and a skill that users get out of the box on install
**Depends on**: Phase 1, Phase 2
**Requirements**: AGNT-01, AGNT-02, AGNT-03, AGNT-04, CMND-01, SKLL-01
**Success Criteria** (what must be TRUE):
  1. After install, user can invoke `@researcher` to search the web and receive a structured report with sources
  2. After install, user can invoke `@metaprompter` to craft prompts and configurations for new assets
  3. After install, user can invoke `@documenter` to generate documentation, READMEs, and diagrams
  4. After install, user can invoke `@pr-reviewer` or the `/review-pr` command and get structured feedback on a GitHub pull request
  5. After install, user can reference the coding standards skill during code review or generation and the LLM applies the documented conventions
  6. None of the curated agents appear in the Tab cycle -- only accessible via `@` or delegation from primary agents
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md -- Agent config modules, config hook barrel, plugin wiring, and tests
- [x] 03-02-PLAN.md -- Coding-standards skill and /review-pr command

</details>

### Phase 4: Foundation Infrastructure
**Goal**: Deterministic TypeScript tooling provides state management, confidence tracking, config extension, and validated agent dispatch -- the bedrock everything else builds on
**Depends on**: Phase 3 (v1.0 complete)
**Requirements**: ORCH-02, ORCH-03, ORCH-04, ORCH-05, TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06
**Success Criteria** (what must be TRUE):
  1. An interrupted orchestrator run can be resumed from the last completed phase without re-executing earlier phases
  2. User can invoke `oc_state` / `oc_confidence` / `oc_phase` / `oc_plan` tools and receive Zod-validated JSON responses reflecting current pipeline state
  3. Every autonomous decision is recorded in a decision log with timestamp, phase, agent, decision, and rationale -- viewable as a JSON artifact after any run
  4. User can set orchestrator configuration (autonomy level, phase toggles, strictness) in the plugin config and the settings take effect on next invocation
  5. A proof-of-concept agent dispatch (tool-returns-instruction pattern) completes end-to-end in an OpenCode session, confirming the architecture is viable
**Plans**: 4 plans

Plans:
- [x] 04-01-PLAN.md -- Zod schemas, state persistence, confidence ledger, and path helpers
- [x] 04-02-PLAN.md -- Config v2 schema with orchestrator/confidence namespaces and v1 migration
- [x] 04-03-PLAN.md -- Phase transitions, plan indexing, and arena depth modules
- [x] 04-04-PLAN.md -- Tool registrations, orchestrator agent, plugin wiring, and dispatch proof

### Phase 5: Review Engine
**Goal**: Users can run a standalone multi-agent code review that selects relevant specialists, dispatches them in parallel, cross-verifies findings, and auto-fixes issues
**Depends on**: Phase 4
**Requirements**: REVW-01, REVW-02, REVW-03, REVW-04, REVW-05, REVW-06, REVW-07, REVW-08, REVW-09, REVW-10, REVW-11
**Success Criteria** (what must be TRUE):
  1. User can invoke the review engine standalone (outside the orchestrator) and receive a consolidated report of findings grouped by file with severity levels
  2. The review engine automatically selects relevant specialist agents based on project stack and excludes agents whose technology is absent
  3. At least 6 universal review agents (logic, security, quality, test coverage, silent failure, contract/type) run in parallel and return findings in CRITICAL/HIGH/MEDIUM/LOW format
  4. After parallel review, a cross-verification pass and red team adversarial pass surface inter-domain gaps and upgrade severities where warranted
  5. The fix cycle auto-applies fixes for actionable findings and re-verifies that fixes do not introduce new issues
**Plans**: 1 plan

Plans:
- [x] 05-01-PLAN.md -- Review engine data layer: schemas, agent catalog, stack gate, team selection, severity, finding builder

### Phase 6: Orchestrator Pipeline
**Goal**: Users give the orchestrator an idea and it autonomously drives through all 8 phases -- research, challenge, architect, explore, plan, build, ship, retrospective -- to deliver a completed result
**Depends on**: Phase 4, Phase 5
**Requirements**: ORCH-01, PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07, PIPE-08
**Success Criteria** (what must be TRUE):
  1. User invokes `oc_orchestrate` with an idea description and the pipeline runs through all 8 phases to completion without manual intervention
  2. RECON phase produces a structured domain research report; CHALLENGE phase proposes up to 3 enhancements with logged accept/reject rationale
  3. ARCHITECT phase produces a system design -- when Arena is enabled, 2-3 parallel proposals are evaluated by an adversarial critic before selection
  4. BUILD phase implements tasks iteratively with branch/commit per task, running review after each task, and supports wave-based parallel execution for independent tasks
  5. SHIP phase produces a ship package (architecture walkthrough, decision summary, changelog) and the pipeline ends cleanly
**Plans**: 4 plans

Plans:
- [x] 06-01-PLAN.md -- Foundation: handler types, artifacts module, 9 pipeline agent configs, schema extension
- [x] 06-02-PLAN.md -- Early pipeline handlers: RECON, CHALLENGE, ARCHITECT with Arena
- [x] 06-03-PLAN.md -- Late pipeline handlers: PLAN, BUILD with review integration, SHIP, RETROSPECTIVE, EXPLORE
- [x] 06-04-PLAN.md -- Wiring: handler dispatch map, enhanced orchestrateCore, configHook registration

### Phase 7: Learning & Resilience
**Goal**: The system learns from completed runs and provides diagnostic tools for failed runs, improving quality over time
**Depends on**: Phase 6
**Requirements**: LRNR-01, LRNR-02, LRNR-03, LRNR-04
**Success Criteria** (what must be TRUE):
  1. After a completed run, lessons are extracted and persisted to institutional memory with domain categorization (architecture, testing, review, planning)
  2. Stale lessons decay over time so the memory store does not grow unbounded
  3. User can invoke forensics on a failed run and receive a diagnosis identifying the failing phase, agent, root cause, and whether the failure is recoverable or terminal
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md -- Lesson memory data layer: Zod schemas, types, load/save/prune with atomic writes
- [x] 07-02-PLAN.md -- Retrospective handler enhancement and lesson injection into phase dispatch
- [x] 07-03-PLAN.md -- Failure metadata capture and oc_forensics diagnostic tool

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> ... -> 17 -> 18 -> 19 -> 20 -> 21 -> 22 -> 23

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Plugin Infrastructure | v1.0 | 2/2 | Complete | - |
| 2. Creation Tooling | v1.0 | 2/2 | Complete | - |
| 3. Curated Assets | v1.0 | 2/2 | Complete | - |
| 4. Foundation Infrastructure | v2.0 | 4/4 | Complete | - |
| 5. Review Engine | v2.0 | 4/4 | Complete | - |
| 6. Orchestrator Pipeline | v2.0 | 4/4 | Complete | - |
| 7. Learning & Resilience | v2.0 | 3/3 | Complete | - |
| 8. Testing & CI | v2.0 | 2/2 | Complete | - |
| 9. Model Fallback Integration | v2.0 | 3/3 | Complete | - |
| 10. UX Polish & Metaprompting | v2.0 | 4/4 | Complete | - |
| 11. Ecosystem Research | v3.0 | 3/3 | Complete | 2026-04-02 |
| 12. Quick Wins & Fixes | v3.0 | 2/2 | Complete | 2026-04-02 |
| 13. Session Observability | v3.0 | 1/1 | Complete | 2026-04-02 |
| 14. Skills & Commands | v3.0 | 6/6 | Complete | 2026-04-03 |
| 15. Memory System | v3.0 | 1/1 | Complete | 2026-04-02 |
| 16. Autopilot Integration | v3.0 | 0/0 | MERGED | - |
| 17. Integration & Polish | v3.0 | 3/3 | Complete | 2026-04-03 |
| 18. Namespace Cleanup | v4.0 | 2/2 | Complete    | 2026-04-03 |
| 19. Agent Visibility & Fixes | v4.0 | 2/2 | Complete    | 2026-04-03 |
| 20. New Primary Agents | v4.0 | 2/2 | Complete   | 2026-04-03 |
| 21. Content Expansion | v4.0 | 2/2 | Complete   | 2026-04-03 |
| 22. Production Hardening | v4.0 | 0/TBD | Not started | - |
| 23. QA Playbook | v4.0 | 2/2 | Complete   | 2026-04-03 |

### Phase 8: Testing & CI

**Goal:** Zero-regression CI pipeline enforcing type safety, lint compliance, and 90% coverage floor on every push and PR
**Requirements**: TCID-01, TCID-02, TCID-03, TCID-04
**Depends on:** Phase 7
**Success Criteria** (what must be TRUE):
  1. `bunx tsc --noEmit` passes with zero type errors across the entire codebase
  2. `bun test --coverage` enforces 90% line and function coverage thresholds via bunfig.toml
  3. A smoke test verifies all 11 oc_* tools are registered by the plugin entry point
  4. GitHub Actions CI runs lint, type-check, and test+coverage on every push to main and every PR
**Plans:** 2 plans

Plans:
- [x] 08-01-PLAN.md -- Fix TypeScript errors, add coverage thresholds, add tool registration smoke test
- [x] 08-02-PLAN.md -- Create GitHub Actions CI workflow

### Phase 9: Model Fallback Integration

**Goal:** Per-agent model fallback absorbed from the opencode-fallback plugin (MIT) into our single plugin -- error classification, immutable state machine, 3-tier message replay, and hook-based model override integrated with the existing orchestrator
**Requirements**: FLLB-01, FLLB-02, FLLB-03, FLLB-04, FLLB-05, FLLB-06, FLLB-07, FLLB-08
**Depends on:** Phase 8
**Success Criteria** (what must be TRUE):
  1. Error classifier detects retryable model errors (rate limit, quota, unavailable) using battle-tested regex patterns from opencode-fallback
  2. Fallback state machine tracks per-session model state with immutable plan-then-commit transitions and cooldown recovery
  3. Message replay degrades content across 3 tiers (all parts, text+images, text only) to maximize cross-provider compatibility
  4. Plugin config v3 adds fallback settings with auto-migration from v2
  5. FallbackManager prevents duplicate dispatches via per-session concurrency guards (retry-in-flight lock, self-abort suppression, TTFT timeout)
  6. Plugin entry registers chat.message and tool.execute.after hooks alongside existing tool/config/event hooks
**Plans:** 3 plans

Plans:
- [x] 09-01-PLAN.md -- Pure function ports: types, error classifier, fallback state machine, message replay, config v3
- [x] 09-02-PLAN.md -- FallbackManager class with concurrency guards and session lifecycle
- [x] 09-03-PLAN.md -- Plugin hook handlers (event, chat.message, tool.execute.after) and index.ts wiring

### Phase 10: UX Polish & Metaprompting

**Goal:** Six-point improvement pass across the entire plugin before first real-world use: severity alignment (CRITICAL/HIGH/MEDIUM/LOW everywhere), agent modes and rename (orchestrator to autopilot, primary mode for key agents), pipeline agent prompt rewrite (150+ word structured prompts), skill injection (coding-standards into dispatch prompts at runtime), fallback chain resolution (two-tier per-agent-then-global from opencode.json), and smart review agent selection (13 new ReviewAgent implementations with stack-gated dispatch)
**Requirements**: UXP-01, UXP-02, UXP-03, UXP-04, UXP-05, UXP-06
**Depends on:** Phase 9
**Plans:** 4/4 plans executed

Plans:
- [x] 10-01-PLAN.md -- Severity alignment (CRITICAL/HIGH/MEDIUM/LOW) and agent rename (orchestrator to autopilot) with mode changes
- [x] 10-02-PLAN.md -- Pipeline agent prompt rewrite (150+ words) and base agent fixes
- [x] 10-03-PLAN.md -- Skill injection into dispatch prompts and two-tier fallback chain resolution
- [x] 10-04-PLAN.md -- Smart review agent selection: 13 new ReviewAgent implementations with stack-gated dispatch

<details>
<summary>v3.0 Intelligence & Polish (Phases 11-17) - SHIPPED</summary>

### v3.0 Intelligence & Polish

- [x] **Phase 11: Ecosystem Research & Gap Analysis** - Deep competitive research across 5 plugins, gap matrix, defines scope for Phases 14-16
- [x] **Phase 12: Quick Wins & Fixes** - Zen model display fix, small improvements surfaced by research (completed 2026-04-02)
- [x] **Phase 13: Session Observability** - Structured event logging, session summaries, TUI dashboard, data retention, mock provider for fallback testing (completed 2026-04-02)
- [x] **Phase 14: Skills & Commands** - New skills and commands identified by Phase 11 gap matrix (brainstorming, PR review, update-docs, etc.) (completed 2026-04-03)
- [x] **Phase 15: Memory System** - Dual-scope smart memory (project patterns + user preferences), global storage, relevance-scored retrieval (completed 2026-04-02)
- [x] **Phase 16: Autopilot Integration (Skills + Memory)** - MERGED INTO PHASE 17 (scope too thin for standalone phase)
- [x] **Phase 17: Integration & Polish** - Cross-feature integration, adaptive skill wiring, memory-based confidence tuning, final production polish (completed 2026-04-03)

## Phase Details (v3.0)

### Phase 11: Ecosystem Research & Gap Analysis
**Goal:** Deep competitive research across GSD, superpowers, oh-my-openagent, everything-claude-code, and claude-mem producing a gap matrix that defines the exact implementation scope of subsequent phases
**Depends on:** Phase 10 (v2.0 complete)
**Requirements:** TBD (research phase generates requirements for later phases)
**Success Criteria** (what must be TRUE):
  1. Gap matrix covers all 5 competitor plugins across skills, commands, hooks, agents, memory, workflows, and observability
  2. Each gap has a priority rating (CRITICAL/HIGH/MEDIUM/LOW) and a phase assignment
  3. Memory system patterns analyzed with token-efficiency assessment
  4. Specialized agent archetypes critically evaluated with clear value/no-value determination
  5. Research surfaces gaps we hadn't anticipated (creative, forward-looking analysis)
**Plans:** 3/3 plans executed

Plans:
- [x] 11-01-PLAN.md -- Five competitor deep-dives (GSD, superpowers, OMO, ECC, claude-mem) with feature catalogs
- [x] 11-02-PLAN.md -- Broader ecosystem scan and novel opportunities analysis
- [x] 11-03-PLAN.md -- Gap matrix synthesis, phase scope definitions, memory architecture, agent verdict

### Phase 12: Quick Wins & Fixes
**Goal:** Fix known bugs and small improvements that don't require research or complex architecture
**Depends on:** Phase 10
**Requirements:** TBD
**Success Criteria** (what must be TRUE):
  1. CLI configure wizard shows Zen provider prefix on models, matching OpenCode's native /models display
  2. Users can distinguish Go vs Zen providers when selecting a model
  3. Any additional quick wins from Phase 11 research are addressed
**Plans:** 2/2 plans complete

### Phase 13: Session Observability
**Goal:** Full session observability with structured event logging, human-readable summaries, TUI dashboard, time-based retention, and configurable mock provider for fallback testing
**Depends on:** Phase 12
**Requirements:** TBD
**Success Criteria** (what must be TRUE):
  1. Every fallback trigger, model error, and autopilot decision is captured as a structured JSON event with timestamp and context
  2. Human-readable session summaries are generated from structured events
  3. Logs persist in ~/.config/opencode/logs/ with configurable 30-day default retention
  4. Rich TUI dashboard shows session timeline, error highlighting, and filterable columns
  5. Mock provider can simulate specific failure modes (rate limit, quota, timeout, malformed) for fallback chain testing
**Plans:** 1/1 plans complete

### Phase 14: Skills & Commands
**Goal:** Implement 22 high-priority skills and commands identified by Phase 11 gap matrix — 14 methodology and language-specific skills, 5 commands, adaptive skill loading, composable skill chains, and an asset linter
**Depends on:** Phase 11 (research defines scope)
**Requirements:** SK-01 through SK-18, CM-02, CM-03, CM-06, CM-07, CM-08, DX-05
**Success Criteria** (what must be TRUE):
  1. All CRITICAL and HIGH priority skill gaps from Phase 11 matrix are addressed
  2. All CRITICAL and HIGH priority command gaps from Phase 11 matrix are addressed
  3. Every new skill/command follows established plugin patterns and feels native
  4. Adaptive skill loading auto-detects project stack and loads matching skills
  5. Composable skill chains resolve dependencies with cycle detection
**Plans:** 6/6 plans executed

Plans:
- [x] 14-01-PLAN.md -- CRITICAL methodology skills: brainstorming, TDD workflow, systematic debugging
- [x] 14-02-PLAN.md -- HIGH methodology skills: verification, git worktrees, plan writing, plan executing
- [x] 14-03-PLAN.md -- MEDIUM methodology skills (code-review, compaction, E2E) + thin wrapper commands
- [x] 14-04-PLAN.md -- Language-specific pattern skills: TypeScript/Bun, Go, Python, Rust
- [x] 14-05-PLAN.md -- Tool-backed commands (/stocktake, /update-docs), asset linter, template updates
- [x] 14-06-PLAN.md -- Adaptive skill loading infrastructure + composable skill chains

### Phase 15: Memory System
**Goal:** Smart dual-scope memory system that learns project patterns and user preferences, stored globally with relevance-scored retrieval — the plugin gets better the more you use it
**Depends on:** Phase 11 (research informs architecture)
**Requirements:** TBD
**Success Criteria** (what must be TRUE):
  1. Project-level memories capture coding conventions, architecture decisions, and codebase patterns
  2. User-level memories capture workflow preferences and communication style across all projects
  3. All memory stored in ~/.config/opencode/memory/ — never in project repos
  4. Relevance scoring injects only top-N relevant memories into context, keeping token usage lean
  5. Memory demonstrably improves agent behavior over multiple sessions
**Plans:** 1/1 plans complete

### Phase 16: Autopilot Integration (Skills + Memory)
**Goal:** MERGED INTO PHASE 17 — scope too thin for standalone phase
**Depends on:** Phase 14 (skills), Phase 15 (memory)
**Requirements:** Absorbed into Phase 17
**Status:** MERGED
**Plans:** 0 plans (all work moved to Phase 17)

### Phase 17: Integration & Polish
**Goal:** Wire adaptive skill routing into orchestrator (absorbed from Phase 16), add memory-based confidence tuning, cross-feature integration testing, and final production polish for release
**Depends on:** All prior v3.0 phases
**Requirements:** INT-01, INT-02, INT-03, INT-04, INT-05, INT-06
**Success Criteria** (what must be TRUE):
  1. All v3.0 features work together as a cohesive system (logging + memory + agents + skills)
  2. Adaptive skill routing wired into orchestrator dispatch (replaces single coding-standards injection)
  3. Memory-based confidence tuning adjusts Arena debate depth based on project error history
  4. Cross-feature integration tests exercise orchestrator + skills + memory + config migration
  5. Documentation updated (CLAUDE.md, CHANGELOG), version bumped, CI green
**Plans:** 3/3 plans executed

Plans:
- [x] 17-01-PLAN.md -- Wire adaptive skill routing + memory-based confidence tuning
- [x] 17-02-PLAN.md -- Cross-feature integration tests + config migration chain test
- [x] 17-03-PLAN.md -- Documentation polish, CHANGELOG, version bump to 1.6.0

</details>

### v4.0 Production Quality

- [x] **Phase 18: Namespace Cleanup** - Prefix all commands with oc- and remove oc-configure slash command (completed 2026-04-03)
- [x] **Phase 19: Agent Visibility & Fixes** - Fix stocktake agent detection, clarify ambiguous agents, ensure config-hook agents appear in Tab cycle
- [x] **Phase 20: New Primary Agents** - Add Debugger, Planner, and Code Reviewer primary agents with intentional Tab-cycle ordering (completed 2026-04-03)
- [x] **Phase 21: Content Expansion** - OOP/SOLID coding standards, Java/C# language skills, agents.md review command and starter templates (completed 2026-04-03)
- [ ] **Phase 22: Production Hardening** - Mock fallback test mode, context-aware commands, skill-aware doctor, anti-slop comment hook
- [x] **Phase 23: QA Playbook** - Internal manual QA playbook with step-by-step test procedures for every feature (completed 2026-04-03)

## Phase Details (v4.0)

### Phase 18: Namespace Cleanup
**Goal**: All plugin commands use a consistent `oc-` namespace prefix, and configuration is CLI-only (no slash command)
**Depends on**: Phase 17 (v3.0 complete)
**Requirements**: BFIX-02, BFIX-03
**Success Criteria** (what must be TRUE):
  1. Every plugin command is accessible via its `oc-` prefixed name (oc-brainstorm, oc-tdd, oc-quick, oc-write-plan, oc-stocktake, oc-review-pr, oc-update-docs, oc-new-agent, oc-new-skill, oc-new-command)
  2. Old unprefixed command names are listed in DEPRECATED_ASSETS and cleaned up on plugin load so users upgrading from v3 get a seamless migration
  3. The oc-configure slash command no longer exists -- configuration is only accessible via the CLI configure wizard
**Plans**: 2 plans

Plans:
- [x] 18-01-PLAN.md -- Rename command files to oc- prefix, delete oc-configure, update installer DEPRECATED_ASSETS
- [x] 18-02-PLAN.md -- Update all source code and documentation references to use oc- prefixed command names

### Phase 19: Agent Visibility & Fixes
**Goal**: Stocktake correctly detects all agents (filesystem and config-hook-injected), and ambiguous agents are replaced with well-defined alternatives
**Depends on**: Phase 18
**Requirements**: BFIX-01, BFIX-04, AGNT-14
**Success Criteria** (what must be TRUE):
  1. Running `/oc-stocktake` lists config-hook-injected agents alongside filesystem agents with an `origin` indicator (config-hook vs filesystem)
  2. The "general" and "explore" agents are removed or replaced with clearly-scoped agents that have explicit purposes
  3. Primary-mode agents registered via config hook appear correctly in the Tab cycle (not just in @ autocomplete)
  4. Agent count reported by stocktake matches the actual number of registered agents (zero silent omissions)
**Plans**: 2 plans

Plans:
- [x] 19-01-PLAN.md -- Fix agent modes (researcher/metaprompter to subagent), export agents map, visibility test suite
- [x] 19-02-PLAN.md -- Fix stocktake agent detection

### Phase 20: New Primary Agents
**Goal**: Users can Tab-cycle through a curated set of primary agents -- Autopilot, Debugger, Planner, and Code Reviewer -- each loading relevant skills automatically
**Depends on**: Phase 19
**Requirements**: AGNT-10, AGNT-11, AGNT-12, AGNT-13
**Success Criteria** (what must be TRUE):
  1. User can Tab to a Debugger agent that loads the systematic-debugging skill and provides structured debugging guidance
  2. User can Tab to a Planner agent that loads plan-writing and plan-executing skills and helps decompose work
  3. User can Tab to a Code Reviewer agent that loads the code-review skill and can invoke oc_review for multi-agent review
  4. Tab cycle follows the intentional order: Autopilot first, then Debugger, Planner, Reviewer (no other primary agents polluting the cycle)
**Plans**: TBD

### Phase 21: Content Expansion
**Goal**: Coding standards cover OOP/SOLID principles, two new language-specific skills serve Java and C# developers, and a new command helps users audit and improve their project agents
**Depends on**: Phase 19
**Requirements**: SKLL-10, SKLL-11, SKLL-12, CMND-10, CMND-11
**Success Criteria** (what must be TRUE):
  1. Coding standards skill includes OOP/SOLID principles, Clean Architecture, dependency inversion, and composition-over-inheritance guidance that the LLM applies during code generation
  2. Java developers get a language patterns skill with idiomatic Java, Spring Boot, and JPA conventions loaded automatically when Java project files are detected
  3. C# developers get a language patterns skill with idiomatic C#, .NET patterns, and Entity Framework conventions loaded automatically when .csproj files are detected
  4. User can run `/oc-review-agents` to validate and improve their project's agents.md file with structure and prompt quality feedback
  5. Curated agents.md starter templates are available for common project types (web-api, cli-tool, library, fullstack)
**Plans**: TBD

### Phase 22: Production Hardening
**Goal**: The plugin is resilient to model failures in test scenarios, auto-detects project language for commands, has deeper self-diagnostics, and prevents AI comment bloat
**Depends on**: Phase 18
**Requirements**: HARD-01, HARD-02, HARD-03, HARD-04
**Success Criteria** (what must be TRUE):
  1. User can enable a mock/fail-forced fallback test mode via CLI configure that simulates rate-limit, timeout, quota-exceeded, and malformed-response failures without hitting real APIs
  2. Commands that vary by language auto-detect the project language from manifest files (package.json, pom.xml, *.csproj, go.mod, Cargo.toml) instead of requiring per-language variants
  3. Doctor diagnostics report skill loading status per detected stack, memory DB health, and command accessibility alongside existing checks
  4. Anti-slop comment hook detects and prevents AI-generated comment bloat (obvious comments, sycophantic language) with configurable enforcement profiles
**Plans**: TBD

### Phase 23: QA Playbook
**Goal**: A comprehensive internal QA playbook documents step-by-step test procedures for every feature, enabling systematic manual validation of the entire plugin
**Depends on**: Phase 18, Phase 19, Phase 20, Phase 21, Phase 22
**Requirements**: QAPL-01
**Success Criteria** (what must be TRUE):
  1. Every command has a documented test procedure with expected inputs and outputs
  2. Every agent has a documented test scenario verifying its availability, skill loading, and core behavior
  3. Memory flow, fallback chain, and doctor diagnostics each have end-to-end test procedures
  4. The playbook can be executed by a human (or AI) in a single session to validate a release
**Plans**: TBD
