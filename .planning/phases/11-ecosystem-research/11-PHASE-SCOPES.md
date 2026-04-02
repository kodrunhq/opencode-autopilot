# Phase Scope Definitions (Derived from Gap Matrix)

## Summary

The gap matrix identified 71 total gaps: 12 CRITICAL, 26 HIGH, 24 MEDIUM, 11 LOW. All CRITICAL and HIGH gaps (38 total) are assigned to phases. 18 MEDIUM gaps are assigned where they naturally fit; 6 MEDIUM gaps deferred to post-v3.0. All 11 LOW gaps are skipped (deferred indefinitely or not aligned with value proposition).

Total planned features across Phases 12-17: 56 (38 CRITICAL/HIGH + 18 MEDIUM).

---

### Phase 12: Quick Wins & Fixes

**Scope:** Self-healing diagnostics, configuration repair, and small high-value improvements that require no research or complex architecture.

**Gap IDs:** CM-01, DX-01, DX-02, SF-04, NV-06, WF-02, CM-09

**Features:**
1. Self-healing doctor with auto-repair (DX-01, NV-06, CRITICAL) -- On every plugin load, run lightweight health checks and silently repair common issues (missing agents, corrupted config, stale assets). Extends existing config v3 migration and COPYFILE_EXCL installer with a comprehensive health check registry.
2. Plugin health diagnostics command (CM-01, DX-02, CRITICAL) -- `/doctor` command that verifies plugin registration, agent injection (14 agents present), config validity (v3 schema), model assignments working, asset directory health. Reports pass/fail with fix suggestions.
3. Self-healing configuration repair (SF-04, HIGH) -- Auto-migrate broken configs, re-inject missing agents, re-install missing assets on load. Log all repairs transparently for user review.
4. Quick task mode (WF-02, CM-09, MEDIUM) -- Lightweight `/quick` command that runs a simplified pipeline (skip exploration, skip planning for simple requests). Detects simple requests automatically.

**Estimated Plans:** 2
**Dependencies:** Phase 10 (no research dependency beyond Phase 11 recommendations)

---

### Phase 13: Session Observability

**Scope:** Structured event logging, session metrics, pipeline decision replay, and token tracking that gives users full visibility into what the plugin and orchestrator are doing.

**Gap IDs:** OB-01, OB-02, OB-03, OB-04, OB-06, OB-07, CM-04, CM-05, HK-04, HK-09, HK-10, NV-04, TS-03

**Features:**
1. Structured event logging (OB-01, CRITICAL) -- Every fallback trigger, model error, autopilot decision, and pipeline phase transition captured as structured JSON events with timestamps, phase, agent, and context. Stored in ~/.config/opencode/logs/.
2. Token / cost tracking per session (OB-02, HIGH) -- Track token consumption per tool call, per phase, and per session. Expose via metrics object accessible by commands.
3. Session summary generation (OB-03, HIGH) -- Auto-generate human-readable session summaries from structured events. Include decisions made, phases executed, findings, and token cost.
4. Pipeline decision replay (OB-04, NV-04, HIGH) -- Structured decision log format that captures what alternatives were considered, why option A was chosen over B, and confidence scores. `/pipeline-report` command to view and replay decisions.
5. Session stats command (CM-04, HIGH) -- `/session-stats` command exposing token counts, tool breakdown, duration, and cost per session.
6. Pipeline report command (CM-05, HIGH) -- `/pipeline-report` command for post-run decision trace with override capability.
7. Context window monitoring hook (HK-04, HIGH) -- Monitor context utilization via session events and warn when approaching limits. Emit structured warnings.
8. Session error structured capture (HK-09, HIGH) -- Extend event hook to capture structured error events with classification (retryable, terminal, model-specific).
9. Tool usage metrics capture (HK-10, HIGH) -- Extend tool.execute.after hook to record per-tool metrics (invocation count, duration, success/failure).
10. Session analysis / post-session report (OB-06, MEDIUM) -- Generate post-session analysis reports with strategic guidance for session improvement.
11. Context utilization monitoring dashboard (OB-07, MEDIUM) -- TUI-compatible context utilization display with current token budget and subsystem allocation.
12. Mock provider for fallback testing (TS-03, HIGH) -- Configurable mock provider that simulates specific failure modes (rate limit, quota, timeout, malformed) for fallback chain testing.

**Estimated Plans:** 4
**Dependencies:** Phase 12

---

### Phase 14: Skills & Commands

**Scope:** High-impact skills identified by research (brainstorming, TDD, debugging, verification, git worktrees), language-specific skill stacks with adaptive loading, documentation sync commands, and asset auditing.

**Note:** Phase 14 is subdivided into 14a and 14b for planning tractability. This is an internal subdivision, not a new phase per D-03.

**Gap IDs:** SK-01, SK-02, SK-03, SK-04, SK-05, SK-06, SK-07, SK-08, SK-09, SK-10, SK-11, SK-12, SK-13, SK-16, SK-17, SK-18, CM-02, CM-03, CM-06, CM-07, CM-08, DX-03, DX-04, DX-05, NV-01, NV-05

#### Phase 14a: Core Skills & Commands

**Scope:** Methodology skills and their companion commands -- the highest-value gaps that apply to all projects regardless of language or stack.

**Gap IDs:** SK-01, SK-02, SK-03, SK-04, SK-05, SK-06, SK-07, SK-08, SK-13, SK-18, CM-02, CM-03, CM-06, CM-07, CM-08, DX-03, DX-04

**Features:**
1. Brainstorming skill (SK-01, CRITICAL) -- Socratic design refinement: asks clarifying questions, explores alternatives, presents design in structured sections. The single most impactful skill gap identified across the ecosystem.
2. TDD workflow skill (SK-02, CRITICAL) -- Strict RED-GREEN-REFACTOR with anti-pattern catalog. Includes explicit failure modes to avoid (writing tests after code, skipping RED, over-engineering in GREEN). Paired with /tdd command (CM-06).
3. Systematic debugging skill (SK-03, CRITICAL) -- Four-phase root cause analysis (reproduce, isolate, diagnose, fix) with defense-in-depth and regression prevention. Complements oc_forensics tool.
4. Verification-before-completion skill (SK-04, HIGH) -- Lightweight pre-completion checklist: run the thing, verify the output, check edge cases, confirm the original issue is resolved.
5. Git worktrees skill (SK-05, HIGH) -- Isolated development workflow on new branch with clean test baseline. Covers git worktree add, setup, verify baseline, work, and merge/PR decision.
6. Plan writing skill (SK-06, HIGH) -- User-facing planning methodology: bite-sized tasks (2-5 min each) with exact file paths and acceptance criteria. Exposed via /write-plan command (CM-07).
7. Plan executing skill (SK-07, HIGH) -- Batch execution methodology with verification after each task group. Integrates with existing orchestrator pipeline.
8. Code review skills (SK-08, MEDIUM) -- Requesting code review (pre-review checklist) and receiving code review (feedback integration process). Complement the oc_review tool with methodology guidance.
9. Strategic compaction skill (SK-13, MEDIUM) -- Teaches when and how to compact context: what to preserve, what to discard, timing decisions.
10. E2E testing patterns skill (SK-18, MEDIUM) -- End-to-end testing methodology with Playwright/Cypress patterns.
11. Documentation sync command (CM-02, DX-04, HIGH) -- `/update-docs` command that identifies documentation drift from code changes and generates updates.
12. Asset stocktake / audit command (CM-03, DX-03, HIGH) -- `/stocktake` command listing all active skills, commands, agents; shows built-in vs user-created; flags conflicts and duplicates.
13. Brainstorm command (CM-08, MEDIUM) -- `/brainstorm` command invoking the brainstorming skill with topic argument.
14. TDD command (CM-06, MEDIUM) -- `/tdd` command invoking the TDD workflow skill with target argument.
15. Plan command (CM-07, MEDIUM) -- `/write-plan` command invoking the plan writing skill with feature description.

#### Phase 14b: Language Stacks & Skill Infrastructure

**Scope:** Language-specific skill stacks, adaptive loading infrastructure, composable skill chains, and the asset linter. Depends on 14a patterns being established.

**Gap IDs:** SK-09, SK-10, SK-11, SK-12, SK-16, SK-17, DX-05, NV-01, NV-05

**Features:**
1. Adaptive skill loading via project fingerprinting (SK-16, NV-01, HIGH) -- Auto-detect project tech stack (package.json, go.mod, Cargo.toml, pyproject.toml) and load only relevant skill stacks. Extends Phase 10's relevantStacks detection.
2. TypeScript/Bun patterns skill stack (SK-09, HIGH) -- TypeScript-specific patterns, Bun runtime idioms, testing with bun:test. Loaded automatically for TypeScript projects.
3. Go patterns skill stack (SK-10, MEDIUM) -- Go idioms, testing patterns, concurrency. Loaded automatically for Go projects.
4. Python patterns skill stack (SK-11, MEDIUM) -- Python patterns, Django/Flask, pytest. Loaded automatically for Python projects.
5. Rust patterns skill stack (SK-12, MEDIUM) -- Rust safety patterns, cargo testing, ownership idioms. Loaded automatically for Rust projects.
6. Composable skill chains (SK-17, NV-05, MEDIUM) -- Skills declare dependencies on other skills via `requires` field in SKILL.md frontmatter. Dependency resolution at injection time with cycle detection and token budget enforcement.
7. Asset markdown linter (DX-05, MEDIUM) -- Validate user-created AGENTS.md, SKILL.md, and command files for structure correctness and YAML frontmatter validity.

**Estimated Plans:** 6 (3 for 14a, 3 for 14b)
**Dependencies:** Phase 11 (research defines scope)

---

### Phase 15: Memory System

**Scope:** Cross-session persistent memory with observation-based capture, progressive disclosure retrieval, confidence-scored pattern extraction, and instinct-to-skill evolution. The plugin genuinely gets smarter over time.

**Gap IDs:** MM-01, MM-02, MM-03, MM-04, MM-05, MM-06, MM-07, MM-08, MM-09, MM-10, MM-11, HK-01, HK-02, HK-11, WF-03, CM-11, NV-03

**Features:**
1. SQLite storage layer with FTS5 (MM-01, CRITICAL) -- bun:sqlite-based persistent storage with observations table, projects table, preferences table. FTS5 virtual table on observations.content and observations.summary for keyword search. Located at ~/.config/opencode/memory/memory.db.
2. 3-layer progressive disclosure retrieval (MM-02, CRITICAL) -- Layer 1 Search (~50-100 tokens, titles/summaries), Layer 2 Timeline (~200-500 tokens, chronological view), Layer 3 Details (~500-1000 tokens, full observation content). Agent controls depth of retrieval.
3. Observation-based capture (MM-03, HIGH) -- Structured observation types (decisions, patterns, errors, preferences, context, tool usage) with timestamps and project context. Never store raw transcripts.
4. AI compression before storage (MM-04, HIGH) -- Compress observations with AI summarization before persisting. Track compression ratio for quality monitoring.
5. System prompt injection of memories (MM-05, HIGH) -- Inject top-N relevant observations via config hook at session start. Reuse existing skill injection pattern. Token budget cap (configurable, default 2000 tokens).
6. Confidence-scored pattern extraction (MM-06, HIGH) -- Extend lesson memory with confidence scoring based on frequency, impact, consistency, and recency. Patterns below threshold are not injected.
7. Token budget cap on memory injection (MM-11, HIGH) -- Hard cap on tokens injected from memory per session (configurable, default 2000). Prevents memory from becoming a context bomb.
8. Session start memory injection hook (HK-01, CRITICAL) -- session.created hook that loads relevant memories for current project and injects into context.
9. Session end memory capture hook (HK-02, CRITICAL) -- Session lifecycle hook that captures observations from the completed session and persists to SQLite.
10. Instinct-to-skill evolution pipeline (MM-07, NV-03, MEDIUM) -- When a pattern reaches confidence threshold (5+ observations across 3+ sessions), automatically promote to a project-level skill. Quality validation before activation.
11. Time-weighted decay / pruning (MM-08, MEDIUM) -- Observations lose relevance over time (configurable, default 90-day half-life). Access-based refresh. Manual /prune command. Storage cap of 10,000 observations per project.
12. Cross-project knowledge sharing (MM-09, MEDIUM) -- User-level memories (preferences, workflow patterns) shared across all projects. Project-level memories (conventions, decisions) stay project-scoped.
13. Timeline reports (MM-10, MEDIUM) -- Generate narrative project history from stored session timeline data.
14. Session handoff / continuity (WF-03, MEDIUM) -- Extract key decisions and open tasks at session end, inject at session start. Integrated into memory capture/injection cycle.
15. Pattern extraction hook (HK-11, MEDIUM) -- On session end, extract recurring patterns from review findings, debugging sessions, and user corrections for confidence scoring.
16. Memory management commands (CM-11, MEDIUM) -- `/memory-status` for viewing accumulated memory, `/memory-prune` for cleanup.

**Estimated Plans:** 5
**Dependencies:** Phase 11 (research informs architecture)
**Architecture:** See 11-MEMORY-ARCHITECTURE.md

---

### Phase 16: Specialized Agents

**Scope:** Scoped down per research findings. Research consistently shows skills > agents for most use cases (superpowers 131k+ stars validates skills-only approach). Phase 16 focuses on a single validated use case: promoting the autopilot agent experience rather than adding speculative new agents.

**Gap IDs:** (none from gap matrix -- all agent gaps rated LOW and skipped)

**Features:**
1. Memory injection into autopilot dispatch prompts -- Surface relevant cross-session observations (from Phase 15 memory) in the autopilot agent's system prompt so decisions are informed by prior session context.
2. Skill-aware routing logic -- Select relevant skills per task type during autopilot dispatch. When the orchestrator identifies a TDD task, brainstorming request, or debugging session, automatically inject the corresponding Phase 14 skill.
3. Confidence threshold tuning based on learned patterns -- Calibrate the confidence ledger thresholds using accumulated memory data. Patterns with high confidence across sessions raise the autonomy threshold; novel patterns lower it.

If research validates insufficient value for these deliverables, merge remaining work into Phase 17.

**Estimated Plans:** 1
**Dependencies:** Phase 14 (skills to integrate), Phase 15 (memory to integrate)
**Verdict:** See 11-AGENT-VERDICT.md -- Option A (Scope Down) recommended. Most "specialized agent" needs better served as skills (Phase 14) or commands.

---

### Phase 17: Integration & Polish

**Scope:** Cross-feature integration, high-value safety hooks, hook profiles, confidence-driven autonomy, context-aware budgeting, and final production polish for v3.0 release.

**Gap IDs:** HK-03, HK-05, HK-06, HK-07, HK-08, HK-12, SF-01, SF-02, SF-03, TS-01, WF-01, WF-04, OB-05, NV-02, NV-07

**Features:**
1. Destructive command prevention hook (HK-03, SF-01, HIGH) -- tool.execute.before hook that intercepts Bash tool calls, pattern-matches against a deny-list of dangerous commands (git reset --hard, rm -rf, git push --force), blocks execution and suggests safe alternatives.
2. Secret / .env leak protection hook (HK-07, SF-02, HIGH) -- Intercept file read operations, detect .env patterns, redact sensitive values before they enter context.
3. Confidence-driven progressive autonomy (WF-01, NV-02, HIGH) -- Connect confidence ledger to orchestrator dispatch: high-confidence decisions proceed autonomously, low-confidence decisions pause for user input. Per-decision adaptive autonomy.
4. Pre-compaction state preservation (HK-05, MEDIUM) -- experimental.session.compacting hook that saves critical pipeline state before compaction.
5. Comment quality checker hook (HK-06, MEDIUM) -- tool.execute.after hook checking edited files for AI-generated comment bloat ("AI slop").
6. Auto-format after file edit (HK-08, MEDIUM) -- file.edited hook triggering auto-format on changed files.
7. Hook profiles (HK-12, MEDIUM) -- User-configurable automation intensity: minimal (diagnostics only), standard (safety + observability), strict (all hooks including formatting, comment checking, TDD enforcement).
8. Input sanitization for hook safety (SF-03, MEDIUM) -- Validate and sanitize all external input consumed by hooks. Prevent prompt injection via directory-injected content.
9. TDD enforcement hook (TS-01, MEDIUM) -- tool.execute.before hook checking if test file exists before allowing source file writes. Configurable strictness.
10. Context window health management (WF-04, MEDIUM) -- Monitor context utilization and trigger compaction suggestions or skill/memory budget reduction when approaching limits.
11. Context-aware token budgeting (OB-05, NV-07, MEDIUM) -- Dynamic allocation of token budgets across subsystems (skills, memory, observability) based on remaining context window. /context-budget command.
12. End-to-end integration testing -- Verify all v3.0 features work together: session -> decisions logged -> memories extracted -> next session improved.

**Estimated Plans:** 4
**Dependencies:** All prior v3.0 phases

---

## Phase 18+ (per D-03)

**No new phases needed -- all gaps fit within Phases 12-17.**

Per the assessment in 07-novel-opportunities.md: the existing phase structure accommodates all 71 identified gaps and 7 novel opportunities. The identified opportunities are enhancements to planned capabilities, not entirely new capability domains. Phase 14 absorbs skill intelligence features. Phase 15 absorbs learning/evolution features. Phase 17 absorbs integration features.

**One scope adjustment applied:** Phase 16 (Specialized Agents) has been scoped down from "Implement specialized primary agents" to "Autopilot agent enhancement with memory/skill integration." Research consistently shows skills are the superior form factor for methodology transfer (superpowers 131k+ stars, ECC transitioning commands to skills). No new specialized agents passed the "meaningfully better than existing tools" bar.

---

## Coverage Verification

| Priority | Total Gaps | Assigned | Unassigned |
|----------|-----------|----------|------------|
| CRITICAL | 12 | 12 | 0 |
| HIGH | 26 | 26 | 0 |
| MEDIUM | 24 | 18 | 6 (deferred to post-v3.0) |
| LOW | 11 | 0 | 11 (skipped) |

**Deferred MEDIUM gaps (post-v3.0):**
- SK-14: Writing skills meta-skill (our /new-skill scaffolding is sufficient)
- SK-15: Security review skill (22 review specialists cover this)
- CM-10: Dead code removal (low demand signal)
- CM-12: Seed / idea capture (low demand signal)
- DX-06: Prompt optimization (metaprompter agent covers this)
- TS-02: Eval harness (low demand signal)

**All CRITICAL and HIGH gaps are assigned to a phase with zero unassigned.**
