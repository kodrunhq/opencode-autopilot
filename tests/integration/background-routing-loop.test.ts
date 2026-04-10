import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { LoopController } from "../../src/autonomy/controller";
import type { OracleBridge } from "../../src/autonomy/oracle-bridge";
import { VerificationHandler } from "../../src/autonomy/verification";
import { BackgroundManager } from "../../src/background/manager";
import { BACKGROUND_TASKS_SCHEMA_STATEMENTS } from "../../src/background/schema";
import { classifyTask } from "../../src/routing/classifier";
import { makeRoutingDecision } from "../../src/routing/engine";

const immediateOracleBridge: OracleBridge = {
	async requestOracleConsultation(request) {
		return {
			sessionId: "oracle-session-integration",
			attemptId: "oracle-attempt-integration",
			parentSessionId: request.parentSessionId ?? "missing-parent",
		};
	},
	async checkOracleResult() {
		return {
			status: "verified",
			summary: "Oracle approved the completion.",
			rawEvidence:
				"<promise>VERIFIED</promise>\nVERDICT: VERIFIED\nSUMMARY: Oracle approved the completion.",
			attemptId: "oracle-attempt-integration",
		};
	},
};

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

describe("Integration: background + routing + loop lifecycle", () => {
	let db: Database;

	beforeEach(() => {
		db = createTestDb();
	});

	afterEach(() => {
		db.close();
	});

	test("classify → route → spawn background task → execute → complete lifecycle", async () => {
		// Step 1: Classify the task description using the routing classifier
		const classification = classifyTask("fix the login button styling on the dashboard");
		expect(classification.category).toBeDefined();
		expect(classification.confidence).toBeGreaterThan(0);

		// Step 2: Make a routing decision from the classification
		const decision = makeRoutingDecision("fix the login button styling on the dashboard");
		expect(decision.category).toBeDefined();
		expect(decision.confidence).toBeGreaterThan(0);
		expect(decision.reasoning).toBeDefined();

		// Step 3: Spawn a background task with the routing result
		const executionLog: string[] = [];
		const manager = new BackgroundManager({
			db,
			maxConcurrent: 2,
			executor: async (task, deps) => {
				executionLog.push(`started:${task.id}`);
				await deps.updateStatus(task.id, "running");
				await deps.updateStatus(task.id, "completed", {
					result: `Routed to ${decision.category} with confidence ${decision.confidence.toFixed(2)}`,
				});
				executionLog.push(`completed:${task.id}`);
				return {
					taskId: task.id,
					status: "completed" as const,
					result: `Routed to ${decision.category}`,
				};
			},
			executionDelayMs: 1,
		});

		const taskId = manager.spawn("session-1", "Fix login button styling", {
			category: decision.category,
		});
		expect(taskId).toBeDefined();
		expect(typeof taskId).toBe("string");

		await manager.waitForIdle(5_000);

		// Step 4: Verify the task completed
		const task = manager.getStatus(taskId);
		expect(task).not.toBeNull();
		expect(task?.status).toBe("completed");
		expect(task?.category).toBe(decision.category);

		expect(executionLog).toContain(`started:${taskId}`);
		expect(executionLog).toContain(`completed:${taskId}`);

		await manager.dispose();
	});

	test("route → spawn → cancel before execution", async () => {
		const decision = makeRoutingDecision("refactor the auth module completely");
		expect(decision.category).toBeDefined();

		const manager = new BackgroundManager({
			db,
			maxConcurrent: 1,
			executor: async (task, _deps) => {
				await new Promise((resolve) => setTimeout(resolve, 5_000));
				return { taskId: task.id, status: "completed" as const };
			},
			executionDelayMs: 5_000,
		});

		const taskId = manager.spawn("session-2", "Refactor auth module", {
			category: decision.category,
		});

		const cancelled = manager.cancel(taskId);
		expect(cancelled).toBe(true);

		const task = manager.getStatus(taskId);
		expect(task).not.toBeNull();
		expect(task?.status).toBe("cancelled");

		await manager.dispose();
	});

	test("multiple tasks with routing categories execute concurrently", async () => {
		const descriptions = [
			"add unit tests for the user service",
			"update the CSS for the sidebar component",
			"fix the database connection pool timeout",
		];

		const completedOrder: string[] = [];
		const manager = new BackgroundManager({
			db,
			maxConcurrent: 3,
			executor: async (task, deps) => {
				const routing = makeRoutingDecision(task.description);
				await deps.updateStatus(task.id, "running");
				await deps.updateStatus(task.id, "completed", {
					result: `Category: ${routing.category}`,
				});
				completedOrder.push(task.id);
				return { taskId: task.id, status: "completed" as const };
			},
			executionDelayMs: 1,
		});

		const taskIds = descriptions.map((desc) =>
			manager.spawn("session-3", desc, {
				category: makeRoutingDecision(desc).category,
			}),
		);

		await manager.waitForIdle(5_000);

		for (const taskId of taskIds) {
			const task = manager.getStatus(taskId);
			expect(task).not.toBeNull();
			expect(task?.status).toBe("completed");
		}

		expect(completedOrder).toHaveLength(3);
		await manager.dispose();
	});

	test("autonomy loop iterates until completion signal detected", async () => {
		const alwaysPassVerification = new VerificationHandler({
			commandChecks: [{ name: "tests", command: "run-tests" }],
			runCommand: async () => ({ exitCode: 0, output: "ok" }),
		});

		const controller = new LoopController({
			maxIterations: 5,
			verifyOnComplete: true,
			cooldownMs: 0,
			sessionId: "integration-loop-session",
			verificationHandler: alwaysPassVerification,
			oracleBridge: immediateOracleBridge,
		});

		const context = controller.start("Implement feature X");
		expect(context.state).toBe("running");
		expect(context.currentIteration).toBe(0);

		// Iteration 1: still working
		const iter1 = await controller.iterate("implemented the auth module");
		expect(iter1.state).toBe("running");
		expect(iter1.currentIteration).toBe(1);

		// Iteration 2: still in progress
		const iter2 = await controller.iterate("added validation layer");
		expect(iter2.state).toBe("running");
		expect(iter2.currentIteration).toBe(2);

		// Iteration 3: signal completion
		const iter3 = await controller.iterate("<promise>DONE</promise>");
		expect(iter3.state).toBe("oracle_verification_pending");
		expect(iter3.verificationResults).toHaveLength(1);
		expect(iter3.verificationResults[0].passed).toBe(true);

		const iter4 = await controller.iterate("poll oracle");
		expect(iter4.state).toBe("complete");
		expect(iter4.oracleVerification?.status).toBe("verified");
	});

	test("routing + background + loop: end-to-end lifecycle", async () => {
		// Step 1: Route a task
		const decision = makeRoutingDecision("implement jwt authentication middleware", undefined, [
			"src/auth/middleware.ts",
		]);
		expect(decision.confidence).toBeGreaterThan(0);

		// Step 2: Spawn as background task
		let backgroundResult: string | null = null;
		const manager = new BackgroundManager({
			db,
			maxConcurrent: 2,
			executor: async (task, deps) => {
				await deps.updateStatus(task.id, "running");
				const result = `Implemented via ${decision.category}`;
				await deps.updateStatus(task.id, "completed", { result });
				backgroundResult = result;
				return { taskId: task.id, status: "completed" as const, result };
			},
			executionDelayMs: 1,
		});

		const taskId = manager.spawn("session-e2e", "JWT auth middleware", {
			category: decision.category,
		});

		await manager.waitForIdle(5_000);

		// Step 3: Feed background result into autonomy loop
		expect(backgroundResult).not.toBeNull();

		const controller = new LoopController({
			maxIterations: 3,
			verifyOnComplete: false,
			cooldownMs: 0,
		});

		controller.start("JWT auth middleware implementation");
		const iterResult = await controller.iterate(
			`Background task completed: ${backgroundResult}\n<promise>DONE</promise>`,
		);
		expect(iterResult.state).toBe("complete");

		const finalTask = manager.getStatus(taskId);
		expect(finalTask?.status).toBe("completed");

		await manager.dispose();
	});
});
