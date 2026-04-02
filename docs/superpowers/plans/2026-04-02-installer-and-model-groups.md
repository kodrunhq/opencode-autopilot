# Installer & Model Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a three-layer installation system (CLI + oc_configure tool + LLM guide) driven by a declarative agent group registry with adversarial diversity checking.

**Architecture:** Declarative registry (pure data + pure functions) at the bottom, consumed by config v4 schema, CLI, oc_configure tool, and configHook. No circular dependencies. Adding an agent = one line in the registry.

**Tech Stack:** TypeScript, Bun runtime, Zod validation, node:fs/promises, node:child_process

**Spec:** `docs/superpowers/specs/2026-04-02-installer-and-model-groups-design.md`

---

### Task 1: Registry types

**Files:**
- Create: `src/registry/types.ts`

- [ ] **Step 1: Create the type definitions file**

```typescript
// src/registry/types.ts

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

- [ ] **Step 2: Verify it compiles**

Run: `bunx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/registry/types.ts
git commit -m "feat: add registry type definitions for model groups"
```

---

### Task 2: Registry data + tests

**Files:**
- Create: `src/registry/model-groups.ts`
- Test: `tests/registry/model-groups.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/registry/model-groups.test.ts
import { describe, expect, test } from "bun:test";
import {
  AGENT_REGISTRY,
  ALL_GROUP_IDS,
  DIVERSITY_RULES,
  GROUP_DEFINITIONS,
} from "../../src/registry/model-groups";
import type { GroupId } from "../../src/registry/types";

describe("ALL_GROUP_IDS", () => {
  test("contains exactly 8 groups", () => {
    expect(ALL_GROUP_IDS).toHaveLength(8);
  });

  test("is frozen", () => {
    expect(Object.isFrozen(ALL_GROUP_IDS)).toBe(true);
  });
});

describe("AGENT_REGISTRY", () => {
  test("is frozen", () => {
    expect(Object.isFrozen(AGENT_REGISTRY)).toBe(true);
  });

  test("every agent maps to a valid GroupId", () => {
    for (const [name, entry] of Object.entries(AGENT_REGISTRY)) {
      expect(ALL_GROUP_IDS).toContain(entry.group);
    }
  });

  test("every GroupId has at least one agent", () => {
    for (const groupId of ALL_GROUP_IDS) {
      const agents = Object.entries(AGENT_REGISTRY).filter(
        ([, entry]) => entry.group === groupId,
      );
      expect(agents.length).toBeGreaterThan(0);
    }
  });

  test("contains all expected pipeline agents", () => {
    const expected = [
      "oc-architect",
      "oc-planner",
      "autopilot",
      "oc-critic",
      "oc-challenger",
      "oc-implementer",
      "oc-reviewer",
      "red-team",
      "product-thinker",
      "oc-researcher",
      "researcher",
      "oc-shipper",
      "documenter",
      "oc-retrospector",
      "oc-explorer",
      "metaprompter",
      "pr-reviewer",
    ];
    for (const name of expected) {
      expect(AGENT_REGISTRY).toHaveProperty(name);
    }
  });
});

describe("GROUP_DEFINITIONS", () => {
  test("has entries for all ALL_GROUP_IDS", () => {
    for (const groupId of ALL_GROUP_IDS) {
      expect(GROUP_DEFINITIONS).toHaveProperty(groupId);
    }
  });

  test("every definition has non-empty label, purpose, recommendation", () => {
    for (const def of Object.values(GROUP_DEFINITIONS)) {
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.purpose.length).toBeGreaterThan(0);
      expect(def.recommendation.length).toBeGreaterThan(0);
    }
  });

  test("order values are sequential 1-8", () => {
    const orders = Object.values(GROUP_DEFINITIONS)
      .map((d) => d.order)
      .sort((a, b) => a - b);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test("id field matches the key", () => {
    for (const [key, def] of Object.entries(GROUP_DEFINITIONS)) {
      expect(def.id).toBe(key);
    }
  });

  test("tier is one of heavy, medium, light", () => {
    for (const def of Object.values(GROUP_DEFINITIONS)) {
      expect(["heavy", "medium", "light"]).toContain(def.tier);
    }
  });
});

describe("DIVERSITY_RULES", () => {
  test("is frozen", () => {
    expect(Object.isFrozen(DIVERSITY_RULES)).toBe(true);
  });

  test("all referenced groups are valid GroupIds", () => {
    for (const rule of DIVERSITY_RULES) {
      for (const groupId of rule.groups) {
        expect(ALL_GROUP_IDS).toContain(groupId);
      }
    }
  });

  test("has 3 rules", () => {
    expect(DIVERSITY_RULES).toHaveLength(3);
  });

  test("severity is strong or soft", () => {
    for (const rule of DIVERSITY_RULES) {
      expect(["strong", "soft"]).toContain(rule.severity);
    }
  });

  test("architects-challengers rule is strong", () => {
    const rule = DIVERSITY_RULES.find(
      (r) => r.groups.includes("architects") && r.groups.includes("challengers"),
    );
    expect(rule).toBeDefined();
    expect(rule!.severity).toBe("strong");
  });

  test("builders-reviewers rule is strong", () => {
    const rule = DIVERSITY_RULES.find(
      (r) => r.groups.includes("builders") && r.groups.includes("reviewers"),
    );
    expect(rule).toBeDefined();
    expect(rule!.severity).toBe("strong");
  });

  test("red-team multi-group rule is soft", () => {
    const rule = DIVERSITY_RULES.find((r) => r.groups.includes("red-team"));
    expect(rule).toBeDefined();
    expect(rule!.severity).toBe("soft");
    expect(rule!.groups).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/registry/model-groups.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the registry data**

Create `src/registry/model-groups.ts` with the full content from spec section 1.3 + 1.4 + 1.5 (AGENT_REGISTRY, ALL_GROUP_IDS, GROUP_DEFINITIONS, DIVERSITY_RULES). All four exports in one file, all frozen.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/registry/model-groups.test.ts`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/registry/model-groups.ts tests/registry/model-groups.test.ts
git commit -m "feat: add declarative agent group registry with definitions and diversity rules"
```

---

### Task 3: Registry resolver + tests

**Files:**
- Create: `src/registry/resolver.ts`
- Test: `tests/registry/resolver.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/registry/resolver.test.ts
import { describe, expect, test } from "bun:test";
import {
  extractFamily,
  resolveModelForAgent,
  resolveModelForGroup,
} from "../../src/registry/resolver";
import type { AgentOverride, GroupModelAssignment } from "../../src/registry/types";

describe("extractFamily", () => {
  test("extracts provider from model string", () => {
    expect(extractFamily("anthropic/claude-opus-4-6")).toBe("anthropic");
  });

  test("extracts provider with multiple slashes", () => {
    expect(extractFamily("openai/gpt-5.4")).toBe("openai");
  });

  test("returns full string when no slash", () => {
    expect(extractFamily("claude-opus")).toBe("claude-opus");
  });

  test("returns empty string for slash-only", () => {
    expect(extractFamily("/model")).toBe("");
  });
});

describe("resolveModelForAgent", () => {
  const groups: Record<string, GroupModelAssignment> = {
    architects: { primary: "anthropic/claude-opus-4-6", fallbacks: ["openai/gpt-5.4"] },
    utilities: { primary: "anthropic/claude-haiku-4-5", fallbacks: [] },
  };

  const overrides: Record<string, AgentOverride> = {
    "oc-planner": { primary: "openai/gpt-5.4", fallbacks: ["google/gemini-3.1-pro"] },
  };

  test("returns override when agent has per-agent override", () => {
    const result = resolveModelForAgent("oc-planner", groups, overrides);
    expect(result).not.toBeNull();
    expect(result!.primary).toBe("openai/gpt-5.4");
    expect(result!.fallbacks).toEqual(["google/gemini-3.1-pro"]);
    expect(result!.source).toBe("override");
  });

  test("override takes precedence over group", () => {
    // oc-planner is in architects group, but has an override
    const result = resolveModelForAgent("oc-planner", groups, overrides);
    expect(result!.primary).toBe("openai/gpt-5.4"); // override, not architects
  });

  test("returns group primary when no override exists", () => {
    const result = resolveModelForAgent("oc-architect", groups, {});
    expect(result).not.toBeNull();
    expect(result!.primary).toBe("anthropic/claude-opus-4-6");
    expect(result!.fallbacks).toEqual(["openai/gpt-5.4"]);
    expect(result!.source).toBe("group");
  });

  test("returns null for unknown agent", () => {
    const result = resolveModelForAgent("nonexistent-agent", groups, {});
    expect(result).toBeNull();
  });

  test("returns null for known agent with no group assignment", () => {
    // oc-implementer is in builders group, but builders not in groups
    const result = resolveModelForAgent("oc-implementer", groups, {});
    expect(result).toBeNull();
  });

  test("override without fallbacks returns empty fallbacks array", () => {
    const overridesNoFallback: Record<string, AgentOverride> = {
      autopilot: { primary: "google/gemini-3.1-pro" },
    };
    const result = resolveModelForAgent("autopilot", groups, overridesNoFallback);
    expect(result!.fallbacks).toEqual([]);
  });
});

describe("resolveModelForGroup", () => {
  const groups: Record<string, GroupModelAssignment> = {
    reviewers: { primary: "openai/gpt-5.4", fallbacks: ["google/gemini-3.1-pro"] },
  };

  test("returns assignment for existing group", () => {
    const result = resolveModelForGroup("reviewers", groups);
    expect(result).not.toBeNull();
    expect(result!.primary).toBe("openai/gpt-5.4");
    expect(result!.fallbacks).toEqual(["google/gemini-3.1-pro"]);
    expect(result!.source).toBe("group");
  });

  test("returns null for missing group", () => {
    const result = resolveModelForGroup("architects", groups);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/registry/resolver.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the resolver**

Create `src/registry/resolver.ts` with the full content from spec section 1.6 (extractFamily, resolveModelForAgent, resolveModelForGroup).

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/registry/resolver.test.ts`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/registry/resolver.ts tests/registry/resolver.test.ts
git commit -m "feat: add model resolver with override > group > null precedence"
```

---

### Task 4: Registry diversity checker + tests

**Files:**
- Create: `src/registry/diversity.ts`
- Test: `tests/registry/diversity.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/registry/diversity.test.ts
import { describe, expect, test } from "bun:test";
import { checkDiversity } from "../../src/registry/diversity";
import type { GroupModelAssignment } from "../../src/registry/types";

describe("checkDiversity", () => {
  test("returns empty when all adversarial pairs use different families", () => {
    const groups: Record<string, GroupModelAssignment> = {
      architects: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
      challengers: { primary: "openai/gpt-5.4", fallbacks: [] },
      builders: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
      reviewers: { primary: "openai/gpt-5.4", fallbacks: [] },
      "red-team": { primary: "google/gemini-3.1-pro", fallbacks: [] },
    };
    const warnings = checkDiversity(groups);
    expect(warnings).toHaveLength(0);
  });

  test("warns when architects and challengers share a family (strong)", () => {
    const groups: Record<string, GroupModelAssignment> = {
      architects: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
      challengers: { primary: "anthropic/claude-sonnet-4-6", fallbacks: [] },
    };
    const warnings = checkDiversity(groups);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].sharedFamily).toBe("anthropic");
    expect(warnings[0].rule.severity).toBe("strong");
    expect(warnings[0].groups).toContain("architects");
    expect(warnings[0].groups).toContain("challengers");
  });

  test("warns when builders and reviewers share a family (strong)", () => {
    const groups: Record<string, GroupModelAssignment> = {
      builders: { primary: "openai/gpt-5.4", fallbacks: [] },
      reviewers: { primary: "openai/gpt-5.4-mini", fallbacks: [] },
    };
    const warnings = checkDiversity(groups);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].rule.severity).toBe("strong");
  });

  test("warns when red-team shares family with builders (soft)", () => {
    const groups: Record<string, GroupModelAssignment> = {
      builders: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
      reviewers: { primary: "openai/gpt-5.4", fallbacks: [] },
      "red-team": { primary: "anthropic/claude-sonnet-4-6", fallbacks: [] },
    };
    const warnings = checkDiversity(groups);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].rule.severity).toBe("soft");
  });

  test("skips rules when groups are not assigned", () => {
    const groups: Record<string, GroupModelAssignment> = {
      architects: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
      // challengers not assigned — rule skipped
    };
    const warnings = checkDiversity(groups);
    expect(warnings).toHaveLength(0);
  });

  test("3-group rule: all different families = no warning", () => {
    const groups: Record<string, GroupModelAssignment> = {
      builders: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
      reviewers: { primary: "openai/gpt-5.4", fallbacks: [] },
      "red-team": { primary: "google/gemini-3.1-pro", fallbacks: [] },
    };
    const warnings = checkDiversity(groups);
    const redTeamWarning = warnings.find((w) => w.rule.groups.includes("red-team"));
    expect(redTeamWarning).toBeUndefined();
  });

  test("returns frozen array", () => {
    const warnings = checkDiversity({});
    expect(Object.isFrozen(warnings)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/registry/diversity.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the diversity checker**

Create `src/registry/diversity.ts` with the full content from spec section 1.7.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/registry/diversity.test.ts`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/registry/diversity.ts tests/registry/diversity.test.ts
git commit -m "feat: add adversarial diversity checker for model group assignments"
```

---

### Task 5: Config schema v4 + migration + tests

**Files:**
- Modify: `src/config.ts`
- Modify: `tests/config.test.ts`

- [ ] **Step 1: Write the failing tests**

Add a new describe block to `tests/config.test.ts`:

```typescript
// Append to tests/config.test.ts

describe("v3 to v4 migration", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `opencode-config-v3v4-migration-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    configPath = join(tempDir, "opencode-autopilot.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("loadConfig on a v3 JSON file returns v4 config with groups", async () => {
    const v3Config = {
      version: 3,
      configured: true,
      models: {
        "oc-architect": "anthropic/claude-opus-4-6",
        "oc-planner": "anthropic/claude-opus-4-6",
        "oc-implementer": "openai/gpt-5.4",
      },
      orchestrator: {
        autonomy: "full",
        strictness: "normal",
        phases: {
          recon: true, challenge: true, architect: true, explore: true,
          plan: true, build: true, ship: true, retrospective: true,
        },
      },
      confidence: { enabled: true, thresholds: { proceed: "MEDIUM", abort: "LOW" } },
      fallback: {
        enabled: true, retryOnErrors: [429], retryableErrorPatterns: [],
        maxFallbackAttempts: 10, cooldownSeconds: 60, timeoutSeconds: 30,
        notifyOnFallback: true,
      },
    };
    await writeFile(configPath, JSON.stringify(v3Config), "utf-8");

    const result = await loadConfig(configPath);
    expect(result).not.toBeNull();
    expect(result!.version).toBe(4);
    expect(result!.configured).toBe(true);
    // oc-architect and oc-planner are both "architects" group with same model
    expect(result!.groups.architects).toBeDefined();
    expect(result!.groups.architects.primary).toBe("anthropic/claude-opus-4-6");
    // oc-implementer is "builders" group
    expect(result!.groups.builders).toBeDefined();
    expect(result!.groups.builders.primary).toBe("openai/gpt-5.4");
  });

  test("v3 agents with different models in same group become overrides", async () => {
    const v3Config = {
      version: 3,
      configured: true,
      models: {
        "oc-architect": "anthropic/claude-opus-4-6",
        "oc-planner": "openai/gpt-5.4", // different from oc-architect, same group
      },
      orchestrator: {
        autonomy: "full", strictness: "normal",
        phases: { recon: true, challenge: true, architect: true, explore: true,
          plan: true, build: true, ship: true, retrospective: true },
      },
      confidence: { enabled: true, thresholds: { proceed: "MEDIUM", abort: "LOW" } },
      fallback: {
        enabled: true, retryOnErrors: [429], retryableErrorPatterns: [],
        maxFallbackAttempts: 10, cooldownSeconds: 60, timeoutSeconds: 30,
        notifyOnFallback: true,
      },
    };
    await writeFile(configPath, JSON.stringify(v3Config), "utf-8");

    const result = await loadConfig(configPath);
    expect(result!.version).toBe(4);
    // First agent sets group primary, second becomes override
    expect(result!.groups.architects.primary).toBe("anthropic/claude-opus-4-6");
    expect(result!.overrides["oc-planner"]).toBeDefined();
    expect(result!.overrides["oc-planner"].primary).toBe("openai/gpt-5.4");
  });

  test("v3 fallback_models string migrates to per-group fallbacks", async () => {
    const v3Config = {
      version: 3,
      configured: true,
      models: { "oc-architect": "anthropic/claude-opus-4-6" },
      fallback_models: "openai/gpt-5.4",
      orchestrator: {
        autonomy: "full", strictness: "normal",
        phases: { recon: true, challenge: true, architect: true, explore: true,
          plan: true, build: true, ship: true, retrospective: true },
      },
      confidence: { enabled: true, thresholds: { proceed: "MEDIUM", abort: "LOW" } },
      fallback: {
        enabled: true, retryOnErrors: [429], retryableErrorPatterns: [],
        maxFallbackAttempts: 10, cooldownSeconds: 60, timeoutSeconds: 30,
        notifyOnFallback: true,
      },
    };
    await writeFile(configPath, JSON.stringify(v3Config), "utf-8");

    const result = await loadConfig(configPath);
    expect(result!.groups.architects.fallbacks).toEqual(["openai/gpt-5.4"]);
  });

  test("v3 fallback_models array migrates to per-group fallbacks", async () => {
    const v3Config = {
      version: 3,
      configured: true,
      models: { "oc-implementer": "anthropic/claude-opus-4-6" },
      fallback_models: ["openai/gpt-5.4", "google/gemini-3.1-pro"],
      orchestrator: {
        autonomy: "full", strictness: "normal",
        phases: { recon: true, challenge: true, architect: true, explore: true,
          plan: true, build: true, ship: true, retrospective: true },
      },
      confidence: { enabled: true, thresholds: { proceed: "MEDIUM", abort: "LOW" } },
      fallback: {
        enabled: true, retryOnErrors: [429], retryableErrorPatterns: [],
        maxFallbackAttempts: 10, cooldownSeconds: 60, timeoutSeconds: 30,
        notifyOnFallback: true,
      },
    };
    await writeFile(configPath, JSON.stringify(v3Config), "utf-8");

    const result = await loadConfig(configPath);
    expect(result!.groups.builders.fallbacks).toEqual(["openai/gpt-5.4", "google/gemini-3.1-pro"]);
  });

  test("v3 config writes migrated v4 back to disk", async () => {
    const v3Config = {
      version: 3, configured: true, models: {},
      orchestrator: {
        autonomy: "full", strictness: "normal",
        phases: { recon: true, challenge: true, architect: true, explore: true,
          plan: true, build: true, ship: true, retrospective: true },
      },
      confidence: { enabled: true, thresholds: { proceed: "MEDIUM", abort: "LOW" } },
      fallback: {
        enabled: true, retryOnErrors: [429], retryableErrorPatterns: [],
        maxFallbackAttempts: 10, cooldownSeconds: 60, timeoutSeconds: 30,
        notifyOnFallback: true,
      },
    };
    await writeFile(configPath, JSON.stringify(v3Config), "utf-8");
    await loadConfig(configPath);

    const raw = JSON.parse(await readFile(configPath, "utf-8"));
    expect(raw.version).toBe(4);
    expect(raw.groups).toBeDefined();
    expect(raw.overrides).toBeDefined();
  });
});

describe("v4 direct load", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `opencode-config-v4-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    configPath = join(tempDir, "opencode-autopilot.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("loadConfig on a v4 JSON file returns v4 config directly", async () => {
    const v4Config = {
      version: 4,
      configured: true,
      groups: {
        architects: { primary: "anthropic/claude-opus-4-6", fallbacks: ["openai/gpt-5.4"] },
      },
      overrides: {},
      orchestrator: {
        autonomy: "full", strictness: "normal",
        phases: { recon: true, challenge: true, architect: true, explore: true,
          plan: true, build: true, ship: true, retrospective: true },
      },
      confidence: { enabled: true, thresholds: { proceed: "MEDIUM", abort: "LOW" } },
      fallback: {
        enabled: true, retryOnErrors: [429], retryableErrorPatterns: [],
        maxFallbackAttempts: 10, cooldownSeconds: 60, timeoutSeconds: 30,
        notifyOnFallback: true,
      },
    };
    await writeFile(configPath, JSON.stringify(v4Config), "utf-8");

    const result = await loadConfig(configPath);
    expect(result!.version).toBe(4);
    expect(result!.groups.architects.primary).toBe("anthropic/claude-opus-4-6");
    expect(result!.groups.architects.fallbacks).toEqual(["openai/gpt-5.4"]);
  });

  test("createDefaultConfig returns v4 with empty groups", () => {
    const config = createDefaultConfig();
    expect(config.version).toBe(4);
    expect(config.configured).toBe(false);
    expect(config.groups).toEqual({});
    expect(config.overrides).toEqual({});
  });

  test("v1 → v2 → v3 → v4 full chain migration works", async () => {
    const v1Config = { version: 1, configured: true, models: { default: "gpt-4" } };
    await writeFile(configPath, JSON.stringify(v1Config), "utf-8");

    const result = await loadConfig(configPath);
    expect(result!.version).toBe(4);
    expect(result!.configured).toBe(true);
    expect(result!.groups).toBeDefined();
    expect(result!.overrides).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/config.test.ts`
Expected: new tests FAIL (v4 schema doesn't exist yet)

- [ ] **Step 3: Implement v4 schema and migration**

Modify `src/config.ts`:
- Add v4 sub-schemas (`groupModelAssignmentSchema`, `agentOverrideSchema`)
- Add `pluginConfigSchemaV4`
- Add `migrateV3toV4()` function (imports AGENT_REGISTRY from `src/registry/model-groups`)
- Update `loadConfig()` chain: try v4 first, then v3→v4, v2→v3→v4, v1→v2→v3→v4
- Update `pluginConfigSchema` and `PluginConfig` type exports to v4
- Update `createDefaultConfig()` to return v4

Follow the exact code from spec sections 2.1 through 2.4.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/config.test.ts`
Expected: all tests pass (old + new)

- [ ] **Step 5: Run full test suite**

Run: `bun test`
Expected: all 744+ tests pass (existing tests should still work via migration)

- [ ] **Step 6: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat: add config schema v4 with groups/overrides and v3→v4 migration"
```

---

### Task 6: Cleanup — delete placeholder agent, tool, and old configure command

**Files:**
- Delete: `assets/agents/placeholder-agent.md`
- Delete: `assets/commands/configure.md`
- Delete: `src/tools/placeholder.ts`
- Modify: `tests/index.test.ts` (if it references placeholder)
- Modify: `tests/installer.test.ts` (if it references placeholder agent)

- [ ] **Step 1: Check which tests reference placeholder**

Run: `grep -r "placeholder" tests/`

- [ ] **Step 2: Update any tests that reference the deleted files**

Remove or update tests that expect `placeholder-agent.md` to exist. The installer tests may need updating since the assets directory now has no agent files.

- [ ] **Step 3: Delete the files**

```bash
rm assets/agents/placeholder-agent.md
rm assets/commands/configure.md
rm src/tools/placeholder.ts
```

- [ ] **Step 4: Run tests to verify nothing is broken**

Run: `bun test`
Expected: some tests may fail if they reference placeholder — fix those in step 2.

Note: `src/index.ts` still imports `ocPlaceholder` — do NOT modify index.ts yet. That happens in Task 10. For now, the import will cause a compile error. To keep tests green, you may need to create a stub `src/tools/placeholder.ts` that exports an empty tool, OR reorder steps. Prefer doing Task 10 immediately after Task 6 if this causes issues.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove placeholder agent, placeholder tool, and old configure command"
```

---

### Task 7: `oc_configure` tool + tests

**Files:**
- Create: `src/tools/configure.ts`
- Test: `tests/tools/configure.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/tools/configure.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// We test configureCore directly, not the tool wrapper
import { configureCore, resetPendingAssignments } from "../../src/tools/configure";
import { ALL_GROUP_IDS } from "../../src/registry/model-groups";

// Reset state before each test
beforeEach(() => {
  resetPendingAssignments();
});

describe("configureCore start", () => {
  test("returns group definitions and diversity rules", async () => {
    const result = JSON.parse(await configureCore({ subcommand: "start" }));
    expect(result.action).toBe("configure");
    expect(result.stage).toBe("start");
    expect(result.groups).toHaveLength(8);
    expect(result.diversityRules).toHaveLength(3);
  });

  test("groups include agents derived from AGENT_REGISTRY", async () => {
    const result = JSON.parse(await configureCore({ subcommand: "start" }));
    const architects = result.groups.find((g: { id: string }) => g.id === "architects");
    expect(architects).toBeDefined();
    expect(architects.agents).toContain("oc-architect");
    expect(architects.agents).toContain("oc-planner");
    expect(architects.agents).toContain("autopilot");
  });
});

describe("configureCore assign", () => {
  test("validates group is a valid GroupId", async () => {
    const result = JSON.parse(
      await configureCore({
        subcommand: "assign",
        group: "invalid-group",
        primary: "anthropic/claude-opus-4-6",
      }),
    );
    expect(result.action).toBe("error");
  });

  test("requires primary model", async () => {
    const result = JSON.parse(
      await configureCore({ subcommand: "assign", group: "architects" }),
    );
    expect(result.action).toBe("error");
  });

  test("stores assignment and returns success", async () => {
    const result = JSON.parse(
      await configureCore({
        subcommand: "assign",
        group: "architects",
        primary: "anthropic/claude-opus-4-6",
        fallbacks: "openai/gpt-5.4",
      }),
    );
    expect(result.action).toBe("configure");
    expect(result.stage).toBe("assigned");
    expect(result.group).toBe("architects");
    expect(result.primary).toBe("anthropic/claude-opus-4-6");
    expect(result.fallbacks).toEqual(["openai/gpt-5.4"]);
    expect(result.assignedCount).toBe(1);
    expect(result.totalGroups).toBe(8);
  });

  test("returns diversity warnings when applicable", async () => {
    await configureCore({
      subcommand: "assign",
      group: "architects",
      primary: "anthropic/claude-opus-4-6",
    });
    const result = JSON.parse(
      await configureCore({
        subcommand: "assign",
        group: "challengers",
        primary: "anthropic/claude-sonnet-4-6", // same family
      }),
    );
    expect(result.diversityWarnings.length).toBeGreaterThan(0);
    expect(result.diversityWarnings[0].severity).toBe("strong");
  });

  test("no warnings when different families", async () => {
    await configureCore({
      subcommand: "assign",
      group: "architects",
      primary: "anthropic/claude-opus-4-6",
    });
    const result = JSON.parse(
      await configureCore({
        subcommand: "assign",
        group: "challengers",
        primary: "openai/gpt-5.4",
      }),
    );
    expect(result.diversityWarnings).toHaveLength(0);
  });
});

describe("configureCore commit", () => {
  test("fails if not all groups assigned", async () => {
    await configureCore({
      subcommand: "assign",
      group: "architects",
      primary: "anthropic/claude-opus-4-6",
    });
    const result = JSON.parse(await configureCore({ subcommand: "commit" }));
    expect(result.action).toBe("error");
    expect(result.message).toContain("missing");
  });

  test("succeeds when all 8 groups assigned", async () => {
    for (const groupId of ALL_GROUP_IDS) {
      await configureCore({
        subcommand: "assign",
        group: groupId,
        primary: "anthropic/claude-opus-4-6",
      });
    }
    const result = JSON.parse(await configureCore({ subcommand: "commit" }));
    expect(result.action).toBe("configure");
    expect(result.stage).toBe("committed");
    expect(Object.keys(result.groups)).toHaveLength(8);
  });
});

describe("configureCore reset", () => {
  test("clears pending assignments", async () => {
    await configureCore({
      subcommand: "assign",
      group: "architects",
      primary: "anthropic/claude-opus-4-6",
    });
    const resetResult = JSON.parse(await configureCore({ subcommand: "reset" }));
    expect(resetResult.stage).toBe("reset");

    // After reset, commit should fail (no assignments)
    const commitResult = JSON.parse(await configureCore({ subcommand: "commit" }));
    expect(commitResult.action).toBe("error");
  });
});

describe("configureCore doctor", () => {
  test("returns structured diagnostic report", async () => {
    const result = JSON.parse(await configureCore({ subcommand: "doctor" }));
    expect(result.action).toBe("configure");
    expect(result.stage).toBe("doctor");
    expect(result.checks).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/tools/configure.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the oc_configure tool**

Create `src/tools/configure.ts` following spec section 4. The file exports:
- `configureCore(args)` — core logic, testable
- `ocConfigure` — `tool()` wrapper
- `resetPendingAssignments()` — for test cleanup

Key implementation details:
- Module-level `pendingAssignments: Map<string, GroupModelAssignment>`
- `start` subcommand reads `openCodeConfig` (may be null in tests — handle gracefully)
- `assign` validates group against `ALL_GROUP_IDS`, parses comma-separated fallbacks
- `commit` checks `pendingAssignments.size === ALL_GROUP_IDS.length`, writes config
- `doctor` loads config, validates, runs `checkDiversity()`
- All responses are JSON strings (tool execute returns `Promise<string>`)

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/tools/configure.test.ts`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/tools/configure.ts tests/tools/configure.test.ts
git commit -m "feat: add oc_configure tool with start/assign/commit/doctor/reset subcommands"
```

---

### Task 8: Updated configHook with resolver + tests

**Files:**
- Modify: `src/agents/index.ts`
- Modify: `tests/agents/config-hook.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests to `tests/agents/config-hook.test.ts`:

```typescript
// Append to tests/agents/config-hook.test.ts

describe("configHook with model resolution", () => {
  test("assigns model from group config to registered agent", async () => {
    // This test requires a config file with groups.
    // Create a temp config, set it up, then call configHook.
    // The exact approach depends on how loadConfig is injected —
    // may need to mock CONFIG_PATH or use a test helper.
    // Key assertion: after configHook, config.agent["oc-architect"].model
    // should equal the architects group primary.
  });

  test("assigns fallback_models from group config", async () => {
    // Similar to above — verify config.agent["oc-architect"].fallback_models
    // contains the group's fallbacks array.
  });

  test("override takes precedence over group for model assignment", async () => {
    // Create config with overrides["oc-planner"] = { primary: "openai/gpt-5.4" }
    // Verify config.agent["oc-planner"].model is "openai/gpt-5.4", not the
    // architects group primary.
  });

  test("agents without group assignment get no model field", async () => {
    // With an empty groups config, agents should register without a model field.
    // OpenCode will use its default model.
  });
});
```

Note: The exact test implementation depends on how config loading is wired. The tests may need to write a temp config file and set CONFIG_PATH, or the configHook may need a config injection parameter. Adapt based on the existing test patterns in `tests/agents/config-hook.test.ts`.

- [ ] **Step 2: Implement the configHook changes**

Modify `src/agents/index.ts` following spec section 5.1:
- Import `resolveModelForAgent` from `../registry/resolver`
- Import `loadConfig` from `../config`
- In `configHook()`, call `loadConfig()` to get groups and overrides
- For each agent registration, call `resolveModelForAgent()` and spread `model` + `fallback_models` into the agent config

- [ ] **Step 3: Run tests**

Run: `bun test tests/agents/config-hook.test.ts`
Expected: all pass

- [ ] **Step 4: Run full test suite**

Run: `bun test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/agents/index.ts tests/agents/config-hook.test.ts
git commit -m "feat: configHook resolves models from group registry"
```

---

### Task 9: CLI installer + doctor

**Files:**
- Create: `bin/cli.ts`
- Test: `tests/cli/cli.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/cli/cli.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("CLI install", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(join(tmpdir(), "cli-test-")),
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("creates opencode.json when it does not exist", async () => {
    // Test the install logic function directly (not the CLI binary)
    const { runInstall } = await import("../../bin/cli");
    await runInstall({ cwd: tempDir, noTui: true });

    const content = JSON.parse(await readFile(join(tempDir, "opencode.json"), "utf-8"));
    expect(content.plugin).toContain("@kodrunhq/opencode-autopilot");
  });

  test("adds plugin to existing opencode.json", async () => {
    await writeFile(
      join(tempDir, "opencode.json"),
      JSON.stringify({ plugin: ["other-plugin"] }),
      "utf-8",
    );

    const { runInstall } = await import("../../bin/cli");
    await runInstall({ cwd: tempDir, noTui: true });

    const content = JSON.parse(await readFile(join(tempDir, "opencode.json"), "utf-8"));
    expect(content.plugin).toContain("other-plugin");
    expect(content.plugin).toContain("@kodrunhq/opencode-autopilot");
  });

  test("is idempotent — does not duplicate plugin entry", async () => {
    await writeFile(
      join(tempDir, "opencode.json"),
      JSON.stringify({ plugin: ["@kodrunhq/opencode-autopilot"] }),
      "utf-8",
    );

    const { runInstall } = await import("../../bin/cli");
    await runInstall({ cwd: tempDir, noTui: true });

    const content = JSON.parse(await readFile(join(tempDir, "opencode.json"), "utf-8"));
    const count = content.plugin.filter(
      (p: string) => p === "@kodrunhq/opencode-autopilot",
    ).length;
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/cli/cli.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the CLI**

Create `bin/cli.ts` following spec section 3. Key details:
- Shebang: `#!/usr/bin/env bun`
- Export `runInstall({ cwd, noTui })` and `runDoctor({ cwd })` for testability
- CLI dispatch: parse `process.argv`, call the right function
- ANSI color helpers: `green()`, `red()`, `yellow()`, `bold()`, `reset()`
- `runInstall`:
  1. Check `opencode --version` (skip in test mode when `cwd` is provided)
  2. Read/create `opencode.json` in cwd
  3. Add plugin to array (idempotent)
  4. Create default config in `~/.config/opencode/`
  5. Print next steps
- `runDoctor`:
  1. System checks
  2. Model assignments from config
  3. Diversity check

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/cli/cli.test.ts`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add bin/cli.ts tests/cli/cli.test.ts
git commit -m "feat: add CLI installer and doctor commands"
```

---

### Task 10: Wire everything into index.ts

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Remove placeholder import and registration**

In `src/index.ts`:
- Remove: `import { ocPlaceholder } from "./tools/placeholder";` (line 21)
- Remove: `oc_placeholder: ocPlaceholder,` from tool map (line 94)

- [ ] **Step 2: Add oc_configure import and registration**

```typescript
import { ocConfigure } from "./tools/configure";

// In tool map:
tool: {
  oc_configure: ocConfigure,
  oc_create_agent: ocCreateAgent,
  // ... rest unchanged
},
```

- [ ] **Step 3: Replace dead first-load handler with toast**

Replace lines 107-110:

```typescript
// BEFORE:
if (event.type === "session.created" && isFirstLoad(config)) {
  // First load: config wizard will be triggered via /configure command
  // Phase 2 will add the oc_configure tool
}

// AFTER:
if (event.type === "session.created" && isFirstLoad(config)) {
  await sdkOps.showToast(
    "Welcome to OpenCode Autopilot!",
    "Run /oc-configure to set up your model assignments for each agent group.",
    "info",
  );
}
```

- [ ] **Step 4: Run full test suite**

Run: `bun test`
Expected: all pass

- [ ] **Step 5: Run lint**

Run: `bun run lint`
Expected: no new warnings

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire oc_configure, remove placeholder, add first-load toast"
```

---

### Task 11: `/oc-configure` command asset

**Files:**
- Create: `assets/commands/oc-configure.md`

- [ ] **Step 1: Create the command file**

Write `assets/commands/oc-configure.md` with the exact content from spec section 6.1.

- [ ] **Step 2: Verify the installer copies it**

Run: `bun test tests/installer.test.ts`
Expected: installer tests pass (new command file is discovered and copied)

- [ ] **Step 3: Commit**

```bash
git add assets/commands/oc-configure.md
git commit -m "feat: add /oc-configure command asset"
```

---

### Task 12: package.json updates

**Files:**
- Modify: `package.json`
- Modify: `.npmignore`

- [ ] **Step 1: Add bin field and update files array**

In `package.json`:

```json
{
  "bin": {
    "opencode-autopilot": "bin/cli.ts"
  },
  "files": ["src/", "assets/", "bin/"]
}
```

- [ ] **Step 2: Update .npmignore**

Add `docs/` to `.npmignore` (installation guide should be fetched from GitHub raw, not bundled in the package):

```
# Planning and docs (not needed at runtime)
.planning/
.github/
.claude/
docs/
```

- [ ] **Step 3: Verify package builds**

Run: `bunx tsc --noEmit && bun run lint`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add package.json .npmignore
git commit -m "chore: add bin field for CLI, update files and npmignore"
```

---

### Task 13: LLM installation guide

**Files:**
- Create: `docs/guide/installation.md`

- [ ] **Step 1: Create the installation guide**

Write `docs/guide/installation.md` with the full content from spec section 8.2.

- [ ] **Step 2: Verify the curl warning is present**

Grep: `grep "curl" docs/guide/installation.md` — should find the warning about WebFetch.

- [ ] **Step 3: Commit**

```bash
git add docs/guide/installation.md
git commit -m "docs: add LLM-guided installation guide"
```

---

### Task 14: Final verification

- [ ] **Step 1: Run full test suite**

Run: `bun test`
Expected: all tests pass (original + new)

- [ ] **Step 2: Run lint**

Run: `bun run lint`
Expected: no new warnings

- [ ] **Step 3: Run type check**

Run: `bunx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Verify CLI works**

Run: `bun bin/cli.ts --help`
Expected: prints usage info

Run: `bun bin/cli.ts doctor`
Expected: runs doctor checks (may show unconfigured warnings — that's expected)

- [ ] **Step 5: Verify no stale placeholder references remain**

Run: `grep -r "placeholder" src/ assets/ --include="*.ts" --include="*.md"`
Expected: no results (template files may mention "placeholder" generically — that's OK)

- [ ] **Step 6: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: final verification — all tests pass, lint clean"
```

---

### Follow-up: Review pipeline model injection (deferred)

**Not in scope for this plan.** Spec §5.3 notes that the 21 internal `ReviewAgent` objects (logic-auditor, security-auditor, etc.) are dispatched by the review pipeline as prompt-only agents — they don't go through `configHook` and don't have `AgentConfig` entries. Their model is currently determined by whatever model the orchestrator is using.

To make them respect the "reviewers" and "red-team" group assignments, the review pipeline (`src/review/pipeline.ts`) needs to include a `model` field in its dispatch JSON responses. This depends on whether the OpenCode plugin SDK supports a `model` field in dispatch responses — which needs verification against the SDK.

This is tracked as a follow-up, not a blocker for the installer feature. The configHook already sets models for `oc-reviewer` (the registered agent), and the fallback system already handles model resolution for registered agents.
