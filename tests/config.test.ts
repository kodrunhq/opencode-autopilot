import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultConfig, isFirstLoad, loadConfig, saveConfig } from "../src/config";
import {
	fallbackConfigSchemaV6,
	testModeSchema,
} from "../src/orchestrator/fallback/fallback-config";

describe("isFirstLoad", () => {
	test("returns true when config is null", () => {
		expect(isFirstLoad(null)).toBe(true);
	});

	test("returns true when configured is false", () => {
		const config = createDefaultConfig();
		expect(isFirstLoad(config)).toBe(true);
	});

	test("returns false when configured is true", () => {
		const config = { ...createDefaultConfig(), configured: true };
		expect(isFirstLoad(config)).toBe(false);
	});

	test("works with v5 configs (configured:false returns true)", () => {
		const config = createDefaultConfig();
		expect(config.version).toBe(6);
		expect(isFirstLoad(config)).toBe(true);

		const configured = { ...config, configured: true };
		expect(isFirstLoad(configured)).toBe(false);
	});
});

describe("createDefaultConfig", () => {
	test("returns v6 config with version:6", () => {
		const config = createDefaultConfig();
		expect(config.version).toBe(6);
		expect(config.configured).toBe(false);
		expect(config.groups).toEqual({});
		expect(config.overrides).toEqual({});
	});

	test("orchestrator defaults: autonomy full, strictness normal, all phases true", () => {
		const config = createDefaultConfig();
		expect(config.orchestrator.autonomy).toBe("full");
		expect(config.orchestrator.strictness).toBe("normal");
		expect(config.orchestrator.phases.recon).toBe(true);
		expect(config.orchestrator.phases.challenge).toBe(true);
		expect(config.orchestrator.phases.architect).toBe(true);
		expect(config.orchestrator.phases.explore).toBe(true);
		expect(config.orchestrator.phases.plan).toBe(true);
		expect(config.orchestrator.phases.build).toBe(true);
		expect(config.orchestrator.phases.ship).toBe(true);
		expect(config.orchestrator.phases.retrospective).toBe(true);
	});

	test("confidence defaults: enabled true, proceed MEDIUM, abort LOW", () => {
		const config = createDefaultConfig();
		expect(config.confidence.enabled).toBe(true);
		expect(config.confidence.thresholds.proceed).toBe("MEDIUM");
		expect(config.confidence.thresholds.abort).toBe("LOW");
	});
});

describe("saveConfig and loadConfig round-trip", () => {
	let tempDir: string;
	let configPath: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `opencode-config-test-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		configPath = join(tempDir, "opencode-autopilot.json");
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("loadConfig returns null when file does not exist", async () => {
		const result = await loadConfig(join(tempDir, "nonexistent.json"));
		expect(result).toBeNull();
	});

	test("saveConfig writes JSON and loadConfig reads it back", async () => {
		const config = createDefaultConfig();
		await saveConfig(config, configPath);

		const raw = await readFile(configPath, "utf-8");
		const parsed = JSON.parse(raw);
		expect(parsed.version).toBe(6);
		expect(parsed.orchestrator).toBeDefined();
		expect(parsed.fallback).toBeDefined();
		expect(parsed.groups).toBeDefined();
		expect(parsed.overrides).toBeDefined();

		const loaded = await loadConfig(configPath);
		expect(loaded).toEqual(config);
	});

	test("saveConfig creates parent directory if missing", async () => {
		const nestedPath = join(tempDir, "nested", "deep", "opencode-autopilot.json");
		const config = createDefaultConfig();
		await saveConfig(config, nestedPath);

		const loaded = await loadConfig(nestedPath);
		expect(loaded).toEqual(config);
	});

	test("loadConfig throws on malformed JSON", async () => {
		await writeFile(configPath, "{ not valid json !!!");

		await expect(loadConfig(configPath)).rejects.toThrow();
	});

	test("loadConfig throws on invalid config schema", async () => {
		await writeFile(configPath, JSON.stringify({ version: 99, configured: "yes", models: null }));

		await expect(loadConfig(configPath)).rejects.toThrow();
	});
});

describe("v1 to v5 migration", () => {
	let tempDir: string;
	let configPath: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `opencode-config-migration-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		configPath = join(tempDir, "opencode-autopilot.json");
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("loadConfig on a v1 JSON file returns v5 config with migrated defaults", async () => {
		const v1Config = {
			version: 1,
			configured: true,
			models: { default: "gpt-4" },
		};
		await writeFile(configPath, JSON.stringify(v1Config), "utf-8");

		const result = await loadConfig(configPath);
		expect(result).not.toBeNull();
		expect(result?.version).toBe(6);
		expect(result?.configured).toBe(true);
		// "default" is not in AGENT_REGISTRY, so it becomes an override
		expect(result?.overrides.default).toBeDefined();
		expect(result?.overrides.default.primary).toBe("gpt-4");
		expect(result?.orchestrator.autonomy).toBe("full");
		expect(result?.orchestrator.strictness).toBe("normal");
		expect(result?.confidence.enabled).toBe(true);
		expect(result?.confidence.thresholds.proceed).toBe("MEDIUM");
		expect(result?.confidence.thresholds.abort).toBe("LOW");
		expect(result?.fallback.enabled).toBe(true);
		expect(result?.fallback.maxFallbackAttempts).toBe(10);
	});

	test("loadConfig on a v1 JSON file writes migrated v5 back to disk", async () => {
		const v1Config = { version: 1, configured: true, models: {} };
		await writeFile(configPath, JSON.stringify(v1Config), "utf-8");

		await loadConfig(configPath);

		const raw = JSON.parse(await readFile(configPath, "utf-8"));
		expect(raw.version).toBe(6);
		expect(raw.orchestrator).toBeDefined();
		expect(raw.confidence).toBeDefined();
		expect(raw.fallback).toBeDefined();
		expect(raw.groups).toBeDefined();
		expect(raw.overrides).toBeDefined();
	});
});

describe("v2 to v5 migration", () => {
	let tempDir: string;
	let configPath: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `opencode-config-v2v3-migration-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		configPath = join(tempDir, "opencode-autopilot.json");
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("loadConfig on a v2 JSON file returns v5 config with fallback defaults", async () => {
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
		expect(result).not.toBeNull();
		expect(result?.version).toBe(6);
		expect(result?.orchestrator.autonomy).toBe("supervised");
		expect(result?.orchestrator.strictness).toBe("strict");
		expect(result?.orchestrator.phases.challenge).toBe(false);
		expect(result?.confidence.enabled).toBe(false);
		expect(result?.confidence.thresholds.proceed).toBe("HIGH");
		expect(result?.fallback.enabled).toBe(true);
		expect(result?.fallback.retryOnErrors).toEqual([401, 402, 429, 500, 502, 503, 504]);
		expect(result?.fallback.maxFallbackAttempts).toBe(10);
		expect(result?.fallback.cooldownSeconds).toBe(60);
		expect(result?.fallback.timeoutSeconds).toBe(30);
		expect(result?.groups).toEqual({});
		expect(result?.overrides).toEqual({});
	});

	test("loadConfig on a v2 JSON file writes migrated v5 back to disk", async () => {
		const v2Config = {
			version: 2,
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
			confidence: {
				enabled: true,
				thresholds: { proceed: "MEDIUM", abort: "LOW" },
			},
		};
		await writeFile(configPath, JSON.stringify(v2Config), "utf-8");

		await loadConfig(configPath);

		const raw = JSON.parse(await readFile(configPath, "utf-8"));
		expect(raw.version).toBe(6);
		expect(raw.fallback).toBeDefined();
		expect(raw.fallback.enabled).toBe(true);
		expect(raw.groups).toBeDefined();
		expect(raw.overrides).toBeDefined();
	});
});

describe("v3 migration to v5", () => {
	let tempDir: string;
	let configPath: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `opencode-config-v3-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		configPath = join(tempDir, "opencode-autopilot.json");
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("loadConfig on a v3 JSON file returns v5 config with migration", async () => {
		const v3Config = {
			version: 3,
			configured: true,
			models: { default: "gpt-4" },
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
			confidence: {
				enabled: true,
				thresholds: { proceed: "MEDIUM", abort: "LOW" },
			},
			fallback: {
				enabled: false,
				retryOnErrors: [429],
				retryableErrorPatterns: [],
				maxFallbackAttempts: 5,
				cooldownSeconds: 30,
				timeoutSeconds: 15,
				notifyOnFallback: false,
			},
		};
		await writeFile(configPath, JSON.stringify(v3Config), "utf-8");

		const result = await loadConfig(configPath);
		expect(result).not.toBeNull();
		expect(result?.version).toBe(6);
		expect(result?.fallback.enabled).toBe(false);
		expect(result?.fallback.retryOnErrors).toEqual([429]);
		expect(result?.fallback.maxFallbackAttempts).toBe(5);
		// "default" not in registry, becomes override
		expect(result?.overrides.default).toBeDefined();
		expect(result?.overrides.default.primary).toBe("gpt-4");
	});
});

describe("v3 to v5 migration", () => {
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

	test("loadConfig on a v3 JSON file returns v5 config with groups", async () => {
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
		};
		await writeFile(configPath, JSON.stringify(v3Config), "utf-8");

		const result = await loadConfig(configPath);
		expect(result).not.toBeNull();
		expect(result?.version).toBe(6);
		expect(result?.configured).toBe(true);
		// oc-architect and oc-planner are both "architects" group with same model
		expect(result?.groups.architects).toBeDefined();
		expect(result?.groups.architects.primary).toBe("anthropic/claude-opus-4-6");
		// oc-implementer is "builders" group
		expect(result?.groups.builders).toBeDefined();
		expect(result?.groups.builders.primary).toBe("openai/gpt-5.4");
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
		};
		await writeFile(configPath, JSON.stringify(v3Config), "utf-8");

		const result = await loadConfig(configPath);
		expect(result?.version).toBe(6);
		// First agent sets group primary, second becomes override
		expect(result?.groups.architects.primary).toBe("anthropic/claude-opus-4-6");
		expect(result?.overrides["oc-planner"]).toBeDefined();
		expect(result?.overrides["oc-planner"].primary).toBe("openai/gpt-5.4");
	});

	test("v3 fallback_models string migrates to per-group fallbacks", async () => {
		const v3Config = {
			version: 3,
			configured: true,
			models: { "oc-architect": "anthropic/claude-opus-4-6" },
			fallback_models: "openai/gpt-5.4",
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
		};
		await writeFile(configPath, JSON.stringify(v3Config), "utf-8");

		const result = await loadConfig(configPath);
		expect(result?.groups.architects.fallbacks).toEqual(["openai/gpt-5.4"]);
	});

	test("v3 fallback_models array migrates to per-group fallbacks", async () => {
		const v3Config = {
			version: 3,
			configured: true,
			models: { "oc-implementer": "anthropic/claude-opus-4-6" },
			fallback_models: ["openai/gpt-5.4", "google/gemini-3.1-pro"],
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
		};
		await writeFile(configPath, JSON.stringify(v3Config), "utf-8");

		const result = await loadConfig(configPath);
		expect(result?.groups.builders.fallbacks).toEqual(["openai/gpt-5.4", "google/gemini-3.1-pro"]);
	});

	test("v3 config writes migrated v5 back to disk", async () => {
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
				enabled: true,
				retryOnErrors: [429],
				retryableErrorPatterns: [],
				maxFallbackAttempts: 10,
				cooldownSeconds: 60,
				timeoutSeconds: 30,
				notifyOnFallback: true,
			},
		};
		await writeFile(configPath, JSON.stringify(v3Config), "utf-8");
		await loadConfig(configPath);

		const raw = JSON.parse(await readFile(configPath, "utf-8"));
		expect(raw.version).toBe(6);
		expect(raw.groups).toBeDefined();
		expect(raw.overrides).toBeDefined();
	});
});

describe("v4 to v5 migration", () => {
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

	test("loadConfig on a v4 JSON file returns v5 config via migration", async () => {
		const v4Config = {
			version: 4,
			configured: true,
			groups: {
				architects: { primary: "anthropic/claude-opus-4-6", fallbacks: ["openai/gpt-5.4"] },
			},
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
		};
		await writeFile(configPath, JSON.stringify(v4Config), "utf-8");

		const result = await loadConfig(configPath);
		expect(result?.version).toBe(6);
		expect(result?.groups.architects.primary).toBe("anthropic/claude-opus-4-6");
		expect(result?.groups.architects.fallbacks).toEqual(["openai/gpt-5.4"]);
	});

	test("createDefaultConfig returns v5 with empty groups", () => {
		const config = createDefaultConfig();
		expect(config.version).toBe(6);
		expect(config.configured).toBe(false);
		expect(config.groups).toEqual({});
		expect(config.overrides).toEqual({});
	});

	test("v1 → v2 → v3 → v4 → v5 full chain migration works", async () => {
		const v1Config = { version: 1, configured: true, models: { default: "gpt-4" } };
		await writeFile(configPath, JSON.stringify(v1Config), "utf-8");

		const result = await loadConfig(configPath);
		expect(result?.version).toBe(6);
		expect(result?.configured).toBe(true);
		expect(result?.groups).toBeDefined();
		expect(result?.overrides).toBeDefined();
	});
});

describe("v3 schema validation", () => {
	let tempDir: string;
	let configPath: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `opencode-config-validation-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		configPath = join(tempDir, "opencode-autopilot.json");
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("rejects invalid autonomy value", async () => {
		const invalid = {
			version: 2,
			configured: true,
			models: {},
			orchestrator: {
				autonomy: "turbo",
				strictness: "normal",
				phases: {},
			},
			confidence: {
				enabled: true,
				thresholds: { proceed: "MEDIUM", abort: "LOW" },
			},
		};
		await writeFile(configPath, JSON.stringify(invalid), "utf-8");

		await expect(loadConfig(configPath)).rejects.toThrow();
	});

	test("rejects invalid phase toggle type (string instead of boolean)", async () => {
		const invalid = {
			version: 2,
			configured: true,
			models: {},
			orchestrator: {
				autonomy: "full",
				strictness: "normal",
				phases: { recon: "yes" },
			},
			confidence: {
				enabled: true,
				thresholds: { proceed: "MEDIUM", abort: "LOW" },
			},
		};
		await writeFile(configPath, JSON.stringify(invalid), "utf-8");

		await expect(loadConfig(configPath)).rejects.toThrow();
	});
});

describe("testModeSchema", () => {
	test("defaults to enabled:false and empty sequence", () => {
		const result = testModeSchema.parse({});
		expect(result.enabled).toBe(false);
		expect(result.sequence).toEqual([]);
	});

	test("accepts valid failure modes", () => {
		const result = testModeSchema.parse({
			enabled: true,
			sequence: ["rate_limit", "quota_exceeded"],
		});
		expect(result.enabled).toBe(true);
		expect(result.sequence).toEqual(["rate_limit", "quota_exceeded"]);
	});

	test("rejects invalid failure mode", () => {
		expect(() => testModeSchema.parse({ sequence: ["invalid"] })).toThrow();
	});
});

describe("v6 config schema", () => {
	test("createDefaultConfig returns version 6 with testMode defaults", () => {
		const config = createDefaultConfig();
		expect(config.version).toBe(6);
		expect(config.fallback.testMode).toEqual({ enabled: false, sequence: [] });
	});

	test("fallbackConfigSchemaV6 parses with testMode defaults", () => {
		const result = fallbackConfigSchemaV6.parse({});
		expect(result.testMode).toEqual({ enabled: false, sequence: [] });
		expect(result.enabled).toBe(true);
	});
});

describe("v5 to v6 migration", () => {
	let tempDir: string;
	let configPath: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `opencode-config-v5v6-migration-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		configPath = join(tempDir, "opencode-autopilot.json");
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("loadConfig on a v5 JSON file returns v6 with testMode defaults", async () => {
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
			memory: { enabled: true, injectionBudget: 2000, decayHalfLifeDays: 90 },
		};
		await writeFile(configPath, JSON.stringify(v5Config), "utf-8");

		const result = await loadConfig(configPath);
		expect(result).not.toBeNull();
		expect(result?.version).toBe(6);
		expect(result?.fallback.testMode).toEqual({ enabled: false, sequence: [] });
	});

	test("loadConfig on v5 writes migrated v6 back to disk", async () => {
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
			memory: { enabled: true, injectionBudget: 2000, decayHalfLifeDays: 90 },
		};
		await writeFile(configPath, JSON.stringify(v5Config), "utf-8");
		await loadConfig(configPath);

		const raw = JSON.parse(await readFile(configPath, "utf-8"));
		expect(raw.version).toBe(6);
		expect(raw.fallback.testMode).toEqual({ enabled: false, sequence: [] });
	});

	test("v1 -> v6 full chain migration works", async () => {
		const v1Config = { version: 1, configured: true, models: { default: "gpt-4" } };
		await writeFile(configPath, JSON.stringify(v1Config), "utf-8");

		const result = await loadConfig(configPath);
		expect(result?.version).toBe(6);
		expect(result?.fallback.testMode).toEqual({ enabled: false, sequence: [] });
	});
});
