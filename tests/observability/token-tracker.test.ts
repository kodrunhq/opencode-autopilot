import { describe, expect, it } from "bun:test";
import {
	accumulateTokens,
	accumulateTokensFromMessage,
	createEmptyTokenAggregate,
} from "../../src/observability/token-tracker";

describe("createEmptyTokenAggregate", () => {
	it("returns zero-initialized aggregate", () => {
		const empty = createEmptyTokenAggregate();
		expect(empty.inputTokens).toBe(0);
		expect(empty.outputTokens).toBe(0);
		expect(empty.reasoningTokens).toBe(0);
		expect(empty.cacheReadTokens).toBe(0);
		expect(empty.cacheWriteTokens).toBe(0);
		expect(empty.totalCost).toBe(0);
		expect(empty.messageCount).toBe(0);
	});
});

describe("accumulateTokens", () => {
	it("returns new aggregate with summed fields (immutable)", () => {
		const current = createEmptyTokenAggregate();
		const incoming = {
			inputTokens: 100,
			outputTokens: 50,
			reasoningTokens: 10,
			cacheReadTokens: 200,
			cacheWriteTokens: 30,
			totalCost: 0.005,
			messageCount: 1,
		};
		const result = accumulateTokens(current, incoming);

		expect(result.inputTokens).toBe(100);
		expect(result.outputTokens).toBe(50);
		expect(result.reasoningTokens).toBe(10);
		expect(result.cacheReadTokens).toBe(200);
		expect(result.cacheWriteTokens).toBe(30);
		expect(result.totalCost).toBeCloseTo(0.005);
		expect(result.messageCount).toBe(1);
		// Original not mutated
		expect(current.inputTokens).toBe(0);
	});

	it("accumulates multiple rounds correctly", () => {
		const a = createEmptyTokenAggregate();
		const b = accumulateTokens(a, { inputTokens: 100, totalCost: 0.01, messageCount: 1 });
		const c = accumulateTokens(b, { inputTokens: 200, outputTokens: 75, totalCost: 0.02, messageCount: 1 });

		expect(c.inputTokens).toBe(300);
		expect(c.outputTokens).toBe(75);
		expect(c.totalCost).toBeCloseTo(0.03);
		expect(c.messageCount).toBe(2);
	});

	it("handles partial incoming with missing fields (defaults to 0)", () => {
		const current = accumulateTokens(createEmptyTokenAggregate(), {
			inputTokens: 50,
			outputTokens: 25,
			messageCount: 1,
		});
		const result = accumulateTokens(current, { inputTokens: 10 });

		expect(result.inputTokens).toBe(60);
		expect(result.outputTokens).toBe(25);
		expect(result.messageCount).toBe(1);
	});
});

describe("accumulateTokensFromMessage", () => {
	it("extracts tokens from AssistantMessage shape", () => {
		const current = createEmptyTokenAggregate();
		const msg = {
			tokens: {
				input: 500,
				output: 200,
				reasoning: 50,
				cache: { read: 1000, write: 100 },
			},
			cost: 0.015,
		};
		const result = accumulateTokensFromMessage(current, msg);

		expect(result.inputTokens).toBe(500);
		expect(result.outputTokens).toBe(200);
		expect(result.reasoningTokens).toBe(50);
		expect(result.cacheReadTokens).toBe(1000);
		expect(result.cacheWriteTokens).toBe(100);
		expect(result.totalCost).toBeCloseTo(0.015);
		expect(result.messageCount).toBe(1);
	});

	it("handles missing cache fields gracefully", () => {
		const current = createEmptyTokenAggregate();
		const msg = {
			tokens: {
				input: 100,
				output: 50,
				reasoning: 0,
				cache: { read: 0, write: 0 },
			},
			cost: 0.003,
		};
		const result = accumulateTokensFromMessage(current, msg);

		expect(result.inputTokens).toBe(100);
		expect(result.outputTokens).toBe(50);
		expect(result.cacheReadTokens).toBe(0);
		expect(result.totalCost).toBeCloseTo(0.003);
	});

	it("accumulates from multiple messages", () => {
		const empty = createEmptyTokenAggregate();
		const msg1 = {
			tokens: { input: 100, output: 50, reasoning: 10, cache: { read: 200, write: 30 } },
			cost: 0.01,
		};
		const msg2 = {
			tokens: { input: 300, output: 150, reasoning: 20, cache: { read: 500, write: 60 } },
			cost: 0.03,
		};
		const after1 = accumulateTokensFromMessage(empty, msg1);
		const after2 = accumulateTokensFromMessage(after1, msg2);

		expect(after2.inputTokens).toBe(400);
		expect(after2.outputTokens).toBe(200);
		expect(after2.reasoningTokens).toBe(30);
		expect(after2.cacheReadTokens).toBe(700);
		expect(after2.cacheWriteTokens).toBe(90);
		expect(after2.totalCost).toBeCloseTo(0.04);
		expect(after2.messageCount).toBe(2);
	});
});
