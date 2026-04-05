import { describe, expect, test } from "bun:test";
import { detectCompletion } from "../../src/autonomy/completion";

describe("detectCompletion", () => {
	test("detects explicit completion signals with high confidence", () => {
		const result = detectCompletion(["Implementation is done", "All tasks completed"]);

		expect(result.isComplete).toBe(true);
		expect(result.confidence).toBeGreaterThanOrEqual(0.8);
		expect(result.signals).toContain("done");
		expect(result.signals).toContain("all tasks completed");
	});

	test("detects todo-based completion signals", () => {
		const result = detectCompletion(["all todos completed", "no remaining tasks"]);

		expect(result.isComplete).toBe(true);
		expect(result.confidence).toBeGreaterThanOrEqual(0.7);
		expect(result.confidence).toBeLessThanOrEqual(0.9);
	});

	test("treats negative progress signals as incomplete", () => {
		const result = detectCompletion(["Still working on tests", "Next step is lint cleanup"]);

		expect(result.isComplete).toBe(false);
		expect(result.confidence).toBeGreaterThan(0);
		expect(result.confidence).toBeLessThan(0.5);
		expect(result.signals).toContain("still working");
		expect(result.signals).toContain("next step");
	});

	test("prefers negative signals over positive ones", () => {
		const result = detectCompletion(["Done", "but still working through one more fix"]);

		expect(result.isComplete).toBe(false);
		expect(result.confidence).toBeLessThan(0.5);
	});

	test("returns zero confidence when no completion signals exist", () => {
		const result = detectCompletion(["Reviewed files", "Investigated issue"]);

		expect(result.isComplete).toBe(false);
		expect(result.confidence).toBe(0);
		expect(result.signals).toEqual([]);
	});
});
