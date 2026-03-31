# OpenCode Assets Plugin

## What This Is

An OpenCode plugin that provides autonomous SDLC orchestration, built-in code quality enforcement, curated agents/skills/commands, and in-session creation tooling. Users give it an idea and it researches, plans, builds, reviews, and ships — or they use individual components (review engine, creation tools, curated agents) standalone.

## Core Value

A single command transforms an idea into a shipped, reviewed, tested result — fully autonomous, with built-in code quality enforcement at every stage.

## Current Milestone: v2.0 Autonomous Orchestrator

**Goal:** Transform opencode-assets from a utility plugin into an autonomous SDLC orchestration engine with embedded code review.

**Target features:**
- Tool-based orchestrator (`oc_orchestrate`) driving an 8-phase state machine
- Embedded ace review engine (20+ specialized review agents)
- Deterministic tooling ported to native TypeScript
- 12+ specialized subagents injected via config hook
- Confidence ledger controlling pipeline depth
- Architecture Arena with competing proposals + adversarial critique
- Full user configurability (autonomy, strictness, model routing, phase toggles)
- Preserves v1 creation tooling and curated agents

## Requirements

### Validated

(None yet — ship to validate)

### Active

<!-- v2.0 Autonomous Orchestrator -->

- [ ] Autonomous orchestrator tool (oc_orchestrate) with 8-phase state machine
- [ ] Embedded ace review engine with 20+ specialized agents
- [ ] Deterministic state/config/confidence tooling in TypeScript
- [ ] 12+ specialized subagents (researcher, proposer, critic, implementer, reviewer, etc.)
- [ ] Architecture Arena with competing proposals and adversarial critique
- [ ] Confidence ledger controlling pipeline depth and decisions
- [ ] User-configurable settings (autonomy, strictness, model routing, phase toggles)
- [ ] Institutional memory for cross-project learning

### Out of Scope

- MCP server integration — separate concern, not part of this plugin
- OpenCode TUI theme customization — cosmetic, not functional
- Plugin marketplace / registry — distribution is via npm, not a custom registry
- Real-time collaboration / multi-user — single-user orchestration only
- GUI dashboard — all interaction via TUI tools

## Context

- OpenCode is an open-source AI coding CLI (https://opencode.ai) with a TUI interface
- Extensions are filesystem-based: agents are markdown files in `.opencode/agents/`, skills are `SKILL.md` files in `.opencode/skills/<name>/`, commands are markdown files in `.opencode/commands/`
- Plugins are JS/TS modules in `.opencode/plugins/` or npm packages referenced in `opencode.json`
- `opencode agent create` exists as a CLI wizard but is clunky and error-prone
- There is NO `opencode skill create` or `opencode command create` — users must create files manually
- Plugins can provide custom tools (with Zod schemas) and hooks
- **Config hook discovery (2026-03-31):** Plugins CAN inject agents programmatically via the `config` hook — it receives the full config as a mutable object. oh-my-opencode uses this to inject 10 agents, demote Build to hidden subagent, and set its own default. This is the correct pattern for curated agents (vs file copying)
- Agent modes: `primary` (Tab-cycleable), `subagent` (@-callable only), `all` (both). Set `hidden: true` to exclude from Tab and @ autocomplete. Set `disable: true` to remove built-ins entirely
- Bun is the JS runtime for plugins
- OpenCode supports Claude Code compatibility: reads `CLAUDE.md`, searches `.claude/skills/` for skills

## Constraints

- **Runtime**: Must work with Bun (OpenCode's JS runtime for plugins)
- **Plugin format**: Must follow OpenCode's plugin spec (`@opencode-ai/plugin` types)
- **File conventions**: Agents, skills, commands must follow OpenCode's filesystem conventions exactly
- **No external dependencies**: Creation tooling should work offline, no API calls needed for scaffolding
- **Model agnostic**: Agents should work with any provider configured in OpenCode (Anthropic, OpenAI, etc.)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build fresh assets, don't port existing | User doesn't use most existing Claude Code assets; curated > comprehensive | ✓ Good |
| Creation tooling first, then curated assets | Infrastructure enables future growth; assets without tooling is a dead end | ✓ Good |
| Single npm package distribution | Simplest install path: add one line to opencode.json | ✓ Good |
| Commands as the creation UX | OpenCode commands run in-session, closest to Claude Code's slash command experience | ✓ Good |
| Config hook for curated agents (not file copy) | oh-my-opencode pattern: inject agents via config hook, more reliable than copying .md files | — Pending |
| All curated agents as subagents only | Researcher, Metaprompter, Documenter, PR Reviewer are @-callable, never in Tab cycle. Avoids polluting primary agent rotation. | — Pending |
| Port hands-free + ace as unified orchestrator | Fully autonomous SDLC pipeline with embedded review, not two plugins glued together | — Pending |
| Tool-based orchestrator (not command) | oc_orchestrate registered tool gives programmatic control; subagents dispatched as tools | — Pending |
| Port hf-tools to TypeScript | Native Bun, testable with bun test, follows existing codebase TS patterns | — Pending |
| Ace as built-in review engine | Always available, no separate install; usable standalone or as pipeline stage | — Pending |
| Fully autonomous by default | No human checkpoints; all decisions logged to decision log | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-31 after milestone v2.0 start*
