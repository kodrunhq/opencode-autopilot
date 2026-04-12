import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryCaptureHandler } from "../../src/memory/capture";
import { initMemoryDb } from "../../src/memory/database";
import { getPhaseDir } from "../../src/orchestrator/artifacts";
import { orchestrateCore } from "../../src/tools/orchestrate";

describe("Full Pipeline Concurrency", () => {
	let tempDir: string;
	let memoryDb: Database;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "pipeline-concurrency-"));
		memoryDb = new Database(":memory:");
		initMemoryDb(memoryDb);

		await mkdir(join(tempDir, ".opencode"), { recursive: true });
		await writeFile(
			join(tempDir, ".opencode", "opencode-autopilot.json"),
			JSON.stringify({
				orchestrator: {
					verification: "lenient",
				},
				verification: {
					commandChecks: [
						{ name: "tests", command: "echo 'tests passed'" },
						{ name: "lint", command: "echo 'lint passed'" },
					],
				},
			}),
		);
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
		let pendingResultKind: string | null = null;
		while (result.action !== "complete" && limit > 0) {
			const currentPhase = result.phase;

			if (result.action === "dispatch" && result.resultKind) {
				pendingResultKind = result.resultKind;
			}

			if (currentPhase) {
				const phaseDir = getPhaseDir(tempDir, currentPhase, result.runId);
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
					await writeFile(join(phaseDir, "changelog.md"), "# Changelog\ntest changelog");
					await writeFile(join(phaseDir, "decisions.md"), "# Decisions\ntest decisions");
				} else if (currentPhase === "BUILD") {
				}
			}

			let resultKind: string;
			if (pendingResultKind) {
				resultKind = pendingResultKind;
				pendingResultKind = null;
			} else {
				resultKind = currentPhase === "BUILD" ? "task_completion" : "phase_output";
			}

			let payloadText: string;
			if (resultKind === "oracle_signoff") {
				const signoffIdMatch = result.prompt?.match(/Use id="([^"]+)" on the <oracle-signoff> tag/);
				const inputsDigestMatch = result.prompt?.match(
					/Echo signoffId=[^\s]+ and inputsDigest=([^\s]+) exactly/,
				);
				const signoffId = signoffIdMatch?.[1] ?? "test-signoff-id";
				const inputsDigest = inputsDigestMatch?.[1] ?? "test-digest";
				const signoffPayload = {
					signoffId,
					scope: "TRANCHE",
					inputsDigest,
					verdict: "PASS",
					reasoning: "Test signoff for concurrent pipeline test",
					blockingConditions: [],
				};
				payloadText = `<oracle-signoff id="${signoffId}">\n${JSON.stringify(signoffPayload, null, 2)}\n</oracle-signoff>`;
			} else if (resultKind === "review_findings") {
				const reviewRunIdMatch = result.prompt?.match(/"reviewRunId":\s*"([^"]+)"/);
				const reviewRunId = reviewRunIdMatch?.[1] ?? `review_${Date.now()}`;
				const now = new Date().toISOString();
				const reviewResponse = {
					action: "complete",
					reviewRunId,
					reviewRun: {
						reviewRunId,
						runId: result.runId ?? null,
						trancheId: result.runId ?? null,
						scope: "branch",
						status: "PASSED",
						verdict: "CLEAN",
						policy: {
							requiredReviewers: [],
							blockingSeverityThreshold: "HIGH",
							allowedWaivers: [],
						},
						selectedReviewers: [],
						reviewers: [],
						findings: [],
						findingsSummary: {
							CRITICAL: 0,
							HIGH: 0,
							MEDIUM: 0,
							LOW: 0,
							open: 0,
							accepted: 0,
							fixed: 0,
							blockingOpen: 0,
						},
						summary: "No findings. Verdict: CLEAN.",
						blockedReason: null,
						startedAt: now,
						completedAt: now,
					},
					reviewStatus: {
						reviewRunId,
						trancheId: result.runId ?? null,
						scope: "branch",
						status: "PASSED",
						verdict: "CLEAN",
						blockingSeverityThreshold: "HIGH",
						selectedReviewers: [],
						requiredReviewers: [],
						missingRequiredReviewers: [],
						reviewers: [],
						findingsSummary: {
							CRITICAL: 0,
							HIGH: 0,
							MEDIUM: 0,
							LOW: 0,
							open: 0,
							accepted: 0,
							fixed: 0,
							blockingOpen: 0,
						},
						summary: "No findings. Verdict: CLEAN.",
						blockedReason: null,
						startedAt: now,
						completedAt: now,
					},
				};
				payloadText = JSON.stringify(reviewResponse);
			} else if (currentPhase === "SHIP") {
				payloadText = `Completed SHIP. Created PR: https://github.com/test/repo/pull/1`;
			} else {
				payloadText = `Completed ${currentPhase}`;
			}

			const envelope = {
				schemaVersion: 1,
				resultId: `res-${currentPhase}-${Date.now()}-${limit}`,
				runId: result.runId || "unknown",
				phase: currentPhase,
				dispatchId: result.dispatchId || "unknown",
				agent: result.agent || "test-agent",
				kind: resultKind,
				taskId: resultKind === "task_completion" ? 1 : null,
				payload: {
					text: payloadText,
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
				const isShipError = result.code?.startsWith("E_SHIP_") || result.phase === "SHIP";
				if (isShipError) {
					break;
				}
				throw new Error(result.message);
			}

			limit--;
		}

		expect(result.action === "complete" || result.phase === "SHIP").toBe(true);

		isRunning = false;
		const errorCount = await backgroundErrors;

		expect(errorCount).toBeGreaterThan(0);
		const dbCount = memoryDb.query("SELECT COUNT(*) as count FROM observations").get() as {
			count: number;
		};
		expect(dbCount.count).toBe(errorCount);
	});
});
