# Phase 1: Plugin Infrastructure - Research

**Researched:** 2026-03-31
**Domain:** OpenCode plugin development -- npm package structure, tool registration, asset installation, provider-agnostic agent configuration
**Confidence:** HIGH

## Summary

Phase 1 builds the foundational npm package that serves as an OpenCode plugin: it registers tools, copies bundled asset files to the correct filesystem paths, and ensures all agents work regardless of which LLM provider the user has configured. The OpenCode plugin API is well-documented and stable (v1.3.8 of `@opencode-ai/plugin`). The plugin exports a single async function matching the `Plugin` type, returns a `tool` object containing named tools built with the `tool()` helper, and can use the `event` hook (listening for `session.created`) to perform first-load initialization like triggering a configuration wizard.

The critical architectural constraint is that plugins cannot programmatically register agents, skills, or commands -- these must exist as files on disk. Assets in `assets/` are copied to `~/.config/opencode/` (global) on plugin load, with a no-clobber strategy that skips existing files. The configuration wizard for model assignment stores its state in a JSON config file; agent markdown files are written with or without the `model` field based on that configuration.

**Primary recommendation:** Build the plugin as a flat npm package with `src/` and `assets/` directories. The entry point exports a `Plugin` function that (1) copies missing assets on every load (self-healing), (2) registers placeholder tools with `oc_` prefix, and (3) uses a config file at `~/.config/opencode/opencode-autopilot.json` to track first-load state and model assignments.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Flat npm package (no monorepo). Single `src/` for plugin TypeScript code, `assets/` directory for bundled markdown files mirroring `.opencode/` structure (`assets/agents/`, `assets/skills/`, `assets/commands/`).
- **D-02:** Single default export -- one plugin function that registers everything. No named exports for individual tools.
- **D-03:** Assets are copied on plugin load (every OpenCode start). Plugin checks for missing assets and copies them. Self-healing -- no postinstall script needed.
- **D-04:** Never overwrite existing files. If a user has modified or created a file with the same name, skip it silently. User modifications are sacred.
- **D-05:** Default installation target is global (`~/.config/opencode/`). Assets available across all projects.
- **D-06:** All plugin tools use `oc_` prefix for namespacing (e.g., `oc_create_agent`, `oc_create_skill`, `oc_create_command`). Prevents collision with OpenCode built-ins.
- **D-07:** Creation tools accept all parameters in a single tool call. The LLM gathers information conversationally, then calls the tool once with complete parameters. No multi-step wizard in the tool itself.
- **D-08:** Bundled agents do NOT hardcode model fields. Instead, a configuration wizard runs on first plugin load and is re-runnable via a `/configure` command. The wizard prompts the user to assign a model to each agent.
- **D-09:** Configuration is stored in a plugin config file that the installer reads when writing agent markdown files.
- **D-10:** Strict tool permissions per agent -- principle of least privilege. Read-only agents cannot write, reviewers cannot edit files.

### Claude's Discretion
- Config file format and location for model mappings
- Exact Zod schema structure for creation tools
- How to detect "first load" vs subsequent loads
- Error handling strategy for failed asset copies

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLGN-01 | Single npm package installable via one line in `opencode.json` | Plugin array format confirmed: `"plugin": ["opencode-autopilot"]`. Package needs `main` pointing to entry file, `files` including `src/` and `assets/`. |
| PLGN-02 | Plugin registers creation tools with Zod-validated schemas | `tool()` helper and `tool.schema` (Zod) API fully documented. Tools returned in `tool: {}` property of plugin return object. |
| PLGN-03 | Bundled assets (agents, skills, commands) are installed to correct filesystem paths | Paths confirmed: `~/.config/opencode/agents/`, `~/.config/opencode/skills/<name>/SKILL.md`, `~/.config/opencode/commands/`. Skills use plural `skills/` directory. |
| PLGN-04 | Works with any provider configured in OpenCode (model-agnostic agents) | Omitting `model` field from agent frontmatter lets the user's configured default apply. Configuration wizard (D-08) allows optional model assignment per agent. |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@opencode-ai/plugin` | ^1.3.8 | Plugin types, `tool()` helper, `tool.schema` (Zod) | Official SDK. Provides `Plugin` type, tool factory, Zod schemas. Auto-installed by OpenCode. |
| TypeScript | 5.8.x | Plugin source language | OpenCode's own codebase uses TS 5.8.x. Bun executes .ts natively. |
| Bun | 1.2.x+ | Runtime | Hard constraint -- OpenCode runs plugins via Bun. Local env has 1.3.11. |
| `yaml` | ^2.8.3 | YAML frontmatter generation | Standard JS YAML library. Needed for agent/skill/command frontmatter serialization. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs/promises` | Built-in | File read/write operations | All asset copying and file creation |
| `node:path` | Built-in | Path manipulation | Resolving `.opencode/` and `~/.config/opencode/` paths |
| `node:os` | Built-in | Home directory | `os.homedir()` for global config path |
| `@types/bun` | ^1.3.11 | Type definitions | Development-time TypeScript support |
| `@biomejs/biome` | ^2.4.10 | Lint + format | Development-time code quality |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:fs/promises` | `Bun.file()` / `Bun.write()` | Bun-native is faster but locks out Node.js test runners. Use `node:fs` for portability. |
| `yaml` | Manual string concat | Breaks on special characters, nested objects. `yaml` handles edge cases. |
| Biome | ESLint + Prettier | Two tools, two configs. Biome is one tool. |

**Installation:**
```bash
bun init
bun add yaml
bun add -d @opencode-ai/plugin @types/bun @biomejs/biome
```

**Version verification:** Versions confirmed via `npm view` on 2026-03-31:
- `@opencode-ai/plugin`: 1.3.8
- `yaml`: 2.8.3
- `@biomejs/biome`: 2.4.10
- `@types/bun`: 1.3.11

## Architecture Patterns

### Recommended Project Structure

```
opencode-autopilot/
  assets/                     # Bundled markdown files (copied to ~/.config/opencode/)
    agents/                   # Agent .md files (no model field -- provider agnostic)
    skills/                   # Skill directories with SKILL.md
      <name>/SKILL.md
    commands/                 # Command .md files
      configure.md            # /configure command to re-run model wizard
  src/
    index.ts                  # Plugin entry: exports default Plugin function
    installer.ts              # Asset copy logic (no-clobber, self-healing)
    config.ts                 # Config file read/write, first-load detection
    tools/                    # Tool definitions (Phase 1: placeholder)
      placeholder.ts          # Minimal tool to prove registration works
    utils/
      paths.ts                # Resolve target directories (global/project)
      fs-helpers.ts           # ensureDir, copyIfMissing, fileExists
  tests/                      # bun:test files
  package.json
  tsconfig.json
  biome.json
```

### Pattern 1: Plugin Entry Point

**What:** Single default export async function matching the `Plugin` type.
**When to use:** Always -- this is the only way to write an OpenCode plugin.

```typescript
// Source: https://opencode.ai/docs/plugins/
import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { installAssets } from "./installer"
import { loadConfig, isFirstLoad } from "./config"

const plugin: Plugin = async (ctx) => {
  // Self-healing asset installation on every load
  await installAssets()

  // First-load detection for config wizard
  const config = await loadConfig()

  return {
    tool: {
      oc_placeholder: tool({
        description: "Placeholder tool to verify plugin registration",
        args: {
          message: tool.schema.string().describe("A test message"),
        },
        async execute(args) {
          return `OpenCode Assets plugin loaded. Message: ${args.message}`
        },
      }),
    },
    event: async ({ event }) => {
      // Detect first session for configuration wizard prompt
      if (event.type === "session.created" && isFirstLoad(config)) {
        // Prompt user to run /configure
      }
    },
  }
}

export default plugin
```

### Pattern 2: No-Clobber Asset Installation

**What:** Copy files from `assets/` to target directory, skip if file already exists.
**When to use:** On every plugin load (D-03, self-healing).

```typescript
// Source: Decision D-03, D-04
import { access, copyFile, mkdir } from "node:fs/promises"
import { join, dirname } from "node:path"

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function copyIfMissing(source: string, target: string): Promise<boolean> {
  if (await fileExists(target)) {
    return false // User file is sacred (D-04)
  }
  await mkdir(dirname(target), { recursive: true })
  await copyFile(source, target)
  return true
}
```

### Pattern 3: First-Load Detection via Config File

**What:** Check for existence of a plugin config file to determine first load.
**When to use:** To trigger the configuration wizard on first plugin load (D-08).
**Recommendation (Claude's Discretion):** Use `~/.config/opencode/opencode-autopilot.json`. If the file does not exist, it is a first load. After the wizard completes, write the config file with model mappings.

```typescript
import { join } from "node:path"
import { homedir } from "node:os"

const CONFIG_PATH = join(homedir(), ".config", "opencode", "opencode-autopilot.json")

interface PluginConfig {
  version: number
  configured: boolean
  models: Record<string, string> // agent-name -> "provider/model-id"
}

function isFirstLoad(config: PluginConfig | null): boolean {
  return config === null || !config.configured
}
```

### Pattern 4: Tool Registration with Zod Schema

**What:** Register tools using `tool()` with `tool.schema` for argument validation.
**When to use:** Every tool the plugin exposes.

```typescript
// Source: https://opencode.ai/docs/plugins/, community gist
import { tool } from "@opencode-ai/plugin"

const myTool = tool({
  description: "Description shown to the LLM",
  args: {
    name: tool.schema.string().describe("Parameter description"),
    scope: tool.schema.enum(["project", "global"]).default("global")
      .describe("Installation scope"),
    verbose: tool.schema.boolean().optional().describe("Show details"),
  },
  async execute(args, context) {
    // context.sessionID, context.messageID, context.agent
    // context.directory (working dir), context.worktree (git root)
    return "Result string returned to the LLM"
  },
})
```

### Pattern 5: Resolving the Plugin's Own Package Directory

**What:** Find where the npm package's `assets/` directory is located at runtime.
**When to use:** In the installer, to locate source files for copying.

```typescript
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

// __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// assets/ is sibling to src/ in the package
const ASSETS_DIR = join(__dirname, "..", "assets")
```

**Note:** In Bun, `import.meta.dir` is also available and returns the directory of the current file directly.

### Anti-Patterns to Avoid

- **Runtime discovery from node_modules:** Do not scan `node_modules` to find assets. Use `import.meta.dir` or `__dirname` relative paths.
- **Synthetic message injection:** Do not use `session.created` to inject agent definitions as messages. Write files to disk instead.
- **Monolithic index.ts:** Separate concerns: entry point, installer, config, tools, utils.
- **LLM-generated frontmatter:** Never let the LLM format YAML directly. Use `yaml` package to serialize.
- **Hardcoded model IDs:** Never write `model: anthropic/claude-sonnet-4-20250514` in agent files. Omit model field or use config-driven values.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML serialization | String concatenation for frontmatter | `yaml` package `stringify()` | Special characters, nested objects, multi-line values break manual approaches |
| Schema validation | Manual type checking | `tool.schema` (Zod) | Built into the plugin SDK, handles validation + type inference |
| Path resolution | Hardcoded OS-specific paths | `node:path` + `node:os` | Cross-platform compatibility (Windows backslashes, macOS/Linux forward slashes) |
| Directory creation | Manual existence checks | `mkdir({ recursive: true })` | Handles nested creation, idempotent |
| Plugin type definitions | Manual interface definitions | `Plugin` type from `@opencode-ai/plugin` | Always in sync with OpenCode runtime |

**Key insight:** This is a content-first plugin. The code is glue between asset files and OpenCode's filesystem conventions. Keep it minimal -- the value is in the curated content and the tooling UX, not in complex infrastructure.

## Common Pitfalls

### Pitfall 1: Skill Path Singular/Plural Mismatch
**What goes wrong:** OpenCode docs specify `skills/` (plural) but older runtime versions loaded from `skill/` (singular).
**Why it happens:** Historical inconsistency between docs and runtime.
**How to avoid:** Current docs (2026-03-31) confirm `skills/` (plural). Use `skills/` and verify against live runtime during development. Test by creating a skill and checking if `/skill` command discovers it.
**Warning signs:** Skills exist on disk but are invisible in the session.

### Pitfall 2: Tool Names Shadowing Built-ins
**What goes wrong:** Plugin tools override OpenCode's core tools (read, write, bash, skill).
**Why it happens:** Plugin tools take precedence over built-ins with matching names.
**How to avoid:** All tools use `oc_` prefix (D-06). Maintain a list of built-in names: `read`, `write`, `edit`, `bash`, `glob`, `grep`, `fetch`, `skill`, `todowrite`, `task`.
**Warning signs:** Core OpenCode functionality stops working after plugin install.

### Pitfall 3: No Hot Reload for New Assets
**What goes wrong:** User creates an agent via the plugin tool, tries to use it immediately, it does not appear.
**Why it happens:** OpenCode loads assets at startup and does not re-scan during a session.
**How to avoid:** Every tool that creates a file must return a message: "Created successfully. Restart OpenCode to use it." Set this expectation in the tool response.
**Warning signs:** User says "the agent I just created doesn't exist."

### Pitfall 4: File Permission Errors on Global Path
**What goes wrong:** Plugin tries to write to `~/.config/opencode/` but directory does not exist or is not writable.
**Why it happens:** First-time users may not have the global config directory yet.
**How to avoid:** Always `mkdir({ recursive: true })` before writing. Catch `EACCES` and `EROFS` errors with actionable messages.
**Warning signs:** "Permission denied" or "ENOENT" errors during plugin load.

### Pitfall 5: `import.meta.dir` vs `__dirname` in ESM
**What goes wrong:** Using `__dirname` in ESM module fails. Using `import.meta.dir` works in Bun but not Node.js.
**Why it happens:** ESM does not define `__dirname`. Bun adds `import.meta.dir` as a convenience.
**How to avoid:** Use `import.meta.dir` (Bun-native, since plugin always runs in Bun) for the plugin entry. For test files that might run in Node, use `fileURLToPath(import.meta.url)`.
**Warning signs:** `ReferenceError: __dirname is not defined`.

### Pitfall 6: Config File Race on First Load
**What goes wrong:** Plugin load writes config, but session.created event fires before config write completes.
**Why it happens:** Async initialization timing.
**How to avoid:** Load config at the top of the plugin function (before returning hooks). The event handler reads the already-loaded config object, not the file.
**Warning signs:** Configuration wizard triggers on every session, not just first load.

## Code Examples

### Complete Minimal Plugin (verified pattern)

```typescript
// src/index.ts
// Source: https://opencode.ai/docs/plugins/ + community gist
import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"

const plugin: Plugin = async ({ directory, worktree }) => {
  return {
    tool: {
      oc_hello: tool({
        description: "A test tool to verify the plugin is loaded",
        args: {
          name: tool.schema.string().describe("Your name"),
        },
        async execute(args) {
          return `Hello, ${args.name}! OpenCode Assets plugin is working.`
        },
      }),
    },
  }
}

export default plugin
```

### Asset Installer (core logic)

```typescript
// src/installer.ts
import { readdir, copyFile, mkdir, access } from "node:fs/promises"
import { join } from "node:path"
import { homedir } from "node:os"

const GLOBAL_TARGET = join(homedir(), ".config", "opencode")
const ASSET_TYPES = ["agents", "skills", "commands"] as const

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function installAssets(assetsDir: string): Promise<{
  copied: string[]
  skipped: string[]
  errors: string[]
}> {
  const result = { copied: [] as string[], skipped: [] as string[], errors: [] as string[] }

  for (const assetType of ASSET_TYPES) {
    const sourceDir = join(assetsDir, assetType)
    const targetDir = join(GLOBAL_TARGET, assetType)

    if (!(await fileExists(sourceDir))) continue

    await mkdir(targetDir, { recursive: true })

    // For skills, iterate subdirectories; for agents/commands, iterate files
    // Implementation varies by asset type
  }

  return result
}
```

### package.json (distribution-ready)

```jsonc
{
  "name": "opencode-autopilot",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "files": ["src/", "assets/"],
  "peerDependencies": {
    "@opencode-ai/plugin": ">=1.3.0"
  },
  "devDependencies": {
    "@opencode-ai/plugin": "^1.3.8",
    "@types/bun": "^1.3.11",
    "@biomejs/biome": "^2.4.10"
  },
  "dependencies": {
    "yaml": "^2.8.3"
  }
}
```

### opencode.json (user adds one line)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-autopilot"]
}
```

### Agent Frontmatter (model-agnostic)

```yaml
---
description: Reviews pull requests with structured feedback
mode: all
permission:
  edit: deny
  bash: allow
  webfetch: allow
  task: deny
---
You are a pull request reviewer...
```

Note: No `model` field -- uses whatever provider/model the user has configured (PLGN-04).

### Agent Frontmatter (with configured model)

```yaml
---
description: Reviews pull requests with structured feedback
mode: all
model: anthropic/claude-sonnet-4-20250514
permission:
  edit: deny
  bash: allow
  webfetch: allow
  task: deny
---
You are a pull request reviewer...
```

Note: `model` field populated by configuration wizard (D-08, D-09).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| postinstall scripts for asset copy | Plugin load-time copy (self-healing) | 2026 ecosystem trend | No postinstall race conditions, assets self-repair |
| `tools` field in agent frontmatter | `permission` field | OpenCode v1.3.x | `tools` is deprecated; use `permission` with `allow`/`deny`/`ask` |
| Standalone Zod install | `tool.schema` (Zod bundled with SDK) | `@opencode-ai/plugin` v1.3.0+ | No version conflicts, simpler deps |
| `skill/` (singular) path | `skills/` (plural) path | OpenCode v1.3.x docs | Docs now consistently use plural |

## Open Questions

1. **Does `event.type === "session.created"` provide a session ID?**
   - What we know: Community examples cast to `(event as any).session_id`, suggesting it exists but is not typed.
   - What's unclear: Whether the typed event interface exposes session ID directly.
   - Recommendation: Test at runtime. If not typed, use type assertion. Not blocking for Phase 1.

2. **Can `tui.toast.show` display a message to the user during plugin load?**
   - What we know: Listed as a hook type in the plugin API. No documented usage examples found.
   - What's unclear: The exact API for triggering a toast from plugin code.
   - Recommendation: For first-load messaging, return a notice from the placeholder tool instead. Explore toast in Phase 2.

3. **Does the `/configure` command need special registration or is it just a command .md file?**
   - What we know: Commands are `.md` files in `.opencode/commands/` or `~/.config/opencode/commands/`. Filename becomes command name.
   - What's unclear: Whether a command can invoke plugin-specific logic (e.g., write to config file).
   - Recommendation: The `/configure` command's markdown instructs the LLM to call the `oc_configure` tool. The tool handles the actual config file write. Two-part pattern: command (UX entry) + tool (logic).

4. **Exact behavior of `main: "src/index.ts"` for npm-distributed Bun packages**
   - What we know: OpenCode runs plugins via Bun, which executes .ts natively. Community plugins use this pattern.
   - What's unclear: Whether npm publish with raw .ts files works for all consumers, or if a build step is needed.
   - Recommendation: Start with raw .ts (no build step). Test by installing from npm in a separate project. Add `bun build` if needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Plugin runtime | Yes | 1.3.11 | None (hard requirement) |
| Node.js | Testing fallback | Yes | 22.22.1 | Not needed if using bun:test |
| npm | Package publishing | Yes | 10.9.4 | bun publish |
| git | Version control | Yes | (repo exists) | None |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Project Constraints (from CLAUDE.md)

- **Runtime**: Must work with Bun (OpenCode's JS runtime for plugins)
- **Plugin format**: Must follow OpenCode's plugin spec (`@opencode-ai/plugin` types)
- **File conventions**: Agents, skills, commands must follow OpenCode's filesystem conventions exactly
- **No external dependencies**: Creation tooling should work offline, no API calls needed for scaffolding
- **Model agnostic**: Agents should work with any provider configured in OpenCode

## Sources

### Primary (HIGH confidence)
- [OpenCode Plugin Documentation](https://opencode.ai/docs/plugins/) -- Plugin API, function signature, hook types, tool registration
- [OpenCode Custom Tools](https://opencode.ai/docs/custom-tools/) -- tool() helper, schema methods, execute context
- [OpenCode Agents](https://opencode.ai/docs/agents/) -- Agent frontmatter fields, mode values, permission structure, model format
- [OpenCode Skills](https://opencode.ai/docs/skills/) -- SKILL.md format, naming regex, directory structure (plural `skills/`)
- [OpenCode Commands](https://opencode.ai/docs/commands/) -- Command markdown format, $ARGUMENTS, agent/model override
- [OpenCode Config](https://opencode.ai/docs/config/) -- Plugin array format, config precedence, merge behavior
- npm registry (`npm view`) -- Verified package versions on 2026-03-31

### Secondary (MEDIUM confidence)
- [Plugin Development Guide (gist by rstacruz)](https://gist.github.com/rstacruz/946d02757525c9a0f49b25e316fbe715) -- Full plugin patterns, ctx fields, hook examples
- [OpenCode Plugins Guide (gist by johnlindquist)](https://gist.github.com/johnlindquist/0adf1032b4e84942f3e1050aba3c5e4a) -- Event handling, session state management
- [oh-my-opencode DeepWiki](https://deepwiki.com/code-yeongyu/oh-my-opencode/2.1-installation) -- Plugin initialization phases, config file hierarchy
- [oh-my-opencode](https://ohmyopencode.com/) -- Reference plugin for ecosystem patterns

### Tertiary (LOW confidence)
- `tui.toast.show` hook -- listed in API but no usage examples found. Needs runtime testing.
- `session.created` event session ID -- community examples use type assertion, not confirmed in types.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified via npm registry, SDK well-documented
- Architecture: HIGH -- plugin API is stable, patterns confirmed across official docs and community gists
- Pitfalls: HIGH -- confirmed via GitHub issues and official documentation

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable ecosystem, 30-day validity)
