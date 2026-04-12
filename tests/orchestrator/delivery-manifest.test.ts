import { describe, expect, test } from "bun:test";
import {
	createDeliveryManifest,
	renderDeliveryPrBody,
	renderDeliveryPrTitle,
} from "../../src/orchestrator/delivery-manifest";
import { initBranchLifecycle } from "../../src/orchestrator/handlers/branch-pr";
import { createInitialState } from "../../src/orchestrator/state";
import type { PipelineState } from "../../src/orchestrator/types";

function createShipState(): PipelineState {
	const baseState = createInitialState(
		"delivery manifest, commit strategy, and CI verification gates",
	);
	return {
		...baseState,
		currentPhase: "SHIP",
		tasks: [
			{
				id: 1,
				title: "Add delivery manifest generation",
				status: "DONE",
				wave: 1,
				depends_on: [],
				attempt: 0,
				strike: 0,
			},
			{
				id: 2,
				title: "Block ship on failed CI checks",
				status: "DONE",
				wave: 1,
				depends_on: [1],
				attempt: 0,
				strike: 0,
			},
		],
		branchLifecycle: {
			...initBranchLifecycle({
				runId: baseState.runId,
				baseBranch: "main",
				description: baseState.idea,
			}),
			tasksPushed: ["1", "2"],
			reviewSummary: "APPROVED — review completed with no tranche blockers.",
			oracleSummary: "PASS_WITH_NEXT_TRANCHE — oracle approved delivery with a follow-up tranche.",
		},
	};
}

describe("delivery manifest", () => {
	test("creates a bounded human-readable branch name and per-task commit plan", () => {
		const state = createShipState();
		const manifest = createDeliveryManifest({ state });

		expect(manifest.branchName).toMatch(/^autopilot\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/);
		for (const segment of manifest.branchName.split("/").slice(1)) {
			expect(segment.length).toBeLessThanOrEqual(40);
		}
		expect(manifest.commitPlan.policy).toBe("per_task");
		expect(manifest.commitPlan.items).toHaveLength(2);
		expect(manifest.commitPlan.summary).toContain("per task");
	});

	test("renders PR title and body from the manifest", () => {
		const state = createShipState();
		const manifest = createDeliveryManifest({
			state,
			verificationSummary: {
				status: "PASSED",
				summary: "Required local verification and GitHub CI checks passed.",
				localSummary: "Verification PASSED: 2 PASSED.",
				ciSummary: "All required GitHub checks passed (2 total).",
			},
		});

		const title = renderDeliveryPrTitle(manifest);
		const body = renderDeliveryPrBody(manifest);

		expect(title).toBe(manifest.humanTitle);
		expect(body).toContain("## Scope");
		expect(body).toContain("## Review Summary");
		expect(body).toContain("## Oracle Verdict");
		expect(body).toContain("## Verification Summary");
		expect(body).toContain("## Remaining Work");
		expect(body).toContain("Commit policy");
	});

	test("prefers program context identity over lifecycle-derived ids", () => {
		const state = createShipState();
		const manifest = createDeliveryManifest({
			state: {
				...state,
				programContext: {
					programId: "program_context_id",
					trancheId: "tranche_context_id",
					trancheTitle: "Context tranche",
					trancheIndex: 1,
					trancheCount: 2,
					selectionRationale: "Selected by program context.",
					originatingRequest: "Ship the program.",
					mode: "autonomous",
				},
				branchLifecycle: state.branchLifecycle
					? {
							...state.branchLifecycle,
							programId: "derived_program_id",
							trancheId: "derived_tranche_id",
							currentBranch: "autopilot/derived-program-id/derived-tranche-id/delivery",
						}
					: null,
			},
		});

		expect(manifest.programId).toBe("program_context_id");
		expect(manifest.trancheId).toBe("tranche_context_id");
		expect(manifest.branchName).toContain("program-context-id");
		expect(manifest.branchName).toContain("tranche-context");
	});
});
