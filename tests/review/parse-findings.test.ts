import { describe, expect, test } from "bun:test";
import { parseAgentFindings } from "../../src/review/parse-findings";

describe("Review Parsing Edge Cases (Task 4)", () => {
	const agent = "test-agent";

	test("handles missing optional/alias fields gracefully", () => {
		const raw = JSON.stringify([
			{
				severity: "invalid_severity",
				issue: "Bad var name",
				snippet: "var x = 1;",
				solution: "Use let",
			},
		]);

		const findings = parseAgentFindings(raw, agent);
		expect(findings).toHaveLength(1);
		const f = findings[0];

		expect(f.severity).toBe("LOW");
		expect(f.problem).toBe("Bad var name");
		expect(f.evidence).toBe("var x = 1;");
		expect(f.fix).toBe("Use let");
		expect(f.domain).toBe("general");
		expect(f.title).toBe("Bad var name");
		expect(f.file).toBe("unknown");
	});

	test("handles trailing commas", () => {
		const raw = `[
			{
				"severity": "HIGH",
				"problem": "Issue 1",
				"evidence": "Evi 1",
				"fix": "Fix 1",
			}
		]`;

		const findings = parseAgentFindings(raw, agent);
		expect(findings).toHaveLength(1);
		expect(findings[0].severity).toBe("HIGH");
	});

	test("discards invalid items but keeps valid ones", () => {
		const raw = JSON.stringify([
			null,
			"not an object",
			{ problem: "Good finding", severity: "CRITICAL" },
		]);

		const findings = parseAgentFindings(raw, agent);
		expect(findings).toHaveLength(1);
		expect(findings[0].problem).toBe("Good finding");
		expect(findings[0].severity).toBe("CRITICAL");
	});

	test("extracts JSON embedded in prose", () => {
		const raw = `
		Here are my findings:
		\`\`\`json
		{
			"findings": [
				{
					"problem": "Embedded finding"
				}
			]
		}
		\`\`\`
		Hope this helps!
		`;
		const findings = parseAgentFindings(raw, agent);
		expect(findings).toHaveLength(1);
		expect(findings[0].problem).toBe("Embedded finding");
	});
});
