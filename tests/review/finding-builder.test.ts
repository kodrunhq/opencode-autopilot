import { describe, expect, test } from "bun:test";
import {
	createAgentResult,
	createFinding,
	mergeFindings,
} from "../../src/review/finding-builder";
import type { ReviewFinding } from "../../src/review/types";

describe("createFinding", () => {
	test("returns a frozen ReviewFinding object", () => {
		const finding = createFinding({
			severity: "CRITICAL",
			domain: "logic",
			title: "Null dereference",
			file: "src/api.ts",
			agent: "logic-auditor",
			source: "phase1",
			evidence: "obj.value accessed without null check",
			problem: "obj can be null",
			fix: "Add null check",
		});

		expect(Object.isFrozen(finding)).toBe(true);
		expect(finding.severity).toBe("CRITICAL");
		expect(finding.domain).toBe("logic");
		expect(finding.title).toBe("Null dereference");
	});

	test("validates severity (rejects invalid values)", () => {
		expect(() =>
			createFinding({
				severity: "INVALID" as "CRITICAL",
				domain: "logic",
				title: "Test",
				file: "test.ts",
				agent: "logic-auditor",
				source: "phase1",
				evidence: "evidence",
				problem: "problem",
				fix: "fix",
			}),
		).toThrow();
	});

	test("includes optional line number", () => {
		const finding = createFinding({
			severity: "WARNING",
			domain: "quality",
			title: "Long function",
			file: "src/utils.ts",
			line: 42,
			agent: "code-quality-auditor",
			source: "phase1",
			evidence: "function is 150 lines",
			problem: "Exceeds 100 line threshold",
			fix: "Extract sub-functions",
		});

		expect(finding.line).toBe(42);
	});
});

describe("createAgentResult", () => {
	test("creates result with agent name, findings, and duration", () => {
		const findings: readonly ReviewFinding[] = [
			createFinding({
				severity: "WARNING",
				domain: "logic",
				title: "Edge case",
				file: "src/api.ts",
				agent: "logic-auditor",
				source: "phase1",
				evidence: "code",
				problem: "missing check",
				fix: "add check",
			}),
		];

		const result = createAgentResult({
			agent: "logic-auditor",
			category: "core",
			findings,
			durationMs: 1500,
		});

		expect(result.agent).toBe("logic-auditor");
		expect(result.findings).toHaveLength(1);
		expect(result.durationMs).toBe(1500);
		expect(result.completedAt).toBeDefined();
		expect(Object.isFrozen(result)).toBe(true);
	});
});

describe("mergeFindings", () => {
	const findingA = createFinding({
		severity: "CRITICAL",
		domain: "security",
		title: "SQL injection",
		file: "src/db.ts",
		agent: "security-auditor",
		source: "phase1",
		evidence: "raw SQL",
		problem: "injection risk",
		fix: "use parameterized query",
	});

	const findingB = createFinding({
		severity: "NITPICK",
		domain: "quality",
		title: "Unused import",
		file: "src/utils.ts",
		agent: "dead-code-scanner",
		source: "phase1",
		evidence: "import { foo }",
		problem: "foo is never used",
		fix: "remove import",
	});

	const findingC = createFinding({
		severity: "WARNING",
		domain: "logic",
		title: "Missing null check",
		file: "src/api.ts",
		agent: "logic-auditor",
		source: "phase1",
		evidence: "obj.value",
		problem: "obj nullable",
		fix: "add check",
	});

	test("combines findings from multiple agents sorted by severity", () => {
		const merged = mergeFindings([findingC, findingB, findingA]);
		expect(merged).toHaveLength(3);
		// CRITICAL first, then WARNING, then NITPICK
		expect(merged[0].severity).toBe("CRITICAL");
		expect(merged[1].severity).toBe("WARNING");
		expect(merged[2].severity).toBe("NITPICK");
	});

	test("deduplicates findings with same file+title", () => {
		const duplicate = createFinding({
			severity: "CRITICAL",
			domain: "security",
			title: "SQL injection",
			file: "src/db.ts",
			agent: "red-team",
			source: "red-team",
			evidence: "different evidence",
			problem: "same issue",
			fix: "same fix",
		});

		const merged = mergeFindings([findingA, duplicate, findingB]);
		// findingA and duplicate have same file+title -> deduplicated
		expect(merged).toHaveLength(2);
	});

	test("keeps the higher severity when deduplicating", () => {
		const lowerSeverityDup = createFinding({
			severity: "WARNING",
			domain: "security",
			title: "SQL injection",
			file: "src/db.ts",
			agent: "wiring-inspector",
			source: "phase1",
			evidence: "different angle",
			problem: "same issue",
			fix: "same fix",
		});

		const merged = mergeFindings([lowerSeverityDup, findingA]);
		expect(merged).toHaveLength(1);
		expect(merged[0].severity).toBe("CRITICAL"); // Higher severity kept
	});
});
