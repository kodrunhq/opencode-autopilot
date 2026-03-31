import { describe, expect, test } from "bun:test";
import { isAbsolute, join } from "node:path";
import { getAssetsDir, getGlobalConfigDir } from "../../src/utils/paths";

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
