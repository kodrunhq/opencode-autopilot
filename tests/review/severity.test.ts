import { describe, expect, test } from "bun:test";
import {
	compareSeverity,
	isBlockingSeverity,
	SEVERITY_DEFINITIONS,
} from "../../src/review/severity";

describe("SEVERITY_DEFINITIONS", () => {
	test("has entries for CRITICAL, WARNING, NITPICK", () => {
		expect(SEVERITY_DEFINITIONS.CRITICAL).toBeDefined();
		expect(SEVERITY_DEFINITIONS.WARNING).toBeDefined();
		expect(SEVERITY_DEFINITIONS.NITPICK).toBeDefined();
	});

	test("each severity has criteria array", () => {
		for (const def of Object.values(SEVERITY_DEFINITIONS)) {
			expect(Array.isArray(def.criteria)).toBe(true);
			expect(def.criteria.length).toBeGreaterThan(0);
		}
	});

	test("each severity has action string", () => {
		for (const def of Object.values(SEVERITY_DEFINITIONS)) {
			expect(typeof def.action).toBe("string");
			expect(def.action.length).toBeGreaterThan(0);
		}
	});

	test("CRITICAL criteria includes security and runtime errors", () => {
		const criteria = SEVERITY_DEFINITIONS.CRITICAL.criteria;
		expect(criteria.some((c) => c.toLowerCase().includes("security"))).toBe(true);
		expect(criteria.some((c) => c.toLowerCase().includes("runtime"))).toBe(true);
	});
});

describe("compareSeverity", () => {
	test("CRITICAL is higher than WARNING (negative)", () => {
		expect(compareSeverity("CRITICAL", "WARNING")).toBeLessThan(0);
	});

	test("NITPICK is lower than CRITICAL (positive)", () => {
		expect(compareSeverity("NITPICK", "CRITICAL")).toBeGreaterThan(0);
	});

	test("WARNING equals WARNING (zero)", () => {
		expect(compareSeverity("WARNING", "WARNING")).toBe(0);
	});

	test("CRITICAL is higher than NITPICK", () => {
		expect(compareSeverity("CRITICAL", "NITPICK")).toBeLessThan(0);
	});

	test("WARNING is higher than NITPICK", () => {
		expect(compareSeverity("WARNING", "NITPICK")).toBeLessThan(0);
	});
});

describe("isBlockingSeverity", () => {
	test("CRITICAL is blocking", () => {
		expect(isBlockingSeverity("CRITICAL")).toBe(true);
	});

	test("WARNING is not blocking", () => {
		expect(isBlockingSeverity("WARNING")).toBe(false);
	});

	test("NITPICK is not blocking", () => {
		expect(isBlockingSeverity("NITPICK")).toBe(false);
	});
});
