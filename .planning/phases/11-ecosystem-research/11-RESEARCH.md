# Phase 11: Ecosystem Research & Gap Analysis - Research

**Researched:** 2026-04-02
**Domain:** Competitive plugin ecosystem analysis (OpenCode / Claude Code)
**Confidence:** HIGH

## Summary

This phase is a RESEARCH-ONLY deliverable producing a gap matrix and competitive analysis report. No code is written. The output defines the exact implementation scope of Phases 12-17 in the v3.0 Intelligence & Polish milestone.

Five competitor plugins have been deeply analyzed: get-shit-done (GSD), superpowers, oh-my-openagent (OMO), everything-claude-code (ECC), and claude-mem. Additionally, the broader ecosystem (50+ plugins from awesome-opencode, awesome-claude-code registries) was surveyed to surface patterns and opportunities beyond direct competitors.

The research reveals significant gaps in four areas: (1) skills breadth -- we have 1 skill vs. ECC's 151+ and superpowers' 14+; (2) memory persistence -- we have session-scoped review/lesson memory but no cross-session memory system; (3) hook-driven automation -- we have 4 hooks but no pre-tool formatting, post-edit linting, or session lifecycle automation; (4) developer experience tooling -- no diagnostics, token tracking, or session analysis. The gap matrix in the plan will need to prioritize ruthlessly -- not every competitor feature is worth building.

**Primary recommendation:** Structure the research execution as five parallel competitor deep-dives followed by a synthesis phase that produces the gap matrix, with the matrix organized by coverage area (skills, commands, hooks, agents, memory, workflows, observability, testing) and each gap rated by priority and phase assignment.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: New milestone: v3.0 Intelligence & Polish -- plugin goes from feature-complete to best-in-class
- D-02: Quality bar is production-ready and best-in-class -- no shortcuts, no rough edges, no "good enough"
- D-03: Research can propose new phases beyond the initial 11-17 structure if significant gaps are discovered
- D-04: Phase 11 findings directly define the implementation scope of Phases 14 (Skills & Commands), 15 (Memory System), and 16 (Specialized Agents)
- D-05: Five plugins to research in depth: GSD, superpowers, oh-my-openagent, ECC, claude-mem
- D-06: Gap matrix -- feature-by-feature comparison showing what each plugin has vs. what we have, with priority recommendations
- D-07: Matrix should cover: skills, commands, hooks, agents, memory, workflows, observability, testing tools
- D-08: Each gap should have a priority rating (CRITICAL/HIGH/MEDIUM/LOW) and a recommendation for which phase should address it
- D-09: Skills gap -- identify missing skills, especially brainstorming-style creative tools
- D-10: Commands gap -- PR comment review, update-docs, validate-agents-md, and whatever else research surfaces
- D-11: Competitive flows & hooks -- what automation patterns do competitors offer that we don't
- D-12: Specialized agents -- critical assessment of MasterDebugger, Reviewer, and any other agent archetypes. Research decides whether to build them
- D-13: Memory patterns -- how do competitors handle memory? What works, what's token-wasteful?

### Claude's Discretion
- Research methodology and tool selection (web search, GitHub code search, plugin source reading)
- How to structure the gap matrix columns and scoring
- Which additional plugins to glance at beyond the five listed (if any seem relevant during research)
- Depth of analysis per competitor -- deeper for more relevant plugins

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Runtime:** Bun only -- plugins run inside the OpenCode process
- **No standalone Zod:** Use transitive dep from `@opencode-ai/plugin`
- **No Bun.file()/Bun.write():** Use `node:fs/promises`
- **Model agnostic:** Never hardcode model identifiers
- **Global target:** Assets write to `~/.config/opencode/`
- **oc_ prefix:** All tool names start with `oc_`
- **Immutability:** Build objects declaratively, never mutate
- **Atomic writes:** `wx` flag for creation, `COPYFILE_EXCL` for installer

These constraints are relevant for the gap matrix because any recommended feature must be implementable within these boundaries. For example, memory systems that require external databases (Chroma, SQLite with native bindings) must be evaluated against the Bun-only runtime constraint.

## What We Currently Have (Inventory)

Understanding our current capabilities is essential before identifying gaps. This inventory was compiled from the actual source code.

### Registered Tools (11)
| Tool | Purpose |
|------|---------|
| `oc_configure` | Interactive model assignment wizard |
| `oc_create_agent` | Scaffold new agent markdown files |
| `oc_create_skill` | Scaffold new skill directories |
| `oc_create_command` | Scaffold new command files |
| `oc_state` | Pipeline state management |
| `oc_confidence` | Confidence ledger tracking |
| `oc_phase` | Phase transition management |
| `oc_plan` | Plan indexing and wave grouping |
| `oc_orchestrate` | Full 8-phase autonomous SDLC pipeline |
| `oc_forensics` | Failed run diagnostics |
| `oc_review` | Multi-agent code review engine |

### Registered Hooks (4)
| Hook | Purpose |
|------|---------|
| `config` | Agent injection (14 agents), opencode config capture |
| `event` | First-load toast, fallback event handling |
| `chat.message` | Model override for fallback |
| `tool.execute.after` | Fallback tool-level interception |

### Agents (14 via config hook)
**Primary agents (5):** autopilot, researcher, documenter, metaprompter, pr-reviewer
**Pipeline agents (9, hidden):** oc-researcher, oc-challenger, oc-architect, oc-critic, oc-explorer, oc-planner, oc-implementer, oc-shipper, oc-retrospector, oc-reviewer

### Review Agents (22 specialist implementations)
auth-flow-verifier, code-quality-auditor, concurrency-checker, contract-verifier, database-auditor, dead-code-scanner, go-idioms-auditor, logic-auditor, product-thinker, python-django-auditor, react-patterns-auditor, red-team, rust-safety-auditor, scope-intent-verifier, security-auditor, silent-failure-hunter, spec-checker, state-mgmt-auditor, test-interrogator, type-soundness, wiring-inspector

### Commands (5 bundled)
`/new-agent`, `/new-skill`, `/new-command`, `/oc-configure`, `/review-pr`

### Skills (1 bundled)
`coding-standards` -- style, patterns, naming conventions

### Memory Systems
- Review memory (per-project findings, false positives, project profile)
- Lesson memory (institutional memory with domain categorization, decay)
- Confidence ledger (per-decision tracking)
- Decision log (timestamped autonomous decisions)

### Infrastructure
- Model fallback system (error classification, state machine, 3-tier replay, chain resolution)
- Self-healing asset installer (never overwrites user files)
- Config v3 with auto-migration from v1/v2
- CI pipeline (lint, type-check, test with 90% coverage)

## Competitor Analysis: Deep Findings

### 1. get-shit-done (GSD)

**Source:** [github.com/gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done)
**Confidence:** HIGH (README + docs examined)
**Relevance to us:** MEDIUM -- GSD is a workflow orchestration system, not a plugin with tools/hooks. Different problem domain but useful patterns.

**Architecture:** GSD v2 is a standalone TypeScript CLI built on the Pi SDK -- it controls the agent session directly, not through plugin hooks. It clears context between tasks, injects files at dispatch time, manages git branches, tracks cost/tokens, detects stuck loops, recovers from crashes, and auto-advances through milestones.

**Key Capabilities:**
| Feature | Details |
|---------|---------|
| Project lifecycle | `/gsd:new-project`, `/gsd:discuss-phase`, `/gsd:plan-phase`, `/gsd:execute-phase`, `/gsd:verify-work`, `/gsd:ship` |
| State management | PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, CONTEXT.md, RESEARCH.md, PLAN.md -- persistent structured files |
| Wave-based execution | Plans organized into dependency-aware parallel waves, each plan gets fresh 200k context |
| Multi-agent orchestration | Thin orchestrator spawning 4 parallel researchers, planner+checker loop, parallel executors |
| Quality gates | Schema drift detection, security enforcement, scope reduction detection, plan-checker loops |
| Quick tasks | `/gsd:quick` for ad-hoc work outside the phase system |
| Context preservation | Main session at 30-40% utilization, subagents handle heavy lifting |
| XML prompt format | Structured `<task>` XML for precise agent instructions |
| Seeds and threads | Forward-looking ideas surfaced at milestones, persistent cross-session context |

**What we can learn:**
- Context window health management (keeping main session lean)
- The "seeds" concept -- capturing forward-looking ideas during work for later milestones
- Quick task path alongside the main pipeline
- Wave-based parallel execution with fresh contexts per plan

**Gap relevance:** LOW -- GSD solves a different problem (project management workflow). Our orchestrator already covers the pipeline concept. The context management and seed patterns are informative but not directly implementable as plugin features.

### 2. superpowers

**Source:** [github.com/obra/superpowers](https://github.com/obra/superpowers)
**Confidence:** HIGH (README + docs + skill analysis)
**Relevance to us:** HIGH -- directly comparable skills framework with patterns we lack

**Architecture:** A skills-only framework (no tools, no hooks in the OpenCode sense). Skills are markdown files that teach Claude structured methodologies. 107k+ GitHub stars, massively adopted.

**Key Skills (14 total):**
| Skill | What It Does |
|-------|-------------|
| `brainstorming` | Socratic design refinement through questions, explores alternatives, presents design in sections |
| `test-driven-development` | Strict RED-GREEN-REFACTOR with anti-pattern references |
| `systematic-debugging` | Four-phase root cause analysis with tracing and defense-in-depth |
| `writing-plans` | Creates bite-sized tasks (2-5 min each) with exact file paths |
| `executing-plans` | Batch execution with human checkpoints |
| `dispatching-parallel-agents` | Concurrent subagent workflows |
| `requesting-code-review` | Pre-review checklist validation |
| `receiving-code-review` | Feedback integration process |
| `using-git-worktrees` | Creates isolated workspace on new branch, runs setup, verifies test baseline |
| `finishing-a-development-branch` | Merge/PR decision workflow |
| `subagent-driven-development` | Two-stage review (spec compliance, then code quality) |
| `verification-before-completion` | Confirms fixes before declaring success |
| `writing-skills` | Meta-skill for creating new skills |
| `using-superpowers` | System introduction |

**What we can learn:**
- **Brainstorming as a skill** is the single most impactful gap. It teaches Claude to ask questions and explore alternatives before coding. We have nothing like this.
- **TDD as a structured skill** with anti-pattern references -- more prescriptive than a generic "write tests first" instruction
- **Git worktrees skill** -- isolated development environments with clean test baselines
- **Plan writing/executing** as explicit skills with specific constraints (2-5 min tasks, exact file paths)
- **Verification-before-completion** -- a simple but powerful "did you actually check it works" gate

**Gap relevance:** CRITICAL -- brainstorming, TDD, debugging, and git worktrees are high-value skills we completely lack. These are the most adopted skill patterns in the ecosystem.

### 3. oh-my-openagent (OMO)

**Source:** [github.com/code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)
**Confidence:** HIGH (README + features.md + docs examined)
**Relevance to us:** MEDIUM -- overlaps on agent orchestration, has some unique tools we lack

**Architecture:** An OpenCode plugin (formerly oh-my-opencode) with 11 agents, 25+ hooks, 26 tools, skills, commands, and MCP integrations. Heavily model-specific (assigns specific models per agent category). Previously had prompt injection concerns in installation docs.

**Key Capabilities:**
| Feature | Details |
|---------|---------|
| 11 agents | Sisyphus (orchestrator), Hephaestus (deep worker), Prometheus (strategic planner), Oracle (architecture), Librarian (docs), Explore (search), Multimodal-Looker (vision), Metis (pre-planning), Momus (plan reviewer), Atlas (todo orchestrator), Sisyphus-Junior (executor) |
| Category system | visual-engineering, ultrabrain, deep, artistry, quick, writing -- auto-maps tasks to optimal models |
| LSP tools | `lsp_rename`, `lsp_goto_definition`, `lsp_find_references`, `lsp_diagnostics` |
| AST-grep | Pattern-aware code search across 25 languages |
| Tmux integration | Interactive terminal, REPLs, debuggers |
| Built-in MCPs | Exa (search), Context7 (docs), grep.app (GitHub search) |
| Todo enforcer | Yanks idle agents back on track |
| Comment checker | Prevents "AI slop" in code comments |
| IntentGate | Analyzes true user intent before task classification |
| Hash-anchored edits | `LINE#ID` content validation prevents stale-line errors |
| Session recovery | Missing tool results, thinking block violations, empty history, context limit |
| Doctor command | Built-in diagnostics for plugin health |
| Background agents | Parallel execution with configurable concurrency limits |

**What we can learn:**
- **Doctor/diagnostics command** -- a `/doctor` or `/health` command that verifies plugin registration, config, models, and environment
- **IntentGate** -- analyzing user intent before classification is a strong UX pattern
- **Comment checker** -- preventing AI-generated comment bloat
- **Session recovery mechanisms** -- handling various failure modes gracefully
- **Background agent execution** with concurrency limits
- **LSP/AST tools** are powerful but may be out of scope (requires deep OpenCode integration)

**Gap relevance:** MEDIUM -- the doctor command and comment checker are quick wins. Agent orchestration overlaps with our existing autopilot. Model-specific assignments conflict with our model-agnostic constraint.

**Security note:** OMO has documented prompt injection concerns. Our research report should note this as a cautionary pattern to avoid.

### 4. everything-claude-code (ECC)

**Source:** [github.com/affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code)
**Confidence:** HIGH (README deeply analyzed)
**Relevance to us:** HIGH -- largest skill library, instinct/learning system, comprehensive hook coverage

**Architecture:** Four-layer system: Agents (36), Skills (151+), Rules (language-organized), Hooks (script-based). Cross-platform (Claude Code, OpenCode, Cursor, Codex, Gemini). 50k+ stars. Won Anthropic Hackathon.

**Key Capabilities by Layer:**

**Agents (36 total):**
- Planning: planner, architect, chief-of-staff
- Code quality: code-reviewer, security-reviewer, refactor-cleaner + 7 language-specific reviewers
- Testing: tdd-guide, e2e-runner, loop-operator
- Build: build-error-resolver + 6 language-specific resolvers
- Docs: doc-updater, docs-lookup
- Meta: harness-optimizer

**Skills (151+ across 12 language ecosystems):**
- Framework-specific: backend-patterns, frontend-patterns, golang-patterns, django-patterns, springboot-patterns, laravel-patterns, python-patterns, cpp-coding-standards, perl-patterns, postgres-patterns, jpa-patterns
- Infrastructure: docker-patterns, database-migrations, deployment-patterns, api-design
- Workflows: tdd-workflow, continuous-learning, continuous-learning-v2, iterative-retrieval, autonomous-loops, verification-loop, eval-harness, strategic-compact, e2e-testing
- Business/content: article-writing, content-engine, market-research, investor-materials, frontend-slides
- Security: security-review, security-scan (AgentShield integration)
- Specialized: liquid-glass-design, foundation-models-on-device, swift-actor-persistence, cost-aware-llm-pipeline, regex-vs-llm-structured-text, search-first, skill-stocktake, plankton-code-quality

**Instincts/Continuous Learning:**
- `/learn` -- extract patterns mid-session
- `/learn-eval` -- quality-gated: extract, evaluate, score confidence, persist only high-signal
- `/instinct-status` -- view accumulated instincts
- `/instinct-import`/`-export` -- portability across machines
- `/evolve` -- cluster related instincts into full skills
- `/prune` -- clean up expired patterns
- Confidence scoring prevents noise accumulation

**Hooks:**
- SessionStart -- load prior context
- SessionEnd -- save state
- pre-compact -- save verification state before compaction
- suggest-compact -- strategic compaction recommendations
- evaluate-session -- extract patterns from sessions
- Hook profiles: minimal, standard, strict
- Script-based hooks (Node.js) replacing fragile inline one-liners

**Legacy Commands (68 shims transitioning to skills):**
`/tdd`, `/plan`, `/e2e`, `/code-review`, `/build-fix`, `/refactor-clean`, `/learn`, `/learn-eval`, `/checkpoint`, `/verify`, `/setup-pm`, `/orchestrate`, `/sessions`, `/eval`, `/test-coverage`, `/update-docs`, `/update-codemaps`, language-specific review/test/build commands, instinct management, multi-execution commands

**What we can learn:**
- **Instinct system** is the most innovative learning mechanism in the ecosystem. Pattern extraction with confidence scoring, evolution into skills, and pruning prevents unbounded growth.
- **Language-specific skill stacks** -- not just one "coding-standards" but framework+testing+security per language
- **Strategic compaction hooks** -- knowing WHEN to compact and preserving critical state before compaction
- **Skill categories as a taxonomy** -- organizing skills by workflow (TDD, debugging), domain (frontend, backend), and language (Go, Python, TypeScript)
- **Hook profiles** (minimal/standard/strict) -- letting users choose automation intensity
- **/update-docs** and **/update-codemaps** -- keeping documentation in sync with code changes
- **/skill-stocktake** -- audit what skills and commands are installed and active

**Gap relevance:** CRITICAL -- the instinct/learning system, language-specific skill stacks, hook profiles, and documentation sync commands represent significant differentiators we lack.

### 5. claude-mem

**Source:** [github.com/thedotmack/claude-mem](https://github.com/thedotmack/claude-mem)
**Confidence:** HIGH (README + changelog analyzed)
**Relevance to us:** HIGH -- directly informs Phase 15 (Memory System) architecture

**Architecture:** Plugin + MCP server. Captures session activity via 6 lifecycle hooks, compresses with AI summarization, stores in SQLite + Chroma vector DB, injects via 3-layer progressive disclosure. v10.6.3 (current), 38k+ stars.

**Key Capabilities:**
| Feature | Details |
|---------|---------|
| 6 lifecycle hooks | SessionStart, UserPromptSubmit, PostToolUse, Stop, SessionEnd, Smart Install |
| AI compression | Generates semantic summaries rather than storing raw transcripts |
| 3-layer retrieval | Search (~50-100 tokens) -> Timeline -> Details (~500-1000 tokens) -- 10x token savings |
| 4 MCP tools | search, timeline, get_observations, mem-search skill |
| Storage | SQLite (sessions, observations, FTS5 indexes) + Chroma (vector embeddings) |
| Context injection | v10.6.0+ uses `before_prompt_build` hook for system prompt injection |
| Smart Explore | AST-powered code navigation, 6-12x lower token cost than full file reads |
| Study modes | Specialized observation types (e.g., law-study with case holdings, doctrine synthesis) |
| Timeline reports | `/timeline-report` generates narrative project journey docs |
| Endless mode | Biomimetic memory allowing ~1000 tool uses vs ~50 (20x increase) |

**Memory Architecture Patterns:**

1. **Progressive disclosure** (3-layer): Most token-efficient approach in the ecosystem. Only fetch full details for items you actually need.
2. **AI summarization**: Compress observations into semantic summaries. Reduces storage and retrieval costs.
3. **Hybrid search**: SQLite FTS5 (keyword) + Chroma (semantic/vector). Covers both exact matches and conceptual queries.
4. **System prompt injection**: Inject curated memories into agent system prompts. More reliable than file-based approaches.
5. **Observation-based capture**: Not raw chat history but structured observations with types, timestamps, and project context.

**What we can learn:**
- **Progressive disclosure** is the gold standard for token-efficient memory. Our Phase 15 MUST adopt this pattern.
- **Observation-based capture** rather than raw transcript storage -- capture what matters, not everything.
- **System prompt injection** is more reliable than file-based memory (CLAUDE.md generation).
- **Decay and relevance scoring** prevent memory bloat. claude-mem lacks strong decay; ECC's instinct system has better pruning.
- **Domain-specific observation types** (study mode) show memory can be specialized per use case.

**Gap relevance:** CRITICAL -- we have no cross-session memory. claude-mem provides the reference architecture for Phase 15, though we should improve on its weaknesses (better decay, simpler storage without requiring Chroma).

## Broader Ecosystem Patterns

Beyond the five primary competitors, the broader ecosystem (50+ plugins from awesome-opencode, awesome-claude-code) reveals recurring themes:

### Token Optimization (recurring theme)
- **opencode-snip**: Reduces token consumption 60-90% via snippet extraction
- **Dynamic Context Pruning**: Prunes obsolete tool outputs from conversation context
- **opencode-tokenscope**: Comprehensive token usage analysis and cost tracking
- **Context Analysis Plugin**: Token distribution analysis across message types

### Safety & Guardrails (emerging category)
- **CC Safety Net**: Catches destructive git/filesystem commands before execution
- **Envsitter Guard**: Prevents .env file leaks to context
- **TDD Guard**: Blocks code written before tests exist
- **agnix**: Linter for CLAUDE.md, AGENTS.md, SKILL.md files with auto-fixes

### Observability (growing demand)
- **claude-devtools**: Desktop app with subagent execution trees and notification triggers
- **OpenCode Monitor**: Real-time usage analytics and token tracking
- **Vibe-Log**: Session analyzer producing HTML reports with strategic guidance
- **opencode-plugin-otel**: OpenTelemetry metrics/traces/logs integration

### Interactive Planning (novel category)
- **open-plan-annotator**: Opens browser UI to annotate LLM plans like a Google Doc
- **OpenSpec**: Architecture planning agent with structured output

### Session Management
- **Opencode Sessions**: Session management tools
- **Handoff**: Session handoff prompts for continuity
- **Opencode Synced**: Config syncing across machines

## Gap Matrix Structure Recommendation

Based on research, the gap matrix should use this structure:

### Coverage Areas (columns)
1. **Skills** -- Workflow skills (brainstorming, TDD, debugging, planning) + domain skills (language-specific patterns)
2. **Commands** -- Slash commands for common operations
3. **Hooks** -- Lifecycle automation (pre-tool, post-edit, session start/end, compaction)
4. **Agents** -- Primary agents (user-facing) + specialized agents (domain-specific)
5. **Memory** -- Cross-session persistence, retrieval, injection, decay
6. **Workflows** -- Automation patterns, autonomous loops, parallel execution
7. **Observability** -- Logging, token tracking, session analysis, diagnostics
8. **Testing** -- TDD enforcement, test coverage, verification patterns
9. **Safety** -- Guardrails, destructive command prevention, secret protection
10. **Developer Experience** -- Diagnostics, health checks, skill management, documentation sync

### Priority Criteria
- **CRITICAL**: Feature is table-stakes for "best-in-class" claim and multiple competitors have it
- **HIGH**: Feature provides clear user value and at least one competitor has proven demand
- **MEDIUM**: Feature would differentiate but isn't blocking -- nice to have for v3.0
- **LOW**: Feature exists in ecosystem but doesn't align with our value proposition

### Phase Assignment Logic
- Phase 12 (Quick Wins): Can be done in <1 plan, no architecture needed
- Phase 13 (Observability): Logging, events, session tracking, diagnostics
- Phase 14 (Skills & Commands): New skills, new commands, skill infrastructure
- Phase 15 (Memory): Cross-session persistence, retrieval, injection
- Phase 16 (Specialized Agents): New primary agents validated by research
- Phase 17 (Integration & Polish): Cross-feature integration, hooks, final polish
- Phase 18+ (NEW): If gaps warrant new phases (per D-03)

## Research Methodology Recommendations

### For Each Competitor Plugin

1. **GitHub source examination** (PRIMARY): Read the repository README, directory structure, plugin entry point, and key implementation files. This is the most reliable source.
2. **Web search for community feedback**: Blog posts, tutorials, HN/Reddit discussions, GitHub issues -- reveals real-world usage patterns and pain points.
3. **Feature extraction**: Catalog every skill, command, hook, agent, and tool by reading the actual source files.
4. **Architecture analysis**: Understand how features are implemented -- this informs whether we can replicate within our constraints (Bun-only, model-agnostic, global target).
5. **Quality assessment**: Not all competitor features are good. Some are bloat, token-wasteful, or security risks. The research should critically evaluate each feature.

### Source Priority for the Research Phase

| Source | Trust Level | Use For |
|--------|-------------|---------|
| GitHub source code | HIGH | Feature catalog, architecture patterns, implementation details |
| GitHub README/docs | HIGH | Capabilities overview, installation, configuration |
| Plugin registries (awesome-opencode, claudepluginhub) | MEDIUM | Discovery, ecosystem coverage |
| Blog posts/tutorials | MEDIUM | Community adoption, real-world feedback |
| Star counts/fork counts | LOW | Popularity signal only, not quality indicator |

### Data Collection Template Per Competitor

For each of the 5 competitors, collect:

```
## [Plugin Name]

### Metadata
- GitHub URL, stars, last commit date
- Installation method (plugin marketplace, npm, manual)
- Compatible runtimes (OpenCode, Claude Code, etc.)

### Feature Inventory
#### Skills (name, category, description)
#### Commands (name, what it does)
#### Hooks (event type, what it automates)
#### Agents (name, role, model assignment)
#### Tools (name, purpose)
#### Memory (storage mechanism, retrieval pattern, token cost)

### Architecture Patterns
- How are features organized?
- What dependencies are required?
- What constraints exist?

### Strengths
- What does this plugin do better than anyone else?

### Weaknesses / Concerns
- What's bloated, token-wasteful, or poorly designed?
- Security concerns?
- Compatibility issues?

### Relevance to Us
- Which features should we adopt?
- Which should we skip?
- What can we do BETTER?
```

## Preliminary Gap Analysis (Key Findings)

The following gaps emerged from research as the highest-impact items. The formal gap matrix in the plan output will be comprehensive; this section highlights the most significant findings.

### CRITICAL Gaps

| Gap | What Competitors Have | What We Have | Recommendation |
|-----|----------------------|-------------|----------------|
| Brainstorming skill | Superpowers: Socratic design refinement; ECC: brainstorming workflows | Nothing | Phase 14 -- single most impactful skill to add |
| TDD skill | Superpowers: strict RED-GREEN-REFACTOR; ECC: tdd-workflow; TDD Guard: enforcement | Nothing | Phase 14 -- high adoption proves demand |
| Cross-session memory | claude-mem: 3-layer progressive disclosure; ECC: instinct persistence; OMO: session recovery | Session-scoped only (review/lesson memory) | Phase 15 -- foundational capability for "gets better over time" |
| Debugging skill | Superpowers: 4-phase systematic debugging; ECC: build-error-resolver variants | Nothing | Phase 14 -- every developer needs this |

### HIGH Gaps

| Gap | What Competitors Have | What We Have | Recommendation |
|-----|----------------------|-------------|----------------|
| Session lifecycle hooks | ECC: SessionStart/End, pre-compact, suggest-compact, evaluate-session | First-load toast only | Phase 17 -- hook automation for formatting, linting, state management |
| Token/cost tracking | TokenScope, OpenCode Monitor, Context Analysis | Nothing | Phase 13 -- essential for observability |
| Doctor/diagnostics | OMO: `/doctor` command; agnix: AGENTS.md linting | Nothing | Phase 12 -- quick win, high UX value |
| Git worktrees skill | Superpowers: isolated workspace with clean test baseline | Nothing | Phase 14 -- enables parallel development |
| Language-specific skills | ECC: 12 language ecosystems with per-language patterns/testing/security | 1 generic coding-standards | Phase 14 -- but curate, don't bloat |
| Documentation sync | ECC: `/update-docs`, `/update-codemaps` | Nothing | Phase 14 -- keeps docs in sync with code |
| Plan writing/executing | Superpowers: bite-sized tasks, human checkpoints; GSD: XML-structured plans | Orchestrator plans (internal) | Phase 14 -- expose planning as user-facing skill |
| Verification-before-completion | Superpowers: explicit "did you check it works" gate | Review engine (post-hoc) | Phase 14 -- lightweight pre-completion check |

### MEDIUM Gaps

| Gap | What Competitors Have | What We Have | Recommendation |
|-----|----------------------|-------------|----------------|
| Instinct/learning system | ECC: extract, evaluate, evolve, prune with confidence scoring | Lesson memory (simpler) | Phase 15 -- enhance lesson memory with instinct patterns |
| Comment quality checker | OMO: prevents "AI slop" in comments | Nothing | Phase 17 -- hook-based, quick implementation |
| Skill stocktake/audit | ECC: `/skill-stocktake` audits installed skills | Nothing | Phase 14 -- useful meta-command |
| Code review as skill | Superpowers: requesting + receiving code review skills | Review engine (tool, not skill) | Phase 14 -- complement tool with skill guidance |
| Safety guardrails | CC Safety Net, Envsitter Guard | Nothing beyond atomic writes | Phase 17 -- destructive command prevention |
| Session analysis/reporting | Vibe-Log, claude-devtools | Nothing | Phase 13 -- session summaries and reports |

### LOW Gaps (Skip or Defer)

| Gap | What Competitors Have | Why Skip |
|-----|----------------------|----------|
| 36+ agents | ECC: language-specific reviewers for 7 languages | We already have 22 review specialists; diminishing returns |
| 68 legacy commands | ECC: command shims | Transitioning to skills is the correct direction |
| LSP/AST tools | OMO: lsp_rename, lsp_goto_definition | Deep OpenCode integration, out of our plugin scope |
| Tmux integration | OMO: interactive terminals, agent panes | Infrastructure feature, not plugin responsibility |
| Model-specific assignments | OMO: category-to-model mapping | Conflicts with our model-agnostic constraint |
| Business skills | ECC: investor-materials, market-research, content-engine | Outside our developer tool value proposition |
| 340+ plugin marketplace | claude-code-plugins-plus-skills | Quantity over quality; we should curate |
| Autonomous loops | ECC: sequential pipelines, PR loops, DAG orchestration | Our orchestrator already handles this |

## Specialized Agents Assessment (D-12)

Per D-12, research must critically assess agent archetypes and determine whether to build them.

### MasterDebugger Agent

**Evidence from ecosystem:**
- Superpowers: `systematic-debugging` is a **skill** (not an agent) -- 4-phase root cause analysis
- ECC: `build-error-resolver` + 6 language-specific variants are **agents**
- OMO: `Oracle` agent handles architecture/debugging

**Assessment:** A debugging agent has moderate value. The superpowers approach (skill, not agent) is more efficient -- it teaches Claude HOW to debug rather than delegating to a specialized subagent. Our forensics tool already handles failed-run diagnosis. A **debugging skill** (not agent) is the correct implementation.

**Recommendation:** Implement as Phase 14 SKILL, not Phase 16 agent. A skill is lower cost, composes with any agent, and matches the superpowers pattern that has 107k stars of validation.

### Reviewer Agent (Primary Mode)

**Evidence from ecosystem:**
- We already have `oc_review` tool with 22 specialist agents
- Superpowers: code review is split into two SKILLS (requesting + receiving)
- ECC: `code-reviewer` is an agent, but also has review as a workflow skill

**Assessment:** We already have the most sophisticated review engine in the ecosystem (22 specialists, cross-verification, red team, fix cycle). Adding a primary "Reviewer" agent would duplicate existing capability. What we lack is the **skill guidance** around how to request and receive reviews.

**Recommendation:** Add code review skills (Phase 14) to complement the existing review tool. Do NOT add a new Reviewer primary agent -- the `oc_review` tool already exceeds competitor capabilities.

### Other Agent Archetypes

| Candidate | Verdict | Reasoning |
|-----------|---------|-----------|
| Planner agent | SKILL instead | Superpowers proves planning works as a skill; our orchestrator handles pipeline planning |
| TDD guide agent | SKILL instead | Superpowers and ECC both show TDD as skills; skills compose better |
| Doc updater agent | COMMAND instead | ECC's `/update-docs` is a command, not an agent; simpler implementation |
| Harness optimizer | SKIP | Too meta; our plugin doesn't need self-optimization |

**Phase 16 verdict:** Based on research, Phase 16 should be SCOPED DOWN or MERGED into Phase 14. Most "specialized agent" needs are better served as skills or commands. If Phase 16 remains, it should focus on a single high-value primary agent validated by user demand, not speculative archetypes.

## Memory System Architecture Patterns (D-13)

### Pattern Comparison

| Pattern | Used By | Token Cost | Complexity | Our Fit |
|---------|---------|------------|------------|---------|
| Progressive disclosure (3-layer) | claude-mem | LOW (50-1000 tokens per query) | MEDIUM | Best fit -- token efficient, proven |
| Instinct extraction with confidence | ECC | MEDIUM (extraction cost per session) | HIGH | Interesting for lesson enhancement |
| System prompt injection | claude-mem v10.6+ | LOW (one-time per session) | LOW | Best injection method |
| Raw transcript storage | Some smaller plugins | HIGH (full context) | LOW | Avoid -- token wasteful |
| Knowledge graph | claude-code-buddy | MEDIUM | HIGH | Over-engineered for our needs |
| Vector embeddings (Chroma) | claude-mem | LOW retrieval, HIGH indexing | HIGH (external dep) | Risk -- Chroma dependency in Bun runtime |

### Recommended Architecture for Phase 15

1. **Storage:** SQLite via `better-sqlite3` (Bun-compatible, no native Chroma dependency). FTS5 for keyword search. Optional vector search if a pure-JS embedding solution exists.
2. **Capture:** Observation-based (not raw transcripts). Structured types: decisions, patterns, errors, preferences.
3. **Retrieval:** 3-layer progressive disclosure (search -> timeline -> details). Token budget cap per injection.
4. **Injection:** System prompt injection via config hook (we already have this pattern).
5. **Decay:** Time-weighted relevance with configurable retention. Inspired by our existing lesson memory decay.
6. **Scopes:** Project-level (patterns, conventions) + user-level (preferences, workflow style) per Phase 15 requirements.

### What to Avoid
- **Chroma/vector DB dependency**: Adds complexity and a native dependency that may not work in Bun. Start with SQLite FTS5 (keyword search) which is proven and lightweight.
- **Raw transcript storage**: Token-wasteful. Always summarize/extract observations.
- **Unbounded growth**: Every memory system that lacks decay eventually becomes a context bomb.
- **File-based memory** (CLAUDE.md generation): Less reliable than system prompt injection. claude-mem moved away from this in v10.6.0.

## Hooks & Automation Patterns (D-11)

### OpenCode Plugin Hook Surface

Based on the official OpenCode plugin API, available hooks include:

| Hook Type | Events |
|-----------|--------|
| Command | `command.executed` |
| File | `file.edited`, `file.watcher.updated` |
| Message | `message.part.removed/updated`, `message.removed/updated` |
| Permission | `permission.asked`, `permission.replied` |
| Session | `session.created`, `session.compacted`, `session.deleted`, `session.diff`, `session.error`, `session.idle`, `session.status`, `session.updated` |
| Tool | `tool.execute.before`, `tool.execute.after` |
| TUI | `tui.prompt.append`, `tui.command.execute`, `tui.toast.show` |
| Experimental | `experimental.session.compacting` |
| Config | `config` |
| Chat | `chat.message` |

### Hook Patterns Competitors Use That We Don't

| Pattern | Competitor | Hook Type | Value |
|---------|-----------|-----------|-------|
| Auto-format after file edit | ECC PostToolUse | `file.edited` / `tool.execute.after` | HIGH -- prevents formatting drift |
| Session start context loading | ECC, claude-mem | `session.created` | HIGH -- memory injection |
| Session end state saving | ECC, claude-mem | Session lifecycle | HIGH -- memory capture |
| Pre-compaction state save | ECC | `experimental.session.compacting` | MEDIUM -- preserve critical state |
| Strategic compaction suggestion | ECC | Session monitoring | MEDIUM -- help users manage context |
| Pattern extraction on session end | ECC evaluate-session | Session lifecycle | MEDIUM -- learning system |
| Destructive command prevention | CC Safety Net | `tool.execute.before` | HIGH -- safety guardrail |

### Recommended Hook Additions

**Phase 13 (Observability):**
- `session.created` -- log session start, inject prior context
- `session.error` -- structured error capture
- `session.compacted` -- log compaction event
- `tool.execute.after` -- capture tool usage metrics

**Phase 15 (Memory):**
- `session.created` -- inject relevant memories
- Session lifecycle -- capture observations for memory

**Phase 17 (Integration):**
- `file.edited` -- auto-format trigger
- `tool.execute.before` -- destructive command prevention
- `experimental.session.compacting` -- pre-compaction state save

## Common Pitfalls

### Pitfall 1: Feature Bloat
**What goes wrong:** Trying to match ECC's 151+ skills or OMO's 26 tools leads to a bloated, unfocused plugin.
**Why it happens:** Gap matrix shows many gaps; temptation to fill them all.
**How to avoid:** Apply strict priority filtering. Only CRITICAL and HIGH gaps get implemented. The plugin's value is curation, not volume.
**Warning signs:** Plans with more than 20 new skills, or skills for domains outside development.

### Pitfall 2: Token-Wasteful Memory
**What goes wrong:** Memory system stores too much, injects too much, and burns context window.
**Why it happens:** "More memory = better" assumption.
**How to avoid:** Progressive disclosure (3-layer), token budgets per injection, aggressive decay.
**Warning signs:** Memory injection exceeding 2000 tokens per session, unbounded storage growth.

### Pitfall 3: Incompatible Dependencies
**What goes wrong:** Recommending features that require Chroma, native SQLite bindings, or external services that don't work in Bun.
**Why it happens:** Copying competitor architectures without checking runtime compatibility.
**How to avoid:** Every recommended feature must be validated against the Bun-only constraint. Use `bun:sqlite` (Bun's built-in SQLite) instead of external packages.
**Warning signs:** Adding native node addons, external databases, or services to dependencies.

### Pitfall 4: Scope Explosion via "Creative" Gaps
**What goes wrong:** D-03 allows proposing new phases. Research surfaces 50 potential features. All get planned.
**Why it happens:** "Best-in-class" goal combined with thorough competitor analysis.
**How to avoid:** New phases only if a CRITICAL gap doesn't fit existing phases. Cap total v3.0 phases.
**Warning signs:** More than 2 new phases proposed, or phases with vague scope.

### Pitfall 5: Model-Specific Recommendations
**What goes wrong:** Recommending features that work only with specific models (e.g., OMO's category-to-model mapping).
**Why it happens:** Competitors are model-specific; their patterns don't translate.
**How to avoid:** Every recommendation must pass the model-agnostic constraint from CLAUDE.md.
**Warning signs:** Features that reference specific model names, thinking budgets, or model capabilities.

## Architecture Patterns for the Research Process

### Recommended Research Execution Structure

```
Phase 11 Execution
+-- Wave 1: Parallel Competitor Deep-Dives (5 plans)
|   +-- Plan 11-01: GSD deep-dive + feature catalog
|   +-- Plan 11-02: Superpowers deep-dive + feature catalog
|   +-- Plan 11-03: OMO deep-dive + feature catalog
|   +-- Plan 11-04: ECC deep-dive + feature catalog
|   +-- Plan 11-05: claude-mem deep-dive + feature catalog
|
+-- Wave 2: Synthesis (1 plan)
|   +-- Plan 11-06: Gap matrix + priority assignment + phase mapping + report
|
+-- Wave 3: Broader Ecosystem Scan (optional, 1 plan)
    +-- Plan 11-07: Scan awesome-opencode, awesome-claude-code for novel patterns
```

**Alternative (leaner):** Since this is a research-only phase with no code, a 2-plan structure may suffice:

```
Plan 11-01: All 5 competitor deep-dives (can be sequential in one session)
Plan 11-02: Gap matrix synthesis, priority assignment, phase scope definition
```

### Output Artifacts

The final deliverables of Phase 11 should be:

1. **Gap Matrix** (structured table): Feature-by-feature comparison across all 8 coverage areas
2. **Competitor Profiles** (per-plugin summaries): Architecture, strengths, weaknesses, relevance
3. **Phase Scope Definitions**: Concrete feature lists for Phases 12-17 based on gap priorities
4. **Memory Architecture Recommendation**: Specific technical direction for Phase 15
5. **Agent Verdict**: Build/skip decision for each specialized agent candidate
6. **Novel Opportunities**: Things competitors don't do that we should consider

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite for memory | Custom file-based DB | `bun:sqlite` (built-in) | Native Bun SQLite is battle-tested, zero dependencies |
| Full-text search | Custom search logic | SQLite FTS5 via `bun:sqlite` | FTS5 is production-grade, handles ranking and tokenization |
| Gap matrix rendering | Custom HTML/PDF generator | Structured markdown tables | Output is consumed by planner, not end users |
| Competitor source analysis | Cloning and running each plugin | GitHub README + web fetch | Reading source is sufficient; running competitors risks environment conflicts |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| File-based memory (CLAUDE.md) | System prompt injection | claude-mem v10.6.0 (2026) | More reliable memory delivery |
| Inline hook one-liners | Script-based hooks (Node.js) | ECC 2025-2026 | Cross-platform, debuggable, maintainable |
| Raw transcript storage | Observation-based capture | claude-mem 2026 | 10x token savings |
| Monolithic skill libraries | Selective install by language | ECC v1.9.0 (2026) | Users install only what they need |
| Agent-per-task | Skills-per-workflow | Superpowers trend (2025-2026) | Skills compose, agents don't |
| Manual context management | Progressive disclosure | claude-mem 2026 | Token-efficient retrieval |

## Open Questions

1. **Bun SQLite compatibility for memory**
   - What we know: Bun has built-in `bun:sqlite` module. claude-mem uses external SQLite + Chroma.
   - What's unclear: Whether `bun:sqlite` supports FTS5 extensions needed for full-text search in memory system.
   - Recommendation: Test `bun:sqlite` FTS5 in Phase 15 research before committing to the architecture. This is a Phase 15 concern, not Phase 11.

2. **OpenCode hook surface completeness**
   - What we know: Official docs list hooks. Competitors use hooks not in the official list (e.g., `before_prompt_build`).
   - What's unclear: Whether OpenCode's hook surface includes all events competitors rely on. Some hooks may be Claude Code-specific.
   - Recommendation: The research plan should verify OpenCode-specific hook availability for any recommended hook additions.

3. **Skill injection mechanism at scale**
   - What we know: We inject coding-standards skill via the existing pattern. ECC has 151+ skills.
   - What's unclear: Token cost of injecting multiple skills into agent prompts. At what point does skill injection itself become a context problem?
   - Recommendation: Phase 14 should establish a skill budget (max tokens per session from skills) and relevance-based selection.

4. **Phase 16 scope**
   - What we know: Research suggests skills > agents for most use cases.
   - What's unclear: Whether any specialized agent truly passes the "meaningfully better than existing tools" bar.
   - Recommendation: Phase 16 may be scoped down to a single agent or merged into Phase 14/17. The gap matrix should make a definitive call.

## Sources

### Primary (HIGH confidence)
- [github.com/gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done) -- README, docs, architecture examined
- [github.com/obra/superpowers](https://github.com/obra/superpowers) -- README, skill inventory, workflow docs
- [github.com/code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) -- README, features.md, docs/reference
- [github.com/affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) -- README, skill directory, hooks system
- [github.com/thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) -- README, changelog, architecture
- [opencode.ai/docs/plugins/](https://opencode.ai/docs/plugins/) -- Official OpenCode plugin API reference

### Secondary (MEDIUM confidence)
- [github.com/awesome-opencode/awesome-opencode](https://github.com/awesome-opencode/awesome-opencode) -- Curated ecosystem list (50+ plugins)
- [github.com/hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) -- Curated Claude Code ecosystem
- [claudepluginhub.com](https://www.claudepluginhub.com/) -- Plugin registry
- [emelia.io/hub/persistent-memory-claude-code-claude-mem](https://emelia.io/hub/persistent-memory-claude-code-claude-mem) -- claude-mem analysis
- [augmentcode.com/learn/everything-claude-code-github](https://www.augmentcode.com/learn/everything-claude-code-github) -- ECC analysis

### Tertiary (LOW confidence -- for validation)
- Star counts and adoption metrics (popularity signal, not quality)
- Blog posts and tutorials (may be promotional, cross-verify with source)

## Metadata

**Confidence breakdown:**
- Competitor analysis: HIGH -- all 5 plugins examined at source level via GitHub
- Gap identification: HIGH -- based on direct feature comparison against our codebase inventory
- Memory architecture: MEDIUM -- architecture recommendations are pre-Phase-15, need runtime validation
- Hook recommendations: MEDIUM -- OpenCode hook surface verified via official docs but some hooks may behave differently in practice
- Phase assignment: HIGH -- based on logical grouping and existing phase definitions

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (30 days -- plugin ecosystem moves fast but core patterns are stable)
