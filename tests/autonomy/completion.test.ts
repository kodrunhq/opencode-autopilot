import { describe, expect, test } from "bun:test";
import { detectCompletion } from "../../src/autonomy/completion";

describe("detectCompletion", () => {
	test("detects only the explicit worker completion promise", () => {
		const result = detectCompletion([
			"Working through the final checks",
			"<promise>DONE</promise>",
		]);

		expect(result.isComplete).toBe(true);
		expect(result.confidence).toBe(1);
		expect(result.signals).toEqual(["<promise>DONE</promise>"]);
	});

	test("rejects false-positive completion phrases", () => {
		const result = detectCompletion(["completed step 1", "done with setup"]);

		expect(result.isComplete).toBe(false);
		expect(result.confidence).toBe(0);
		expect(result.signals).toEqual([]);
	});

	test("does not complete on the oracle verification promise alone", () => {
		const result = detectCompletion(["<promise>VERIFIED</promise>"]);

		expect(result.isComplete).toBe(false);
		expect(result.confidence).toBe(0);
		expect(result.signals).toEqual(["<promise>VERIFIED</promise>"]);
	});
});
