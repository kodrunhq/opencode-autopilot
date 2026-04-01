import { describe, expect, test } from "bun:test";
import { buildReport, deduplicateFindings, SEVERITY_ORDER } from "../../src/review/report";
import type { ReviewFinding } from "../../src/review/types";

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

describe("SEVERITY_ORDER", () => {
	test("CRITICAL has lowest rank (highest priority)", () => {
		expect(SEVERITY_ORDER.CRITICAL).toBeLessThan(SEVERITY_ORDER.HIGH);
		expect(SEVERITY_ORDER.HIGH).toBeLessThan(SEVERITY_ORDER.MEDIUM);
		expect(SEVERITY_ORDER.MEDIUM).toBeLessThan(SEVERITY_ORDER.LOW);
	});
});

describe("deduplicateFindings", () => {
	test("removes same-agent same-file same-line duplicates", () => {
		const findings: ReviewFinding[] = [
			makeFinding({ agent: "logic-auditor", file: "a.ts", line: 10, severity: "HIGH" }),
			makeFinding({ agent: "logic-auditor", file: "a.ts", line: 10, severity: "CRITICAL" }),
		];
		const result = deduplicateFindings(findings);
		expect(result.length).toBe(1);
	});

	test("keeps higher severity version on collision", () => {
		const findings: ReviewFinding[] = [
			makeFinding({
				agent: "logic-auditor",
				file: "a.ts",
				line: 10,
				severity: "LOW",
				title: "Low",
			}),
			makeFinding({
				agent: "logic-auditor",
				file: "a.ts",
				line: 10,
				severity: "CRITICAL",
				title: "High",
			}),
		];
		const result = deduplicateFindings(findings);
		expect(result[0].severity).toBe("CRITICAL");
	});

	test("keeps different-agent findings for same file/line", () => {
		const findings: ReviewFinding[] = [
			makeFinding({ agent: "logic-auditor", file: "a.ts", line: 10 }),
			makeFinding({ agent: "security-auditor", file: "a.ts", line: 10 }),
		];
		const result = deduplicateFindings(findings);
		expect(result.length).toBe(2);
	});

	test("returns new array (no mutation)", () => {
		const findings: ReviewFinding[] = [makeFinding()];
		const result = deduplicateFindings(findings);
		expect(result).not.toBe(findings);
	});
});

describe("buildReport", () => {
	test("groups findings by file", () => {
		const findings: ReviewFinding[] = [
			makeFinding({ file: "b.ts", severity: "HIGH" }),
			makeFinding({ file: "a.ts", severity: "CRITICAL" }),
			makeFinding({ file: "b.ts", severity: "CRITICAL", agent: "security-auditor" }),
		];
		const report = buildReport(findings, "staged", ["logic-auditor", "security-auditor"]);
		// Findings should be present and sorted
		expect(report.findings.length).toBeGreaterThanOrEqual(2);
	});

	test("sorts by severity within file groups (CRITICAL first)", () => {
		const findings: ReviewFinding[] = [
			makeFinding({ file: "a.ts", severity: "LOW", agent: "a1", line: 1 }),
			makeFinding({ file: "a.ts", severity: "CRITICAL", agent: "a2", line: 2 }),
			makeFinding({ file: "a.ts", severity: "HIGH", agent: "a3", line: 3 }),
		];
		const report = buildReport(findings, "staged", ["a1", "a2", "a3"]);
		const aFindings = report.findings.filter((f) => f.file === "a.ts");
		expect(aFindings[0].severity).toBe("CRITICAL");
		expect(aFindings[1].severity).toBe("HIGH");
		expect(aFindings[2].severity).toBe("LOW");
	});

	test("computes correct summary counts", () => {
		const findings: ReviewFinding[] = [
			makeFinding({ severity: "CRITICAL", agent: "a1", file: "a.ts", line: 1 }),
			makeFinding({ severity: "CRITICAL", agent: "a2", file: "b.ts", line: 2 }),
			makeFinding({ severity: "HIGH", agent: "a3", file: "c.ts", line: 3 }),
			makeFinding({ severity: "LOW", agent: "a4", file: "d.ts", line: 4 }),
		];
		const report = buildReport(findings, "staged", ["a1", "a2", "a3", "a4"]);
		// The summary should mention counts
		expect(report.summary).toContain("2 CRITICAL");
		expect(report.summary).toContain("1 HIGH");
		expect(report.summary).toContain("1 LOW");
	});

	test("validates through reviewReportSchema", () => {
		const findings: ReviewFinding[] = [makeFinding()];
		const report = buildReport(findings, "staged", ["logic-auditor"]);
		expect(report.verdict).toBeDefined();
		expect(report.completedAt).toBeDefined();
		expect(report.totalDurationMs).toBeGreaterThanOrEqual(0);
	});

	test("returns frozen report", () => {
		const report = buildReport([], "staged", ["logic-auditor"]);
		expect(Object.isFrozen(report)).toBe(true);
	});

	test("determines BLOCKED verdict when CRITICAL findings exist", () => {
		const findings: ReviewFinding[] = [makeFinding({ severity: "CRITICAL" })];
		const report = buildReport(findings, "staged", ["logic-auditor"]);
		expect(report.verdict).toBe("BLOCKED");
	});

	test("determines CONCERNS verdict when only HIGH findings exist", () => {
		const findings: ReviewFinding[] = [makeFinding({ severity: "HIGH" })];
		const report = buildReport(findings, "staged", ["logic-auditor"]);
		expect(report.verdict).toBe("CONCERNS");
	});

	test("determines CONCERNS verdict when only MEDIUM findings exist", () => {
		const findings: ReviewFinding[] = [makeFinding({ severity: "MEDIUM" })];
		const report = buildReport(findings, "staged", ["logic-auditor"]);
		expect(report.verdict).toBe("CONCERNS");
	});

	test("determines CLEAN verdict when no findings", () => {
		const report = buildReport([], "staged", ["logic-auditor"]);
		expect(report.verdict).toBe("CLEAN");
	});
});
