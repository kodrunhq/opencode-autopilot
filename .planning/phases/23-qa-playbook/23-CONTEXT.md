# Phase 23: QA Playbook - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a comprehensive QA playbook document (`docs/QA-PLAYBOOK.md`) with step-by-step manual test procedures for every plugin feature — all 20 tools, 11 commands, 8+ agents, skills system, memory, fallback chain, doctor diagnostics, and an abbreviated orchestrator E2E flow. Documentation only — no new code.

</domain>

<decisions>
## Implementation Decisions

### Playbook Structure
- **D-01:** Single markdown file at `docs/QA-PLAYBOOK.md`. Table of contents at top, sections for each feature area. Designed to be executed top-to-bottom in a single session.
- **D-02:** Grouped by feature area: Commands, Agents, Tools, Skills & Adaptive Injection, Memory System, Fallback Chain, Doctor & Health Checks, Observability, Orchestrator Pipeline (E2E).

### Test Procedure Depth
- **D-03:** Step-by-step with expected output. Each procedure includes: Prerequisites, Steps (numbered), Expected output (exact text or pattern to verify), Pass/Fail criteria. Detailed enough for an AI or new team member to execute without prior knowledge.
- **D-04:** One negative/error test case per feature. Each feature gets at least one test for invalid input, missing dependency, or expected error message.

### Coverage Scope
- **D-05:** All 20 registered tools get full test procedures: oc_doctor, oc_configure, oc_stocktake, oc_review, oc_create_agent, oc_create_skill, oc_create_command, oc_orchestrate, oc_phase, oc_state, oc_plan, oc_pipeline_report, oc_forensics, oc_logs, oc_memory_status, oc_mock_fallback, oc_confidence, oc_session_stats, oc_update_docs, oc_quick.
- **D-06:** All 11 commands get full procedures: oc-tdd, oc-review-pr, oc-brainstorm, oc-write-plan, oc-stocktake, oc-update-docs, oc-new-agent, oc-new-skill, oc-new-command, oc-quick, oc-review-agents.
- **D-07:** All 8 standard agents tested: researcher, metaprompter, documenter, pr-reviewer, autopilot, debugger, planner, reviewer.
- **D-08:** Abbreviated orchestrator E2E: one procedure running oc_orchestrate on a small task, verifying completion of all 8 phases.
- **D-09:** Skills, memory, fallback, and doctor each get dedicated sections with end-to-end flow tests.

### Location and Maintenance
- **D-10:** File lives at `docs/QA-PLAYBOOK.md`. Ships with the repo (visible on GitHub), not in the npm package.
- **D-11:** Manual update per phase — future phases that add/change features include a task to update the relevant playbook section.

### Claude's Discretion
- Exact pass/fail criteria wording for each test
- Order of feature areas within the playbook
- How much setup/teardown detail per section
- Whether to include a "Quick Smoke Test" summary section at the top
- Exact expected output patterns (may need to be approximate for dynamic content)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Feature Inventory
- `src/index.ts` — All 20 tool registrations and hook registrations (definitive list)
- `assets/commands/` — All 11 command markdown files (names, descriptions, argument hints)
- `src/agents/index.ts` — All 8 standard agent definitions (names, modes, descriptions)
- `assets/skills/` — All skill directories (names, stacks, requires)

### Tool Implementations
- `src/tools/*.ts` — Each tool's *Core function (inputs, outputs, behavior)
- `src/health/checks.ts` — 6 health checks (config, agent, asset, skill, memory, command)
- `src/health/runner.ts` — Health check runner (how checks are aggregated)
- `src/orchestrator/fallback/mock-interceptor.ts` — Mock fallback test mode
- `src/hooks/anti-slop.ts` — Anti-slop comment hook

### Existing Documentation
- `docs/gap-analysis-deep-dive.md` — Competitive analysis (reference for feature naming)
- `docs/plugin-comparison-report.md` — Plugin comparison (reference for feature descriptions)
- `CLAUDE.md` — Project architecture and constraints

### Config and CLI
- `src/config.ts` — Config v6 schema (all configurable options)
- `bin/cli.ts` — CLI commands (install, configure, doctor)
- `bin/configure-tui.ts` — TUI configuration wizard

</canonical_refs>

<code_context>
## Existing Code Insights

### Feature Inventory (for playbook coverage)
- **20 tools**: oc_doctor, oc_configure, oc_stocktake, oc_review, oc_create_agent, oc_create_skill, oc_create_command, oc_orchestrate, oc_phase, oc_state, oc_plan, oc_pipeline_report, oc_forensics, oc_logs, oc_memory_status, oc_mock_fallback, oc_confidence, oc_session_stats, oc_update_docs, oc_quick
- **11 commands**: oc-tdd, oc-review-pr, oc-brainstorm, oc-write-plan, oc-stocktake, oc-update-docs, oc-new-agent, oc-new-skill, oc-new-command, oc-quick, oc-review-agents
- **8 standard agents**: researcher, metaprompter, documenter, pr-reviewer, autopilot, debugger, planner, reviewer
- **10 pipeline agents**: recon, challenge, architect, explore, plan, build, ship, retrospective, arena-critic, arena-proposer
- **18 skills**: brainstorming, code-review, coding-standards, csharp-patterns, e2e-testing, frontend-design, git-worktrees, go-patterns, java-patterns, plan-executing, plan-writing, python-patterns, rust-patterns, strategic-compaction, systematic-debugging, tdd-workflow, typescript-patterns, verification
- **6 health checks**: config-validity, agent-injection, asset-directories, skill-loading, memory-db, command-accessibility

### Established Patterns
- Tool tests use `*Core` functions with injectable `baseDir`/`configDir` for isolation
- Agent tests verify mode, description keywords, permissions, maxSteps, and Object.isFrozen
- Config tests use temp directories with writeFile for fixture creation

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 23-qa-playbook*
*Context gathered: 2026-04-03*
