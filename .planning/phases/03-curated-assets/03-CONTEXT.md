# Phase 3: Curated Assets - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Bundled subagents (injected via OpenCode's `config` plugin hook), a `/review-pr` command, and a coding standards skill. All 4 agents are `mode: "subagent"` — callable via `@mention` or by primary agents, never in the Tab cycle. Skills and commands are file-based, installed by the existing Phase 1 installer.

</domain>

<decisions>
## Implementation Decisions

### Agent Registration (Config Hook)
- **D-01:** All 4 curated agents are injected via the `config` plugin hook, NOT as markdown files. The hook receives the full OpenCode config as a mutable object and adds agents to `config.agent`.
- **D-02:** Each agent is defined in its own module under `src/agents/` (e.g., `src/agents/researcher.ts`). Each exports an agent config object. The config hook handler imports all agents and injects them.
- **D-03:** Do NOT touch Build/Plan built-in agents. Our agents are subagents alongside them. No demotion, no override, no `hidden: true` on built-ins.
- **D-04:** All agents use `mode: "subagent"` — callable via `@researcher`, `@metaprompter`, `@documenter`, `@pr-reviewer`. Never appear in Tab cycle.

### Agent Prompts
- **D-05:** Production-ready prompts — detailed role, instructions, constraints, output format. Ready to use out of the box, no customization needed.
- **D-06:** Prompts explicitly reference available tools and skills (e.g., "use webfetch to search the web", "reference the coding-standards skill for conventions").

### Agent Permissions (Principle of Least Privilege)
- **D-07:** Researcher — Read + Web + Write. Can read code, fetch web pages, and write markdown report files. No edit, no bash.
- **D-08:** Metaprompter — Read + Write. Can read existing agents/skills to understand patterns, write new asset files. No edit, no bash, no web.
- **D-09:** Documenter — Read + Write + Edit. Can read code and write/edit documentation files. No bash, no web.
- **D-10:** PR Reviewer — Read + Bash. Can read code and run git/gh commands for diff and PR info. No write, no edit, no web.

### Coding Standards Skill
- **D-11:** Universal best practices + modularity & abstraction focus. Language-agnostic principles (naming, file size, function size, error handling, immutability, separation of concerns, DRY, single responsibility).
- **D-12:** Opinionated tone — clear "DO this, DON'T do that" rules. The LLM follows without ambiguity.
- **D-13:** Installed as a file-based skill via Phase 1 installer. Located in `assets/skills/coding-standards/SKILL.md`.

### /review-pr Command
- **D-14:** File-based command in `assets/commands/review-pr.md`. Instructs the LLM to invoke the `@pr-reviewer` agent with the PR number from `$ARGUMENTS`.

### Claude's Discretion
- Exact prompt content for each agent (within the production-ready, tool-aware constraints)
- How to structure the config hook handler (single function or helper utilities)
- Agent config type structure matching OpenCode's expected schema
- Whether agents need `temperature` settings
- Coding standards skill: exact rules and examples

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenCode Plugin API
- https://opencode.ai/docs/plugins/ — Plugin hooks including `config` hook
- https://opencode.ai/docs/agents/ — Agent config schema, mode values, permission format
- https://opencode.ai/docs/skills/ — Skill SKILL.md format, naming rules
- https://opencode.ai/docs/commands/ — Command markdown format

### Config Hook Pattern (oh-my-opencode reference)
- `.planning/PROJECT.md` — Key decision: "Config hook for curated agents (not file copy)"
- oh-my-opencode's `src/plugin-handlers/config-handler.ts` pattern — injects agents into `config.agent` object

### Existing Codebase
- `src/index.ts` — Plugin entry point where config hook handler must be added (currently returns `tool` and `event` hooks)
- `src/installer.ts` — Existing file-based installer for skills and commands (reuse for skill/command assets)
- `src/templates/agent-template.ts` — Reference for agent frontmatter structure (but config hook agents use JS objects, not YAML)
- `assets/commands/` — Existing command files (pattern for `/review-pr` command)
- `assets/skills/` — Directory for coding standards skill

### Prior Phase Decisions
- `.planning/phases/01-plugin-infrastructure/01-CONTEXT.md` — D-05 (global target), D-06 (oc_ prefix), D-10 (strict permissions)
- `.planning/phases/02-creation-tooling/02-CONTEXT.md` — Template patterns, validation patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/index.ts` — Plugin entry already returns `{ tool, event }`. Config hook adds a `config` property to the return object.
- `src/installer.ts` — Self-healing file copier for skills/commands. Reuse for `assets/skills/coding-standards/SKILL.md` and `assets/commands/review-pr.md`.
- `src/utils/paths.ts:getGlobalConfigDir()` — Path resolution for `~/.config/opencode/`.

### Established Patterns
- Tool registration pattern in `src/tools/*.ts` — each module exports a tool definition
- Template pattern in `src/templates/*.ts` — pure functions generating markdown
- Agent permissions use OpenCode's `permission` object with `ask`/`allow`/`deny` values

### Integration Points
- `src/index.ts` return object — add `config: (cfg) => { ... }` alongside existing `tool` and `event`
- `assets/skills/` — add `coding-standards/SKILL.md` directory
- `assets/commands/` — add `review-pr.md`

</code_context>

<specifics>
## Specific Ideas

- Agent naming should be clean and short for `@` invocation: `@researcher`, `@metaprompter`, `@documenter`, `@pr-reviewer`
- The Researcher's ability to write reports is key — other agents or the user can `@researcher` to investigate something, then read the report file
- The Metaprompter is the brain behind `/new-agent` — when users want a well-crafted agent, they first `@metaprompter` to get a good prompt, then use `/new-agent` to scaffold it
- The coding standards skill should be something the Documenter and PR Reviewer agents reference in their prompts

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-curated-assets*
*Context gathered: 2026-03-31*
