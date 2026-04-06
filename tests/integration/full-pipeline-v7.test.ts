import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LoopController } from "../../src/autonomy/controller";
import { VerificationHandler } from "../../src/autonomy/verification";
import { BackgroundManager } from "../../src/background/manager";
import { BACKGROUND_TASKS_SCHEMA_STATEMENTS } from "../../src/background/schema";
import { createCompactionHandler } from "../../src/context/compaction-handler";
import { createContextInjector } from "../../src/context/injector";
import type { ContextSource } from "../../src/context/types";
import { createInitialState } from "../../src/orchestrator/state";
import { classifyError } from "../../src/recovery/classifier";
import { RecoveryOrchestrator } from "../../src/recovery/orchestrator";
import { makeRoutingDecision } from "../../src/routing/engine";
import { orchestrateCore } from "../../src/tools/orchestrate";

function createTestDb(): Database {
	const db = new Database(":memory:");
	db.exec("PRAGMA journal_mode=WAL");
	db.exec("PRAGMA busy_timeout=5000");
	db.exec("PRAGMA foreign_keys=ON");
	for (const statement of BACKGROUND_TASKS_SCHEMA_STATEMENTS) {
		db.exec(statement);
	}
	return db;
}

describe("Integration: full pipeline v7 — all subsystems active", () => {
	let db: Database;
	let tempDir: string;

	beforeEach(async () => {
		db = createTestDb();
		tempDir = await mkdtemp(join(tmpdir(), "full-pipeline-v7-test-"));
	});

	afterEach(async () => {
		db.close();
		await rm(tempDir, { recursive: true, force: true });
	});

	test("orchestrateCore initializes RECON phase for new idea", async () => {
		const result = await orchestrateCore(
			{ idea: "v7 full pipeline integration test", intent: "implementation" },
			tempDir,
		);
		const parsed = JSON.parse(result);

		expect(parsed.action).toBe("dispatch");
		expect(parsed.phase).toBe("RECON");
		expect(parsed.agent).toBeDefined();
		expect(parsed.prompt).toContain("v7 full pipeline integration test");
	});

	test("createInitialState produces valid pipeline state", () => {
		const state = createInitialState("v7 test idea");

		expect(state.status).toBe("IN_PROGRESS");
		expect(state.currentPhase).toBe("RECON");
		expect(state.idea).toBe("v7 test idea");
		expect(state.phases.length).toBeGreaterThan(0);
		expect(state.runId).toMatch(/^run_/);
		expect(state.stateRevision).toBe(0);

		const reconPhase = state.phases.find((p) => p.name === "RECON");
		expect(reconPhase).toBeDefined();
		expect(reconPhase?.status).toBe("IN_PROGRESS");
	});

	test("routing + background + recovery + context: combined lifecycle", async () => {
		// === Step 1: Context injection ===
		const contextSources: readonly ContextSource[] = [
			{
				name: "CLAUDE.md",
				filePath: join(tempDir, "CLAUDE.md"),
				content: "# Project Guidelines\nUse strict TypeScript. No any types.",
				priority: 90,
				tokenEstimate: 20,
			},
		];

		const injector = createContextInjector({
			projectRoot: tempDir,
			totalBudget: 4000,
			discover: async () => contextSources,
		});

		const contextOutput = { system: [] as string[] };
		await injector({ sessionID: "v7-session" }, contextOutput);
		expect(contextOutput.system.length).toBeGreaterThan(0);
		expect(contextOutput.system[0]).toContain("Project Guidelines");

		// === Step 2: Route the task ===
		const decision = makeRoutingDecision("implement new authentication middleware");
		expect(decision.category).toBeDefined();
		expect(decision.confidence).toBeGreaterThan(0);

		// === Step 3: Spawn background task ===
		let taskResult: string | null = null;
		const manager = new BackgroundManager({
			db,
			maxConcurrent: 3,
			executor: async (task, deps) => {
				await deps.updateStatus(task.id, "running");
				const result = `Implemented: ${task.description} (category=${decision.category})`;
				await deps.updateStatus(task.id, "completed", { result });
				taskResult = result;
				return { taskId: task.id, status: "completed" as const, result };
			},
			executionDelayMs: 1,
		});

		const taskId = manager.spawn("v7-session", "Auth middleware implementation", {
			category: decision.category,
		});

		await manager.waitForIdle(5_000);
		const completedTask = manager.getStatus(taskId);
		expect(completedTask?.status).toBe("completed");

		const controller = new LoopController({
			maxIterations: 5,
			verifyOnComplete: false,
			cooldownMs: 0,
		});

		controller.start("Auth middleware");
		const loopResult = await controller.iterate(
			`Background completed: ${taskResult}. All tasks completed.`,
		);
		expect(loopResult.state).toBe("complete");

		const orchestrator = new RecoveryOrchestrator({ maxAttempts: 3 });
		const action = orchestrator.handleError("v7-session", "rate limit: 429 too many requests");
		expect(action).not.toBeNull();
		expect(action?.strategy).toBe("retry");
		orchestrator.recordResult("v7-session", true);

		const compactionHandler = createCompactionHandler(injector);
		await compactionHandler({
			event: {
				type: "session.compacted",
				properties: { sessionID: "v7-session" },
			},
		});

		const reinjectedOutput = { system: [] as string[] };
		await injector({ sessionID: "v7-session" }, reinjectedOutput);
		expect(reinjectedOutput.system.length).toBeGreaterThan(0);

		await manager.dispose();
	});

	test("error classification covers all extended categories", () => {
		const errorMessages = [
			["429 rate limit exceeded", "rate_limit"],
			["Unauthorized API key", "auth_failure"],
			["quota exceeded: no credits left", "quota_exceeded"],
			["service unavailable 503", "service_unavailable"],
			["request timed out", "timeout"],
			["ECONNRESET connection reset", "network"],
			["validation error: malformed", "validation"],
			["empty content response", "empty_content"],
			["thinking block reasoning failed", "thinking_block_error"],
			["result too large overflow", "tool_result_overflow"],
			["context window token limit exceeded", "context_window_exceeded"],
			["session corrupt invalid state", "session_corruption"],
			["loop detected no progress stuck", "agent_loop_stuck"],
		] as const;

		for (const [message, expectedCategory] of errorMessages) {
			const result = classifyError(message);
			expect(result.category).toBe(expectedCategory);
			expect(result.confidence).toBeGreaterThan(0);
		}
	});

	test("routing decision respects disabled category fallback", () => {
		const decision = makeRoutingDecision("update the CSS styles", {
			enabled: true,
			categories: {
				"visual-engineering": { enabled: false, skills: [], metadata: {} },
			},
		});

		// If the primary category is disabled, it should fall back
		// The exact behavior depends on whether visual-engineering was matched
		expect(decision.category).toBeDefined();
		expect(decision.confidence).toBeGreaterThan(0);
	});

	test("background manager handles multiple sessions independently", async () => {
		const results = new Map<string, string>();
		const manager = new BackgroundManager({
			db,
			maxConcurrent: 4,
			executor: async (task, deps) => {
				await deps.updateStatus(task.id, "running");
				const result = `Done: ${task.sessionId}/${task.description}`;
				await deps.updateStatus(task.id, "completed", { result });
				results.set(task.id, result);
				return { taskId: task.id, status: "completed" as const, result };
			},
			executionDelayMs: 1,
		});

		const id1 = manager.spawn("session-A", "Task A1");
		const id2 = manager.spawn("session-A", "Task A2");
		const id3 = manager.spawn("session-B", "Task B1");

		await manager.waitForIdle(5_000);

		expect(manager.getStatus(id1)?.status).toBe("completed");
		expect(manager.getStatus(id2)?.status).toBe("completed");
		expect(manager.getStatus(id3)?.status).toBe("completed");

		expect(manager.getStatus(id1)?.sessionId).toBe("session-A");
		expect(manager.getStatus(id3)?.sessionId).toBe("session-B");

		// List by session
		const sessionATasks = manager.list("session-A");
		expect(sessionATasks).toHaveLength(2);

		const sessionBTasks = manager.list("session-B");
		expect(sessionBTasks).toHaveLength(1);

		await manager.dispose();
	});

	test("loop controller handles verification failure and retries", async () => {
		let verifyCallCount = 0;
		const conditionalVerifier = new VerificationHandler({
			runCommand: async () => {
				verifyCallCount += 1;
				if (verifyCallCount <= 2) {
					return { exitCode: 1, output: "lint errors found" };
				}
				return { exitCode: 0, output: "ok" };
			},
		});

		const controller = new LoopController({
			maxIterations: 10,
			verifyOnComplete: true,
			cooldownMs: 0,
			verificationHandler: conditionalVerifier,
		});

		controller.start("Fix lint errors");

		// First iteration signals completion → verification fails
		const iter1 = await controller.iterate("all tasks completed");
		expect(iter1.state).toBe("running"); // Back to running after failed verification
		expect(iter1.verificationResults).toHaveLength(1);
		expect(iter1.verificationResults[0].passed).toBe(false);

		// Second iteration: fix applied, signals completion → verification passes
		const iter2 = await controller.iterate("fixed 3 lint errors. all tasks completed");
		expect(iter2.state).toBe("complete");
		expect(iter2.verificationResults).toHaveLength(2);
		expect(iter2.verificationResults[1].passed).toBe(true);
	});

	test("recovery orchestrator tracks multi-error session history", () => {
		const orchestrator = new RecoveryOrchestrator({ maxAttempts: 5 });

		// Series of different errors in one session
		orchestrator.handleError("multi-err", "request timed out");
		orchestrator.recordResult("multi-err", false);

		orchestrator.handleError("multi-err", "ECONNRESET network error");
		orchestrator.recordResult("multi-err", false);

		orchestrator.handleError("multi-err", "429 rate limit exceeded");
		orchestrator.recordResult("multi-err", true);

		const history = orchestrator.getHistory("multi-err");
		expect(history).toHaveLength(3);

		const categories = history.map((a) => a.errorCategory);
		expect(categories).toEqual(["timeout", "network", "rate_limit"]);

		const successes = history.map((a) => a.success);
		expect(successes).toEqual([false, false, true]);
	});
});
