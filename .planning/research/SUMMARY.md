# Project Research Summary

**Project:** OpenCode Assets Plugin
**Domain:** AI Coding CLI Plugin (OpenCode extension)
**Researched:** 2026-03-31
**Confidence:** HIGH

## Executive Summary

OpenCode Assets is an npm-distributed plugin for the OpenCode AI coding CLI that delivers two things: a curated set of markdown-based agents, skills, and commands, and in-session creation tooling that lets users scaffold new assets without leaving the TUI. The plugin runs inside OpenCode's Bun runtime and registers custom tools via the `@opencode-ai/plugin` SDK. All assets are filesystem-based markdown files with YAML frontmatter -- there is no programmatic registration API. The recommended stack is deliberately minimal: TypeScript on Bun, the plugin SDK, one runtime dependency (`yaml` for frontmatter generation), and built-in `bun:test` for testing.

The core differentiator over competitors (primarily Oh My OpenCode) is the creation tooling. No existing plugin or CLI command offers in-session agent, skill, or command scaffolding. Oh My OpenCode ships pre-built assets but no creation workflow. OpenCode's own `agent create` CLI wizard requires leaving the TUI. By combining deterministic tool-based file generation with user-facing slash commands, this plugin fills a genuine gap. The architecture follows the "commands as entry points, tools as engines" pattern: users type `/create-agent`, the LLM calls the validated tool, and the tool writes a correctly-formatted file to disk.

The primary risks are OpenCode platform quirks: skill path singular/plural inconsistency (documented bug), no hot reload for newly created assets (users must restart), and name collision for skills without namespacing. All three are mitigable with runtime path testing, clear UX messaging, and a naming prefix convention. Version drift between the plugin SDK and OpenCode runtime is a secondary risk addressed through loose peer dependency ranges and avoiding undocumented APIs.

## Key Findings

### Recommended Stack

The stack is intentionally minimal for a content-first plugin. The entire runtime beyond the mandatory plugin SDK is a single npm package.

**Core technologies:**
- **TypeScript 5.8.x on Bun 1.2.x+**: Required by OpenCode -- Bun runs plugins natively, no build step for development
- **`@opencode-ai/plugin` ^1.3.7**: Official SDK providing `Plugin` type, `tool()` factory, and Zod-based `tool.schema`
- **`yaml` ^2.7.x**: YAML frontmatter generation for agent/skill/command files -- handles special characters and nested objects correctly
- **`bun:test`**: Built-in Jest-compatible test runner, zero config
- **Biome 2.x**: Single-tool linting and formatting (replaces ESLint + Prettier)
- **`node:fs/promises` + `node:path` + `node:os`**: Standard file operations for cross-platform compatibility

**Do not use:** standalone Zod (bundled in SDK), gray-matter (we write, not parse), template engines (template literals suffice), HTTP frameworks (plugin is not a server), tsx/ts-node (Bun runs TS natively).

### Expected Features

**Must have (table stakes):**
- Curated code reviewer agent
- Curated planner agent
- Curated commit command
- Curated PR review command
- Single-install via opencode.json
- Project-local and global installation support
- Model routing per agent via frontmatter
- Proper tool permissions per agent

**Should have (differentiators):**
- `/new-agent` in-session creation command (no competitor offers this)
- `/new-skill` in-session creation command (no equivalent exists anywhere)
- `/new-command` in-session creation command (no equivalent exists)
- Guided validation in creation tools (names, required fields, path conflicts)
- Template-based scaffolding with opinionated defaults
- Security reviewer agent
- Refactor helper agent
- Coding standards, API patterns, and testing strategies skills

**Defer (v2+):**
- Multi-agent orchestration / parallel agents
- Custom hooks (JS/TS lifecycle hooks)
- MCP server bundling
- Agent-to-agent delegation chains
- LSP / AST-Grep integration
- Claude Code compatibility layer

### Architecture Approach

The plugin has two decoupled subsystems: a static asset layer (markdown files copied to `.opencode/` directories at install time) and a runtime tool layer (TypeScript plugin registering creation tools). Assets are discovered by OpenCode via filesystem scanning, not programmatic registration. The creation tools use Zod schemas for input validation and generate frontmatter programmatically via the `yaml` package, avoiding LLM-generated YAML which is unreliable. Commands serve as user-facing entry points that instruct the LLM to call the corresponding validated tool.

**Major components:**
1. **Asset Layer** (`assets/`) -- Curated markdown files for agents, skills, commands; source of truth
2. **Installer** (`src/installer.ts`) -- Copies assets from npm package to user directories with no-clobber semantics
3. **Creation Tools** (`src/tools/`) -- Zod-validated tool functions that generate and write new asset files
4. **Templates** (`src/templates/`) -- Pure functions producing markdown strings from structured input
5. **Utilities** (`src/utils/`) -- Path resolution (project vs global), name validation, frontmatter generation
6. **Plugin Entry** (`src/index.ts`) -- Registers all tools with OpenCode, exports plugin function

### Critical Pitfalls

1. **Skill path singular/plural mismatch** -- OpenCode docs say `skills/` but runtime may use `skill/` in some contexts. Test every path against the live runtime before hardcoding. Must be resolved in Phase 1.
2. **No hot reload for created assets** -- Users must restart OpenCode after creating an agent/skill/command. Creation tool output must include explicit restart instructions.
3. **Skill name collisions** -- No namespacing; first-found-wins. Prefix all plugin skills with `oc-` and warn users of conflicts in creation tooling.
4. **Plugin cannot register assets programmatically** -- Design around filesystem writes from day one. No `registerAgent()` API exists.
5. **Custom tools shadowing built-ins** -- Prefix all tool names with `oc_` to avoid overriding OpenCode's `read`, `write`, `bash`, etc.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation and Utilities
**Rationale:** All other phases depend on validated path resolution, name validation, and frontmatter generation. These are pure utility functions with no external dependencies -- highest testability, lowest risk.
**Delivers:** `utils/validation.ts`, `utils/paths.ts`, `utils/frontmatter.ts`, project scaffolding (package.json, tsconfig, biome config)
**Addresses:** Plugin infrastructure, development setup
**Avoids:** Pitfall #1 (path mismatches -- resolved here through runtime testing), Pitfall #7 (file permissions -- handled in path utils), Pitfall #14 (Bun API assumptions -- use `node:fs` in utils)

### Phase 2: Templates and Creation Tools
**Rationale:** Templates depend on Phase 1 utilities. Creation tools compose templates with validation and filesystem writes. This is the core differentiator and must be built before curated assets to validate the scaffolding pipeline.
**Delivers:** `templates/agent-template.ts`, `templates/skill-template.ts`, `templates/command-template.ts`, `tools/create-agent.ts`, `tools/create-skill.ts`, `tools/create-command.ts`
**Addresses:** `/new-agent`, `/new-skill`, `/new-command` differentiators
**Avoids:** Pitfall #4 (no hot reload -- UX messaging in tool responses), Pitfall #6 (tool shadowing -- `oc_` prefix), Pitfall #12 (SKILL.md capitalization -- hardcoded in template)

### Phase 3: Plugin Entry and Installer
**Rationale:** Plugin entry imports and registers tools from Phase 2. Installer uses path utilities from Phase 1. Can be built once tools are ready.
**Delivers:** `src/index.ts` (plugin registration), `src/installer.ts` (postinstall asset copy with no-clobber), `assets/commands/create-agent.md`, `assets/commands/create-skill.md`, `assets/commands/create-command.md` (meta-commands)
**Addresses:** Single-install via opencode.json, plugin packaging
**Avoids:** Pitfall #3 (no programmatic registration -- uses filesystem), Pitfall #5 (version drift -- loose peer deps in package.json)

### Phase 4: Curated Table-Stakes Assets
**Rationale:** Curated assets validate that creation tooling and the installer work correctly. Table-stakes agents and commands come first because they are expected by users.
**Delivers:** Code reviewer agent, planner agent, commit command, PR review command
**Addresses:** Table-stakes features that prevent users from choosing Oh My OpenCode instead
**Avoids:** Pitfall #8 (model portability -- omit `model` field), Pitfall #9 (bloat -- ship only essentials), Pitfall #10 (command shadowing -- check against built-in names)

### Phase 5: Specialized Assets and Skills
**Rationale:** Differentiator assets and skills round out the offering. These are lower priority than table-stakes but provide competitive advantage. Skills validate the `/new-skill` creation tool.
**Delivers:** TDD guide agent, security reviewer agent, refactor helper agent, simplify command, coding standards skill, API patterns skill, testing strategies skill
**Addresses:** Differentiator features, skill ecosystem
**Avoids:** Pitfall #2 (name collisions -- `oc-` prefix on all skills), Pitfall #11 (skill content length -- keep under 500 words)

### Phase 6: Distribution and Polish
**Rationale:** Final phase handles npm publishing, cleanup tooling, and documentation. Depends on all other phases being stable.
**Delivers:** npm package publishing setup, `/oc-cleanup` command, contributing guide, CI validation of frontmatter
**Addresses:** Distribution, maintenance, contributor experience
**Avoids:** Pitfall #13 (no cleanup on uninstall -- explicit cleanup command), Pitfall #5 (version drift -- CI tests against multiple OpenCode versions)

### Phase Ordering Rationale

- Phases follow a strict dependency chain: utilities -> templates -> tools -> plugin entry -> assets. This matches the architecture's build order analysis.
- Creation tooling (Phases 1-3) before curated assets (Phases 4-5) because creation tooling is the unique value proposition and validates the infrastructure.
- Table-stakes assets before specialized assets because table-stakes features determine whether users adopt the plugin at all.
- Distribution last because it requires a stable, tested plugin.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Skill path convention (`skills/` vs `skill/`) must be verified against live OpenCode runtime before any code is written. Run a test skill through OpenCode and observe which path works.
- **Phase 3:** Installer mechanism (postinstall vs on-demand) needs validation. OpenCode may re-run `bun install` on each startup, which could trigger postinstall repeatedly.
- **Phase 4:** Agent frontmatter fields need verification against current OpenCode version. The `permission` object structure and `mode` enum values should be confirmed.

Phases with standard patterns (skip research-phase):
- **Phase 2:** Template and tool patterns are well-documented in the plugin SDK and community examples. Standard Zod schema + `tool()` factory.
- **Phase 5:** Skills and commands are straightforward markdown authoring. No technical unknowns.
- **Phase 6:** npm publishing is standard. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official docs, npm registry, and OpenCode source code all confirm the recommended stack. Only 1 runtime dependency. |
| Features | HIGH | Competitive analysis across 6+ tools (Claude Code, Cursor, Goose, Aider, Oh My OpenCode). Clear table-stakes vs differentiator separation. |
| Architecture | HIGH | Plugin API documented with examples. Filesystem-based asset discovery confirmed. Community plugins (oh-my-opencode, opencode-skillful) validate the pattern. |
| Pitfalls | HIGH | 5 of 14 pitfalls confirmed via GitHub issues with issue numbers. Remaining pitfalls inferred from documented behavior and general plugin patterns. |

**Overall confidence:** HIGH

### Gaps to Address

- **Skill path convention:** The `skills/` vs `skill/` inconsistency (Pitfall #1) must be resolved empirically before Phase 1 implementation. Run a test against the actual OpenCode runtime.
- **Hot reload behavior:** Architecture research says OpenCode watches the filesystem for changes, but Pitfalls research says no hot reload. These contradict. Must test whether newly created files in `.opencode/agents/` are discovered mid-session.
- **Installer trigger frequency:** If OpenCode runs `bun install` on every startup, the postinstall script runs repeatedly. Need to confirm whether no-clobber is sufficient or if a "first-run" guard is needed.
- **Tool naming constraints:** The exact rules for custom tool names (underscores vs hyphens, length limits) are not fully documented. Test with the `oc_create_agent` naming pattern.
- **Model aliasing:** OpenCode may support provider-agnostic model tiers. If so, agents could use `fast` or `smart` instead of specific model IDs. Not confirmed in current docs.

## Sources

### Primary (HIGH confidence)
- [OpenCode Plugin Documentation](https://opencode.ai/docs/plugins/)
- [OpenCode Agents Documentation](https://opencode.ai/docs/agents/)
- [OpenCode Skills Documentation](https://opencode.ai/docs/skills/)
- [OpenCode Commands Documentation](https://opencode.ai/docs/commands/)
- [OpenCode Custom Tools](https://opencode.ai/docs/custom-tools/)
- [@opencode-ai/plugin on npm](https://www.npmjs.com/package/@opencode-ai/plugin) -- v1.3.7, 634 dependents
- [OpenCode Changelog](https://opencode.ai/changelog) -- v1.3.5, March 29, 2026
- GitHub Issues: [#9819](https://github.com/anomalyco/opencode/issues/9819), [#10273](https://github.com/anomalyco/opencode/issues/10273), [#10441](https://github.com/anomalyco/opencode/issues/10441)

### Secondary (MEDIUM confidence)
- [oh-my-opencode](https://github.com/opensoft/oh-my-opencode) -- Reference plugin, ecosystem patterns
- [Plugin Development Guide (gist)](https://gist.github.com/rstacruz/946d02757525c9a0f49b25e316fbe715) -- Community examples
- [opencode-plugin-template](https://github.com/zenobi-us/opencode-plugin-template) -- Plugin scaffold
- [OpenCode DeepWiki](https://deepwiki.com/sst/opencode) -- Architecture analysis
- [Claude-Command-Suite](https://github.com/qdhenry/Claude-Command-Suite) -- Competitive analysis
- [Addy Osmani - LLM Coding Workflow 2026](https://addyosmani.com/blog/ai-coding-workflow/) -- Industry patterns

### Tertiary (LOW confidence)
- [Duplicate Skill Warnings - Issue #2909](https://github.com/code-yeongyu/oh-my-openagent/issues/2909) -- Third-party fork, may not apply directly
- [Bun Runtime Conflicts - Issue #11824](https://github.com/anomalyco/opencode/issues/11824) -- May be resolved in newer Bun versions

---
*Research completed: 2026-03-31*
*Ready for roadmap: yes*
