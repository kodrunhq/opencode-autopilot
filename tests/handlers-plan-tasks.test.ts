import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handlePlan } from "../src/orchestrator/handlers/plan";
import { pipelineStateSchema } from "../src/orchestrator/schemas";
import type { PipelineState } from "../src/orchestrator/types";
import { ensureDir } from "../src/utils/fs-helpers";

function makeState(overrides: Partial<PipelineState> = {}): PipelineState {
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

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
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

		const jsonRaw = await readFile(join(tempDir, "phases", "PLAN", "tasks.json"), "utf-8");
		const parsed = JSON.parse(jsonRaw) as {
			schemaVersion: number;
			tasks: Array<{ taskId: string; title: string; wave: number; depends_on: string[] }>;
		};
		expect(parsed.schemaVersion).toBe(1);
		expect(parsed.tasks).toHaveLength(3);
		expect(parsed.tasks[0]).toMatchObject({
			taskId: "W1-T01",
			title: "Add v1 API schemas",
			wave: 1,
			depends_on: [],
		});
		expect(parsed.tasks[2]).toMatchObject({
			taskId: "W2-T01",
			title: "Build repositories",
			wave: 2,
			depends_on: [],
		});
	});

	test("loads tasks from tasks.json and writes derived tasks.md", async () => {
		const tasksJson = {
			schemaVersion: 1,
			tasks: [
				{ taskId: "W1-T01", title: "Seed DB schema", wave: 1, depends_on: [] },
				{ taskId: "W2-T01", title: "Add repositories", wave: 2, depends_on: ["W1-T01"] },
			],
		};

		await writeFile(join(tempDir, "phases", "ARCHITECT", "design.md"), "# Architecture");
		await writeFile(join(tempDir, "phases", "CHALLENGE", "brief.md"), "# Challenge");
		await writeFile(
			join(tempDir, "phases", "PLAN", "tasks.json"),
			JSON.stringify(tasksJson, null, 2),
			"utf-8",
		);

		const state = makeState({ currentPhase: "PLAN" });
		const result = await handlePlan(state, tempDir, "tasks written");

		expect(result.action).toBe("complete");
		expect(result._stateUpdates?.tasks?.length).toBe(2);
		expect(result._stateUpdates?.tasks?.[1]).toMatchObject({
			id: 2,
			title: "Add repositories",
			depends_on: [1],
		});

		const markdown = await readFile(join(tempDir, "phases", "PLAN", "tasks.md"), "utf-8");
		expect(markdown).toContain("| W1-T01 | Seed DB schema");
		expect(markdown).toContain("| W2-T01 | Add repositories");
	});

	test("accepts markdown table rows without trailing boundary pipe", async () => {
		const tasksMd = `# Implementation Task Plan

## Task Table

| Task ID | Title | Description | Files to Modify | Wave Number | Acceptance Criteria
|---|---|---|---|---:|---
| W1-T01 | Add v1 API schemas | Pydantic models | api/schemas.py | 1 | pytest passes
| W1-T02 | Extend ORM models | SQLAlchemy | models/db.py | 1 | pytest passes
`;

		await writeFile(join(tempDir, "phases", "ARCHITECT", "design.md"), "# Architecture");
		await writeFile(join(tempDir, "phases", "CHALLENGE", "brief.md"), "# Challenge");
		await writeFile(join(tempDir, "phases", "PLAN", "tasks.md"), tasksMd);

		const state = makeState({ currentPhase: "PLAN" });
		const result = await handlePlan(state, tempDir, "tasks written");

		expect(result.action).toBe("complete");
		expect(result._stateUpdates?.tasks?.length).toBe(2);
		expect(result._stateUpdates?.tasks?.[1]).toMatchObject({
			id: 2,
			title: "Extend ORM models",
			wave: 1,
			status: "PENDING",
		});
	});

	test("returns error when tasks.md is missing", async () => {
		// Create ARCHITECT and CHALLENGE artifacts but no tasks.md
		await writeFile(join(tempDir, "phases", "ARCHITECT", "design.md"), "# Architecture");
		await writeFile(join(tempDir, "phases", "CHALLENGE", "brief.md"), "# Challenge");

		const state = makeState({ currentPhase: "PLAN" });
		const result = await handlePlan(state, tempDir, "tasks written");

		expect(result.action).toBe("error");
		expect(result.phase).toBe("PLAN");
		expect(result.message).toContain("Failed to load PLAN tasks");
		expect(result.message).toContain("tasks.md not found");
	});

	test("skips malformed rows and keeps sequential IDs", async () => {
		const tasksMd = `# Implementation Task Plan

## Task Table

| Task ID | Title | Description | Files to Modify | Wave Number | Acceptance Criteria |
|---|---|---|---|---:|---|
| W1-T01 | First valid task | desc | a.ts | 1 | ok |
| NotATaskId | malformed row | desc | a.ts | 1 | bad |
| W2-T01 | Second valid task | desc | b.ts | 2 | ok |
`;

		await writeFile(join(tempDir, "phases", "ARCHITECT", "design.md"), "# Architecture");
		await writeFile(join(tempDir, "phases", "CHALLENGE", "brief.md"), "# Challenge");
		await writeFile(join(tempDir, "phases", "PLAN", "tasks.md"), tasksMd);

		const state = makeState({ currentPhase: "PLAN" });
		const result = await handlePlan(state, tempDir, "tasks written");

		expect(result.action).toBe("complete");
		expect(result._stateUpdates?.tasks?.length).toBe(2);
		expect(result._stateUpdates?.tasks?.[0]?.id).toBe(1);
		expect(result._stateUpdates?.tasks?.[1]?.id).toBe(2);
	});
});
