# Requirements: OpenCode Assets Plugin

**Defined:** 2026-03-31
**Core Value:** A single command transforms an idea into a shipped, reviewed, tested result -- fully autonomous, with built-in code quality enforcement at every stage.

## v1 Requirements (Validated)

All v1 requirements shipped and validated in Milestone v1.0.

### Creation Tooling

- [x] **CRTL-01**: User can type `/new-agent` in-session and get a new agent markdown file created with proper frontmatter, prompt, and tool permissions
- [x] **CRTL-02**: User can type `/new-skill` in-session and get a new skill directory + SKILL.md created with proper frontmatter and structure
- [x] **CRTL-03**: User can type `/new-command` in-session and get a new command markdown file created with template and description
- [x] **CRTL-04**: Creation tools validate names (lowercase alphanumeric, hyphens, 1-64 chars for skills) and prevent path conflicts
- [x] **CRTL-05**: Creation tools write assets to global `~/.config/opencode/` target

### Agents

- [x] **AGNT-01**: Researcher agent that searches the web and produces structured reports with sources
- [x] **AGNT-02**: Metaprompter agent that crafts prompts and configurations for new assets
- [x] **AGNT-03**: Documenter agent that creates documentation, READMEs, diagrams
- [x] **AGNT-04**: PR Reviewer agent that reviews PRs with structured feedback

### Commands

- [x] **CMND-01**: `/review-pr` command that reviews a GitHub PR with structured feedback

### Skills

- [x] **SKLL-01**: Coding standards skill with style, patterns, and naming conventions

### Plugin Infrastructure

- [x] **PLGN-01**: Single npm package installable via one line in `opencode.json`
- [x] **PLGN-02**: Plugin registers creation tools with Zod-validated schemas
- [x] **PLGN-03**: Bundled assets installed to correct filesystem paths
- [x] **PLGN-04**: Works with any provider configured in OpenCode (model-agnostic)

## v2 Requirements

Requirements for Milestone v2.0 -- Autonomous Orchestrator.

### Orchestrator Foundation

- [ ] **ORCH-01**: User can invoke `oc_orchestrate` with an idea and the orchestrator drives an 8-phase pipeline (RECON -> CHALLENGE -> ARCHITECT -> EXPLORE -> PLAN -> BUILD -> SHIP -> RETROSPECTIVE) to completion autonomously
- [x] **ORCH-02**: Orchestrator persists state to JSON so interrupted runs resume from the last completed phase without re-executing earlier phases
- [x] **ORCH-03**: Every autonomous decision is logged to a decision log with timestamp, phase, agent, decision, and rationale
- [x] **ORCH-04**: User can configure orchestrator settings (autonomy level, phase toggles, strictness) via the plugin config schema
- [x] **ORCH-05**: Confidence ledger tracks every agent decision as HIGH/MEDIUM/LOW with rationale, and downstream phases use confidence scores to adjust effort allocation

### Deterministic Tooling

- [x] **TOOL-01**: State management module in TypeScript handles state load, update, get, patch, and phase transitions with Zod-validated schemas
- [x] **TOOL-02**: Config module extends existing pluginConfigSchema with orchestrator and review engine settings
- [x] **TOOL-03**: Confidence module reads, appends, summarizes, and filters confidence entries by phase
- [x] **TOOL-04**: Phase module tracks phase completion status and validates transitions
- [x] **TOOL-05**: Plan module indexes task lists and groups tasks into dependency waves
- [x] **TOOL-06**: Arena module determines debate depth and triggers explorer based on confidence

### Pipeline Phases

- [ ] **PIPE-01**: RECON phase dispatches a researcher subagent that produces a structured domain research report
- [ ] **PIPE-02**: CHALLENGE phase proposes enhancements the user did not articulate, capped at 3 additions, with logged accept/reject rationale
- [ ] **PIPE-03**: ARCHITECT phase produces a system design; when Arena is enabled, 2-3 parallel proposals are evaluated by an adversarial critic
- [ ] **PIPE-04**: PLAN phase decomposes architecture into ordered tasks with wave numbers, max 300-line diffs per task
- [ ] **PIPE-05**: BUILD phase implements tasks iteratively with branch/commit per task, running review after each task
- [ ] **PIPE-06**: BUILD phase supports wave-based parallel execution where independent tasks within a wave build concurrently
- [ ] **PIPE-07**: SHIP phase produces a ship package (architecture walkthrough, decision summary, changelog)
- [ ] **PIPE-08**: RETROSPECTIVE phase extracts lessons learned and writes them to institutional memory

### Review Engine

- [x] **REVW-01**: User can invoke the review engine standalone (not just within the orchestrator) to review current changes
- [ ] **REVW-02**: Team lead agent analyzes project stack and diff to select relevant specialist agents from the catalog
- [x] **REVW-03**: At least 6 universal review agents ship by default (logic, security, quality, test coverage, silent failure, contract/type)
- [ ] **REVW-04**: Selected review agents dispatch in parallel and return findings in a standardized severity format (CRITICAL/WARNING/NITPICK)
- [ ] **REVW-05**: Stack-gated selection automatically excludes agents whose technology is absent from the project
- [ ] **REVW-06**: After parallel review, cross-verification pass lets agents see each other's findings and upgrade severity or add new findings
- [x] **REVW-07**: Red team agent runs as final adversarial pass, reading all findings and hunting inter-domain gaps
- [x] **REVW-08**: Product thinker agent traces user journeys and checks CRUD completeness after technical review
- [x] **REVW-09**: Fix cycle auto-applies fixes for findings and re-verifies that fixes don't introduce new issues
- [ ] **REVW-10**: Consolidated review report groups findings by file with severity levels and actionable fix descriptions
- [x] **REVW-11**: Per-project memory stores findings, false positives, and project profile so reviews improve across runs on the same codebase

### Learning & Resilience

- [x] **LRNR-01**: Institutional memory persists lessons from completed runs to a global store, with decay mechanism for stale entries
- [ ] **LRNR-02**: Retrospective agent extracts lessons categorized by domain (architecture, testing, review, planning) after each run
- [ ] **LRNR-03**: Forensics tool analyzes failed runs: identifies failing phase, agent, root cause, and classifies as recoverable vs. terminal
- [ ] **LRNR-04**: User can invoke forensics via a `--forensics` flag on the orchestrator tool

### Model Fallback

- [x] **FLLB-01**: Error classifier detects retryable model errors (rate limits, quota, unavailable) from error objects and message text using battle-tested regex patterns
- [x] **FLLB-02**: Fallback state machine tracks per-session model state (primary, fallback chain, exhausted) with immutable plan-then-commit transitions
- [x] **FLLB-03**: Message replay with 3-tier content degradation (all parts, text+images, text only) maximizes compatibility across providers
- [x] **FLLB-04**: Fallback config schema (enabled, retryOnErrors, maxAttempts, cooldown, timeout) integrates into pluginConfigSchema as v3 with auto-migration from v2
- [x] **FLLB-05**: Fallback manager encapsulates per-session concurrency guards (retry-in-flight lock, self-abort suppression, TTFT timeout) to prevent duplicate dispatches
- [x] **FLLB-06**: Event hook detects model failures (session.error, message.updated) and triggers fallback plan-commit-replay cycle
- [x] **FLLB-07**: chat.message hook overrides outgoing model to the fallback model when fallback state differs from original, with plugin-initiated dispatch detection to prevent state reset
- [x] **FLLB-08**: Plugin entry (index.ts) registers chat.message, enhanced event handler, and tool.execute.after hooks alongside existing tool/config/event hooks

## v4 Requirements

Requirements for Milestone v4.0 — Production Quality.

### Bug Fixes & Infrastructure

- [ ] **BFIX-01**: Stocktake detects config-hook-injected agents alongside filesystem agents
- [x] **BFIX-02**: All commands renamed with `oc-` prefix for namespace clarity (brainstorm->oc-brainstorm, tdd->oc-tdd, quick->oc-quick, write-plan->oc-write-plan, stocktake->oc-stocktake, review-pr->oc-review-pr, update-docs->oc-update-docs, new-agent->oc-new-agent, new-skill->oc-new-skill, new-command->oc-new-command)
- [x] **BFIX-03**: oc-configure removed as slash command (configuration accessible via CLI only)
- [ ] **BFIX-04**: Clarify/remove ambiguous "general" and "explore" agents — replace with well-defined primary agents

### Agents

- [x] **AGNT-10**: Primary Debugger agent visible in Tab cycle, loads systematic-debugging skill
- [x] **AGNT-11**: Primary Planner agent visible in Tab cycle, loads plan-writing + plan-executing skills
- [x] **AGNT-12**: Primary Code Reviewer agent visible in Tab cycle, loads code-review skill and invokes oc_review
- [x] **AGNT-13**: Primary agents registered with intentional Tab-cycle ordering (Autopilot first, then Debugger, Planner, Reviewer)
- [ ] **AGNT-14**: Config-hook agents appear in Tab cycle correctly for primary mode agents

### Content Expansion

- [x] **SKLL-10**: Coding standards expanded with OOP/SOLID principles, Clean Architecture, dependency inversion, composition over inheritance
- [x] **SKLL-11**: Java language patterns skill with idiomatic Java, Spring Boot patterns, JPA conventions
- [x] **SKLL-12**: C# language patterns skill with idiomatic C#, .NET patterns, Entity Framework conventions
- [x] **CMND-10**: `/oc-review-agents` command validates and improves project agents.md files (structure, system prompts)
- [x] **CMND-11**: Curated agents.md starter templates for common project types (web-api, cli-tool, library, fullstack)

### Production Hardening

- [ ] **HARD-01**: Mock/fail-forced fallback test mode accessible from CLI configure, simulates rate-limit, timeout, quota-exceeded, malformed
- [ ] **HARD-02**: Context-aware commands auto-detect project language from files instead of requiring per-language variants
- [ ] **HARD-03**: Doctor extended with skill-aware diagnostics (skill loading per detected stack, memory DB health, command accessibility)
- [x] **HARD-04**: Anti-slop comment hook prevents AI-generated comment bloat (obvious comments, sycophantic language), configurable via profiles

### Quality Assurance

- [x] **QAPL-01**: Internal manual QA playbook with step-by-step test procedures for every command, agent, skill, memory flow, fallback chain, and doctor check

## Future Requirements

Deferred beyond v4.0. Tracked for future milestones.

### Advanced Features

- **ADV-01**: Divergent explorer (parallel prototyping with branch comparison)
- **ADV-02**: Ace enforcement pipeline (inline quality during build with enriched plans + checkpoints)
- **ADV-03**: Language-specific review agents beyond TypeScript (Go, Python, Rust, React)
- **ADV-04**: Cross-machine memory portability (instinct import/export)
- **ADV-05**: Eval harness for measuring agent effectiveness

## Out of Scope

| Feature | Reason |
|---------|--------|
| GUI/web dashboard | OpenCode is a TUI; all interaction via tools and commands |
| MCP server for review | Out of scope per project constraints; review is native plugin tools |
| Human approval gates | Core promise is zero-intervention autonomy; decision logging provides accountability |
| Model-specific agent assignments | Model-agnostic constraint; users configure models via OpenCode's routing |
| Shared mutable state between agents | Agents communicate through filesystem artifacts; prevents concurrency bugs |
| Divergent explorer | Too complex, rare value; Arena + review cycle catches bad choices |
| Documentation exceeding 2x codebase LOC | Ship Package must be proportional to project complexity |
| Silent scope accumulation | Challenge additions must be logged; hard cap of 3 per run |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CRTL-01 through CRTL-05 | Phase 1-2 (v1.0) | Complete |
| AGNT-01 through AGNT-04 | Phase 3 (v1.0) | Complete |
| CMND-01 | Phase 3 (v1.0) | Complete |
| SKLL-01 | Phase 3 (v1.0) | Complete |
| PLGN-01 through PLGN-04 | Phase 1 (v1.0) | Complete |
| ORCH-02 | Phase 4 | Complete |
| ORCH-03 | Phase 4 | Complete |
| ORCH-04 | Phase 4 | Complete |
| ORCH-05 | Phase 4 | Complete |
| TOOL-01 | Phase 4 | Complete |
| TOOL-02 | Phase 4 | Complete |
| TOOL-03 | Phase 4 | Complete |
| TOOL-04 | Phase 4 | Complete |
| TOOL-05 | Phase 4 | Complete |
| TOOL-06 | Phase 4 | Complete |
| REVW-01 | Phase 5 | Complete |
| REVW-02 | Phase 5 | Pending |
| REVW-03 | Phase 5 | Complete |
| REVW-04 | Phase 5 | Pending |
| REVW-05 | Phase 5 | Pending |
| REVW-06 | Phase 5 | Pending |
| REVW-07 | Phase 5 | Complete |
| REVW-08 | Phase 5 | Complete |
| REVW-09 | Phase 5 | Complete |
| REVW-10 | Phase 5 | Pending |
| REVW-11 | Phase 5 | Complete |
| ORCH-01 | Phase 6 | Pending |
| PIPE-01 | Phase 6 | Pending |
| PIPE-02 | Phase 6 | Pending |
| PIPE-03 | Phase 6 | Pending |
| PIPE-04 | Phase 6 | Pending |
| PIPE-05 | Phase 6 | Pending |
| PIPE-06 | Phase 6 | Pending |
| PIPE-07 | Phase 6 | Pending |
| PIPE-08 | Phase 6 | Pending |
| LRNR-01 | Phase 7 | Complete |
| LRNR-02 | Phase 7 | Pending |
| LRNR-03 | Phase 7 | Pending |
| LRNR-04 | Phase 7 | Pending |
| FLLB-01 | Phase 9 | Complete |
| FLLB-02 | Phase 9 | Complete |
| FLLB-03 | Phase 9 | Complete |
| FLLB-04 | Phase 9 | Complete |
| FLLB-05 | Phase 9 | Complete |
| FLLB-06 | Phase 9 | Complete |
| FLLB-07 | Phase 9 | Complete |
| FLLB-08 | Phase 9 | Complete |
| BFIX-01 | Phase 19 | Pending |
| BFIX-02 | Phase 18 | Complete |
| BFIX-03 | Phase 18 | Complete |
| BFIX-04 | Phase 19 | Pending |
| AGNT-10 | Phase 20 | Complete |
| AGNT-11 | Phase 20 | Complete |
| AGNT-12 | Phase 20 | Complete |
| AGNT-13 | Phase 20 | Complete |
| AGNT-14 | Phase 19 | Pending |
| SKLL-10 | Phase 21 | Complete |
| SKLL-11 | Phase 21 | Complete |
| SKLL-12 | Phase 21 | Complete |
| CMND-10 | Phase 21 | Complete |
| CMND-11 | Phase 21 | Complete |
| HARD-01 | Phase 22 | Pending |
| HARD-02 | Phase 22 | Pending |
| HARD-03 | Phase 22 | Pending |
| HARD-04 | Phase 22 | Complete |
| QAPL-01 | Phase 23 | Complete |

**Coverage:**
- v1 requirements: 15 total (all Complete)
- v2 requirements: 42 total (34 original + 8 fallback)
- v4 requirements: 19 total
- Mapped to phases: 42/42 (v1+v2), 19/19 (v4)
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-04-03 after v4.0 roadmap creation*
