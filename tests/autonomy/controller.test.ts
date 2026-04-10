import { describe, expect, test } from "bun:test";
import { LoopController } from "../../src/autonomy/controller";
import { TaskOracleBridge } from "../../src/autonomy/oracle-bridge";
import { VerificationHandler } from "../../src/autonomy/verification";
import { BaseLogger } from "../../src/logging/logger";
import type { LogEntry, Logger } from "../../src/logging/types";

function createLogger(): Logger {
	return new BaseLogger(
		{
			write(_entry: LogEntry): void {},
		},
		{ domain: "test" },
	);
}

describe("LoopController", () => {
	test("completes lifecycle when completion is detected without verification", async () => {
		const controller = new LoopController({ verifyOnComplete: false, logger: createLogger() });

		controller.start("Ship feature", { maxIterations: 3, verifyOnComplete: false });
		const status = await controller.iterate("<promise>DONE</promise>");

		expect(status.state).toBe("complete");
		expect(status.currentIteration).toBe(1);
		expect(controller.isComplete()).toBe(true);
	});

	test("supports pause, resume, and abort", async () => {
		const controller = new LoopController({ verifyOnComplete: false, logger: createLogger() });
		controller.start("Investigate bug");
		controller.pause();

		const pausedStatus = await controller.iterate("Done");
		expect(pausedStatus.currentIteration).toBe(0);

		controller.resume();
		const abortedStatus = controller.abort();
		expect(abortedStatus.state).toBe("failed");
		expect(abortedStatus.accumulatedContext.at(-1)).toBe("Loop aborted by operator.");
	});

	test("transitions to max_iterations when the limit is exceeded", async () => {
		const controller = new LoopController({ verifyOnComplete: false, logger: createLogger() });
		controller.start("Iterate until stop", { maxIterations: 1, verifyOnComplete: false });

		const first = await controller.iterate("Still working");
		expect(first.state).toBe("running");

		const second = await controller.iterate("Still working");
		expect(second.state).toBe("max_iterations");
		expect(second.currentIteration).toBe(2);
	});

	test("re-enters running state when deterministic verification fails and completes after Oracle verifies", async () => {
		const commandsRun: string[] = [];
		const oracleSessions = new Map<string, readonly string[]>([
			[
				"oracle-session-1",
				[
					"ATTEMPT_ID: attempt-1\n<promise>VERIFIED</promise>\nVERDICT: VERIFIED\nSUMMARY: Oracle accepted the completion evidence.",
				],
			],
		]);
		const verificationHandler = new VerificationHandler({
			commandChecks: [
				{ name: "tests", command: "run-tests" },
				{ name: "lint", command: "run-lint" },
			],
			runCommand: async (command) => {
				commandsRun.push(command);
				return { exitCode: 0, output: "ok" };
			},
		});

		let controller: LoopController;
		const oracleBridge = new TaskOracleBridge({
			generateAttemptId: () => "attempt-1",
			dispatchOracleTask: async ({ parentSessionId, prompt, attemptId }) => {
				expect(parentSessionId).toBe("work-session-1");
				expect(attemptId).toBe("attempt-1");
				expect(prompt).toContain("Review this completion claim and decide whether it is verified.");
				expect(commandsRun).toEqual(expect.arrayContaining(["run-tests", "run-lint"]));
				expect(controller.getStatus().state).toBe("verifying");
				return {
					sessionId: "oracle-session-1",
					attemptId,
					parentSessionId,
				};
			},
			readOracleSessionMessages: async ({ sessionId }) => oracleSessions.get(sessionId) ?? [],
		});

		controller = new LoopController({
			verifyOnComplete: true,
			sessionId: "work-session-1",
			logger: createLogger(),
			verificationHandler,
			oracleBridge,
		});
		controller.start("Finalize work", { maxIterations: 3, verifyOnComplete: true });

		const failedStatus = await controller.iterate("<promise>DONE</promise>");
		expect(failedStatus.state).toBe("oracle_verification_pending");
		expect(failedStatus.verificationResults).toHaveLength(1);
		expect(failedStatus.oracleVerification?.sessionId).toBe("oracle-session-1");
		expect(failedStatus.oracleVerification?.attemptId).toBe("attempt-1");
		expect(commandsRun).toEqual(["run-tests", "run-lint"]);

		const completeStatus = await controller.iterate("Polling Oracle result");
		expect(completeStatus.state).toBe("complete");
		expect(completeStatus.oracleVerification?.status).toBe("verified");
		expect(completeStatus.oracleVerification?.resultAttemptId).toBe("attempt-1");
		expect(completeStatus.verificationResults).toHaveLength(1);
	});

	test("returns to running when Oracle rejects completion and fails after max attempts", async () => {
		const verificationHandler = new VerificationHandler({
			commandChecks: [{ name: "tests", command: "run-tests" }],
			runCommand: async () => ({ exitCode: 0, output: "ok" }),
		});
		const oracleSessions = new Map<string, readonly string[]>([
			[
				"oracle-session-1",
				[
					"ATTEMPT_ID: oracle-attempt-1\nVERDICT: FAILED\nFIX_INSTRUCTIONS: Add the final validation step before declaring completion.",
				],
			],
			[
				"oracle-session-2",
				[
					"ATTEMPT_ID: oracle-attempt-2\nVERDICT: FAILED\nFIX_INSTRUCTIONS: Add the final validation step before declaring completion.",
				],
			],
		]);
		let requestCount = 0;
		const oracleBridge = new TaskOracleBridge({
			generateAttemptId: () => `oracle-attempt-${requestCount + 1}`,
			dispatchOracleTask: async ({ attemptId, parentSessionId }) => {
				requestCount += 1;
				return {
					sessionId: `oracle-session-${requestCount}`,
					attemptId,
					parentSessionId: parentSessionId ?? "missing-parent",
				};
			},
			readOracleSessionMessages: async ({ sessionId }) => oracleSessions.get(sessionId) ?? [],
		});

		const controller = new LoopController({
			verifyOnComplete: true,
			sessionId: "work-session-2",
			logger: createLogger(),
			verificationHandler,
			oracleBridge,
			maxVerificationAttempts: 2,
		});
		controller.start("Finalize work", {
			maxIterations: 4,
			verifyOnComplete: true,
			maxVerificationAttempts: 2,
		});

		const firstPending = await controller.iterate("<promise>DONE</promise>");
		expect(firstPending.state).toBe("oracle_verification_pending");

		const firstRejection = await controller.iterate("Polling Oracle result");
		expect(firstRejection.state).toBe("running");
		expect(firstRejection.oracleVerification?.attemptCount).toBe(1);
		expect(firstRejection.accumulatedContext.at(-1)).toContain("Oracle verification failed (1/2)");

		const stillRunning = await controller.iterate("Worker is still fixing the issue");
		expect(stillRunning.state).toBe("running");
		expect(stillRunning.currentIteration).toBe(2);
		expect(stillRunning.accumulatedContext.join("\n")).not.toContain("<promise>DONE</promise>\n");

		const secondPending = await controller.iterate("<promise>DONE</promise>");
		expect(secondPending.state).toBe("oracle_verification_pending");

		const terminalFailure = await controller.iterate("Polling Oracle result");
		expect(terminalFailure.state).toBe("failed");
		expect(terminalFailure.oracleVerification?.attemptCount).toBe(2);
		expect(terminalFailure.accumulatedContext.at(-1)).toBe(
			"Oracle verification exceeded maximum attempts (2). Manual review required.",
		);
	});
});
