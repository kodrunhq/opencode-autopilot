import { describe, expect, test } from "bun:test";
import { routeCore } from "../../src/tools/route";

describe("routeCore", () => {
	test("routes research intent to researcher without pipeline", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "research",
				reasoning: "User asked how the system works",
				verbalization: "I detect research intent",
			}),
		);
		expect(result.action).toBe("route");
		expect(result.primaryIntent).toBe("research");
		expect(result.targetAgent).toBe("researcher");
		expect(result.usePipeline).toBe(false);
		expect(result.behavior).toBeDefined();
		expect(result.instruction).toContain("researcher");
		expect(result.instruction).not.toContain("oc_orchestrate");
	});

	test("routes implementation intent to autopilot with pipeline", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "implementation",
				reasoning: "User said 'add feature X'",
				verbalization: "I detect implementation intent",
			}),
		);
		expect(result.action).toBe("route");
		expect(result.primaryIntent).toBe("implementation");
		expect(result.targetAgent).toBe("autopilot");
		expect(result.usePipeline).toBe(true);
		expect(result.instruction).toContain("oc_orchestrate");
	});

	test("routes fix intent to debugger without pipeline", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "fix",
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
				primaryIntent: "review",
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
				primaryIntent: "planning",
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
				primaryIntent: "quick",
				reasoning: "Simple rename",
				verbalization: "I detect quick intent",
			}),
		);
		expect(result.action).toBe("route");
		expect(result.targetAgent).toBe("coder");
		expect(result.usePipeline).toBe(false);
	});

	test("routes investigation to researcher without pipeline", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "investigation",
				reasoning: "User said look into X",
				verbalization: "I detect investigation intent",
			}),
		);
		expect(result.action).toBe("route");
		expect(result.targetAgent).toBe("researcher");
		expect(result.usePipeline).toBe(false);
	});

	test("routes evaluation to reviewer without pipeline", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "evaluation",
				reasoning: "User asked what do you think",
				verbalization: "I detect evaluation intent",
			}),
		);
		expect(result.action).toBe("route");
		expect(result.targetAgent).toBe("reviewer");
		expect(result.usePipeline).toBe(false);
	});

	test("CRITICAL 2: open_ended does NOT use pipeline", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "open_ended",
				reasoning: "Ambiguous request to improve something",
				verbalization: "I detect open-ended intent",
			}),
		);
		expect(result.action).toBe("route");
		expect(result.targetAgent).toBe("autopilot");
		expect(result.usePipeline).toBe(false);
		expect(result.behavior).toContain("Assess");
	});

	test("returns error for invalid primary intent", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "banana",
				reasoning: "some reason",
				verbalization: "some verbalization",
			}),
		);
		expect(result.action).toBe("error");
		expect(result.message).toContain("Invalid primary intent");
		expect(result.message).toContain("banana");
	});

	test("returns error for invalid secondary intent", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "research",
				secondaryIntent: "invalid",
				reasoning: "some reason",
				verbalization: "some verbalization",
			}),
		);
		expect(result.action).toBe("error");
		expect(result.message).toContain("Invalid secondary intent");
	});

	test("returns error for empty reasoning", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "research",
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
				primaryIntent: "fix",
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
				primaryIntent: "research",
				reasoning: "User wants to understand auth flow",
				verbalization: "I detect research intent — user asked how auth works",
			}),
		);
		expect(result.reasoning).toBe("User wants to understand auth flow");
		expect(result.verbalization).toBe("I detect research intent — user asked how auth works");
	});
});

describe("routeCore multi-intent (CRITICAL 1)", () => {
	test("supports combined research+implementation intent", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "research",
				secondaryIntent: "implementation",
				reasoning: "User wants to research then implement",
				verbalization: "I detect research+implementation intent",
			}),
		);
		expect(result.action).toBe("route");
		expect(result.primaryIntent).toBe("research");
		expect(result.secondaryIntent).toBe("implementation");
		expect(result.targetAgent).toBe("researcher");
		expect(result.usePipeline).toBe(false);
		expect(result.secondaryTargetAgent).toBe("autopilot");
		expect(result.secondaryUsePipeline).toBe(true);
		expect(result.secondaryInstruction).toBeDefined();
	});

	test("supports combined review+fix intent", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "review",
				secondaryIntent: "fix",
				reasoning: "User wants to review then fix issues",
				verbalization: "I detect review+fix intent",
			}),
		);
		expect(result.primaryIntent).toBe("review");
		expect(result.secondaryIntent).toBe("fix");
		expect(result.targetAgent).toBe("reviewer");
		expect(result.secondaryTargetAgent).toBe("debugger");
	});

	test("single intent has no secondary fields", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "fix",
				reasoning: "Simple bug fix",
				verbalization: "I detect fix intent",
			}),
		);
		expect(result.secondaryIntent).toBeUndefined();
		expect(result.secondaryTargetAgent).toBeUndefined();
		expect(result.secondaryInstruction).toBeUndefined();
	});
});

describe("routeCore behavioral scenarios (MEDIUM 7)", () => {
	test("'How does the auth flow work?' routes to research, no pipeline", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "research",
				reasoning: "User asked 'how does' — research signal",
				verbalization: "I detect research intent — user asked how auth works",
			}),
		);
		expect(result.usePipeline).toBe(false);
		expect(result.targetAgent).toBe("researcher");
	});

	test("'Make the dashboard better' routes to open_ended, no pipeline", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "open_ended",
				reasoning: "Vague request with no implementation verb",
				verbalization: "I detect open-ended intent — user wants improvement but scope unclear",
			}),
		);
		expect(result.usePipeline).toBe(false);
		expect(result.behavior).toContain("Assess");
		expect(result.behavior).toContain("DO NOT start the pipeline");
	});

	test("'Add dark mode to settings' routes to implementation with pipeline", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "implementation",
				reasoning: "User said 'add' — explicit implementation verb",
				verbalization: "I detect implementation intent — user wants dark mode added",
			}),
		);
		expect(result.usePipeline).toBe(true);
		expect(result.targetAgent).toBe("autopilot");
	});

	test("'Review the changes in src/auth' routes to review, no pipeline", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "review",
				reasoning: "User said 'review' — review signal",
				verbalization: "I detect review intent — user wants code review",
			}),
		);
		expect(result.usePipeline).toBe(false);
		expect(result.targetAgent).toBe("reviewer");
	});

	test("'The login page crashes on submit' routes to fix, no pipeline", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "fix",
				reasoning: "User reported a crash — fix signal",
				verbalization: "I detect fix intent — user reports crash on login",
			}),
		);
		expect(result.usePipeline).toBe(false);
		expect(result.targetAgent).toBe("debugger");
	});

	test("'Research the auth library then implement SSO' uses multi-intent", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "research",
				secondaryIntent: "implementation",
				reasoning: "User wants to research first then implement — combined intent",
				verbalization: "I detect research then implementation intent",
			}),
		);
		expect(result.usePipeline).toBe(false);
		expect(result.targetAgent).toBe("researcher");
		expect(result.secondaryUsePipeline).toBe(true);
		expect(result.secondaryTargetAgent).toBe("autopilot");
	});
});

describe("routeCore multi-intent chaining (end-to-end)", () => {
	test("secondary instruction is actionable — contains agent name and behavior", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "research",
				secondaryIntent: "implementation",
				reasoning: "Research then build",
				verbalization: "I detect research + implementation",
			}),
		);
		expect(result.secondaryInstruction).toContain("autopilot");
		expect(result.secondaryInstruction).toContain("pipeline");
		expect(typeof result.secondaryBehavior).toBe("string");
		expect(result.secondaryBehavior.length).toBeGreaterThan(0);
	});

	test("primary instruction does not mention pipeline for non-pipeline intents", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "review",
				secondaryIntent: "fix",
				reasoning: "Review then fix",
				verbalization: "I detect review + fix",
			}),
		);
		expect(result.instruction).not.toContain("oc_orchestrate");
		expect(result.instruction).toContain("reviewer");
		expect(result.secondaryInstruction).toContain("debugger");
	});

	test("investigation + planning chains correctly", () => {
		const result = JSON.parse(
			routeCore({
				primaryIntent: "investigation",
				secondaryIntent: "planning",
				reasoning: "Investigate then plan",
				verbalization: "I detect investigation + planning",
			}),
		);
		expect(result.targetAgent).toBe("researcher");
		expect(result.usePipeline).toBe(false);
		expect(result.secondaryTargetAgent).toBe("planner");
		expect(result.secondaryUsePipeline).toBe(false);
		expect(result.secondaryInstruction).toContain("planner");
	});

	test("all 9 intents produce valid routing when used as primary", () => {
		const intents = [
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
		for (const intent of intents) {
			const result = JSON.parse(
				routeCore({
					primaryIntent: intent,
					reasoning: `Testing ${intent}`,
					verbalization: `I detect ${intent}`,
				}),
			);
			expect(result.action).toBe("route");
			expect(result.targetAgent).toBeTruthy();
			expect(typeof result.usePipeline).toBe("boolean");
			expect(typeof result.behavior).toBe("string");
			expect(result.behavior.length).toBeGreaterThan(0);
		}
	});
});
