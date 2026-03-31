# Phase 2: Creation Tooling - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

In-session creation commands (`/new-agent`, `/new-skill`, `/new-command`) that scaffold new agents, skills, and commands from within the OpenCode TUI. Each command registers a plugin tool with Zod-validated schema that writes properly-formatted markdown files to the correct filesystem paths.

</domain>

<decisions>
## Implementation Decisions

### Agent Scaffolding (oc_create_agent)
- **D-01:** Full frontmatter field set: description (required), mode (default: subagent), model (optional), temperature (optional), permissions (default: strict read-only). Matches OpenCode's agent spec.
- **D-02:** Default mode is `subagent` — most common use case, invoked via `@mention`.
- **D-03:** Prompt section is LLM-generated — the tool generates a placeholder prompt with guidance comments. Phase 3's Metaprompter agent will provide intelligent prompt crafting.
- **D-04:** Tool validates agent name for filesystem safety and checks for existing files at the target path (never overwrite, per Phase 1 D-04).

### Skill Scaffolding (oc_create_skill)
- **D-05:** Strict name validation matching OpenCode's rules: 1-64 chars, lowercase alphanumeric with single hyphens, regex `^[a-z0-9]+(-[a-z0-9]+)*$`. Rejects names that don't conform.
- **D-06:** Creates skill directory + SKILL.md with YAML frontmatter (name, description, license, compatibility) and section scaffolding: `## What I do`, `## Rules`, `## Examples`.
- **D-07:** Directory name must match the skill name exactly.

### Command Scaffolding (oc_create_command)
- **D-08:** Full template generation: YAML frontmatter (description, agent, model — all optional except description) + template body with `$ARGUMENTS` placeholder and usage guidance.
- **D-09:** Validates command names — rejects names that would override OpenCode built-in commands (`init`, `undo`, `redo`, `share`, `help`). Also checks for illegal filesystem characters.

### Scope Targeting
- **D-10:** Always write to global `~/.config/opencode/` (matching Phase 1 D-05). No per-creation scope parameter — keeps the tool interface simple.

### Shared Patterns (from Phase 1)
- **D-11:** All tools use `oc_` prefix (Phase 1 D-06): `oc_create_agent`, `oc_create_skill`, `oc_create_command`.
- **D-12:** All params in single tool call (Phase 1 D-07) — LLM gathers info conversationally, then calls the tool once with complete parameters.
- **D-13:** Never overwrite existing files (Phase 1 D-04).

### Claude's Discretion
- Exact Zod schema field structure for each tool (types, optionality, defaults)
- YAML generation approach (use `yaml` package or template literals — note: yaml was removed in Phase 1, may need re-adding)
- How to structure the `/new-agent`, `/new-skill`, `/new-command` commands that trigger the tools
- Whether to register commands as markdown files or just tools (commands instruct LLM to call the tool)
- Error message format for validation failures

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenCode Extension Specs
- https://opencode.ai/docs/agents/ — Agent markdown format, frontmatter fields, mode/permission configuration
- https://opencode.ai/docs/skills/ — Skill directory structure, SKILL.md format, naming rules (1-64 chars, regex)
- https://opencode.ai/docs/commands/ — Command markdown format, template variables ($ARGUMENTS, $1, $2), agent/model overrides
- https://opencode.ai/docs/plugins/ — Plugin tool registration, Zod schema API (tool.schema)

### Existing Codebase
- `src/tools/placeholder.ts` — Tool registration pattern to follow (tool() helper, Zod schema, execute function)
- `src/utils/paths.ts` — `getGlobalConfigDir()` for target path resolution
- `src/utils/fs-helpers.ts` — `ensureDir()`, `copyIfMissing()` for filesystem operations
- `src/config.ts` — Zod validation pattern (pluginConfigSchema)
- `src/index.ts` — Plugin entry point where new tools must be registered

### Project Research
- `.planning/research/FEATURES.md` — Feature landscape, anti-features (no multi-step wizard UX)
- `.planning/research/PITFALLS.md` — Skill path pitfalls, name collision risks, tool shadowing

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/tools/placeholder.ts` — Proven tool registration pattern: `tool({ description, args: { ... tool.schema ... }, execute })`. New creation tools follow this exact pattern.
- `src/utils/paths.ts:getGlobalConfigDir()` — Returns `~/.config/opencode/` path. Used for writing created assets.
- `src/utils/fs-helpers.ts:ensureDir()` — Creates nested directories. Needed for skill subdirectories.
- `src/utils/fs-helpers.ts:copyIfMissing()` — Atomic no-clobber copy using `COPYFILE_EXCL`. Could be adapted for writing new files with existence check.

### Established Patterns
- Zod schemas via `tool.schema.string()`, `.enum()`, `.optional()`, `.describe()` — tool args validated by OpenCode
- Immutable result objects (`InstallResult` pattern)
- Error accumulation (errors array instead of throwing)

### Integration Points
- `src/index.ts` — New tools registered in the `tool: { ... }` object returned by the plugin function
- `assets/commands/` — New command markdown files for `/new-agent`, `/new-skill`, `/new-command`

</code_context>

<specifics>
## Specific Ideas

- The creation experience should feel like Claude Code's slash commands — smooth, in-session, no leaving the TUI
- Validation errors should be clear and actionable: "Skill name 'My Skill' is invalid. Names must be 1-64 lowercase alphanumeric characters with hyphens (e.g., 'my-skill')."
- The `yaml` package may need to be re-added as a dependency for frontmatter generation (was removed in Phase 1 because it was unused at that point)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-creation-tooling*
*Context gathered: 2026-03-31*
