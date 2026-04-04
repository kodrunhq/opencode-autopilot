import { describe, expect, test } from "bun:test";
import { REVIEW_AGENTS, SPECIALIZED_AGENTS } from "../../src/review/agents/index";
import {
	buildCrossVerificationPrompts,
	condenseFinding,
} from "../../src/review/cross-verification";
import { selectAgents } from "../../src/review/selection";
import type { ReviewFinding } from "../../src/review/types";

// ---- Helper factories ----

function makeFinding(overrides: Partial<ReviewFinding> = {}): ReviewFinding {
	return {
		severity: "HIGH",
		domain: "logic",
		title: "Missing null check",
		file: "src/index.ts",
		line: 42,
		agent: "logic-auditor",
		source: "phase1",
		evidence: "The variable could be null",
		problem: "Null dereference possible",
		fix: "Add null check before access",
		...overrides,
	};
}

// A fake agent with a non-matching stack for exclusion tests
const rustOnlyAgent = Object.freeze({
	name: "rust-only-agent",
	description: "A test agent that only applies to Rust",
	relevantStacks: Object.freeze(["rust"] as readonly string[]),
	severityFocus: Object.freeze(["CRITICAL"] as readonly string[]),
	prompt: "Test prompt {{DIFF}} {{PRIOR_FINDINGS}} {{MEMORY}}",
});

// A fake agent gated on react
const reactOnlyAgent = Object.freeze({
	name: "react-test-agent",
	description: "A test agent that only applies to React",
	relevantStacks: Object.freeze(["react"] as readonly string[]),
	severityFocus: Object.freeze(["HIGH"] as readonly string[]),
	prompt: "React test prompt {{DIFF}} {{PRIOR_FINDINGS}} {{MEMORY}}",
});

// ---- selectAgents ----

describe("selectAgents", () => {
	test("with empty detectedStacks returns all universal agents", () => {
		const result = selectAgents(
			[],
			{ hasTests: false, hasAuth: false, hasConfig: false, fileCount: 1 },
			REVIEW_AGENTS,
		);
		// All REVIEW_AGENTS have relevantStacks=[], so all should pass
		expect(result.selected.length).toBe(REVIEW_AGENTS.length);
		expect(result.excluded.length).toBe(0);
	});

	test("with specific stacks still returns all universal agents", () => {
		const result = selectAgents(
			["node", "typescript"],
			{ hasTests: false, hasAuth: false, hasConfig: false, fileCount: 2 },
			REVIEW_AGENTS,
		);
		expect(result.selected.length).toBe(REVIEW_AGENTS.length);
	});

	test("excludes agent with non-matching stack", () => {
		const agentsWithRust = [...REVIEW_AGENTS, rustOnlyAgent] as const;
		const result = selectAgents(
			["node"],
			{ hasTests: false, hasAuth: false, hasConfig: false, fileCount: 1 },
			agentsWithRust,
		);
		expect(result.selected.some((a) => a.name === "rust-only-agent")).toBe(false);
		expect(result.excluded.length).toBe(1);
		expect(result.excluded[0].agent).toBe("rust-only-agent");
	});

	test("excluded list includes reason with stack info", () => {
		const agentsWithRust = [...REVIEW_AGENTS, rustOnlyAgent] as const;
		const result = selectAgents(
			["node"],
			{ hasTests: false, hasAuth: false, hasConfig: false, fileCount: 1 },
			agentsWithRust,
		);
		expect(result.excluded[0].reason).toContain("rust");
		expect(result.excluded[0].reason).toContain("node");
	});

	test("returns frozen result", () => {
		const result = selectAgents(
			[],
			{ hasTests: false, hasAuth: false, hasConfig: false, fileCount: 1 },
			REVIEW_AGENTS,
		);
		expect(Object.isFrozen(result)).toBe(true);
	});

	test("includes react-gated agent when detectedStacks contains react", () => {
		const agents = [...REVIEW_AGENTS, reactOnlyAgent] as const;
		const result = selectAgents(
			["typescript", "react"],
			{ hasTests: false, hasAuth: false, hasConfig: false, fileCount: 3 },
			agents,
		);
		expect(result.selected.some((a) => a.name === "react-test-agent")).toBe(true);
		expect(result.excluded.length).toBe(0);
	});

	test("excludes react-gated agent when detectedStacks is typescript only", () => {
		const agents = [...REVIEW_AGENTS, reactOnlyAgent] as const;
		const result = selectAgents(
			["typescript"],
			{ hasTests: false, hasAuth: false, hasConfig: false, fileCount: 2 },
			agents,
		);
		expect(result.selected.some((a) => a.name === "react-test-agent")).toBe(false);
		expect(result.excluded.length).toBe(1);
		expect(result.excluded[0].agent).toBe("react-test-agent");
	});

	test("with all candidates (universal + specialized) and no stacks, returns only universal agents", () => {
		const allCandidates = [...REVIEW_AGENTS, ...SPECIALIZED_AGENTS];
		const result = selectAgents(
			[],
			{ hasTests: false, hasAuth: false, hasConfig: false, fileCount: 1 },
			allCandidates,
		);
		// Universal agents pass (empty relevantStacks), stack-gated agents are excluded
		const stackGatedNames = new Set([
			"type-soundness",
			"state-mgmt-auditor",
			"react-patterns-auditor",
			"go-idioms-auditor",
			"python-django-auditor",
			"rust-safety-auditor",
		]);
		for (const agent of result.selected) {
			expect(stackGatedNames.has(agent.name)).toBe(false);
		}
		expect(result.excluded.length).toBe(stackGatedNames.size);
	});

	test("with typescript stack, includes type-soundness but excludes react/go/python/rust agents", () => {
		const allCandidates = [...REVIEW_AGENTS, ...SPECIALIZED_AGENTS];
		const result = selectAgents(
			["typescript"],
			{ hasTests: true, hasAuth: false, hasConfig: false, fileCount: 5 },
			allCandidates,
		);
		expect(result.selected.some((a) => a.name === "type-soundness")).toBe(true);
		expect(result.selected.some((a) => a.name === "react-patterns-auditor")).toBe(false);
		expect(result.selected.some((a) => a.name === "go-idioms-auditor")).toBe(false);
		expect(result.selected.some((a) => a.name === "python-django-auditor")).toBe(false);
		expect(result.selected.some((a) => a.name === "rust-safety-auditor")).toBe(false);
	});
});

// ---- condenseFinding ----

describe("condenseFinding", () => {
	test("produces correct 1-line format", () => {
		const finding = makeFinding({
			agent: "logic-auditor",
			severity: "CRITICAL",
			file: "src/main.ts",
			line: 10,
			title: "Null dereference on user input",
		});
		const result = condenseFinding(finding);
		expect(result).toContain("[logic-auditor]");
		expect(result).toContain("[CRITICAL]");
		expect(result).toContain("[src/main.ts:10]");
		expect(result).toContain("Null dereference");
	});

	test("truncates long titles", () => {
		const longTitle = "A".repeat(200);
		const finding = makeFinding({ title: longTitle });
		const result = condenseFinding(finding);
		expect(result.length).toBeLessThan(250);
	});
});

// ---- buildCrossVerificationPrompts ----

describe("buildCrossVerificationPrompts", () => {
	test("generates one prompt per agent", () => {
		const agents = REVIEW_AGENTS.slice(0, 2);
		const findingsByAgent = new Map<string, readonly ReviewFinding[]>([
			[agents[0].name, [makeFinding({ agent: agents[0].name })]],
			[agents[1].name, [makeFinding({ agent: agents[1].name })]],
		]);
		const prompts = buildCrossVerificationPrompts(agents, findingsByAgent, "diff content");
		expect(prompts.length).toBe(2);
	});

	test("does NOT include agent's own findings in its prompt", () => {
		const agents = REVIEW_AGENTS.slice(0, 2);
		const findingsByAgent = new Map<string, readonly ReviewFinding[]>([
			[agents[0].name, [makeFinding({ agent: agents[0].name, title: "OwnFindingA" })]],
			[agents[1].name, [makeFinding({ agent: agents[1].name, title: "OwnFindingB" })]],
		]);
		const prompts = buildCrossVerificationPrompts(agents, findingsByAgent, "diff content");
		const prompt0 = prompts.find((p) => p.name === agents[0].name);
		const prompt1 = prompts.find((p) => p.name === agents[1].name);

		// Agent 0's prompt should contain agent 1's finding, not its own
		expect(prompt0?.prompt).toContain("OwnFindingB");
		expect(prompt0?.prompt).not.toContain("OwnFindingA");

		// Agent 1's prompt should contain agent 0's finding, not its own
		expect(prompt1?.prompt).toContain("OwnFindingA");
		expect(prompt1?.prompt).not.toContain("OwnFindingB");
	});

	test("includes PRIOR_FINDINGS section with condensed findings", () => {
		const agents = REVIEW_AGENTS.slice(0, 2);
		const findingsByAgent = new Map<string, readonly ReviewFinding[]>([
			[agents[0].name, [makeFinding({ agent: agents[0].name })]],
			[agents[1].name, []],
		]);
		const prompts = buildCrossVerificationPrompts(agents, findingsByAgent, "some diff");
		const prompt1 = prompts.find((p) => p.name === agents[1].name);
		// Agent 1 should see agent 0's findings
		expect(prompt1?.prompt).toContain(agents[0].name);
	});

	test("returns frozen array", () => {
		const prompts = buildCrossVerificationPrompts([], new Map(), "diff");
		expect(Object.isFrozen(prompts)).toBe(true);
	});
});
