# Phase 11: Gap Matrix

## Methodology

Gaps were identified by cross-referencing the feature inventories from all 5 competitor deep-dives (GSD, superpowers, OMO, ECC, claude-mem), the broader ecosystem scan of 52+ plugins (06-broader-ecosystem.md), and the 7 novel opportunities (07-novel-opportunities.md) against our current plugin inventory (11 tools, 14 agents, 22 review specialists, 5 commands, 1 skill, 4 hooks).

Each gap was evaluated against the priority criteria below. Phase assignments follow the logic from 11-RESEARCH.md: quick wins to Phase 12, observability to Phase 13, skills/commands to Phase 14, memory to Phase 15, agents to Phase 16, integration/polish to Phase 17.

**Note on coverage areas:** D-07 specifies 8 coverage areas. This matrix expands to 10 by adding Safety and Developer Experience as distinct areas -- both emerged as significant gap categories during research.

Data sources: 01-gsd-deep-dive.md, 02-superpowers-deep-dive.md, 03-omo-deep-dive.md, 04-ecc-deep-dive.md, 05-claude-mem-deep-dive.md, 06-broader-ecosystem.md, 07-novel-opportunities.md, 11-RESEARCH.md.

## Priority Criteria (per D-08)

- **CRITICAL**: Table-stakes for "best-in-class" claim AND multiple competitors have it
- **HIGH**: Clear user value AND at least one competitor has proven demand
- **MEDIUM**: Would differentiate but is not blocking -- nice to have for v3.0
- **LOW**: Exists in ecosystem but does not align with our value proposition

---

## Coverage Area 1: Skills

### Current State
- We have: 1 skill (coding-standards)
- Competitor range: superpowers (14), ECC (30+), OMO (4), GSD (0), claude-mem (5)

### Gap Table

| Gap ID | Feature | GSD | Superpowers | OMO | ECC | claude-mem | We Have | Priority | Phase |
|--------|---------|-----|-------------|-----|-----|-----------|---------|----------|-------|
| SK-01 | Brainstorming / creative design | - | Socratic design refinement skill | - | brainstorming workflows | - | Nothing | CRITICAL | 14 |
| SK-02 | TDD workflow | - | Strict RED-GREEN-REFACTOR with anti-pattern catalog | - | tdd-workflow skill | - | Nothing | CRITICAL | 14 |
| SK-03 | Systematic debugging | - | 4-phase root cause analysis (reproduce, isolate, diagnose, fix) | - | build-error-resolver variants | - | Nothing (oc_forensics is post-hoc) | CRITICAL | 14 |
| SK-04 | Verification-before-completion | - | Explicit "did you actually check it works" gate | - | verification-loop skill | - | Nothing (review engine is post-hoc) | HIGH | 14 |
| SK-05 | Git worktrees / isolated workspace | - | Isolated workspace on new branch with test baseline | - | - | - | Nothing | HIGH | 14 |
| SK-06 | Plan writing (user-facing) | Methodology in agent prompts | Bite-sized tasks (2-5 min) with file paths | - | - | make-plan skill | Nothing (orchestrator plans internally) | HIGH | 14 |
| SK-07 | Plan executing | Wave-based execution | Batch execution with human checkpoints | - | - | do skill | Nothing exposed to users | HIGH | 14 |
| SK-08 | Code review requesting/receiving | - | Pre-review checklist + feedback integration | - | - | - | oc_review tool (no methodology guidance) | MEDIUM | 14 |
| SK-09 | Language-specific patterns (TypeScript) | - | - | - | backend-patterns, bun-runtime | - | coding-standards (generic) | HIGH | 14 |
| SK-10 | Language-specific patterns (Go) | - | - | - | golang-patterns | - | Nothing | MEDIUM | 14 |
| SK-11 | Language-specific patterns (Python) | - | - | - | python-patterns, django-patterns | - | Nothing | MEDIUM | 14 |
| SK-12 | Language-specific patterns (Rust) | - | - | - | rust coding standards | - | Nothing | MEDIUM | 14 |
| SK-13 | Strategic compaction | - | - | - | strategic-compact skill | - | Nothing | MEDIUM | 14 |
| SK-14 | Writing skills (meta-skill) | - | writing-skills meta-skill | - | skill-create command | - | /new-skill command (scaffolding only) | LOW | Skip |
| SK-15 | Security review skill | - | - | pre-publish-review | security-review skill | - | 22 review specialists (tool-based) | LOW | Skip |
| SK-16 | Adaptive skill loading via project fingerprinting (See also: NV-01) | - | - | - | Selective stacks (manual, v1.9.0) | - | Single skill loaded always | HIGH | 14 |
| SK-17 | Composable skill chains (dependency resolution) | - | Independent skills | - | Independent skills | - | Nothing | MEDIUM | 14 |
| SK-18 | E2E testing patterns | - | - | - | e2e-testing skill | - | Nothing | MEDIUM | 14 |

---

## Coverage Area 2: Commands

### Current State
- We have: 5 commands (/new-agent, /new-skill, /new-command, /oc-configure, /review-pr)
- Competitor range: GSD (60+), superpowers (3), OMO (5), ECC (34-68), claude-mem (1)

### Gap Table

| Gap ID | Feature | GSD | Superpowers | OMO | ECC | claude-mem | We Have | Priority | Phase |
|--------|---------|-----|-------------|-----|-----|-----------|---------|----------|-------|
| CM-01 | Doctor / diagnostics | /gsd:health | - | /doctor | /harness-audit | - | Nothing | CRITICAL | 12 |
| CM-02 | Documentation sync (See also: DX-04) | /gsd:docs-update | - | - | /update-docs, /update-codemaps | - | Nothing | HIGH | 14 |
| CM-03 | Asset stocktake / audit | /gsd:stats | - | /omomomo | /skill-health, /skill-stocktake | - | Nothing | HIGH | 14 |
| CM-04 | Session stats / report | /gsd:session-report | - | - | /sessions | /timeline-report | Nothing | HIGH | 13 |
| CM-05 | Pipeline report (decision replay) | /gsd:progress | - | - | - | - | Nothing | HIGH | 13 |
| CM-06 | TDD command (invoke TDD skill) | - | - | - | /tdd | - | Nothing | MEDIUM | 14 |
| CM-07 | Plan command (invoke planning skill) | - | /write-plan | - | /plan | - | Nothing | MEDIUM | 14 |
| CM-08 | Brainstorm command (invoke brainstorming skill) | - | /brainstorm | - | - | - | Nothing | MEDIUM | 14 |
| CM-09 | Quick task / fast execution | /gsd:quick, /gsd:fast | - | - | - | - | Nothing | MEDIUM | 12 |
| CM-10 | Dead code removal | - | - | /remove-deadcode | /refactor-clean | - | Nothing | LOW | Skip |
| CM-11 | Instinct management | - | - | - | /learn, /learn-eval, /evolve, /prune | - | Nothing | MEDIUM | 15 |
| CM-12 | Seed / forward-looking idea capture | /gsd:plant-seed, /gsd:note | - | - | - | - | Nothing | LOW | Skip |

---

## Coverage Area 3: Hooks

### Current State
- We have: 4 hooks (config, event, chat.message, tool.execute.after)
- Competitor range: GSD (5), superpowers (1), OMO (70+), ECC (7+), claude-mem (6)

### Gap Table

| Gap ID | Feature | GSD | Superpowers | OMO | ECC | claude-mem | We Have | Priority | Phase |
|--------|---------|-----|-------------|-----|-----|-----------|---------|----------|-------|
| HK-01 | Session start context/memory injection | - | session-start | start-work | SessionStart | SessionStart | First-load toast only | CRITICAL | 15 |
| HK-02 | Session end state/memory capture | - | - | session-notification | SessionEnd | SessionEnd, Stop | Nothing | CRITICAL | 15 |
| HK-03 | Destructive command prevention (tool.execute.before) | - | - | - | - | - | Nothing (CC Safety Net ecosystem plugin) | HIGH | 17 |
| HK-04 | Context window monitoring | gsd-context-monitor | - | context-window-monitor | - | - | Nothing | HIGH | 13 |
| HK-05 | Pre-compaction state preservation | - | - | compaction-context-injector | pre-compact | - | Nothing | MEDIUM | 17 |
| HK-06 | Comment quality checker (anti-slop) | - | - | comment-checker | - | - | Nothing | MEDIUM | 17 |
| HK-07 | Secret/env protection -> Consolidated into SF-02 | - | - | - | - | - | Nothing (Envsitter Guard ecosystem plugin) | HIGH | 17 |
| HK-08 | Auto-format after file edit | - | - | - | file.edited hook | - | Nothing | MEDIUM | 17 |
| HK-09 | Session error structured capture | - | - | session-recovery (10+ modes) | - | - | Event hook (basic) | HIGH | 13 |
| HK-10 | Tool usage metrics capture | - | - | - | tool.execute.after | - | tool.execute.after (fallback only) | HIGH | 13 |
| HK-11 | Pattern extraction on session end | - | - | - | evaluate-session | - | Lesson memory (session-scoped) | MEDIUM | 15 |
| HK-12 | Hook profiles (minimal/standard/strict) | - | - | - | minimal/standard/strict profiles | - | Nothing | MEDIUM | 17 |

---

## Coverage Area 4: Agents

### Current State
- We have: 14 agents (5 primary, 9 hidden pipeline), 22 review specialists
- Competitor range: GSD (21), superpowers (1), OMO (11), ECC (24), claude-mem (0)

### Gap Table

| Gap ID | Feature | GSD | Superpowers | OMO | ECC | claude-mem | We Have | Priority | Phase |
|--------|---------|-----|-------------|-----|-----|-----------|---------|----------|-------|
| AG-01 | Language-specific code reviewers | - | - | - | go-reviewer, rust-reviewer, python-reviewer, cpp-reviewer, java-reviewer, kotlin-reviewer | - | 22 universal review specialists + stack-gating | LOW | Skip |
| AG-02 | Language-specific build resolvers | - | - | - | go-build-resolver, rust-build-resolver, cpp-build-resolver, java-build-resolver, kotlin-build-resolver | - | Nothing (oc_forensics handles post-hoc) | LOW | Skip |
| AG-03 | Doc updater agent | gsd-doc-writer | - | Librarian | doc-updater | - | @documenter (prompt-based) | LOW | Skip |
| AG-04 | Intent gate / pre-routing analysis | - | - | Metis (IntentGate) | - | - | Nothing | LOW | Skip |
| AG-05 | Background task agents | - | - | Sisyphus-Junior, background agents | loop-operator | - | Pipeline hidden agents | LOW | Skip |

### Agent Archetype Assessment (D-12)

Research across all 5 competitors shows the skills > agents trend. MasterDebugger, Reviewer, Planner, TDD Guide, and Doc Updater are all better served as skills or commands (see 11-AGENT-VERDICT.md). Phase 16 should be scoped down to autopilot agent enhancements or merged into Phase 17.

---

## Coverage Area 5: Memory

### Current State
- We have: Review memory (per-project), lesson memory (session-scoped with decay), confidence ledger, decision log
- Competitor range: GSD (structured markdown files), superpowers (none), OMO (boulder state), ECC (instinct system), claude-mem (full memory DB)

### Gap Table

| Gap ID | Feature | GSD | Superpowers | OMO | ECC | claude-mem | We Have | Priority | Phase |
|--------|---------|-----|-------------|-----|-----|-----------|---------|----------|-------|
| MM-01 | Cross-session persistent memory | PROJECT.md, STATE.md, ROADMAP.md | - | Boulder state | Instinct persistence | SQLite + Chroma full DB | Session-scoped only | CRITICAL | 15 |
| MM-02 | 3-layer progressive disclosure retrieval | - | - | - | - | Search -> Timeline -> Details (10x savings) | Nothing | CRITICAL | 15 |
| MM-03 | Observation-based capture (typed: decisions, patterns, errors, preferences) | Structured markdown files | - | - | Pattern extraction with confidence | 6 lifecycle hooks capturing typed observations | Lesson memory (4 domains) | HIGH | 15 |
| MM-04 | AI compression / summarization before storage | - | - | - | - | AI-compressed session summaries | Nothing | HIGH | 15 |
| MM-05 | System prompt injection of memories | - | - | - | Instinct injection at SessionStart | before_prompt_build hook | Skill injection via config hook (pattern exists) | HIGH | 15 |
| MM-06 | Confidence-scored pattern extraction | - | - | - | /learn-eval with confidence scoring | - | Lesson memory (no confidence scoring) | HIGH | 15 |
| MM-07 | Instinct-to-skill evolution pipeline (See also: NV-03) | - | - | - | /evolve clusters instincts into skills (manual) | - | Nothing | MEDIUM | 15 |
| MM-08 | Time-weighted decay / pruning | - | - | - | /prune for expired patterns | Unlimited growth (weakness) | Lesson memory has decay | MEDIUM | 15 |
| MM-09 | Cross-project knowledge sharing (user-level) | - | - | - | /instinct-import/export (manual) | Project-scoped only | Nothing | MEDIUM | 15 |
| MM-10 | Timeline reports / narrative history | - | - | - | - | /timeline-report generates narrative docs | Nothing | MEDIUM | 15 |
| MM-11 | Token budget cap on memory injection | - | - | - | - | No explicit cap (weakness) | Nothing | HIGH | 15 |

---

## Coverage Area 6: Workflows

### Current State
- We have: 8-phase autonomous SDLC pipeline (oc_orchestrate), per-task review integration
- Competitor range: GSD (full lifecycle), superpowers (plan/execute skills), OMO (task delegation), ECC (multi-execution)

### Gap Table

| Gap ID | Feature | GSD | Superpowers | OMO | ECC | claude-mem | We Have | Priority | Phase |
|--------|---------|-----|-------------|-----|-----|-----------|---------|----------|-------|
| WF-01 | Confidence-driven progressive autonomy (See also: NV-02) | Fixed autonomy mode | - | - | Fixed hook profiles | - | Confidence ledger (no autonomy connection) | HIGH | 17 |
| WF-02 | Quick task mode (skip full pipeline) | /gsd:quick, /gsd:fast | - | - | - | - | Full pipeline only | MEDIUM | 12 |
| WF-03 | Session handoff / continuity | - | - | Session recovery hooks | Session save/resume | SessionStart/End capture | Nothing | MEDIUM | 15 |
| WF-04 | Context window health management | 30-40% main session target | - | Preemptive compaction | suggest-compact hook | - | Nothing | MEDIUM | 17 |
| WF-05 | Workflow enforcement hooks | gsd-workflow-guard | - | todo-continuation-enforcer | - | - | Nothing | LOW | Skip |

---

## Coverage Area 7: Observability

### Current State
- We have: Decision log (timestamped decisions), confidence ledger (per-decision scores), fallback event handling
- Competitor range: GSD (structured state files), OMO (session notifications), ECC (session evaluation), claude-mem (timeline)

### Gap Table

| Gap ID | Feature | GSD | Superpowers | OMO | ECC | claude-mem | We Have | Priority | Phase |
|--------|---------|-----|-------------|-----|-----|-----------|---------|----------|-------|
| OB-01 | Structured event logging (JSON) | - | - | Session notifications | Session evaluation | Timeline events | Fallback events only | CRITICAL | 13 |
| OB-02 | Token / cost tracking per session | - | - | - | - | Token tracking | Nothing | HIGH | 13 |
| OB-03 | Session summary generation | /gsd:session-report | - | - | - | AI-compressed session summaries | Nothing | HIGH | 13 |
| OB-04 | Pipeline decision replay (See also: NV-04) | /gsd:progress (state files) | - | - | - | - | Decision log (raw, no replay) | HIGH | 13 |
| OB-05 | Context-aware token budgeting | - | - | - | - | - | Nothing | MEDIUM | 17 |
| OB-06 | Session analysis / post-session report | /gsd:stats | - | - | evaluate-session | Timeline reports | Nothing | MEDIUM | 13 |
| OB-07 | Context utilization monitoring dashboard | - | - | Context window monitor | - | - | Nothing | MEDIUM | 13 |

---

## Coverage Area 8: Testing

### Current State
- We have: 90% coverage floor (CI), 107+ tests, type-check + lint enforcement
- Competitor range: GSD (validation tests), superpowers (skill structure tests), OMO (unknown), ECC (eval-harness)

### Gap Table

| Gap ID | Feature | GSD | Superpowers | OMO | ECC | claude-mem | We Have | Priority | Phase |
|--------|---------|-----|-------------|-----|-----|-----------|---------|----------|-------|
| TS-01 | TDD enforcement hook | - | - | - | TDD Guard (ecosystem plugin) | - | Nothing | MEDIUM | 17 |
| TS-02 | Eval harness (measure agent effectiveness) | - | - | - | eval-harness skill | - | Nothing | LOW | Skip |
| TS-03 | Mock provider for fallback testing | - | - | - | - | - | Nothing (planned Phase 13) | HIGH | 13 |

---

## Coverage Area 9: Safety

### Current State
- We have: Atomic file writes (wx flag), COPYFILE_EXCL for installer, model fallback error handling
- Competitor range: GSD (prompt guard, workflow guard), OMO (write guards, session recovery), ECC (security-audit tool)

### Gap Table

| Gap ID | Feature | GSD | Superpowers | OMO | ECC | claude-mem | We Have | Priority | Phase |
|--------|---------|-----|-------------|-----|-----|-----------|---------|----------|-------|
| SF-01 | Destructive git/shell command prevention | gsd-prompt-guard | - | write-existing-file-guard | - | - | Nothing | HIGH | 17 |
| SF-02 | Secret / .env leak protection (See also: HK-07) | - | - | - | - | - | Nothing (Envsitter Guard ecosystem plugin) | HIGH | 17 |
| SF-03 | Input sanitization for hook/prompt injection | gsd-prompt-guard | - | Rules-injector (has vulnerability) | - | - | Nothing | MEDIUM | 17 |
| SF-04 | Self-healing configuration repair | - | - | - | - | - | Config v4 auto-migration (partial) | HIGH | 12 |

---

## Coverage Area 10: Developer Experience

### Current State
- We have: /oc-configure wizard, self-healing asset installer, config v4 with auto-migration (v1→v2→v3→v4)
- Competitor range: GSD (60+ commands, settings), OMO (/doctor, model routing), ECC (skill-health, harness-audit, prompt-optimize)

### Gap Table

| Gap ID | Feature | GSD | Superpowers | OMO | ECC | claude-mem | We Have | Priority | Phase |
|--------|---------|-----|-------------|-----|-----|-----------|---------|----------|-------|
| DX-01 | Self-healing doctor with auto-repair (See also: NV-06) | /gsd:health | - | /doctor (report only) | /harness-audit, /skill-health | Smart Install | Config v4 migration (partial) | CRITICAL | 12 |
| DX-02 | Plugin health diagnostics | /gsd:health | - | /doctor | /harness-audit | - | Nothing | CRITICAL | 12 |
| DX-03 | Installed asset audit / stocktake | /gsd:stats | - | - | /skill-stocktake | - | Nothing | HIGH | 14 |
| DX-04 | Documentation sync with code changes -> Consolidated into CM-02 | /gsd:docs-update | - | - | /update-docs, /update-codemaps | - | Nothing | HIGH | 14 |
| DX-05 | Agent/skill markdown linter | - | skill structure tests | - | - | - | Template validation in creation tools | MEDIUM | 14 |
| DX-06 | Prompt optimization tooling | - | - | - | /prompt-optimize, /rules-distill | - | Metaprompter agent | LOW | Skip |

---

## Novel Opportunities (from 07-novel-opportunities.md)

| Gap ID | Opportunity | Feasibility | User Value | Priority | Phase |
|--------|-------------|-------------|------------|----------|-------|
| NV-01 | Adaptive skill loading via project fingerprinting (See also: SK-16) | HIGH | HIGH | HIGH | 14 |
| NV-02 | Confidence-driven progressive autonomy (See also: WF-01) | HIGH | HIGH | HIGH | 17 |
| NV-03 | Cross-session pattern evolution (instinct-to-skill pipeline) (See also: MM-07) | MEDIUM | HIGH | MEDIUM | 15 |
| NV-04 | Pipeline observability with decision replay (See also: OB-04) | HIGH | HIGH | HIGH | 13 |
| NV-05 | Composable skill chains (dependency resolution) | MEDIUM | MEDIUM | MEDIUM | 14 |
| NV-06 | Self-healing configuration with doctor-driven repair (See also: DX-01) | HIGH | HIGH | CRITICAL | 12 |
| NV-07 | Context-aware token budgeting | MEDIUM | MEDIUM | MEDIUM | 17 |

---

## Priority Summary

| Priority | Count | Phase Distribution |
|----------|-------|--------------------|
| CRITICAL | 12 | Phase 12: 4 (CM-01, DX-01, DX-02, NV-06), Phase 13: 1 (OB-01), Phase 14: 3 (SK-01, SK-02, SK-03), Phase 15: 4 (MM-01, MM-02, HK-01, HK-02) |
| HIGH | 26 | Phase 12: 1 (SF-04), Phase 13: 9 (CM-04, CM-05, HK-04, HK-09, HK-10, OB-02, OB-03, OB-04, TS-03), Phase 14: 8 (SK-04, SK-05, SK-06, SK-07, SK-09, SK-16, CM-02, CM-03, DX-03), Phase 15: 5 (MM-03, MM-04, MM-05, MM-06, MM-11), Phase 17: 4 (HK-03, SF-01, SF-02, WF-01). Note: NV cross-refs (NV-01→SK-16, NV-02→WF-01, NV-04→OB-04) and consolidated items (HK-07→SF-02, DX-04→CM-02) counted under primary ID only. Distinct count: 27; deduplicated: 26. |
| MEDIUM | 24 | Phase 12: 1, Phase 13: 2, Phase 14: 8, Phase 15: 5, Phase 17: 7, Novel: 1 |
| LOW | 11 | Skip: 9, Skip (Agent): 2 |

**Total gaps identified:** 73
**Assigned to phases:** 62
**Deferred/skipped:** 11 (all LOW priority)

**Phase 16 note:** Phase 16 has no directly assigned gaps. Research recommends either (a) assigning autopilot agent enhancements (memory injection, skill-aware routing, confidence tuning) or (b) merging Phase 16 into Phase 17. See 11-AGENT-VERDICT.md.
