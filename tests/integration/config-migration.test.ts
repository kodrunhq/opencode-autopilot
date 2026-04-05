import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../src/config";

describe("Config migration chain integration: v1 through v6", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "config-migration-integration-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("v1 config migrates to v6 with all defaults populated", async () => {
		const configPath = join(tempDir, "v1-config.json");
		const v1Config = { version: 1, configured: true, models: { "oc-autopilot": "some-model" } };
		await writeFile(configPath, JSON.stringify(v1Config), "utf-8");

		const result = await loadConfig(configPath);

		expect(result).not.toBeNull();
		expect(result?.version).toBe(7);
		expect(result?.configured).toBe(true);

		// Orchestrator defaults
		expect(result?.orchestrator.autonomy).toBe("full");
		expect(result?.orchestrator.strictness).toBe("normal");
		expect(result?.orchestrator.phases.recon).toBe(true);
		expect(result?.orchestrator.phases.build).toBe(true);

		// Confidence defaults
		expect(result?.confidence.enabled).toBe(true);
		expect(result?.confidence.thresholds.proceed).toBe("MEDIUM");
		expect(result?.confidence.thresholds.abort).toBe("LOW");

		// Fallback defaults (v6 includes testMode)
		expect(result?.fallback.enabled).toBe(true);
		expect(result?.fallback.maxFallbackAttempts).toBe(10);
		expect(result?.fallback.testMode.enabled).toBe(false);
		expect(result?.fallback.testMode.sequence).toEqual([]);

		// Memory defaults (v5 addition)
		expect(result?.memory.enabled).toBe(true);
		expect(result?.memory.injectionBudget).toBe(2000);
		expect(result?.memory.decayHalfLifeDays).toBe(90);
	});

	test("v2 config migrates to v6 preserving orchestrator and confidence settings", async () => {
		const configPath = join(tempDir, "v2-config.json");
		const v2Config = {
			version: 2,
			configured: true,
			models: {},
			orchestrator: {
				autonomy: "supervised",
				strictness: "strict",
				phases: {
					recon: true,
					challenge: false,
					architect: true,
					explore: true,
					plan: true,
					build: true,
					ship: true,
					retrospective: true,
				},
			},
			confidence: {
				enabled: false,
				thresholds: { proceed: "HIGH", abort: "MEDIUM" },
			},
		};
		await writeFile(configPath, JSON.stringify(v2Config), "utf-8");

		const result = await loadConfig(configPath);

		expect(result?.version).toBe(7);
		// Preserved from v2
		expect(result?.orchestrator.autonomy).toBe("supervised");
		expect(result?.orchestrator.strictness).toBe("strict");
		expect(result?.orchestrator.phases.challenge).toBe(false);
		expect(result?.confidence.enabled).toBe(false);
		expect(result?.confidence.thresholds.proceed).toBe("HIGH");
		// Defaults added during migration
		expect(result?.fallback.enabled).toBe(true);
		expect(result?.fallback.testMode.enabled).toBe(false);
		expect(result?.memory.enabled).toBe(true);
		expect(result?.memory.injectionBudget).toBe(2000);
	});

	test("v3 config migrates to v6 preserving fallback settings", async () => {
		const configPath = join(tempDir, "v3-config.json");
		const v3Config = {
			version: 3,
			configured: true,
			models: {},
			orchestrator: {
				autonomy: "full",
				strictness: "normal",
				phases: {
					recon: true,
					challenge: true,
					architect: true,
					explore: true,
					plan: true,
					build: true,
					ship: true,
					retrospective: true,
				},
			},
			confidence: { enabled: true, thresholds: { proceed: "MEDIUM", abort: "LOW" } },
			fallback: {
				enabled: false,
				retryOnErrors: [429, 500],
				retryableErrorPatterns: [],
				maxFallbackAttempts: 3,
				cooldownSeconds: 15,
				timeoutSeconds: 10,
				notifyOnFallback: false,
			},
		};
		await writeFile(configPath, JSON.stringify(v3Config), "utf-8");

		const result = await loadConfig(configPath);

		expect(result?.version).toBe(7);
		// Preserved from v3
		expect(result?.fallback.enabled).toBe(false);
		expect(result?.fallback.retryOnErrors).toEqual([429, 500]);
		expect(result?.fallback.maxFallbackAttempts).toBe(3);
		expect(result?.fallback.cooldownSeconds).toBe(15);
		// v6 testMode defaults added
		expect(result?.fallback.testMode.enabled).toBe(false);
		// Memory defaults added
		expect(result?.memory.enabled).toBe(true);
		expect(result?.memory.decayHalfLifeDays).toBe(90);
	});

	test("v4 config migrates to v6 preserving groups and overrides, adding memory defaults", async () => {
		const configPath = join(tempDir, "v4-config.json");
		const v4Config = {
			version: 4,
			configured: true,
			groups: {
				architects: { primary: "anthropic/claude-opus-4-6", fallbacks: ["openai/gpt-5.4"] },
			},
			overrides: {
				"oc-planner": { primary: "openai/gpt-5.4" },
			},
			orchestrator: {
				autonomy: "manual",
				strictness: "lenient",
				phases: {
					recon: true,
					challenge: true,
					architect: true,
					explore: false,
					plan: true,
					build: true,
					ship: true,
					retrospective: true,
				},
			},
			confidence: { enabled: true, thresholds: { proceed: "LOW", abort: "LOW" } },
			fallback: {
				enabled: true,
				retryOnErrors: [429],
				retryableErrorPatterns: [],
				maxFallbackAttempts: 10,
				cooldownSeconds: 60,
				timeoutSeconds: 30,
				notifyOnFallback: true,
			},
		};
		await writeFile(configPath, JSON.stringify(v4Config), "utf-8");

		const result = await loadConfig(configPath);

		expect(result?.version).toBe(7);
		// Preserved from v4
		expect(result?.groups.architects.primary).toBe("anthropic/claude-opus-4-6");
		expect(result?.groups.architects.fallbacks).toEqual(["openai/gpt-5.4"]);
		expect(result?.overrides["oc-planner"].primary).toBe("openai/gpt-5.4");
		expect(result?.orchestrator.autonomy).toBe("manual");
		expect(result?.orchestrator.phases.explore).toBe(false);
		expect(result?.confidence.thresholds.proceed).toBe("LOW");
		// Memory defaults added by v4->v5 migration
		expect(result?.memory.enabled).toBe(true);
		expect(result?.memory.injectionBudget).toBe(2000);
		expect(result?.memory.decayHalfLifeDays).toBe(90);
		// v6 testMode defaults
		expect(result?.fallback.testMode.enabled).toBe(false);
	});

	test("v5 config migrates to v6 adding testMode defaults", async () => {
		const configPath = join(tempDir, "v5-config.json");
		const v5Config = {
			version: 5,
			configured: true,
			groups: {},
			overrides: {},
			orchestrator: {
				autonomy: "full",
				strictness: "normal",
				phases: {
					recon: true,
					challenge: true,
					architect: true,
					explore: true,
					plan: true,
					build: true,
					ship: true,
					retrospective: true,
				},
			},
			confidence: { enabled: true, thresholds: { proceed: "MEDIUM", abort: "LOW" } },
			fallback: {
				enabled: true,
				retryOnErrors: [429],
				retryableErrorPatterns: [],
				maxFallbackAttempts: 10,
				cooldownSeconds: 60,
				timeoutSeconds: 30,
				notifyOnFallback: true,
			},
			memory: {
				enabled: false,
				injectionBudget: 3000,
				decayHalfLifeDays: 30,
			},
		};
		await writeFile(configPath, JSON.stringify(v5Config), "utf-8");

		const result = await loadConfig(configPath);

		expect(result?.version).toBe(7);
		// Custom memory settings preserved (not overwritten with defaults)
		expect(result?.memory.enabled).toBe(false);
		expect(result?.memory.injectionBudget).toBe(3000);
		expect(result?.memory.decayHalfLifeDays).toBe(30);
		// v6 testMode defaults added
		expect(result?.fallback.testMode.enabled).toBe(false);
		expect(result?.fallback.testMode.sequence).toEqual([]);
	});

	test("migration chain persists v7 config to disk after loading v1", async () => {
		const configPath = join(tempDir, "persist-test.json");
		const v1Config = { version: 1, configured: true, models: {} };
		await writeFile(configPath, JSON.stringify(v1Config), "utf-8");

		await loadConfig(configPath);

		// File on disk should now be v7
		const raw = JSON.parse(await readFile(configPath, "utf-8"));
		expect(raw.version).toBe(7);
		expect(raw.orchestrator).toBeDefined();
		expect(raw.confidence).toBeDefined();
		expect(raw.fallback).toBeDefined();
		expect(raw.fallback.testMode).toBeDefined();
		expect(raw.fallback.testMode.enabled).toBe(false);
		expect(raw.groups).toBeDefined();
		expect(raw.overrides).toBeDefined();
		expect(raw.memory).toBeDefined();
		expect(raw.memory.enabled).toBe(true);
		expect(raw.memory.injectionBudget).toBe(2000);
		expect(raw.memory.decayHalfLifeDays).toBe(90);
		expect(raw.background).toBeDefined();
		expect(raw.background.enabled).toBe(false);
		expect(raw.routing).toBeDefined();
		expect(raw.routing.enabled).toBe(false);
		expect(raw.recovery).toBeDefined();
		expect(raw.recovery.enabled).toBe(true);
		expect(raw.mcp).toBeDefined();
		expect(raw.mcp.enabled).toBe(false);
	});
});

describe("Config migration chain integration: v6 to v7", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "config-migration-v6v7-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("v6 config migrates to v7 with background/routing/recovery/mcp defaults", async () => {
		const configPath = join(tempDir, "v6-config.json");
		const v6Config = {
			version: 6,
			configured: true,
			groups: { architects: { primary: "anthropic/claude-opus-4-6", fallbacks: [] } },
			overrides: {},
			orchestrator: {
				autonomy: "full",
				strictness: "normal",
				phases: {
					recon: true,
					challenge: true,
					architect: true,
					explore: true,
					plan: true,
					build: true,
					ship: true,
					retrospective: true,
				},
			},
			confidence: { enabled: true, thresholds: { proceed: "MEDIUM", abort: "LOW" } },
			fallback: {
				enabled: true,
				retryOnErrors: [429],
				retryableErrorPatterns: [],
				maxFallbackAttempts: 10,
				cooldownSeconds: 60,
				timeoutSeconds: 30,
				notifyOnFallback: true,
				testMode: { enabled: false, sequence: [] },
			},
			memory: { enabled: false, injectionBudget: 3000, decayHalfLifeDays: 60 },
		};
		await writeFile(configPath, JSON.stringify(v6Config), "utf-8");

		const result = await loadConfig(configPath);

		expect(result).not.toBeNull();
		expect(result?.version).toBe(7);

		expect(result?.groups.architects.primary).toBe("anthropic/claude-opus-4-6");
		expect(result?.memory.enabled).toBe(false);
		expect(result?.memory.injectionBudget).toBe(3000);

		expect(result?.background.enabled).toBe(false);
		expect(result?.background.maxConcurrent).toBe(5);
		expect(result?.background.persistence).toBe(true);
		expect(result?.routing.enabled).toBe(false);
		expect(result?.routing.categories).toEqual({});
		expect(result?.recovery.enabled).toBe(true);
		expect(result?.recovery.maxRetries).toBe(3);
		expect(result?.mcp.enabled).toBe(false);
		expect(result?.mcp.skills).toEqual({});
	});

	test("v7 config round-trips without re-migration", async () => {
		const configPath = join(tempDir, "v7-config.json");
		const { loadConfig: lc, saveConfig: sc } = await import("../../src/config");
		const { createDefaultConfig: cdc } = await import("../../src/config");
		const defaultCfg = cdc();
		await sc(defaultCfg, configPath);

		const loaded = await lc(configPath);
		expect(loaded?.version).toBe(7);
		expect(loaded?.background.enabled).toBe(false);
		expect(loaded?.routing.enabled).toBe(false);
		expect(loaded?.recovery.enabled).toBe(true);
		expect(loaded?.mcp.enabled).toBe(false);
	});
});
