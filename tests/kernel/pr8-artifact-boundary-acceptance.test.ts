import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openProjectKernelDb } from "../../src/kernel/database";
import { createInitialState, saveState } from "../../src/orchestrator/state";
import { planProgramRunFromRequest, saveProgramRunToKernel } from "../../src/program";
import { reviewCore } from "../../src/tools/review";
import {
	getProjectArtifactDir,
	inspectProjectArtifactState,
	listProjectRootAutopilotArtifacts,
} from "../../src/utils/paths";

describe("PR-8 acceptance — artifact boundary", () => {
	let projectRoot = "";

	beforeEach(async () => {
		projectRoot = await mkdtemp(join(tmpdir(), "pr8-artifact-boundary-"));
		await writeFile(
			join(projectRoot, "package.json"),
			JSON.stringify({ name: "pr8-artifact-boundary" }),
			"utf-8",
		);
	});

	afterEach(async () => {
		await rm(projectRoot, { recursive: true, force: true });
	});

	test("matrix 1: runtime artifacts never escape the project artifact boundary", async () => {
		const artifactDir = getProjectArtifactDir(projectRoot);
		const database = openProjectKernelDb(projectRoot);
		database.close();

		await saveState(createInitialState("Verify runtime artifact placement"), artifactDir);

		const program = planProgramRunFromRequest(
			[
				"Acceptance harness program:",
				"1. Persist structured program state.",
				"2. Run structured review.",
			].join("\n"),
			"strict",
		);
		if (program === null) {
			throw new Error("Expected a broad request to create a persisted program run");
		}
		saveProgramRunToKernel(artifactDir, program);

		await reviewCore(
			{
				scope: "all",
				selectedReviewers: ["logic-auditor"],
				requiredReviewers: ["logic-auditor"],
			},
			projectRoot,
		);

		const artifactState = inspectProjectArtifactState(projectRoot);
		expect(artifactState.issues).toEqual([]);
		expect(listProjectRootAutopilotArtifacts(projectRoot)).toEqual([]);

		expect(existsSync(join(projectRoot, "kernel.db"))).toBe(false);
		expect(existsSync(join(projectRoot, "kernel.db-wal"))).toBe(false);
		expect(existsSync(join(projectRoot, "kernel.db-shm"))).toBe(false);
		expect(existsSync(join(projectRoot, "state.json"))).toBe(false);
		expect(existsSync(join(projectRoot, "current-review.json"))).toBe(false);

		expect(existsSync(join(artifactDir, "kernel.db"))).toBe(true);
		expect(existsSync(join(artifactDir, "state.json"))).toBe(true);
		expect(existsSync(join(artifactDir, "current-review.json"))).toBe(true);
	});
});
