import { describe, expect, test } from "bun:test";
import { isAbsolute, join } from "node:path";
import {
	getAssetsDir,
	getAutopilotDbPath,
	getGlobalConfigDir,
	getLegacyMemoryDbPath,
	isProjectArtifactDir,
} from "../../src/utils/paths";

describe("getGlobalConfigDir", () => {
	test("returns path containing .config/opencode", () => {
		const result = getGlobalConfigDir();
		expect(result).toContain(join(".config", "opencode"));
	});

	test("returns an absolute path", () => {
		const result = getGlobalConfigDir();
		expect(isAbsolute(result)).toBe(true);
	});
});

describe("getAssetsDir", () => {
	test("returns path ending with assets", () => {
		const result = getAssetsDir();
		expect(result.endsWith("assets")).toBe(true);
	});

	test("returns an absolute path", () => {
		const result = getAssetsDir();
		expect(isAbsolute(result)).toBe(true);
	});
});

describe("getAutopilotDbPath", () => {
	test("returns path containing .config/opencode/autopilot.db", () => {
		const result = getAutopilotDbPath();
		expect(result).toContain(join(".config", "opencode", "autopilot.db"));
	});

	test("returns an absolute path", () => {
		const result = getAutopilotDbPath();
		expect(isAbsolute(result)).toBe(true);
	});
});

describe("getLegacyMemoryDbPath", () => {
	test("returns path containing .config/opencode/memory/memory.db", () => {
		const result = getLegacyMemoryDbPath();
		expect(result).toContain(join(".config", "opencode", "memory", "memory.db"));
	});
});

describe("isProjectArtifactDir", () => {
	test("returns true for .opencode-autopilot directory", () => {
		expect(isProjectArtifactDir("/tmp/project/.opencode-autopilot")).toBe(true);
	});

	test("returns false for project root", () => {
		expect(isProjectArtifactDir("/tmp/project")).toBe(false);
	});
});
