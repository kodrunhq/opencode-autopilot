import { describe, expect, test } from "bun:test";
import {
	agentResultSchema,
	reviewConfigSchema,
	reviewFindingSchema,
	reviewReportSchema,
	SEVERITIES,
	VERDICTS,
} from "../../src/review/schemas";

describe("SEVERITIES", () => {
	test("contains CRITICAL, WARNING, NITPICK", () => {
		expect(SEVERITIES).toContain("CRITICAL");
		expect(SEVERITIES).toContain("WARNING");
		expect(SEVERITIES).toContain("NITPICK");
	});

	test("has exactly 3 levels", () => {
		expect(SEVERITIES).toHaveLength(3);
	});

	test("is frozen", () => {
		expect(Object.isFrozen(SEVERITIES)).toBe(true);
	});
});

describe("VERDICTS", () => {
	test("contains CLEAN, APPROVED, CONCERNS, BLOCKED", () => {
		expect(VERDICTS).toContain("CLEAN");
		expect(VERDICTS).toContain("APPROVED");
		expect(VERDICTS).toContain("CONCERNS");
		expect(VERDICTS).toContain("BLOCKED");
	});

	test("has exactly 4 levels", () => {
		expect(VERDICTS).toHaveLength(4);
	});

	test("is frozen", () => {
		expect(Object.isFrozen(VERDICTS)).toBe(true);
	});
});

describe("reviewFindingSchema", () => {
	const validFinding = {
		severity: "CRITICAL" as const,
		domain: "logic",
		title: "Null dereference in handler",
		file: "src/api/handler.ts",
		line: 42,
		agent: "logic-auditor",
		source: "phase1" as const,
		evidence: "const x = obj.value; // obj can be null",
		problem: "obj is nullable but accessed without check",
		fix: "Add null check before accessing obj.value",
	};

	test("parses valid finding", () => {
		const result = reviewFindingSchema.parse(validFinding);
		expect(result.severity).toBe("CRITICAL");
		expect(result.agent).toBe("logic-auditor");
		expect(result.file).toBe("src/api/handler.ts");
	});

	test("rejects invalid severity", () => {
		expect(() => reviewFindingSchema.parse({ ...validFinding, severity: "INVALID" })).toThrow();
	});

	test("rejects missing required fields", () => {
		const { title: _title, ...incomplete } = validFinding;
		expect(() => reviewFindingSchema.parse(incomplete)).toThrow();
	});

	test("accepts optional line as undefined", () => {
		const { line: _line, ...withoutLine } = validFinding;
		const result = reviewFindingSchema.parse(withoutLine);
		expect(result.line).toBeUndefined();
	});

	test("validates source enum", () => {
		expect(() =>
			reviewFindingSchema.parse({ ...validFinding, source: "invalid-source" }),
		).toThrow();
	});
});

describe("agentResultSchema", () => {
	test("parses valid agent result with findings", () => {
		const result = agentResultSchema.parse({
			agent: "logic-auditor",
			category: "core",
			findings: [
				{
					severity: "WARNING",
					domain: "logic",
					title: "Missing edge case",
					file: "src/utils.ts",
					agent: "logic-auditor",
					source: "phase1",
					evidence: "code snippet",
					problem: "description",
					fix: "suggestion",
				},
			],
			durationMs: 1500,
			completedAt: "2026-03-31T12:00:00Z",
		});
		expect(result.agent).toBe("logic-auditor");
		expect(result.findings).toHaveLength(1);
	});

	test("defaults findings to empty array", () => {
		const result = agentResultSchema.parse({
			agent: "logic-auditor",
			category: "core",
			durationMs: 0,
			completedAt: "2026-03-31T12:00:00Z",
		});
		expect(result.findings).toEqual([]);
	});
});

describe("reviewReportSchema", () => {
	test("validates verdict as CLEAN", () => {
		const result = reviewReportSchema.parse({
			verdict: "CLEAN",
			findings: [],
			agentResults: [],
			totalDurationMs: 5000,
			completedAt: "2026-03-31T12:00:00Z",
			summary: "No issues found",
		});
		expect(result.verdict).toBe("CLEAN");
	});

	test("validates verdict as BLOCKED", () => {
		const result = reviewReportSchema.parse({
			verdict: "BLOCKED",
			findings: [],
			agentResults: [],
			totalDurationMs: 5000,
			completedAt: "2026-03-31T12:00:00Z",
			summary: "Critical issues found",
		});
		expect(result.verdict).toBe("BLOCKED");
	});

	test("rejects invalid verdict", () => {
		expect(() =>
			reviewReportSchema.parse({
				verdict: "INVALID",
				findings: [],
				agentResults: [],
				totalDurationMs: 0,
				completedAt: "2026-03-31T12:00:00Z",
				summary: "",
			}),
		).toThrow();
	});
});

describe("reviewConfigSchema", () => {
	test("provides sensible defaults", () => {
		const result = reviewConfigSchema.parse({});
		expect(result.parallel).toBe(true);
		expect(result.maxFixAttempts).toBe(3);
	});

	test("allows overriding defaults", () => {
		const result = reviewConfigSchema.parse({
			parallel: false,
			maxFixAttempts: 5,
		});
		expect(result.parallel).toBe(false);
		expect(result.maxFixAttempts).toBe(5);
	});
});
