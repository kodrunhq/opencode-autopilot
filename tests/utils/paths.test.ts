import { describe, expect, test } from "bun:test";
import { getAssetsDir, getGlobalConfigDir } from "../../src/utils/paths";

describe("getGlobalConfigDir", () => {
	test("returns path ending with .config/opencode", () => {
		const result = getGlobalConfigDir();
		expect(result.endsWith(".config/opencode")).toBe(true);
	});

	test("returns an absolute path", () => {
		const result = getGlobalConfigDir();
		expect(result.startsWith("/")).toBe(true);
	});
});

describe("getAssetsDir", () => {
	test("returns path ending with assets", () => {
		const result = getAssetsDir();
		expect(result.endsWith("assets")).toBe(true);
	});

	test("returns an absolute path", () => {
		const result = getAssetsDir();
		expect(result.startsWith("/")).toBe(true);
	});
});
