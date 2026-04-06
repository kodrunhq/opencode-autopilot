import { describe, expect, test } from "bun:test";
import {
	getIntentRouting,
	INTENT_ROUTING_MAP,
	IntentClassificationSchema,
	IntentRoutingSchema,
	IntentTypeSchema,
} from "../../src/routing/intent-types";

describe("IntentTypeSchema", () => {
	test("accepts all valid intent types", () => {
		const validIntents = [
			"research",
			"implementation",
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
});

describe("IntentClassificationSchema", () => {
	test("accepts valid classification", () => {
		const result = IntentClassificationSchema.parse({
			intent: "research",
			reasoning: "User asked how something works",
			verbalization: "I detect research intent",
		});
		expect(result.intent).toBe("research");
		expect(result.reasoning).toBe("User asked how something works");
	});

	test("rejects empty reasoning", () => {
		expect(() =>
			IntentClassificationSchema.parse({
				intent: "research",
				reasoning: "",
				verbalization: "I detect research intent",
			}),
		).toThrow();
	});

	test("rejects empty verbalization", () => {
		expect(() =>
			IntentClassificationSchema.parse({
				intent: "fix",
				reasoning: "User reported a bug",
				verbalization: "",
			}),
		).toThrow();
	});

	test("rejects invalid intent in classification", () => {
		expect(() =>
			IntentClassificationSchema.parse({
				intent: "nope",
				reasoning: "some reason",
				verbalization: "some verbalization",
			}),
		).toThrow();
	});
});

describe("IntentRoutingSchema", () => {
	test("accepts valid routing", () => {
		const result = IntentRoutingSchema.parse({
			targetAgent: "researcher",
			usePipeline: false,
		});
		expect(result.targetAgent).toBe("researcher");
		expect(result.usePipeline).toBe(false);
	});

	test("rejects empty targetAgent", () => {
		expect(() =>
			IntentRoutingSchema.parse({
				targetAgent: "",
				usePipeline: true,
			}),
		).toThrow();
	});
});

describe("INTENT_ROUTING_MAP", () => {
	test("has an entry for every intent type", () => {
		const allIntents = IntentTypeSchema.options;
		for (const intent of allIntents) {
			expect(INTENT_ROUTING_MAP.has(intent)).toBe(true);
		}
	});

	test("maps research to researcher without pipeline", () => {
		const routing = INTENT_ROUTING_MAP.get("research");
		expect(routing).toEqual({ targetAgent: "researcher", usePipeline: false });
	});

	test("maps implementation to autopilot with pipeline", () => {
		const routing = INTENT_ROUTING_MAP.get("implementation");
		expect(routing).toEqual({ targetAgent: "autopilot", usePipeline: true });
	});

	test("maps fix to debugger without pipeline", () => {
		const routing = INTENT_ROUTING_MAP.get("fix");
		expect(routing).toEqual({ targetAgent: "debugger", usePipeline: false });
	});

	test("maps review to reviewer without pipeline", () => {
		const routing = INTENT_ROUTING_MAP.get("review");
		expect(routing).toEqual({ targetAgent: "reviewer", usePipeline: false });
	});

	test("maps planning to planner without pipeline", () => {
		const routing = INTENT_ROUTING_MAP.get("planning");
		expect(routing).toEqual({ targetAgent: "planner", usePipeline: false });
	});

	test("maps quick to coder without pipeline", () => {
		const routing = INTENT_ROUTING_MAP.get("quick");
		expect(routing).toEqual({ targetAgent: "coder", usePipeline: false });
	});

	test("maps open_ended to autopilot with pipeline", () => {
		const routing = INTENT_ROUTING_MAP.get("open_ended");
		expect(routing).toEqual({ targetAgent: "autopilot", usePipeline: true });
	});

	test("only pipeline-using intents are implementation and open_ended", () => {
		const pipelineIntents: string[] = [];
		for (const [intent, routing] of INTENT_ROUTING_MAP) {
			if (routing.usePipeline) {
				pipelineIntents.push(intent);
			}
		}
		expect(pipelineIntents.sort()).toEqual(["implementation", "open_ended"]);
	});
});

describe("getIntentRouting", () => {
	test("returns routing for valid intent", () => {
		const routing = getIntentRouting("fix");
		expect(routing.targetAgent).toBe("debugger");
		expect(routing.usePipeline).toBe(false);
	});

	test("returns same reference as INTENT_ROUTING_MAP", () => {
		const fromMap = INTENT_ROUTING_MAP.get("research");
		const fromFn = getIntentRouting("research");
		expect(fromMap).toBeDefined();
		expect(fromFn).toBe(fromMap as Readonly<{ targetAgent: string; usePipeline: boolean }>);
	});
});
