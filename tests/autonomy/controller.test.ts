import { describe, expect, test } from "bun:test";
import { LoopController } from "../../src/autonomy/controller";
import type { LoopContext, VerificationResult } from "../../src/autonomy/types";
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

class StubVerificationHandler extends VerificationHandler {
	constructor(private readonly verifyImpl: (context: LoopContext) => Promise<VerificationResult>) {
		super();
	}

	override verify(context: LoopContext): Promise<VerificationResult> {
		return this.verifyImpl(context);
	}
}

describe("LoopController", () => {
	test("completes lifecycle when completion is detected without verification", async () => {
		const controller = new LoopController({ verifyOnComplete: false, logger: createLogger() });

		controller.start("Ship feature", { maxIterations: 3, verifyOnComplete: false });
		const status = await controller.iterate("Done. All tasks completed.");

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

	test("re-enters running state when verification fails and completes on retry", async () => {
		let attempts = 0;
		const verificationHandler = new StubVerificationHandler(async () => {
			attempts += 1;
			return {
				passed: attempts > 1,
				checks: [
					{
						name: "tests",
						passed: attempts > 1,
						message: attempts > 1 ? "passed" : "failed once",
					},
				],
				timestamp: new Date().toISOString(),
			};
		});

		const controller = new LoopController({
			verifyOnComplete: true,
			logger: createLogger(),
			verificationHandler,
		});
		controller.start("Finalize work", { maxIterations: 3, verifyOnComplete: true });

		const failedStatus = await controller.iterate("Finished. All tasks completed.");
		expect(failedStatus.state).toBe("running");
		expect(failedStatus.verificationResults).toHaveLength(1);
		expect(failedStatus.accumulatedContext.at(-1)).toContain("Verification failed");

		const completeStatus = await controller.iterate("Finished. All tasks completed.");
		expect(completeStatus.state).toBe("complete");
		expect(completeStatus.verificationResults).toHaveLength(2);
	});
});
