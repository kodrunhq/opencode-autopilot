# Installer, Model Groups & Configuration UX

**Date:** 2026-04-02
**Status:** Approved
**Scope:** CLI installer, declarative agent group registry, `oc_configure` tool, LLM-guided installation, doctor command, config schema v4, placeholder cleanup

---

## Problem

The plugin has no onboarding UX. Users install it and see a confusing placeholder agent, a `/configure` command that says "edit JSON manually," and a dead first-load handler with a TODO comment. The actual agents work (registered via configHook) but nothing explains what happened or guides model assignment.

The plugin's core value — different models for different jobs, adversarial diversity for higher quality — is completely invisible without guided configuration.

## Solution

Three-layer installation system inspired by oh-my-openagent:

1. **Thin CLI** (`bunx @kodrunhq/opencode-autopilot install`) — bootstraps the plugin into OpenCode
2. **`oc_configure` tool** — in-session interactive model assignment via the AI
3. **LLM-guided installation doc** — the AI reads and walks the user through everything

All driven by a **declarative registry** — adding a new agent is one line, not a code change.

---

## 1. Declarative Registry

### 1.1 File structure

```
src/registry/
  types.ts             GroupId, GroupDefinition, AgentEntry, DiversityRule, ModelAssignment
  model-groups.ts      AGENT_REGISTRY, GROUP_DEFINITIONS, DIVERSITY_RULES (frozen data)
  resolver.ts          resolveModelForAgent(config, agentName) → { primary, fallbacks }
  diversity.ts         checkDiversity(config) → DiversityWarning[]
```

### 1.2 Agent registry

Maps every agent to its group. Single source of truth consumed by installer, configurator, doctor, configHook, and config migration.

```typescript
export const AGENT_REGISTRY = Object.freeze({
  // Architects — deep reasoning, system design
  "oc-architect":    { group: "architects" as const },
  "oc-planner":      { group: "architects" as const },
  "autopilot":       { group: "architects" as const },

  // Challengers — adversarial to architects
  "oc-critic":       { group: "challengers" as const },
  "oc-challenger":   { group: "challengers" as const },

  // Builders — code generation
  "oc-implementer":  { group: "builders" as const },

  // Reviewers — code analysis, adversarial to builders
  "oc-reviewer":     { group: "reviewers" as const },
  // The 21 review agents (logic-auditor, security-auditor, etc.) also
  // resolve against the "reviewers" group. They are internal to oc_review
  // and not registered in AGENT_REGISTRY (they use ReviewAgent type, not
  // AgentConfig). The resolver handles them via a separate lookup.

  // Red Team — final adversarial pass
  "red-team":        { group: "red-team" as const },
  "product-thinker": { group: "red-team" as const },

  // Researchers — comprehension, analysis
  "oc-researcher":   { group: "researchers" as const },
  "researcher":      { group: "researchers" as const },

  // Communicators — docs, changelogs, lessons
  "oc-shipper":      { group: "communicators" as const },
  "documenter":      { group: "communicators" as const },
  "oc-retrospector": { group: "communicators" as const },

  // Utilities — fast lookups, scanning
  "oc-explorer":     { group: "utilities" as const },
  "metaprompter":    { group: "utilities" as const },
  "pr-reviewer":     { group: "utilities" as const },
});
```

Adding a new agent: one line. All downstream consumers derive from this.

### 1.3 Group definitions

Metadata for display, recommendations, and ordering. No logic — pure data.

```typescript
export const GROUP_DEFINITIONS = Object.freeze({
  architects: {
    id: "architects" as const,
    label: "Architects",
    purpose: "System design, task decomposition, pipeline orchestration",
    recommendation: "Most powerful model available. Bad architecture cascades into everything downstream.",
    tier: "heavy" as const,
    order: 1,
  },
  challengers: {
    id: "challengers" as const,
    label: "Challengers",
    purpose: "Challenge architecture proposals, enhance ideas, find design flaws",
    recommendation: "Strong model, different family from Architects for genuine adversarial review.",
    tier: "heavy" as const,
    order: 2,
  },
  builders: {
    id: "builders" as const,
    label: "Builders",
    purpose: "Write production code",
    recommendation: "Strong coding model. This is where most tokens are spent.",
    tier: "heavy" as const,
    order: 3,
  },
  reviewers: {
    id: "reviewers" as const,
    label: "Reviewers",
    purpose: "Find bugs, security issues, logic errors in code",
    recommendation: "Strong model, different family from Builders to catch different classes of bugs.",
    tier: "heavy" as const,
    order: 4,
  },
  "red-team": {
    id: "red-team" as const,
    label: "Red Team",
    purpose: "Final adversarial pass — hunt exploits, find UX gaps",
    recommendation: "Different family from both Builders and Reviewers for a third perspective.",
    tier: "heavy" as const,
    order: 5,
  },
  researchers: {
    id: "researchers" as const,
    label: "Researchers",
    purpose: "Domain research, feasibility analysis, information gathering",
    recommendation: "Good context window and comprehension. Any model family works.",
    tier: "medium" as const,
    order: 6,
  },
  communicators: {
    id: "communicators" as const,
    label: "Communicators",
    purpose: "Write docs, changelogs, extract lessons",
    recommendation: "Mid-tier model. Clear writing matters more than deep reasoning.",
    tier: "light" as const,
    order: 7,
  },
  utilities: {
    id: "utilities" as const,
    label: "Utilities",
    purpose: "Fast lookups, prompt tuning, PR scanning",
    recommendation: "Fastest available model. Speed over intelligence — don't waste expensive tokens on grep.",
    tier: "light" as const,
    order: 8,
  },
});
```

### 1.4 Diversity rules

Declarative adversarial pairing constraints. The diversity checker iterates these — no hardcoded if-else chains.

```typescript
export const DIVERSITY_RULES = Object.freeze([
  {
    groups: ["architects", "challengers"] as const,
    severity: "strong" as const,
    reason: "Challengers critique architect output. Same-model review creates confirmation bias — the model agrees with its own reasoning patterns.",
  },
  {
    groups: ["builders", "reviewers"] as const,
    severity: "strong" as const,
    reason: "Reviewers find bugs in builder code. Same model shares the same blind spots — it won't catch errors it would also make.",
  },
  {
    groups: ["red-team", "builders", "reviewers"] as const,
    severity: "soft" as const,
    reason: "Red Team is most effective as a third perspective. If you only have 2 model families, use whichever isn't assigned to Reviewers.",
  },
]);
```

### 1.5 Resolver

Pure function. No side effects. Given config + agent name, returns the model to use.

```
Resolution order:
1. Per-agent override in config.overrides[agentName] → use that
2. Agent's group in AGENT_REGISTRY → config.groups[groupId] → use group's primary
3. No assignment found → return null (agent runs on OpenCode's default model)
```

For review agents (internal ReviewAgent type, not in AGENT_REGISTRY): the review pipeline calls the resolver with group `"reviewers"` directly. For red-team/product-thinker review agents: resolves against `"red-team"` group.

### 1.6 Diversity checker

Pure function. Reads config.groups, extracts model family (provider prefix before `/`), checks each DIVERSITY_RULE.

```typescript
type DiversityWarning = {
  readonly rule: DiversityRule;
  readonly sharedFamily: string;
  readonly groups: readonly string[];
};

function checkDiversity(groups: GroupConfig): readonly DiversityWarning[];
```

Returns empty array when all adversarial pairs use different families.

---

## 2. Config Schema V4

### 2.1 New schema

```typescript
const pluginConfigSchemaV4 = z.object({
  version: z.literal(4),
  configured: z.boolean(),
  groups: z.record(z.string(), z.object({
    primary: z.string(),
    fallbacks: z.array(z.string()).default([]),
  })).default({}),
  overrides: z.record(z.string(), z.object({
    primary: z.string(),
    fallbacks: z.array(z.string()).optional(),
  })).default({}),
  orchestrator: orchestratorConfigSchema.default(orchestratorDefaults),
  confidence: confidenceConfigSchema.default(confidenceDefaults),
  fallback: fallbackConfigSchema.default(fallbackDefaults),
});
```

### 2.2 Migration v3 → v4

The v3 `models` map (flat `agent-name → model-id`) migrates to v4 by:

1. For each entry in v3 `models`, look up the agent in AGENT_REGISTRY to find its group
2. If multiple agents in the same group have different models, use the first as primary
3. Any agent-specific differences become entries in `overrides`
4. `fallback_models` from v3 becomes the fallback chain for each group

Migration is automatic on load (same pattern as v1→v2→v3).

### 2.3 Example config

```json
{
  "version": 4,
  "configured": true,
  "groups": {
    "architects": {
      "primary": "anthropic/claude-opus-4-6",
      "fallbacks": ["openai/gpt-5.4"]
    },
    "challengers": {
      "primary": "openai/gpt-5.4",
      "fallbacks": ["google/gemini-3.1-pro"]
    },
    "builders": {
      "primary": "anthropic/claude-opus-4-6",
      "fallbacks": ["anthropic/claude-sonnet-4-6"]
    },
    "reviewers": {
      "primary": "openai/gpt-5.4",
      "fallbacks": ["google/gemini-3.1-pro"]
    },
    "red-team": {
      "primary": "google/gemini-3.1-pro",
      "fallbacks": ["openai/gpt-5.4"]
    },
    "researchers": {
      "primary": "anthropic/claude-sonnet-4-6",
      "fallbacks": ["openai/gpt-5.4"]
    },
    "communicators": {
      "primary": "anthropic/claude-sonnet-4-6",
      "fallbacks": ["anthropic/claude-haiku-4-5"]
    },
    "utilities": {
      "primary": "anthropic/claude-haiku-4-5",
      "fallbacks": ["google/gemini-3-flash"]
    }
  },
  "overrides": {},
  "orchestrator": { "autonomy": "full", "strictness": "normal" },
  "confidence": { "enabled": true },
  "fallback": { "enabled": true }
}
```

---

## 3. Thin CLI

### 3.1 Entry point

`bin/cli.ts` — registered via `"bin": { "opencode-autopilot": "bin/cli.ts" }` in package.json.

Two subcommands: `install` and `doctor`. No TUI framework — plain colored console output using ANSI escape codes.

### 3.2 `install` subcommand

```
$ bunx @kodrunhq/opencode-autopilot install

  opencode-autopilot installer
  ─────────────────────────────

  Checking OpenCode... ✓ v1.0.150
  Checking opencode.json... ✓ found at ./opencode.json

  Registering plugin... ✓ added @kodrunhq/opencode-autopilot to plugins
  Creating config... ✓ ~/.config/opencode/opencode-autopilot.json

  ─────────────────────────────

  Next steps:

  1. Launch OpenCode
  2. Run /oc-configure to set up your model assignments

  Or paste this into your AI session for guided setup:

    https://raw.githubusercontent.com/kodrunhq/opencode-autopilot/main/docs/guide/installation.md
```

Behavior:
- Checks `opencode --version` exists
- Finds `opencode.json` in cwd (or creates one)
- Adds `"@kodrunhq/opencode-autopilot"` to `plugin` array (idempotent)
- Creates starter config with `version: 4, configured: false, groups: {}`
- Prints next steps

Flags:
- `--no-tui` — suppress interactive prompts (for LLM-driven installation)
- `--help` — usage info

### 3.3 `doctor` subcommand

```
$ bunx @kodrunhq/opencode-autopilot doctor

  opencode-autopilot doctor
  ─────────────────────────

  System
    OpenCode installed      ✓ v1.0.150
    Plugin registered       ✓ opencode.json
    Config file             ✓ ~/.config/opencode/opencode-autopilot.json
    Config schema           ✓ v4
    Setup completed         ✓ configured: true

  Model Assignments
    Architects              anthropic/claude-opus-4-6 → openai/gpt-5.4
    Challengers             openai/gpt-5.4 → google/gemini-3.1-pro
    Builders                anthropic/claude-opus-4-6 → anthropic/claude-sonnet-4-6
    Reviewers               openai/gpt-5.4 → google/gemini-3.1-pro
    Red Team                google/gemini-3.1-pro → openai/gpt-5.4
    Researchers             anthropic/claude-sonnet-4-6 → openai/gpt-5.4
    Communicators           anthropic/claude-sonnet-4-6 → anthropic/claude-haiku-4-5
    Utilities               anthropic/claude-haiku-4-5 → google/gemini-3-flash

  Adversarial Diversity
    Architects ↔ Challengers    ✓ different families (anthropic ↔ openai)
    Builders ↔ Reviewers        ✓ different families (anthropic ↔ openai)
    Red Team ↔ Builders+Rev.    ✓ third family (google)

  All checks passed.
```

Shares the resolver and diversity checker from `src/registry/`. No duplicated logic.

When issues are found:
```
  Setup completed         ✗ configured: false — run /oc-configure in OpenCode

  Adversarial Diversity
    Architects ↔ Challengers    ⚠ both use anthropic — consider different families
```

---

## 4. `oc_configure` Tool

### 4.1 Registration

Registered as `oc_configure` in plugin's tool map alongside existing tools. Schema accepts subcommand-based dispatch.

### 4.2 Subcommands

**`start`** — Begin configuration or show current state
- Input: `{ subcommand: "start" }`
- Reads OpenCode config (from `config` hook) to extract available providers/models
- Reads current `opencode-autopilot.json` if it exists
- Returns: available models by provider, GROUP_DEFINITIONS, current assignments (if reconfiguring)

**`assign`** — Assign model(s) to a group
- Input: `{ subcommand: "assign", group: "architects", primary: "anthropic/claude-opus-4-6", fallbacks: ["openai/gpt-5.4"] }`
- Validates model strings are non-empty
- Stores assignment in tool-level state (not persisted yet)
- Runs diversity check against already-assigned groups
- Returns: success + any diversity warnings

**`commit`** — Persist all assignments
- Input: `{ subcommand: "commit" }`
- Validates all 8 groups have been assigned
- Writes config with `version: 4, configured: true`
- Returns: summary of all assignments + diversity report

**`doctor`** — Run diagnostics
- Input: `{ subcommand: "doctor" }`
- Same logic as CLI doctor, shared code from `src/registry/`
- Returns: structured diagnostic report

**`reset`** — Clear in-progress assignments and start over
- Input: `{ subcommand: "reset" }`
- Clears tool-level state
- Returns: confirmation

### 4.3 State management

`oc_configure` holds in-progress assignments in module-level state (same pattern as `oc_review`'s `current-review.json`, but in-memory since configuration is a single-session flow). On `commit`, state is flushed to disk and cleared.

### 4.4 Model discovery

The plugin already receives the full OpenCode config via the `config` hook:

```typescript
config: async (cfg: Config) => {
  openCodeConfig = cfg;
  await configHook(cfg);
}
```

`cfg` contains the provider and model definitions. The `start` subcommand reads `openCodeConfig` to enumerate what's available. No external discovery needed.

---

## 5. `/oc-configure` Command

### 5.1 Asset file

`assets/commands/oc-configure.md` — replaces the old `configure.md`.

```markdown
---
description: Configure opencode-autopilot model assignments for each agent group
---
Help the user configure opencode-autopilot by walking through the model
assignment process interactively.

Call the oc_configure tool with subcommand "start" to discover available
models and current configuration state.

Then walk through each of the 8 agent groups in order, explaining:
- What the group does and which agents belong to it
- The recommendation for model tier and adversarial diversity
- Available models from the user's configured providers

For each group, ask the user to choose a primary model and optional
fallback models. Call oc_configure with subcommand "assign" for each.

Surface any diversity warnings conversationally — explain WHY model
diversity matters for that specific pairing.

After all 8 groups are assigned, call oc_configure with subcommand
"commit" to persist the configuration.

End by showing the summary and running "doctor" to verify everything.
```

### 5.2 Old asset cleanup

`assets/commands/configure.md` — **deleted** from the repository and from the installer. The self-healing installer won't overwrite existing user files, so users who already have it will keep it, but new installs won't get it.

---

## 6. LLM Installation Guide

### 6.1 File location

`docs/guide/installation.md` — committed to the repository, fetchable via raw GitHub URL.

### 6.2 Structure

**For Humans:**
- Paste URL into AI session for guided install
- Or run `bunx @kodrunhq/opencode-autopilot install` manually
- After install, run `/oc-configure` in OpenCode

**For LLM Agents:**

**Step 0: Explain and greet**
- What the plugin does (8-phase pipeline, 21-agent review, model fallback)
- Core concept: different models for different jobs, adversarial diversity for quality
- "Your architect designs in Claude, your critic challenges in GPT, your red team attacks in Gemini"

**Step 1: Install OpenCode if needed**
- Check `opencode --version`
- Guide installation if missing

**Step 2: Run CLI installer**
```bash
bunx @kodrunhq/opencode-autopilot install --no-tui
```

**Step 3: Launch OpenCode and configure**
- Instruct user to launch OpenCode
- Call `oc_configure start` to discover available models
- Walk through all 8 groups with recommendations and diversity guidance
- Call `oc_configure assign` for each group
- Call `oc_configure commit` to persist

**Step 4: Verify**
```bash
bunx @kodrunhq/opencode-autopilot doctor
```

**Step 5: Educate**
- Table of all group assignments
- Explain key commands: `/oc-configure` (reconfigure), `/new-agent`, `/new-skill`, `/review-pr`
- Explain the pipeline: give the autopilot agent an idea
- Explain reconfiguration: `/oc-configure` any time

**Step 6: curl warning**
```markdown
> **IMPORTANT: Use `curl` to fetch this file, NOT WebFetch.**
> WebFetch summarizes content and loses critical details like group
> definitions and diversity rules.
```

---

## 7. Cleanup

| Item | Action |
|------|--------|
| `assets/agents/placeholder-agent.md` | **Delete.** Real agents register via configHook. |
| `src/tools/placeholder.ts` | **Delete.** `oc_placeholder` tool removed. |
| `oc_placeholder` registration in `index.ts` | **Remove** from tool map. |
| `assets/commands/configure.md` | **Delete.** Replaced by `assets/commands/oc-configure.md`. |
| Dead first-load handler in `index.ts` | **Replace** with toast: "Run /oc-configure to set up model assignments." |
| `src/config.ts` v3 schema | **Keep** for migration. Add v4 schema + v3→v4 migration function. |
| Config `models` flat map | **Migrated** to `groups` + `overrides` in v4. |
| Config `fallback_models` | **Migrated** into per-group fallback arrays. |
| `configHook` agent registration | **Updated** to read models from resolver instead of flat `models` map. |

---

## 8. Dependency Flow

```
bin/cli.ts ──────────────► src/registry/* (data + pure functions)
                                ▲
src/tools/configure.ts ─────────┤
                                │
src/config.ts (v4 schema) ──────┤
                                │
src/agents/index.ts (configHook)┘
```

The registry has **zero dependencies** on tools, config, or agents. Everything depends on the registry, not the other way around.

---

## 9. Testing Strategy

| Component | Test approach |
|-----------|--------------|
| `model-groups.ts` | Frozen data validation: all agents assigned, all groups have required fields, no orphan groups |
| `resolver.ts` | Pure function: override precedence, group resolution, null fallback |
| `diversity.ts` | Pure function: same-family detection, multi-group rules, empty config |
| `bin/cli.ts` | Integration: mock filesystem, verify opencode.json mutation, config creation |
| `oc_configure` | Tool subcommand tests: start/assign/commit/doctor/reset flows |
| Config v3→v4 migration | Round-trip: v3 JSON → migrate → validate v4 schema |

All registry functions are pure — no filesystem, no side effects. Trivially testable.

---

## 10. Files Created / Modified

### New files

```
src/registry/types.ts
src/registry/model-groups.ts
src/registry/resolver.ts
src/registry/diversity.ts
bin/cli.ts
src/tools/configure.ts
assets/commands/oc-configure.md
docs/guide/installation.md
```

### Modified files

```
package.json              — add "bin" field, bump version
src/index.ts              — remove oc_placeholder, add oc_configure, update first-load handler
src/config.ts             — add v4 schema + v3→v4 migration
src/agents/index.ts       — configHook uses resolver instead of flat models map
```

### Deleted files

```
assets/agents/placeholder-agent.md
assets/commands/configure.md
src/tools/placeholder.ts
```
