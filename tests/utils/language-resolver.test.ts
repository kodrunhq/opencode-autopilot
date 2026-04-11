import { afterEach, describe, expect, mock, test } from "bun:test";
import {
	clearLanguageCache,
	resolveLanguageTag,
	substituteLanguageVar,
} from "../../src/utils/language-resolver";

// Mock detectProjectStackTags
const mockDetect = mock(() =>
	Promise.resolve(Object.freeze(["typescript", "bun"]) as readonly string[]),
);
mock.module("../../src/skills/adaptive-injector", () => ({
	detectProjectStackTags: mockDetect,
}));

afterEach(() => {
	clearLanguageCache();
	mockDetect.mockClear();
});

describe("resolveLanguageTag", () => {
	test("returns comma-separated tags from detectProjectStackTags", async () => {
		mockDetect.mockResolvedValueOnce(Object.freeze(["typescript", "javascript"]));
		const result = await resolveLanguageTag("/tmp/project-ts");
		expect(result).toBe("javascript, typescript");
	});

	test("returns 'unknown' when no manifest files detected", async () => {
		mockDetect.mockResolvedValueOnce(Object.freeze([]));
		const result = await resolveLanguageTag("/tmp/project-empty");
		expect(result).toBe("unknown");
	});

	test("caches result per projectRoot within a session", async () => {
		mockDetect.mockResolvedValue(Object.freeze(["python"]));
		const first = await resolveLanguageTag("/tmp/project-py");
		const second = await resolveLanguageTag("/tmp/project-py");
		expect(first).toBe("python");
		expect(second).toBe("python");
		// detectProjectStackTags should be called only once due to caching
		expect(mockDetect).toHaveBeenCalledTimes(1);
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
