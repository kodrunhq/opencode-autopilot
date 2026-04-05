import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultConfig, loadConfig, saveConfig } from "../../src/config";
import { configGroupsCheck, configHealthCheck, configVersionCheck } from "../../src/health/checks";

describe("Config Health Checks", () => {
	test("configHealthCheck returns fail for missing config", async () => {
		const result = await configHealthCheck("/nonexistent/path/config.json");
		expect(result.status).toBe("fail");
		expect(result.name).toBe("config-validity");
		expect(result.message).toContain("not found");
	});

	test("configHealthCheck returns pass for valid config", async () => {
		const tmpDir = join(tmpdir(), `config-test-${Date.now()}`);
		await mkdir(tmpDir, { recursive: true });
		const configPath = join(tmpDir, "config.json");

		try {
			const config = createDefaultConfig();
			config.configured = true;
			config.groups = {
				architects: { primary: "model-a", fallbacks: [] },
				challengers: { primary: "model-b", fallbacks: [] },
				builders: { primary: "model-a", fallbacks: [] },
				reviewers: { primary: "model-b", fallbacks: [] },
				"red-team": { primary: "model-c", fallbacks: [] },
				researchers: { primary: "model-a", fallbacks: [] },
				communicators: { primary: "model-a", fallbacks: [] },
				utilities: { primary: "model-d", fallbacks: [] },
			};
			await saveConfig(config, configPath);

			const result = await configHealthCheck(configPath);
			expect(result.status).toBe("pass");
			expect(result.message).toContain("v6");
		} finally {
			await rm(tmpDir, { recursive: true });
		}
	});

	test("configVersionCheck returns fail for missing config", async () => {
		const result = await configVersionCheck("/nonexistent/path/config.json");
		expect(result.status).toBe("fail");
		expect(result.name).toBe("config-version");
	});

	test("configVersionCheck returns pass for current version", async () => {
		const tmpDir = join(tmpdir(), `config-version-test-${Date.now()}`);
		await mkdir(tmpDir, { recursive: true });
		const configPath = join(tmpDir, "config.json");

		try {
			const config = createDefaultConfig();
			config.configured = true;
			await saveConfig(config, configPath);

			const result = await configVersionCheck(configPath);
			expect(result.status).toBe("pass");
			expect(result.message).toContain("latest version");
		} finally {
			await rm(tmpDir, { recursive: true });
		}
	});

	test("configGroupsCheck returns warn for missing group assignments", async () => {
		const tmpDir = join(tmpdir(), `config-groups-test-${Date.now()}`);
		await mkdir(tmpDir, { recursive: true });
		const configPath = join(tmpDir, "config.json");

		try {
			const config = createDefaultConfig();
			config.configured = true;
			config.groups = {
				architects: { primary: "model-a", fallbacks: [] },
			};
			await saveConfig(config, configPath);

			const result = await configGroupsCheck(configPath);
			expect(result.status).toBe("warn");
			expect(result.message).toContain("Missing model assignments");
		} finally {
			await rm(tmpDir, { recursive: true });
		}
	});

	test("configGroupsCheck returns pass for all groups assigned", async () => {
		const tmpDir = join(tmpdir(), `config-groups-pass-test-${Date.now()}`);
		await mkdir(tmpDir, { recursive: true });
		const configPath = join(tmpDir, "config.json");

		try {
			const config = createDefaultConfig();
			config.configured = true;
			config.groups = {
				architects: { primary: "model-a", fallbacks: [] },
				challengers: { primary: "model-b", fallbacks: [] },
				builders: { primary: "model-a", fallbacks: [] },
				reviewers: { primary: "model-b", fallbacks: [] },
				"red-team": { primary: "model-c", fallbacks: [] },
				researchers: { primary: "model-a", fallbacks: [] },
				communicators: { primary: "model-a", fallbacks: [] },
				utilities: { primary: "model-d", fallbacks: [] },
			};
			await saveConfig(config, configPath);

			const result = await configGroupsCheck(configPath);
			expect(result.status).toBe("pass");
			expect(result.message).toContain("required groups");
		} finally {
			await rm(tmpDir, { recursive: true });
		}
	});
});

describe("Config Migration", () => {
	test("migrateV6toV7 adds v7 fields", async () => {
		const { migrateV6toV7 } = await import("../../src/config/v7");
		const v6Config = createDefaultConfig();

		const v7Config = migrateV6toV7(v6Config);

		expect(v7Config.version).toBe(7);
		expect(v7Config.background).toBeDefined();
		expect(v7Config.background?.enabled).toBe(true);
		expect(v7Config.background?.maxConcurrent).toBe(5);
		expect(v7Config.autonomy).toBeDefined();
		expect(v7Config.autonomy?.enabled).toBe(false);
	});

	test("v7ConfigDefaults has correct values", async () => {
		const { v7ConfigDefaults } = await import("../../src/config/v7");

		expect(v7ConfigDefaults.background.enabled).toBe(true);
		expect(v7ConfigDefaults.background.maxConcurrent).toBe(5);
		expect(v7ConfigDefaults.background.defaultTimeout).toBe(300000);
		expect(v7ConfigDefaults.autonomy.enabled).toBe(false);
		expect(v7ConfigDefaults.autonomy.verification).toBe("normal");
		expect(v7ConfigDefaults.autonomy.maxIterations).toBe(10);
	});
});

describe("Config Barrel Exports", () => {
	test("config/index.ts re-exports all necessary items", async () => {
		const configModule = await import("../../src/config/index");

		expect(configModule.pluginConfigSchema).toBeDefined();
		expect(configModule.loadConfig).toBeDefined();
		expect(configModule.saveConfig).toBeDefined();
		expect(configModule.createDefaultConfig).toBeDefined();
		expect(configModule.migrateV6toV7).toBeDefined();
		expect(configModule.v7ConfigDefaults).toBeDefined();
	});
});
