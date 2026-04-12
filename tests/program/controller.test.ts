import { describe, expect, test } from "bun:test";
import {
	advanceProgramToNextTranche,
	blockProgramRun,
	buildPipelineIdeaForTranche,
	getCurrentTranche,
	markCurrentTrancheShipped,
	planProgramRunFromRequest,
} from "../../src/program";

describe("program controller", () => {
	test("returns null for narrow single-tranche requests", () => {
		const program = planProgramRunFromRequest("Add dark mode to settings", "normal");
		expect(program).toBeNull();
	});

	test("creates an autonomous multi-tranche program from a broad request", () => {
		const program = planProgramRunFromRequest(
			[
				"Implement the remediation program:",
				"1. Add program and tranche persistence.",
				"2. Add autonomous tranche planning heuristics.",
				"3. Continue automatically across multiple PRs.",
				"Acceptance criteria:",
				"- The first tranche starts automatically.",
			].join("\n"),
			"strict",
		);

		expect(program).not.toBeNull();
		expect(program?.status).toBe("ACTIVE");
		expect(program?.tranches.length).toBeGreaterThan(1);
		expect(program?.tranches[0]?.status).toBe("IN_PROGRESS");
		expect(program?.tranches[1]?.status).toBe("PENDING");
		expect(program?.successCriteria).toContain("The first tranche starts automatically");

		const currentTranche = program ? getCurrentTranche(program) : null;
		expect(currentTranche?.selectionRationale).toContain("Selected automatically");
		expect(buildPipelineIdeaForTranche(program!, currentTranche!)).toContain("Program tranche 1/");
	});

	test("uses executionMode as the authoritative runtime mode input", () => {
		const program = planProgramRunFromRequest(
			[
				"Implement the remediation program:",
				"1. Add program persistence.",
				"2. Continue automatically across multiple tranches.",
			].join("\n"),
			"normal",
			{ executionMode: "foreground" },
		);

		expect(program).not.toBeNull();
		expect(program?.mode).toBe("interactive");
	});

	test("queues the next tranche after a successful ship", () => {
		const program = planProgramRunFromRequest(
			["Remediation program:", "1. Persist program state.", "2. Continue automatically."].join(
				"\n",
			),
			"normal",
		);
		if (!program) {
			throw new Error("Expected program planning to produce a multi-tranche run");
		}

		const shipped = markCurrentTrancheShipped(program, "manifest_run_1");
		expect(shipped.tranches[0]?.status).toBe("SHIPPED");
		expect(shipped.tranches[0]?.deliveryManifestId).toBe("manifest_run_1");
		expect(shipped.tranches[1]?.status).toBe("QUEUED");
	});

	test("advances from the completed tranche to the next queued tranche", () => {
		const program = planProgramRunFromRequest(
			["Remediation program:", "1. Persist program state.", "2. Continue automatically."].join(
				"\n",
			),
			"normal",
		);
		if (!program) {
			throw new Error("Expected program planning to produce a multi-tranche run");
		}

		const advanced = advanceProgramToNextTranche(
			markCurrentTrancheShipped(program, "manifest_run_1"),
		);
		expect(advanced.tranches[0]?.status).toBe("COMPLETED");
		expect(advanced.tranches[1]?.status).toBe("IN_PROGRESS");
		expect(advanced.currentTrancheId).toBe(advanced.tranches[1]?.trancheId ?? null);
	});

	test("classifies terminal program stops as blocked", () => {
		const program = planProgramRunFromRequest(
			["Remediation program:", "1. Persist program state.", "2. Continue automatically."].join(
				"\n",
			),
			"normal",
		);
		if (!program) {
			throw new Error("Expected program planning to produce a multi-tranche run");
		}

		const blocked = blockProgramRun(
			program,
			"All remaining tasks are BLOCKED",
			program.currentTrancheId ?? undefined,
		);
		expect(blocked.status).toBe("BLOCKED");
		expect(blocked.blockedReason).toContain("BLOCKED");
		expect(blocked.tranches[0]?.status).toBe("BLOCKED");
	});
});
