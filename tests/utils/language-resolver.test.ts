import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	clearLanguageCache,
	resolveLanguageTag,
	substituteLanguageVar,
} from "../../src/utils/language-resolver";

afterEach(() => {
	clearLanguageCache();
});

describe("resolveLanguageTag", () => {
	test("returns comma-separated tags from detectProjectStackTags", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "language-test-"));
		await writeFile(join(tempDir, "package.json"), "{}");
		await writeFile(join(tempDir, "tsconfig.json"), "{}");
		const result = await resolveLanguageTag(tempDir);
		expect(result).toBe("javascript, typescript");
		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns 'unknown' when no manifest files detected", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "language-test-"));
		const result = await resolveLanguageTag(tempDir);
		expect(result).toBe("unknown");
		await rm(tempDir, { recursive: true, force: true });
	});

	test("caches result per projectRoot within a session", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "language-test-"));
		await writeFile(join(tempDir, "package.json"), "{}");
		const first = await resolveLanguageTag(tempDir);
		const second = await resolveLanguageTag(tempDir);
		expect(first).toBe("javascript");
		expect(second).toBe("javascript");
		await rm(tempDir, { recursive: true, force: true });
	});
});

describe("substituteLanguageVar", () => {
	test("replaces $LANGUAGE with the provided language string", () => {
		const result = substituteLanguageVar("Use $LANGUAGE patterns", "typescript");
		expect(result).toBe("Use typescript patterns");
	});

	test("returns text unchanged when no $LANGUAGE present", () => {
		const result = substituteLanguageVar("No var here", "typescript");
		expect(result).toBe("No var here");
	});

	test("replaces all occurrences of $LANGUAGE", () => {
		const result = substituteLanguageVar("$LANGUAGE is great. Use $LANGUAGE!", "rust");
		expect(result).toBe("rust is great. Use rust!");
	});
});
