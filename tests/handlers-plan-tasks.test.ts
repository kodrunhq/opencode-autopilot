import { beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handlePlan } from "../src/orchestrator/handlers/plan";
import { pipelineStateSchema } from "../src/orchestrator/schemas";
import { ensureDir } from "../src/utils/fs-helpers";

function makeState(overrides = {}): any {
	const now = new Date().toISOString();
	return pipelineStateSchema.parse({
		schemaVersion: 2,
		status: "IN_PROGRESS",
		idea: "test idea",
		currentPhase: "PLAN",
		startedAt: now,
		lastUpdatedAt: now,
		phases: [
			{ name: "RECON", status: "DONE" },
			{ name: "CHALLENGE", status: "DONE" },
			{ name: "ARCHITECT", status: "DONE" },
			{ name: "EXPLORE", status: "SKIPPED" },
			{ name: "PLAN", status: "IN_PROGRESS" },
			{ name: "BUILD", status: "PENDING" },
			{ name: "SHIP", status: "PENDING" },
			{ name: "RETROSPECTIVE", status: "PENDING" },
		],
		...overrides,
	});
}

describe("handlePlan task loading", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "test-plan-"));
		// Create required phase directories
		await ensureDir(join(tempDir, "phases", "ARCHITECT"));
		await ensureDir(join(tempDir, "phases", "CHALLENGE"));
		await ensureDir(join(tempDir, "phases", "PLAN"));
	});

	test("loads tasks from markdown when result provided", async () => {
		// Create mock tasks.md
		const tasksMd = `# Implementation Task Plan

## Task Table

| Task ID | Title | Description | Files to Modify | Wave Number | Acceptance Criteria |
|---|---|---|---|---:|---|
| W1-T01 | Add v1 API schemas | Pydantic models | api/schemas.py | 1 | pytest passes |
| W1-T02 | Extend ORM models | SQLAlchemy | models/db.py | 1 | pytest passes |
| W2-T01 | Build repositories | DAL | repos/portfolio.py | 2 | pytest passes |
`;

		// Create ARCHITECT and CHALLENGE artifacts (required by handler)
		await writeFile(join(tempDir, "phases", "ARCHITECT", "design.md"), "# Architecture");
		await writeFile(join(tempDir, "phases", "CHALLENGE", "brief.md"), "# Challenge");
		await writeFile(join(tempDir, "phases", "PLAN", "tasks.md"), tasksMd);

		const state = makeState({ currentPhase: "PLAN" });
		const result = await handlePlan(state, tempDir, "tasks written");

		expect(result.action).toBe("complete");
		expect(result._stateUpdates?.tasks).toBeDefined();
		expect(result._stateUpdates?.tasks?.length).toBe(3);
		expect(result._stateUpdates?.tasks?.[0]).toMatchObject({
			id: 1,
			title: "Add v1 API schemas",
			wave: 1,
			status: "PENDING",
		});
		expect(result._stateUpdates?.tasks?.[2]).toMatchObject({
			id: 3,
			title: "Build repositories",
			wave: 2,
			status: "PENDING",
		});
	});

	test("handles missing tasks.md gracefully", async () => {
		// Create ARCHITECT and CHALLENGE artifacts but no tasks.md
		await writeFile(join(tempDir, "phases", "ARCHITECT", "design.md"), "# Architecture");
		await writeFile(join(tempDir, "phases", "CHALLENGE", "brief.md"), "# Challenge");

		const state = makeState({ currentPhase: "PLAN" });
		const result = await handlePlan(state, tempDir, "tasks written");

		expect(result.action).toBe("complete");
		expect(result._stateUpdates?.tasks).toEqual([]);
	});
});
