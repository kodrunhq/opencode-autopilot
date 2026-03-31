import { describe, expect, test } from "bun:test";
import { buildFixInstructions, determineFixableFindings } from "../../src/review/fix-cycle";
import type { ReviewFinding } from "../../src/review/types";

function makeFinding(overrides: Partial<ReviewFinding> = {}): ReviewFinding {
	return {
		severity: "CRITICAL",
		domain: "security",
		title: "SQL Injection vulnerability",
		file: "src/api.ts",
		agent: "security-auditor",
		source: "phase1",
		evidence: "User input passed directly to query",
		problem: "SQL injection possible",
		fix: "Use parameterized queries with prepared statements instead of string concatenation",
		...overrides,
	};
}

describe("determineFixableFindings", () => {
	test("returns CRITICAL findings with actionable suggestions", () => {
		const findings = [makeFinding({ severity: "CRITICAL" })];
		const result = determineFixableFindings(findings);
		expect(result.fixable.length).toBe(1);
		expect(result.fixable[0].severity).toBe("CRITICAL");
	});

	test("skips NITPICK findings", () => {
		const findings = [makeFinding({ severity: "NITPICK" })];
		const result = determineFixableFindings(findings);
		expect(result.fixable.length).toBe(0);
		expect(result.skipped.length).toBe(1);
		expect(result.skipped[0].reason).toContain("severity");
	});

	test("skips WARNING findings (only CRITICAL allowed)", () => {
		const findings = [makeFinding({ severity: "WARNING" })];
		const result = determineFixableFindings(findings);
		expect(result.fixable.length).toBe(0);
	});

	test("skips findings with vague suggestions containing 'consider'", () => {
		const findings = [makeFinding({ fix: "You should consider using a different approach" })];
		const result = determineFixableFindings(findings);
		expect(result.fixable.length).toBe(0);
		expect(result.skipped[0].reason).toContain("vague");
	});

	test("skips findings with vague suggestions containing 'might'", () => {
		const findings = [makeFinding({ fix: "You might want to refactor this code" })];
		const result = determineFixableFindings(findings);
		expect(result.fixable.length).toBe(0);
	});

	test("skips findings with vague suggestions containing 'perhaps'", () => {
		const findings = [makeFinding({ fix: "Perhaps this should be different" })];
		const result = determineFixableFindings(findings);
		expect(result.fixable.length).toBe(0);
	});

	test("skips findings with suggestions shorter than 20 chars", () => {
		const findings = [makeFinding({ fix: "fix this" })];
		const result = determineFixableFindings(findings);
		expect(result.fixable.length).toBe(0);
		expect(result.skipped[0].reason).toContain("short");
	});

	test("builds agentsToRerun as unique set from fixable findings", () => {
		const findings = [
			makeFinding({ agent: "security-auditor" }),
			makeFinding({ agent: "security-auditor", title: "Another issue" }),
			makeFinding({ agent: "logic-auditor" }),
		];
		const result = determineFixableFindings(findings);
		expect(result.agentsToRerun.length).toBe(2);
		expect(result.agentsToRerun).toContain("security-auditor");
		expect(result.agentsToRerun).toContain("logic-auditor");
	});

	test("builds skipped with reason for each non-fixable finding", () => {
		const findings = [
			makeFinding({ severity: "NITPICK" }),
			makeFinding({ fix: "consider something" }),
		];
		const result = determineFixableFindings(findings);
		expect(result.skipped.length).toBe(2);
		for (const s of result.skipped) {
			expect(s.reason.length).toBeGreaterThan(0);
		}
	});

	test("returns frozen object", () => {
		const result = determineFixableFindings([]);
		expect(Object.isFrozen(result)).toBe(true);
	});
});

describe("buildFixInstructions", () => {
	const mockAgent = {
		name: "security-auditor",
		description: "Security auditor",
		relevantStacks: [] as readonly string[],
		severityFocus: ["CRITICAL"] as readonly string[],
		prompt: "Review {{DIFF}} for security issues.\n{{PRIOR_FINDINGS}}\n{{MEMORY}}",
	};

	test("returns re-run prompts for agents whose findings are fixable", () => {
		const fixable = [makeFinding({ agent: "security-auditor" })];
		const result = buildFixInstructions(fixable, [mockAgent], "diff content here");
		expect(result.length).toBe(1);
		expect(result[0].name).toBe("security-auditor");
		expect(result[0].prompt).toContain("diff content here");
	});

	test("only includes agents whose findings are in the fixable set", () => {
		const otherAgent = { ...mockAgent, name: "logic-auditor" };
		const fixable = [makeFinding({ agent: "security-auditor" })];
		const result = buildFixInstructions(fixable, [mockAgent, otherAgent], "diff");
		expect(result.length).toBe(1);
		expect(result[0].name).toBe("security-auditor");
	});

	test("prompt includes list of specific findings to verify", () => {
		const fixable = [makeFinding({ agent: "security-auditor", title: "SQL Injection" })];
		const result = buildFixInstructions(fixable, [mockAgent], "diff");
		expect(result[0].prompt).toContain("SQL Injection");
	});

	test("prompt includes instruction to verify fixes and check regressions", () => {
		const fixable = [makeFinding({ agent: "security-auditor" })];
		const result = buildFixInstructions(fixable, [mockAgent], "diff");
		expect(result[0].prompt).toContain("verify");
		expect(result[0].prompt).toContain("regression");
	});

	test("returns frozen array", () => {
		const result = buildFixInstructions([], [], "diff");
		expect(Object.isFrozen(result)).toBe(true);
	});
});
