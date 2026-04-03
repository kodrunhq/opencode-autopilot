import { describe, expect, it } from "bun:test";
import { agents } from "../src/agents/index";
import { pipelineAgents } from "../src/agents/pipeline/index";

describe("Agent visibility invariants", () => {
	describe("Pipeline agents", () => {
		it("all 10 pipeline agents have mode 'subagent' and hidden true", () => {
			const entries = Object.entries(pipelineAgents);
			expect(entries.length).toBe(10);

			for (const [name, agent] of entries) {
				expect(agent.mode).toBe("subagent");
				expect(agent.hidden).toBe(true);
			}
		});
	});

	describe("Standard agents", () => {
		it("autopilot has mode 'all' (the only Tab-cycle agent)", () => {
			expect(agents.autopilot.mode).toBe("all");
		});

		it("researcher has mode 'subagent' (not 'all')", () => {
			expect(agents.researcher.mode).toBe("subagent");
		});

		it("metaprompter has mode 'subagent' (not 'all')", () => {
			expect(agents.metaprompter.mode).toBe("subagent");
		});

		it("documenter has mode 'subagent'", () => {
			expect(agents.documenter.mode).toBe("subagent");
		});

		it("pr-reviewer has mode 'subagent'", () => {
			expect(agents["pr-reviewer"].mode).toBe("subagent");
		});

		it("no standard agent other than autopilot has mode 'all' or 'primary'", () => {
			for (const [name, agent] of Object.entries(agents)) {
				if (name === "autopilot") continue;
				expect(agent.mode).not.toBe("all");
				expect(agent.mode).not.toBe("primary");
			}
		});
	});

	describe("Agent count", () => {
		it("total agent count is 15 (5 standard + 10 pipeline)", () => {
			const standardCount = Object.keys(agents).length;
			const pipelineCount = Object.keys(pipelineAgents).length;
			expect(standardCount).toBe(5);
			expect(pipelineCount).toBe(10);
			expect(standardCount + pipelineCount).toBe(15);
		});
	});

	describe("OpenCode built-in agents", () => {
		// "general" and "explore" are OpenCode built-in agents (SDK Config type),
		// not registered by this plugin. See BFIX-04.
		it("'general' and 'explore' are not in plugin agent maps (they are OpenCode built-ins)", () => {
			expect((agents as Record<string, unknown>).general).toBeUndefined();
			expect((agents as Record<string, unknown>).explore).toBeUndefined();
			expect(pipelineAgents.general).toBeUndefined();
			expect(pipelineAgents.explore).toBeUndefined();
		});
	});
});
