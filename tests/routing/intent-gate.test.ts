import { afterEach, describe, expect, test } from "bun:test";
import {
	clearIntentSession,
	enforceIntentGate,
	storeIntentClassification,
} from "../../src/routing/intent-gate";

const sessionId = "intent-gate-test-session";

afterEach(() => {
	clearIntentSession(sessionId);
});

describe("enforceIntentGate", () => {
	test("blocks oc_orchestrate without prior implementation classification", () => {
		const result = enforceIntentGate("oc_orchestrate", sessionId, {});
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("implementation classification");
	});

	test("allows explicit implementation intent after implementation classification", () => {
		storeIntentClassification(sessionId, "implementation");
		const result = enforceIntentGate("oc_orchestrate", sessionId, {
			intent: "implementation",
		});
		expect(result.allowed).toBe(true);
	});

	test("allows bare oc_orchestrate only after implementation classification", () => {
		storeIntentClassification(sessionId, "implementation");
		const result = enforceIntentGate("oc_orchestrate", sessionId, {});
		expect(result.allowed).toBe(true);
	});

	test("blocks bare oc_orchestrate after non-implementation classification", () => {
		storeIntentClassification(sessionId, "research");
		const result = enforceIntentGate("oc_orchestrate", sessionId, {});
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("implementation classification");
	});

	test("blocks explicit non-implementation intent", () => {
		storeIntentClassification(sessionId, "research");
		const result = enforceIntentGate("oc_orchestrate", sessionId, {
			intent: "research",
		});
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("only supports implementation intent");
	});

	test("allows result-based resume without classification", () => {
		const result = enforceIntentGate("oc_orchestrate", sessionId, {
			result: '{"schemaVersion":1}',
		});
		expect(result.allowed).toBe(true);
		expect(result.reason).toBe("result-based resume");
	});
});
