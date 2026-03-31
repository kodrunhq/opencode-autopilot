# Feature Landscape

**Domain:** AI Coding CLI Plugin (OpenCode extension providing agents, skills, commands, and in-session creation tooling)
**Researched:** 2026-03-31

## Table Stakes

Features users expect from any "batteries-included" AI coding CLI plugin. Missing = users choose Oh My OpenCode or roll their own.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Curated code reviewer agent | Every competing ecosystem (Claude Code, Cursor, Goose) ships one. Developers expect instant code review without setup. | Low | Markdown file with YAML frontmatter, Sonnet-class model, read-only tools |
| Curated planner agent | Claude Code has Plan mode built-in; OpenCode has a Plan agent. Users expect a planning workflow that produces actionable steps. | Low | Read-only agent that outputs structured plans |
| Curated TDD guide agent | TDD is a standard workflow pattern in Claude Code custom command suites (Claude-Command-Suite, claude-code-workflows). | Medium | Needs iterative loop guidance; model routing matters (Sonnet for reasoning) |
| Curated commit command | Git commit with AI-generated message is table stakes across all CLIs (Aider auto-commits, Claude Code has commit workflows). | Low | Command template with `$ARGUMENTS` for scope control |
| Curated PR review command | GitHub PR review commands exist in every major command suite. | Low | Command that reads diff + provides structured feedback |
| Single-install via opencode.json | Oh My OpenCode installs with one config line. Any competing plugin must match this. | Low | npm package reference in opencode.json |
| Project-local AND global installation | OpenCode supports both `.opencode/` and `~/.config/opencode/` paths. Users expect flexibility. | Low | Plugin writes files to correct locations based on scope |
| Model routing per agent | OpenCode supports `model` field in agent frontmatter. Users expect lightweight agents on fast models, complex agents on capable models. | Low | YAML frontmatter field per agent |
| Proper tool permissions per agent | OpenCode supports granular `permission` field (ask/allow/deny per tool). Read-only agents should not have write access. | Low | YAML frontmatter configuration |

## Differentiators

Features that set this plugin apart. Not expected, but create real competitive advantage over Oh My OpenCode and manual file creation.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `/new-agent` in-session creation command | **Core differentiator.** OpenCode's `opencode agent create` CLI wizard requires leaving the TUI. No competitor offers in-session agent scaffolding. Oh My OpenCode provides pre-built agents but no creation tooling. | High | Plugin tool that prompts for config, validates, writes markdown file to correct path |
| `/new-skill` in-session creation command | **No equivalent exists anywhere.** OpenCode has no `skill create` command at all. Users must manually create directories and SKILL.md files. | High | Plugin tool that creates directory structure + SKILL.md with proper frontmatter |
| `/new-command` in-session creation command | **No equivalent exists.** Users must manually create markdown files in commands directory. | Medium | Simpler than agents/skills -- fewer fields, no directory structure needed |
| Guided prompts with validation | Creation commands validate names (1-64 chars, lowercase alphanumeric with hyphens for skills), required fields, and path conflicts before writing files. | Medium | Zod schema validation in plugin tool definitions |
| Template-based scaffolding with best practices | Generated files include opinionated defaults: proper model selection, tool permissions, description patterns, prompt structure. Not blank templates -- working starting points. | Medium | Embedded templates with sensible defaults |
| Security reviewer agent | Specialized agent that most custom command suites lack. Goes beyond code review to focus on secrets, injection, auth patterns. | Low | Markdown agent with security-focused prompt, read-only tools |
| Refactor helper agent | Focused agent for extract-function, rename, move-file patterns. Distinct from general coding because it needs write access with structured approach. | Low | Agent with write tools + refactoring-specific prompt |
| Simplify command | Reduce complexity of selected code. Not common in competing suites -- most focus on generation, not reduction. | Low | Command targeting specific files with simplification prompt |
| Coding standards skill | Reusable knowledge about style, patterns, naming conventions that agents auto-discover. Skills are underused in the ecosystem. | Low | SKILL.md with coding patterns the LLM can reference |
| API patterns skill | Domain knowledge for REST/GraphQL patterns, error handling, pagination. Agents load this contextually. | Low | SKILL.md with API best practices |
| Testing strategies skill | Knowledge about test structure, mocking, coverage patterns. Auto-loaded when agents work on test files. | Low | SKILL.md with testing domain knowledge |

## Anti-Features

Features to explicitly NOT build. These are traps that add complexity without proportional value, or conflict with OpenCode's design.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multi-agent orchestration / parallel agents | Oh My OpenCode's territory. Requires deep plugin system knowledge, Tmux integration, session management. Massive scope for marginal gain in v1. | Ship focused single-purpose agents. Let users compose them manually via `@` mentions. |
| Custom hooks (JS/TS lifecycle hooks) | OpenCode hooks require plugin code, not markdown. Different complexity class entirely. Out of scope per PROJECT.md. | Focus on commands and agents which are markdown-based and simple. |
| MCP server bundling | Bundling Exa, Context7, etc. is Oh My OpenCode's approach. MCP servers are a separate concern with their own config. | Document recommended MCPs in skill files instead. |
| Plugin marketplace / registry | Distribution is via npm. Building a custom registry is a separate product. | Publish to npm, reference in opencode.json. |
| GUI/TUI theming | Cosmetic. Does not improve AI coding workflows. | Focus on functional features. |
| Agent-to-agent delegation chains | Complex orchestration patterns where agents spawn sub-agents automatically. Brittle, hard to debug, confusing UX. | Let users manually invoke agents with `@`. Keep agents independent. |
| Interactive wizard UX in creation tools | OpenCode plugin tools receive structured args, not interactive prompts. Trying to simulate a wizard through tool calls is fragile. | Accept all parameters in a single tool call with clear Zod schema. LLM fills in parameters conversationally before calling the tool. |
| Porting existing Claude Code / ECC / GSD assets wholesale | Per PROJECT.md: "building fresh, curated set instead." Porting creates bloat and compatibility issues. | Build purpose-built assets optimized for OpenCode's conventions. |
| LSP / AST-Grep integration | Heavy infrastructure that Oh My OpenCode already provides. Would require significant plugin code and dependencies. | Focus on markdown-based extensions. Let users add Oh My OpenCode alongside if they want LSP tools. |
| Claude Code compatibility layer | OpenCode already reads CLAUDE.md and searches `.claude/skills/`. Adding a compatibility layer adds complexity for a problem already solved upstream. | Write to OpenCode-native paths (`.opencode/`). Users who also use Claude Code get skills from `.claude/` natively. |

## Feature Dependencies

```
Plugin infrastructure (tool registration, Zod schemas)
  --> /new-agent command
  --> /new-skill command
  --> /new-command command

/new-agent command --> Curated agents (agents validate the creation tooling works)
/new-skill command --> Curated skills (skills validate the creation tooling works)
/new-command command --> Curated commands (commands validate the creation tooling works)

Curated agents are independent of each other (no inter-agent dependencies)
Curated skills are independent of each other
Curated commands are independent of each other

All curated assets --> Single-install via opencode.json (distribution mechanism)
```

## MVP Recommendation

**Phase 1 -- Creation Infrastructure:**
1. Plugin skeleton with tool registration (Bun, Zod, OpenCode plugin spec)
2. `/new-agent` creation tool (highest value -- replaces clunky CLI wizard)
3. `/new-skill` creation tool (fills gap -- no equivalent exists)
4. `/new-command` creation tool (fills gap -- no equivalent exists)

**Phase 2 -- Curated Assets:**
5. Code reviewer agent (table stakes, validates /new-agent works)
6. Planner agent (table stakes)
7. Commit command (table stakes, validates /new-command works)
8. PR review command (table stakes)

**Phase 3 -- Specialized Assets:**
9. TDD guide agent
10. Security reviewer agent (differentiator)
11. Refactor helper agent (differentiator)
12. Simplify command (differentiator)
13. Coding standards skill (validates /new-skill works)
14. API patterns skill
15. Testing strategies skill

**Defer:** Multi-agent orchestration, hooks, MCP bundling, LSP integration. These are v2+ concerns or better served by complementary plugins.

**Rationale:** Creation tooling first because (a) it is the unique value proposition no competitor offers, (b) it validates the plugin infrastructure that all curated assets depend on, and (c) curated assets without creation tooling is a dead end -- users can't extend beyond what ships.

## Sources

- [OpenCode Agents Documentation](https://opencode.ai/docs/agents/)
- [OpenCode Skills Documentation](https://opencode.ai/docs/skills/)
- [OpenCode Plugins Documentation](https://opencode.ai/docs/plugins/)
- [OpenCode Commands Documentation](https://opencode.ai/docs/commands/)
- [Oh My OpenCode (GitHub)](https://github.com/opensoft/oh-my-opencode)
- [Oh My OpenCode Agents Deep Dive](https://www.glukhov.org/ai-devtools/opencode/oh-my-opencode-agents/)
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [Claude Code Custom Commands Guide](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/)
- [Claude-Command-Suite (GitHub)](https://github.com/qdhenry/Claude-Command-Suite)
- [Cursor Subagents, Skills Changelog](https://cursor.com/changelog/2-4)
- [Goose AI Agent (GitHub)](https://github.com/block/goose)
- [Aider CLI AI Pair Programming](https://aider.chat/)
- [Addy Osmani - LLM Coding Workflow 2026](https://addyosmani.com/blog/ai-coding-workflow/)
- [AI Coding CLI Assistants Compared 2026](https://sanj.dev/post/comparing-ai-cli-coding-assistants)
