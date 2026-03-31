import { describe, expect, test } from "bun:test";
import type { Config } from "@opencode-ai/plugin";
import { configHook } from "../../src/agents";

describe("configHook", () => {
	test("adds all 4 agents to an empty config object", async () => {
		const config = { agent: {} } as Config;
		await configHook(config);

		expect(config.agent?.researcher).toBeDefined();
		expect(config.agent?.metaprompter).toBeDefined();
		expect(config.agent?.documenter).toBeDefined();
		expect(config.agent?.["pr-reviewer"]).toBeDefined();
	});

	test("initializes config.agent if it is undefined", async () => {
		const config = {} as Config;
		await configHook(config);

		expect(config.agent).toBeDefined();
		expect(config.agent?.researcher).toBeDefined();
		expect(config.agent?.metaprompter).toBeDefined();
		expect(config.agent?.documenter).toBeDefined();
		expect(config.agent?.["pr-reviewer"]).toBeDefined();
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

	test("does not touch built-in keys (build, plan) if they exist", async () => {
		const buildAgent = { description: "build agent", prompt: "build" };
		const planAgent = { description: "plan agent", prompt: "plan" };
		const config = {
			agent: { build: buildAgent, plan: planAgent },
		} as Config;
		await configHook(config);

		expect(config.agent?.build).toBe(buildAgent);
		expect(config.agent?.plan).toBe(planAgent);
	});
});
