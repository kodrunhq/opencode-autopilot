# Feature Landscape

**Domain:** AI coding plugin for OpenCode CLI -- v4.0 Production Quality milestone
**Researched:** 2026-04-03
**Overall confidence:** HIGH (grounded in Phase 11 deep-dives of 5 competitors + current codebase audit)

---

## Current State (v1.7.0 as-shipped)

Before defining gaps, here is what already exists:

| Category | Count | Items |
|----------|-------|-------|
| Skills | 15 | brainstorming, code-review, coding-standards, e2e-testing, git-worktrees, go-patterns, plan-executing, plan-writing, python-patterns, rust-patterns, strategic-compaction, systematic-debugging, tdd-workflow, typescript-patterns, verification |
| Commands | 11 | brainstorm, new-agent, new-command, new-skill, oc-configure, quick, review-pr, stocktake, tdd, update-docs, write-plan |
| Tools | 20 | confidence, configure, create-agent, create-command, create-skill, doctor, forensics, logs, memory-status, mock-fallback, orchestrate, phase, pipeline-report, plan, quick, review, session-stats, state, stocktake, update-docs |
| Agents | 0 via assets (injected via config hook, but stocktake cannot detect them) |
| Memory | bun:sqlite with FTS5, observation capture, 3-layer progressive disclosure, decay |
| Observability | Event store, context monitor, log writer, retention |

**Key observation:** The Phase 11-17 work already shipped most of the CRITICAL and HIGH gaps from the original gap matrix (SK-01 through SK-18, CM-01 through CM-12, MM-01 through MM-11). The v4.0 milestone is about **production quality, expansion, and hardening** -- not greenfield features.

---

## Table Stakes

Features users expect from a "best-in-class" AI coding plugin. Missing = product feels incomplete compared to competitors (superpowers at 131k stars, ECC at 132k stars).

| # | Feature | Why Expected | Complexity | Depends On | Notes |
|---|---------|--------------|------------|------------|-------|
| T-01 | Primary agents visible in Tab cycle | Every competitor with agents (OMO: 11, ECC: 24) exposes primary agents via Tab. Our agents are injected via config hook but invisible to stocktake and possibly to Tab. | Low | Config hook fix | **BUG FIX.** Agents must be registered correctly so `oc_stocktake` detects them and they appear in Tab rotation. |
| T-02 | Debugger agent (primary or subagent) | GSD has gsd-debugger, OMO has Oracle, ECC has build-error-resolver. Every competitor has a dedicated debugging persona. Our systematic-debugging skill exists but no dedicated agent applies it. | Low | Agent registry, T-01 | Add as primary agent that loads systematic-debugging skill by default. Descriptive name like "Debugger" not mythology. |
| T-03 | Planner agent | GSD has gsd-planner, OMO has Prometheus, ECC has planner. Planning is a core workflow every competitor exposes as an agent. | Low | Agent registry, T-01 | Primary agent that loads plan-writing + plan-executing skills. |
| T-04 | Code Reviewer agent | superpowers ships code-reviewer agent, ECC has code-reviewer, OMO has agents that do reviews. | Low | Agent registry, T-01 | Primary agent that loads code-review skill + invokes oc_review. |
| T-05 | All commands prefixed with `oc-` | Namespace collision prevention is standard practice. OMO prefixes with `/omo`, GSD prefixes with `/gsd:`. Our current commands have mixed prefixes. | Low | Command rename | Rename: brainstorm -> oc-brainstorm, tdd -> oc-tdd, quick -> oc-quick, write-plan -> oc-write-plan, stocktake -> oc-stocktake, review-pr -> oc-review-pr, update-docs -> oc-update-docs. Keep new-agent/new-skill/new-command with oc- prefix too. |
| T-06 | Remove oc-configure as slash command | Configuration should be CLI-only, not in-session. No competitor exposes config as a slash command -- they use CLI (`opencode configure`, `gsd settings`). | Low | None | Remove from commands/, keep configure tool for CLI access. |
| T-07 | Agent stocktake detection fix | stocktake returns empty array for agents. Users cannot verify what agents are active. OMO's `/doctor` and ECC's `/harness-audit` both verify agent registration. | Medium | Config hook introspection | The config hook injects agents but stocktake scans filesystem only. Need to also check config hook output or maintain a registry. |
| T-08 | Coding standards: OOP/SOLID/Clean Architecture principles | ECC ships coding-standards skill with design principles. superpowers implicitly teaches clean code via anti-patterns. Our coding-standards skill covers formatting but not design principles. | Medium | coding-standards skill expansion | Add sections: SOLID principles, dependency inversion, separation of concerns, composition over inheritance, law of Demeter. |
| T-09 | Coding standards: more language coverage | ECC covers 12+ languages. We have 4 (TypeScript, Go, Python, Rust). Users working in Java, C++, Kotlin, or C# find no guidance. | Medium | New skill files | Add at minimum: Java patterns, C# patterns. These are the most common enterprise languages after the 4 we have. |
| T-10 | Agents.md review/improve command | Users create custom agents.md files but have no way to validate or improve them. ECC has `/prompt-optimize`, GSD has prompt engineering guidance. | Medium | Linter + LLM review | New command `/oc-review-agents` that reads project agents.md, validates structure, suggests improvements to system prompts. |

---

## Differentiators

Features that set the product apart from competitors. Not expected, but highly valued when present.

| # | Feature | Value Proposition | Complexity | Depends On | Notes |
|---|---------|-------------------|------------|------------|-------|
| D-01 | Mock/fail-forced fallback test mode | No competitor offers this. Users cannot verify their fallback chain works without waiting for real provider failures. A test mode that simulates rate-limit, timeout, quota-exceeded, and malformed responses lets users validate resilience. | Medium | mock-fallback tool exists | The `mock-fallback.ts` tool exists. This is about making it accessible from CLI configure (`opencode configure` -> fallback test mode toggle) and adding a `/oc-test-fallback` command that runs the chain with each failure mode and reports results. |
| D-02 | Manual QA playbook (internal) | No competitor ships a structured QA playbook. ECC has eval-harness but it measures agent effectiveness, not plugin feature correctness. A playbook ensures every feature/agent/flow is manually testable by maintainers. | Medium | All features stable | Document with step-by-step test procedures for: each command, each agent activation, each skill loading, memory capture/retrieval, observability logging, fallback chain, doctor self-healing. |
| D-03 | Tab-cycle ordering for primary agents | OMO orders agents by task category (Sisyphus first = orchestrator). No competitor documents or optimizes Tab ordering. Defining intentional order (General -> Debugger -> Planner -> Reviewer -> ...) improves discovery UX. | Low | Agent registry, T-01 | Define order in config hook injection. Most-used-first heuristic. |
| D-04 | Unified command surface (context-aware) | ECC has 68 commands, many language-specific variants (`/go-build`, `/rust-build`, `/cpp-build`). We can offer one `/oc-build-fix` that auto-detects language from project files. Fewer commands, smarter behavior. | Medium | Stack detection (already in adaptive-injector) | Anti-feature to have per-language commands. Use existing `detectRelevantStacks()` to route. |
| D-05 | Skill-aware doctor diagnostics | OMO's `/doctor` checks plugin health. ECC's `/skill-health` checks skills. Nobody combines both. Our doctor can verify: agents registered, skills loaded correctly per detected stack, commands accessible, memory DB healthy, observability logging, fallback chain configured. | Low | doctor tool exists | Extend existing doctor.ts with skill validation checks. |
| D-06 | Anti-slop comment checking | OMO has comment-checker hook preventing AI-generated comment bloat. No other competitor does this. This directly addresses the #1 user complaint about AI-generated code. | Medium | Hook system | Add as configurable hook in standard/strict profiles. Check for: obvious comments (`// increment i`), sycophantic language, excessive commenting ratio. |
| D-07 | Agents.md curated template library | No competitor ships opinionated agents.md templates for common project types (web API, CLI tool, library, monorepo). Providing starter agents.md files that users copy gives instant value without requiring them to write system prompts from scratch. | Medium | Agent template system | Library of 4-5 project-type templates: `web-api-agents.md`, `cli-tool-agents.md`, `library-agents.md`, `fullstack-agents.md`. Offered via `/oc-new-agent` or during first-run. |

---

## Anti-Features

Features to explicitly NOT build. Competitors have them; we should not.

| # | Anti-Feature | Why Avoid | What to Do Instead |
|---|--------------|-----------|-------------------|
| A-01 | Per-language build/test/review commands | ECC has 15+ language-specific commands (`/go-build`, `/rust-build`, `/cpp-build`, `/go-review`, `/rust-review`, etc.) creating command bloat. Users must memorize which command matches their project. The 68-command surface is a UX liability. | Single context-aware commands (`/oc-build-fix`, `/oc-test`, `/oc-review-pr`) that auto-detect language from project files. |
| A-02 | Model-specific agent routing | OMO routes Hephaestus to GPT only, Sisyphus to Claude only. This breaks for users with limited provider access and violates model-agnostic principles. | All agents work with any configured model. Fallback chain handles provider failures. |
| A-03 | Greek mythology / obscure agent names | OMO names: Sisyphus, Hephaestus, Prometheus, Oracle, Metis, Momus, Atlas. Users cannot intuit function from name. | Descriptive names: Debugger, Planner, Reviewer, Documenter. Function obvious from name. |
| A-04 | 70+ hooks (hook sprawl) | OMO has 70+ hooks creating significant runtime overhead and maintenance burden. Each session event triggers a cascade of evaluations. | Targeted hooks with clear value per hook. 10-15 well-designed hooks beat 70 scattered ones. Use hook profiles (minimal/standard/strict) to let users choose intensity. |
| A-05 | Business/content skills | ECC ships skills for investor decks, content production, social media APIs (article-writing, investor-materials, market-research, brand-voice, crosspost, fal-ai-media, video-editing, x-api). These dilute the developer tool value proposition. | Stay focused on SDLC: coding, testing, debugging, planning, reviewing, shipping. Content creation is a different product. |
| A-06 | Multi-runtime targeting (9+ runtimes) | ECC maintains separate directories for Claude Code, OpenCode, Cursor, Codex, Gemini, Kiro, Trae, CodeBuddy. This creates massive duplication and maintenance burden. | Target OpenCode only. If portability is needed later, it is a separate effort. |
| A-07 | IntentGate / pre-routing analysis agent | OMO's Metis agent analyzes user intent before task routing. Adds latency and complexity for marginal benefit. | Our orchestrator already analyzes intent in its initial phase. No separate agent needed. |
| A-08 | Background agent execution via tmux | OMO uses tmux for background agents. This assumes tmux is installed and is outside plugin scope. | Use OpenCode's native subagent dispatch for parallelism. |
| A-09 | Instinct import/export | ECC's cross-machine portability for learned patterns adds complexity for a niche use case. | Defer. Memory system handles per-project and per-user scopes. Cross-machine sync is post-v4.0. |
| A-10 | Clarify/remove "general"/"explore" agents | PROJECT.md mentions these as needing clarity. Rather than keeping ambiguous agents, remove them entirely if they have no clear purpose distinct from other agents. | Replace with well-defined agents (Debugger, Planner, Reviewer) that have clear scopes. If a "general" mode is needed, it is the default OpenCode agent with no plugin override. |

---

## Feature Dependencies

```
T-01 (Agent visibility fix) ---> T-02, T-03, T-04, D-03
  |                               (agents must be visible before adding/ordering new ones)
  |
T-07 (Stocktake detection fix) ---> T-01
  (stocktake must see agents)

T-05 (oc- prefix) --- independent (rename only)
T-06 (Remove oc-configure) --- independent
T-08 (OOP/SOLID standards) --- independent (skill content expansion)
T-09 (More language skills) --- independent (new skill files)
T-10 (Agents.md review) --- independent (new command)

D-01 (Fallback test mode) --- depends on mock-fallback tool (exists)
D-02 (QA playbook) --- depends on ALL other features (write last)
D-05 (Skill-aware doctor) --- depends on doctor tool (exists) + skill loader (exists)
D-06 (Anti-slop hook) --- depends on hook system (exists)
D-07 (Agents.md templates) --- can inform T-10 (review command)
```

---

## MVP Recommendation for v4.0

### Priority 1: Bug fixes and table stakes (ship first)

1. **T-01 + T-07**: Fix agent visibility -- stocktake detection + config hook registration so agents appear in Tab and diagnostic output. This is a bug, not a feature.
2. **T-02 + T-03 + T-04 + D-03**: Add primary agents (Debugger, Planner, Reviewer) with intentional Tab ordering. Low complexity, high visibility.
3. **T-05 + T-06**: Namespace cleanup -- prefix all commands with `oc-`, remove `oc-configure` command.

### Priority 2: Quality expansion (ship second)

4. **T-08**: Expand coding-standards with OOP/SOLID/Clean Architecture principles.
5. **T-09**: Add Java and C# language pattern skills.
6. **T-10**: Add `/oc-review-agents` command for agents.md validation.
7. **D-01**: Make fallback test mode accessible via CLI configure + command.
8. **D-05**: Extend doctor with skill-aware diagnostics.
9. **D-06**: Add anti-slop comment checking hook.

### Priority 3: Polish and documentation (ship last)

10. **D-02**: Write manual QA playbook covering all features.
11. **D-04**: Ensure commands are context-aware (auto-detect language).
12. **D-07**: Create agents.md template library for common project types.

### Defer to post-v4.0

- Per-language build/test/review commands (anti-feature A-01)
- Cross-machine memory portability (anti-feature A-09)
- Eval harness for measuring agent effectiveness (LOW priority from gap matrix)
- Dead code removal command (LOW demand signal)

---

## Competitor Parity Assessment

### What competitors ship that we already have (after v1.7.0)

| Capability | superpowers | ECC | OMO | GSD | We Have |
|------------|-------------|-----|-----|-----|---------|
| Brainstorming skill | Yes | Partial | No | No | Yes |
| TDD workflow | Yes | Yes | No | No | Yes |
| Debugging methodology | Yes | Partial | No | Yes (agent) | Yes |
| Verification gate | Yes | Yes | No | No | Yes |
| Git worktrees | Yes | No | No | No | Yes |
| Plan writing/executing | Yes | Partial | No | Yes (agents) | Yes |
| Code review skill | Yes | Yes | No | No | Yes |
| Strategic compaction | No | Yes | Partial | No | Yes |
| Language-specific skills | No | Yes (12+) | No | No | Yes (4) |
| Doctor/diagnostics | No | Yes | Yes | Yes | Yes |
| Memory system | No | Instincts | Boulder | Markdown | Yes (SQLite) |
| Observability/logging | No | Session eval | Notifications | State files | Yes |
| Adaptive skill loading | No | Partial | No | No | Yes |
| Fallback handling | No | No | Yes | No | Yes |

### What competitors ship that we are missing (v4.0 gaps)

| Capability | Who Has It | Impact | v4.0 Feature # |
|------------|-----------|--------|----------------|
| Primary agents in Tab cycle | OMO, ECC | HIGH | T-01, T-02, T-03, T-04 |
| Agent stocktake working | OMO, ECC | HIGH | T-07 |
| OOP/design principles in standards | ECC | MEDIUM | T-08 |
| Java/C# language patterns | ECC | MEDIUM | T-09 |
| Namespaced commands | OMO, GSD | MEDIUM | T-05 |
| Fallback test mode | Nobody | HIGH (unique) | D-01 |
| Anti-slop comment hook | OMO | MEDIUM | D-06 |
| Agents.md improvement tooling | ECC | MEDIUM | T-10 |

### Parity verdict

After v1.7.0, we have **parity or better** on skills, memory, observability, and adaptive loading. The v4.0 gaps are concentrated in three areas:

1. **Agent presentation** (visibility, Tab cycling, stocktake detection) -- bugs and configuration, not missing features
2. **Coding standards depth** (design principles, more languages) -- content expansion
3. **Production hardening** (fallback testing, QA playbook, namespace cleanup) -- quality improvements

This is a "polish and expand" milestone, not a "catch up" milestone.

---

## Sources

- Phase 11 deep-dives: GSD (01), superpowers (02), OMO (03), ECC (04), claude-mem (05) -- all at `.planning/phases/11-ecosystem-research/research/`
- Phase 11 gap matrix: `.planning/phases/11-ecosystem-research/11-GAP-MATRIX.md` (73 gaps, 10 coverage areas)
- Phase 11 phase scopes: `.planning/phases/11-ecosystem-research/11-PHASE-SCOPES.md` (56 planned features)
- Phase 11 agent verdict: `.planning/phases/11-ecosystem-research/11-AGENT-VERDICT.md` (skills > agents)
- Current codebase: `assets/skills/` (15 dirs), `assets/commands/` (11 files), `src/tools/` (20 files)
- Confidence: HIGH -- exhaustive competitor inventories cross-referenced with current codebase audit
