# Domain Pitfalls

**Domain:** Production quality improvements to an AI coding plugin — asset expansion, command renaming, test infrastructure, QA playbook
**Researched:** 2026-04-03
**Milestone:** v4.0 Production Quality
**Overall confidence:** HIGH (based on codebase analysis, OpenCode docs, ecosystem patterns, and Phase 11 post-mortem)

---

## Critical Pitfalls

Mistakes that cause broken user workflows, silent regressions, or require emergency patches.

### Pitfall 1: Command Renaming Breaks User Muscle Memory with No Migration Path

**What goes wrong:** Renaming commands from `brainstorm` to `oc-brainstorm` (or any oc- prefix) silently removes the old command. Users who type `/brainstorm` get "command not found" with no explanation, no alias, and no deprecation warning. OpenCode has zero alias support for commands — the filename IS the command name, period.

**Why it happens:** The installer uses `copyIfMissing` with `COPYFILE_EXCL` — it only copies new files, never overwrites. So the new `oc-brainstorm.md` gets installed alongside the old `brainstorm.md`, but the old file never gets cleaned up automatically. The DEPRECATED_ASSETS list in `installer.ts` handles explicit removal, but someone has to manually add every renamed command to that list. If they forget, users have BOTH the old and new command, causing confusion ("why do I have two brainstorm commands?").

**Consequences:** Users lose their workflows. The `/stocktake` command shows duplicate entries. Commands that delegate to agents (like `oc-configure.md` which sets `agent: autopilot`) break if the agent name also changed. This compounds: if a command references an agent by name and the agent name changed, the command silently delegates to the wrong agent or fails.

**Prevention:**
1. Add every old command filename to the `DEPRECATED_ASSETS` array in `installer.ts` before releasing the rename
2. Create a one-time migration in the installer that detects old-named files and replaces them (not just delete — preserve user customizations by checking if content differs from the built-in version)
3. Ship the rename in a single atomic release — never ship new names without simultaneously removing old names
4. Test the full lifecycle: fresh install (no old files), upgrade from v3.x (old files exist), upgrade with user-customized old files

**Detection:** Run `/stocktake` after upgrade — duplicate names (e.g., both `brainstorm` and `oc-brainstorm`) means the migration failed.

**Phase:** Must be addressed in the command-renaming implementation phase. Add to the first task.

---

### Pitfall 2: Stocktake Cannot See Config-Hook-Injected Agents

**What goes wrong:** `oc_stocktake` scans `~/.config/opencode/agents/` for `.md` files (line 106 of `stocktake.ts`). But our agents (autopilot, researcher, metaprompter, documenter, pr-reviewer, plus 10 pipeline agents) are injected via the `configHook` in `src/agents/index.ts` — they never exist as filesystem files. Stocktake reports zero agents (or only user-created filesystem agents), making users think the plugin installed nothing.

**Why it happens:** Two-source architecture: filesystem agents (`.md` files) and config-hook agents (injected into `config.agent` at runtime). Stocktake was written to only scan the filesystem source. The gap was identified but never fixed because it requires either: (a) stocktake reading the runtime config object, or (b) a registry that both sources populate.

**Consequences:** Users run `/stocktake` expecting to see all 15+ agents, get an empty list. They think installation failed. They try reinstalling. Support burden increases. The `summary.builtIn` count is wrong, the `summary.total` is misleadingly low.

**Prevention:**
1. Stocktake must query BOTH sources: filesystem scan (existing) AND the agent registry (`AGENT_REGISTRY` from `src/registry/model-groups.ts` or the `agents` + `pipelineAgents` maps from `src/agents/index.ts`)
2. Add an `origin: "config-hook"` value to `AssetEntry.origin` (currently only `"built-in" | "user-created"`)
3. For linting config-hook agents, extract the system prompt from the agent definition object rather than reading a `.md` file
4. Test with: zero filesystem agents (config-hook only), mixed (both sources), filesystem-only (plugin not loaded)

**Detection:** If `stocktake` returns `agents: []` when the plugin is loaded, this bug is active.

**Phase:** Fix before any agent expansion work. If we add 10 more agents via config hook and stocktake still cannot see them, the problem compounds.

---

### Pitfall 3: Tab-Cycle Pollution from Adding Too Many Primary Agents

**What goes wrong:** Every agent with `mode: "primary"` or `mode: "all"` (the default) appears in the Tab cycle. Adding a debugger, planner, documentation agent, etc. as primary agents means users must Tab through 8+ agents to find the one they want. The Tab cycle order is not configurable in OpenCode (feature request #16840 was closed/rejected). Users experience this as "the plugin took over my agent switching."

**Why it happens:** The oh-my-opencode pattern demonstrates this: it injects 8+ agents, demotes Build to hidden, and sets its own default. The user ends up in a completely different agent experience. Our Phase 11 research correctly identified "all curated agents as subagents only" as a key decision, but implementation pressure can erode this discipline — "this agent would be so useful as a primary agent" is a tempting thought.

**Consequences:** Users who only want the autopilot agent must Tab through researcher, metaprompter, documenter, debugger, etc. every time they switch agents. This is especially bad because Tab cycling has no ordering mechanism — you cannot put your most-used agent first. Users uninstall the plugin to get their clean agent list back.

**Prevention:**
1. STRICT RULE: Only `autopilot` should be `mode: "primary"`. Every other agent must be `mode: "subagent"` with `hidden: false` (visible in @ autocomplete but not in Tab cycle)
2. Pipeline agents (oc-researcher, oc-planner, etc.) must be `mode: "subagent"` with `hidden: true` (internal-only, invoked by the orchestrator via Task tool)
3. Verify in tests: iterate all agent definitions and assert no agent besides `autopilot` has `mode: "primary"` or `mode: "all"`
4. Document this in CLAUDE.md as a constraint

**Detection:** Manual test: install plugin, Tab through agents. If anything besides `autopilot` and OpenCode's built-in agents appears, this pitfall is active.

**Phase:** Enforce as a pre-condition for any agent expansion work. Add automated test immediately.

---

### Pitfall 4: Research-to-Execution Gap (Phase 11 Pattern Repeating)

**What goes wrong:** Phase 11 produced excellent research: 71 gaps, 56 planned features, detailed architecture specs. But the user explicitly flagged that "v3.0 Phase 11 research was good analysis but execution fell short." The risk is that v4.0 repeats this pattern: thorough planning documents that are ignored during implementation, features that drift from spec, and gaps that remain unfixed despite being cataloged.

**Why it happens:** Research artifacts become "write-once, read-never" documents. Implementation proceeds based on what the developer remembers from research, not what the research actually says. No mechanism forces the implementer to cross-reference the gap matrix or phase scope during coding. Additionally, phase scopes defined 56 features across 6 phases — this is ambitious for any project and invites scope cutting.

**Consequences:** Features ship incomplete. The gap matrix shows "Phase 14: 22 features" but only 12 get implemented. The remaining 10 are quietly dropped without updating the tracking documents. Users get promised features that never arrive.

**Prevention:**
1. Each implementation plan must explicitly reference gap IDs from the gap matrix
2. Each phase completion must include a checklist: "Which gap IDs were addressed? Which were deferred? Update the matrix"
3. Scope ruthlessly upfront: if 22 features in Phase 14 is unrealistic, split into Phase 14a/14b before starting, not after running out of time
4. The QA playbook must include a "gap matrix reconciliation" step at each phase boundary
5. For v4.0 specifically: the target feature list in PROJECT.md has 10 items. Each must have clear acceptance criteria before implementation begins

**Detection:** At phase completion, diff the planned features against what actually shipped. If more than 20% were silently dropped, this pitfall is active.

**Phase:** Address during roadmap creation. Build gap-tracking into the phase transition process.

---

## Moderate Pitfalls

Mistakes that cause wasted effort, degraded UX, or technical debt that compounds over time.

### Pitfall 5: Coding Standards Skills Overflow Token Budget

**What goes wrong:** The adaptive skill injector has an 8000-token budget (`DEFAULT_TOKEN_BUDGET` in `adaptive-injector.ts`). Adding more language-specific skills (Go, Python, Rust patterns are already present, plus coding-standards, typescript-patterns) means the injector must fit more content into the same budget. When a project uses multiple languages (e.g., TypeScript + Go in a monorepo), all matching skills compete for the same 8000 tokens. Skills get truncated or dropped entirely.

**Why it happens:** Skills are filtered by stack tags detected from manifest files. A project with both `tsconfig.json` and `go.mod` triggers both `typescript` and `go` tags. All matching skills are included up to the budget. Universal methodology skills (brainstorming, tdd-workflow, verification, etc.) always load because they have empty stack tags. If there are 5 universal skills at ~1000 tokens each, that leaves only 3000 tokens for language-specific content — not enough for a comprehensive Go patterns guide.

**Consequences:** Language-specific skills get truncated mid-sentence. The AI receives half a coding standard and follows it inconsistently. Or worse, the skill injector silently drops entire skills because they do not fit, and the user never knows their Go patterns skill was not loaded.

**Prevention:**
1. Each skill MUST stay under 2000 tokens (~8000 characters). Enforce this in the linter (`skills/linter.ts`)
2. Methodology skills should be under 1000 tokens each — they are loaded for every project
3. Consider raising the budget or making it configurable (the memory system already has `injectionBudget` in config)
4. Add a warning to `oc_doctor` when total skill content exceeds 80% of the token budget
5. Prioritize language-specific skills over methodology skills when both compete for budget (project-specific context is more valuable than generic methodology)

**Detection:** Run `oc_stocktake` with lint, then manually sum token estimates for all skills matching a multi-language project. If total exceeds 8000 tokens, skills are being silently dropped.

**Phase:** Address during coding standards expansion. Add linter rule for skill length.

---

### Pitfall 6: Mock/Fail Mode Persists into Production Configuration

**What goes wrong:** The current `oc_mock_fallback` tool generates and classifies mock errors but does not actually trigger fallback in a live session (the code comments say this explicitly). But v4.0 plans to add "mock/fail-forced fallback mode accessible from CLI configure." If this becomes a persistent configuration toggle (stored in `opencode-autopilot.json`), a user could enable mock mode for testing and forget to disable it. Their production sessions then silently use mock behavior.

**Why it happens:** The config system (`config.ts`) already has `fallback.enabled` as a persistent boolean. Adding a `fallback.mockMode: true` flag follows the same pattern. But unlike `fallback.enabled` (which users intentionally set), mock mode is a testing concern that should be transient.

**Consequences:** User enables mock mode for testing, forgets to disable. Next day, their fallback system does not actually fall back on real errors — it either swallows errors silently or produces fake error classifications. They lose work because the safety net was disabled.

**Prevention:**
1. Mock mode must be session-scoped, NOT config-persisted. It should be an in-memory flag that resets when OpenCode restarts
2. If it must be config-persisted, add a TTL: `mockModeExpires: ISO-timestamp`. The plugin ignores mock mode if the timestamp has passed. Default TTL: 1 hour
3. Show a persistent TUI toast warning while mock mode is active: "MOCK MODE ACTIVE — fallback disabled"
4. The `oc_doctor` health check should flag active mock mode as a warning
5. Never allow mock mode to be enabled without an explicit timeout parameter

**Detection:** Check config file for `mockMode: true` or equivalent without an expiry. Check if any warning is visible when mock mode is active.

**Phase:** Address when implementing the mock/fail test mode feature.

---

### Pitfall 7: QA Playbook Becomes Write-Once Documentation

**What goes wrong:** Internal QA playbooks that are too detailed become unmaintainable. Every time a feature changes, the playbook steps are stale. Conversely, playbooks that are too vague ("test the agent") provide no value. Both failure modes result in the playbook being ignored after the first month.

**Why it happens:** QA playbooks are documentation, and documentation rots faster than code. There is no automated check that the playbook steps still match the actual tool behavior. A renamed command, a changed argument schema, or a new feature silently invalidates playbook steps.

**Consequences:** New contributors run stale playbook steps that fail. They assume the feature is broken (not the docs). Or they skip the playbook entirely because it is clearly out of date. Manual QA coverage drops to zero without anyone noticing.

**Prevention:**
1. Playbook steps should be executable: each step is a concrete command with expected output (like a test case in prose)
2. Where possible, convert playbook steps to actual test scripts (even simple bash scripts that invoke `bun test` with specific test files)
3. Keep playbook granularity at feature-level, not step-level. "Test stocktake: run `/stocktake`, verify agents/skills/commands appear, verify lint errors are reported" — not "Step 1: Open TUI. Step 2: Type /stocktake. Step 3: Press Enter."
4. Link each playbook section to the corresponding test file. If `tests/tools/stocktake.test.ts` exists, the playbook says "Automated: see tests/tools/stocktake.test.ts. Manual: verify TUI rendering"
5. Review and update playbook at each milestone boundary, not continuously

**Detection:** At each release, run through the playbook. If more than 30% of steps reference non-existent commands, changed arguments, or produce different output than documented, the playbook has rotted.

**Phase:** Address when creating the QA playbook. Design the format to resist rot from the start.

---

### Pitfall 8: oc-configure Removal Breaks First-Run Experience

**What goes wrong:** PROJECT.md says "Remove oc-configure as slash command (keep CLI-only)." But the current first-load experience (line 237-241 in `index.ts`) shows a toast: "Run /oc-configure to set up your model assignments." Removing the command without updating this toast leaves new users with a broken instruction pointing to a command that does not exist.

**Why it happens:** The toast message is a string literal in `index.ts`, not linked to the command registry. Removing the command file from `assets/commands/` does not trigger any warning about dangling references. There may be other references to `/oc-configure` in agent prompts, skill files, or documentation.

**Consequences:** New user installs the plugin, sees "Run /oc-configure", types it, gets "command not found." First impression is that the plugin is broken. They may never discover the actual CLI configure path.

**Prevention:**
1. Search the entire codebase for "/oc-configure" and "oc-configure" before removing the command
2. Update the toast message to point to the correct CLI invocation
3. Add the old command filename to `DEPRECATED_ASSETS` in `installer.ts` to clean up from existing installs
4. Consider keeping a stub command that says "This command has moved to the CLI. Run `opencode autopilot configure` instead" (or whatever the CLI equivalent is)
5. Grep agent system prompts and skill content for references to the old command

**Detection:** Fresh install, first session — does the welcome toast give valid instructions?

**Phase:** Address immediately when removing the command. This is a blocker.

---

### Pitfall 9: Skill Dependency Resolution Creates Silent Ordering Bugs

**What goes wrong:** The skill system has dependency resolution via topological sort (`dependency-resolver.ts`). Adding more skills with interdependencies (e.g., `coding-standards` depends on `typescript-patterns`, `verification` depends on `tdd-workflow`) creates ordering constraints. If a cycle is introduced (A depends on B, B depends on A), the topological sort either fails silently or produces an arbitrary order.

**Why it happens:** Skill dependencies are declared in SKILL.md frontmatter. When expanding from 15 skills to potentially 25+, the dependency graph becomes harder to reason about. No validation currently prevents circular dependencies from being declared.

**Consequences:** Skills load in wrong order. A skill that assumes `tdd-workflow` was already injected references concepts that have not been defined yet. The AI receives contradictory instructions from skills loaded in the wrong sequence. In the worst case, a circular dependency causes the dependency resolver to drop skills entirely.

**Prevention:**
1. The linter must validate that declared dependencies reference existing skill names
2. The dependency resolver must detect cycles and report them as lint errors (not silently drop)
3. Add integration tests that load all bundled skills and verify the dependency graph is acyclic
4. Document skill dependency conventions: methodology skills should be independent (no deps), language skills may depend on `coding-standards`
5. Keep the dependency graph shallow: max depth 2 (A depends on B, B depends on nothing)

**Detection:** Run `oc_stocktake --lint` after adding new skills. If any skill references a dependency that does not exist, or if the resolver logs a cycle warning, this pitfall is active.

**Phase:** Address during skill expansion. Add linter rules before adding new skills.

---

## Minor Pitfalls

Issues that cause friction or technical debt but are not blocking.

### Pitfall 10: Agent Name Collisions with OpenCode Built-ins or Other Plugins

**What goes wrong:** Our config hook injects agents by name (e.g., `researcher`, `documenter`). If OpenCode adds a built-in agent with the same name, or another plugin also injects `researcher`, the `config.agent![name] === undefined` check (line 40 of `agents/index.ts`) means the first plugin to register wins. Our agent silently does not load.

**Prevention:**
1. Prefix all agent names with `oc-` (already done for pipeline agents: `oc-researcher`, `oc-planner`, etc.)
2. The non-prefixed agents (`researcher`, `metaprompter`, `documenter`, `pr-reviewer`) should be renamed to `oc-researcher`, `oc-metaprompter`, etc. for consistency
3. Check for conflicts at registration time and log a warning if an agent name was already taken

**Phase:** Address during the oc- prefix standardization work.

---

### Pitfall 11: Asset Installer Never Updates Existing User Files

**What goes wrong:** The installer uses `copyIfMissing` — it never overwrites user files. This means bug fixes to shipped skills, commands, or agents never reach users who already have the old version. The `FORCE_UPDATE_ASSETS` mechanism exists but requires manually adding filenames for each update.

**Prevention:**
1. Consider a version field in skill/command frontmatter. The installer compares versions and prompts/warns if the shipped version is newer
2. For critical fixes, use `FORCE_UPDATE_ASSETS` and accept that user customizations will be lost (document this in release notes)
3. Add a `oc_doctor` check that compares installed asset hashes against bundled asset hashes and reports drift

**Phase:** Address when expanding the asset catalog. More assets = more update surface.

---

### Pitfall 12: Expanding @-Callable Subagents Without Clear Discovery UX

**What goes wrong:** Adding many subagents (debugger, planner, doc-updater, etc.) that are @-callable creates a discoverability problem. Users do not know which subagents exist or what they do. The @ autocomplete list becomes long and undifferentiated.

**Prevention:**
1. Use `oc_stocktake` as the discovery mechanism — ensure it shows subagents with descriptions
2. Group subagents logically in the stocktake output (pipeline agents vs utility agents vs creation agents)
3. Limit the number of non-hidden subagents to under 10. If a subagent is only invoked by the orchestrator, make it `hidden: true`

**Phase:** Address during agent expansion. Set the hidden/visible policy before adding agents.

---

### Pitfall 13: Test Infrastructure Growth Without CI Integration

**What goes wrong:** Adding more tests (for new agents, skills, commands) increases `bun test` execution time. Without CI, test regressions are only caught when a developer remembers to run tests locally. The QA playbook says "run tests" but nobody does because the test suite takes too long.

**Prevention:**
1. Keep test suite execution under 30 seconds total
2. Organize tests by speed: unit tests (fast, no I/O) vs integration tests (filesystem, slower). Run unit tests on every change, integration tests before commits
3. Add CI when the test suite exceeds 50 test files (currently ~25)
4. Mock filesystem operations in unit tests to keep them fast

**Phase:** Address as test coverage grows. Monitor test execution time.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Command renaming (oc- prefix) | Pitfall 1: broken workflows, duplicate commands | Atomic rename with DEPRECATED_ASSETS cleanup. Test upgrade path |
| Stocktake fix | Pitfall 2: config-hook agents invisible | Query both filesystem AND agent registry. Add `origin: "config-hook"` |
| Agent expansion | Pitfall 3: Tab-cycle pollution | Strict subagent-only policy. Automated test enforcing this |
| Overall execution | Pitfall 4: research-execution gap | Gap ID tracking, acceptance criteria, phase reconciliation |
| Coding standards expansion | Pitfall 5: token budget overflow | Per-skill token cap (2000), linter enforcement, budget monitoring |
| Mock/fail mode | Pitfall 6: persistent mock state | Session-scoped only, TTL if persisted, visible warning |
| QA playbook creation | Pitfall 7: write-once documentation | Executable steps, linked to test files, feature-level granularity |
| oc-configure removal | Pitfall 8: broken first-run UX | Grep all references, update toast, add stub command |
| Skill expansion | Pitfall 9: dependency cycles | Linter validation, cycle detection, max depth 2 |
| Agent naming | Pitfall 10: name collisions | Prefix all agents with oc-, warn on conflict |
| Asset updates | Pitfall 11: stale user files | Version field in frontmatter, hash comparison in doctor |
| Subagent expansion | Pitfall 12: discovery UX | Stocktake as discovery, limit visible subagents to <10 |
| Test growth | Pitfall 13: slow/skipped tests | 30s target, unit/integration split, CI threshold |

---

## Sources

- OpenCode agents documentation: https://opencode.ai/docs/agents/
- OpenCode commands documentation: https://opencode.ai/docs/commands/
- OpenCode agent Tab cycle ordering issue (closed): https://github.com/anomalyco/opencode/issues/16840
- OpenCode plugin upgrade issue (stale dependencies): https://github.com/anomalyco/opencode/issues/10441
- Token waste analysis in AI coding agents: https://dev.to/nicolalessi/i-tracked-every-token-my-ai-coding-agent-consumed-for-a-week-70-was-waste-465
- Context window scaling challenges: https://factory.ai/news/context-window-problem
- Codebase analysis: `src/installer.ts` (DEPRECATED_ASSETS, FORCE_UPDATE_ASSETS, copyIfMissing)
- Codebase analysis: `src/tools/stocktake.ts` (filesystem-only agent scan)
- Codebase analysis: `src/agents/index.ts` (configHook agent injection)
- Codebase analysis: `src/skills/adaptive-injector.ts` (8000-token budget, stack tag detection)
- Codebase analysis: `src/index.ts` (first-load toast referencing /oc-configure)
- Phase 11 gap matrix: `.planning/phases/11-ecosystem-research/11-GAP-MATRIX.md`
