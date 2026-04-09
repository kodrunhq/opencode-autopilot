import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "@opencode-ai/plugin";
import { configHook } from "../../src/agents";

function expectSuppressedNativeAgent(agent: unknown): void {
	expect(agent).toBeDefined();
	const record = agent as Record<string, unknown>;
	expect(record.disable).toBe(true);
	expect(record.mode).toBe("subagent");
	expect(record.hidden).toBe(true);
}

describe("configHook", () => {
	test("adds all 9 standard agents to an empty config object", async () => {
		const config = { agent: {} } as Config;
		await configHook(config);

		expect(config.agent?.["specialist-researcher"]).toBeDefined();
		expect(config.agent?.metaprompter).toBeDefined();
		expect(config.agent?.["pr-reviewer"]).toBeDefined();
		expect(config.agent?.autopilot).toBeDefined();
		expect(config.agent?.coder).toBeDefined();
		expect(config.agent?.debugger).toBeDefined();
		expect(config.agent?.["specialist-planner"]).toBeDefined();
		expect(config.agent?.["specialist-reviewer"]).toBeDefined();
		expect(config.agent?.["security-auditor"]).toBeDefined();
	});

	test("initializes config.agent if it is undefined", async () => {
		const config = {} as Config;
		await configHook(config);

		expect(config.agent).toBeDefined();
		expect(config.agent?.["specialist-researcher"]).toBeDefined();
		expect(config.agent?.metaprompter).toBeDefined();
		expect(config.agent?.["pr-reviewer"]).toBeDefined();
		expect(config.agent?.autopilot).toBeDefined();
		expect(config.agent?.coder).toBeDefined();
		expect(config.agent?.debugger).toBeDefined();
		expect(config.agent?.["specialist-planner"]).toBeDefined();
		expect(config.agent?.["specialist-reviewer"]).toBeDefined();
		expect(config.agent?.["security-auditor"]).toBeDefined();
	});

	test("does NOT overwrite an existing agent key", async () => {
		const customAgent = {
			description: "custom researcher",
			mode: "subagent" as const,
			prompt: "custom prompt",
		};
		const config = { agent: { "specialist-researcher": customAgent } } as Config;
		await configHook(config);

		expect(config.agent?.["specialist-researcher"]).toBe(customAgent);
		expect(config.agent?.["specialist-researcher"]?.description).toBe("custom researcher");
	});

	test("suppresses built-in build agent with disable: true", async () => {
		const buildAgent = { description: "build agent", prompt: "build" };
		const config = {
			agent: { build: buildAgent },
		} as Config;
		await configHook(config);

		expectSuppressedNativeAgent(config.agent?.build);
		expect((config.agent?.build as Record<string, unknown>).description).toBe("build agent");
		expect((config.agent?.build as Record<string, unknown>).prompt).toBe("build");
	});

	test("suppresses built-in plan agent with disable: true", async () => {
		const planAgent = { description: "plan agent", prompt: "plan" };
		const config = {
			agent: { plan: planAgent },
		} as Config;
		await configHook(config);

		expectSuppressedNativeAgent(config.agent?.plan);
		expect((config.agent?.plan as Record<string, unknown>).description).toBe("plan agent");
		expect((config.agent?.plan as Record<string, unknown>).prompt).toBe("plan");
	});

	test("deterministically suppresses native plan/build keys when they are absent in initial config", async () => {
		const config = {
			agent: {},
		} as Config;
		await configHook(config);

		expectSuppressedNativeAgent(config.agent?.plan);
		expectSuppressedNativeAgent(config.agent?.build);
	});

	test("suppresses uppercase Plan/Build variants when pre-populated", async () => {
		const config = {
			agent: {
				Plan: { prompt: "native Plan" },
				Build: { prompt: "native Build" },
			},
		} as Config;
		await configHook(config);

		expectSuppressedNativeAgent(config.agent?.Plan);
		expectSuppressedNativeAgent(config.agent?.Build);
		expect((config.agent?.Plan as Record<string, unknown>).prompt).toBe("native Plan");
		expect((config.agent?.Build as Record<string, unknown>).prompt).toBe("native Build");
	});

	test("suppresses uppercase Planner/Builder variants when pre-populated", async () => {
		const config = {
			agent: {
				Planner: { prompt: "native Planner" },
				Builder: { prompt: "native Builder" },
			},
		} as Config;
		await configHook(config);

		expectSuppressedNativeAgent(config.agent?.Planner);
		expectSuppressedNativeAgent(config.agent?.Builder);
		expect((config.agent?.Planner as Record<string, unknown>).prompt).toBe("native Planner");
		expect((config.agent?.Builder as Record<string, unknown>).prompt).toBe("native Builder");
	});

	test("does NOT suppress custom specialist-planner agent registered by the plugin", async () => {
		const config = {
			agent: {},
		} as Config;
		await configHook(config);

		// Our custom specialist-planner should be registered and NOT have disable: true
		const planner = config.agent?.["specialist-planner"] as Record<string, unknown> | undefined;
		expect(planner).toBeDefined();
		expect(planner?.disable).toBeUndefined();
		expect(planner?.mode).toBe("all");
		expect(planner?.hidden).toBeUndefined();

		const coder = config.agent?.coder as Record<string, unknown> | undefined;
		expect(coder).toBeDefined();
		expect(coder?.disable).toBeUndefined();
		expect(coder?.mode).toBe("all");
		expect(coder?.hidden).toBeUndefined();
	});

	test("suppresses legacy mode.plan/mode.build when provided", async () => {
		const modeConfig = {
			plan: { description: "legacy plan" },
			build: { description: "legacy build" },
		} as NonNullable<Config["mode"]>;
		const config = {
			agent: {},
			mode: modeConfig,
		} as Config;
		await configHook(config);

		const plan = config.mode?.plan as Record<string, unknown> | undefined;
		const build = config.mode?.build as Record<string, unknown> | undefined;
		expect(plan).toBeDefined();
		expect(build).toBeDefined();
		expect(plan?.disable).toBe(true);
		expect(plan?.mode).toBe("subagent");
		expect(plan?.hidden).toBe(true);
		expect(build?.disable).toBe(true);
		expect(build?.mode).toBe("subagent");
		expect(build?.hidden).toBe(true);
	});

	test("suppresses legacy mode.Plan/mode.Build and mode.Planner/mode.Builder when provided", async () => {
		const modeConfig = {
			Plan: { description: "legacy Plan" },
			Build: { description: "legacy Build" },
			Planner: { description: "legacy Planner" },
			Builder: { description: "legacy Builder" },
		} as NonNullable<Config["mode"]>;
		const config = {
			agent: {},
			mode: modeConfig,
		} as Config;
		await configHook(config);

		const plan = config.mode?.Plan as Record<string, unknown> | undefined;
		const build = config.mode?.Build as Record<string, unknown> | undefined;
		const planner = config.mode?.Planner as Record<string, unknown> | undefined;
		const builder = config.mode?.Builder as Record<string, unknown> | undefined;

		expect(plan?.disable).toBe(true);
		expect(plan?.mode).toBe("subagent");
		expect(plan?.hidden).toBe(true);
		expect(build?.disable).toBe(true);
		expect(build?.mode).toBe("subagent");
		expect(build?.hidden).toBe(true);
		expect(planner?.disable).toBe(true);
		expect(planner?.mode).toBe("subagent");
		expect(planner?.hidden).toBe(true);
		expect(builder?.disable).toBe(true);
		expect(builder?.mode).toBe("subagent");
		expect(builder?.hidden).toBe(true);
	});
});

describe("configHook with model resolution", () => {
	let tmpDir: string;
	let configPath: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "config-hook-test-"));
		configPath = join(tmpDir, "opencode-autopilot.json");
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	test("assigns model from group config to registered agent", async () => {
		const pluginConfig = {
			version: 4,
			configured: true,
			groups: {
				architects: { primary: "anthropic/claude-opus-4", fallbacks: [] },
			},
			overrides: {},
		};
		await writeFile(configPath, JSON.stringify(pluginConfig), "utf-8");

		const config = { agent: {} } as Config;
		await configHook(config, configPath);

		// autopilot is in the "architects" group
		const autopilotConfig = config.agent?.autopilot as Record<string, unknown>;
		expect(autopilotConfig).toBeDefined();
		expect(autopilotConfig.model).toBe("anthropic/claude-opus-4");
	});

	test("assigns fallback_models from group config", async () => {
		const pluginConfig = {
			version: 4,
			configured: true,
			groups: {
				architects: {
					primary: "anthropic/claude-opus-4",
					fallbacks: ["openai/gpt-5.4", "google/gemini-3-pro"],
				},
			},
			overrides: {},
		};
		await writeFile(configPath, JSON.stringify(pluginConfig), "utf-8");

		const config = { agent: {} } as Config;
		await configHook(config, configPath);

		const autopilotConfig = config.agent?.autopilot as Record<string, unknown>;
		expect(autopilotConfig).toBeDefined();
		expect(autopilotConfig.model).toBe("anthropic/claude-opus-4");
		expect(autopilotConfig.fallback_models).toEqual(["openai/gpt-5.4", "google/gemini-3-pro"]);
	});

	test("agents without group assignment get no model field", async () => {
		const pluginConfig = {
			version: 4,
			configured: true,
			groups: {},
			overrides: {},
		};
		await writeFile(configPath, JSON.stringify(pluginConfig), "utf-8");

		const config = { agent: {} } as Config;
		await configHook(config, configPath);

		const researcherConfig = config.agent?.["specialist-researcher"] as Record<string, unknown>;
		expect(researcherConfig).toBeDefined();
		expect(researcherConfig.model).toBeUndefined();
		expect(researcherConfig.fallback_models).toBeUndefined();
	});

	test("per-agent override takes precedence over group", async () => {
		const pluginConfig = {
			version: 4,
			configured: true,
			groups: {
				architects: { primary: "anthropic/claude-opus-4", fallbacks: [] },
			},
			overrides: {
				autopilot: { primary: "openai/gpt-5.4", fallbacks: ["google/gemini-3-pro"] },
			},
		};
		await writeFile(configPath, JSON.stringify(pluginConfig), "utf-8");

		const config = { agent: {} } as Config;
		await configHook(config, configPath);

		const autopilotConfig = config.agent?.autopilot as Record<string, unknown>;
		expect(autopilotConfig.model).toBe("openai/gpt-5.4");
		expect(autopilotConfig.fallback_models).toEqual(["google/gemini-3-pro"]);
	});

	test("no config file results in no model assignments", async () => {
		// configPath points to a nonexistent file — loadConfig returns null
		const noFilePath = join(tmpDir, "nonexistent.json");
		const config = { agent: {} } as Config;
		await configHook(config, noFilePath);

		const researcherConfig = config.agent?.["specialist-researcher"] as Record<string, unknown>;
		expect(researcherConfig).toBeDefined();
		expect(researcherConfig.model).toBeUndefined();
	});

	test("pipeline agent gets model from group assignment", async () => {
		const pluginConfig = {
			version: 4,
			configured: true,
			groups: {
				builders: { primary: "anthropic/claude-sonnet-4-6", fallbacks: [] },
			},
			overrides: {},
		};
		await writeFile(configPath, JSON.stringify(pluginConfig), "utf-8");

		const config = { agent: {} } as Config;
		await configHook(config, configPath);

		// oc-implementer is in the "builders" group
		const implConfig = config.agent?.["oc-implementer"] as Record<string, unknown>;
		expect(implConfig).toBeDefined();
		expect(implConfig.model).toBe("anthropic/claude-sonnet-4-6");
	});

	test("empty fallbacks array does not set fallback_models", async () => {
		const pluginConfig = {
			version: 4,
			configured: true,
			groups: {
				architects: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
			},
			overrides: {},
		};
		await writeFile(configPath, JSON.stringify(pluginConfig), "utf-8");

		const config = { agent: {} } as Config;
		await configHook(config, configPath);

		const autopilotConfig = config.agent?.autopilot as Record<string, unknown>;
		expect(autopilotConfig).toBeDefined();
		expect(autopilotConfig.model).toBe("anthropic/claude-opus-4-6");
		expect(autopilotConfig.fallback_models).toBeUndefined();
	});
});
