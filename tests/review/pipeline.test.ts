import { describe, expect, test } from "bun:test";
import { parseAgentFindings } from "../../src/review/pipeline";

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
			{"severity": "INVALID_SEVERITY", "domain": "logic", "title": "Bad", "file": "a.ts"}
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
