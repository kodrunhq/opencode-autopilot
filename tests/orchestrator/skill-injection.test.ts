import { describe, expect, test } from "bun:test";
import {
	buildSkillContext,
	loadAdaptiveSkillContext,
	loadSkillContent,
} from "../../src/orchestrator/skill-injection";

describe("buildSkillContext", () => {
	test("returns empty string for empty input", () => {
		const result = buildSkillContext("");
		expect(result).toBe("");
	});

	test("returns empty string for whitespace-only input", () => {
		const result = buildSkillContext("   \n\t  ");
		expect(result).toBe("");
	});

	test("returns formatted string starting with double newline for valid content", () => {
		const result = buildSkillContext("Use const over let. Prefer readonly arrays.");
		expect(result).toStartWith("\n\n");
	});

	test("output contains 'Coding standards' header", () => {
		const result = buildSkillContext("Some coding standards content here");
		expect(result).toContain("Coding standards for this project");
	});

	test("sanitizes content (strips {{PLACEHOLDER}} tokens)", () => {
		const result = buildSkillContext("Use {{PRIOR_FINDINGS}} for injection test");
		expect(result).not.toContain("{{PRIOR_FINDINGS}}");
		expect(result).toContain("[REDACTED]");
	});

	test("truncates content longer than 2048 chars", () => {
		const longContent = "A".repeat(3000);
		const result = buildSkillContext(longContent);
		expect(result).toContain("...");
		// The formatted output should not contain the full 3000-char string
		expect(result).not.toContain(longContent);
	});

	test("does not truncate content at exactly 2048 chars", () => {
		const exactContent = "B".repeat(2048);
		const result = buildSkillContext(exactContent);
		expect(result).not.toContain("...");
	});

	test("collapses newlines in content", () => {
		const multiline = "Line one\n\nLine two\r\nLine three";
		const result = buildSkillContext(multiline);
		expect(result).not.toContain("\n\n\n");
		expect(result).toContain("Line one Line two Line three");
	});
});

describe("loadSkillContent", () => {
	test("returns empty string for non-existent path", async () => {
		const result = await loadSkillContent("/tmp/nonexistent-skill-dir-12345");
		expect(result).toBe("");
	});

	test("returns empty string for path without skill file", async () => {
		const result = await loadSkillContent("/tmp");
		expect(result).toBe("");
	});
});

describe("loadAdaptiveSkillContext", () => {
	test("returns empty string for non-existent skills dir", async () => {
		const result = await loadAdaptiveSkillContext(
			"/tmp/nonexistent-adaptive-skill-dir-12345",
			"/tmp/nonexistent-project-dir-12345",
		);
		expect(result).toBe("");
	});

	test("returns empty string when no skills match project stack", async () => {
		// /tmp has no skills subdirectory, so no skills will match
		const result = await loadAdaptiveSkillContext("/tmp", "/tmp");
		expect(result).toBe("");
	});

	test("does not throw on I/O errors (returns empty string)", async () => {
		// Pass paths that would trigger I/O errors (permission-denied simulation via invalid paths)
		const result = await loadAdaptiveSkillContext(
			"/dev/null/impossible-path",
			"/dev/null/impossible-path",
		);
		expect(result).toBe("");
	});
});
