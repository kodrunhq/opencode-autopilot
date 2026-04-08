# OpenCode Agent Configuration: Disable/Hide Semantics and Built-in Agent Behavior

## Summary

OpenCode provides three distinct mechanisms for controlling agent visibility in the Tab menu: `disable: true` (removes from cycling + autocomplete), `hidden: true` (removes from autocomplete only), and `mode: "subagent"` (removes from Tab cycling). The built-in `plan` and `build` agents are always present in the initial config object passed to the plugin's `configHook` even when not explicitly pre-populated in the config file—they are created by OpenCode's core before plugin hooks run.

---

## Key Findings

- **`disable: true`** removes an agent from both the Tab cycling menu and `@` autocomplete.
- **`hidden: true`** only removes a subagent from the `@` autocomplete menu but keeps it available for programmatic invocation via the Task tool.
- **`mode: "subagent"`** automatically excludes the agent from Tab cycling (primary agent only).
- The built-in `plan` and `build` agents **are always present** in the `config.agent` object when `configHook` is called—they are created by OpenCode's core before any plugin hooks execute.
- If a plugin defines an agent with the same name as a built-in (e.g., `plan`), OpenCode will **not** overwrite the existing agent definition—the user's config takes precedence.
- Plugins can suppress built-in agents by setting `disable: true` on them, but must be careful to only target built-ins, not their own custom agents with similar names.

---

## Detailed Analysis

### 1. Config Keys That Disable or Hide Agents

OpenCode's agent configuration supports three mutually exclusive visibility controls:

#### `disable: true`
From the official documentation:

> Set to `true` to disable the agent.
> ```json
> { "agent": { "review": { "disable": true } } }
> ```

When `disable` is set to `true`, the agent is completely removed from:
- The Tab key cycling menu (primary agents)
- The `@` mention autocomplete menu (subagents)

#### `hidden: true`
From the official documentation:

> Hide a subagent from the `@` autocomplete menu with `hidden: true`. Useful for internal subagents that should only be invoked programmatically by other agents via the Task tool.
> ```json
> { "agent": { "internal-helper": { "mode": "subagent", "hidden": true } } }
> ```

Key points:
- Only applies to `mode: subagent` agents
- Removes from autocomplete but keeps the agent available for invocation via the Task tool by other agents
- User can still invoke directly via `@` mention

#### `mode: "subagent"` vs `"primary"`
From the documentation:

> The `mode` option can be set to `primary`, `subagent`, or `all`. If no `mode` is specified, it defaults to `all`.

- **`primary`**: Appears in Tab cycling menu
- **`subagent`**: Does NOT appear in Tab cycling; only accessible via `@` mention or Task tool
- **`all`**: Appears in both

---

### 2. Does `disable: true` Remove from Tab Menu?

**Yes, completely.** Setting `disable: true` removes the agent from all visibility surfaces:

1. **Tab cycling**: Primary agents cycle through the Tab key. Disabling removes from this flow.
2. **`@` autocomplete**: Both primary and subagents appear in `@` mention autocomplete. Disabling removes from this as well.

The `hidden` property exists specifically for cases where you want to hide from autocomplete but keep the agent callable programmatically.

**Question 2 Answer**: `agent.<name>.disable=true` does remove the agent from the Tab menu. `mode: subagent` is an alternative that removes from Tab but keeps in `@` autocomplete. `hidden: true` is only for hiding from autocomplete while keeping programmatic access.

---

### 3. Are Built-in Plan/Build Agents Always Present?

**Yes.** Evidence from the opencode-autopilot plugin implementation shows that built-in `plan` and `build` agents are always present in `config.agent` when `configHook` is called:

```typescript
// From src/agents/index.ts lines 108-122
// Snapshot built-in agent keys BEFORE we register ours — we only suppress
// built-in Plan/Build variants, never our custom planner/coder agents.
const builtInKeys = new Set(Object.keys(config.agent));

// Register standard agents and pipeline agents
registerAgents(agents, config, groups, overrides);

// Suppress built-in Plan/Build agents — planner/coder replace them.
// Only disable keys that existed before our registration (built-ins).
const planVariants = ["Plan", "plan", "Planner", "planner"] as const;
suppressBuiltInVariants(planVariants, builtInKeys, config);

const buildVariants = ["Build", "build", "Builder", "builder"] as const;
suppressBuiltInVariants(buildVariants, config);
```

The plugin captures `builtInKeys` **before** registering its own agents, then uses those keys to identify which agents are OpenCode's built-ins that should be suppressed. This works because OpenCode's core populates `config.agent` with the default `plan` and `build` agents **before** calling any plugin hooks.

The test file confirms this behavior:

```typescript
// From tests/agents/config-hook.test.ts lines 51-75
test("suppresses built-in build agent with disable: true", async () => {
    const buildAgent = { description: "build agent", prompt: "build" };
    const config = { agent: { build: buildAgent } } as Config;
    await configHook(config);

    expect(config.agent?.build).toEqual({
        ...buildAgent,
        disable: true,
    });
});

test("suppresses built-in plan agent with disable: true", async () => {
    const planAgent = { description: "plan agent", prompt: "plan" };
    const config = { agent: { plan: planAgent } } as Config;
    await configHook(config);

    expect(config.agent?.plan).toEqual({
        ...planAgent,
        disable: true,
    });
});
```

**Question 3 Answer**: Built-in `plan`/`build` agents are always present in the `config.agent` object passed to `configHook`. They are created by OpenCode's core before any plugin hooks run. The config object may not have a pre-populated `config.agent` if no agents were defined in the user's config file, but OpenCode initializes it before calling plugins.

---

## Practical Recommendations for Plugin Authors

### 1. Suppressing Built-in Agents Safely

If your plugin replaces the built-in `plan` or `build` agents, use the pattern from opencode-autopilot:

```typescript
export async function configHook(config: Config): Promise<void> {
    // Capture existing keys BEFORE registering your agents
    const builtInKeys = new Set(Object.keys(config.agent ?? {}));

    // Register your custom agents
    registerMyAgents(config);

    // Now safely suppress only the built-ins
    for (const variant of ["Plan", "plan", "Build", "build"]) {
        if (config.agent && builtInKeys.has(variant)) {
            config.agent[variant] = {
                ...config.agent[variant],
                disable: true,
            };
        }
    }
}
```

**Critical**: Capture `builtInKeys` BEFORE your registration logic, otherwise you'll suppress your own agents that share names with built-ins.

### 2. Preserving User Customizations

Your plugin should NOT overwrite agents the user has already defined:

```typescript
function registerAgents(agentMap, config) {
    const agentRef = config.agent;
    if (!agentRef) return;

    for (const [name, agentConfig] of Object.entries(agentMap)) {
        // Skip if user already defined this agent
        if (agentRef[name] !== undefined) {
            continue; // Preserve user's custom config
        }
        // Register new agent
        agentRef[name] = agentConfig;
    }
}
```

### 3. Controlling Tab Visibility

- To hide from Tab cycling but keep in `@` autocomplete: use `mode: "subagent"`
- To hide from both Tab cycling and `@` autocomplete: use `disable: true`
- To hide from `@` autocomplete but keep programmatic access: use `hidden: true` with `mode: "subagent"`

### 4. Initializing config.agent

Always initialize `config.agent` if undefined:

```typescript
export async function configHook(config: Config): Promise<void> {
    if (!config.agent) {
        config.agent = {};
    }
    // ... proceed with registration
}
```

---

## Sources

1. **[Agents | OpenCode Documentation](https://opencode.ai/docs/agents/)** - Official docs covering `disable`, `hidden`, and `mode` configuration options for agents.

2. **[Config | OpenCode Documentation](https://opencode.ai/docs/config/)** - Official docs covering OpenCode JSON configuration schema and agent configuration via the `agent` key.

3. **[Plugins | OpenCode Documentation](https://opencode.ai/docs/plugins/)** - Official docs covering plugin hooks including `configHook` and how plugins extend OpenCode.

4. **[opencode-autopilot/src/agents/index.ts](https://github.com/joseibanezortiz/opencode-autopilot/blob/main/src/agents/index.ts)** - Implementation showing how the plugin handles built-in agent suppression using the `builtInKeys` pattern.

5. **[opencode-autopilot/tests/agents/config-hook.test.ts](https://github.com/joseibanezortiz/opencode-autopilot/blob/main/tests/agents/config-hook.test.ts)** - Test cases demonstrating that built-in `plan`/`build` are always present and how suppression works.

6. **[Native OpenCode plan/build agents are not available when plugin is active · Issue #2685](https://github.com/code-yeongyu/oh-my-openagent/issues/2685)** - Issue documenting that plugins replace native agents and requesting a way to preserve them.

7. **[ability to hide agents from tabbing · Issue #12530](https://github.com/anomalyco/opencode/issues/12530)** - Feature request for hiding agents from tab cycling with `hidden` property.

8. **[disabled_agents setting does not filter user/project/plugin agents from config.agent registration · Issue #1693](https://github.com/code-yeongyu/oh-my-opencode/issues/1693)** - Bug report documenting that `disabled_agents` only works for built-in agents, not custom agents.

9. **[packages/opencode/src/plugin/index.ts](https://github.com/anomalyco/opencode/blob/7daea69e/packages/opencode/src/plugin/index.ts)** - OpenCode core plugin loading showing how hooks are initialized with the config object.

10. **[Config schema - OpenCode](https://www.mintlify.com/opencode-ai/opencode/reference/config-schema)** - JSON schema reference for OpenCode configuration including agent definitions.
