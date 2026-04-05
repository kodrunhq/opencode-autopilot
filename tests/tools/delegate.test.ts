import { describe, expect, test } from "bun:test";
import { delegateCore, ocDelegate } from "../../src/tools/delegate";

describe("delegateCore", () => {
	test("uses explicit category when provided", async () => {
		const result = JSON.parse(await delegateCore("write release notes", "writing"));
		expect(result.category).toBe("writing");
		expect(result.confidence).toBe(1);
		expect(result.suggestedModelGroup).toBe("communicators");
	});

	test("auto-classifies when category is omitted", async () => {
		const result = JSON.parse(await delegateCore("add dark mode toggle to settings page"));
		expect(result.category).toBe("visual-engineering");
		expect(result.suggestedModelGroup).toBe("builders");
		expect(result.suggestedSkills).toContain("frontend-design");
	});

	test("returns error for invalid categories", async () => {
		const result = JSON.parse(await delegateCore("do work", "invalid-category"));
		expect(result.action).toBe("error");
	});
});

describe("ocDelegate tool", () => {
	test("is defined", () => {
		expect(ocDelegate).toBeDefined();
	});
});
