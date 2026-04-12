import { describe, expect, test } from "bun:test";
import {
	buildProgramOracleSignoffRequest,
	buildTrancheOracleSignoffRequest,
	formatOracleSignoffEnvelope,
	parseProgramOracleSignoff,
	parseTrancheOracleSignoff,
} from "../../src/orchestrator/signoff";

describe("oracle signoff helpers", () => {
	test("buildTrancheOracleSignoffRequest includes structured contract fields", () => {
		const request = buildTrancheOracleSignoffRequest({
			originalIntent: "Ship the tranche",
			trancheIntent: "Implement authentication cleanup",
			diffSummary: "Touched auth routes and tests",
			reviewReport: "No CRITICAL findings.",
			verificationResults: "Tests passed.",
			remainingBacklog: ["Task 9: follow-up docs"],
		});

		expect(request.prompt).toContain("Mandatory tranche Oracle signoff request.");
		expect(request.prompt).toContain(request.signoffId);
		expect(request.prompt).toContain(request.inputsDigest);
		expect(request.prompt).toContain("PASS_WITH_NEXT_TRANCHE");
	});

	test("parseTrancheOracleSignoff validates tagged JSON payloads", () => {
		const response = formatOracleSignoffEnvelope({
			signoffId: "tranche-signoff-1",
			scope: "TRANCHE",
			inputsDigest: "digest-1",
			verdict: "PASS",
			reasoning: "Ready to ship.",
			blockingConditions: [],
		});

		const signoff = parseTrancheOracleSignoff(response, {
			expectedSignoffId: "tranche-signoff-1",
			expectedInputsDigest: "digest-1",
		});

		expect(signoff?.verdict).toBe("PASS");
		expect(signoff?.scope).toBe("TRANCHE");
	});

	test("parseProgramOracleSignoff returns null when the current attempt has not answered yet", () => {
		const earlierResponse = formatOracleSignoffEnvelope({
			signoffId: "program-signoff-1",
			scope: "PROGRAM",
			inputsDigest: "digest-1",
			verdict: "INCOMPLETE",
			reasoning: "More work remains.",
		});

		expect(
			parseProgramOracleSignoff([earlierResponse], { expectedSignoffId: "program-signoff-2" }),
		).toBeNull();
	});

	test("parseProgramOracleSignoff fails closed on malformed matching payloads", () => {
		const request = buildProgramOracleSignoffRequest(
			{
				originalDossierRequest: "Finish the program",
				trancheResults: ["Tranche 1 complete"],
				unresolvedRisks: [],
				acceptedWaivers: [],
			},
			{ signoffId: "program-signoff-1" },
		);

		expect(() =>
			parseProgramOracleSignoff(
				[
					`<oracle-signoff id="program-signoff-1">`,
					JSON.stringify({
						signoffId: "program-signoff-1",
						scope: "PROGRAM",
						inputsDigest: request.inputsDigest,
					}),
					`</oracle-signoff>`,
				],
				{ expectedSignoffId: "program-signoff-1" },
			),
		).toThrow();
	});
});
