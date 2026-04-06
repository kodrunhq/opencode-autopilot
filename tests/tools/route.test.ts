import { describe, expect, test } from "bun:test";
import { routeCore } from "../../src/tools/route";

describe("routeCore", () => {
	test("routes research intent to researcher without pipeline", () => {
		const result = JSON.parse(
			routeCore({
				intent: "research",
				reasoning: "User asked how the system works",
				verbalization: "I detect research intent",
			}),
		);
		expect(result.action).toBe("route");
		expect(result.intent).toBe("research");
		expect(result.targetAgent).toBe("researcher");
		expect(result.usePipeline).toBe(false);
		expect(result.instruction).toContain("researcher");
		expect(result.instruction).not.toContain("oc_orchestrate");
	});

	test("routes implementation intent to autopilot with pipeline", () => {
		const result = JSON.parse(
			routeCore({
				intent: "implementation",
				reasoning: "User said 'add feature X'",
				verbalization: "I detect implementation intent",
			}),
		);
		expect(result.action).toBe("route");
		expect(result.intent).toBe("implementation");
		expect(result.targetAgent).toBe("autopilot");
		expect(result.usePipeline).toBe(true);
		expect(result.instruction).toContain("oc_orchestrate");
	});

	test("routes fix intent to debugger without pipeline", () => {
		const result = JSON.parse(
			routeCore({
				intent: "fix",
				reasoning: "User reported a bug",
				verbalization: "I detect fix intent",
			}),
		);
		expect(result.action).toBe("route");
		expect(result.targetAgent).toBe("debugger");
		expect(result.usePipeline).toBe(false);
	});

	test("routes review intent to reviewer without pipeline", () => {
		const result = JSON.parse(
			routeCore({
				intent: "review",
				reasoning: "User asked for code review",
				verbalization: "I detect review intent",
			}),
		);
		expect(result.action).toBe("route");
		expect(result.targetAgent).toBe("reviewer");
	});

	test("routes planning intent to planner without pipeline", () => {
		const result = JSON.parse(
			routeCore({
				intent: "planning",
				reasoning: "User wants a plan",
				verbalization: "I detect planning intent",
			}),
		);
		expect(result.action).toBe("route");
		expect(result.targetAgent).toBe("planner");
		expect(result.usePipeline).toBe(false);
	});

	test("routes quick intent to coder without pipeline", () => {
		const result = JSON.parse(
			routeCore({
				intent: "quick",
				reasoning: "Simple rename",
				verbalization: "I detect quick intent",
			}),
		);
		expect(result.action).toBe("route");
		expect(result.targetAgent).toBe("coder");
		expect(result.usePipeline).toBe(false);
	});

	test("routes open_ended intent to autopilot with pipeline", () => {
		const result = JSON.parse(
			routeCore({
				intent: "open_ended",
				reasoning: "Ambiguous request",
				verbalization: "I detect open-ended intent",
			}),
		);
		expect(result.action).toBe("route");
		expect(result.targetAgent).toBe("autopilot");
		expect(result.usePipeline).toBe(true);
	});

	test("returns error for invalid intent", () => {
		const result = JSON.parse(
			routeCore({
				intent: "banana",
				reasoning: "some reason",
				verbalization: "some verbalization",
			}),
		);
		expect(result.action).toBe("error");
		expect(result.message).toContain("Invalid intent");
		expect(result.message).toContain("banana");
	});

	test("returns error for empty reasoning", () => {
		const result = JSON.parse(
			routeCore({
				intent: "research",
				reasoning: "",
				verbalization: "I detect research intent",
			}),
		);
		expect(result.action).toBe("error");
		expect(result.message).toContain("Invalid classification");
	});

	test("returns error for empty verbalization", () => {
		const result = JSON.parse(
			routeCore({
				intent: "fix",
				reasoning: "User said something is broken",
				verbalization: "",
			}),
		);
		expect(result.action).toBe("error");
		expect(result.message).toContain("Invalid classification");
	});

	test("preserves reasoning and verbalization in response", () => {
		const result = JSON.parse(
			routeCore({
				intent: "research",
				reasoning: "User wants to understand auth flow",
				verbalization: "I detect research intent — user asked how auth works",
			}),
		);
		expect(result.reasoning).toBe("User wants to understand auth flow");
		expect(result.verbalization).toBe("I detect research intent — user asked how auth works");
	});
});
