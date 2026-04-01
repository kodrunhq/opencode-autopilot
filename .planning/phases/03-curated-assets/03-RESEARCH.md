# Phase 3: Curated Assets - Research

**Researched:** 2026-03-31
**Domain:** OpenCode plugin config hook, agent injection, skill/command authoring
**Confidence:** HIGH

## Summary

Phase 3 adds 4 subagents (researcher, metaprompter, documenter, pr-reviewer) injected via the OpenCode `config` plugin hook, plus a file-based coding-standards skill and a `/review-pr` command. The config hook is a first-class plugin hook in the `@opencode-ai/plugin` SDK with signature `config?: (input: Config) => Promise<void>`, where `Config.agent` is a mutable `Record<string, AgentConfig | undefined>`. Agents are added by assigning keys on `input.agent`. The skill and command are file-based assets installed by the existing Phase 1 installer.

The `AgentConfig` type from `@opencode-ai/sdk` is fully documented in the installed SDK types. It supports `mode`, `description`, `prompt`, `model`, `temperature`, `top_p`, `color`, `maxSteps`, `disable`, and a `permission` object with `edit`, `bash`, `webfetch`, `doom_loop`, and `external_directory` fields. Notably, the programmatic `AgentConfig.permission` does NOT have `read`, `write`, or `task` fields -- only `edit`, `bash`, `webfetch`, `doom_loop`, and `external_directory`. This differs from the markdown frontmatter format. The markdown format has `read`/`task` but those are processed differently by the YAML parser.

**Primary recommendation:** Define each agent as a typed `AgentConfig` object in `src/agents/<name>.ts`, create a `src/agents/index.ts` barrel that exports all agents, and wire a `config` hook in `src/index.ts` that spreads them onto `input.agent`. The skill and command go into `assets/` for the existing installer.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** All 4 curated agents are injected via the `config` plugin hook, NOT as markdown files. The hook receives the full OpenCode config as a mutable object and adds agents to `config.agent`.
- **D-02:** Each agent is defined in its own module under `src/agents/` (e.g., `src/agents/researcher.ts`). Each exports an agent config object. The config hook handler imports all agents and injects them.
- **D-03:** Do NOT touch Build/Plan built-in agents. Our agents are subagents alongside them. No demotion, no override, no `hidden: true` on built-ins.
- **D-04:** All agents use `mode: "subagent"` -- callable via `@researcher`, `@metaprompter`, `@documenter`, `@pr-reviewer`. Never appear in Tab cycle.
- **D-05:** Production-ready prompts -- detailed role, instructions, constraints, output format. Ready to use out of the box, no customization needed.
- **D-06:** Prompts explicitly reference available tools and skills (e.g., "use webfetch to search the web", "reference the coding-standards skill for conventions").
- **D-07:** Researcher -- Read + Web + Write. Can read code, fetch web pages, and write markdown report files. No edit, no bash.
- **D-08:** Metaprompter -- Read + Write. Can read existing agents/skills to understand patterns, write new asset files. No edit, no bash, no web.
- **D-09:** Documenter -- Read + Write + Edit. Can read code and write/edit documentation files. No bash, no web.
- **D-10:** PR Reviewer -- Read + Bash. Can read code and run git/gh commands for diff and PR info. No write, no edit, no web.
- **D-11:** Universal best practices + modularity & abstraction focus. Language-agnostic principles (naming, file size, function size, error handling, immutability, separation of concerns, DRY, single responsibility).
- **D-12:** Opinionated tone -- clear "DO this, DON'T do that" rules. The LLM follows without ambiguity.
- **D-13:** Installed as a file-based skill via Phase 1 installer. Located in `assets/skills/coding-standards/SKILL.md`.
- **D-14:** File-based command in `assets/commands/review-pr.md`. Instructs the LLM to invoke the `@pr-reviewer` agent with the PR number from `$ARGUMENTS`.

### Claude's Discretion
- Exact prompt content for each agent (within the production-ready, tool-aware constraints)
- How to structure the config hook handler (single function or helper utilities)
- Agent config type structure matching OpenCode's expected schema
- Whether agents need `temperature` settings
- Coding standards skill: exact rules and examples

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGNT-01 | Researcher agent that searches the web thoroughly about a topic and produces a clear, comprehensive report with sources | AgentConfig schema verified. Permission mapping: `webfetch: "allow"`, `edit: "deny"`, `bash: "deny"`. Prompt must reference webfetch tool and write tool for reports. |
| AGNT-02 | Metaprompter agent that crafts high-quality prompts, system instructions, and configurations for new agents, skills, and commands | AgentConfig schema verified. Permission mapping: `edit: "deny"`, `bash: "deny"`, `webfetch: "deny"`. Prompt must explain asset formats (YAML frontmatter patterns). |
| AGNT-03 | Documenter agent that creates documentation, READMEs, SVGs, diagrams, GitHub badges, quickstarts, and wikis | AgentConfig schema verified. Permission mapping: `edit: "allow"`, `bash: "deny"`, `webfetch: "deny"`. |
| AGNT-04 | PR Reviewer agent that reviews pull requests with structured feedback on code quality, security, and patterns | AgentConfig schema verified. Permission mapping: `bash: "allow"`, `edit: "deny"`, `webfetch: "deny"`. Bash needed for `git diff`, `gh pr view`. |
| CMND-01 | `/review-pr` command that reviews a GitHub PR with structured, actionable feedback | Command markdown format verified: frontmatter with `description` + `agent` field, body with `$ARGUMENTS` placeholder. |
| SKLL-01 | Coding standards skill with style, patterns, and naming conventions the LLM can reference | SKILL.md format verified: requires `name` and `description` in frontmatter, placed in `assets/skills/coding-standards/SKILL.md`. |
</phase_requirements>

## Standard Stack

No new dependencies required for Phase 3. All work uses the existing stack.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@opencode-ai/plugin` | ^1.3.8 | Plugin types, `Config`, `AgentConfig` | Provides the `Hooks.config` hook type and `AgentConfig` type. Already installed. |
| TypeScript | 5.8.x | Type-safe agent config definitions | `AgentConfig` type from SDK gives compile-time validation of agent configs. |
| `bun:test` | Built-in | Testing agent config objects and hook handler | Existing test patterns in `tests/` directory. |

### No New Dependencies
Phase 3 requires zero new packages. Agent configs are TypeScript objects. The skill and command are markdown files. The installer from Phase 1 handles file-based assets.

## Architecture Patterns

### Recommended Project Structure
```
src/
  agents/
    index.ts            # barrel export + createConfigHook() function
    researcher.ts       # exports AgentConfig for researcher
    metaprompter.ts     # exports AgentConfig for metaprompter
    documenter.ts       # exports AgentConfig for documenter
    pr-reviewer.ts      # exports AgentConfig for pr-reviewer
  index.ts              # modified to include config hook
assets/
  skills/
    coding-standards/
      SKILL.md          # coding standards skill
  commands/
    review-pr.md        # /review-pr command
tests/
  agents/
    researcher.test.ts
    metaprompter.test.ts
    documenter.test.ts
    pr-reviewer.test.ts
    index.test.ts       # config hook handler tests
```

### Pattern 1: Agent Config Module
**What:** Each agent is a module exporting a named `AgentConfig` object.
**When to use:** For all 4 agents.
**Example:**
```typescript
// src/agents/researcher.ts
// Source: @opencode-ai/sdk AgentConfig type from node_modules
import type { AgentConfig } from "@opencode-ai/sdk";

export const researcherAgent: AgentConfig = {
  description: "Searches the web about a topic and produces a comprehensive report with sources",
  mode: "subagent",
  prompt: `You are a research specialist...`, // full prompt here
  permission: {
    webfetch: "allow",
    edit: "deny",
    bash: "deny",
  },
};
```

### Pattern 2: Config Hook Handler
**What:** A function that takes the mutable Config object and assigns agents.
**When to use:** In the plugin entry point.
**Example:**
```typescript
// src/agents/index.ts
import type { Config } from "@opencode-ai/plugin";
import { researcherAgent } from "./researcher";
import { metaprompterAgent } from "./metaprompter";
import { documenterAgent } from "./documenter";
import { prReviewerAgent } from "./pr-reviewer";

const agents = {
  researcher: researcherAgent,
  metaprompter: metaprompterAgent,
  documenter: documenterAgent,
  "pr-reviewer": prReviewerAgent,
} as const;

export async function configHook(config: Config): Promise<void> {
  if (!config.agent) {
    config.agent = {};
  }
  for (const [name, agentConfig] of Object.entries(agents)) {
    config.agent[name] = agentConfig;
  }
}
```

### Pattern 3: Plugin Entry Integration
**What:** Adding the config hook to the existing plugin return object.
**When to use:** In `src/index.ts`.
**Example:**
```typescript
// src/index.ts (modified)
import { configHook } from "./agents";

const plugin: Plugin = async (_input) => {
  // ... existing install + config logic ...
  return {
    tool: { oc_placeholder: ocPlaceholder },
    event: async ({ event }) => { /* ... */ },
    config: configHook,
  };
};
```

### Pattern 4: Command Markdown with Agent Delegation
**What:** A command file that delegates to an agent via the `agent` frontmatter field.
**When to use:** For `/review-pr`.
**Example:**
```markdown
---
description: Review a GitHub PR with structured, actionable feedback
agent: pr-reviewer
---
Review PR $ARGUMENTS. Analyze the diff, check for code quality issues,
security concerns, and adherence to coding standards.
Provide structured feedback with severity levels.
```

### Pattern 5: SKILL.md Format
**What:** A skill file with frontmatter and markdown body.
**When to use:** For coding-standards skill.
**Example:**
```markdown
---
name: coding-standards
description: Universal coding standards and best practices for code review and generation
---
# Coding Standards

## Naming Conventions
- Use descriptive, intention-revealing names
...
```

### Anti-Patterns to Avoid
- **Overriding built-in agents:** Never set `config.agent.build` or `config.agent.plan`. D-03 explicitly forbids this.
- **Using markdown files for config-hook agents:** The 4 agents use the config hook, NOT file-based installation. Do not put agent `.md` files in `assets/agents/` for these 4.
- **Mutating the config object with spread:** The config hook receives a mutable object. Assign directly to `config.agent[name]`, do not try to replace the entire `config.agent` with a new object (would break references).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent config schema | Custom type definitions | `AgentConfig` from `@opencode-ai/sdk` | The SDK type is the source of truth. Custom types will drift. |
| Skill installation | Manual file copy logic | Existing `installAssets()` in `src/installer.ts` | Already handles skills directory with subdirectory structure. |
| Command installation | Manual file copy logic | Existing `installAssets()` in `src/installer.ts` | Already handles commands directory. |
| YAML frontmatter for skill/command | Template engine | String literal in markdown file | These are static files shipped in `assets/`. No generation needed. |

**Key insight:** Phase 3 is mostly content (prompts, skill rules, command text) and a thin config hook wiring layer. The infrastructure from Phase 1 handles file-based assets. The SDK provides all types. Implementation effort is in writing quality prompts and skill content.

## Common Pitfalls

### Pitfall 1: Permission Field Mismatch Between Markdown and Config
**What goes wrong:** Using `read: "allow"` or `task: "deny"` in the programmatic `AgentConfig.permission` object. These fields exist in markdown frontmatter but NOT in the SDK's `AgentConfig.permission` type.
**Why it happens:** The markdown agent format supports `read`, `write`, `task` permissions. The SDK type only has `edit`, `bash`, `webfetch`, `doom_loop`, `external_directory`.
**How to avoid:** Use only the fields from the `AgentConfig` type: `edit`, `bash`, `webfetch`, `doom_loop`, `external_directory`. The "read" capability appears to be always available. "Write" is controlled by leaving `edit` as `"deny"` -- write-only access may work via tool-level permissions rather than agent-level.
**Warning signs:** TypeScript compilation errors on the `permission` object (if strict typing is used). If using `[key: string]: unknown` index signature, errors are silently accepted.

### Pitfall 2: Overwriting User Agent Customizations
**What goes wrong:** If the user has customized an agent with the same name in their `opencode.json`, the plugin's config hook could overwrite their settings.
**Why it happens:** The config hook fires after OpenCode loads config from disk. Assigning `config.agent["researcher"] = researcherAgent` replaces any user customization.
**How to avoid:** Before assigning, check if the key already exists. If it does, merge carefully or skip (preserving user's model/permission overrides). A simple approach: only set the key if `config.agent[name]` is `undefined`.
**Warning signs:** User complains their model override doesn't take effect.

### Pitfall 3: Agent Naming Conflicts
**What goes wrong:** Using common names like "researcher" or "documenter" that another plugin also uses.
**Why it happens:** No namespace enforcement in the agent registry.
**How to avoid:** Accept the risk -- the names are descriptive and match `@researcher` invocation UX. If conflicts arise, users can disable one plugin. Do NOT prefix with `oc_` -- that convention is for tools, not agents.
**Warning signs:** Two agents with the same name; last-write-wins behavior.

### Pitfall 4: Prompt References to Non-Existent Skills
**What goes wrong:** Agent prompt says "reference the coding-standards skill" but the skill hasn't been installed yet (installer hasn't run, or skill file is missing).
**Why it happens:** The config hook and the installer are independent operations. The agent is available immediately; the skill is available only after file installation.
**How to avoid:** Both operations happen in `src/index.ts` during plugin load. The installer runs first (current code), then the config hook fires. As long as both are in the same plugin load cycle, the skill will be installed by the time the agent is invoked (agents are invoked later, during user interaction).
**Warning signs:** Agent mentions a skill but `skill({ name: "coding-standards" })` returns nothing.

### Pitfall 5: Config Hook Mutation Pattern
**What goes wrong:** Treating the config hook input as immutable -- creating a new object instead of mutating in place.
**Why it happens:** Immutability is a general best practice, but the config hook explicitly expects mutation. The return type is `Promise<void>`, not `Promise<Config>`.
**How to avoid:** Mutate `input.agent` directly. This is the ONE place where mutation is correct by design.
**Warning signs:** Agents don't appear in OpenCode despite the hook running.

## Code Examples

### Complete AgentConfig Type (from SDK)
```typescript
// Source: node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts line 835
export type AgentConfig = {
    model?: string;
    temperature?: number;
    top_p?: number;
    prompt?: string;
    tools?: { [key: string]: boolean };
    disable?: boolean;
    description?: string;
    mode?: "subagent" | "primary" | "all";
    color?: string;
    maxSteps?: number;
    permission?: {
        edit?: "ask" | "allow" | "deny";
        bash?: ("ask" | "allow" | "deny") | { [key: string]: "ask" | "allow" | "deny" };
        webfetch?: "ask" | "allow" | "deny";
        doom_loop?: "ask" | "allow" | "deny";
        external_directory?: "ask" | "allow" | "deny";
    };
    [key: string]: unknown; // allows extra fields
};
```

### Config Hook Signature (from SDK)
```typescript
// Source: node_modules/@opencode-ai/plugin/dist/index.d.ts line 138
export interface Hooks {
    config?: (input: Config) => Promise<void>;
    // ... other hooks
}
```

### Config.agent Shape (from SDK)
```typescript
// Source: node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts line 1112
agent?: {
    plan?: AgentConfig;
    build?: AgentConfig;
    general?: AgentConfig;
    explore?: AgentConfig;
    [key: string]: AgentConfig | undefined;
};
```

### Permission Mapping for CONTEXT.md Decisions

The CONTEXT.md decisions use "Read + Web + Write" language, which must be translated to `AgentConfig.permission` fields:

| CONTEXT Decision | `edit` | `bash` | `webfetch` | Notes |
|-----------------|--------|--------|------------|-------|
| D-07 Researcher: Read + Web + Write | `"deny"` | `"deny"` | `"allow"` | "Write" means file creation via tools, not `edit`. "Read" is implicit (always available). |
| D-08 Metaprompter: Read + Write | `"deny"` | `"deny"` | `"deny"` | Write via tools. No edit, bash, or web. |
| D-09 Documenter: Read + Write + Edit | `"allow"` | `"deny"` | `"deny"` | Edit explicitly allowed for modifying existing docs. |
| D-10 PR Reviewer: Read + Bash | `"deny"` | `"allow"` | `"deny"` | Bash for git/gh commands. No write, edit, or web. |

**Critical finding:** The `AgentConfig.permission` type has no `read` or `write` fields. "Read" appears to be always available to all agents. "Write" (file creation) is likely controlled at the tool level, not the agent permission level. The `edit` permission controls modifying existing files. This means:
- Researcher and Metaprompter can write new files but not edit existing ones (`edit: "deny"`).
- Documenter can both write and edit (`edit: "allow"`).
- PR Reviewer can neither write nor edit (`edit: "deny"`).

### Command File with Agent Delegation
```markdown
---
description: Review a GitHub PR with structured, actionable feedback
agent: pr-reviewer
---
Review the pull request specified by $ARGUMENTS.

Analyze the diff for:
- Code quality and readability
- Security vulnerabilities
- Performance concerns
- Adherence to coding standards

Provide structured feedback with severity levels (CRITICAL, HIGH, MEDIUM, LOW).
```

### SKILL.md Structure
```markdown
---
name: coding-standards
description: Universal coding standards and best practices that the LLM references during code review and generation. Covers naming, file organization, error handling, immutability, and separation of concerns.
---

# Coding Standards

[Body content with rules, examples, do/don't patterns]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Agents as markdown files only | Config hook injection (programmatic) | OpenCode v1.3.x (2026) | Plugins can define agents without touching the filesystem. Config hook agents coexist with file-based agents. |
| `mode` field in `mode` key | `agent` key replaces deprecated `mode` key | OpenCode v1.3.x | `Config.mode` is deprecated. Use `Config.agent`. Both still work. |

## Open Questions

1. **Write permission for Researcher/Metaprompter**
   - What we know: `AgentConfig.permission` has no `write` field. The `edit` field controls file modification. There is no explicit "create new file" permission.
   - What's unclear: How do agents that should write new files but not edit existing files get that permission? Is file creation always allowed when `edit` is denied? Or does `edit: "deny"` also block file creation?
   - Recommendation: Set `edit: "deny"` for Researcher and Metaprompter. If testing shows they cannot create files, escalate to `edit: "ask"`. The oh-my-opencode agents likely face the same issue and their community has established the pattern.

2. **Bash permission granularity for PR Reviewer**
   - What we know: `bash` permission supports glob patterns as an object: `{ "git *": "allow", "gh *": "allow" }`.
   - What's unclear: Whether restricting to only git/gh commands is worth the added complexity vs. simply `bash: "allow"`.
   - Recommendation: Start with `bash: "allow"` for simplicity. The PR reviewer's prompt constrains its behavior. If security concerns arise, tighten to `{ "git *": "allow", "gh *": "allow" }`.

3. **Model configuration for agents**
   - What we know: `AgentConfig.model` is optional. If unset, agents inherit the session's default model. The plugin has a `config.ts` with model mappings.
   - What's unclear: Should we read from `opencode-autopilot.json` model mappings and inject them into each agent's `model` field during the config hook?
   - Recommendation: Leave `model` unset in agent configs. Users can override via `opencode.json` agent config. The Phase 1 config module can be integrated in a future enhancement.

## Sources

### Primary (HIGH confidence)
- `@opencode-ai/sdk` types (local) - `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts` - Complete `AgentConfig`, `Config` type definitions
- `@opencode-ai/plugin` types (local) - `node_modules/@opencode-ai/plugin/dist/index.d.ts` - `Hooks.config` signature, `Plugin` type
- [OpenCode Agents Documentation](https://opencode.ai/docs/agents/) - Agent config fields, mode values, permission format
- [OpenCode Commands Documentation](https://opencode.ai/docs/commands/) - Command markdown format, `$ARGUMENTS`, agent delegation
- [OpenCode Skills Documentation](https://opencode.ai/docs/skills/) - SKILL.md format, naming rules (1-64 chars, lowercase alphanumeric + hyphens)

### Secondary (MEDIUM confidence)
- [OpenCode Plugins Documentation](https://opencode.ai/docs/plugins/) - Plugin hooks overview (config hook not prominently documented but exists in types)
- [oh-my-openagent repository](https://github.com/code-yeongyu/oh-my-openagent) - Reference implementation for config hook agent injection pattern

### Tertiary (LOW confidence)
- Write permission behavior when `edit: "deny"` - Inferred from type analysis but not verified with actual runtime testing

## Project Constraints (from CLAUDE.md)

- **Runtime:** Must work with Bun (OpenCode's JS runtime for plugins)
- **Plugin format:** Must follow OpenCode's plugin spec (`@opencode-ai/plugin` types)
- **File conventions:** Agents, skills, commands must follow OpenCode's filesystem conventions exactly
- **No external dependencies:** Creation tooling should work offline, no API calls needed for scaffolding
- **Model agnostic:** Agents should work with any provider configured in OpenCode (Anthropic, OpenAI, etc.)
- **Immutability:** ALWAYS create new objects, NEVER mutate existing ones -- EXCEPT for the config hook, which explicitly requires mutation by design (`Promise<void>` return type)
- **File organization:** Many small files > few large files. Each agent in its own module (aligns with D-02).
- **Testing:** Use `bun:test`. TDD approach (tests first). 80%+ coverage target.
- **Linting:** Biome 2.x for linting/formatting.
- **No `console.log`:** Use proper error handling patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies; SDK types verified locally in `node_modules`
- Architecture: HIGH - Config hook signature verified from installed types; pattern matches oh-my-opencode
- Pitfalls: HIGH - Permission field mismatch verified by comparing SDK types vs markdown frontmatter format
- Prompt content: MEDIUM - Discretionary; quality depends on implementation choices

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable API, unlikely to change within 30 days)
