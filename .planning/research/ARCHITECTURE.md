# Architecture Patterns

**Domain:** OpenCode plugin providing bundled agents/skills/commands + in-session creation tooling
**Researched:** 2026-03-31

## Recommended Architecture

The plugin is a single npm package with two distinct subsystems: a **static asset layer** (markdown files for agents, skills, commands) and a **runtime tool layer** (TypeScript plugin providing creation tools). These subsystems share no runtime coupling -- the asset layer is filesystem-based and consumed by OpenCode natively, while the tool layer is a standard OpenCode plugin that writes new asset files to disk.

```
opencode-assets (npm package)
|
+-- assets/                      <-- Static markdown files (source of truth)
|   +-- agents/                  <-- Agent .md files with frontmatter
|   |   +-- code-reviewer.md
|   |   +-- planner.md
|   |   +-- tdd-guide.md
|   |   +-- security-reviewer.md
|   |   +-- ...
|   +-- skills/                  <-- Skill directories with SKILL.md
|   |   +-- coding-standards/
|   |   |   +-- SKILL.md
|   |   +-- api-patterns/
|   |   |   +-- SKILL.md
|   |   +-- ...
|   +-- commands/                <-- Command .md files with frontmatter
|       +-- commit.md
|       +-- review-pr.md
|       +-- simplify.md
|       +-- create-agent.md      <-- Meta-command: creates new agents
|       +-- create-skill.md      <-- Meta-command: creates new skills
|       +-- create-command.md    <-- Meta-command: creates new commands
|       +-- ...
|
+-- src/                         <-- Plugin runtime (TypeScript)
|   +-- index.ts                 <-- Plugin entry point, exports plugin function
|   +-- installer.ts             <-- Asset copying logic (npm postinstall)
|   +-- tools/                   <-- Custom tools for creation workflows
|   |   +-- create-agent.ts
|   |   +-- create-skill.ts
|   |   +-- create-command.ts
|   +-- templates/               <-- Template strings/functions for scaffolding
|   |   +-- agent-template.ts
|   |   +-- skill-template.ts
|   |   +-- command-template.ts
|   +-- utils/                   <-- Shared utilities
|       +-- paths.ts             <-- Resolve .opencode/ directories
|       +-- validation.ts        <-- Validate names, frontmatter
|       +-- frontmatter.ts       <-- Generate YAML frontmatter
|
+-- package.json                 <-- files: ["dist/", "assets/"], postinstall script
+-- tsconfig.json
+-- opencode.json                <-- Example config for development
```

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Asset Layer** (`assets/`) | Stores curated agent, skill, and command markdown files | OpenCode runtime (read at startup via filesystem) |
| **Installer** (`src/installer.ts`) | Copies assets from npm package to user's `.opencode/` or `~/.config/opencode/` directories | Filesystem (write), npm lifecycle (postinstall trigger) |
| **Plugin Entry** (`src/index.ts`) | Registers custom tools and hooks with OpenCode | OpenCode plugin runtime (registration) |
| **Creation Tools** (`src/tools/`) | Accept parameters via Zod schemas, generate markdown files, write to disk | Plugin entry (tool registration), Templates (content generation), Paths util (target resolution) |
| **Templates** (`src/templates/`) | Pure functions that produce markdown strings from structured input | Creation tools (called by) |
| **Path Resolution** (`src/utils/paths.ts`) | Determines correct target directory (project-local vs global) | Creation tools, Installer |
| **Validation** (`src/utils/validation.ts`) | Validates names (regex `^[a-z0-9]+(-[a-z0-9]+)*$`), required fields | Creation tools |

## Data Flow

### Flow 1: Plugin Installation (npm install)

```
npm install opencode-assets
        |
        v
postinstall script (src/installer.ts)
        |
        +-- Reads assets/ from package directory
        +-- Determines target: project (.opencode/) or global (~/.config/opencode/)
        +-- Copies agents/*.md --> target/agents/
        +-- Copies skills/*/SKILL.md --> target/skills/*/
        +-- Copies commands/*.md --> target/commands/
        +-- Skips files that already exist (no clobber) to preserve user edits
        v
Assets on filesystem, ready for OpenCode to discover
```

### Flow 2: Plugin Loading (OpenCode startup)

```
OpenCode reads opencode.json
        |
        +-- "plugin": ["opencode-assets"]
        v
OpenCode runs bun install (installs/updates package)
        |
        v
OpenCode imports plugin entry (src/index.ts)
        |
        +-- Plugin function receives { project, client, $, directory, worktree }
        +-- Registers custom tools: create-agent, create-skill, create-command
        +-- Returns tool definitions to OpenCode
        v
Tools available in session for agent to call
```

### Flow 3: In-Session Asset Creation (runtime)

```
User types /create-agent (or agent decides to call create-agent tool)
        |
        v
OpenCode command triggers prompt --> LLM responds with tool call
        |
        v
create-agent tool receives args (name, description, model, mode, prompt)
        |
        +-- validation.ts validates name format, required fields
        +-- paths.ts resolves target directory (.opencode/agents/ or ~/.config/opencode/agents/)
        +-- agent-template.ts generates markdown with frontmatter
        +-- Tool writes file to disk via Bun fs API
        v
New agent available immediately (OpenCode watches filesystem)
```

### Flow 4: Curated Asset Usage (passive)

```
OpenCode starts session
        |
        +-- Scans .opencode/agents/ --> finds installed agent .md files
        +-- Scans .opencode/skills/*/ --> finds installed SKILL.md files
        +-- Scans .opencode/commands/ --> finds installed command .md files
        v
Agents available via @mention, skills via skill tool, commands via /slash
```

## Architecture Decision: Commands vs Tools for Creation

There are two viable approaches for the creation UX:

**Option A: OpenCode Commands (markdown-based, recommended)**
- Creation prompts defined as `.md` files in `assets/commands/`
- The command template uses `$ARGUMENTS` and the LLM generates the file
- No TypeScript runtime needed for basic creation
- Limited: the LLM writes the file, not deterministic tooling

**Option B: Custom Tools (TypeScript-based, recommended as complement)**
- Zod-validated parameters ensure correct structure
- Deterministic output -- same inputs always produce same file
- Agent can call the tool programmatically
- More complex to build but more reliable

**Recommendation: Use both.** Commands as the user-facing entry point (type `/create-agent reviewer`), which instruct the LLM to call the corresponding custom tool. The tool handles validation and file writing deterministically. This gives the best UX (natural language commands) with reliable output (structured tool execution).

## Patterns to Follow

### Pattern 1: Deterministic File Generation via Tools

The creation tools should be pure-ish functions: given structured input, produce a known output. Do not rely on the LLM to format frontmatter correctly.

```typescript
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"

export const createAgentTool = tool({
  name: "create_agent",
  description: "Create a new OpenCode agent markdown file",
  parameters: z.object({
    name: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    description: z.string().min(10).max(200),
    mode: z.enum(["primary", "subagent", "all"]).default("all"),
    model: z.string().optional(),
    systemPrompt: z.string().min(50),
    scope: z.enum(["project", "global"]).default("project"),
  }),
  async execute(args, ctx) {
    const content = renderAgentMarkdown(args)
    const targetDir = resolveAgentDir(args.scope, ctx.directory)
    const filePath = path.join(targetDir, `${args.name}.md`)
    await Bun.write(filePath, content)
    return { created: filePath }
  },
})
```

### Pattern 2: No-Clobber Asset Installation

When the installer copies assets, it must never overwrite user-modified files. Check existence before writing. Optionally provide an `--force` flag or a `update-assets` command for explicit refresh.

```typescript
async function installAsset(source: string, target: string): Promise<boolean> {
  if (await Bun.file(target).exists()) {
    return false // skip, user may have customized
  }
  await Bun.write(target, await Bun.file(source).text())
  return true
}
```

### Pattern 3: Scope Resolution (Project vs Global)

The plugin must handle both scopes. Project-local is the default for creation tools (assets live with the repo). Global is an explicit opt-in for personal tooling.

```typescript
function resolveTargetDir(
  assetType: "agents" | "skills" | "commands",
  scope: "project" | "global",
  projectDir: string
): string {
  if (scope === "global") {
    return path.join(os.homedir(), ".config", "opencode", assetType)
  }
  return path.join(projectDir, ".opencode", assetType)
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Runtime Asset Discovery from node_modules

**What:** Having the plugin scan its own `node_modules` path at runtime to find assets.
**Why bad:** `node_modules` paths are fragile, vary by package manager, and break with hoisting. The postinstall copy pattern is standard in the OpenCode ecosystem (oh-my-opencode uses it).
**Instead:** Copy assets to standard filesystem locations during installation. Assets are then owned by the user and discovered by OpenCode natively.

### Anti-Pattern 2: Synthetic Message Injection for Asset Registration

**What:** Using `session.created` hooks to inject agent/skill definitions as synthetic messages.
**Why bad:** Wastes context window tokens on every session. Agents, skills, and commands are designed to be filesystem-based. Injection is a workaround for plugins that cannot write files (our plugin can and should).
**Instead:** Write files to disk. Let OpenCode discover them natively.

### Anti-Pattern 3: Monolithic Plugin Entry

**What:** Putting all tool definitions, templates, and installation logic in a single `index.ts`.
**Why bad:** Hard to test, hard to maintain, violates single responsibility.
**Instead:** Separate concerns: entry point registers tools, tools import templates, templates are pure functions.

### Anti-Pattern 4: LLM-Generated Frontmatter Without Validation

**What:** Relying on the LLM to produce correctly-formatted YAML frontmatter.
**Why bad:** LLMs frequently produce malformed YAML (wrong indentation, missing quotes, invalid field names). Validation errors surface only when OpenCode tries to load the file.
**Instead:** Use Zod schemas to validate inputs, then generate frontmatter programmatically with a known-correct serializer.

## Key Architectural Constraints

1. **Plugins cannot register agents/skills/commands programmatically.** There is no API like `registerAgent()`. The only mechanism is creating files on disk in the expected locations. This is a hard constraint from OpenCode's architecture.

2. **OpenCode watches the filesystem.** New files in `.opencode/agents/`, `.opencode/skills/`, and `.opencode/commands/` are discovered without restart. This makes the "create file on disk" approach viable for in-session creation.

3. **Bun is the runtime.** All filesystem operations should use Bun APIs (`Bun.write`, `Bun.file`). Node.js `fs` module works but Bun-native APIs are preferred.

4. **Skills have strict naming rules.** Name must match `^[a-z0-9]+(-[a-z0-9]+)*$`, be 1-64 chars, and match the containing directory name. The creation tools must enforce this.

5. **Agent frontmatter fields are typed.** `mode` must be one of `primary | subagent | all`. `model` must be `provider/model-id` format. `permission` is an object with tool-name keys. The creation tools should expose only the most useful subset.

## Suggested Build Order

Based on dependency analysis, components should be built in this order:

### Phase 1: Foundation (no dependencies)
1. **`utils/validation.ts`** -- Name validation, frontmatter field validation
2. **`utils/paths.ts`** -- Scope resolution (project vs global directory paths)
3. **`utils/frontmatter.ts`** -- YAML frontmatter generation from structured data

These are pure utility functions with no external dependencies. They can be built and tested in isolation.

### Phase 2: Templates (depends on Phase 1)
4. **`templates/agent-template.ts`** -- Agent markdown generation
5. **`templates/skill-template.ts`** -- Skill SKILL.md generation
6. **`templates/command-template.ts`** -- Command markdown generation

Templates import from utils. Pure functions: structured input in, markdown string out. Highly testable.

### Phase 3: Creation Tools (depends on Phases 1-2)
7. **`tools/create-agent.ts`** -- Zod schema + execute function
8. **`tools/create-skill.ts`** -- Zod schema + execute function (creates directory + SKILL.md)
9. **`tools/create-command.ts`** -- Zod schema + execute function

Tools compose validation, path resolution, and templates. They perform filesystem writes.

### Phase 4: Plugin Entry (depends on Phase 3)
10. **`index.ts`** -- Imports and registers all tools, exports plugin function

### Phase 5: Installer (depends on Phase 1)
11. **`installer.ts`** -- postinstall script that copies `assets/` to target directories

Can be built in parallel with Phases 2-4 since it only depends on path resolution.

### Phase 6: Curated Assets (independent, parallel with everything)
12. **Agent markdown files** -- Written by hand, validated by templates
13. **Skill SKILL.md files** -- Written by hand
14. **Command markdown files** -- Written by hand, including meta-commands

Assets have no code dependencies. They can be authored at any time, but are more useful after creation tools exist (to validate format consistency).

## Scalability Considerations

| Concern | At 5 assets | At 20 assets | At 50+ assets |
|---------|-------------|--------------|---------------|
| Installation time | Negligible | Negligible | ~1s file copy, still fine |
| Context window | No impact (filesystem-based) | No impact | No impact |
| Discoverability | Users remember names | Need good descriptions | Consider categories/namespaces |
| Maintenance | Manual review | Need lint/validate script | Need CI validation of frontmatter |

The filesystem-based architecture scales well. The main concern at scale is discoverability -- users need good `description` fields and possibly a `/list-agents` command.

## Sources

- [OpenCode Plugins Documentation](https://opencode.ai/docs/plugins/) -- Official plugin API reference (HIGH confidence)
- [OpenCode Agents Documentation](https://opencode.ai/docs/agents/) -- Agent frontmatter specification (HIGH confidence)
- [OpenCode Commands Documentation](https://opencode.ai/docs/commands/) -- Command format specification (HIGH confidence)
- [OpenCode Skills Documentation](https://opencode.ai/docs/skills/) -- Skill SKILL.md specification (HIGH confidence)
- [OpenCode Plugins Guide (Gist)](https://gist.github.com/johnlindquist/0adf1032b4e84942f3e1050aba3c5e4a) -- Comprehensive plugin patterns (MEDIUM confidence)
- [oh-my-opencode (GitHub)](https://github.com/opensoft/oh-my-opencode) -- Reference plugin with asset bundling pattern (MEDIUM confidence)
- [opencode-agent-skills (GitHub)](https://github.com/joshuadavidthomas/opencode-agent-skills) -- Skills loading architecture (MEDIUM confidence)
- [opencode-skillful (GitHub)](https://github.com/zenobi-us/opencode-skillful) -- Alternative skills plugin with lazy loading (MEDIUM confidence)
- [opencode-plugin-template (GitHub)](https://github.com/zenobi-us/opencode-plugin-template) -- Plugin project scaffold (MEDIUM confidence)
- [awesome-opencode (GitHub)](https://github.com/awesome-opencode/awesome-opencode) -- Plugin ecosystem catalog (MEDIUM confidence)
