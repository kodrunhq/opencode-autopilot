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
  types.ts             All type definitions for the registry system
  model-groups.ts      AGENT_REGISTRY, GROUP_DEFINITIONS, DIVERSITY_RULES (frozen data)
  resolver.ts          resolveModelForAgent(), resolveModelForGroup()
  diversity.ts         checkDiversity(), extractFamily()
```

### 1.2 Type definitions (`src/registry/types.ts`)

```typescript
/**
 * The 8 model groups. Used as keys in config.groups and GROUP_DEFINITIONS.
 */
export type GroupId =
  | "architects"
  | "challengers"
  | "builders"
  | "reviewers"
  | "red-team"
  | "researchers"
  | "communicators"
  | "utilities";

/**
 * Model tier hint — used for display ordering and recommendations.
 * Does not affect resolution logic.
 */
export type ModelTier = "heavy" | "medium" | "light";

/**
 * Diversity warning severity.
 * "strong" — displayed with warning icon, explicitly recommended to change.
 * "soft" — displayed as suggestion, not a strong recommendation.
 */
export type DiversitySeverity = "strong" | "soft";

/**
 * Entry in the agent registry. Maps an agent name to its group.
 */
export interface AgentEntry {
  readonly group: GroupId;
}

/**
 * Metadata for a model group. Pure display/recommendation data.
 */
export interface GroupDefinition {
  readonly id: GroupId;
  readonly label: string;
  readonly purpose: string;
  readonly recommendation: string;
  readonly tier: ModelTier;
  readonly order: number;
}

/**
 * Adversarial diversity rule. Declares which groups should use
 * different model families for quality benefits.
 */
export interface DiversityRule {
  readonly groups: readonly GroupId[];
  readonly severity: DiversitySeverity;
  readonly reason: string;
}

/**
 * A model assignment for a group (stored in config).
 */
export interface GroupModelAssignment {
  readonly primary: string;
  readonly fallbacks: readonly string[];
}

/**
 * A per-agent override (stored in config.overrides).
 */
export interface AgentOverride {
  readonly primary: string;
  readonly fallbacks?: readonly string[];
}

/**
 * Resolved model for an agent — returned by the resolver.
 * `null` means no assignment found; agent uses OpenCode's default.
 */
export interface ResolvedModel {
  readonly primary: string;
  readonly fallbacks: readonly string[];
  readonly source: "override" | "group" | "default";
}

/**
 * Diversity warning emitted by checkDiversity().
 */
export interface DiversityWarning {
  readonly rule: DiversityRule;
  readonly sharedFamily: string;
  readonly groups: readonly GroupId[];
}
```

### 1.3 Agent registry (`src/registry/model-groups.ts`)

Maps every agent to its group. This is the **single source of truth** consumed by:
- `oc_configure` tool (display groups, map user choices to agents)
- CLI `install` (create starter config skeleton)
- CLI `doctor` (validate assignments, check diversity)
- `configHook` in `src/agents/index.ts` (resolve group → model for each agent at runtime)
- Config migration v3 → v4 (reverse-map flat models to groups)

```typescript
import type { AgentEntry, GroupId } from "./types";

export const AGENT_REGISTRY: Readonly<Record<string, AgentEntry>> = Object.freeze({
  // ── Architects ─────────────────────────────────────────────
  // Deep reasoning: system design, task decomposition, orchestration
  "oc-architect":    { group: "architects" },
  "oc-planner":      { group: "architects" },
  "autopilot":       { group: "architects" },

  // ── Challengers ────────────────────────────────────────────
  // Adversarial to Architects: critique proposals, enhance ideas
  "oc-critic":       { group: "challengers" },
  "oc-challenger":   { group: "challengers" },

  // ── Builders ───────────────────────────────────────────────
  // Code generation
  "oc-implementer":  { group: "builders" },

  // ── Reviewers ──────────────────────────────────────────────
  // Code analysis, adversarial to Builders
  // NOTE: The 21 internal ReviewAgent objects (logic-auditor, security-auditor,
  // etc.) are NOT in this registry. They use the ReviewAgent type from
  // src/review/types.ts, not AgentConfig. The review pipeline resolves their
  // model via resolveModelForGroup("reviewers") directly.
  "oc-reviewer":     { group: "reviewers" },

  // ── Red Team ───────────────────────────────────────────────
  // Final adversarial pass
  // NOTE: red-team and product-thinker are ALSO internal ReviewAgent objects
  // in STAGE3_AGENTS (src/review/agents/index.ts). They appear here so the
  // review pipeline can resolve their model via resolveModelForGroup("red-team")
  // separately from the "reviewers" group.
  "red-team":        { group: "red-team" },
  "product-thinker": { group: "red-team" },

  // ── Researchers ────────────────────────────────────────────
  // Domain research, feasibility analysis
  "oc-researcher":   { group: "researchers" },
  "researcher":      { group: "researchers" },

  // ── Communicators ──────────────────────────────────────────
  // Docs, changelogs, lesson extraction
  "oc-shipper":      { group: "communicators" },
  "documenter":      { group: "communicators" },
  "oc-retrospector": { group: "communicators" },

  // ── Utilities ──────────────────────────────────────────────
  // Fast lookups, prompt tuning, PR scanning
  "oc-explorer":     { group: "utilities" },
  "metaprompter":    { group: "utilities" },
  "pr-reviewer":     { group: "utilities" },
});

/**
 * All valid group IDs, derived from GROUP_DEFINITIONS keys.
 * Used for iteration and validation.
 */
export const ALL_GROUP_IDS: readonly GroupId[] = Object.freeze([
  "architects",
  "challengers",
  "builders",
  "reviewers",
  "red-team",
  "researchers",
  "communicators",
  "utilities",
]);
```

### 1.4 Group definitions (`src/registry/model-groups.ts`, same file)

```typescript
import type { GroupDefinition } from "./types";

export const GROUP_DEFINITIONS: Readonly<Record<GroupId, GroupDefinition>> = Object.freeze({
  architects: {
    id: "architects",
    label: "Architects",
    purpose: "System design, task decomposition, pipeline orchestration",
    recommendation: "Most powerful model available. Bad architecture cascades into everything downstream.",
    tier: "heavy",
    order: 1,
  },
  challengers: {
    id: "challengers",
    label: "Challengers",
    purpose: "Challenge architecture proposals, enhance ideas, find design flaws",
    recommendation: "Strong model, different family from Architects for genuine adversarial review.",
    tier: "heavy",
    order: 2,
  },
  builders: {
    id: "builders",
    label: "Builders",
    purpose: "Write production code",
    recommendation: "Strong coding model. This is where most tokens are spent.",
    tier: "heavy",
    order: 3,
  },
  reviewers: {
    id: "reviewers",
    label: "Reviewers",
    purpose: "Find bugs, security issues, logic errors in code",
    recommendation: "Strong model, different family from Builders to catch different classes of bugs.",
    tier: "heavy",
    order: 4,
  },
  "red-team": {
    id: "red-team",
    label: "Red Team",
    purpose: "Final adversarial pass — hunt exploits, find UX gaps",
    recommendation: "Different family from both Builders and Reviewers for a third perspective.",
    tier: "heavy",
    order: 5,
  },
  researchers: {
    id: "researchers",
    label: "Researchers",
    purpose: "Domain research, feasibility analysis, information gathering",
    recommendation: "Good context window and comprehension. Any model family works.",
    tier: "medium",
    order: 6,
  },
  communicators: {
    id: "communicators",
    label: "Communicators",
    purpose: "Write docs, changelogs, extract lessons",
    recommendation: "Mid-tier model. Clear writing matters more than deep reasoning.",
    tier: "light",
    order: 7,
  },
  utilities: {
    id: "utilities",
    label: "Utilities",
    purpose: "Fast lookups, prompt tuning, PR scanning",
    recommendation: "Fastest available model. Speed over intelligence — don't waste expensive tokens on grep.",
    tier: "light",
    order: 8,
  },
});
```

### 1.5 Diversity rules (`src/registry/model-groups.ts`, same file)

```typescript
import type { DiversityRule } from "./types";

export const DIVERSITY_RULES: readonly DiversityRule[] = Object.freeze([
  {
    groups: ["architects", "challengers"],
    severity: "strong",
    reason: "Challengers critique architect output. Same-model review creates confirmation bias — the model agrees with its own reasoning patterns.",
  },
  {
    groups: ["builders", "reviewers"],
    severity: "strong",
    reason: "Reviewers find bugs in builder code. Same model shares the same blind spots — it won't catch errors it would also make.",
  },
  {
    groups: ["red-team", "builders", "reviewers"],
    severity: "soft",
    reason: "Red Team is most effective as a third perspective. If you only have 2 model families, use whichever isn't assigned to Reviewers.",
  },
]);
```

### 1.6 Resolver (`src/registry/resolver.ts`)

Pure functions. No side effects. No filesystem access.

```typescript
import { AGENT_REGISTRY } from "./model-groups";
import type { AgentOverride, GroupId, GroupModelAssignment, ResolvedModel } from "./types";

/**
 * Extract model family (provider) from a model string.
 * "anthropic/claude-opus-4-6" → "anthropic"
 * "openai/gpt-5.4" → "openai"
 * Returns the full string if no "/" is found.
 */
export function extractFamily(model: string): string {
  const idx = model.indexOf("/");
  return idx === -1 ? model : model.slice(0, idx);
}

/**
 * Resolve model for a named agent.
 *
 * Resolution order:
 * 1. Per-agent override in overrides[agentName]
 * 2. Agent's group in AGENT_REGISTRY → groups[groupId]
 * 3. null (agent uses OpenCode's default model)
 */
export function resolveModelForAgent(
  agentName: string,
  groups: Readonly<Record<string, GroupModelAssignment>>,
  overrides: Readonly<Record<string, AgentOverride>>,
): ResolvedModel | null {
  // Tier 1: per-agent override
  const override = overrides[agentName];
  if (override) {
    return {
      primary: override.primary,
      fallbacks: override.fallbacks ?? [],
      source: "override",
    };
  }

  // Tier 2: group assignment
  const entry = AGENT_REGISTRY[agentName];
  if (entry) {
    const group = groups[entry.group];
    if (group) {
      return {
        primary: group.primary,
        fallbacks: group.fallbacks,
        source: "group",
      };
    }
  }

  // Tier 3: no assignment
  return null;
}

/**
 * Resolve model for a group directly (used by review pipeline for
 * internal ReviewAgent objects that are not in AGENT_REGISTRY).
 *
 * Used by:
 * - Review pipeline for the 19 universal+specialized agents → "reviewers"
 * - Review pipeline for red-team + product-thinker → "red-team"
 */
export function resolveModelForGroup(
  groupId: GroupId,
  groups: Readonly<Record<string, GroupModelAssignment>>,
): ResolvedModel | null {
  const group = groups[groupId];
  if (!group) return null;
  return {
    primary: group.primary,
    fallbacks: group.fallbacks,
    source: "group",
  };
}
```

### 1.7 Diversity checker (`src/registry/diversity.ts`)

```typescript
import { DIVERSITY_RULES } from "./model-groups";
import { extractFamily } from "./resolver";
import type { DiversityWarning, GroupId, GroupModelAssignment } from "./types";

/**
 * Check all diversity rules against current group assignments.
 * Returns warnings for adversarial pairs that share the same model family.
 *
 * Only checks groups that are assigned — unassigned groups are skipped
 * (no warning for missing assignments; that's the config validator's job).
 */
export function checkDiversity(
  groups: Readonly<Record<string, GroupModelAssignment>>,
): readonly DiversityWarning[] {
  const warnings: DiversityWarning[] = [];

  for (const rule of DIVERSITY_RULES) {
    // Extract families for all assigned groups in this rule
    const families = new Map<GroupId, string>();
    for (const groupId of rule.groups) {
      const assignment = groups[groupId];
      if (assignment) {
        families.set(groupId, extractFamily(assignment.primary));
      }
    }

    // Need at least 2 assigned groups to check diversity
    if (families.size < 2) continue;

    // For 2-group rules: warn if both use same family
    // For 3-group rules (red-team + builders + reviewers):
    //   warn if red-team shares family with ANY of the others
    if (rule.groups.length === 2) {
      const [familyA, familyB] = [...families.values()];
      if (familyA === familyB) {
        warnings.push({
          rule,
          sharedFamily: familyA,
          groups: [...families.keys()],
        });
      }
    } else {
      // Multi-group rule: check if any pair shares a family
      const entries = [...families.entries()];
      const seen = new Set<string>();
      for (const [groupId, family] of entries) {
        if (seen.has(family)) {
          // Find which groups share this family
          const sharing = entries
            .filter(([, f]) => f === family)
            .map(([g]) => g);
          warnings.push({
            rule,
            sharedFamily: family,
            groups: sharing,
          });
          break; // One warning per rule
        }
        seen.add(family);
      }
    }
  }

  return Object.freeze(warnings);
}
```

---

## 2. Config Schema V4

### 2.1 New schema (`src/config.ts`)

Added alongside existing v1/v2/v3 schemas. Follows the same migration chain pattern.

```typescript
// ── V4 sub-schemas ───────────────────────────────────────────

const groupModelAssignmentSchema = z.object({
  primary: z.string().min(1),
  fallbacks: z.array(z.string().min(1)).default([]),
});

const agentOverrideSchema = z.object({
  primary: z.string().min(1),
  fallbacks: z.array(z.string().min(1)).optional(),
});

// ── V4 schema ────────────────────────────────────────────────

const pluginConfigSchemaV4 = z.object({
  version: z.literal(4),
  configured: z.boolean(),
  groups: z.record(z.string(), groupModelAssignmentSchema).default({}),
  overrides: z.record(z.string(), agentOverrideSchema).default({}),
  orchestrator: orchestratorConfigSchema.default(orchestratorDefaults),
  confidence: confidenceConfigSchema.default(confidenceDefaults),
  fallback: fallbackConfigSchema.default(fallbackDefaults),
});

// Export aliases updated to v4
export const pluginConfigSchema = pluginConfigSchemaV4;
export type PluginConfig = z.infer<typeof pluginConfigSchemaV4>;
```

### 2.2 Migration v3 → v4

```typescript
import { AGENT_REGISTRY } from "./registry/model-groups";

function migrateV3toV4(v3Config: PluginConfigV3): PluginConfig {
  const groups: Record<string, { primary: string; fallbacks: string[] }> = {};
  const overrides: Record<string, { primary: string }> = {};

  // Step 1: Reverse-map v3 flat models to groups
  // v3.models is Record<string, string> where key is agent name, value is model id
  for (const [agentName, modelId] of Object.entries(v3Config.models)) {
    const entry = AGENT_REGISTRY[agentName];
    if (!entry) {
      // Agent not in registry — preserve as per-agent override
      overrides[agentName] = { primary: modelId };
      continue;
    }

    const groupId = entry.group;
    if (!groups[groupId]) {
      // First agent in this group sets the primary
      groups[groupId] = { primary: modelId, fallbacks: [] };
    } else if (groups[groupId].primary !== modelId) {
      // Different model for same group — becomes an override
      overrides[agentName] = { primary: modelId };
    }
    // Same model as group primary — no override needed
  }

  // Step 2: Migrate global fallback_models to per-group fallbacks
  const globalFallbacks = v3Config.fallback_models
    ? typeof v3Config.fallback_models === "string"
      ? [v3Config.fallback_models]
      : [...v3Config.fallback_models]
    : [];

  for (const group of Object.values(groups)) {
    if (group.fallbacks.length === 0 && globalFallbacks.length > 0) {
      group.fallbacks = [...globalFallbacks];
    }
  }

  return {
    version: 4 as const,
    configured: v3Config.configured,
    groups,
    overrides,
    orchestrator: v3Config.orchestrator,
    confidence: v3Config.confidence,
    fallback: v3Config.fallback,
  };
}
```

### 2.3 Updated loadConfig chain

```typescript
export async function loadConfig(configPath: string = CONFIG_PATH): Promise<PluginConfig | null> {
  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw);

    // Try v4 first
    const v4Result = pluginConfigSchemaV4.safeParse(parsed);
    if (v4Result.success) return v4Result.data;

    // Try v3 and migrate to v4
    const v3Result = pluginConfigSchemaV3.safeParse(parsed);
    if (v3Result.success) {
      const migrated = migrateV3toV4(v3Result.data);
      await saveConfig(migrated, configPath);
      return migrated;
    }

    // Try v2 → v3 → v4
    const v2Result = pluginConfigSchemaV2.safeParse(parsed);
    if (v2Result.success) {
      const v3 = migrateV2toV3(v2Result.data);
      const migrated = migrateV3toV4(v3);
      await saveConfig(migrated, configPath);
      return migrated;
    }

    // Try v1 → v2 → v3 → v4
    const v1Result = pluginConfigSchemaV1.safeParse(parsed);
    if (v1Result.success) {
      const v2 = migrateV1toV2(v1Result.data);
      const v3 = migrateV2toV3(v2);
      const migrated = migrateV3toV4(v3);
      await saveConfig(migrated, configPath);
      return migrated;
    }

    return pluginConfigSchemaV4.parse(parsed); // throw with proper error
  } catch (error: unknown) {
    if (isEnoentError(error)) return null;
    throw error;
  }
}
```

### 2.4 Updated createDefaultConfig

```typescript
export function createDefaultConfig(): PluginConfig {
  return {
    version: 4 as const,
    configured: false,
    groups: {},
    overrides: {},
    orchestrator: orchestratorDefaults,
    confidence: confidenceDefaults,
    fallback: fallbackDefaults,
  };
}
```

### 2.5 CONFIG_PATH

No change: `~/.config/opencode/opencode-autopilot.json` (same as before).

---

## 3. Thin CLI

### 3.1 Entry point (`bin/cli.ts`)

Registered in package.json:

```json
{
  "bin": {
    "opencode-autopilot": "bin/cli.ts"
  },
  "files": ["src/", "assets/", "bin/"]
}
```

The CLI is a single file with two subcommands. No external dependencies — uses only `node:fs/promises`, `node:path`, `node:os`, `node:child_process`, and project-internal imports from `src/registry/` and `src/config.ts`.

Shebang: `#!/usr/bin/env bun`

### 3.2 `install` subcommand

**Behavior (in order):**

1. **Check OpenCode installed:**
   - Run `opencode --version` via `execFile`
   - If not found: print error with link to install docs, exit 1
   - If found: print version with checkmark

2. **Locate opencode.json:**
   - Look in cwd for `opencode.json`
   - If not found: create `{ "plugin": [] }` and note it was created
   - If found: print path with checkmark

3. **Register plugin:**
   - Read and parse `opencode.json`
   - Check if `"@kodrunhq/opencode-autopilot"` is already in the `plugin` array
   - If not: add it, write back with 2-space indent
   - If already present: print "already registered" with checkmark
   - Handle edge case: if `plugin` key doesn't exist, create the array

4. **Create starter config:**
   - Check if `~/.config/opencode/opencode-autopilot.json` exists
   - If not: write `createDefaultConfig()` (version: 4, configured: false, empty groups)
   - If exists and `configured: true`: print "already configured" with checkmark
   - If exists and `configured: false`: print "config exists, not yet configured" with info

5. **Print next steps:**
   ```
   Next steps:

   1. Launch OpenCode
   2. Run /oc-configure to set up your model assignments

   Or paste this into your AI session for guided setup:

     https://raw.githubusercontent.com/kodrunhq/opencode-autopilot/main/docs/guide/installation.md
   ```

**Flags:**
- `--no-tui` — suppress any interactive prompts (future-proofing; currently install is non-interactive)
- `--help` — print usage

**Exit codes:**
- `0` — success
- `1` — OpenCode not installed or filesystem error

### 3.3 `doctor` subcommand

**Checks (in order):**

1. **OpenCode installed:** `opencode --version` → parse version string
2. **Plugin registered:** read `opencode.json` from cwd, check plugin array
3. **Config file exists:** check `~/.config/opencode/opencode-autopilot.json`
4. **Config schema valid:** parse with `pluginConfigSchemaV4`
5. **Setup completed:** check `configured === true`
6. **Model assignments:** for each group in `ALL_GROUP_IDS`, show primary → fallbacks
7. **Adversarial diversity:** run `checkDiversity()`, show results

**Output format:**

```
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

**Failure output examples:**

```
  Setup completed         ✗ configured: false — run /oc-configure in OpenCode
  Architects              ✗ not assigned
  Adversarial Diversity
    Architects ↔ Challengers    ⚠ both use anthropic — consider different families
```

**ANSI colors:**
- `✓` — green (`\x1b[32m`)
- `✗` — red (`\x1b[31m`)
- `⚠` — yellow (`\x1b[33m`)
- Labels — bold (`\x1b[1m`)
- Reset — `\x1b[0m`

**Exit codes:**
- `0` — all checks passed (warnings are OK)
- `1` — any check failed (✗)

### 3.4 CLI dispatch logic

```typescript
#!/usr/bin/env bun

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case "install":
    await runInstall(args.includes("--no-tui"));
    break;
  case "doctor":
    await runDoctor();
    break;
  case "--help":
  case "-h":
  case undefined:
    printUsage();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
}
```

---

## 4. `oc_configure` Tool

### 4.1 File: `src/tools/configure.ts`

Follows the standard tool pattern from `src/tools/create-agent.ts`:
- Exports `configureCore(args, projectRoot)` — pure testable function
- Exports `ocConfigure` — `tool()` wrapper

### 4.2 Tool schema

```typescript
import { tool } from "@opencode-ai/plugin";

export const ocConfigure = tool({
  description:
    "Configure model assignments for opencode-autopilot agent groups. " +
    "Subcommands: start (discover models), assign (set group model), " +
    "commit (persist), doctor (diagnose), reset (clear in-progress).",
  args: {
    subcommand: tool.schema
      .enum(["start", "assign", "commit", "doctor", "reset"])
      .describe("Action to perform"),
    group: tool.schema
      .string()
      .optional()
      .describe("Group ID for assign subcommand (e.g. 'architects')"),
    primary: tool.schema
      .string()
      .optional()
      .describe("Primary model ID for assign subcommand (e.g. 'anthropic/claude-opus-4-6')"),
    fallbacks: tool.schema
      .string()
      .optional()
      .describe("Comma-separated fallback model IDs for assign subcommand"),
  },
  async execute(args) {
    return configureCore(args);
  },
});
```

Note: `fallbacks` is a comma-separated string (not an array) because tool args are flat. The core function splits it: `args.fallbacks?.split(",").map(s => s.trim()).filter(Boolean) ?? []`.

### 4.3 Module-level state

```typescript
/**
 * In-progress group assignments, keyed by GroupId.
 * Populated by "assign" subcommand, persisted by "commit", cleared by "reset".
 * Held in memory — configuration is a single-session flow.
 */
let pendingAssignments: Map<string, GroupModelAssignment> = new Map();
```

### 4.4 Subcommand: `start`

**Input:** `{ subcommand: "start" }`

**Logic:**
1. Read `openCodeConfig` (module-level variable set by the `config` hook in `src/index.ts`)
2. Extract available models: iterate `openCodeConfig.agent` entries, collect unique `model` values. Also include `openCodeConfig.model` and `openCodeConfig.small_model` if set.
3. Group available models by provider (family): `extractFamily(model)` → `Map<string, string[]>`
4. Read current config via `loadConfig()`
5. Return JSON:

```json
{
  "action": "configure",
  "stage": "start",
  "availableModels": {
    "anthropic": ["anthropic/claude-opus-4-6", "anthropic/claude-sonnet-4-6", "anthropic/claude-haiku-4-5"],
    "openai": ["openai/gpt-5.4", "openai/gpt-5.4-mini"],
    "google": ["google/gemini-3.1-pro", "google/gemini-3-flash"]
  },
  "groups": [
    {
      "id": "architects",
      "label": "Architects",
      "purpose": "System design, task decomposition, pipeline orchestration",
      "recommendation": "Most powerful model available...",
      "tier": "heavy",
      "order": 1,
      "agents": ["oc-architect", "oc-planner", "autopilot"],
      "currentAssignment": null
    }
  ],
  "currentConfig": null,
  "diversityRules": [
    {
      "groups": ["architects", "challengers"],
      "severity": "strong",
      "reason": "..."
    }
  ]
}
```

The `groups[].agents` array is derived from AGENT_REGISTRY at call time (filter entries where `entry.group === groupId`). This means adding an agent to the registry automatically includes it in the configure flow.

If `currentConfig` exists and `configured: true`, include current assignments so the LLM can show "Here's your current setup, what would you like to change?"

### 4.5 Subcommand: `assign`

**Input:** `{ subcommand: "assign", group: "architects", primary: "anthropic/claude-opus-4-6", fallbacks: "openai/gpt-5.4,google/gemini-3.1-pro" }`

**Validation:**
- `group` must be a valid GroupId (member of `ALL_GROUP_IDS`)
- `primary` must be a non-empty string
- `fallbacks` parsed from comma-separated string; each must be non-empty

**Logic:**
1. Parse fallbacks: `args.fallbacks?.split(",").map(s => s.trim()).filter(Boolean) ?? []`
2. Store in `pendingAssignments.set(group, { primary, fallbacks })`
3. Run `checkDiversity()` against all currently-pending assignments
4. Return JSON:

```json
{
  "action": "configure",
  "stage": "assigned",
  "group": "architects",
  "primary": "anthropic/claude-opus-4-6",
  "fallbacks": ["openai/gpt-5.4", "google/gemini-3.1-pro"],
  "assignedCount": 1,
  "totalGroups": 8,
  "diversityWarnings": []
}
```

If diversity warnings exist:

```json
{
  "diversityWarnings": [
    {
      "groups": ["architects", "challengers"],
      "severity": "strong",
      "sharedFamily": "anthropic",
      "reason": "Challengers critique architect output. Same-model review creates confirmation bias..."
    }
  ]
}
```

### 4.6 Subcommand: `commit`

**Input:** `{ subcommand: "commit" }`

**Validation:**
- All 8 groups must be assigned (`pendingAssignments.size === ALL_GROUP_IDS.length`)
- If not: return error listing missing groups

**Logic:**
1. Load current config (or create default)
2. Build v4 config:
   ```typescript
   const newConfig: PluginConfig = {
     ...currentConfig,
     version: 4 as const,
     configured: true,
     groups: Object.fromEntries(pendingAssignments),
     overrides: currentConfig?.overrides ?? {},
   };
   ```
3. Save config via `saveConfig(newConfig)`
4. Clear `pendingAssignments`
5. Run final `checkDiversity()`
6. Return JSON:

```json
{
  "action": "configure",
  "stage": "committed",
  "groups": {
    "architects": { "primary": "anthropic/claude-opus-4-6", "fallbacks": ["openai/gpt-5.4"] },
    "challengers": { "primary": "openai/gpt-5.4", "fallbacks": ["google/gemini-3.1-pro"] }
  },
  "diversityWarnings": [],
  "configPath": "~/.config/opencode/opencode-autopilot.json"
}
```

### 4.7 Subcommand: `doctor`

**Input:** `{ subcommand: "doctor" }`

**Logic:**
Same checks as CLI doctor but returns structured JSON instead of formatted text. Shares `checkDiversity()` from `src/registry/diversity.ts`.

```json
{
  "action": "configure",
  "stage": "doctor",
  "checks": {
    "configExists": true,
    "schemaValid": true,
    "configured": true,
    "groupsAssigned": {
      "architects": { "assigned": true, "primary": "anthropic/claude-opus-4-6", "fallbacks": ["openai/gpt-5.4"] },
      "challengers": { "assigned": true, "primary": "openai/gpt-5.4", "fallbacks": [] }
    }
  },
  "diversityWarnings": [],
  "allPassed": true
}
```

### 4.8 Subcommand: `reset`

**Input:** `{ subcommand: "reset" }`

**Logic:**
1. `pendingAssignments.clear()`
2. Return `{ "action": "configure", "stage": "reset", "message": "All in-progress assignments cleared." }`

### 4.9 Registration in `src/index.ts`

```typescript
// Remove:
import { ocPlaceholder } from "./tools/placeholder";

// Add:
import { ocConfigure } from "./tools/configure";

// In tool map, replace oc_placeholder:
tool: {
  // oc_placeholder: ocPlaceholder,  ← REMOVED
  oc_configure: ocConfigure,         // ← ADDED
  oc_create_agent: ocCreateAgent,
  // ... rest unchanged
},
```

---

## 5. Updated configHook

### 5.1 Changes to `src/agents/index.ts`

The configHook currently ignores the `models` config map — agents register without model assignments. With v4, configHook reads the resolver to assign models from groups.

```typescript
import type { Config } from "@opencode-ai/plugin";
import { AGENT_REGISTRY } from "../registry/model-groups";
import { resolveModelForAgent } from "../registry/resolver";
import { loadConfig } from "../config";
import type { GroupModelAssignment, AgentOverride } from "../registry/types";

// ... existing agent imports unchanged ...

export async function configHook(config: Config): Promise<void> {
  if (!config.agent) {
    config.agent = {};
  }

  // Load plugin config for model resolution
  const pluginConfig = await loadConfig();
  const groups: Readonly<Record<string, GroupModelAssignment>> = pluginConfig?.groups ?? {};
  const overrides: Readonly<Record<string, AgentOverride>> = pluginConfig?.overrides ?? {};

  // Register standard agents
  for (const [name, agentConfig] of Object.entries(agents)) {
    if (config.agent[name] === undefined) {
      const resolved = resolveModelForAgent(name, groups, overrides);
      config.agent[name] = {
        ...agentConfig,
        ...(agentConfig.permission && { permission: { ...agentConfig.permission } }),
        ...(resolved && { model: resolved.primary }),
        ...(resolved && resolved.fallbacks.length > 0 && {
          fallback_models: [...resolved.fallbacks],
        }),
      };
    }
  }

  // Register pipeline agents
  for (const [name, agentConfig] of Object.entries(pipelineAgents)) {
    if (config.agent[name] === undefined) {
      const resolved = resolveModelForAgent(name, groups, overrides);
      config.agent[name] = {
        ...agentConfig,
        ...(agentConfig.permission && { permission: { ...agentConfig.permission } }),
        ...(resolved && { model: resolved.primary }),
        ...(resolved && resolved.fallbacks.length > 0 && {
          fallback_models: [...resolved.fallbacks],
        }),
      };
    }
  }
}
```

### 5.2 Fallback chain integration

The existing `resolveChain()` in `src/orchestrator/fallback/resolve-chain.ts` reads `config.agent[agentName].fallback_models` (tier 1) and `pluginConfig.fallback_models` (tier 2).

With v4, per-agent `fallback_models` are set by configHook from the group/override config. The global `fallback_models` field is removed (migrated into per-group fallbacks). So `resolveChain()` still works — it reads the per-agent `fallback_models` that configHook wrote.

**No changes to `resolve-chain.ts` or `fallback-manager.ts`.**

### 5.3 Review pipeline model integration

The review pipeline dispatches agents via JSON (see `src/tools/review.ts:183-209`). It returns `{ name, prompt }` pairs. Currently **no model is included in the dispatch**.

The review pipeline will be updated to include a `model` field in dispatch responses when a group assignment exists:

```typescript
// In src/review/pipeline.ts, where dispatch agents are built:
import { resolveModelForGroup } from "../registry/resolver";

// For universal + specialized agents (REVIEW_AGENTS + SPECIALIZED_AGENTS):
const reviewerModel = resolveModelForGroup("reviewers", pluginConfig.groups);

// For STAGE3_AGENTS (red-team, product-thinker):
const redTeamModel = resolveModelForGroup("red-team", pluginConfig.groups);

// Include in dispatch response:
agents: selectedAgents.map((agent) => ({
  name: agent.name,
  prompt: buildPrompt(agent, diff, memory),
  ...(isStage3(agent) ? redTeamModel && { model: redTeamModel.primary } : reviewerModel && { model: reviewerModel.primary }),
})),
```

Note: The OpenCode dispatch format's support for a `model` field in agent dispatch responses needs to be verified against the OpenCode plugin SDK. If not supported, the review pipeline will instead register temporary agent configs with model assignments via the config hook pattern.

---

## 6. `/oc-configure` Command Asset

### 6.1 File: `assets/commands/oc-configure.md`

Replaces the deleted `assets/commands/configure.md`.

```markdown
---
description: Configure opencode-autopilot model assignments for each agent group
---
Help the user configure opencode-autopilot by walking through the model
assignment process interactively.

Start by calling the oc_configure tool with subcommand "start". This returns:
- Available models grouped by provider (from the user's OpenCode config)
- The 8 agent groups with descriptions and recommendations
- Current assignments if reconfiguring
- Adversarial diversity rules

Then walk through each of the 8 agent groups in order (architects first,
utilities last), explaining for each:

1. What the group does and which agents belong to it
2. The model tier recommendation
3. For adversarial groups (challengers, reviewers, red-team): explain WHY
   model diversity matters and which group they're adversarial to
4. List available models from the user's providers

Ask the user to choose a primary model and optionally 1-3 fallback models.
Call oc_configure with subcommand "assign" for each group.

If the assign response contains diversityWarnings, explain them
conversationally. Strong warnings should be highlighted — the user can
still proceed, but make the quality trade-off clear.

After all 8 groups are assigned, call oc_configure with subcommand "commit"
to persist the configuration.

End by showing the final summary table and running the "doctor" subcommand
to verify everything is healthy.
```

### 6.2 Deleted: `assets/commands/configure.md`

The old file instructed users to edit JSON manually. It is deleted from the repository.

The self-healing installer (`src/installer.ts`) uses `COPYFILE_EXCL` — it never overwrites existing files. Users who already have `configure.md` in `~/.config/opencode/commands/` will keep it. New installs won't get it.

---

## 7. First-Load Experience

### 7.1 Updated event handler in `src/index.ts`

Replace the dead handler:

```typescript
// BEFORE (dead code):
event: async ({ event }) => {
  if (event.type === "session.created" && isFirstLoad(config)) {
    // First load: config wizard will be triggered via /configure command
    // Phase 2 will add the oc_configure tool
  }
  // ...
},

// AFTER:
event: async ({ event }) => {
  if (event.type === "session.created" && isFirstLoad(config)) {
    await sdkOps.showToast(
      "Welcome to OpenCode Autopilot!",
      "Run /oc-configure to set up your model assignments for each agent group.",
      "info",
    );
  }
  // ...
},
```

---

## 8. LLM Installation Guide

### 8.1 File: `docs/guide/installation.md`

Committed to the repository. Fetchable via raw GitHub URL.

### 8.2 Full content

```markdown
# Installation

## For Humans

Paste this into your AI session:

```
Install and configure opencode-autopilot by following the instructions here:
https://raw.githubusercontent.com/kodrunhq/opencode-autopilot/main/docs/guide/installation.md
```

**Alternative — do it yourself:**

```bash
bunx @kodrunhq/opencode-autopilot install
```

Then launch OpenCode and run `/oc-configure` to set up model assignments.

## For LLM Agents

> **IMPORTANT: Use `curl` to fetch this file, NOT WebFetch.**
> WebFetch summarizes content and loses critical details like group
> definitions, diversity rules, and model recommendations. Always use:
>
> ```bash
> curl -fsSL https://raw.githubusercontent.com/kodrunhq/opencode-autopilot/main/docs/guide/installation.md
> ```

### Step 0: Explain what this plugin does

Tell the user:

OpenCode Autopilot turns OpenCode into a fully autonomous software
development system. It provides:

- **8-phase autonomous pipeline** — from idea to shipped code
  (research → architecture → planning → implementation → review → docs)
- **21 specialized code review agents** — security, logic, concurrency,
  type soundness, stack-specific patterns (React, Go, Python, Rust, etc.)
- **Intelligent model routing** — different models for different jobs.
  Your architect designs in one model, your critic challenges in another,
  your red team attacks from a third perspective.
- **Automatic model fallback** — when a model is rate-limited, the system
  retries with the next model in the chain.

The key idea: **adversarial diversity**. Agents that review each other's
work should use different model families. Claude reviewing Claude's
architecture won't challenge it the way GPT would. The setup process
configures which model powers each agent group.

### Step 1: Install OpenCode (if not installed)

```bash
if command -v opencode &> /dev/null; then
    echo "OpenCode $(opencode --version) is installed"
else
    echo "OpenCode is not installed. Please install it first."
    echo "Visit: https://opencode.ai/docs"
fi
```

### Step 2: Run the CLI installer

```bash
bunx @kodrunhq/opencode-autopilot install --no-tui
```

This registers the plugin in opencode.json and creates a starter config.

### Step 3: Launch OpenCode and configure model assignments

Tell the user to launch OpenCode, then run /oc-configure.

The /oc-configure command will walk through 8 agent groups:

1. **Architects** — System design, planning, orchestration
   - Agents: oc-architect, oc-planner, autopilot
   - Recommendation: Most powerful model (e.g. Claude Opus, GPT-5.4)

2. **Challengers** — Challenge architecture, find design flaws
   - Agents: oc-critic, oc-challenger
   - Recommendation: Strong model, DIFFERENT FAMILY from Architects
   - ⚠ Same family = confirmation bias

3. **Builders** — Write production code
   - Agents: oc-implementer
   - Recommendation: Strong coding model

4. **Reviewers** — Find bugs, security issues, logic errors
   - Agents: oc-reviewer + 19 internal review agents
   - Recommendation: Strong model, DIFFERENT FAMILY from Builders
   - ⚠ Same family = shared blind spots

5. **Red Team** — Final adversarial pass, hunt exploits
   - Agents: red-team, product-thinker
   - Recommendation: DIFFERENT FAMILY from both Builders and Reviewers
   - ⚠ Most effective as a third perspective

6. **Researchers** — Domain research, feasibility
   - Agents: oc-researcher, researcher
   - Recommendation: Good comprehension, any family

7. **Communicators** — Docs, changelogs, lessons
   - Agents: oc-shipper, documenter, oc-retrospector
   - Recommendation: Mid-tier model, clear writing

8. **Utilities** — Fast lookups, scanning
   - Agents: oc-explorer, metaprompter, pr-reviewer
   - Recommendation: Fastest/cheapest model

For each group, the user picks a primary model and optional fallbacks.

### Step 4: Verify setup

```bash
bunx @kodrunhq/opencode-autopilot doctor
```

This checks config health, model assignments, and adversarial diversity.

### Step 5: Educate the user

After configuration, tell the user:

- Use the **autopilot** agent for full autonomous pipelines
- Use **/review-pr** to review pull requests with 21 agents
- Use **/new-agent**, **/new-skill**, **/new-command** to extend the plugin
- Run **/oc-configure** any time to change model assignments

### ⚠ Warning

Unless the user explicitly requests it, do not change model settings,
disable agents, or modify the configuration. The plugin works as
configured by the user.
```

---

## 9. Cleanup

| Item | File | Action |
|------|------|--------|
| Placeholder agent asset | `assets/agents/placeholder-agent.md` | **Delete** |
| Placeholder tool source | `src/tools/placeholder.ts` | **Delete** |
| Placeholder registration | `src/index.ts` line 21, 94 | **Remove** import and tool map entry |
| Old configure command | `assets/commands/configure.md` | **Delete** |
| Dead first-load handler | `src/index.ts` lines 107-110 | **Replace** with toast (see section 7) |
| v3 `models` field | `src/config.ts` | **Keep** v3 schema for migration, remove from v4 |
| v3 `fallback_models` field | `src/config.ts` | **Keep** in v3 schema for migration, remove from v4 |

---

## 10. Testing Strategy

### 10.1 Registry tests (`tests/registry/`)

**`model-groups.test.ts`:**
- AGENT_REGISTRY is frozen
- Every agent maps to a valid GroupId (member of ALL_GROUP_IDS)
- Every GroupId has at least one agent in AGENT_REGISTRY
- GROUP_DEFINITIONS has entries for all ALL_GROUP_IDS
- GROUP_DEFINITIONS fields are all non-empty strings
- GROUP_DEFINITIONS order values are sequential 1-8
- DIVERSITY_RULES groups all reference valid GroupIds
- No orphan GroupIds (every GroupId appears in GROUP_DEFINITIONS)

**`resolver.test.ts`:**
- `extractFamily("anthropic/claude-opus-4-6")` → `"anthropic"`
- `extractFamily("claude-opus")` → `"claude-opus"` (no slash)
- `resolveModelForAgent` with override returns override (source: "override")
- `resolveModelForAgent` with group returns group primary (source: "group")
- `resolveModelForAgent` with override takes precedence over group
- `resolveModelForAgent` unknown agent returns null
- `resolveModelForAgent` known agent but no group assignment returns null
- `resolveModelForGroup` with assignment returns it
- `resolveModelForGroup` with missing group returns null

**`diversity.test.ts`:**
- Same family on architects+challengers → strong warning
- Same family on builders+reviewers → strong warning
- All different families → empty warnings
- Unassigned groups in a rule → skipped (no warning)
- 3-group rule: red-team shares with builders → soft warning
- 3-group rule: all different → no warning

### 10.2 Config v4 tests (`tests/config.test.ts`)

- v4 round-trip: save and load
- v3 → v4 migration: flat models map becomes groups
- v3 → v4 migration: agents in same group with different models → override
- v3 → v4 migration: fallback_models string → per-group fallbacks
- v3 → v4 migration: fallback_models array → per-group fallbacks
- v1 → v2 → v3 → v4 chain migration works
- createDefaultConfig returns v4 with empty groups

### 10.3 CLI tests (`tests/cli/`)

- `install` with no opencode.json creates one
- `install` with existing opencode.json adds plugin
- `install` idempotent (doesn't duplicate plugin entry)
- `doctor` with valid config returns exit 0
- `doctor` with unconfigured config returns exit 1
- `doctor` diversity warnings show but don't fail (exit 0)

### 10.4 `oc_configure` tool tests (`tests/tools/configure.test.ts`)

- `start` returns group definitions and available models
- `assign` validates group is a valid GroupId
- `assign` stores assignment in pending state
- `assign` returns diversity warnings when applicable
- `commit` fails if not all groups assigned
- `commit` writes config with configured: true
- `commit` clears pending assignments
- `reset` clears pending assignments
- `doctor` returns structured diagnostic report
- Full flow: start → 8x assign → commit → doctor all pass

---

## 11. Files Created / Modified / Deleted

### New files (8)

| File | Purpose |
|------|---------|
| `src/registry/types.ts` | All type definitions for registry system |
| `src/registry/model-groups.ts` | AGENT_REGISTRY, GROUP_DEFINITIONS, DIVERSITY_RULES, ALL_GROUP_IDS |
| `src/registry/resolver.ts` | extractFamily, resolveModelForAgent, resolveModelForGroup |
| `src/registry/diversity.ts` | checkDiversity |
| `bin/cli.ts` | CLI entry point: install + doctor subcommands |
| `src/tools/configure.ts` | oc_configure tool: start/assign/commit/doctor/reset |
| `assets/commands/oc-configure.md` | Slash command instructing LLM to use oc_configure tool |
| `docs/guide/installation.md` | LLM-guided installation document |

### Modified files (4)

| File | Changes |
|------|---------|
| `package.json` | Add `"bin"` field, add `"bin/"` to `"files"` array |
| `src/index.ts` | Remove oc_placeholder import+registration, add oc_configure, replace dead first-load handler with toast |
| `src/config.ts` | Add v4 schema, v3→v4 migration, update loadConfig chain, update createDefaultConfig |
| `src/agents/index.ts` | configHook reads resolver for model+fallback assignments |

### Deleted files (3)

| File | Reason |
|------|--------|
| `assets/agents/placeholder-agent.md` | Replaced by real agents via configHook |
| `assets/commands/configure.md` | Replaced by `oc-configure.md` |
| `src/tools/placeholder.ts` | oc_placeholder tool removed; doctor replaces health-check role |
