import { describe, expect, test } from "bun:test";
import { AGENT_CATALOG } from "../../src/review/agent-catalog";
import { scoreAgent, selectReviewTeam } from "../../src/review/team-selection";

describe("selectReviewTeam", () => {
	test("always includes core squad (3 agents)", () => {
		const team = selectReviewTeam({ stackTags: ["typescript"], changedFiles: ["src/index.ts"] });
		const coreAgents = team.core;
		expect(coreAgents).toHaveLength(3);
		expect(coreAgents.some((a) => a.name === "logic-auditor")).toBe(true);
		expect(coreAgents.some((a) => a.name === "test-interrogator")).toBe(true);
		expect(coreAgents.some((a) => a.name === "contract-verifier")).toBe(true);
	});

	test("includes type-soundness for TypeScript project", () => {
		const team = selectReviewTeam({ stackTags: ["typescript"], changedFiles: ["src/index.ts"] });
		expect(team.parallel.some((a) => a.name === "type-soundness")).toBe(true);
	});

	test("includes react-patterns-auditor for React project", () => {
		const team = selectReviewTeam({
			stackTags: ["typescript", "react"],
			changedFiles: ["src/App.tsx"],
		});
		expect(team.parallel.some((a) => a.name === "react-patterns-auditor")).toBe(true);
	});

	test("excludes gated agents for non-matching stacks", () => {
		const team = selectReviewTeam({ stackTags: ["python"], changedFiles: ["app.py"] });
		expect(team.parallel.some((a) => a.name === "react-patterns-auditor")).toBe(false);
		expect(team.parallel.some((a) => a.name === "go-idioms-auditor")).toBe(false);
		expect(team.parallel.some((a) => a.name === "rust-safety-auditor")).toBe(false);
	});

	test("returns agents grouped by category", () => {
		const team = selectReviewTeam({ stackTags: ["typescript"], changedFiles: ["src/index.ts"] });
		expect(Array.isArray(team.core)).toBe(true);
		expect(Array.isArray(team.parallel)).toBe(true);
		expect(Array.isArray(team.sequenced)).toBe(true);
	});

	test("sequenced includes product-thinker and red-team", () => {
		const team = selectReviewTeam({ stackTags: ["typescript"], changedFiles: ["src/index.ts"] });
		expect(team.sequenced.some((a) => a.name === "product-thinker")).toBe(true);
		expect(team.sequenced.some((a) => a.name === "red-team")).toBe(true);
	});
});

describe("scoreAgent", () => {
	const typeSoundness = AGENT_CATALOG.find((a) => a.name === "type-soundness");

	test("returns a number between 0 and 10", () => {
		if (!typeSoundness) throw new Error("Agent not found");
		const score = scoreAgent(typeSoundness, {
			stackTags: ["typescript"],
			changedFiles: ["src/index.ts"],
		});
		expect(score).toBeGreaterThanOrEqual(0);
		expect(score).toBeLessThanOrEqual(10);
	});

	test("scores higher for matching stack", () => {
		if (!typeSoundness) throw new Error("Agent not found");
		const matchScore = scoreAgent(typeSoundness, {
			stackTags: ["typescript"],
			changedFiles: ["src/index.ts"],
		});
		const noMatchScore = scoreAgent(typeSoundness, {
			stackTags: ["python"],
			changedFiles: ["app.py"],
		});
		expect(matchScore).toBeGreaterThan(noMatchScore);
	});

	test("core agents always score 10", () => {
		const logicAuditor = AGENT_CATALOG.find((a) => a.name === "logic-auditor");
		if (!logicAuditor) throw new Error("Agent not found");
		const score = scoreAgent(logicAuditor, { stackTags: [], changedFiles: [] });
		expect(score).toBe(10);
	});
});
