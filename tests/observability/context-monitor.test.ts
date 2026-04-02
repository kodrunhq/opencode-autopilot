import { describe, expect, it } from "bun:test";
import { ContextMonitor, checkContextUtilization } from "../../src/observability/context-monitor";

describe("checkContextUtilization", () => {
	it("returns shouldWarn=true when >= 0.80 and not already warned", () => {
		const result = checkContextUtilization(80000, 100000, false);
		expect(result.utilization).toBeCloseTo(0.8);
		expect(result.shouldWarn).toBe(true);
	});

	it("returns shouldWarn=false when already warned", () => {
		const result = checkContextUtilization(90000, 100000, true);
		expect(result.utilization).toBeCloseTo(0.9);
		expect(result.shouldWarn).toBe(false);
	});

	it("returns shouldWarn=false when below 0.80", () => {
		const result = checkContextUtilization(50000, 100000, false);
		expect(result.utilization).toBeCloseTo(0.5);
		expect(result.shouldWarn).toBe(false);
	});

	it("returns shouldWarn=true at exactly 80%", () => {
		const result = checkContextUtilization(8000, 10000, false);
		expect(result.utilization).toBeCloseTo(0.8);
		expect(result.shouldWarn).toBe(true);
	});

	it("handles zero contextLimit without division by zero", () => {
		const result = checkContextUtilization(100, 0, false);
		expect(result.utilization).toBe(0);
		expect(result.shouldWarn).toBe(false);
	});
});

describe("ContextMonitor", () => {
	it("tracks per-session warned state", () => {
		const monitor = new ContextMonitor();
		monitor.initSession("sess-1", 100000);

		// Below threshold - no warning
		const r1 = monitor.processMessage("sess-1", 50000);
		expect(r1.utilization).toBeCloseTo(0.5);
		expect(r1.shouldWarn).toBe(false);

		// Above threshold - first warning
		const r2 = monitor.processMessage("sess-1", 85000);
		expect(r2.utilization).toBeCloseTo(0.85);
		expect(r2.shouldWarn).toBe(true);

		// Above threshold again - already warned, no repeat
		const r3 = monitor.processMessage("sess-1", 90000);
		expect(r3.utilization).toBeCloseTo(0.9);
		expect(r3.shouldWarn).toBe(false);
	});

	it("tracks sessions independently", () => {
		const monitor = new ContextMonitor();
		monitor.initSession("sess-a", 100000);
		monitor.initSession("sess-b", 200000);

		// Session A warns at 80%
		const ra = monitor.processMessage("sess-a", 80000);
		expect(ra.shouldWarn).toBe(true);

		// Session B still below threshold
		const rb = monitor.processMessage("sess-b", 100000);
		expect(rb.utilization).toBeCloseTo(0.5);
		expect(rb.shouldWarn).toBe(false);
	});

	it("cleanup removes session state", () => {
		const monitor = new ContextMonitor();
		monitor.initSession("sess-1", 100000);

		// Trigger warning
		monitor.processMessage("sess-1", 85000);

		// Cleanup
		monitor.cleanup("sess-1");

		// Re-init - should warn again as state is fresh
		monitor.initSession("sess-1", 100000);
		const result = monitor.processMessage("sess-1", 85000);
		expect(result.shouldWarn).toBe(true);
	});

	it("returns utilization 0 for unknown session", () => {
		const monitor = new ContextMonitor();
		const result = monitor.processMessage("unknown", 50000);
		expect(result.utilization).toBe(0);
		expect(result.shouldWarn).toBe(false);
	});
});
