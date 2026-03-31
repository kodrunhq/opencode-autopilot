# Phase 2: Creation Tooling - Research

**Researched:** 2026-03-31
**Domain:** OpenCode plugin tool development (in-session asset scaffolding)
**Confidence:** HIGH

## Summary

Phase 2 implements three plugin tools (`oc_create_agent`, `oc_create_skill`, `oc_create_command`) and three corresponding slash commands (`/new-agent`, `/new-skill`, `/new-command`) that scaffold new OpenCode extensions from within the TUI. Each tool accepts validated parameters via Zod schema, generates properly-formatted markdown with YAML frontmatter, and writes files to `~/.config/opencode/`.

The codebase from Phase 1 provides all necessary infrastructure: `tool()` factory with full Zod support (`tool.schema` is literally `typeof z`), `getGlobalConfigDir()` for path resolution, `ensureDir()` for directory creation, and `fileExists()` for no-clobber checks. The primary new work is: (1) Zod schemas for each tool's parameters, (2) YAML frontmatter generation, (3) name/path validation, and (4) three command markdown files that instruct the LLM to use the tools.

**Primary recommendation:** Re-add the `yaml` npm package (v2.7.x) as a runtime dependency for frontmatter generation. Template literals break on special characters in descriptions, nested permission objects, and multi-line values. Use `yaml.stringify()` for all frontmatter, concatenate with prompt body via template literal.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Full agent frontmatter field set: description (required), mode (default: subagent), model (optional), temperature (optional), permissions (default: strict read-only). Matches OpenCode's agent spec.
- **D-02:** Default mode is `subagent` -- most common use case, invoked via `@mention`.
- **D-03:** Prompt section is LLM-generated -- the tool generates a placeholder prompt with guidance comments. Phase 3's Metaprompter agent will provide intelligent prompt crafting.
- **D-04:** Tool validates agent name for filesystem safety and checks for existing files at the target path (never overwrite, per Phase 1 D-04).
- **D-05:** Strict name validation matching OpenCode's rules: 1-64 chars, lowercase alphanumeric with single hyphens, regex `^[a-z0-9]+(-[a-z0-9]+)*$`. Rejects names that don't conform.
- **D-06:** Creates skill directory + SKILL.md with YAML frontmatter (name, description, license, compatibility) and section scaffolding: `## What I do`, `## Rules`, `## Examples`.
- **D-07:** Directory name must match the skill name exactly.
- **D-08:** Full template generation: YAML frontmatter (description, agent, model -- all optional except description) + template body with `$ARGUMENTS` placeholder and usage guidance.
- **D-09:** Validates command names -- rejects names that would override OpenCode built-in commands (`init`, `undo`, `redo`, `share`, `help`). Also checks for illegal filesystem characters.
- **D-10:** Always write to global `~/.config/opencode/` (matching Phase 1 D-05). No per-creation scope parameter.
- **D-11:** All tools use `oc_` prefix: `oc_create_agent`, `oc_create_skill`, `oc_create_command`.
- **D-12:** All params in single tool call -- LLM gathers info conversationally, then calls the tool once with complete parameters.
- **D-13:** Never overwrite existing files (Phase 1 D-04).

### Claude's Discretion
- Exact Zod schema field structure for each tool (types, optionality, defaults)
- YAML generation approach (use `yaml` package or template literals)
- How to structure the `/new-agent`, `/new-skill`, `/new-command` commands that trigger the tools
- Whether to register commands as markdown files or just tools (commands instruct LLM to call the tool)
- Error message format for validation failures

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRTL-01 | `/new-agent` creates agent markdown with proper frontmatter, prompt, and tool permissions | Agent frontmatter spec verified (description, mode, model, temperature, top_p, steps, disable, color, hidden, permission); permission structure documented with ask/allow/deny values and glob patterns for bash/task |
| CRTL-02 | `/new-skill` creates skill directory + SKILL.md with proper frontmatter and structure | Skill spec verified (name 1-64 chars, regex `^[a-z0-9]+(-[a-z0-9]+)*$`, required name + description fields, optional license/compatibility/metadata); directory must match name |
| CRTL-03 | `/new-command` creates command markdown with template and description | Command spec verified (description, agent, model, subtask fields; $ARGUMENTS and $1/$2/$3 template variables; file name = command name) |
| CRTL-04 | Creation tools validate names and prevent path conflicts | Regex validation for skills, filesystem safety for agents/commands, `fileExists()` for no-clobber, built-in command list for collision detection |
| CRTL-05 | Creation tools support both project-local and global installation targets | **CONFLICT with D-10**: CONTEXT.md locks to global-only (`~/.config/opencode/`), but CRTL-05 requires both. Planner must reconcile -- recommend adding optional `scope` param or deferring project-local to a follow-up |

</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@opencode-ai/plugin` | ^1.3.8 | `tool()` factory + Zod (`tool.schema`) | Already installed. `tool.schema` IS `typeof z` -- full Zod API available |
| `node:fs/promises` | Built-in | `writeFile`, `access`, `mkdir` | Phase 1 pattern. Cross-runtime testable |
| `node:path` | Built-in | Path joining for agents/skills/commands dirs | Phase 1 pattern |
| `node:os` | Built-in | `homedir()` via `getGlobalConfigDir()` | Phase 1 pattern |

### New Dependency Required
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `yaml` | ^2.7.x (current: 2.8.3) | YAML frontmatter generation via `yaml.stringify()` | Handles special characters in descriptions, nested permission objects, multi-line values. Template literals break on these edge cases. Was listed in CLAUDE.md technology stack. Not currently installed -- removed in Phase 1 because unused at that point. |

**Installation:**
```bash
bun add yaml
```

**Version verification:** `npm view yaml version` returns 2.8.3 (2026-03-31). Use `^2.7.0` in package.json for compatibility.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `yaml` package | Template literals | Breaks on special chars in descriptions (quotes, colons), nested objects (permissions), multi-line values. Not worth the risk for a 45KB dependency. |
| `yaml` package | `js-yaml` | Older API, larger surface, `yaml` v2 is the modern successor with better TypeScript types. CLAUDE.md explicitly recommends `yaml` over `js-yaml`. |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── tools/
│   ├── placeholder.ts        # Existing
│   ├── create-agent.ts        # NEW: oc_create_agent tool
│   ├── create-skill.ts        # NEW: oc_create_skill tool
│   └── create-command.ts      # NEW: oc_create_command tool
├── utils/
│   ├── paths.ts               # Existing (getGlobalConfigDir)
│   ├── fs-helpers.ts          # Existing (ensureDir, fileExists)
│   └── validators.ts          # NEW: shared name validation, filesystem safety
├── templates/
│   ├── agent-template.ts      # NEW: agent markdown generation
│   ├── skill-template.ts      # NEW: skill SKILL.md generation
│   └── command-template.ts    # NEW: command markdown generation
├── config.ts                  # Existing
├── installer.ts               # Existing
└── index.ts                   # Existing (register new tools here)
assets/
├── commands/
│   ├── configure.md           # Existing
│   ├── new-agent.md           # NEW: /new-agent command
│   ├── new-skill.md           # NEW: /new-skill command
│   └── new-command.md         # NEW: /new-command command
```

### Pattern 1: Tool Registration (from Phase 1)
**What:** Each tool is a separate file exporting a `tool()` call. Registered in `src/index.ts` under the `tool: {}` object.
**When to use:** Every new tool.
**Example:**
```typescript
// src/tools/create-agent.ts
import { tool } from "@opencode-ai/plugin";

export const ocCreateAgent = tool({
  description: "Creates a new OpenCode agent markdown file with proper frontmatter and placeholder prompt",
  args: {
    name: tool.schema.string().min(1).max(100)
      .describe("Agent name (used as filename, e.g. 'code-reviewer' creates code-reviewer.md)"),
    description: tool.schema.string().min(1).max(500)
      .describe("Brief description of what the agent does"),
    mode: tool.schema.enum(["primary", "subagent", "all"]).default("subagent")
      .describe("Agent mode: 'subagent' (invoked via @mention), 'primary' (main agent), 'all' (both)"),
    // ... more args
  },
  async execute(args, ctx) {
    // validate, generate, write, return result string
  },
});
```

```typescript
// src/index.ts -- registration
import { ocCreateAgent } from "./tools/create-agent";
import { ocCreateSkill } from "./tools/create-skill";
import { ocCreateCommand } from "./tools/create-command";

return {
  tool: {
    oc_placeholder: ocPlaceholder,
    oc_create_agent: ocCreateAgent,
    oc_create_skill: ocCreateSkill,
    oc_create_command: ocCreateCommand,
  },
  // ...
};
```

### Pattern 2: Template Generation (separation of concerns)
**What:** Separate template generation (pure functions returning strings) from tool execution (validation + filesystem + error handling). Templates live in `src/templates/`, tools in `src/tools/`.
**When to use:** All three creation tools.
**Why:** Pure template functions are trivially testable (input -> string output). Tool execute functions handle side effects.
**Example:**
```typescript
// src/templates/agent-template.ts
import { stringify } from "yaml";

export interface AgentTemplateInput {
  readonly name: string;
  readonly description: string;
  readonly mode: "primary" | "subagent" | "all";
  readonly model?: string;
  readonly temperature?: number;
  readonly permission: Record<string, string>;
}

export function generateAgentMarkdown(input: AgentTemplateInput): string {
  const frontmatter: Record<string, unknown> = {
    description: input.description,
    mode: input.mode,
  };
  if (input.model) frontmatter.model = input.model;
  if (input.temperature !== undefined) frontmatter.temperature = input.temperature;
  frontmatter.permission = input.permission;

  return `---
${stringify(frontmatter).trim()}
---
You are ${input.name}, an AI agent.

<!-- TODO: Replace this placeholder prompt with specific instructions for your agent. -->
<!-- Consider: What is this agent's specialty? What tools should it use? What should it avoid? -->

## Role

Describe your agent's primary role and expertise here.

## Instructions

1. Add specific behavioral instructions
2. Define constraints and guardrails
3. Specify output format preferences
`;
}
```

### Pattern 3: Command Markdown Files (trigger tool via LLM instruction)
**What:** Slash commands are markdown files in `assets/commands/` that instruct the LLM to call the corresponding tool. The command is a prompt, not code.
**When to use:** `/new-agent`, `/new-skill`, `/new-command`.
**Example:**
```markdown
---
description: Create a new OpenCode agent from within this session
---
The user wants to create a new agent. Gather the following information conversationally:

1. **Name** (required): A short, descriptive name for the agent (e.g., "code-reviewer", "planner")
2. **Description** (required): What the agent does in one sentence
3. **Mode** (optional, default: subagent): "subagent" (invoked via @mention), "primary" (main agent), or "all"
4. **Model** (optional): Specific model to use (e.g., "anthropic/claude-sonnet-4-20250514")
5. **Temperature** (optional): 0.0-1.0, lower = more focused
6. **Permissions** (optional, default: read-only): Which tools the agent can use

Once you have the required information, call the `oc_create_agent` tool with all parameters.

$ARGUMENTS
```

### Pattern 4: Error Accumulation (from Phase 1)
**What:** Collect validation errors into an array, return all at once rather than throwing on first error.
**When to use:** Tool execute functions that validate multiple inputs.

### Anti-Patterns to Avoid
- **Interactive wizard pattern:** OpenCode tools receive all args at once. Do not try to simulate multi-step prompts within a tool. Let the LLM gather info conversationally before calling the tool.
- **Mutating args object:** Create new objects from validated inputs. Never modify the incoming args.
- **Hardcoding model names in generated agents:** Omit the `model` field from generated frontmatter unless the user explicitly provides one. This preserves model agnosticism.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML serialization | String concatenation for frontmatter | `yaml.stringify()` | Special chars (colons, quotes, hashes), nested objects (permissions), multi-line strings all break naive concatenation |
| Name validation regex | Custom char-by-char validation | Single regex `^[a-z0-9]+(-[a-z0-9]+)*$` + length check | OpenCode's own validation uses this regex. Match it exactly. |
| File existence check | Custom stat + catch | `fileExists()` from `src/utils/fs-helpers.ts` | Already handles ENOENT correctly |
| Directory creation | Manual recursive mkdir | `ensureDir()` from `src/utils/fs-helpers.ts` | Already wraps `mkdir({ recursive: true })` |
| Global config path | Hardcoded `~/.config/opencode/` | `getGlobalConfigDir()` from `src/utils/paths.ts` | Single source of truth, already tested |

**Key insight:** Phase 1 built the filesystem utilities. Phase 2 reuses them -- the only new infrastructure is validation logic and template generation.

## Common Pitfalls

### Pitfall 1: SKILL.md Capitalization
**What goes wrong:** Writing `skill.md` or `Skill.md` instead of `SKILL.md`. On Linux (case-sensitive), OpenCode will not discover the skill.
**Why it happens:** Easy typo in template code.
**How to avoid:** Hardcode `"SKILL.md"` as a constant. Never derive it from user input.
**Warning signs:** Skill works on macOS but not Linux.

### Pitfall 2: Skill Directory Name Mismatch
**What goes wrong:** Skill directory name does not match the `name` field in SKILL.md frontmatter. OpenCode requires exact match.
**Why it happens:** User provides a display name with spaces/caps, code slugifies it differently for directory vs frontmatter.
**How to avoid:** Use the validated name for both the directory AND the frontmatter `name` field. Single source of truth.
**Warning signs:** Skill appears in filesystem but not in `/skill` command output.

### Pitfall 3: Command Name Collides with Built-in
**What goes wrong:** User creates a command named `help.md` or `init.md`, overriding OpenCode's built-in commands.
**Why it happens:** OpenCode gives custom commands precedence over built-ins with the same name.
**How to avoid:** Validate against the known built-in list: `init`, `undo`, `redo`, `share`, `help`, `config`, `compact`, `clear`, `cost`, `login`, `logout`, `bug`. Reject with clear error message.
**Warning signs:** Core TUI functionality stops working after asset creation.

### Pitfall 4: No Hot Reload After Creation
**What goes wrong:** User creates an agent via the tool, immediately tries `@agent-name`, and it does not exist.
**Why it happens:** OpenCode discovers assets at startup, not during a session. No filesystem watcher triggers re-indexing.
**How to avoid:** Every tool's success message MUST include restart instructions: "Agent 'code-reviewer' created at ~/.config/opencode/agents/code-reviewer.md. Restart OpenCode to use it with @code-reviewer."
**Warning signs:** User reports "creation succeeded but agent not found."

### Pitfall 5: Permission Object Serialization
**What goes wrong:** YAML serialization of the permission object produces invalid format. OpenCode expects specific structure with `ask`/`allow`/`deny` string values.
**Why it happens:** Template literals or naive serialization produce incorrect nesting.
**How to avoid:** Use `yaml.stringify()` which handles nested objects correctly. Test with all permission combinations.
**Warning signs:** Agent loads but permission settings are ignored or cause parse errors.

### Pitfall 6: CRTL-05 vs D-10 Conflict
**What goes wrong:** CRTL-05 requires both project-local and global targets, but D-10 locks to global-only.
**Why it happens:** Requirements were defined before discussion narrowed scope.
**How to avoid:** Planner must decide: (a) add optional `scope` parameter to satisfy CRTL-05, (b) mark CRTL-05 as partially satisfied (global only in Phase 2), or (c) revisit with user.
**Warning signs:** Requirement marked incomplete at verification.

## Code Examples

### YAML Frontmatter Generation with `yaml` Package
```typescript
// Source: yaml npm package docs + OpenCode agent spec
import { stringify } from "yaml";

const frontmatter = {
  description: "Reviews code for quality, security, and patterns",
  mode: "subagent",
  permission: {
    read: "allow",
    edit: "deny",
    bash: "deny",
    webfetch: "deny",
    task: "deny",
  },
};

const markdown = `---\n${stringify(frontmatter).trim()}\n---\n\nYour prompt here.\n`;
```

### Verified Agent Frontmatter (from OpenCode docs)
```yaml
---
description: A placeholder agent
mode: all              # "primary" | "subagent" | "all"
model: provider/model  # optional -- omit for model agnosticism
temperature: 0.3       # optional, 0.0-1.0
top_p: 0.9             # optional, 0.0-1.0
steps: 10              # optional, max agentic iterations
disable: false          # optional
color: "#FF5733"        # optional, hex or theme name
hidden: false           # optional, hides from @autocomplete (subagents only)
permission:
  read: allow           # "ask" | "allow" | "deny"
  edit: deny
  bash: deny
  webfetch: deny
  task: deny
---
```

### Verified Skill SKILL.md (from OpenCode docs)
```yaml
---
name: my-skill-name    # required, 1-64 chars, ^[a-z0-9]+(-[a-z0-9]+)*$
description: Brief description of what this skill provides  # required, 1-1024 chars
license: MIT           # optional
compatibility: opencode  # optional
metadata:              # optional, string-to-string map
  version: "1.0"
---
```

### Verified Command Format (from OpenCode docs)
```markdown
---
description: Brief command description
agent: agent-name       # optional
model: provider/model   # optional
subtask: true           # optional
---
Template body with $ARGUMENTS placeholder.

Individual args via $1, $2, $3.
Shell output via !`command`.
File content via @filename.
```

### Name Validation Function
```typescript
// Shared validation for skill names, reusable for agent/command filesystem safety
const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_SKILL_NAME_LENGTH = 64;

const BUILT_IN_COMMANDS = new Set([
  "init", "undo", "redo", "share", "help",
  "config", "compact", "clear", "cost",
  "login", "logout", "bug",
]);

export function validateSkillName(name: string): { valid: boolean; error?: string } {
  if (name.length === 0 || name.length > MAX_SKILL_NAME_LENGTH) {
    return {
      valid: false,
      error: `Skill name must be 1-${MAX_SKILL_NAME_LENGTH} characters. Got ${name.length}.`,
    };
  }
  if (!SKILL_NAME_REGEX.test(name)) {
    return {
      valid: false,
      error: `Skill name '${name}' is invalid. Names must be lowercase alphanumeric with hyphens (e.g., 'my-skill'). No leading/trailing hyphens or consecutive hyphens.`,
    };
  }
  return { valid: true };
}

export function validateCommandName(name: string): { valid: boolean; error?: string } {
  if (BUILT_IN_COMMANDS.has(name)) {
    return {
      valid: false,
      error: `Command name '${name}' conflicts with a built-in OpenCode command. Choose a different name.`,
    };
  }
  // Also check for filesystem-unsafe characters
  if (/[<>:"/\\|?*\x00-\x1f]/.test(name)) {
    return {
      valid: false,
      error: `Command name '${name}' contains characters not safe for filenames.`,
    };
  }
  return { valid: true };
}
```

### Tool Context Mock (for tests)
```typescript
// Source: @opencode-ai/plugin dist/tool.d.ts -- ToolContext type
const mockContext = {
  sessionID: "test-session",
  messageID: "test-message",
  agent: "test-agent",
  directory: "/tmp/test-project",
  worktree: "/tmp/test-project",
  abort: new AbortController().signal,
  metadata: () => {},
  ask: async () => {},
};
```

## Tool Schema API Reference

**Critical finding:** `tool.schema` is `typeof z` -- it is the FULL Zod library re-exported. This means all Zod methods are available, not just a subset.

Confirmed available via type definition (`node_modules/@opencode-ai/plugin/dist/tool.d.ts` line 43: `var schema: typeof z`):

| Method | Use Case |
|--------|----------|
| `tool.schema.string()` | Text fields (name, description) |
| `tool.schema.number()` | Temperature (with `.min(0).max(1)`) |
| `tool.schema.boolean()` | Flags |
| `tool.schema.enum(["a","b","c"])` | Mode selection, permission levels |
| `.optional()` | Non-required fields |
| `.default(value)` | Default values (mode defaults to "subagent") |
| `.describe("text")` | Field descriptions visible to LLM |
| `.min(n)` / `.max(n)` | Length/value constraints |
| `tool.schema.object({})` | Nested objects (permission structure) |
| `tool.schema.record(key, val)` | Key-value maps |

**Confidence:** HIGH -- verified from actual type definitions in installed package.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `opencode agent create` CLI wizard | Plugin tools with Zod schemas | This phase | Users stay in TUI instead of switching to CLI |
| Manual file creation | Automated scaffolding via `/new-*` commands | This phase | Eliminates format errors, validates names |
| `tools` permission field | `permission` field (tools is deprecated) | OpenCode pre-1.3 | Must use `permission` not `tools` in generated frontmatter |

## Open Questions

1. **CRTL-05 vs D-10 Conflict**
   - What we know: CRTL-05 requires both local and global targets; D-10 locks to global only
   - What's unclear: Whether user intended to defer local scope or forgot the requirement
   - Recommendation: Implement global-only per D-10, add `scope` param as optional enhancement if time permits. Flag in plan as partial requirement coverage.

2. **Complete list of built-in commands**
   - What we know: Docs list `init`, `undo`, `redo`, `share`, `help`. CONTEXT.md also mentions these five.
   - What's unclear: Whether other built-in commands exist (e.g., `config`, `compact`, `clear`, `cost`, `login`, `logout`, `bug` are visible in TUI but may not be "commands" in the markdown sense)
   - Recommendation: Block the 5 documented ones plus any additional ones discoverable via OpenCode's source. Use a `Set` for easy extension.

3. **Agent name validation strictness**
   - What we know: Skill names have strict regex. Agent filenames just need to be filesystem-safe.
   - What's unclear: Whether OpenCode validates agent filenames with any regex or just uses the filename as-is
   - Recommendation: Apply the same skill name regex to agent names for consistency and safety. The regex already ensures filesystem safety.

## Project Constraints (from CLAUDE.md)

- **Runtime:** Must work with Bun (OpenCode's JS runtime for plugins)
- **Plugin format:** Must follow OpenCode's plugin spec (`@opencode-ai/plugin` types)
- **File conventions:** Agents, skills, commands must follow OpenCode's filesystem conventions exactly
- **No external dependencies:** Creation tooling should work offline, no API calls needed for scaffolding
- **Model agnostic:** Agents should work with any provider configured in OpenCode
- **Immutability:** Always create new objects, never mutate existing ones
- **File organization:** Many small files > few large files; 200-400 lines typical, 800 max
- **Error handling:** Handle errors explicitly, provide user-friendly messages
- **Input validation:** Validate at system boundaries, use Zod
- **Testing:** bun:test, Jest-compatible, zero config
- **Linting/formatting:** Biome 2.x with tabs, 100 char line width
- **YAML:** Use `yaml` package (not `js-yaml`, not gray-matter, not template engines)
- **No `@opencode-ai/sdk`:** Plugins run inside OpenCode, get `ctx.client` injected
- **No standalone Zod install:** Use `tool.schema` which IS Zod

## Sources

### Primary (HIGH confidence)
- `node_modules/@opencode-ai/plugin/dist/tool.d.ts` -- Verified `tool.schema` is `typeof z`, full Zod API
- `node_modules/@opencode-ai/plugin/dist/index.d.ts` -- Plugin type, Hooks interface, ToolContext
- https://opencode.ai/docs/agents/ -- Agent frontmatter fields: description, mode, model, temperature, top_p, steps, disable, color, hidden, permission
- https://opencode.ai/docs/skills/ -- SKILL.md spec: name regex, description length, directory matching, discovery paths
- https://opencode.ai/docs/commands/ -- Command format: description, agent, model, subtask fields; $ARGUMENTS/$1/$2/$3 template vars
- https://opencode.ai/docs/plugins/ -- Tool registration API, plugin precedence over built-ins
- Existing codebase: `src/tools/placeholder.ts`, `src/utils/paths.ts`, `src/utils/fs-helpers.ts`, `src/index.ts`

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` -- Skill path issues, name collisions, no hot reload, command shadowing
- `.planning/research/FEATURES.md` -- Feature priorities, anti-features (no wizard UX)
- npm registry: `yaml` v2.8.3 current

### Tertiary (LOW confidence)
- Built-in command list beyond the 5 documented ones -- needs validation against OpenCode source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified from installed packages and npm registry
- Architecture: HIGH -- follows established Phase 1 patterns exactly
- Pitfalls: HIGH -- documented in prior research with GitHub issue references
- Tool schema API: HIGH -- verified from actual TypeScript type definitions

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable domain, OpenCode plugin API is not changing rapidly)
