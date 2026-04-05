import { describe, expect, test } from "bun:test";
import { assertTransition, validateTransition } from "../../src/background/state-machine";
import type { TaskStatus } from "../../src/types/background";

const ALL_STATUSES = ["pending", "running", "completed", "failed", "cancelled"] as const;

describe("background state machine", () => {
	test("accepts all valid transitions", () => {
		expect(validateTransition("pending", "running")).toBe(true);
		expect(validateTransition("pending", "cancelled")).toBe(true);
		expect(validateTransition("running", "completed")).toBe(true);
		expect(validateTransition("running", "failed")).toBe(true);
		expect(validateTransition("running", "cancelled")).toBe(true);
		expect(() => assertTransition("running", "completed")).not.toThrow();
	});

	test("rejects all invalid transitions", () => {
		const validTransitions = new Set([
			"pending->running",
			"pending->cancelled",
			"running->completed",
			"running->failed",
			"running->cancelled",
		]);

		for (const from of ALL_STATUSES) {
			for (const to of ALL_STATUSES) {
				const key = `${from}->${to}`;
				if (validTransitions.has(key)) {
					continue;
				}

				expect(validateTransition(from, to as TaskStatus)).toBe(false);
				expect(() => assertTransition(from, to as TaskStatus)).toThrow(
					"Invalid background task transition",
				);
			}
		}
	});
});
