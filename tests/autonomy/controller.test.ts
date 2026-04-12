import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LoopController } from "../../src/autonomy/controller";
import { TaskOracleBridge } from "../../src/autonomy/oracle-bridge";
import { VerificationHandler } from "../../src/autonomy/verification";
import { BaseLogger } from "../../src/logging/logger";
import type { LogEntry, Logger } from "../../src/logging/types";
import {
	formatOracleSignoffEnvelope,
	getProgramOracleSignoffArtifactPath,
} from "../../src/orchestrator/signoff";

function createLogger(): Logger {
	return new BaseLogger(
		{
			write(_entry: LogEntry): void {},
		},
		{ domain: "test" },
	);
}

function createProgramSignoff(
	signoffId: string,
	verdict: "COMPLETE" | "INCOMPLETE" | "FAILED",
	reasoning: string,
): string {
	return formatOracleSignoffEnvelope({
		signoffId,
		scope: "PROGRAM",
		inputsDigest: `digest-${signoffId}`,
		verdict,
		reasoning,
	});
}

describe("LoopController", () => {
	test("requires Oracle signoff even when deterministic verification is disabled", async () => {
		const oracleBridge = new TaskOracleBridge({
			generateAttemptId: () => "attempt-no-verify",
			dispatchOracleTask: async ({ attemptId, parentSessionId }) => ({
				sessionId: "oracle-session-no-verify",
				attemptId,
				parentSessionId: parentSessionId ?? "missing-parent",
			}),
			readOracleSessionMessages: async () => [
				createProgramSignoff("attempt-no-verify", "COMPLETE", "Oracle approved completion."),
			],
		});
		const controller = new LoopController({
			verifyOnComplete: false,
			sessionId: "work-session-no-verify",
			logger: createLogger(),
			oracleBridge,
		});

		controller.start("Ship feature", { maxIterations: 3, verifyOnComplete: false });
		const pending = await controller.iterate("<promise>DONE</promise>");
		expect(pending.state).toBe("oracle_verification_pending");

		const status = await controller.iterate("poll oracle");
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
		expect(abortedStatus.accumulatedContext[abortedStatus.accumulatedContext.length - 1]).toBe(
			"Loop aborted by operator.",
		);
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
				[createProgramSignoff("attempt-1", "COMPLETE", "Oracle accepted the completion evidence.")],
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
				expect(prompt).toContain("Mandatory program Oracle signoff request.");
				expect(commandsRun).toEqual(expect.arrayContaining(["run-tests", "run-lint"]));
				expect(controller.getStatus().state).toBe("verifying");
				return {
					sessionId: "oracle-session-1",
					attemptId,
					parentSessionId: parentSessionId ?? "missing-parent",
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
		expect(completeStatus.oracleVerification?.signoff?.verdict).toBe("COMPLETE");
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
					createProgramSignoff(
						"oracle-attempt-1",
						"FAILED",
						"Add the final validation step before declaring completion.",
					),
				],
			],
			[
				"oracle-session-2",
				[
					createProgramSignoff(
						"oracle-attempt-2",
						"FAILED",
						"Add the final validation step before declaring completion.",
					),
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
		expect(
			firstRejection.accumulatedContext[firstRejection.accumulatedContext.length - 1],
		).toContain("Oracle program signoff rejected (1/2)");

		const stillRunning = await controller.iterate("Worker is still fixing the issue");
		expect(stillRunning.state).toBe("running");
		expect(stillRunning.currentIteration).toBe(2);
		expect(stillRunning.accumulatedContext.join("\n")).not.toContain("<promise>DONE</promise>\n");

		const secondPending = await controller.iterate("<promise>DONE</promise>");
		expect(secondPending.state).toBe("oracle_verification_pending");

		const terminalFailure = await controller.iterate("Polling Oracle result");
		expect(terminalFailure.state).toBe("failed");
		expect(terminalFailure.oracleVerification?.attemptCount).toBe(2);
		expect(terminalFailure.accumulatedContext[terminalFailure.accumulatedContext.length - 1]).toBe(
			"Oracle program signoff exceeded maximum attempts (2). Manual review required.",
		);
	});

	test("persists program Oracle signoff artifacts when an artifact directory is configured", async () => {
		const artifactDir = await mkdtemp(join(tmpdir(), "program-signoff-"));
		try {
			const verificationHandler = new VerificationHandler({
				commandChecks: [{ name: "tests", command: "run-tests" }],
				runCommand: async () => ({ exitCode: 0, output: "ok" }),
			});
			const oracleBridge = new TaskOracleBridge({
				generateAttemptId: () => "artifact-attempt-1",
				dispatchOracleTask: async ({ attemptId, parentSessionId }) => ({
					sessionId: "oracle-session-artifact",
					attemptId,
					parentSessionId: parentSessionId ?? "missing-parent",
				}),
				readOracleSessionMessages: async () => [
					createProgramSignoff("artifact-attempt-1", "COMPLETE", "Persisted signoff."),
				],
			});

			const controller = new LoopController({
				artifactDir,
				sessionId: "artifact-session",
				verifyOnComplete: true,
				logger: createLogger(),
				verificationHandler,
				oracleBridge,
			});

			controller.start("Persist signoff", { verifyOnComplete: true });
			await controller.iterate("<promise>DONE</promise>");
			await controller.iterate("poll oracle");

			const persisted = JSON.parse(
				await readFile(getProgramOracleSignoffArtifactPath(artifactDir), "utf-8"),
			) as { verdict: string };
			expect(persisted.verdict).toBe("COMPLETE");
		} finally {
			await rm(artifactDir, { recursive: true, force: true });
		}
	});
});
