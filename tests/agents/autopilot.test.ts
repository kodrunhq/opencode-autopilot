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

	test("permissions: edit, bash, webfetch, todowrite all allowed", () => {
		expect(autopilotAgent.permission).toEqual({
			edit: "allow",
			bash: "allow",
			webfetch: "allow",
			todowrite: "allow",
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
			"investigation",
			"evaluation",
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

describe("autopilot prompt — Oracle-identified gaps", () => {
	const prompt = autopilotAgent.prompt ?? "";

	test("CRITICAL 2: prompt prohibits pipeline for open_ended", () => {
		expect(prompt).toContain("DO NOT start the pipeline for open_ended requests");
	});

	test("CRITICAL 3: prompt contains context-completion gate", () => {
		expect(prompt).toContain("Context-Completion Gate");
		expect(prompt).toContain("explicit implementation verb");
		expect(prompt).toContain("implement, add, create, fix, change, write, build, develop");
	});

	test("CRITICAL 3: gate requires all three conditions", () => {
		expect(prompt).toContain("ONLY when ALL three conditions are true");
	});

	test("HIGH 5: prompt includes behavior instruction from oc_route", () => {
		expect(prompt).toContain("behavior instruction");
	});

	test("HIGH 6: prompt contains verbalize-before-classification", () => {
		expect(prompt).toContain("Verbalize Intent");
		expect(prompt).toContain("BEFORE Classification");
	});

	test("HIGH 6: prompt contains ambiguity check gate", () => {
		expect(prompt).toContain("Check for Ambiguity");
		expect(prompt).toContain("autonomous implementation mode");
	});

	test("HIGH 6: prompt supports multi-intent (primary + secondary)", () => {
		expect(prompt).toContain("primaryIntent");
		expect(prompt).toContain("secondaryIntent");
	});

	test("HIGH 6: prompt includes evaluation intent (propose then WAIT)", () => {
		expect(prompt).toContain("evaluation");
		expect(prompt).toContain("WAIT");
	});

	test("HIGH 6: prompt includes investigation intent", () => {
		expect(prompt).toContain("investigation");
	});

	test("prompt instructs open_ended to assess then wait for confirmation", () => {
		expect(prompt).toContain("assess");
		expect(prompt).toContain("propose");
	});

	test("prompt instructs passing intent: 'implementation' to oc_orchestrate", () => {
		expect(prompt).toContain('intent set to "implementation"');
	});

	test("prompt instructs passing routeToken to oc_orchestrate", () => {
		expect(prompt).toContain("routeToken");
	});

	test("prompt states pipeline requires intent classification", () => {
		expect(prompt).toContain("pipeline REQUIRES intent");
	});

	test("prompt forbids calling oc_orchestrate without oc_route", () => {
		expect(prompt).toContain("DO NOT call oc_orchestrate without first calling oc_route");
	});

	test("prompt warns about non-implementation intent on active pipelines", () => {
		expect(prompt).toContain("rejects non-implementation intents at runtime");
	});
});
