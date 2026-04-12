import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createDefaultConfig,
	inspectConfigMode,
	loadConfig,
	pluginConfigSchema,
	saveConfig,
} from "../../src/config";
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
			expect(result.message).toContain("v7");
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
		const { migrateV6toV7 } = await import("../../src/config");
		const v7Config = createDefaultConfig();
		const v6Config = { ...v7Config, version: 6 as const };
		// @ts-expect-error intentionally stripping v7 fields for migration test
		delete v6Config.background;
		// @ts-expect-error intentionally stripping v7 fields for migration test
		delete v6Config.autonomy;

		const migratedConfig = migrateV6toV7(v6Config);

		expect(migratedConfig.version).toBe(7);
		expect(migratedConfig.background).toBeDefined();
		expect(migratedConfig.background?.enabled).toBe(false);
		expect(migratedConfig.background?.maxConcurrent).toBe(5);
		expect(migratedConfig.autonomy).toBeDefined();
		expect(migratedConfig.autonomy?.enabled).toBe(false);
	});

	test("v7ConfigDefaults has correct values", async () => {
		const { v7ConfigDefaults } = await import("../../src/config");

		expect(v7ConfigDefaults.background.enabled).toBe(false);
		expect(v7ConfigDefaults.background.maxConcurrent).toBe(5);
		expect(v7ConfigDefaults.autonomy.enabled).toBe(false);
		expect(v7ConfigDefaults.autonomy.verification).toBe("normal");
		expect(v7ConfigDefaults.autonomy.maxIterations).toBe(10);
		expect(v7ConfigDefaults.mode).toEqual({
			interactionMode: "interactive",
			executionMode: "foreground",
			visibilityMode: "summary",
			verificationMode: "normal",
		});
	});
});

describe("Canonical mode validation", () => {
	test("inspectConfigMode warns when legacy autonomy intent is contradictory", () => {
		const config = {
			...createDefaultConfig(),
			orchestrator: {
				...createDefaultConfig().orchestrator,
				autonomy: "full" as const,
			},
		};

		const result = inspectConfigMode(config);

		expect(result.hasErrors).toBe(false);
		expect(result.issues.map((issue) => issue.code)).toContain("disabled_legacy_mode_flags");
	});

	test("pluginConfigSchema rejects contradictory autonomous mode", () => {
		const config = {
			...createDefaultConfig(),
			mode: {
				interactionMode: "autonomous" as const,
				executionMode: "foreground" as const,
				visibilityMode: "summary" as const,
				verificationMode: "strict" as const,
			},
			orchestrator: {
				...createDefaultConfig().orchestrator,
				autonomy: "full" as const,
			},
		};

		const result = pluginConfigSchema.safeParse(config);

		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.message).join("\n")).toContain(
			"Autonomous mode requires executionMode=background.",
		);
	});

	test("pluginConfigSchema accepts debug visibility without enabling it by default", () => {
		const config = {
			...createDefaultConfig(),
			mode: {
				...createDefaultConfig().mode,
				visibilityMode: "debug" as const,
			},
		};

		const result = pluginConfigSchema.safeParse(config);

		expect(result.success).toBe(true);
		expect(result.data?.mode.visibilityMode).toBe("debug");
		expect(createDefaultConfig().mode.visibilityMode).toBe("summary");
	});

	test("saveConfig rejects autonomous mode without verification commands", async () => {
		const tmpDir = join(tmpdir(), `config-autonomous-${Date.now()}`);
		await mkdir(tmpDir, { recursive: true });
		const configPath = join(tmpDir, "config.json");

		try {
			const baseConfig = createDefaultConfig();
			const config = {
				...baseConfig,
				mode: {
					interactionMode: "autonomous" as const,
					executionMode: "background" as const,
					visibilityMode: "summary" as const,
					verificationMode: "strict" as const,
				},
				orchestrator: { ...baseConfig.orchestrator, autonomy: "full" as const },
				background: { ...baseConfig.background, enabled: true },
				autonomy: { ...baseConfig.autonomy, enabled: true, verification: "strict" as const },
				routing: { ...baseConfig.routing, enabled: true },
			};

			return expect(saveConfig(config, configPath)).rejects.toThrow(
				"Autonomous mode requires a verification profile",
			);
		} finally {
			await rm(tmpDir, { recursive: true, force: true });
		}
	});

	test("loadConfig injects canonical mode into legacy v7 configs", async () => {
		const tmpDir = join(tmpdir(), `config-mode-migration-${Date.now()}`);
		await mkdir(tmpDir, { recursive: true });
		const configPath = join(tmpDir, "config.json");

		try {
			const legacyV7Config = {
				version: 7,
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
					maxParallelTasks: 5,
				},
				confidence: { enabled: true, thresholds: { proceed: "MEDIUM", abort: "LOW" } },
				fallback: createDefaultConfig().fallback,
				memory: createDefaultConfig().memory,
				notifications: createDefaultConfig().notifications,
				verification: createDefaultConfig().verification,
				background: { enabled: false, maxConcurrent: 5, persistence: true },
				autonomy: { enabled: false, verification: "normal", maxIterations: 10 },
				routing: { enabled: false, categories: {} },
				recovery: createDefaultConfig().recovery,
				mcp: createDefaultConfig().mcp,
				hashline_edit: createDefaultConfig().hashline_edit,
			};
			await writeFile(configPath, JSON.stringify(legacyV7Config, null, 2), "utf-8");

			const loaded = await loadConfig(configPath);

			expect(loaded?.mode.interactionMode).toBe("interactive");
			expect(loaded?.mode.executionMode).toBe("foreground");
		} finally {
			await rm(tmpDir, { recursive: true, force: true });
		}
	});
});

describe("Config Barrel Exports", () => {
	test("config/index.ts re-exports all necessary items", async () => {
		const configModule = await import("../../src/config/index");

		expect(configModule.pluginConfigSchema).toBeDefined();
		expect(configModule.loadConfig).toBeDefined();
		expect(configModule.saveConfig).toBeDefined();
		expect(configModule.createDefaultConfig).toBeDefined();
		expect(configModule.modeConfigSchema).toBeDefined();
		expect(configModule.inspectConfigMode).toBeDefined();
		expect(configModule.migrateV6toV7).toBeDefined();
		expect(configModule.v7ConfigDefaults).toBeDefined();
	});
});
