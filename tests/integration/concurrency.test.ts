import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryCaptureHandler } from "../../src/memory/capture";
import { initMemoryDb } from "../../src/memory/database";
import { orchestrateCore } from "../../src/tools/orchestrate";

describe("Full Pipeline Concurrency", () => {
	let tempDir: string;
	let memoryDb: Database;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "pipeline-concurrency-"));
		memoryDb = new Database(":memory:");
		initMemoryDb(memoryDb);
	});

	afterEach(async () => {
		if (memoryDb) memoryDb.close();
		await rm(tempDir, { recursive: true, force: true });
	});

	it("runs the full pipeline under concurrent load", async () => {
		let resultStr = await orchestrateCore(
			{ idea: "concurrency test", intent: "implementation" },
			tempDir,
		);
		let result = JSON.parse(resultStr);

		expect(result.action).toBe("dispatch");
		expect(result.phase).toBe("RECON");

		const captureHandler = createMemoryCaptureHandler({
			getDb: () => memoryDb,
			projectRoot: tempDir,
		});

		await captureHandler({
			event: {
				type: "session.created",
				properties: {
					info: { id: "bg-session" },
				},
			},
		});

		let isRunning = true;

		const backgroundErrors = (async () => {
			let count = 0;
			while (isRunning) {
				await captureHandler({
					event: {
						type: "session.error",
						properties: {
							sessionID: "bg-session",
							error: new Error(`Background error ${count++}`),
						},
					},
				});
				await new Promise((resolve) => setTimeout(resolve, 5));
			}
			return count;
		})();

		let limit = 20;
		while (result.action !== "complete" && limit > 0) {
			const currentPhase = result.phase;

			if (currentPhase) {
				const phaseDir = join(tempDir, "phases", currentPhase);
				try {
					await mkdir(phaseDir, { recursive: true });
				} catch (_e) {}

				if (currentPhase === "ARCHITECT") {
					await writeFile(join(phaseDir, "design.md"), "test design");
				} else if (currentPhase === "RECON") {
					await writeFile(join(phaseDir, "report.md"), "# Report\ntest report");
				} else if (currentPhase === "CHALLENGE") {
					await writeFile(join(phaseDir, "brief.md"), "# Brief\ntest brief");
				} else if (currentPhase === "PLAN") {
					await writeFile(
						join(phaseDir, "tasks.json"),
						JSON.stringify({
							schemaVersion: 1,
							tasks: [{ taskId: "W1-T01", title: "Task 1", wave: 1, depends_on: [] }],
						}),
					);
					await writeFile(join(phaseDir, "tasks.md"), "test tasks");
				} else if (currentPhase === "SHIP") {
					await writeFile(join(phaseDir, "walkthrough.md"), "# Walkthrough\ntest walkthrough");
				} else if (currentPhase === "BUILD") {
				}
			}

			const envelope = {
				schemaVersion: 1,
				resultId: `res-${currentPhase}-${Date.now()}-${limit}`,
				runId: result.runId || "unknown",
				phase: currentPhase,
				dispatchId: result.dispatchId || "unknown",
				agent: result.agent || "test-agent",
				kind: currentPhase === "BUILD" ? "task_completion" : "phase_output",
				taskId: currentPhase === "BUILD" ? 1 : null,
				payload: {
					text: `Completed ${currentPhase}`,
				},
			};

			resultStr = await orchestrateCore(
				{
					result: JSON.stringify(envelope),
				},
				tempDir,
			);
			result = JSON.parse(resultStr);

			if (result.action === "error") {
				throw new Error(result.message);
			}

			limit--;
		}

		expect(result.action).toBe("complete");

		isRunning = false;
		const errorCount = await backgroundErrors;

		expect(errorCount).toBeGreaterThan(0);
		const dbCount = memoryDb.query("SELECT COUNT(*) as count FROM observations").get() as {
			count: number;
		};
		expect(dbCount.count).toBe(errorCount);
	});
});
