import { describe, expect, test } from "bun:test";
import {
	allIntentRoutings,
	getIntentRouting,
	getIntentTypes,
	hasIntentRouting,
	IntentClassificationSchema,
	IntentRoutingSchema,
	IntentTypeSchema,
} from "../../src/routing/intent-types";

describe("IntentTypeSchema", () => {
	test("accepts all valid intent types", () => {
		const validIntents = [
			"research",
			"implementation",
			"investigation",
			"evaluation",
			"fix",
			"review",
			"planning",
			"quick",
			"open_ended",
		] as const;
		for (const intent of validIntents) {
			expect(IntentTypeSchema.parse(intent)).toBe(intent);
		}
	});

	test("rejects invalid intent types", () => {
		expect(() => IntentTypeSchema.parse("unknown")).toThrow();
		expect(() => IntentTypeSchema.parse("")).toThrow();
		expect(() => IntentTypeSchema.parse(42)).toThrow();
	});

	test("includes investigation and evaluation (Sisyphus richer modes)", () => {
		expect(IntentTypeSchema.options).toContain("investigation");
		expect(IntentTypeSchema.options).toContain("evaluation");
	});
});

describe("IntentClassificationSchema", () => {
	test("accepts valid classification with primary intent only", () => {
		const result = IntentClassificationSchema.parse({
			primaryIntent: "research",
			reasoning: "User asked how something works",
			verbalization: "I detect research intent",
		});
		expect(result.primaryIntent).toBe("research");
		expect(result.reasoning).toBe("User asked how something works");
		expect(result.secondaryIntent).toBeUndefined();
	});

	test("accepts valid classification with primary and secondary intents", () => {
		const result = IntentClassificationSchema.parse({
			primaryIntent: "research",
			secondaryIntent: "implementation",
			reasoning: "User wants to research then implement",
			verbalization: "I detect research+implementation intent",
		});
		expect(result.primaryIntent).toBe("research");
		expect(result.secondaryIntent).toBe("implementation");
	});

	test("rejects empty reasoning", () => {
		expect(() =>
			IntentClassificationSchema.parse({
				primaryIntent: "research",
				reasoning: "",
				verbalization: "I detect research intent",
			}),
		).toThrow();
	});

	test("rejects empty verbalization", () => {
		expect(() =>
			IntentClassificationSchema.parse({
				primaryIntent: "fix",
				reasoning: "User reported a bug",
				verbalization: "",
			}),
		).toThrow();
	});

	test("rejects invalid primary intent", () => {
		expect(() =>
			IntentClassificationSchema.parse({
				primaryIntent: "nope",
				reasoning: "some reason",
				verbalization: "some verbalization",
			}),
		).toThrow();
	});

	test("rejects invalid secondary intent", () => {
		expect(() =>
			IntentClassificationSchema.parse({
				primaryIntent: "research",
				secondaryIntent: "invalid",
				reasoning: "some reason",
				verbalization: "some verbalization",
			}),
		).toThrow();
	});
});

describe("IntentRoutingSchema", () => {
	test("accepts valid routing with behavior", () => {
		const result = IntentRoutingSchema.parse({
			targetAgent: "researcher",
			usePipeline: false,
			behavior: "Answer using research tools.",
		});
		expect(result.targetAgent).toBe("researcher");
		expect(result.usePipeline).toBe(false);
		expect(result.behavior).toBe("Answer using research tools.");
	});

	test("rejects empty targetAgent", () => {
		expect(() =>
			IntentRoutingSchema.parse({
				targetAgent: "",
				usePipeline: true,
				behavior: "Run pipeline.",
			}),
		).toThrow();
	});

	test("rejects empty behavior", () => {
		expect(() =>
			IntentRoutingSchema.parse({
				targetAgent: "autopilot",
				usePipeline: true,
				behavior: "",
			}),
		).toThrow();
	});
});

describe("intent routing lookup API", () => {
	test("has an entry for every intent type", () => {
		const allIntents = IntentTypeSchema.options;
		for (const intent of allIntents) {
			expect(hasIntentRouting(intent)).toBe(true);
		}
	});

	test("getIntentTypes returns all 9 intents", () => {
		const types = getIntentTypes();
		expect(types).toHaveLength(9);
		expect(types).toContain("research");
		expect(types).toContain("implementation");
		expect(types).toContain("open_ended");
	});

	test("maps research to researcher without pipeline", () => {
		const routing = getIntentRouting("research");
		expect(routing.targetAgent).toBe("researcher");
		expect(routing.usePipeline).toBe(false);
	});

	test("maps implementation to autopilot with pipeline", () => {
		const routing = getIntentRouting("implementation");
		expect(routing.targetAgent).toBe("autopilot");
		expect(routing.usePipeline).toBe(true);
	});

	test("maps fix to debugger without pipeline", () => {
		const routing = getIntentRouting("fix");
		expect(routing.targetAgent).toBe("debugger");
		expect(routing.usePipeline).toBe(false);
	});

	test("maps review to reviewer without pipeline", () => {
		const routing = getIntentRouting("review");
		expect(routing.targetAgent).toBe("reviewer");
		expect(routing.usePipeline).toBe(false);
	});

	test("maps planning to planner without pipeline", () => {
		const routing = getIntentRouting("planning");
		expect(routing.targetAgent).toBe("planner");
		expect(routing.usePipeline).toBe(false);
	});

	test("maps quick to coder without pipeline", () => {
		const routing = getIntentRouting("quick");
		expect(routing.targetAgent).toBe("coder");
		expect(routing.usePipeline).toBe(false);
	});

	test("maps investigation to researcher without pipeline", () => {
		const routing = getIntentRouting("investigation");
		expect(routing.targetAgent).toBe("researcher");
		expect(routing.usePipeline).toBe(false);
	});

	test("maps evaluation to reviewer without pipeline", () => {
		const routing = getIntentRouting("evaluation");
		expect(routing.targetAgent).toBe("reviewer");
		expect(routing.usePipeline).toBe(false);
	});

	test("CRITICAL 2: open_ended does NOT use pipeline", () => {
		const routing = getIntentRouting("open_ended");
		expect(routing.targetAgent).toBe("autopilot");
		expect(routing.usePipeline).toBe(false);
		expect(routing.behavior).toContain("Assess");
	});

	test("only implementation uses the full pipeline", () => {
		const pipelineIntents: string[] = [];
		for (const [intent, routing] of allIntentRoutings()) {
			if (routing.usePipeline) {
				pipelineIntents.push(intent);
			}
		}
		expect(pipelineIntents).toEqual(["implementation"]);
	});

	test("every routing entry has a non-empty behavior string", () => {
		for (const [_intent, routing] of allIntentRoutings()) {
			expect(routing.behavior.length).toBeGreaterThan(0);
		}
	});

	test("allIntentRoutings returns all 9 entries", () => {
		expect(allIntentRoutings()).toHaveLength(9);
	});

	test("routing entries are frozen (individual values immutable)", () => {
		const routing = getIntentRouting("research");
		expect(Object.isFrozen(routing)).toBe(true);
	});
});

describe("getIntentRouting", () => {
	test("returns routing for valid intent", () => {
		const routing = getIntentRouting("fix");
		expect(routing.targetAgent).toBe("debugger");
		expect(routing.usePipeline).toBe(false);
	});

	test("returns consistent results across calls", () => {
		const first = getIntentRouting("research");
		const second = getIntentRouting("research");
		expect(first).toBe(second);
	});

	test("fallback routing does not use pipeline", () => {
		const routing = getIntentRouting("nonexistent" as "research");
		expect(routing.usePipeline).toBe(false);
		expect(routing.targetAgent).toBe("autopilot");
	});

	test("fallback routing is frozen", () => {
		const routing = getIntentRouting("nonexistent" as "research");
		expect(Object.isFrozen(routing)).toBe(true);
	});
});
