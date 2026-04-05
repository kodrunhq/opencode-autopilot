import { describe, expect, test } from "bun:test";
import { pipelineAgents } from "../src/agents/pipeline";
import { ocReviewerAgent } from "../src/agents/pipeline/oc-reviewer";
import { AGENT_NAMES } from "../src/orchestrator/handlers/types";

describe("pipelineAgents", () => {
	test("has exactly 8 entries", () => {
		expect(Object.keys(pipelineAgents)).toHaveLength(8);
	});

	test("all agents have mode subagent", () => {
		for (const [name, config] of Object.entries(pipelineAgents)) {
			expect(config.mode, `${name} should have mode subagent`).toBe("subagent");
		}
	});

	test("all agents are frozen", () => {
		for (const [name, config] of Object.entries(pipelineAgents)) {
			expect(Object.isFrozen(config), `${name} should be frozen`).toBe(true);
		}
	});

	test("agent names match AGENT_NAMES values", () => {
		const expectedNames = new Set(Object.values(AGENT_NAMES));
		const actualNames = new Set(Object.keys(pipelineAgents));
		expect(actualNames).toEqual(expectedNames);
	});

	test("no agent has a model field", () => {
		for (const [name, config] of Object.entries(pipelineAgents)) {
			expect("model" in config, `${name} should not have model field`).toBe(false);
		}
	});

	test("all agents have structured prompts with 150+ words", () => {
		for (const [name, config] of Object.entries(pipelineAgents)) {
			const prompt = config.prompt ?? "";
			const wordCount = prompt.split(/\s+/).filter(Boolean).length;
			expect(wordCount >= 150, `${name} prompt too short (${wordCount} words, need 150+)`).toBe(
				true,
			);
			expect(prompt).toContain("## Steps");
			expect(prompt).toContain("## Constraints");
			expect(prompt).toContain("## Error Recovery");
		}
	});

	test("oc-reviewer prompt mentions oc_review", () => {
		expect(ocReviewerAgent.prompt).toContain("oc_review");
	});

	test("all agents have permission with edit allow", () => {
		for (const [name, config] of Object.entries(pipelineAgents)) {
			expect(config.permission?.edit, `${name} should have edit: allow`).toBe("allow");
		}
	});

	test("all agents have maxSteps defined", () => {
		for (const [name, config] of Object.entries(pipelineAgents)) {
			expect(typeof config.maxSteps, `${name} should have maxSteps`).toBe("number");
			expect((config.maxSteps ?? 0) > 0, `${name} maxSteps should be positive`).toBe(true);
		}
	});

	test("pipelineAgents map is frozen", () => {
		expect(Object.isFrozen(pipelineAgents)).toBe(true);
	});
});
