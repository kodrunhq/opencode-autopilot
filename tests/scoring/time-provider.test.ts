import { describe, expect, it } from "bun:test";
import { createFixedTimeProvider, systemTimeProvider } from "../../src/scoring/time-provider";

describe("TimeProvider", () => {
	it("system provider returns realistic times", () => {
		const before = Date.now();
		const now = systemTimeProvider.now();
		const after = Date.now();

		expect(now).toBeGreaterThanOrEqual(before);
		expect(now).toBeLessThanOrEqual(after);
	});

	it("fixed provider returns fixed time", () => {
		const provider = createFixedTimeProvider(1000);
		expect(provider.now()).toBe(1000);
	});

	it("fixed provider can advance time", () => {
		const provider = createFixedTimeProvider(1000);
		provider.advance(500);
		expect(provider.now()).toBe(1500);
	});

	it("fixed provider can set time", () => {
		const provider = createFixedTimeProvider(1000);
		provider.set(5000);
		expect(provider.now()).toBe(5000);
	});
});
