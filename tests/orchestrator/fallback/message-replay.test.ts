import { describe, expect, test } from "bun:test";
import {
	filterPartsByTier,
	replayWithDegradation,
} from "../../../src/orchestrator/fallback/message-replay";
import type { MessagePart } from "../../../src/orchestrator/fallback/types";

const sampleParts: readonly MessagePart[] = [
	{ type: "text", content: "Hello world" },
	{ type: "image", url: "https://example.com/img.png" },
	{ type: "tool_call", id: "tc1", name: "search" },
	{ type: "tool_result", id: "tc1", output: "result" },
	{ type: "text", content: "Follow-up" },
];

describe("filterPartsByTier", () => {
	test("tier 1 returns all parts unchanged", () => {
		const result = filterPartsByTier(sampleParts, 1);
		expect(result).toEqual(sampleParts);
		expect(result).toHaveLength(5);
	});

	test("tier 2 filters out tool_call and tool_result parts", () => {
		const result = filterPartsByTier(sampleParts, 2);
		expect(result).toHaveLength(3);
		for (const part of result) {
			expect(part.type).not.toBe("tool_call");
			expect(part.type).not.toBe("tool_result");
		}
	});

	test("tier 3 keeps only text parts", () => {
		const result = filterPartsByTier(sampleParts, 3);
		expect(result).toHaveLength(2);
		for (const part of result) {
			expect(part.type).toBe("text");
		}
	});

	test("tier 2 preserves text and image parts", () => {
		const result = filterPartsByTier(sampleParts, 2);
		expect(result[0]).toEqual({ type: "text", content: "Hello world" });
		expect(result[1]).toEqual({ type: "image", url: "https://example.com/img.png" });
		expect(result[2]).toEqual({ type: "text", content: "Follow-up" });
	});

	test("handles empty parts array", () => {
		expect(filterPartsByTier([], 1)).toEqual([]);
		expect(filterPartsByTier([], 2)).toEqual([]);
		expect(filterPartsByTier([], 3)).toEqual([]);
	});
});

describe("replayWithDegradation", () => {
	test("returns tier 1 parts for first attempt (attempt 0)", () => {
		const result = replayWithDegradation(sampleParts, 0);
		expect(result.tier).toBe(1);
		expect(result.parts).toEqual(sampleParts);
	});

	test("returns tier 2 parts when tier 1 fails (attempt 1)", () => {
		const result = replayWithDegradation(sampleParts, 1);
		expect(result.tier).toBe(2);
		expect(result.parts).toHaveLength(3);
		for (const part of result.parts) {
			expect(part.type).not.toBe("tool_call");
			expect(part.type).not.toBe("tool_result");
		}
	});

	test("returns tier 3 parts when tier 2 fails (attempt 2)", () => {
		const result = replayWithDegradation(sampleParts, 2);
		expect(result.tier).toBe(3);
		expect(result.parts).toHaveLength(2);
		for (const part of result.parts) {
			expect(part.type).toBe("text");
		}
	});

	test("returns tier 3 for any attempt >= 2", () => {
		const result3 = replayWithDegradation(sampleParts, 3);
		expect(result3.tier).toBe(3);

		const result10 = replayWithDegradation(sampleParts, 10);
		expect(result10.tier).toBe(3);
	});
});
