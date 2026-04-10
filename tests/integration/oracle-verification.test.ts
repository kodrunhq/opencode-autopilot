import { describe, expect, test } from "bun:test";
import { LoopController } from "../../src/autonomy/controller";
import {
	parseOracleVerificationEvidence,
	TaskOracleBridge,
} from "../../src/autonomy/oracle-bridge";
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

describe("oracle verification integration", () => {
	test("running -> verifying -> oracle_verification_pending -> complete", async () => {
		const commandsRun: string[] = [];
		const dispatchStates: string[] = [];
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
			dispatchOracleTask: async ({ attemptId, parentSessionId }) => {
				dispatchStates.push(controller.getStatus().state);
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
			cooldownMs: 0,
			sessionId: "work-session-1",
			logger: createLogger(),
			verificationHandler,
			oracleBridge,
		});

		controller.start("Ship the feature", { verifyOnComplete: true });
		expect(controller.getStatus().state).toBe("running");

		const pending = await controller.iterate("<promise>DONE</promise>");
		expect(commandsRun).toEqual(["run-tests", "run-lint"]);
		expect(dispatchStates).toEqual(["verifying"]);
		expect(pending.state).toBe("oracle_verification_pending");
		expect(pending.oracleVerification?.sessionId).toBe("oracle-session-1");
		expect(pending.oracleVerification?.attemptId).toBe("attempt-1");

		const complete = await controller.iterate("Polling Oracle result");
		expect(complete.state).toBe("complete");
		expect(complete.oracleVerification?.status).toBe("verified");
		expect(complete.oracleVerification?.resultAttemptId).toBe("attempt-1");
	});

	test("same controller session retries after a failed Oracle verdict without stale poisoning", async () => {
		const verificationHandler = new VerificationHandler({
			commandChecks: [{ name: "tests", command: "run-tests" }],
			runCommand: async () => ({ exitCode: 0, output: "ok" }),
		});

		const oracleTranscriptByAttempt = new Map<string, readonly string[]>([
			[
				"attempt-1",
				[
					"ATTEMPT_ID: attempt-1\nVERDICT: FAILED\nFIX_INSTRUCTIONS: Add the missing validation gate before marking the task complete.",
				],
			],
			[
				"attempt-2",
				[
					"ATTEMPT_ID: attempt-1\nVERDICT: FAILED\nFIX_INSTRUCTIONS: Add the missing validation gate before marking the task complete.",
					"ATTEMPT_ID: attempt-2\n<promise>VERIFIED</promise>\nVERDICT: VERIFIED\nSUMMARY: Validation is now present.",
				],
			],
		]);

		let attemptSequence = 0;
		const oracleBridge = new TaskOracleBridge({
			generateAttemptId: () => `attempt-${attemptSequence + 1}`,
			dispatchOracleTask: async ({ attemptId, parentSessionId }) => {
				attemptSequence += 1;
				return {
					sessionId: "oracle-shared-session",
					attemptId,
					parentSessionId: parentSessionId ?? "missing-parent",
				};
			},
			readOracleSessionMessages: async ({ attemptId }) =>
				oracleTranscriptByAttempt.get(attemptId) ?? [],
		});

		const controller = new LoopController({
			sessionId: "main-session-1",
			verifyOnComplete: true,
			cooldownMs: 0,
			logger: createLogger(),
			verificationHandler,
			oracleBridge,
			maxVerificationAttempts: 2,
		});

		controller.start("Finalize work", { verifyOnComplete: true, maxVerificationAttempts: 2 });

		const firstPending = await controller.iterate("<promise>DONE</promise>");
		expect(firstPending.oracleVerification?.attemptId).toBe("attempt-1");

		const firstRejected = await controller.iterate("poll oracle");
		expect(firstRejected.state).toBe("running");
		expect(firstRejected.oracleVerification?.resultAttemptId).toBe("attempt-1");

		const stillRunning = await controller.iterate("still fixing after oracle rejection");
		expect(stillRunning.state).toBe("running");
		expect(stillRunning.accumulatedContext.join("\n")).not.toContain("<promise>DONE</promise>\n");

		const secondPending = await controller.iterate("<promise>DONE</promise>");
		expect(secondPending.oracleVerification?.attemptId).toBe("attempt-2");

		const verified = await controller.iterate("poll oracle");
		expect(verified.state).toBe("complete");
		expect(verified.oracleVerification?.status).toBe("verified");
		expect(verified.oracleVerification?.resultAttemptId).toBe("attempt-2");
		expect(verified.oracleVerification?.lastResultSummary).toBe("Validation is now present.");
	});

	test("keeps Oracle consultations isolated across concurrent controller sessions", async () => {
		const verificationHandler = new VerificationHandler({
			commandChecks: [{ name: "tests", command: "run-tests" }],
			runCommand: async () => ({ exitCode: 0, output: "ok" }),
		});
		const dispatchedParents: string[] = [];
		const oracleResponses = new Map<string, readonly string[]>([
			[
				"oracle-session-a",
				[
					"ATTEMPT_ID: session-a-attempt\n<promise>VERIFIED</promise>\nVERDICT: VERIFIED\nSUMMARY: Session A verified.",
				],
			],
			[
				"oracle-session-b",
				[
					"ATTEMPT_ID: session-b-attempt\n<promise>VERIFIED</promise>\nVERDICT: VERIFIED\nSUMMARY: Session B verified.",
				],
			],
		]);

		const oracleBridge = new TaskOracleBridge({
			generateAttemptId: (() => {
				const attemptIds = ["session-a-attempt", "session-b-attempt"];
				let index = 0;
				return () => attemptIds[index++] ?? `attempt-${index}`;
			})(),
			dispatchOracleTask: async ({ attemptId, parentSessionId }) => {
				dispatchedParents.push(parentSessionId ?? "missing-parent");
				return {
					sessionId: parentSessionId === "session-a" ? "oracle-session-a" : "oracle-session-b",
					attemptId,
					parentSessionId: parentSessionId ?? "missing-parent",
				};
			},
			readOracleSessionMessages: async ({ sessionId }) => oracleResponses.get(sessionId) ?? [],
		});

		const controllerA = new LoopController({
			sessionId: "session-a",
			verifyOnComplete: true,
			cooldownMs: 0,
			logger: createLogger(),
			verificationHandler,
			oracleBridge,
		});
		const controllerB = new LoopController({
			sessionId: "session-b",
			verifyOnComplete: true,
			cooldownMs: 0,
			logger: createLogger(),
			verificationHandler,
			oracleBridge,
		});

		controllerA.start("Session A task", { verifyOnComplete: true });
		controllerB.start("Session B task", { verifyOnComplete: true });

		const [pendingA, pendingB] = await Promise.all([
			controllerA.iterate("<promise>DONE</promise>"),
			controllerB.iterate("<promise>DONE</promise>"),
		]);

		expect(pendingA.oracleVerification?.sessionId).toBe("oracle-session-a");
		expect(pendingB.oracleVerification?.sessionId).toBe("oracle-session-b");
		expect(dispatchedParents.sort()).toEqual(["session-a", "session-b"]);

		const [completeA, completeB] = await Promise.all([
			controllerA.iterate("poll oracle"),
			controllerB.iterate("poll oracle"),
		]);

		expect(completeA.state).toBe("complete");
		expect(completeB.state).toBe("complete");
		expect(completeA.oracleVerification?.lastResultSummary).toBe("Session A verified.");
		expect(completeB.oracleVerification?.lastResultSummary).toBe("Session B verified.");
	});

	test("fails closed when Oracle dispatch has no active parent session", async () => {
		const controller = new LoopController({
			verifyOnComplete: true,
			cooldownMs: 0,
			logger: createLogger(),
			verificationHandler: new VerificationHandler({
				commandChecks: [{ name: "tests", command: "run-tests" }],
				runCommand: async () => ({ exitCode: 0, output: "ok" }),
			}),
			oracleBridge: new TaskOracleBridge({
				generateAttemptId: () => "attempt-without-parent",
				dispatchOracleTask: async () => {
					throw new Error("No active session available for Oracle dispatch.");
				},
			}),
		});

		controller.start("Needs oracle", { verifyOnComplete: true });
		const failed = await controller.iterate("<promise>DONE</promise>");

		expect(failed.state).toBe("failed");
		expect(failed.accumulatedContext.at(-1)).toBe(
			"Oracle verification dispatch failed: No active session available for Oracle dispatch.",
		);
	});

	test("parseOracleVerificationEvidence extracts verdict and summary for a specific attempt", () => {
		const result = parseOracleVerificationEvidence(
			[
				"context line",
				"ATTEMPT_ID: attempt-1",
				"VERDICT: FAILED",
				"FIX_INSTRUCTIONS: Add the missing final validation step before marking the task complete.",
			],
			"attempt-1",
		);

		expect(result).not.toBeNull();
		expect(result?.status).toBe("failed");
		expect(result?.attemptId).toBe("attempt-1");
		expect(result?.summary).toBe(
			"Add the missing final validation step before marking the task complete.",
		);
		expect(result?.rawEvidence).toContain("VERDICT: FAILED");
	});

	test("parseOracleVerificationEvidence fails closed without a structured verdict line", () => {
		expect(
			parseOracleVerificationEvidence(
				[
					"ATTEMPT_ID: attempt-1",
					"VERIFIED",
					"SUMMARY: This should not be accepted without VERDICT.",
				],
				"attempt-1",
			),
		).toBeNull();
	});

	test("parseOracleVerificationEvidence fails closed when VERIFIED lacks the exact promise token", () => {
		expect(
			parseOracleVerificationEvidence(
				[
					"ATTEMPT_ID: attempt-1",
					"VERDICT: VERIFIED",
					"SUMMARY: This should not be accepted without the promise token.",
				],
				"attempt-1",
			),
		).toBeNull();
	});
});
