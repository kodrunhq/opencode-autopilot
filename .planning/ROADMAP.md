# Roadmap: OpenCode Assets Plugin

## Milestones

- **v1.0 MVP** - Phases 1-3 (shipped)
- **v2.0 Autonomous Orchestrator** - Phases 4-7 (in progress)

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

- [ ] **Phase 4: Foundation Infrastructure** - State machine, deterministic tooling, config schema, and agent dispatch validation
- [ ] **Phase 5: Review Engine** - Standalone multi-agent code review with parallel dispatch, cross-verification, and fix cycle
- [ ] **Phase 6: Orchestrator Pipeline** - Full 8-phase autonomous SDLC pipeline integrating review engine
- [ ] **Phase 7: Learning & Resilience** - Institutional memory, retrospective extraction, and failure forensics

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
- [ ] 04-01-PLAN.md -- Zod schemas, state persistence, confidence ledger, and path helpers
- [x] 04-02-PLAN.md -- Config v2 schema with orchestrator/confidence namespaces and v1 migration
- [ ] 04-03-PLAN.md -- Phase transitions, plan indexing, and arena depth modules
- [ ] 04-04-PLAN.md -- Tool registrations, orchestrator agent, plugin wiring, and dispatch proof

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
- [ ] 06-01-PLAN.md -- Foundation: handler types, artifacts module, 9 pipeline agent configs, schema extension
- [ ] 06-02-PLAN.md -- Early pipeline handlers: RECON, CHALLENGE, ARCHITECT with Arena
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
Phases execute in numeric order: 4 -> 5 -> 6 -> 7 -> 8 -> 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Plugin Infrastructure | v1.0 | 2/2 | Complete | - |
| 2. Creation Tooling | v1.0 | 2/2 | Complete | - |
| 3. Curated Assets | v1.0 | 2/2 | Complete | - |
| 4. Foundation Infrastructure | v2.0 | 4/4 | Complete | - |
| 5. Review Engine | v2.0 | 4/4 | Complete | - |
| 6. Orchestrator Pipeline | v2.0 | 4/4 | Complete | - |
| 7. Learning & Resilience | v2.0 | 3/3 | Complete | - |

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
**Plans:** 4 plans

Plans:
- [ ] 10-01-PLAN.md -- Severity alignment (CRITICAL/HIGH/MEDIUM/LOW) and agent rename (orchestrator to autopilot) with mode changes
- [ ] 10-02-PLAN.md -- Pipeline agent prompt rewrite (150+ words) and base agent fixes
- [ ] 10-03-PLAN.md -- Skill injection into dispatch prompts and two-tier fallback chain resolution
- [ ] 10-04-PLAN.md -- Smart review agent selection: 13 new ReviewAgent implementations with stack-gated dispatch
