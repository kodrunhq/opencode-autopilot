import { describe, expect, test } from "bun:test";
import {
	compareSeverity,
	isBlockingSeverity,
	SEVERITY_DEFINITIONS,
} from "../../src/review/severity";

describe("SEVERITY_DEFINITIONS", () => {
	test("has entries for CRITICAL, HIGH, MEDIUM, LOW", () => {
		expect(SEVERITY_DEFINITIONS.CRITICAL).toBeDefined();
		expect(SEVERITY_DEFINITIONS.HIGH).toBeDefined();
		expect(SEVERITY_DEFINITIONS.MEDIUM).toBeDefined();
		expect(SEVERITY_DEFINITIONS.LOW).toBeDefined();
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
	test("CRITICAL is higher than HIGH (negative)", () => {
		expect(compareSeverity("CRITICAL", "HIGH")).toBeLessThan(0);
	});

	test("LOW is lower than CRITICAL (positive)", () => {
		expect(compareSeverity("LOW", "CRITICAL")).toBeGreaterThan(0);
	});

	test("HIGH equals HIGH (zero)", () => {
		expect(compareSeverity("HIGH", "HIGH")).toBe(0);
	});

	test("CRITICAL is higher than LOW", () => {
		expect(compareSeverity("CRITICAL", "LOW")).toBeLessThan(0);
	});

	test("HIGH is higher than MEDIUM", () => {
		expect(compareSeverity("HIGH", "MEDIUM")).toBeLessThan(0);
	});

	test("MEDIUM is higher than LOW", () => {
		expect(compareSeverity("MEDIUM", "LOW")).toBeLessThan(0);
	});
});

describe("isBlockingSeverity", () => {
	test("CRITICAL is blocking", () => {
		expect(isBlockingSeverity("CRITICAL")).toBe(true);
	});

	test("HIGH is not blocking", () => {
		expect(isBlockingSeverity("HIGH")).toBe(false);
	});

	test("MEDIUM is not blocking", () => {
		expect(isBlockingSeverity("MEDIUM")).toBe(false);
	});

	test("LOW is not blocking", () => {
		expect(isBlockingSeverity("LOW")).toBe(false);
	});
});
