# get-shit-done (GSD) Deep Dive

## Metadata
- **GitHub URL:** https://github.com/gsd-build/get-shit-done
- **Stars:** ~46,800
- **Last commit date:** 2026-04-02 (actively maintained)
- **Installation:** Standalone CLI via npm (`npx gsd-build/get-shit-done`), installs into `~/.claude/get-shit-done/`
- **Compatible runtimes:** Claude Code (Pi SDK-based CLI, not an OpenCode plugin)
- **Language:** JavaScript/TypeScript (Vitest test suite)
- **Relevance to us:** MEDIUM

## Architecture Overview

GSD v2 is a **standalone TypeScript CLI** built on the Anthropic Pi SDK -- it orchestrates Claude Code sessions from outside, not through plugin hooks. The architecture is session-centric: a thin main session spawns parallel subagent sessions for heavy lifting, keeping the orchestrator context at 30-40% utilization.

**Key architectural layers:**
1. **CLI layer** (`bin/`, `scripts/`) -- Entry points, version management, update checking
2. **SDK layer** (`sdk/src/`) -- Session management, event streaming, CLI transport, WebSocket transport
3. **Prompt layer** (`sdk/src/prompt-builder.ts`, `sdk/src/phase-prompt.ts`) -- XML-structured prompt assembly
4. **Context engine** (`sdk/src/context-engine.ts`) -- Manages what files/context are injected per task
5. **Phase runner** (`sdk/src/phase-runner.ts`) -- Executes phases with milestone awareness
6. **Plan parser** (`sdk/src/plan-parser.ts`) -- Parses structured plan files with frontmatter
7. **Tool scoping** (`sdk/src/tool-scoping.ts`) -- Restricts tools available per execution context
8. **Commands** (`commands/gsd/`) -- 60+ slash commands for lifecycle management
9. **Agents** (`agents/`) -- 21 specialized subagent definitions
10. **Hooks** (`hooks/`) -- 5 JavaScript hooks for workflow automation

**Dependency model:** SDK layer wraps the Pi SDK transport (CLI or WebSocket). Commands dispatch to SDK functions. Agents are markdown files with YAML frontmatter, injected per task context.

## Feature Inventory

### Skills
| Name | Category | Description | Token Impact |
|------|----------|-------------|-------------|
| N/A | -- | GSD does not use a skills framework | N/A |

GSD operates through commands and agents, not skills. Its methodology is encoded in prompt templates and agent definitions rather than reusable skill files.

### Commands
| Name | What It Does | Arguments |
|------|-------------|-----------|
| `/gsd:new-project` | Initialize new GSD project with planning scaffolding | Project name, description |
| `/gsd:new-milestone` | Create new milestone with requirements and roadmap | Milestone name |
| `/gsd:discuss-phase` | Interactive discussion to define phase scope and decisions | Phase number |
| `/gsd:research-phase` | Deep research before planning (web search, code analysis) | Phase number |
| `/gsd:plan-phase` | Generate structured execution plans with waves and tasks | Phase number |
| `/gsd:execute-phase` | Execute plans with parallel subagents, per-task commits | Phase number |
| `/gsd:verify-work` | Post-execution verification against plan criteria | Phase/plan |
| `/gsd:ship` | Finalize and ship completed work (PR creation, etc.) | -- |
| `/gsd:quick` | Ad-hoc task outside the phase system | Task description |
| `/gsd:fast` | Rapid single-task execution | Task description |
| `/gsd:do` | Direct execution command | Task description |
| `/gsd:autonomous` | Fully autonomous multi-phase execution | -- |
| `/gsd:debug` | Structured debugging workflow | Issue description |
| `/gsd:review` | Code review command | Target |
| `/gsd:forensics` | Analyze failed runs and diagnose issues | Session/run ID |
| `/gsd:health` | System health check and diagnostics | -- |
| `/gsd:progress` | Show current project progress | -- |
| `/gsd:stats` | Show execution statistics | -- |
| `/gsd:session-report` | Generate session activity report | -- |
| `/gsd:thread` | Manage persistent conversation threads | Thread name |
| `/gsd:plant-seed` | Record forward-looking idea for future milestones | Seed description |
| `/gsd:note` | Add note to current phase context | Note text |
| `/gsd:add-todo` | Add todo item to current task list | Todo text |
| `/gsd:check-todos` | Review and verify todo completion | -- |
| `/gsd:pause-work` | Pause execution with state preservation | -- |
| `/gsd:resume-work` | Resume paused execution from saved state | -- |
| `/gsd:next` | Advance to next plan/phase automatically | -- |
| `/gsd:complete-milestone` | Finalize milestone with audit and summary | -- |
| `/gsd:milestone-summary` | Generate milestone completion summary | -- |
| `/gsd:audit-milestone` | Audit milestone for completeness and quality | -- |
| `/gsd:audit-uat` | User acceptance testing audit | -- |
| `/gsd:pr-branch` | Create PR branch from current work | -- |
| `/gsd:docs-update` | Update documentation based on changes | -- |
| `/gsd:map-codebase` | Generate codebase structural map | -- |
| `/gsd:settings` | Configure GSD settings | -- |
| `/gsd:update` | Update GSD to latest version | -- |
| `/gsd:help` | Show available commands | -- |
| `/gsd:add-backlog` | Add item to project backlog | Item description |
| `/gsd:review-backlog` | Review and prioritize backlog items | -- |
| `/gsd:add-phase` | Add new phase to roadmap | Phase details |
| `/gsd:insert-phase` | Insert phase at specific position | Phase details, position |
| `/gsd:remove-phase` | Remove phase from roadmap | Phase number |
| `/gsd:validate-phase` | Validate phase plans and structure | Phase number |
| `/gsd:secure-phase` | Security audit for phase work | Phase number |
| `/gsd:ui-phase` | UI-specific phase planning | Phase number |
| `/gsd:ui-review` | UI-specific code review | -- |
| `/gsd:list-phase-assumptions` | List assumptions for current phase | Phase number |
| `/gsd:plan-milestone-gaps` | Identify gaps in milestone planning | -- |
| `/gsd:workstreams` | Manage parallel workstreams | -- |
| `/gsd:new-workspace` | Create new workspace | Workspace name |
| `/gsd:list-workspaces` | List available workspaces | -- |
| `/gsd:remove-workspace` | Remove workspace | Workspace name |
| `/gsd:cleanup` | Clean up temporary files and state | -- |
| `/gsd:set-profile` | Set user profile for personalization | Profile data |
| `/gsd:profile-user` | Profile user's working style | -- |
| `/gsd:reapply-patches` | Reapply patches after merge conflicts | -- |
| `/gsd:join-discord` | Join GSD community Discord | -- |
| `/gsd:manager` | Project manager mode | -- |

### Hooks
| Event Type | What It Automates | Implementation |
|-----------|-------------------|---------------|
| `gsd-check-update` | Checks for new GSD versions on session start | JavaScript (hooks/) |
| `gsd-context-monitor` | Monitors context window utilization and warns when approaching limits | JavaScript (hooks/) |
| `gsd-prompt-guard` | Guards against prompt injection and malformed inputs | JavaScript (hooks/) |
| `gsd-statusline` | Displays GSD status information in the TUI status bar | JavaScript (hooks/) |
| `gsd-workflow-guard` | Ensures workflow steps are followed in order (no skipping phases) | JavaScript (hooks/) |

### Agents
| Name | Role | Mode | Model Assignment |
|------|------|------|-----------------|
| gsd-executor | Executes individual plan tasks with fresh context | Subagent | Model-agnostic |
| gsd-planner | Generates structured plans from phase context | Subagent | Model-agnostic |
| gsd-plan-checker | Validates plans against requirements and constraints | Subagent | Model-agnostic |
| gsd-verifier | Post-execution verification against acceptance criteria | Subagent | Model-agnostic |
| gsd-phase-researcher | Deep research for a specific phase domain | Subagent | Model-agnostic |
| gsd-project-researcher | Broader project-level research | Subagent | Model-agnostic |
| gsd-advisor-researcher | Advises on research methodology and priorities | Subagent | Model-agnostic |
| gsd-research-synthesizer | Synthesizes research findings into structured output | Subagent | Model-agnostic |
| gsd-assumptions-analyzer | Identifies and validates assumptions in plans | Subagent | Model-agnostic |
| gsd-codebase-mapper | Maps codebase structure for context injection | Subagent | Model-agnostic |
| gsd-debugger | Structured debugging with root cause analysis | Subagent | Model-agnostic |
| gsd-doc-verifier | Verifies documentation accuracy | Subagent | Model-agnostic |
| gsd-doc-writer | Generates documentation from code | Subagent | Model-agnostic |
| gsd-integration-checker | Checks cross-module integration correctness | Subagent | Model-agnostic |
| gsd-nyquist-auditor | Validates plans at Nyquist-level (minimum required detail) | Subagent | Model-agnostic |
| gsd-roadmapper | Generates and updates project roadmaps | Subagent | Model-agnostic |
| gsd-security-auditor | Security-focused code review | Subagent | Model-agnostic |
| gsd-ui-auditor | UI/UX quality audit | Subagent | Model-agnostic |
| gsd-ui-checker | UI implementation verification | Subagent | Model-agnostic |
| gsd-ui-researcher | UI pattern and framework research | Subagent | Model-agnostic |
| gsd-user-profiler | Profiles user working style for personalization | Subagent | Model-agnostic |

### Tools
| Name | Purpose | Schema |
|------|---------|--------|
| N/A (CLI tools) | GSD uses its own TypeScript SDK tools, not OpenCode plugin tools | N/A |

GSD implements its tooling as SDK functions (`gsd-tools.ts`), not as OpenCode-registered tools. Key SDK tools include: `commit-to-subrepo`, `state advance-plan`, `state update-progress`, `roadmap update-plan-progress`, `requirements mark-complete`, `config-get`, `init`.

### Memory / State
| Mechanism | Storage | Retrieval Pattern | Token Cost |
|-----------|---------|-------------------|------------|
| PROJECT.md | Filesystem (markdown) | Full file read at session start | ~500-1000 tokens |
| REQUIREMENTS.md | Filesystem (markdown) | Full file read during planning | ~300-800 tokens |
| ROADMAP.md | Filesystem (markdown) | Full file read for progress tracking | ~500-2000 tokens |
| STATE.md | Filesystem (markdown with YAML frontmatter) | Full file read at every session | ~300-1000 tokens |
| CONTEXT.md | Filesystem (per-phase) | Injected per phase execution | ~500-2000 tokens |
| RESEARCH.md | Filesystem (per-phase) | Injected during planning | ~1000-5000 tokens |
| PLAN.md | Filesystem (per-plan) | Injected per task execution | ~500-2000 tokens |
| SUMMARY.md | Filesystem (per-plan) | Referenced for progress tracking | ~300-1000 tokens |
| Seeds/Threads | Filesystem (markdown) | Surfaced at milestone transitions | ~100-500 tokens |

## Architecture Patterns

1. **Session isolation:** Each plan execution gets a fresh 200k context window. The main orchestrator stays lean at 30-40% utilization, spawning subagents for heavy work.
2. **Wave-based parallelism:** Plans within a phase are organized into dependency-aware waves. Plans in the same wave execute in parallel; waves execute sequentially.
3. **Structured file state:** All project state is stored in well-defined markdown files with YAML frontmatter. This is human-readable, git-friendly, and survives session crashes.
4. **Context engineering:** The SDK's context engine precisely controls what files are injected per task, preventing context pollution.
5. **XML prompt format:** Tasks are described in structured XML (`<task>`, `<action>`, `<verify>`) for precise agent instructions. This is more structured than natural language prompts.
6. **Commit-per-task:** Each completed task gets an atomic commit, enabling precise rollback and progress tracking.
7. **Self-healing state:** If STATE.md is corrupted or missing, GSD can reconstruct from SUMMARY.md files on disk.
8. **Quality gates:** Plan-checker loops validate plans before execution. Schema drift detection catches structural errors. Security audits are built into the phase workflow.

## Strengths

- **Context window management** is the best in the ecosystem. The fresh-context-per-plan pattern prevents the degradation that occurs in long sessions. Most competitors run everything in a single session until it bloats.
- **Structured state files** (PROJECT.md, STATE.md, ROADMAP.md) provide excellent project continuity across sessions and crashes. The markdown format is human-editable and git-trackable.
- **The "seeds" concept** is unique: capturing forward-looking ideas during work and surfacing them at milestone boundaries. This prevents loss of insights that occur during deep implementation.
- **Wave-based parallel execution** achieves genuine concurrency by spawning multiple independent sessions. Most competitors serialize all work.
- **Quick task path** (`/gsd:quick`, `/gsd:fast`) provides escape hatches from the full pipeline, which is essential for ad-hoc work.
- **60+ commands** provide comprehensive lifecycle management with clear separation of concerns.
- **Model-agnostic design** -- agents don't specify models, letting users configure their preferred providers.

## Weaknesses / Concerns

- **Not an OpenCode plugin** -- GSD is a standalone CLI that controls Claude Code. It cannot be installed as a plugin in OpenCode's plugin system. Patterns must be adapted, not reused directly.
- **Heavy file overhead** -- The structured state files (PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, CONTEXT.md, RESEARCH.md, PLAN.md, SUMMARY.md) consume significant context tokens when loaded. A single phase can have 20+ markdown files.
- **Agent sprawl** -- 21 agents, each with specific prompts, creates maintenance burden and context overhead for the orchestrator.
- **CLI-level orchestration** -- Because GSD controls sessions from outside, it cannot react to in-session events or provide real-time assistance. It is a batch processor, not an interactive assistant.
- **No skills framework** -- GSD encodes methodology in prompts and agents rather than reusable skills. This means users cannot selectively adopt individual techniques.
- **Complexity barrier** -- The full lifecycle (new-project -> discuss -> research -> plan -> execute -> verify -> ship) requires significant learning investment. The command surface is large.

## Relevance to Our Plugin

### Features We Should Adopt (with rationale)
- **Context window health management:** Our orchestrator should monitor context utilization and trigger compaction or fresh sessions before degradation. GSD's 30-40% main session target is a good benchmark.
- **Structured state persistence:** Our orchestrator state (decision log, confidence ledger, phase state) should be as well-structured and crash-resilient as GSD's markdown files.
- **Seeds/forward-looking ideas:** A mechanism to capture insights during work for future reference. Could be a simple `/note` or `/seed` command that writes to a persistent file.
- **Quick task escape hatch:** Our orchestrator's 8-phase pipeline is powerful but heavy for small tasks. A "quick mode" that skips exploration and planning for simple requests.
- **Commit-per-task pattern:** We already do per-task commits in our orchestrator; this validates the approach.

### Features We Should Skip (with rationale)
- **CLI-level orchestration:** We are a plugin, not a standalone CLI. Our orchestration happens within the session, not from outside.
- **Wave-based parallel plan execution:** This requires spawning multiple independent sessions, which is a CLI-level capability. Our parallel dispatch within a session is the correct approach.
- **60+ commands:** Command bloat is a UX antipattern. Our targeted command set (5 currently) is the right approach. Add commands only when research proves demand.
- **21 specialized agents:** Most of these (nyquist-auditor, ui-auditor, user-profiler) are specific to GSD's workflow. Our 14 agents already cover our pipeline needs.
- **Heavy state file system:** Multiple interlinked markdown files create maintenance overhead. Our simpler state approach (config + inline state) is more appropriate for a plugin.

### Opportunities to Do Better
- **In-session context management:** GSD manages context from outside the session. As a plugin, we can manage context FROM INSIDE -- monitoring token counts in real-time via hooks, triggering compaction proactively, injecting minimal relevant context.
- **Skill-based methodology transfer:** GSD embeds methodology in agent prompts. We can package the same methodologies as reusable skills (brainstorming, debugging, planning) that compose with any agent.
- **Simpler quick task UX:** GSD requires command-line invocation. Our quick mode could detect simple requests automatically and skip the pipeline, no special command needed.
