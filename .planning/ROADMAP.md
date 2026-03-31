# Roadmap: OpenCode Assets Plugin

## Overview

This roadmap delivers the OpenCode Assets Plugin in three phases following a strict dependency chain: plugin infrastructure first (so tools can register and assets can install), creation tooling second (the core differentiator that validates the infrastructure), and curated assets last (agents, commands, and skills that ship with the plugin and prove the pipeline works end-to-end).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Plugin Infrastructure** - Scaffolding, tool registration, asset installer, and npm package structure
- [ ] **Phase 2: Creation Tooling** - In-session commands and tools for scaffolding new agents, skills, and commands
- [ ] **Phase 3: Curated Assets** - Bundled agents, commands, and skills that ship with the plugin

## Phase Details

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
- [x] 01-01-PLAN.md — Scaffold npm package, utility modules, and placeholder tool registration
- [x] 01-02-PLAN.md — Asset installer, config system, bundled assets, and plugin wiring

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
**Plans**: TBD

Plans:
- [x] 02-01: TBD
- [x] 02-02: TBD

### Phase 3: Curated Assets
**Goal**: The plugin ships with a useful set of subagents (injected via config hook), a command, and a skill that users get out of the box on install
**Depends on**: Phase 1, Phase 2
**Requirements**: AGNT-01, AGNT-02, AGNT-03, AGNT-04, CMND-01, SKLL-01
**Architecture note**: Curated agents are registered via OpenCode's `config` plugin hook (programmatic injection), NOT as markdown files. All 4 agents are `mode: "subagent"` — callable via `@mention` or by primary agents, never in the Tab cycle. Skills and commands remain file-based.
**Success Criteria** (what must be TRUE):
  1. After install, user can invoke `@researcher` to search the web and receive a structured report with sources
  2. After install, user can invoke `@metaprompter` to craft prompts and configurations for new assets
  3. After install, user can invoke `@documenter` to generate documentation, READMEs, and diagrams
  4. After install, user can invoke `@pr-reviewer` or the `/review-pr` command and get structured feedback on a GitHub pull request
  5. After install, user can reference the coding standards skill during code review or generation and the LLM applies the documented conventions
  6. None of the curated agents appear in the Tab cycle — only accessible via `@` or delegation from primary agents
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Agent config modules, config hook barrel, plugin wiring, and tests
- [x] 03-02-PLAN.md — Coding-standards skill and /review-pr command

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Plugin Infrastructure | 0/2 | Planning complete | - |
| 2. Creation Tooling | 0/0 | Not started | - |
| 3. Curated Assets | 0/0 | Not started | - |
