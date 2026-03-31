import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
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
		const config: PluginConfig = { version: 1, configured: false, models: {} };
		expect(isFirstLoad(config)).toBe(true);
	});

	test("returns false when configured is true", () => {
		const config: PluginConfig = { version: 1, configured: true, models: {} };
		expect(isFirstLoad(config)).toBe(false);
	});
});

describe("createDefaultConfig", () => {
	test("returns object with version 1 and configured false", () => {
		const config = createDefaultConfig();
		expect(config.version).toBe(1);
		expect(config.configured).toBe(false);
		expect(config.models).toEqual({});
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
		const config: PluginConfig = {
			version: 1,
			configured: true,
			models: { "code-reviewer": "anthropic/claude-sonnet-4-20250514" },
		};
		await saveConfig(config, configPath);

		const raw = await readFile(configPath, "utf-8");
		expect(JSON.parse(raw)).toEqual(config);

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
		const { writeFile } = await import("node:fs/promises");
		await writeFile(configPath, "{ not valid json !!!");

		await expect(loadConfig(configPath)).rejects.toThrow();
	});

	test("loadConfig throws on invalid config schema", async () => {
		const { writeFile } = await import("node:fs/promises");
		await writeFile(configPath, JSON.stringify({ version: 99, configured: "yes", models: null }));

		await expect(loadConfig(configPath)).rejects.toThrow();
	});
});
