# Domain Pitfalls

**Domain:** OpenCode Plugin Development (AI Coding CLI Extension)
**Researched:** 2026-03-31

## Critical Pitfalls

Mistakes that cause rewrites, broken installations, or unusable plugins.

### Pitfall 1: Skill Path Singular/Plural Mismatch

**What goes wrong:** OpenCode documentation specifies `skills/` (plural) as the skill directory name, but the runtime actually loads from `skill/` (singular) in some contexts. Plugin code that creates skill directories using the documented plural form will produce skills that silently fail to load.

**Why it happens:** OpenCode's internal skill discovery code and its documentation are inconsistent. This was reported as [issue #9819](https://github.com/anomalyco/opencode/issues/9819) and has caused confusion across multiple users and plugin authors.

**Consequences:** Skills appear to install correctly (files exist on disk) but are invisible to agents. Users blame the plugin, not the path convention. Debugging is difficult because there is no error message --- skills simply do not appear.

**Prevention:**
- Test every asset type (agent, skill, command) against the actual runtime, not the documentation
- Pin to the working paths discovered through testing and document them in the plugin's own code
- Add a post-write verification step: after creating a skill directory, invoke the skill tool to confirm it was discovered
- Watch the OpenCode changelog for path convention fixes

**Detection:** Skills show up in the filesystem but not in the `/skill` command output or the agent's `available_skills` list.

**Phase:** Must be resolved in Phase 1 (creation tooling). Every file-creation function needs verified paths.

**Confidence:** HIGH --- confirmed via GitHub issues [#9819](https://github.com/anomalyco/opencode/issues/9819), [#10273](https://github.com/anomalyco/opencode/issues/10273).

---

### Pitfall 2: Skill Name Collisions Without Namespacing

**What goes wrong:** Skill names are globally unique with first-found-wins resolution. A plugin that ships a skill named `code-review` will silently shadow any user-created skill with the same name, or be shadowed by one. There is no namespace prefix system.

**Why it happens:** OpenCode's skill discovery walks multiple directories (project `.opencode/skills/`, `.claude/skills/`, `.agents/skills/`, plus global equivalents) and takes the first match. The name regex `^[a-z0-9]+(-[a-z0-9]+)*$` has no convention for vendor prefixes.

**Consequences:** Users lose access to their own skills without understanding why. Or the plugin's curated skills silently stop working because a project-local skill with the same name takes precedence. No warning is shown (or worse, a confusing duplicate warning appears per [issue #2909](https://github.com/code-yeongyu/oh-my-openagent/issues/2909)).

**Prevention:**
- Adopt a strict naming convention: prefix all plugin skills with `oc-` or similar (e.g., `oc-code-review` instead of `code-review`)
- Document the naming convention prominently so users know to avoid the prefix
- In creation tooling, warn users if their chosen name matches an existing skill
- Consider a manifest/registry that tracks installed skill names to detect conflicts at install time

**Detection:** User reports "skill X does not do what it should" or "my custom skill stopped working after installing the plugin."

**Phase:** Phase 1 (creation tooling) for conflict detection; Phase 2 (curated assets) for naming convention enforcement.

**Confidence:** HIGH --- confirmed via OpenCode docs and GitHub issues.

---

### Pitfall 3: Plugin Cannot Directly Register Assets

**What goes wrong:** Developers assume plugins can register agents/skills/commands through the plugin API (like VS Code extensions register commands). They cannot. Plugins can only create custom tools and hooks. Assets must be written to disk as files.

**Why it happens:** The plugin system and the asset system are architecturally separate. Plugins are JS/TS hook functions; assets are markdown files on the filesystem. There is no bridge API.

**Consequences:** Plugin authors waste time looking for a registration API that does not exist. Once they realize files must be written to disk, they face a second problem: when should files be written? At install time? At startup via hooks? On demand via tools? Each approach has tradeoffs around file ownership, cleanup, and update semantics.

**Prevention:**
- Accept the filesystem-based architecture from the start --- design around it, not against it
- Use the `session.created` hook or custom tools to write files on demand rather than at install time
- For bundled assets: copy them from the npm package to the correct directories during a setup command, not silently at startup
- Provide an uninstall/cleanup mechanism that removes files the plugin created

**Detection:** Plugin loads but agents/skills/commands do not appear. No errors in logs.

**Phase:** Phase 1 (core architecture). This shapes the entire plugin design.

**Confidence:** HIGH --- confirmed via [OpenCode plugin docs](https://opencode.ai/docs/plugins/).

---

### Pitfall 4: No Hot Reload --- Changes Require Restart

**What goes wrong:** After the plugin creates or modifies an agent/skill/command file, the user expects it to be available immediately. It is not. OpenCode discovers assets at startup and does not re-scan during a session.

**Why it happens:** OpenCode loads agents, skills, and commands once during initialization. The filesystem watcher (if any) does not trigger re-indexing of the asset directories.

**Consequences:** Users create an agent via the plugin's tool, then try to use it immediately with `@agent-name`, and it does not appear. They assume the creation failed. This is the single worst UX failure for in-session creation tooling.

**Prevention:**
- Clearly communicate to users that a restart is needed: "Agent created. Restart OpenCode to use it."
- Explore whether the SDK client can trigger a re-index (unlikely but worth testing)
- Design creation tooling to set expectations: output includes restart instructions
- Consider a `/reload` command that restarts the session (if OpenCode supports session restart)
- For curated assets: install at plugin setup time (before the session), not during the session

**Detection:** User creates asset, tries to use it, it does not exist in the session.

**Phase:** Phase 1 (creation tooling UX). Must be addressed in the command output messaging and possibly the overall architecture.

**Confidence:** HIGH --- stated in project context ("No hot-reload for plugins (changes require restart)").

---

### Pitfall 5: Plugin Dependency Version Drift

**What goes wrong:** When OpenCode upgrades, the `@opencode-ai/plugin` package version in the user's config stays at the old version. The plugin was built against one version of the plugin API, but the runtime is now a different version.

**Why it happens:** `opencode upgrade` updates the binary but does not update plugin dependencies in `~/.config/opencode/package.json`. Users must manually run `bun add @opencode-ai/plugin@latest`. This was [issue #10441](https://github.com/anomalyco/opencode/issues/10441) (now fixed, but the underlying risk remains for npm-distributed plugins).

**Consequences:** Plugin breaks silently after OpenCode upgrade. Type mismatches, missing hook signatures, or changed tool schemas cause runtime errors that are hard to diagnose.

**Prevention:**
- Use loose version ranges in the plugin's peer dependencies (e.g., `"@opencode-ai/plugin": ">=1.0.0"`)
- Avoid depending on internal/undocumented APIs --- stick to the documented plugin interface
- Test against multiple OpenCode versions in CI
- Add a version compatibility check at plugin startup that warns if versions are mismatched
- Document minimum OpenCode version in the plugin README

**Detection:** Plugin worked before upgrade, fails after. Errors reference missing functions or type mismatches.

**Phase:** Phase 1 (plugin packaging). Must be considered in package.json and build configuration.

**Confidence:** HIGH --- confirmed via [GitHub issue #10441](https://github.com/anomalyco/opencode/issues/10441).

---

## Moderate Pitfalls

### Pitfall 6: Custom Tools Shadowing Built-in Tools

**What goes wrong:** Plugin tools override built-in tools with matching names. A plugin that defines a tool called `read`, `write`, `skill`, or `bash` will silently replace OpenCode's core functionality.

**Why it happens:** OpenCode's plugin tool precedence gives plugins priority over built-ins with the same name. This is documented behavior, but it is a footgun.

**Prevention:**
- Prefix all plugin tool names with a namespace (e.g., `opencode_assets_create_agent` not `create_agent`)
- Maintain a list of built-in tool names and validate against it during development
- Never use generic names like `create`, `list`, `run`, `execute`

**Phase:** Phase 1 (tool definition).

**Confidence:** HIGH --- documented in [plugin docs](https://opencode.ai/docs/plugins/).

---

### Pitfall 7: File Permission and Ownership Issues

**What goes wrong:** Plugin writes files to `.opencode/` directories but the files end up with wrong permissions, or the plugin tries to write to a directory it cannot access (global config on multi-user systems, read-only project directories).

**Why it happens:** Bun shell commands and `fs.writeFile` inherit the process permissions. Global vs project-local paths have different permission models. CI/CD environments may have read-only filesystems.

**Prevention:**
- Always check directory existence and writability before writing files
- Prefer project-local paths (`.opencode/`) over global paths (`~/.config/opencode/`) for user-created assets
- Handle `EACCES`, `ENOENT`, and `EROFS` errors gracefully with actionable error messages
- Create parent directories recursively before writing files (`mkdir -p` equivalent)

**Detection:** "Permission denied" errors or silent failures when creating assets.

**Phase:** Phase 1 (file writing utilities).

**Confidence:** MEDIUM --- inferred from general filesystem plugin patterns and [OpenCode permission issues](https://github.com/anomalyco/opencode/issues/16914).

---

### Pitfall 8: Agent Model Configuration That Breaks Portability

**What goes wrong:** Curated agents hardcode model names (e.g., `model: claude-sonnet-4-20250514`) that only work with Anthropic. Users with OpenAI, Google, or other providers configured get errors or unexpected behavior.

**Why it happens:** Agent markdown frontmatter allows a `model` field override. It is tempting to set specific models for routing (haiku for lightweight tasks, opus for complex reasoning). But model identifiers are provider-specific.

**Consequences:** Plugin only works for users with the same provider. Breaks the "model agnostic" constraint from the project requirements.

**Prevention:**
- Omit the `model` field from agent frontmatter entirely --- let the user's configured default apply
- If model routing is essential, use model tiers/aliases if OpenCode supports them, or document provider requirements
- Test agents with at least Anthropic and OpenAI providers
- Consider making model selection a configuration option in the plugin rather than hardcoded in agent files

**Detection:** Agent fails with "model not found" or produces poor results because wrong model was used.

**Phase:** Phase 2 (curated assets). Every agent file must be reviewed for portability.

**Confidence:** MEDIUM --- inferred from project constraint ("Model agnostic: Agents should work with any provider") and [OpenCode agent docs](https://opencode.ai/docs/agents/).

---

### Pitfall 9: Bloated Plugin with Too Many Assets

**What goes wrong:** Plugin ships 30+ agents, 50+ skills, and 20+ commands. Users are overwhelmed, agent autocomplete is cluttered, and most assets go unused. The plugin becomes "bloatware."

**Why it happens:** The temptation to be comprehensive. Porting all existing Claude Code / ECC / GSD assets instead of curating. Adding every conceivable agent variation.

**Consequences:** Poor discoverability. Users cannot find the 3-4 agents they actually need among dozens. Performance impact if asset loading scales with file count. Maintenance burden grows linearly.

**Prevention:**
- Start with 5-8 agents, 5-10 skills, 3-5 commands maximum
- Every asset must have a clear, distinct use case --- no overlapping agents
- Provide a "getting started" command that highlights the most useful assets
- Use the creation tooling to let users build their own specialized agents rather than shipping every variant
- Track usage if possible; remove unused assets in future versions

**Detection:** Users install plugin but only use 2-3 assets. Issue tracker fills with "what does X agent do?" questions.

**Phase:** Phase 2 (curated assets). Curation discipline must be enforced during asset selection.

**Confidence:** HIGH --- stated in project scope ("building fresh, curated set instead" of porting everything).

---

### Pitfall 10: Commands Overriding Built-in Commands

**What goes wrong:** A command file named `help.md`, `config.md`, `compact.md`, or `clear.md` replaces OpenCode's built-in commands of the same name. Users lose core functionality.

**Why it happens:** OpenCode documentation confirms "custom commands override built-in commands if same name is used." There is no protection or warning.

**Prevention:**
- Maintain a list of built-in command names and never use them
- Prefix plugin commands if needed (e.g., `oc-review` instead of `review`)
- Test that all built-in commands still work after plugin installation
- In creation tooling: warn users if their chosen command name matches a built-in

**Detection:** User reports "help command stopped working" or similar core feature loss.

**Phase:** Phase 1 (creation tooling) for validation; Phase 2 (curated assets) for naming.

**Confidence:** HIGH --- documented in [command docs](https://opencode.ai/docs/commands/).

---

## Minor Pitfalls

### Pitfall 11: Skill Content Too Long for Context Window

**What goes wrong:** A skill's SKILL.md contains 5000+ words of detailed instructions. When the agent loads it on demand, it consumes a large portion of the context window, reducing space for actual code and conversation.

**Prevention:**
- Keep skills concise: 200-500 words maximum
- Use skills for principles and patterns, not exhaustive documentation
- Split large knowledge areas into multiple focused skills
- Test skills with small-context models to ensure they fit

**Phase:** Phase 2 (curated assets).

**Confidence:** MEDIUM --- inferred from context window management best practices.

---

### Pitfall 12: Forgetting SKILL.md Capitalization

**What goes wrong:** Plugin creates `skill.md` or `Skill.md` instead of `SKILL.md`. The skill is not discovered on case-sensitive filesystems (Linux).

**Prevention:**
- Hardcode `SKILL.md` in all caps in creation tooling
- Add a validation check in the file-writing utility
- Test on Linux (case-sensitive) not just macOS (case-insensitive by default)

**Phase:** Phase 1 (creation tooling).

**Confidence:** HIGH --- documented in [skill docs](https://opencode.ai/docs/skills/) ("SKILL.md is spelled in all caps").

---

### Pitfall 13: No Cleanup on Plugin Uninstall

**What goes wrong:** User removes the plugin from opencode.json, but all the agent/skill/command files the plugin created remain on disk. Orphaned files clutter the asset directories.

**Prevention:**
- Track which files the plugin created (manifest file or naming convention)
- Provide an explicit `/oc-uninstall` or `/oc-cleanup` command
- Document that removing the plugin from opencode.json does not remove created files
- For bundled assets (vs user-created): use a distinct directory or naming pattern so they can be identified

**Phase:** Phase 3 or later (polish and maintenance tooling).

**Confidence:** MEDIUM --- inferred from general plugin lifecycle patterns.

---

### Pitfall 14: Bun-Specific API Assumptions

**What goes wrong:** Plugin uses Bun-specific APIs (like `Bun.file()`, `Bun.write()`, `Bun.$` shell) that work in the OpenCode runtime but cannot be tested or developed without Bun installed. Contributors on Node.js cannot run the test suite.

**Prevention:**
- Use standard Node.js `fs` APIs where possible for file operations
- Reserve Bun-specific APIs for the plugin entry point and shell operations
- Document Bun as a development requirement
- Provide a Bun installation step in the contributing guide

**Phase:** Phase 1 (development setup).

**Confidence:** MEDIUM --- inferred from [Bun runtime issues in OpenCode](https://github.com/anomalyco/opencode/issues/11824).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: Creation tooling | Path convention mismatches (#1), no hot reload (#4), tool name shadowing (#6) | Test every path against live runtime; set restart expectations in UX; namespace all tools |
| Phase 1: Plugin architecture | Cannot register assets directly (#3), version drift (#5) | Design around filesystem writes from day one; use loose peer deps |
| Phase 2: Curated agents | Model portability (#8), asset bloat (#9), command shadowing (#10) | Omit model field; curate ruthlessly; check against built-in names |
| Phase 2: Curated skills | Name collisions (#2), content length (#11), capitalization (#12) | Prefix names; keep under 500 words; hardcode SKILL.md |
| Phase 3+: Distribution | Dependency drift (#5), no cleanup (#13), Bun assumptions (#14) | Version checks at startup; provide cleanup command; document Bun requirement |

## Sources

- [OpenCode Plugin Documentation](https://opencode.ai/docs/plugins/) --- HIGH confidence
- [OpenCode Skill Documentation](https://opencode.ai/docs/skills/) --- HIGH confidence
- [OpenCode Agent Documentation](https://opencode.ai/docs/agents/) --- HIGH confidence
- [OpenCode Command Documentation](https://opencode.ai/docs/commands/) --- HIGH confidence
- [Skill Path Mismatch - Issue #9819](https://github.com/anomalyco/opencode/issues/9819) --- HIGH confidence
- [Skill Not Recognized - Issue #10273](https://github.com/anomalyco/opencode/issues/10273) --- HIGH confidence
- [Plugin Dependency Drift - Issue #10441](https://github.com/anomalyco/opencode/issues/10441) --- HIGH confidence
- [Duplicate Skill Warnings - Issue #2909](https://github.com/code-yeongyu/oh-my-openagent/issues/2909) --- MEDIUM confidence (third-party fork)
- [Empty Skills List - Issue #7069](https://github.com/anomalyco/opencode/issues/7069) --- MEDIUM confidence
- [Bun Runtime Conflicts - Issue #11824](https://github.com/anomalyco/opencode/issues/11824) --- MEDIUM confidence
- [OpenCode Permission Issues - Issue #16914](https://github.com/anomalyco/opencode/issues/16914) --- MEDIUM confidence
