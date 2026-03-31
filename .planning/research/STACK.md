# Technology Stack

**Project:** OpenCode Assets Plugin
**Researched:** 2026-03-31

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| TypeScript | 5.8.x | Plugin source language | OpenCode's own codebase uses TS 5.8.2. Bun executes .ts natively -- no build step needed for development. Type safety catches agent/skill/command schema errors at write time. | HIGH |
| Bun | 1.2.x+ | Runtime and package manager | OpenCode mandates Bun for plugin execution. Plugins run inside the OpenCode process via Bun. No choice here -- it is a hard constraint. OpenCode v1.3.5 ships with Bun 1.2.21+. | HIGH |
| `@opencode-ai/plugin` | ^1.3.7 | Plugin types and `tool()` helper | The official plugin SDK. Provides the `Plugin` type, `tool()` factory, `tool.schema` (Zod-based), and hook type definitions. Auto-installed by OpenCode when referenced in opencode.json. 634 npm dependents confirm ecosystem adoption. | HIGH |

### Schema Validation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Zod (via `tool.schema`) | Bundled with `@opencode-ai/plugin` | Tool argument validation | `tool.schema` IS Zod. You can also `import { z } from "zod"` directly. No need to install Zod separately -- it ships with the plugin package. Supports: `tool.schema.string()`, `.number()`, `.enum([...])`, `.boolean()`, `.optional()`, `.default()`, `.min()`, `.max()`, `.describe()`. | HIGH |

### Testing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `bun:test` | Built-in | Unit and integration tests | Bun ships a Jest-compatible test runner (`describe`, `it`, `expect`, `mock`). Zero config, fast, supports TypeScript natively. No reason to add Vitest or Jest when the runtime already includes testing. | HIGH |

### Development Tooling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Biome | 2.x | Linting and formatting | Fast, single-tool replacement for ESLint + Prettier. Written in Rust, near-instant execution. OpenCode ecosystem is Bun-native -- Biome fits the "fast toolchain" philosophy. One config file, one tool. | MEDIUM |

### File System Operations

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `node:fs/promises` | Built-in | Reading/writing agent, skill, command files | Bun has full Node.js `fs` compatibility (~98% API coverage in 2026). Standard fs operations are all that is needed. Using Node.js `fs` over Bun-specific `Bun.write()`/`Bun.file()` improves testability for contributors who may not have Bun installed. | HIGH |
| `node:path` | Built-in | Path manipulation | Cross-platform path joining for `.opencode/agents/`, `.opencode/skills/`, `.opencode/commands/` directories. | HIGH |
| `node:os` | Built-in | Home directory resolution | `os.homedir()` for global config path (`~/.config/opencode/`). | HIGH |

### YAML Processing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| yaml | ^2.7.x | YAML frontmatter generation | Agents, skills, and commands use YAML frontmatter in markdown files. The `yaml` npm package is the standard JS YAML library -- small (no native bindings, works in Bun), well-maintained, handles edge cases (special characters in descriptions, nested permission objects). Used for programmatic frontmatter generation in creation tools. | HIGH |

### No Additional Runtime Dependencies Needed

The plugin is a file scaffolding tool (generates markdown files) with curated static content (agent prompts, skill docs, command templates). The entire runtime dependency beyond the required plugin SDK is one npm package: `yaml`. This is not a web app, API server, or complex system.

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| `@opencode-ai/sdk` | The SDK is for external clients calling OpenCode's HTTP API. Plugins run INSIDE the OpenCode process and get `ctx.client` already injected. Installing the SDK separately is unnecessary and adds confusion. |
| Zod (standalone install) | Already bundled via `tool.schema` in `@opencode-ai/plugin`. Installing Zod separately risks version conflicts between the bundled and standalone versions. |
| gray-matter | Designed for PARSING frontmatter from markdown. We are WRITING frontmatter, not parsing. The `yaml` package to stringify objects + string concatenation is simpler and avoids gray-matter's parsing edge cases. |
| Handlebars / EJS / Nunjucks | Template engines add complexity for what is string interpolation. Agent/skill/command files are short markdown with YAML frontmatter. TypeScript template literals handle this cleanly without a templating dependency. |
| Jest / Vitest | Bun's built-in test runner is Jest-compatible and faster. Adding a separate test framework adds config overhead for zero benefit in a Bun-native project. |
| ESLint + Prettier | Biome replaces both in a single tool. Two tools means two configs, two sets of rules, slower execution, and potential formatting conflicts between them. |
| Express / Hono / Fastify | The plugin runs inside OpenCode's process. It does not serve HTTP. Tools are invoked by the AI agent via the plugin API, not by HTTP requests. |
| tsx / ts-node / swc | Bun executes TypeScript natively with no transpilation wrapper. These tools solve a problem that does not exist in a Bun runtime. |
| Webpack / Rollup / esbuild | No build step required for development. Bun runs .ts files directly. For npm distribution, `bun build` or `tsc` handles compilation. No bundler needed for a library package. |
| oh-my-opencode as dependency | oh-my-opencode is a competing plugin, not a library. It provides agents, skills, and tools of its own. Depending on it would create coupling to a rapidly-changing third-party project and conflicting asset definitions. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| YAML generation | `yaml` package | Manual string concatenation | String concatenation breaks on special characters in descriptions, nested objects (permissions), and multi-line values. `yaml` handles these correctly. |
| YAML generation | `yaml` package | `js-yaml` | `js-yaml` is older, has a larger API surface, and `yaml` (v2) is the modern successor with better TypeScript types. |
| Test runner | `bun:test` | Vitest | Vitest requires config (`vitest.config.ts`), an additional dependency, and runs in Node.js by default. `bun:test` is zero-config and runs in the same runtime as the plugin. |
| Linting | Biome | ESLint flat config | ESLint flat config is simpler than legacy ESLint, but still requires a separate formatter (Prettier) and two tools. Biome is one tool. |
| File system | `node:fs/promises` | `Bun.file()` / `Bun.write()` | Bun-specific APIs work but reduce testability. `node:fs/promises` works in both Bun and Node.js, making the utility functions testable without Bun. |

## Plugin Entry Point Pattern

```typescript
import { type Plugin, tool } from "@opencode-ai/plugin"

export const OpenCodeAssetsPlugin: Plugin = async (ctx) => {
  const { directory, worktree, $ } = ctx

  return {
    tool: {
      oc_create_agent: tool({
        description: "Create a new OpenCode agent markdown file",
        args: {
          name: tool.schema.string().describe("Agent name (lowercase, hyphenated)"),
          description: tool.schema.string().describe("What this agent does"),
          mode: tool.schema.enum(["primary", "subagent", "all"]).default("all")
            .describe("Agent mode"),
          system_prompt: tool.schema.string().describe("System prompt content"),
          scope: tool.schema.enum(["project", "global"]).default("project")
            .describe("Where to create the agent"),
        },
        async execute(args, context) {
          // Validate name, resolve path, generate frontmatter, write file
          // Return confirmation with restart instructions
        },
      }),
      // oc_create_skill, oc_create_command follow same pattern
    },
  }
}
```

Note: Tool names prefixed with `oc_` to avoid shadowing built-in tools (see PITFALLS.md #6).

## Tool Schema API Reference

The `tool()` helper and `tool.schema` provide these capabilities:

```typescript
// String with description
tool.schema.string().describe("Parameter description")

// Optional string with default
tool.schema.string().optional().describe("Optional field")

// Enum (fixed choices)
tool.schema.enum(["primary", "subagent", "all"]).describe("Agent mode")

// Number with constraints
tool.schema.number().min(1).max(100).default(10).describe("Max results")

// Boolean with default
tool.schema.boolean().default(false).describe("Recursive search")

// Execute context provides:
// args: validated arguments matching schema
// context.sessionID, context.messageID, context.agent
// context.directory (session working directory)
// context.worktree (git worktree root)
// context.abort (AbortSignal)
```

## Distribution

```jsonc
// package.json
{
  "name": "opencode-assets",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "files": ["src/", "assets/"],
  "peerDependencies": {
    "@opencode-ai/plugin": ">=1.3.0"
  },
  "devDependencies": {
    "@opencode-ai/plugin": "^1.3.7",
    "@types/bun": "latest",
    "@biomejs/biome": "^2.0.0"
  },
  "dependencies": {
    "yaml": "^2.7.0"
  }
}

// User's opencode.json
{
  "plugin": ["opencode-assets@^0.1.0"]
}
```

Note: `peerDependencies` uses `>=1.3.0` (not `^1.3.7`) to accommodate version drift when OpenCode upgrades (see PITFALLS.md #5).

## Project File Structure

```
opencode-assets/
  assets/                    # Static markdown content (source of truth)
    agents/                  # Curated agent .md files
    skills/                  # Curated skill directories with SKILL.md
    commands/                # Curated command .md files
  src/
    index.ts                 # Plugin entry point, exports Plugin function
    tools/                   # Custom tools (creation workflows)
      create-agent.ts        # tool() for agent creation
      create-skill.ts        # tool() for skill creation
      create-command.ts      # tool() for command creation
    templates/               # Template functions for scaffolding
      agent-template.ts      # Generates agent markdown from structured input
      skill-template.ts      # Generates skill SKILL.md from structured input
      command-template.ts    # Generates command markdown from structured input
    utils/                   # Shared utilities
      paths.ts               # Resolve .opencode/ directories (project vs global)
      validation.ts          # Validate names, required fields
      frontmatter.ts         # YAML frontmatter generation via yaml package
  tests/                     # bun:test test files
  package.json
  tsconfig.json
  biome.json
```

## Installation (Development)

```bash
# Initialize project
bun init

# Core SDK (needed for development, auto-installed by OpenCode at runtime)
bun add -d @opencode-ai/plugin @types/bun

# Runtime dependency (YAML frontmatter generation)
bun add yaml

# Dev tooling
bun add -d @biomejs/biome
```

## Key Insight: Minimal Stack for a Content-First Plugin

This plugin's value is in its CONTENT (curated agent prompts, skill knowledge, command templates) and its TOOLING (creation workflows). The code is glue -- it validates input, generates markdown, and writes files. The stack should be deliberately minimal:

1. **`@opencode-ai/plugin`** -- plugin API and tool definitions (required)
2. **`yaml`** -- YAML frontmatter generation (1 runtime dependency)
3. **`node:fs`** + **`node:path`** + **`node:os`** -- file operations (built-in)
4. **`bun:test`** -- testing (built-in)
5. **Biome** -- code quality (dev dependency)

Total runtime dependencies: 1 npm package beyond the plugin SDK.

## Sources

- [OpenCode Plugin Documentation](https://opencode.ai/docs/plugins/) -- Official plugin API reference (HIGH confidence)
- [OpenCode Custom Tools](https://opencode.ai/docs/custom-tools/) -- Tool definition specification with schema examples (HIGH confidence)
- [OpenCode Agents](https://opencode.ai/docs/agents/) -- Agent YAML frontmatter fields and format (HIGH confidence)
- [OpenCode Skills](https://opencode.ai/docs/skills/) -- Skill SKILL.md specification and naming rules (HIGH confidence)
- [OpenCode Commands](https://opencode.ai/docs/commands/) -- Command markdown format and placeholders (HIGH confidence)
- [@opencode-ai/plugin on npm](https://www.npmjs.com/package/@opencode-ai/plugin) -- v1.3.7, 634 dependents (HIGH confidence)
- [OpenCode Changelog](https://opencode.ai/changelog) -- v1.3.5 latest, March 29, 2026 (HIGH confidence)
- [Plugin Development Guide (gist)](https://gist.github.com/rstacruz/946d02757525c9a0f49b25e316fbe715) -- Community reference with full examples (MEDIUM confidence)
- [oh-my-opencode](https://ohmyopencode.com/) -- Reference plugin for ecosystem patterns (MEDIUM confidence)
- [OpenCode DeepWiki](https://deepwiki.com/sst/opencode) -- Architecture analysis including build system and SDK (MEDIUM confidence)
