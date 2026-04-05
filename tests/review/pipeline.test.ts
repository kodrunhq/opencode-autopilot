import { describe, expect, test } from "bun:test";
import { advancePipeline } from "../../src/review/pipeline";
import { parseAgentFindings } from "../../src/review/parse-findings";
import type { ReviewState } from "../../src/review/types";

describe("parseAgentFindings", () => {
	test("extracts valid JSON from markdown-wrapped output", () => {
		const raw = `Here are my findings:
\`\`\`json
{"findings": [{"severity": "CRITICAL", "domain": "logic", "title": "Null deref", "file": "a.ts", "line": 10, "agent": "logic-auditor", "source": "phase1", "evidence": "x is null", "problem": "crash", "fix": "add check"}]}
\`\`\``;
		const result = parseAgentFindings(raw, "logic-auditor");
		expect(result.length).toBe(1);
		expect(result[0].severity).toBe("CRITICAL");
	});

	test("handles raw array format", () => {
		const raw = `[{"severity": "HIGH", "domain": "quality", "title": "Long fn", "file": "b.ts", "line": 5, "agent": "code-quality-auditor", "source": "phase1", "evidence": "100 lines", "problem": "too long", "fix": "split"}]`;
		const result = parseAgentFindings(raw, "code-quality-auditor");
		expect(result.length).toBe(1);
	});

	test("handles {findings: []} wrapper", () => {
		const raw = `{"findings": []}`;
		const result = parseAgentFindings(raw, "logic-auditor");
		expect(result.length).toBe(0);
	});

	test("rejects invalid findings and keeps valid ones", () => {
		const raw = `{"findings": [
			{"severity": "CRITICAL", "domain": "logic", "title": "Valid", "file": "a.ts", "line": 1, "agent": "x", "source": "phase1", "evidence": "e", "problem": "p", "fix": "f"},
			null,
			"this is just a string, not an object",
			{"problem": {"not": "a string"}}
		]}`;
		const result = parseAgentFindings(raw, "logic-auditor");
		expect(result.length).toBe(1);
		expect(result[0].title).toBe("Valid");
	});

	test("sets agent field to agentName if missing", () => {
		const raw = `{"findings": [{"severity": "HIGH", "domain": "logic", "title": "Test", "file": "a.ts", "line": 1, "source": "phase1", "evidence": "e", "problem": "p", "fix": "f"}]}`;
		const result = parseAgentFindings(raw, "logic-auditor");
		expect(result.length).toBe(1);
		expect(result[0].agent).toBe("logic-auditor");
	});

	test("returns empty array for garbage input", () => {
		const raw = "I found no issues. Everything looks great!";
		const result = parseAgentFindings(raw, "logic-auditor");
		expect(result.length).toBe(0);
	});

	test("extracts JSON from text with surrounding prose", () => {
		const raw = `After careful analysis, here are my findings:

{"findings": [{"severity": "CRITICAL", "domain": "security", "title": "SQL injection", "file": "db.ts", "line": 22, "agent": "security-auditor", "source": "phase1", "evidence": "raw query", "problem": "injectable", "fix": "parameterize"}]}

That concludes my review.`;
		const result = parseAgentFindings(raw, "security-auditor");
		expect(result.length).toBe(1);
	});
});

describe("advancePipeline with expanded agent set", () => {
	function makeState(overrides: Partial<ReviewState> = {}): ReviewState {
		return {
			stage: 1,
			selectedAgentNames: [
				"logic-auditor",
				"security-auditor",
				"wiring-inspector",
				"dead-code-scanner",
			],
			accumulatedFindings: [],
			scope: "all",
			startedAt: new Date().toISOString(),
			...overrides,
		};
	}

	test("stage 1 -> 2 uses ALL_REVIEW_AGENTS for cross-verification", () => {
		const state = makeState();
		const result = advancePipeline('{"findings": []}', state);
		expect(result.action).toBe("dispatch");
		expect(result.parseMode).toBe("legacy");
		expect(result.stage).toBe(2);
		// Cross-verification prompts should be generated for selected agents
		if (result.agents) {
			const agentNames = result.agents.map((a) => a.name);
			// Should include specialized agents that are selected
			expect(agentNames).toContain("wiring-inspector");
			expect(agentNames).toContain("dead-code-scanner");
			// Should NOT include stage 3 agents
			expect(agentNames).not.toContain("red-team");
			expect(agentNames).not.toContain("product-thinker");
		}
	});

	test("stage 2 -> 3 dispatches stage 3 agents", () => {
		const state = makeState({ stage: 2 });
		const result = advancePipeline('{"findings": []}', state);
		expect(result.action).toBe("dispatch");
		expect(result.stage).toBe(3);
		if (result.agents) {
			const agentNames = result.agents.map((a) => a.name);
			expect(agentNames).toContain("red-team");
			expect(agentNames).toContain("product-thinker");
		}
	});

	test("stage 3 -> complete when no fixable findings", () => {
		const state = makeState({ stage: 3 });
		const result = advancePipeline('{"findings": []}', state);
		expect(result.action).toBe("complete");
		expect(result.report).toBeDefined();
		expect(result.findingsEnvelope).toBeDefined();
		expect(result.findingsEnvelope?.kind).toBe("review_findings");
	});

	test("typed findings envelope uses typed parse mode", () => {
		const state = makeState();
		const typed = JSON.stringify({
			schemaVersion: 1,
			kind: "review_findings",
			findings: [],
		});
		const result = advancePipeline(typed, state);
		expect(result.action).toBe("dispatch");
		expect(result.parseMode).toBe("typed");
	});

	test("pipeline handles selectedAgentNames with specialized agents throughout", () => {
		// Full pipeline traversal with specialized agents
		let state = makeState({
			selectedAgentNames: [
				"logic-auditor",
				"security-auditor",
				"wiring-inspector",
				"concurrency-checker",
				"database-auditor",
			],
		});

		// Stage 1 -> 2
		const result1 = advancePipeline('{"findings": []}', state);
		expect(result1.action).toBe("dispatch");
		expect(result1.state).toBeDefined();
		state = result1.state as ReviewState;

		// Stage 2 -> 3
		const result2 = advancePipeline('{"findings": []}', state);
		expect(result2.action).toBe("dispatch");
		expect(result2.state).toBeDefined();
		state = result2.state as ReviewState;

		// Stage 3 -> complete
		const result3 = advancePipeline('{"findings": []}', state);
		expect(result3.action).toBe("complete");
	});
});
