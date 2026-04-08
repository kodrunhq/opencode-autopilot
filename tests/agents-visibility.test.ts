import { describe, expect, it } from "bun:test";
import { agents } from "../src/agents/index";
import { pipelineAgents } from "../src/agents/pipeline/index";

describe("Agent visibility invariants", () => {
	describe("Pipeline agents", () => {
		it("all 8 pipeline agents have mode 'subagent' and hidden true", () => {
			const entries = Object.entries(pipelineAgents);
			expect(entries.length).toBe(8);

			for (const [_name, agent] of entries) {
				expect(agent.mode).toBe("subagent");
				expect(agent.hidden).toBe(true);
			}
		});
	});

	describe("Standard agents", () => {
		it("autopilot has mode 'all'", () => {
			expect(agents.autopilot.mode).toBe("all");
		});

		it("debugger has mode 'all'", () => {
			expect(agents.debugger.mode).toBe("all");
		});

		it("planner has mode 'all'", () => {
			expect(agents.planner.mode).toBe("all");
		});

		it("reviewer has mode 'all'", () => {
			expect(agents.reviewer.mode).toBe("all");
		});

		it("researcher has mode 'all'", () => {
			expect(agents.researcher.mode).toBe("all");
		});

		it("metaprompter has mode 'subagent' (not 'all')", () => {
			expect(agents.metaprompter.mode).toBe("subagent");
		});

		it("pr-reviewer has mode 'subagent'", () => {
			expect(agents["pr-reviewer"].mode).toBe("subagent");
		});

		it("security-auditor has mode 'subagent'", () => {
			expect(agents["security-auditor"].mode).toBe("subagent");
		});

		it("exactly 7 agents have mode 'all': autopilot, coder, debugger, oracle, planner, researcher, reviewer", () => {
			const primaryAgents = Object.entries(agents)
				.filter(([_, agent]) => agent.mode === "all")
				.map(([name]) => name);
			expect(primaryAgents.sort()).toEqual([
				"autopilot",
				"coder",
				"debugger",
				"oracle",
				"planner",
				"researcher",
				"reviewer",
			]);
		});
	});

	describe("Agent count", () => {
		it("total agent count is 18 (10 standard + 8 pipeline)", () => {
			const standardCount = Object.keys(agents).length;
			const pipelineCount = Object.keys(pipelineAgents).length;
			expect(standardCount).toBe(10);
			expect(pipelineCount).toBe(8);
			expect(standardCount + pipelineCount).toBe(18);
		});

		it("primary agent names sort alphabetically in desired Tab-cycle order", () => {
			const primaryNames = Object.entries(agents)
				.filter(([_, agent]) => agent.mode === "all")
				.map(([name]) => name);
			const sorted = [...primaryNames].sort();
			expect(sorted).toEqual([
				"autopilot",
				"coder",
				"debugger",
				"oracle",
				"planner",
				"researcher",
				"reviewer",
			]);
			expect(sorted[0]).toBe("autopilot");
			expect(sorted[1]).toBe("coder");
			expect(sorted[2]).toBe("debugger");
			expect(sorted[3]).toBe("oracle");
			expect(sorted[4]).toBe("planner");
			expect(sorted[5]).toBe("researcher");
			expect(sorted[6]).toBe("reviewer");
		});
	});

	describe("New primary agent permissions", () => {
		it("debugger allows edit and bash, denies webfetch", () => {
			expect(agents.debugger.permission?.edit).toBe("allow");
			expect(agents.debugger.permission?.bash).toBe("allow");
			expect(agents.debugger.permission?.webfetch).toBe("deny");
		});

		it("planner allows edit and bash, denies webfetch", () => {
			expect(agents.planner.permission?.edit).toBe("allow");
			expect(agents.planner.permission?.bash).toBe("allow");
			expect(agents.planner.permission?.webfetch).toBe("deny");
		});

		it("reviewer denies edit, allows bash, denies webfetch", () => {
			expect(agents.reviewer.permission?.edit).toBe("deny");
			expect(agents.reviewer.permission?.bash).toBe("allow");
			expect(agents.reviewer.permission?.webfetch).toBe("deny");
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
