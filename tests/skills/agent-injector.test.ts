import { describe, expect, test } from "bun:test";
import { AGENT_SKILL_MAP } from "../../src/agents/agent-skill-map";
import { createAgentSkillInjector } from "../../src/skills/agent-injector";

describe("createAgentSkillInjector", () => {
	const baseDir = "/tmp/test-opencode-injector";

	test("returns a function", () => {
		const injector = createAgentSkillInjector({ baseDir });
		expect(typeof injector).toBe("function");
	});

	test("does not modify output when agent is not recognized", async () => {
		const injector = createAgentSkillInjector({ baseDir });
		const output = { system: ["You are a random agent. Do stuff."] };

		await injector({ sessionID: "ses_1" }, output);

		expect(output.system).toHaveLength(1);
	});

	test("does not modify output for empty system prompt", async () => {
		const injector = createAgentSkillInjector({ baseDir });
		const output = { system: [""] };

		await injector({ sessionID: "ses_2" }, output);

		expect(output.system).toHaveLength(1);
		expect(output.system[0]).toBe("");
	});

	test("does not throw on missing skill directory (best-effort)", async () => {
		const injector = createAgentSkillInjector({ baseDir: "/tmp/nonexistent-skills-dir" });
		const output = { system: ["You are the coder agent. Write code."] };

		await expect(injector({ sessionID: "ses_3" }, output)).resolves.toBeUndefined();
	});

	test("AGENT_SKILL_MAP keys match the agents the injector targets", () => {
		const expectedAgents = ["coder", "planner", "reviewer", "debugger", "security-auditor"];
		expect(Object.keys(AGENT_SKILL_MAP).sort()).toEqual(expectedAgents.sort());
	});

	test("handles multi-segment system array by joining for detection", async () => {
		const injector = createAgentSkillInjector({ baseDir: "/tmp/nonexistent-skills-dir" });
		const output = {
			system: ["You are the coder agent.", "## Steps\n1. Write tests."],
		};

		await expect(injector({ sessionID: "ses_4" }, output)).resolves.toBeUndefined();
	});
});
