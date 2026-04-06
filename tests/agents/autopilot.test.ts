import { describe, expect, test } from "bun:test";
import { autopilotAgent } from "../../src/agents/autopilot";
import { agents } from "../../src/agents/index";

describe("autopilot agent config", () => {
	test("mode is all (Tab-cycleable primary agent)", () => {
		expect(autopilotAgent.mode).toBe("all");
	});

	test("agents map exposes autopilot as mode 'all'", () => {
		expect(agents.autopilot.mode).toBe("all");
	});

	test("has a non-empty description", () => {
		expect(typeof autopilotAgent.description).toBe("string");
		expect(autopilotAgent.description?.length).toBeGreaterThan(0);
	});

	test("is frozen (immutable)", () => {
		expect(Object.isFrozen(autopilotAgent)).toBe(true);
	});

	test("maxSteps is 50", () => {
		expect(autopilotAgent.maxSteps).toBe(50);
	});

	test("permissions: edit, bash, webfetch all allowed", () => {
		expect(autopilotAgent.permission).toEqual({
			edit: "allow",
			bash: "allow",
			webfetch: "allow",
		});
	});

	test("prompt has production-ready length", () => {
		expect(typeof autopilotAgent.prompt).toBe("string");
		expect(autopilotAgent.prompt?.length).toBeGreaterThanOrEqual(100);
	});
});

describe("autopilot intent gate prompt", () => {
	const prompt = autopilotAgent.prompt ?? "";

	test("prompt references oc_route as first action", () => {
		expect(prompt).toContain("oc_route");
	});

	test("prompt contains Intent Gate section", () => {
		expect(prompt).toContain("Intent Gate");
	});

	test("prompt contains intent classification table with all intent types", () => {
		const intents = [
			"research",
			"implementation",
			"fix",
			"review",
			"planning",
			"quick",
			"open_ended",
		];
		for (const intent of intents) {
			expect(prompt).toContain(intent);
		}
	});

	test("prompt requires calling oc_route FIRST", () => {
		expect(prompt).toContain("FIRST");
		expect(prompt).toContain("oc_route");
	});

	test("prompt contains turn-local reset instruction", () => {
		expect(prompt.toLowerCase()).toContain("turn-local");
		expect(prompt).toContain("reclassify");
	});

	test("prompt references usePipeline routing decision", () => {
		expect(prompt).toContain("usePipeline");
	});

	test("prompt references oc_orchestrate for pipeline mode", () => {
		expect(prompt).toContain("oc_orchestrate");
	});

	test("prompt references specialist agents", () => {
		expect(prompt).toContain("researcher");
		expect(prompt).toContain("debugger");
		expect(prompt).toContain("reviewer");
		expect(prompt).toContain("planner");
		expect(prompt).toContain("coder");
	});

	test("prompt prohibits oc_orchestrate when usePipeline is false", () => {
		expect(prompt).toContain("DO NOT call oc_orchestrate when oc_route says usePipeline is false");
	});

	test("prompt includes NEVER_HALT_SILENTLY", () => {
		expect(prompt).toContain("NEVER halt silently");
	});

	test("prompt includes typed result envelope", () => {
		expect(prompt).toContain("Typed Result Envelope");
		expect(prompt).toContain("schemaVersion");
	});
});
