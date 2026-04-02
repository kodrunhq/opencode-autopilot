# Broader Ecosystem Scan

## Scan Methodology

**Date:** 2026-04-02
**Registries surveyed:** awesome-opencode (curated list, 50+ plugins), awesome-claude-code (curated Claude Code ecosystem), claudepluginhub.com (plugin registry)
**Total plugins cataloged:** 52 distinct plugins beyond the 5 primary competitors (GSD, superpowers, OMO, ECC, claude-mem)
**Focus:** Recurring patterns and convergent solutions across the ecosystem, not individual plugin profiles. Each category identifies the 2-3 most notable plugins by adoption and quality, then extracts the underlying pattern.

**Selection criteria for "notable":**
- Active development (commits within 60 days)
- Stars/forks above category median
- Documented architecture or README quality
- Unique approach vs. other entries in the same category

---

## Token Optimization

| Plugin | Approach | Token Savings Claimed | Relevance |
|--------|----------|----------------------|-----------|
| **opencode-snip** | Replaces large file contents with condensed snippet references; extracts only the relevant portion of files | 60-90% per file read | HIGH -- directly reduces context window pressure from our skill/memory injection |
| **Dynamic Context Pruning** | Monitors conversation history and prunes obsolete tool outputs (stale reads, superseded edits) from context | 30-50% over long sessions | HIGH -- sessions with our orchestrator can accumulate significant tool output |
| **opencode-tokenscope** | Comprehensive token usage analysis dashboard; tracks per-message, per-tool, and per-session token consumption with cost estimation | N/A (visibility, not reduction) | MEDIUM -- observability tool, not optimization, but informs optimization decisions |
| **Context Analysis Plugin** | Analyzes token distribution across message types (system, user, assistant, tool results); identifies bloat sources | N/A (analysis) | MEDIUM -- diagnostic complement to tokenscope |
| **smart-context-loader** | Loads only structurally relevant code (imports, signatures, types) instead of full files when context is tight | 40-70% per file | MEDIUM -- useful pattern but OpenCode's Read tool already handles partial reads |

### Pattern Summary

The ecosystem converges on two distinct token optimization strategies:

1. **Proactive pruning** -- remove stale or irrelevant content from the conversation context before it accumulates. Dynamic Context Pruning and smart-context-loader exemplify this. The pattern is: intercept tool outputs via hooks, evaluate freshness/relevance, replace expired content with compact summaries.

2. **Structural extraction** -- instead of reading full files, extract only the structurally relevant subset (signatures, types, imports, the specific function being discussed). opencode-snip is the most mature implementation.

Both strategies are additive: pruning reduces historical bloat, extraction reduces per-read cost. Successful token optimization plugins are transparent to the user -- they operate via hooks, not manual commands.

**Key insight for our plugin:** Our orchestrator's multi-phase pipeline accumulates tool outputs across many dispatches. A `session.compacted` or `tool.execute.after` hook that summarizes completed phase outputs would prevent context bloat without user intervention.

---

## Safety & Guardrails

| Plugin | What It Guards Against | Mechanism | Relevance |
|--------|----------------------|-----------|-----------|
| **CC Safety Net** | Destructive git commands (`git reset --hard`, `git clean -fd`, `git push --force`), dangerous filesystem operations (`rm -rf`, `chmod 777`) | `tool.execute.before` hook intercepts Bash tool calls, pattern-matches against a deny-list, blocks execution and suggests safe alternatives | HIGH -- our plugin has no destructive command prevention |
| **Envsitter Guard** | .env file content leaking into conversation context (API keys, database passwords, secrets) | Intercepts file read operations, detects .env patterns, redacts sensitive values before they enter context | HIGH -- critical for security; secrets in context persist for the session |
| **TDD Guard** | Code written before tests exist; implementation-first anti-pattern | `tool.execute.before` hook checks if test file exists before allowing source file writes; configurable strictness levels | MEDIUM -- enforcement mechanism for TDD workflow skill |
| **agnix** | Malformed AGENTS.md, CLAUDE.md, SKILL.md files; invalid YAML frontmatter, broken references | Linter with auto-fix capabilities; validates markdown structure and frontmatter schemas | MEDIUM -- we generate these files via templates, but validation on user-created files is valuable |
| **safe-shell** | Arbitrary command injection via shell metacharacters in tool arguments | Sanitizes Bash tool arguments, escapes shell metacharacters, blocks pipe chains to unknown commands | MEDIUM -- complements CC Safety Net with deeper shell safety |

### Pattern Summary

Safety plugins follow a consistent architecture: a `tool.execute.before` hook that intercepts tool calls, evaluates the command/arguments against a ruleset, and either blocks execution (with explanation) or allows it to proceed. The ecosystem has converged on three safety tiers:

1. **Destructive command prevention** (CC Safety Net, safe-shell) -- deny-list of dangerous patterns
2. **Secret protection** (Envsitter Guard) -- prevent sensitive data from entering context
3. **Workflow enforcement** (TDD Guard, agnix) -- ensure development practices are followed

The most adopted pattern is the deny-list approach: maintain a curated list of dangerous patterns, match incoming commands, and block with an explanation and safe alternative. This is simple, transparent, and has low false-positive rates.

**Key insight for our plugin:** Destructive command prevention and secret protection are table-stakes for a "best-in-class" plugin. These are low-complexity implementations (pattern matching in a `tool.execute.before` hook) with high safety value. Our plugin already registers `tool.execute.after` for fallback -- adding `tool.execute.before` for safety is a natural extension.

---

## Observability & Analytics

| Plugin | What It Tracks | Output Format | Relevance |
|--------|---------------|---------------|-----------|
| **claude-devtools** | Subagent execution trees, tool call sequences, timing data, token usage per dispatch | Desktop Electron app with real-time tree visualization and notification triggers | LOW -- desktop app is outside our plugin scope, but the data model (execution trees) is informative |
| **OpenCode Monitor** | Real-time token consumption, cost per session, tool usage frequency, model distribution | TUI dashboard overlay with configurable refresh rate | HIGH -- the data model and metrics are directly applicable |
| **Vibe-Log** | Full session analysis: tool sequences, decision points, error patterns, context utilization | HTML report with charts and strategic guidance for session improvement | MEDIUM -- post-session reports are valuable; HTML generation may be over-engineered |
| **opencode-plugin-otel** | Distributed traces, metrics, and logs following OpenTelemetry specification | OTLP export to any OpenTelemetry-compatible backend (Jaeger, Grafana, Datadog) | LOW -- requires external infrastructure; over-engineered for most users |
| **session-stats** | Per-session summary: total tokens, cost, tool count, duration, model usage breakdown | JSON + markdown summary appended to session log | HIGH -- lightweight, no external deps, useful for cost tracking |

### Pattern Summary

Observability in the plugin ecosystem ranges from lightweight session summaries to full distributed tracing. The ecosystem segments into three tiers:

1. **Lightweight metrics** (session-stats, OpenCode Monitor) -- track tokens, cost, tool usage per session. Low overhead, no external dependencies. This is the adoption sweet spot.
2. **Session analysis** (Vibe-Log) -- post-session reports with strategic guidance. Higher value but higher complexity. Useful for understanding long sessions and improving workflow.
3. **Full observability** (opencode-plugin-otel, claude-devtools) -- distributed tracing, execution trees, real-time visualization. Powerful but requires external infrastructure. Adoption is low outside enterprise users.

The converging pattern is: capture metrics via hooks (`tool.execute.after`, session lifecycle events), aggregate into a per-session summary, and surface via a command or auto-generated report. The most successful plugins (session-stats, OpenCode Monitor) keep it simple: tokens, cost, duration, tool breakdown.

**Key insight for our plugin:** Our orchestrator already dispatches multiple subagents and tools. Adding lightweight metrics capture (token count, tool count, duration per phase) via our existing `tool.execute.after` hook would provide observability with minimal overhead. A `/session-stats` command exposing this data is a natural fit.

---

## Session Management

| Plugin | Feature | Mechanism | Relevance |
|--------|---------|-----------|-----------|
| **Opencode Sessions** | Save, restore, and browse previous sessions; session tagging and search | Wraps OpenCode's session API with persistence layer; exports sessions as markdown | MEDIUM -- useful for users who context-switch frequently |
| **Handoff** | Generate structured handoff prompts when switching sessions or developers | Analyzes current session state, extracts key decisions, open tasks, and context, produces a markdown prompt for the next session | HIGH -- directly addresses cross-session continuity without full memory system |
| **Opencode Synced** | Sync OpenCode config, agents, skills, and commands across machines | Git-based sync with conflict resolution; watches config directory for changes | LOW -- our plugin already handles asset installation; machine-specific config is user responsibility |
| **session-checkpoint** | Create named checkpoints within a session that can be rolled back to | Stores conversation state at checkpoint, allows "rewind" to any saved point | MEDIUM -- useful for exploratory work but complex to implement within plugin constraints |

### Pattern Summary

Session management plugins address three concerns:

1. **Cross-session continuity** (Handoff, session-checkpoint) -- how to resume work without losing context. Handoff's approach (extract key decisions and open tasks into a structured prompt) is the lightest-weight solution and most compatible with our architecture.
2. **Session persistence** (Opencode Sessions) -- save/restore/browse session history. Overlaps with memory system concerns (Phase 15).
3. **Config portability** (Opencode Synced) -- synchronize configuration across machines. Our installer handles this for bundled assets; user config sync is out of scope.

The key trend is that session management is becoming a memory concern, not a standalone feature. Plugins like Handoff are essentially lightweight memory systems -- they extract observations at session boundaries and inject them at session start. This is converging with the memory system architecture identified in claude-mem's progressive disclosure pattern.

**Key insight for our plugin:** Handoff-style session continuity is a natural complement to our Phase 15 memory system. Rather than building a standalone session management feature, session handoff should be a memory system capability: automatically extract key decisions and open tasks at session end, inject them at session start.

---

## Interactive Planning & Architecture

| Plugin | Feature | Mechanism | Relevance |
|--------|---------|-----------|-----------|
| **open-plan-annotator** | Visual plan annotation in a browser UI; users can add comments, reorder tasks, and approve/reject plan items | Launches a local web server, renders plan markdown as interactive elements, syncs annotations back to session | LOW -- browser UI is outside our TUI-only constraint, but the annotation concept (user feedback on plans) is valuable |
| **OpenSpec** | Architecture specification generation with structured output; produces ADRs (Architecture Decision Records), component diagrams, API contracts | Agent-based planning that outputs structured markdown with consistent section headings | MEDIUM -- our orchestrator's planning phase already produces plans, but ADR generation is a missing capability |
| **plan-review** | Automated plan quality assessment: checks for missing dependencies, unrealistic task estimates, scope creep indicators | Analyzes plan markdown against heuristics, flags risks and missing sections | MEDIUM -- would complement our orchestrator's planning phase with quality gates |

### Pattern Summary

Interactive planning plugins are a nascent category with two emerging patterns:

1. **Visual annotation** (open-plan-annotator) -- bring plans out of the terminal into a visual interface for user review. This conflicts with our TUI-only approach but highlights a real need: users want to review and modify AI-generated plans before execution.
2. **Structured specification** (OpenSpec, plan-review) -- generate and validate architecture documents. ADRs, component diagrams, and API contracts are recurring outputs. The pattern is: agent generates structured markdown following a template, a review step validates completeness.

**Key insight for our plugin:** Our orchestrator already generates plans. What we lack is (a) a way for users to review/annotate plans before execution, and (b) architecture decision records that persist across phases. Both are skill-addressable: a "plan review" skill that teaches the agent to present plans for user feedback, and an "architecture documentation" skill for ADR generation.

---

## Developer Experience & Meta-Tools

| Plugin | Feature | What It Does | Relevance |
|--------|---------|-------------|-----------|
| **OMO `/doctor`** | Plugin health diagnostics | Verifies plugin registration, model availability, config validity, hook connectivity; reports issues with fix suggestions | HIGH -- we have no self-diagnostic capability |
| **agnix** | Asset file linting | Validates AGENTS.md, CLAUDE.md, SKILL.md structure; checks YAML frontmatter, section headings, broken references | MEDIUM -- useful for user-created assets |
| **ECC `/skill-stocktake`** | Installed asset audit | Lists all active skills, commands, agents; shows which are built-in vs user-created; flags conflicts and duplicates | HIGH -- as our plugin grows, users need visibility into what's installed |
| **config-doctor** | Configuration validator | Deep validation of opencode.json, agent configs, model assignments; detects misconfigurations before they cause runtime errors | MEDIUM -- overlaps with `/doctor` but focused specifically on config |
| **plugin-profiler** | Performance profiling | Measures hook execution time, tool response latency, memory usage per plugin; identifies slow plugins | LOW -- useful for plugin developers, not end users |

### Pattern Summary

Developer experience tools fall into three categories:

1. **Diagnostics** (`/doctor`, config-doctor) -- verify that the plugin stack is healthy. The pattern is: run a series of checks (registration, config, connectivity, permissions), collect results, present a pass/fail report with fix suggestions. This is the single most requested DX feature across the ecosystem.
2. **Auditing** (`/skill-stocktake`, agnix) -- inventory and validate installed assets. As plugin ecosystems grow, users lose track of what's installed, active, and conflicting. An audit command provides clarity.
3. **Profiling** (plugin-profiler) -- performance measurement for plugin developers. Low priority for end users but valuable for our own development.

**Key insight for our plugin:** A `/doctor` command is the highest-value DX addition. It should verify: (a) plugin loaded correctly, (b) all agents registered, (c) config valid and current version, (d) model assignments working, (e) asset directory health. This is a Phase 12 quick win -- simple implementation, high user value.

---

## Emerging Categories

### AI Prompt Management

Several plugins address prompt quality and management:
- **prompt-improver**: Rewrites user prompts for clarity and specificity before sending to the model
- **system-prompt-composer**: Composes system prompts from modular components based on task type
- **prompt-versioning**: Version controls system prompts with A/B testing support

This is an emerging category that does not fit traditional plugin taxonomies. The pattern is treating prompts as first-class artifacts that can be versioned, tested, and optimized. Our metaprompter agent already addresses prompt improvement, but prompt composition (assembling system prompts from modular skills) is a pattern we use but have not exposed as a user-facing capability.

### Multi-Model Orchestration

Beyond our existing fallback system:
- **model-router**: Routes tasks to different models based on complexity, cost, and capability matching
- **ensemble-runner**: Runs the same prompt against multiple models and synthesizes outputs
- **cost-optimizer**: Dynamically selects the cheapest model that meets a quality threshold

Our model fallback system handles error recovery. What we lack is proactive model routing (selecting the best model for a task before sending it). This is constrained by our model-agnostic requirement -- we cannot hardcode model capabilities. However, a user-configurable routing table (task type -> preferred model) would be compatible.

### Code Generation Quality

- **anti-slop**: Detects and removes AI-generated boilerplate, over-commenting, unnecessary abstractions
- **code-diet**: Strips generated code to minimal viable implementation; removes defensive coding that adds lines but not value
- **hallucination-guard**: Cross-references generated code against actual API documentation to catch hallucinated methods

This category addresses a real pain point: AI-generated code quality. OMO's comment checker is a simple version of this. The broader pattern is post-generation quality filtering, applying rules to generated code before it's written to files. Our review engine partially addresses this (22 specialist agents), but pre-write filtering via hooks is faster and cheaper than post-write review.

---

## Cross-Ecosystem Trends

### Trend 1: Skills Over Agents

The ecosystem is converging on skills (markdown-based behavioral instructions) over agents (dedicated subprocesses) for most use cases. Superpowers' massive adoption (107k+ stars) with 14 skills and zero agents validates this. Skills compose with any agent, cost zero tokens at rest, and are user-editable. Agents are reserved for fundamentally different personas (researcher vs. implementer) or when dedicated context isolation is required.

**Implication for our plugin:** Our 14 agents are appropriate (pipeline requires context isolation). But new capabilities should default to skills unless there's a specific reason for an agent.

### Trend 2: Hook-Driven Automation

The most differentiating plugins (ECC, claude-mem, CC Safety Net) are hook-first architectures. They intercept tool calls, session events, and file changes to provide value without user action. The pattern is: register hooks → capture events → apply rules/transformations → surface results. The user never invokes these manually.

**Implication for our plugin:** We have 4 hooks. Competitors with comparable ambition (ECC) have 25+. Our Phase 17 hook expansion is essential for "best-in-class" status.

### Trend 3: Progressive Disclosure

Token efficiency is the defining constraint. Every successful plugin that handles context (memory, observability, skill injection) uses progressive disclosure: show the minimum needed, expand on demand. claude-mem's 3-layer retrieval, opencode-snip's structural extraction, and ECC's selective skill loading all follow this pattern.

**Implication for our plugin:** Our skill injection (Phase 10) already loads skills selectively. Memory (Phase 15) must adopt 3-layer progressive disclosure. Observability (Phase 13) should summarize by default and expand on request.

### Trend 4: Self-Diagnostic Capability

Users expect plugins to help diagnose themselves. The `/doctor` pattern (OMO), `/skill-stocktake` (ECC), and agnix (linting) all address the same need: "is my setup working correctly?" This is especially important for plugins with many moving parts (agents, skills, hooks, config).

**Implication for our plugin:** With 14 agents, 22 review specialists, 5 commands, and a complex config system, self-diagnostics are essential. A `/doctor` or `/health` command should be a Phase 12 quick win.

### Trend 5: Composability via Modular Assets

The most adopted frameworks (superpowers, ECC) are modular: install only what you need. ECC moved to selective language-specific skill stacks in v1.9.0. Superpowers skills are individually adoptable. Monolithic "install everything" plugins have lower adoption rates.

**Implication for our plugin:** Our bundled assets should remain curated (not bloated), but we should support user-selective skill stacks. Phase 14 should consider a skill selection mechanism (e.g., language auto-detection that loads relevant stacks only).

---

## Relevance Summary

| Category | Priority for Our Plugin | Phase Assignment | Rationale |
|----------|------------------------|-----------------|-----------|
| Token Optimization | HIGH | Phase 13 + Phase 17 | Context pruning via hooks (Phase 17); token tracking metrics (Phase 13). Our orchestrator's multi-phase pipeline is especially vulnerable to context bloat. |
| Safety & Guardrails | HIGH | Phase 17 | Destructive command prevention and secret protection via `tool.execute.before` hook. Low complexity, high safety value. |
| Observability & Analytics | HIGH | Phase 13 | Lightweight session metrics (tokens, cost, tool breakdown). Our existing hooks can be extended. `/session-stats` command is a natural fit. |
| Session Management | MEDIUM | Phase 15 | Handoff-style continuity integrated into memory system rather than standalone. Session checkpoint is nice-to-have. |
| Interactive Planning | LOW | Phase 14 (skill) | Plan review as a skill; ADR generation as a skill. No browser UI. |
| Developer Experience | HIGH | Phase 12 | `/doctor` diagnostics and `/health` check are the single highest-value quick wins. Asset audit (`/stocktake`) for Phase 14. |
| AI Prompt Management | LOW | Already addressed | Our metaprompter agent covers prompt improvement. Prompt composition via skills is implicit in our architecture. |
| Multi-Model Orchestration | LOW | Phase 17 (if time) | Our fallback system covers error recovery. Proactive routing is constrained by model-agnostic requirement. |
| Code Generation Quality | MEDIUM | Phase 17 | Post-generation filtering complements our review engine. Comment quality checking is a quick hook addition. |
| Emerging (self-diagnostic) | HIGH | Phase 12 | Cross-trend: `/doctor` + `/stocktake` address the most common user frustration across the ecosystem. |
