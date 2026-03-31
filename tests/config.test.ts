import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	createDefaultConfig,
	isFirstLoad,
	loadConfig,
	type PluginConfig,
	saveConfig,
} from "../src/config";

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

	test("works with v2 configs (configured:false returns true)", () => {
		const config = createDefaultConfig();
		expect(config.version).toBe(2);
		expect(isFirstLoad(config)).toBe(true);

		const configured = { ...config, configured: true };
		expect(isFirstLoad(configured)).toBe(false);
	});
});

describe("createDefaultConfig", () => {
	test("returns v2 config with version:2", () => {
		const config = createDefaultConfig();
		expect(config.version).toBe(2);
		expect(config.configured).toBe(false);
		expect(config.models).toEqual({});
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
		configPath = join(tempDir, "opencode-assets.json");
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
		expect(parsed.version).toBe(2);
		expect(parsed.orchestrator).toBeDefined();

		const loaded = await loadConfig(configPath);
		expect(loaded).toEqual(config);
	});

	test("saveConfig creates parent directory if missing", async () => {
		const nestedPath = join(tempDir, "nested", "deep", "opencode-assets.json");
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
		await writeFile(
			configPath,
			JSON.stringify({ version: 99, configured: "yes", models: null }),
		);

		await expect(loadConfig(configPath)).rejects.toThrow();
	});
});

describe("v1 to v2 migration", () => {
	let tempDir: string;
	let configPath: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `opencode-config-migration-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		configPath = join(tempDir, "opencode-assets.json");
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("loadConfig on a v1 JSON file returns v2 config with migrated defaults", async () => {
		const v1Config = {
			version: 1,
			configured: true,
			models: { default: "gpt-4" },
		};
		await writeFile(configPath, JSON.stringify(v1Config), "utf-8");

		const result = await loadConfig(configPath);
		expect(result).not.toBeNull();
		expect(result!.version).toBe(2);
		expect(result!.configured).toBe(true);
		expect(result!.models).toEqual({ default: "gpt-4" });
		expect(result!.orchestrator.autonomy).toBe("full");
		expect(result!.orchestrator.strictness).toBe("normal");
		expect(result!.confidence.enabled).toBe(true);
		expect(result!.confidence.thresholds.proceed).toBe("MEDIUM");
		expect(result!.confidence.thresholds.abort).toBe("LOW");
	});

	test("loadConfig on a v1 JSON file writes migrated v2 back to disk", async () => {
		const v1Config = { version: 1, configured: true, models: {} };
		await writeFile(configPath, JSON.stringify(v1Config), "utf-8");

		await loadConfig(configPath);

		const raw = JSON.parse(await readFile(configPath, "utf-8"));
		expect(raw.version).toBe(2);
		expect(raw.orchestrator).toBeDefined();
		expect(raw.confidence).toBeDefined();
	});

	test("loadConfig on a v2 JSON file returns v2 config as-is", async () => {
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
		expect(result!.version).toBe(2);
		expect(result!.orchestrator.autonomy).toBe("supervised");
		expect(result!.orchestrator.strictness).toBe("strict");
		expect(result!.orchestrator.phases.challenge).toBe(false);
		expect(result!.confidence.enabled).toBe(false);
		expect(result!.confidence.thresholds.proceed).toBe("HIGH");
	});
});

describe("v2 schema validation", () => {
	let tempDir: string;
	let configPath: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `opencode-config-validation-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		configPath = join(tempDir, "opencode-assets.json");
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
