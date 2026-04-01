import { describe, expect, test } from "bun:test";
import {
	fallbackConfigSchema,
	fallbackDefaults,
} from "../../../src/orchestrator/fallback/fallback-config";

describe("fallbackConfigSchema defaults", () => {
	test("parse({}) returns sensible defaults", () => {
		const result = fallbackConfigSchema.parse({});
		expect(result.enabled).toBe(true);
		expect(result.retryOnErrors).toEqual([401, 402, 429, 500, 502, 503, 504]);
		expect(result.maxFallbackAttempts).toBe(10);
		expect(result.cooldownSeconds).toBe(60);
		expect(result.timeoutSeconds).toBe(30);
		expect(result.notifyOnFallback).toBe(true);
		expect(result.retryableErrorPatterns).toEqual([]);
	});

	test("fallbackDefaults is a pre-computed default object", () => {
		expect(fallbackDefaults).toBeDefined();
		expect(fallbackDefaults.enabled).toBe(true);
		expect(fallbackDefaults.retryOnErrors).toEqual([401, 402, 429, 500, 502, 503, 504]);
	});
});

describe("fallbackConfigSchema validation", () => {
	test("rejects maxFallbackAttempts=0 (min 1)", () => {
		expect(() => fallbackConfigSchema.parse({ maxFallbackAttempts: 0 })).toThrow();
	});

	test("rejects cooldownSeconds=0 (min 1)", () => {
		expect(() => fallbackConfigSchema.parse({ cooldownSeconds: 0 })).toThrow();
	});

	test("rejects cooldownSeconds=-1", () => {
		expect(() => fallbackConfigSchema.parse({ cooldownSeconds: -1 })).toThrow();
	});

	test("rejects timeoutSeconds=301 (max 300)", () => {
		expect(() => fallbackConfigSchema.parse({ timeoutSeconds: 301 })).toThrow();
	});

	test("accepts custom retryOnErrors array", () => {
		const result = fallbackConfigSchema.parse({ retryOnErrors: [429, 503] });
		expect(result.retryOnErrors).toEqual([429, 503]);
	});

	test("accepts custom retryableErrorPatterns", () => {
		const result = fallbackConfigSchema.parse({
			retryableErrorPatterns: ["custom-pattern"],
		});
		expect(result.retryableErrorPatterns).toEqual(["custom-pattern"]);
	});

	test("rejects retryableErrorPatterns over max length", () => {
		const longPattern = "a".repeat(257);
		expect(() => fallbackConfigSchema.parse({ retryableErrorPatterns: [longPattern] })).toThrow();
	});

	test("accepts valid override values", () => {
		const result = fallbackConfigSchema.parse({
			enabled: false,
			maxFallbackAttempts: 5,
			cooldownSeconds: 120,
			timeoutSeconds: 60,
			notifyOnFallback: false,
		});
		expect(result.enabled).toBe(false);
		expect(result.maxFallbackAttempts).toBe(5);
		expect(result.cooldownSeconds).toBe(120);
		expect(result.timeoutSeconds).toBe(60);
		expect(result.notifyOnFallback).toBe(false);
	});
});
