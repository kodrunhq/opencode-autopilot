# Phase 1: Plugin Infrastructure - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

A working npm plugin package that registers creation tools with OpenCode, installs bundled assets (agents, skills, commands) to correct filesystem paths on load, and works with any LLM provider the user has configured. Includes a model configuration wizard for per-agent model assignment.

</domain>

<decisions>
## Implementation Decisions

### Package Structure
- **D-01:** Flat npm package (no monorepo). Single `src/` for plugin TypeScript code, `assets/` directory for bundled markdown files mirroring `.opencode/` structure (`assets/agents/`, `assets/skills/`, `assets/commands/`).
- **D-02:** Single default export — one plugin function that registers everything. No named exports for individual tools.

### Asset Installation
- **D-03:** Assets are copied on plugin load (every OpenCode start). Plugin checks for missing assets and copies them. Self-healing — no postinstall script needed.
- **D-04:** Never overwrite existing files. If a user has modified or created a file with the same name, skip it silently. User modifications are sacred.
- **D-05:** Default installation target is global (`~/.config/opencode/`). Assets available across all projects.

### Tool Registration
- **D-06:** All plugin tools use `oc_` prefix for namespacing (e.g., `oc_create_agent`, `oc_create_skill`, `oc_create_command`). Prevents collision with OpenCode built-ins.
- **D-07:** Creation tools accept all parameters in a single tool call. The LLM gathers information conversationally, then calls the tool once with complete parameters. No multi-step wizard in the tool itself.

### Provider & Model Configuration
- **D-08:** Bundled agents do NOT hardcode model fields. Instead, a configuration wizard runs on first plugin load and is re-runnable via a `/configure` command. The wizard prompts the user to assign a model to each agent.
- **D-09:** Configuration is stored in a plugin config file that the installer reads when writing agent markdown files.
- **D-10:** Strict tool permissions per agent — principle of least privilege. Read-only agents cannot write, reviewers cannot edit files.

### Claude's Discretion
- Config file format and location for model mappings
- Exact Zod schema structure for creation tools
- How to detect "first load" vs subsequent loads
- Error handling strategy for failed asset copies

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenCode Plugin API
- https://opencode.ai/docs/plugins/ — Plugin format, function signature, tool registration, hook system
- https://opencode.ai/docs/agents/ — Agent markdown format, frontmatter fields, mode/permission configuration
- https://opencode.ai/docs/skills/ — Skill directory structure, SKILL.md format, naming rules
- https://opencode.ai/docs/commands/ — Command markdown format, template variables, agent/model overrides
- https://opencode.ai/docs/configuration/ — opencode.json structure, config precedence, variable substitution

### Project Research
- `.planning/research/STACK.md` — Technology recommendations (Bun, TypeScript, yaml package, @opencode-ai/plugin SDK)
- `.planning/research/ARCHITECTURE.md` — System structure, component boundaries, data flows
- `.planning/research/PITFALLS.md` — Domain pitfalls (path inconsistencies, no hot reload, name collisions, silent clobber)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None — patterns will be established in this phase

### Integration Points
- OpenCode plugin loader (reads from `opencode.json` `"plugin"` array)
- OpenCode filesystem conventions (`.opencode/agents/`, `.opencode/skills/<name>/SKILL.md`, `.opencode/commands/`)
- Global config directory (`~/.config/opencode/`)

</code_context>

<specifics>
## Specific Ideas

- Installation should feel invisible — "add one line to opencode.json and everything works"
- Model wizard inspired by Claude Code's configuration experience — clean, in-session, not a clunky CLI
- Research flagged that skill paths may have singular/plural inconsistency (skills/ vs skill/) — verify against live runtime during implementation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-plugin-infrastructure*
*Context gathered: 2026-03-31*
