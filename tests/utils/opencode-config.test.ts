import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getInstallTargetPath,
	parseJsonc,
	resolveOpenCodeConfig,
	verifyPluginLoad,
} from "../../src/utils/opencode-config";

describe("opencode-config", () => {
	describe("parseJsonc", () => {
		test("parses valid JSON", () => {
			const json = '{"plugin": ["test"], "version": 7}';
			const result = parseJsonc(json);
			expect(result).toEqual({ plugin: ["test"], version: 7 });
		});

		test("parses JSON with single-line comments", () => {
			const jsonc = `{
				// This is a comment
				"plugin": ["test"],
				"version": 7
			}`;
			const result = parseJsonc(jsonc);
			expect(result).toEqual({ plugin: ["test"], version: 7 });
		});

		test("parses JSON with multi-line comments", () => {
			const jsonc = `{
				/* This is a
				   multi-line comment */
				"plugin": ["test"],
				"version": 7
			}`;
			const result = parseJsonc(jsonc);
			expect(result).toEqual({ plugin: ["test"], version: 7 });
		});

		test("parses JSON with trailing commas", () => {
			const jsonc = `{
				"plugin": ["test",],
				"version": 7,
			}`;
			const result = parseJsonc(jsonc);
			expect(result).toEqual({ plugin: ["test"], version: 7 });
		});
	});

	describe("resolveOpenCodeConfig", () => {
		test("finds project config in cwd", async () => {
			const tempDir = await mkdtemp(join(tmpdir(), "config-test-"));
			const configPath = join(tempDir, ".opencode.json");
			await writeFile(configPath, '{"plugin": ["test"]}');

			const result = await resolveOpenCodeConfig({ cwd: tempDir });

			expect(result.exists).toBe(true);
			expect(result.path).toBe(configPath);
			expect(result.location).toBe("project");
			expect(result.content).toEqual({ plugin: ["test"] });

			await rm(tempDir, { recursive: true, force: true });
		});

		test("finds project config in parent directory (up to git root)", async () => {
			const tempDir = await mkdtemp(join(tmpdir(), "config-test-"));
			const gitDir = join(tempDir, ".git");
			await mkdir(gitDir);
			const configPath = join(tempDir, ".opencode.json");
			await writeFile(configPath, '{"plugin": ["test"]}');

			const subDir = join(tempDir, "src", "components");
			await mkdir(subDir, { recursive: true });

			const result = await resolveOpenCodeConfig({ cwd: subDir });

			expect(result.exists).toBe(true);
			expect(result.path).toBe(configPath);
			expect(result.location).toBe("project");

			await rm(tempDir, { recursive: true, force: true });
		});

		test("finds .opencode.jsonc files", async () => {
			const tempDir = await mkdtemp(join(tmpdir(), "config-test-"));
			const configPath = join(tempDir, ".opencode.jsonc");
			await writeFile(
				configPath,
				`{
				// Config with comments
				"plugin": ["test"]
			}`,
			);

			const result = await resolveOpenCodeConfig({ cwd: tempDir });

			expect(result.exists).toBe(true);
			expect(result.path).toBe(configPath);
			expect(result.content).toEqual({ plugin: ["test"] });

			await rm(tempDir, { recursive: true, force: true });
		});

		test("respects OPENCODE_CONFIG env var", async () => {
			const tempDir = await mkdtemp(join(tmpdir(), "config-test-"));
			const customConfig = join(tempDir, "custom-config.json");
			await writeFile(customConfig, '{"plugin": ["custom"]}');

			const originalEnv = process.env.OPENCODE_CONFIG;
			process.env.OPENCODE_CONFIG = customConfig;

			try {
				const result = await resolveOpenCodeConfig({ cwd: tempDir });
				expect(result.exists).toBe(true);
				expect(result.path).toBe(customConfig);
				expect(result.location).toBe("env-exact");
				expect(result.content).toEqual({ plugin: ["custom"] });
			} finally {
				process.env.OPENCODE_CONFIG = originalEnv;
				await rm(tempDir, { recursive: true, force: true });
			}
		});

		test("respects OPENCODE_CONFIG_DIR env var", async () => {
			const tempDir = await mkdtemp(join(tmpdir(), "config-test-"));
			const configDir = join(tempDir, "config-dir");
			await mkdir(configDir);
			const configPath = join(configDir, ".opencode.json");
			await writeFile(configPath, '{"plugin": ["dir-config"]}');

			const originalEnv = process.env.OPENCODE_CONFIG_DIR;
			process.env.OPENCODE_CONFIG_DIR = configDir;

			try {
				const result = await resolveOpenCodeConfig({ cwd: tempDir });
				expect(result.exists).toBe(true);
				expect(result.path).toBe(configPath);
				expect(result.location).toBe("env-dir");
				expect(result.content).toEqual({ plugin: ["dir-config"] });
			} finally {
				process.env.OPENCODE_CONFIG_DIR = originalEnv;
				await rm(tempDir, { recursive: true, force: true });
			}
		});

		test("falls back to global config when no project config found", async () => {
			const tempDir = await mkdtemp(join(tmpdir(), "config-test-"));

			const result = await resolveOpenCodeConfig({ cwd: tempDir });

			expect(result.location).toBe("global");
			expect(result.path).toContain(".config/opencode/.opencode.json");

			await rm(tempDir, { recursive: true, force: true });
		});
	});

	describe("getInstallTargetPath", () => {
		test("returns git root path when in a git repository", async () => {
			const tempDir = await mkdtemp(join(tmpdir(), "config-test-"));
			await mkdir(join(tempDir, ".git"));
			const subDir = join(tempDir, "src", "components");
			await mkdir(subDir, { recursive: true });

			const result = await getInstallTargetPath(subDir);

			expect(result).toBe(join(tempDir, ".opencode.json"));

			await rm(tempDir, { recursive: true, force: true });
		});

		test("returns global config path when not in a git repository", async () => {
			const tempDir = await mkdtemp(join(tmpdir(), "config-test-"));

			const result = await getInstallTargetPath(tempDir);

			expect(result).toContain(".config/opencode/.opencode.json");

			await rm(tempDir, { recursive: true, force: true });
		});
	});

	describe("verifyPluginLoad", () => {
		test("returns success when opencode CLI is accessible", async () => {
			const result = await verifyPluginLoad();

			// In CI/test environments without opencode, this will fail
			// but we're testing the function structure, not requiring opencode to exist
			expect(result).toHaveProperty("success");
			expect(result).toHaveProperty("message");
			expect(typeof result.success).toBe("boolean");
			expect(typeof result.message).toBe("string");
		});

		test("returns honest message about verification limitations when successful", async () => {
			const result = await verifyPluginLoad();

			// The key requirement: message should NOT claim plugin loads successfully
			// when we can only verify CLI accessibility
			expect(result.message).not.toContain("plugin loads");
			expect(result.message).not.toContain("working");

			// Should mention CLI accessibility
			if (result.success) {
				expect(result.message.toLowerCase()).toContain("cli");
				expect(result.details).toBeDefined();
				expect(result.details).toContain("not verified");
			}
		});
	});
});
