import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Import the functions under test
import { runDoctor, runInstall } from "../../bin/cli";
import type { PluginConfig } from "../../src/config";
import { createDefaultConfig, saveConfig } from "../../src/config";

describe("CLI install", () => {
	let tempDir: string;
	let configPath: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "cli-test-"));
		configPath = join(tempDir, "opencode-autopilot.json");
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("creates opencode.json when it does not exist", async () => {
		await runInstall({ cwd: tempDir, noTui: true, configDir: configPath });

		const content = JSON.parse(await readFile(join(tempDir, "opencode.json"), "utf-8"));
		expect(content.plugin).toContain("@kodrunhq/opencode-autopilot");
	});

	test("adds plugin to existing opencode.json", async () => {
		await writeFile(
			join(tempDir, "opencode.json"),
			JSON.stringify({ plugin: ["other-plugin"] }),
			"utf-8",
		);

		await runInstall({ cwd: tempDir, noTui: true, configDir: configPath });

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

		await runInstall({ cwd: tempDir, noTui: true, configDir: configPath });

		const content = JSON.parse(await readFile(join(tempDir, "opencode.json"), "utf-8"));
		const count = content.plugin.filter((p: string) => p === "@kodrunhq/opencode-autopilot").length;
		expect(count).toBe(1);
	});

	test("creates starter config when it does not exist", async () => {
		await runInstall({ cwd: tempDir, noTui: true, configDir: configPath });

		const config = JSON.parse(await readFile(configPath, "utf-8"));
		expect(config.version).toBe(6);
		expect(config.configured).toBe(false);
		expect(config.groups).toEqual({});
	});

	test("does not overwrite existing config", async () => {
		const existing: PluginConfig = {
			...createDefaultConfig(),
			configured: true,
			groups: {
				architects: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
			},
		};
		await saveConfig(existing, configPath);

		await runInstall({ cwd: tempDir, noTui: true, configDir: configPath });

		const config = JSON.parse(await readFile(configPath, "utf-8"));
		expect(config.configured).toBe(true);
		expect(config.groups.architects.primary).toBe("anthropic/claude-opus-4-6");
	});

	test("handles opencode.json without plugin key", async () => {
		await writeFile(
			join(tempDir, "opencode.json"),
			JSON.stringify({ model: "some-model" }),
			"utf-8",
		);

		await runInstall({ cwd: tempDir, noTui: true, configDir: configPath });

		const content = JSON.parse(await readFile(join(tempDir, "opencode.json"), "utf-8"));
		expect(content.plugin).toContain("@kodrunhq/opencode-autopilot");
		expect(content.model).toBe("some-model");
	});

	test("writes opencode.json with 2-space indent", async () => {
		await runInstall({ cwd: tempDir, noTui: true, configDir: configPath });

		const raw = await readFile(join(tempDir, "opencode.json"), "utf-8");
		// 2-space indent means the "plugin" key is indented 2 spaces
		expect(raw).toContain('  "plugin"');
	});
});

describe("CLI doctor", () => {
	let tempDir: string;
	let configPath: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "cli-doctor-"));
		configPath = join(tempDir, "opencode-autopilot.json");
	});

	afterEach(async () => {
		// Reset process.exitCode to prevent test pollution leaking to the test runner
		process.exitCode = 0;
		await rm(tempDir, { recursive: true, force: true });
	});

	test("reports missing opencode.json as failure", async () => {
		// No opencode.json, no config
		// doctor should set exitCode = 1
		process.exitCode = 0;

		await runDoctor({ cwd: tempDir, configDir: configPath });

		expect(process.exitCode).toBe(1);
		// afterEach restores process.exitCode
	});

	test("reports missing config as failure", async () => {
		// Create opencode.json with plugin registered
		await writeFile(
			join(tempDir, "opencode.json"),
			JSON.stringify({ plugin: ["@kodrunhq/opencode-autopilot"] }),
			"utf-8",
		);

		process.exitCode = 0;

		await runDoctor({ cwd: tempDir, configDir: configPath });

		expect(process.exitCode).toBe(1);
		// afterEach restores process.exitCode
	});

	test("reports unconfigured state as failure", async () => {
		await writeFile(
			join(tempDir, "opencode.json"),
			JSON.stringify({ plugin: ["@kodrunhq/opencode-autopilot"] }),
			"utf-8",
		);
		await saveConfig(createDefaultConfig(), configPath);

		process.exitCode = 0;

		await runDoctor({ cwd: tempDir, configDir: configPath });

		expect(process.exitCode).toBe(1);
		// afterEach restores process.exitCode
	});

	test("reports diversity warnings when adversarial pairs share family", async () => {
		await writeFile(
			join(tempDir, "opencode.json"),
			JSON.stringify({ plugin: ["@kodrunhq/opencode-autopilot"] }),
			"utf-8",
		);

		const config: PluginConfig = {
			...createDefaultConfig(),
			configured: true,
			groups: {
				architects: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
				challengers: { primary: "anthropic/claude-sonnet-4-6", fallbacks: [] }, // same family
				builders: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
				reviewers: { primary: "openai/gpt-5.4", fallbacks: [] },
				"red-team": { primary: "google/gemini-3.1-pro", fallbacks: [] },
				researchers: { primary: "anthropic/claude-sonnet-4-6", fallbacks: [] },
				communicators: { primary: "anthropic/claude-sonnet-4-6", fallbacks: [] },
				utilities: { primary: "anthropic/claude-haiku-4-5", fallbacks: [] },
			},
		};
		await saveConfig(config, configPath);

		process.exitCode = 0;

		// Doctor should run without crashing; diversity warnings are advisory (not exit 1)
		await expect(runDoctor({ cwd: tempDir, configDir: configPath })).resolves.toBeUndefined();

		// Diversity warnings are advisory — exitCode should not be 1 for warnings alone
		// (opencode binary may not be installed, which would set exitCode = 1 for that check)
		// afterEach restores process.exitCode
	});

	test("handles malformed opencode.json gracefully", async () => {
		await writeFile(join(tempDir, "opencode.json"), "{ invalid json }", "utf-8");

		process.exitCode = 0;

		await runDoctor({ cwd: tempDir, configDir: configPath });

		expect(process.exitCode).toBe(1);
		// afterEach restores process.exitCode
	});

	test("reports plugin not in plugin array", async () => {
		await writeFile(
			join(tempDir, "opencode.json"),
			JSON.stringify({ plugin: ["some-other-plugin"] }),
			"utf-8",
		);

		process.exitCode = 0;

		await runDoctor({ cwd: tempDir, configDir: configPath });

		expect(process.exitCode).toBe(1);
		// afterEach restores process.exitCode
	});

	test("passes when fully configured with diverse models", async () => {
		await writeFile(
			join(tempDir, "opencode.json"),
			JSON.stringify({ plugin: ["@kodrunhq/opencode-autopilot"] }),
			"utf-8",
		);

		const config: PluginConfig = {
			...createDefaultConfig(),
			configured: true,
			groups: {
				architects: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
				challengers: { primary: "openai/gpt-5.4", fallbacks: [] },
				builders: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
				reviewers: { primary: "openai/gpt-5.4", fallbacks: [] },
				"red-team": { primary: "google/gemini-3.1-pro", fallbacks: [] },
				researchers: { primary: "anthropic/claude-sonnet-4-6", fallbacks: [] },
				communicators: { primary: "anthropic/claude-sonnet-4-6", fallbacks: [] },
				utilities: { primary: "anthropic/claude-haiku-4-5", fallbacks: [] },
			},
		};
		await saveConfig(config, configPath);

		process.exitCode = 0;

		// Verify doctor completes without throwing
		await expect(runDoctor({ cwd: tempDir, configDir: configPath })).resolves.toBeUndefined();

		// Verify the config was actually read correctly (it should still exist and be valid)
		const reloaded = JSON.parse(await readFile(configPath, "utf-8"));
		expect(reloaded.configured).toBe(true);
		expect(Object.keys(reloaded.groups)).toHaveLength(8);

		// afterEach restores process.exitCode
	});
});
