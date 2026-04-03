import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "@opencode-ai/plugin";
import { configHook } from "../../src/agents";

describe("configHook", () => {
	test("adds all 8 standard agents to an empty config object", async () => {
		const config = { agent: {} } as Config;
		await configHook(config);

		expect(config.agent?.researcher).toBeDefined();
		expect(config.agent?.metaprompter).toBeDefined();
		expect(config.agent?.documenter).toBeDefined();
		expect(config.agent?.["pr-reviewer"]).toBeDefined();
		expect(config.agent?.autopilot).toBeDefined();
		expect(config.agent?.debugger).toBeDefined();
		expect(config.agent?.planner).toBeDefined();
		expect(config.agent?.reviewer).toBeDefined();
	});

	test("initializes config.agent if it is undefined", async () => {
		const config = {} as Config;
		await configHook(config);

		expect(config.agent).toBeDefined();
		expect(config.agent?.researcher).toBeDefined();
		expect(config.agent?.metaprompter).toBeDefined();
		expect(config.agent?.documenter).toBeDefined();
		expect(config.agent?.["pr-reviewer"]).toBeDefined();
		expect(config.agent?.autopilot).toBeDefined();
		expect(config.agent?.debugger).toBeDefined();
		expect(config.agent?.planner).toBeDefined();
		expect(config.agent?.reviewer).toBeDefined();
	});

	test("does NOT overwrite an existing agent key", async () => {
		const customAgent = {
			description: "custom researcher",
			mode: "subagent" as const,
			prompt: "custom prompt",
		};
		const config = { agent: { researcher: customAgent } } as Config;
		await configHook(config);

		expect(config.agent?.researcher).toBe(customAgent);
		expect(config.agent?.researcher?.description).toBe("custom researcher");
	});

	test("does not touch built-in keys (build) if they exist", async () => {
		const buildAgent = { description: "build agent", prompt: "build" };
		const config = {
			agent: { build: buildAgent },
		} as Config;
		await configHook(config);

		expect(config.agent?.build).toBe(buildAgent);
	});

	test("suppresses built-in plan agent with disable: true", async () => {
		const planAgent = { description: "plan agent", prompt: "plan" };
		const config = {
			agent: { plan: planAgent },
		} as Config;
		await configHook(config);

		expect(config.agent?.plan).toEqual({
			...planAgent,
			disable: true,
		});
	});

	test("does NOT suppress custom planner agent registered by the plugin", async () => {
		const config = {
			agent: {},
		} as Config;
		await configHook(config);

		// Our custom planner should be registered and NOT have disable: true
		const planner = config.agent?.planner as Record<string, unknown> | undefined;
		expect(planner).toBeDefined();
		expect(planner?.disable).toBeUndefined();
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

		const researcherConfig = config.agent?.researcher as Record<string, unknown>;
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

		const researcherConfig = config.agent?.researcher as Record<string, unknown>;
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
