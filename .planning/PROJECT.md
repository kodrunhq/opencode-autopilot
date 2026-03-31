# OpenCode Assets Plugin

## What This Is

An all-in-one OpenCode plugin that provides a curated set of agents, skills, and commands — plus in-session creation tooling to build new ones without leaving the TUI. It fills the gap between OpenCode's extensible filesystem-based architecture and the poor UX for actually creating and managing those extensions.

## Core Value

Users can create and use high-quality agents, skills, and commands from within the OpenCode session — no CLI wizards, no manual file creation, no leaving the TUI.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] In-session command to create a new agent with guided prompts
- [ ] In-session command to create a new skill with guided prompts
- [ ] In-session command to create a new command with guided prompts
- [ ] Curated set of general-purpose agents (code reviewer, planner, TDD guide)
- [ ] Curated set of specialized agents (security reviewer, refactor helper)
- [ ] Curated set of commands for frequent tasks (commit, review-pr, simplify)
- [ ] Curated set of skills with domain knowledge (coding standards, API patterns, testing strategies)
- [ ] Single-plugin installation via opencode.json
- [ ] Works with both project-local and global installation
- [ ] Agents use appropriate model routing (haiku for lightweight, sonnet for complex)

### Out of Scope

- Porting all existing Claude Code / ECC / GSD assets — building fresh, curated set instead
- Hooks system — OpenCode hooks require JS/TS plugin code, not a v1 priority
- MCP server integration — separate concern, not part of this plugin
- OpenCode TUI theme customization — cosmetic, not functional
- Plugin marketplace / registry — distribution is via npm, not a custom registry

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
*Last updated: 2026-03-31 after initialization*
