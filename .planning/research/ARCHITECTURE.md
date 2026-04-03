# Architecture Patterns

**Domain:** OpenCode Autopilot v4.0 — production quality improvements to existing plugin
**Researched:** 2026-04-03
**Focus:** Integration of v4.0 features with existing two-layer architecture

## Current Architecture Summary

The plugin has two layers that work differently for each asset type:

| Asset Type | Registration Method | Discovery by Stocktake |
|------------|-------------------|----------------------|
| **Agents** | `configHook` mutates `Config.agent` at runtime | Scans filesystem `~/.config/opencode/agents/*.md` |
| **Skills** | Filesystem: `~/.config/opencode/skills/<name>/SKILL.md` | Scans filesystem (works correctly) |
| **Commands** | Filesystem: `~/.config/opencode/commands/*.md` | Scans filesystem (works correctly) |

The core problem: **agents live in two places**. Pipeline agents (oc-architect, oc-implementer, etc.) and standard agents (researcher, documenter, etc.) are injected programmatically via `configHook` in `src/agents/index.ts`. They exist only in memory after config hook runs. Stocktake scans the filesystem (`~/.config/opencode/agents/`) and finds nothing because these agents were never written to disk.

### Existing Agent Inventory

**Standard agents** (registered in `src/agents/index.ts` `agents` map):
- researcher, metaprompter, documenter, pr-reviewer, autopilot

**Pipeline agents** (registered in `src/agents/pipeline/index.ts` `pipelineAgents` map):
- oc-researcher, oc-challenger, oc-architect, oc-critic, oc-explorer, oc-planner, oc-implementer, oc-reviewer, oc-shipper, oc-retrospector

**AGENT_REGISTRY** (in `src/registry/model-groups.ts`) maps all of these to 8 groups:
- architects, challengers, builders, reviewers, red-team, researchers, communicators, utilities

## Recommended Architecture for v4.0

No new directories or subsystems needed. All v4.0 changes modify existing components or add assets.

### Component Boundaries (unchanged + additions)

| Component | Responsibility | Changes in v4.0 |
|-----------|---------------|-----------------|
| `src/agents/` | Agent definitions + configHook registration | Add new agents (debugger, etc.), export registry helper |
| `src/tools/stocktake.ts` | Asset audit | Add config-hook agent detection |
| `src/installer.ts` | Self-healing asset copier | Expand `DEPRECATED_ASSETS` for renamed commands |
| `src/config.ts` | Config load/save/migrate | No changes needed (Zod defaults handle new fields) |
| `src/orchestrator/fallback/` | Fallback chain management | Add test mode injection |
| `src/registry/` | Agent-to-group mapping | Add new agent entries |
| `assets/commands/` | Slash command templates | Rename to oc-* prefix, add new commands |
| `assets/skills/` | Skill definitions | Add new skills for expanded coverage |
| `qa/` (NEW) | Manual QA playbook | Entirely new directory (documentation only) |

## Component Analysis: What Changes for v4.0

### 1. Stocktake Agent Detection Fix

**Root cause:** `stocktakeCore()` calls `safeReaddir(join(baseDir, "agents"))` which reads `~/.config/opencode/agents/`. Config-hook-injected agents don't exist there.

**Recommended approach:** Add a registry-aware detection layer alongside filesystem scanning.

```
BEFORE:  stocktake -> filesystem scan -> return results
AFTER:   stocktake -> filesystem scan + registry lookup -> merge & deduplicate -> return results
```

**New component:** None needed. Modify `stocktakeCore` to accept an optional `registeredAgents` parameter (a record of agent names from the config hook registry). The tool wrapper passes in the known agents from `AGENT_REGISTRY` + the `agents` map in `src/agents/index.ts`.

**Implementation detail:**
- Import `AGENT_REGISTRY` from `src/registry/model-groups.ts` for all registered agent names
- The `agents` map and `pipelineAgents` map keys are a subset of `AGENT_REGISTRY` keys -- use the registry as the single source
- For each registered agent, create an `AssetEntry` with `origin: "config-hook"` and `type: "agent"`
- Lint is N/A for injected agents (no YAML frontmatter to lint) -- mark as `lint: { valid: true, errors: [], warnings: [] }` with a note
- Deduplicate: if an agent exists both on filesystem and in registry, prefer the filesystem version (user may have customized it)

**New `AssetEntry.origin` value:** Add `"config-hook"` to the union type. This clearly signals to the user that the agent was injected programmatically rather than being a filesystem file.

**Data flow change:**
```typescript
// BEFORE
stocktakeCore(args: StocktakeArgs, baseDir: string): Promise<string>

// AFTER
stocktakeCore(
  args: StocktakeArgs,
  baseDir: string,
  registeredAgents?: ReadonlyMap<string, string>  // name -> group
): Promise<string>
```

The tool wrapper populates `registeredAgents` from `AGENT_REGISTRY`. The core function merges filesystem-found agents with registry agents, filesystem wins on name collision.

**Files modified:**
- `src/tools/stocktake.ts` -- add registry-aware agent detection, new origin type
- No changes to `src/agents/index.ts` needed -- `AGENT_REGISTRY` already exports all names

**Files created:** None.

**Confidence:** HIGH -- the registry data is already available, this is purely a wiring change.

### 2. Command Renaming (oc-* prefix)

**Current state:** Commands are filesystem .md files in `assets/commands/`. Current names: `brainstorm.md`, `new-agent.md`, `new-command.md`, `new-skill.md`, `oc-configure.md`, `quick.md`, `review-pr.md`, `stocktake.md`, `tdd.md`, `update-docs.md`, `write-plan.md`.

Note: `oc-configure.md` already has the prefix.

**Target state:** All commands prefixed with `oc-` (e.g., `/oc-stocktake`, `/oc-quick`) for namespace clarity.

**Migration concern:** Existing users have these files in `~/.config/opencode/commands/`. The installer uses `copyIfMissing` (COPYFILE_EXCL), so it will never overwrite existing files. Renaming source files alone won't affect existing installations.

**Recommended approach: Deprecation-driven rename (proven pattern)**

1. Rename all files in `assets/commands/` to `oc-*.md` (those without prefix)
2. Add old filenames to `DEPRECATED_ASSETS` in `src/installer.ts` for cleanup
3. The installer's existing deprecation cleanup removes old files on next load
4. `copyIfMissing` installs new names since they don't exist yet

**Files to rename:**
| Old Name | New Name |
|----------|----------|
| `brainstorm.md` | `oc-brainstorm.md` |
| `new-agent.md` | `oc-new-agent.md` |
| `new-command.md` | `oc-new-command.md` |
| `new-skill.md` | `oc-new-skill.md` |
| `quick.md` | `oc-quick.md` |
| `review-pr.md` | `oc-review-pr.md` |
| `stocktake.md` | `oc-stocktake.md` |
| `tdd.md` | `oc-tdd.md` |
| `update-docs.md` | `oc-update-docs.md` |
| `write-plan.md` | `oc-write-plan.md` |
| `oc-configure.md` | (already prefixed) |

**Files modified:**
- `assets/commands/*.md` -- rename all to `oc-` prefix
- `src/installer.ts` -- add 10 old command names to `DEPRECATED_ASSETS`
- `src/utils/validators.ts` -- update `BUILT_IN_COMMANDS` set if it references old names
- `src/tools/create-command.ts` -- verify `oc-` prefix enforcement in validation

**Files created:** None (just renames).

**Risk:** LOW. The `DEPRECATED_ASSETS` + `copyIfMissing` pattern is already proven -- see `commands/configure.md` already in `DEPRECATED_ASSETS`.

**Confidence:** HIGH -- exact same pattern already used for the configure.md removal.

### 3. Remove oc-configure as Slash Command

**Current state:** `oc-configure.md` exists in `assets/commands/` and is in `FORCE_UPDATE_ASSETS`. The command tells users to run the CLI wizard instead.

**Recommended approach:** 
1. Remove `oc-configure.md` from `assets/commands/`
2. Add `commands/oc-configure.md` to `DEPRECATED_ASSETS` in `src/installer.ts`
3. Remove from `FORCE_UPDATE_ASSETS`

**Risk:** LOW. Users who need to configure run the CLI wizard directly.

**Confidence:** HIGH.

### 4. Mock/Fail-Forced Fallback Mode

**Current state:** `oc_mock_fallback` tool exists in `src/tools/mock-fallback.ts`. It generates mock errors and classifies them but does NOT trigger actual fallback in a live session. It's a diagnostic/educational tool.

**The ask:** "Mock/fail-forced fallback mode accessible from CLI configure" -- a persistent config toggle that forces fallback behavior for testing.

**Recommended architecture: Config-driven runtime toggle**

Add a `testMode` field to the fallback config schema:

```typescript
// In src/orchestrator/fallback/fallback-config.ts
testMode: z.object({
  enabled: z.boolean().default(false),
  failureMode: z.enum([
    "rate_limit", "quota_exceeded", "timeout", "service_unavailable"
  ]).default("rate_limit"),
  failAfterMessages: z.number().min(1).default(3),
}).default({ enabled: false, failureMode: "rate_limit", failAfterMessages: 3 })
```

**Where it lives:** In the plugin config (`opencode-autopilot.json`) under `fallback.testMode`. Rationale:
- It persists across sessions (unlike a runtime-only toggle that resets)
- It's configurable via the CLI wizard or `oc_configure`
- It's part of the fallback subsystem where it logically belongs
- Zod `.default()` means existing configs auto-get the new field on parse -- no schema version bump needed

**Data flow:**
```
Plugin loads config -> fallback.testMode.enabled === true
  -> FallbackManager wraps provider calls with a counter
  -> After N successful messages, inject mock error matching failureMode
  -> Fallback chain activates as if real error occurred
  -> Toast notification: "Test mode: simulating {failureMode}"
  -> Session continues on fallback model
```

**Files modified:**
- `src/orchestrator/fallback/fallback-config.ts` -- add `testMode` to schema
- `src/orchestrator/fallback/index.ts` (FallbackManager) -- add test mode injection logic
- `src/tools/configure.ts` -- expose test mode toggle in configure flow (new subcommand or parameter)

**Files created:** None. The existing mock infrastructure (`src/observability/mock/`) provides error generators. FallbackManager calls `createMockError()` when test mode counter triggers.

**Why not a separate CLI flag:** CLI flags are session-scoped and require custom argument parsing. Config-driven means the setting persists and is visible/editable alongside other fallback settings.

**Why not just use `oc_mock_fallback`:** That tool only classifies errors -- it doesn't inject them into the live fallback chain. The test mode actually triggers the fallback flow end-to-end.

**Confidence:** MEDIUM -- the FallbackManager integration needs careful testing to ensure the mock error injection point is correct (it must happen where real provider errors surface).

### 5. New Agent Integration with configHook

**Current pattern (well-established):**

1. Define agent config in `src/agents/<name>.ts` as a frozen `AgentConfig` object
2. Add to the `agents` map in `src/agents/index.ts` (standard agents) or `pipelineAgents` in `src/agents/pipeline/index.ts` (pipeline agents)
3. Add to `AGENT_REGISTRY` in `src/registry/model-groups.ts` with group assignment
4. `configHook` -> `registerAgents()` handles model resolution and injection

**For new agents (debugger, etc.):**

Follow the exact same pattern. No architectural changes needed.

New agents should be:
- **Subagent mode** (`mode: "subagent"`) for @-callable agents like debugger
- Set `hidden: true` only for pipeline-internal agents not meant for direct user invocation
- Added to appropriate group in `AGENT_REGISTRY`

**Agent placement decision:** Should new agents go in `src/agents/` (standard) or `src/agents/pipeline/` (pipeline)?
- Pipeline agents are orchestrator phases -- they run as part of `oc_orchestrate`
- Standard agents are independently useful -- users invoke them via `@agent-name`
- New debugger agent = standard (independently useful, not a pipeline phase)
- New agents for expanded @-callable subagents = standard

**For the agents.md review command:**
This is a **command** (filesystem `.md` in `assets/commands/`), not a new agent. The command template instructs the LLM to read the project's `agents.md`, analyze it, and suggest improvements. It dispatches to the autopilot agent or a dedicated subagent.

**Confidence:** HIGH -- follows exact existing patterns with zero architectural novelty.

### 6. Tab-Cycle Ordering Fix

**Current understanding:** Agent modes control Tab behavior:
- `mode: "primary"` -- Tab-cycleable
- `mode: "subagent"` -- @-callable only
- `hidden: true` -- excluded from Tab AND @ autocomplete

The "fix Tab-cycle ordering" requirement likely means ensuring only the right agents appear in Tab cycle and in the right order. This is controlled by:
1. The `mode` field on each agent config
2. OpenCode's internal ordering (likely alphabetical or registration order)

**Approach:** Audit all registered agents and ensure correct `mode` values. If ordering within Tab cycle matters, investigate OpenCode's ordering behavior (may need `order` field if supported).

**Confidence:** MEDIUM -- need to verify how OpenCode orders Tab-cycle agents.

### 7. QA Playbook Structure

**Recommended architecture: Markdown playbook in repo**

The QA playbook is documentation for developers, not a runtime component.

```
qa/
  PLAYBOOK.md              # Master index with test matrix
  agents/
    autopilot.md           # Test scenarios for autopilot agent
    researcher.md          # Test scenarios for researcher
    pipeline-agents.md     # Test scenarios for pipeline agents
  tools/
    configure.md           # Test scenarios for oc_configure
    stocktake.md           # Test scenarios for oc_stocktake
    create-tools.md        # Test scenarios for creation tools
    mock-fallback.md       # Test scenarios for mock fallback
  flows/
    first-load.md          # First-load experience flow
    full-pipeline.md       # End-to-end orchestration flow
    fallback-chain.md      # Fallback activation and recovery
    memory-capture.md      # Memory capture and injection
  commands/
    all-commands.md        # Test each slash command
```

**Why not an interactive test runner:** The plugin runs inside OpenCode's TUI. There's no stdin for interactive prompts. Manual QA tests test the TUI experience, agent prompt quality, and integration with the host. Automated tests already exist in `tests/`.

**Each test file follows a template:**
```markdown
## Prerequisites
[Setup steps]

## Test Steps
1. Step with expected outcome

## Expected Behavior
[What should happen]

## Known Issues
[Current bugs or limitations]
```

**Files created:** `qa/` directory tree.
**Files modified:** None.

**Confidence:** HIGH -- pure documentation structure.

## Patterns to Follow

### Pattern 1: Registry-Aware Stocktake
**What:** Pass registered agent names into stocktakeCore alongside filesystem scan
**When:** Any tool that needs to enumerate all assets regardless of registration method
**Example:**
```typescript
// In stocktake tool wrapper
export const ocStocktake = tool({
  // ...
  async execute(args) {
    const registeredAgents = new Map(
      Object.entries(AGENT_REGISTRY).map(([name, entry]) => [name, entry.group])
    );
    return stocktakeCore(args, getGlobalConfigDir(), registeredAgents);
  },
});
```

### Pattern 2: Deprecation-Driven Rename
**What:** Use `DEPRECATED_ASSETS` array + `copyIfMissing` for non-breaking renames
**When:** Renaming any filesystem asset
**Example:**
```typescript
// In src/installer.ts
const DEPRECATED_ASSETS = [
  "agents/placeholder-agent.md",
  "commands/configure.md",
  // v4.0: old unprefixed command names
  "commands/stocktake.md",
  "commands/quick.md",
  "commands/brainstorm.md",
  // ... etc
] as const;
```

### Pattern 3: Config-Driven Feature Toggle via Zod Defaults
**What:** New optional config fields with Zod defaults, no schema version bump needed
**When:** Adding optional features like test mode
**Why:** Zod `.default()` means existing configs auto-get the new field on parse. No migration function needed unless the field is required or restructures existing data.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Filesystem Agents for Built-in Agents
**What:** Writing agent .md files to `~/.config/opencode/agents/` for plugin-provided agents
**Why bad:** Duplicates the configHook mechanism, creates two sources of truth. User edits to filesystem files get ignored when configHook runs since `registerAgents` skips agents already in `config.agent` (but they're set by the hook itself, not from filesystem).
**Instead:** Always use configHook for plugin-provided agents. Filesystem agents are for user-created agents only.

### Anti-Pattern 2: Schema Version Bump for Optional Fields
**What:** Adding a v6 schema + migration for a new optional field like `testMode`
**Why bad:** Unnecessary complexity. Zod `.default()` handles missing fields transparently on parse.
**Instead:** Only bump schema version when restructuring existing fields or adding required fields.

### Anti-Pattern 3: Interactive CLI Inside TUI
**What:** Building interactive test runners or wizards as OpenCode tools
**Why bad:** OpenCode tools return JSON strings to the LLM. There's no stdin for interactive prompts within a tool.
**Instead:** Interactive workflows go to the CLI binary (`bunx @kodrunhq/opencode-autopilot configure`). TUI tools are LLM-driven flows.

### Anti-Pattern 4: Coupling Stocktake to Agent File Content
**What:** Trying to read agent prompt content from config-hook-injected agents for linting
**Why bad:** Injected agents are TypeScript objects in memory, not markdown files. There's no YAML frontmatter to lint.
**Instead:** Skip linting for config-hook agents or add a separate validation path that checks the AgentConfig structure rather than markdown parsing.

## Data Flow (updated for v4.0)

### Plugin Load (unchanged + deprecation cleanup)
```
index.ts
  -> installAssets()
       -> cleanupDeprecatedAssets()    # removes old unprefixed commands
       -> forceUpdateAssets()          # (oc-configure removed from this list)
       -> copyIfMissing()             # installs new oc-* prefixed commands
  -> configHook(cfg)
       -> registerAgents(agents, ...)      # researcher, documenter, etc.
       -> registerAgents(pipelineAgents, ...) # oc-architect, etc.
       -> registerAgents(newAgents, ...)   # debugger, etc. (v4.0)
```

### Stocktake (fixed)
```
oc_stocktake tool wrapper
  -> builds registeredAgents map from AGENT_REGISTRY
  -> stocktakeCore(args, baseDir, registeredAgents)
       -> filesystem scan: skills/, commands/, agents/ dirs
       -> registry lookup: iterate registeredAgents map
       -> merge: filesystem entries + config-hook entries
       -> dedup: filesystem wins on name collision
       -> return combined inventory
```

### Fallback Test Mode (new)
```
loadConfig() -> fallback.testMode.enabled === true
  -> FallbackManager.messageCount tracks successful messages
  -> After failAfterMessages messages:
       -> createMockError(testMode.failureMode)
       -> Normal fallback chain activates
       -> Toast: "Test mode: simulating {failureMode}"
       -> Session continues on fallback model
  -> Counter resets after fallback activates
```

## Suggested Build Order

Based on dependency analysis:

```
Phase 1: Foundation (no dependencies, safe renames)
  1a. Command renaming (oc-* prefix)          # File renames + DEPRECATED_ASSETS
  1b. Remove oc-configure command              # DEPRECATED_ASSETS + remove FORCE_UPDATE
  1c. QA playbook directory structure          # Pure documentation, no code

Phase 2: Bug Fixes (depends on understanding registry)
  2a. Fix stocktake agent detection            # Modify stocktakeCore signature + logic
  2b. Clarify/remove general/explore agents    # Registry cleanup in AGENT_REGISTRY

Phase 3: New Assets (depends on Phase 1 naming, Phase 2 detection)
  3a. Add debugger agent                       # New agent definition + registry entry
  3b. Add agents.md review command             # New command file (oc-review-agents.md)
  3c. Expand @-callable subagents              # New agent definitions
  3d. Expand coding standards skills           # New skill directories
  3e. Fix Tab-cycle ordering                   # Agent mode/hidden adjustments

Phase 4: Fallback Test Mode (independent, parallel with Phase 3)
  4a. Add testMode to fallback config schema   # Schema extension with defaults
  4b. FallbackManager test mode injection      # Runtime logic
  4c. CLI configure test mode toggle           # Expose via configure subcommand

Phase 5: QA Execution (depends on all above)
  5a. Write QA test scenarios for all features
  5b. Run playbook, document results
```

**Rationale:**
- Phase 1 is pure infrastructure/naming with zero risk to functionality
- Phase 2 fixes the stocktake bug, needed to verify Phase 3 assets are detected correctly
- Phase 3 is the bulk content work (new agents, skills, commands) -- most effort here
- Phase 4 is isolated to the fallback subsystem, can run in parallel with Phase 3
- Phase 5 must come last because it tests everything above

## New vs Modified Components Summary

| Item | New or Modified | File(s) | Risk |
|------|----------------|---------|------|
| Stocktake registry detection | Modified | `src/tools/stocktake.ts` | LOW |
| Command oc-* prefix | Modified | `assets/commands/*.md`, `src/installer.ts` | LOW |
| Remove oc-configure command | Modified | `src/installer.ts` | LOW |
| Fallback test mode schema | Modified | `src/orchestrator/fallback/fallback-config.ts` | LOW |
| Fallback test mode injection | Modified | `src/orchestrator/fallback/index.ts` | MEDIUM |
| Configure test mode toggle | Modified | `src/tools/configure.ts` | LOW |
| AGENT_REGISTRY entries | Modified | `src/registry/model-groups.ts` | LOW |
| QA playbook | **New** | `qa/` directory tree | LOW |
| Debugger agent | **New** | `src/agents/debugger.ts` | LOW |
| Agents.md review command | **New** | `assets/commands/oc-review-agents.md` | LOW |
| New skills (languages, OOP) | **New** | `assets/skills/<name>/SKILL.md` | LOW |
| New subagents | **New** | `src/agents/<name>.ts` | LOW |

## Scalability Considerations

| Concern | Current (20 agents) | At 50 agents | At 100+ agents |
|---------|---------------------|--------------|----------------|
| configHook injection time | <1ms | <5ms | <10ms (still fine) |
| Stocktake scan time | <50ms | <100ms | Consider caching |
| AGENT_REGISTRY size | Frozen object, instant lookup | Same | Same |
| Command filesystem scan | <10ms | <20ms | Consider index file |

No scalability concerns at v4.0 target sizes.

## Sources

- `src/index.ts` lines 249-253 -- plugin configHook wiring, tool registration
- `src/agents/index.ts` -- configHook implementation, registerAgents pattern
- `src/agents/pipeline/index.ts` -- pipeline agent registration pattern
- `src/tools/stocktake.ts` -- current filesystem-only agent scanning (the bug)
- `src/installer.ts` -- DEPRECATED_ASSETS and FORCE_UPDATE_ASSETS patterns (proven migration)
- `src/config.ts` -- v1-v5 migration chain, Zod schema with defaults (no v6 needed)
- `src/registry/model-groups.ts` -- AGENT_REGISTRY with all 20 agents mapped to 8 groups
- `src/tools/mock-fallback.ts` -- existing mock error infrastructure (createMockError)
- `src/tools/configure.ts` -- configure subcommand pattern (start/assign/commit/doctor/reset)
- `assets/commands/*.md` -- current command inventory (11 commands, 1 already prefixed)
- `.planning/PROJECT.md` -- v4.0 requirements and constraints
