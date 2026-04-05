import { afterEach, describe, expect, test } from "bun:test";
import { LoopController, setLoopControllerForTests } from "../../src/autonomy";
import { loopCore } from "../../src/tools/loop";

describe("loopCore", () => {
	afterEach(() => {
		setLoopControllerForTests(null);
	});

	test("status returns current loop state", async () => {
		const controller = new LoopController({ verifyOnComplete: false });
		controller.start("Ship docs", { maxIterations: 2, verifyOnComplete: false });
		setLoopControllerForTests(controller);

		const result = JSON.parse(await loopCore("status", undefined, controller));

		expect(result.action).toBe("loop_status");
		expect(result.context.state).toBe("running");
		expect(result.displayText).toContain("Ship docs");
	});

	test("abort transitions the active loop to failed", async () => {
		const controller = new LoopController({ verifyOnComplete: false });
		controller.start("Abort me", { verifyOnComplete: false });
		setLoopControllerForTests(controller);

		const result = JSON.parse(await loopCore("abort", undefined, controller));

		expect(result.action).toBe("loop_abort");
		expect(result.context.state).toBe("failed");
		expect(result.displayText).toContain("failed");
	});

	test("start begins a new loop with task description", async () => {
		const controller = new LoopController({ verifyOnComplete: false });

		const result = JSON.parse(
			await loopCore("start", { taskDescription: "Build feature X", maxIterations: 5 }, controller),
		);

		expect(result.action).toBe("loop_start");
		expect(result.context.state).toBe("running");
		expect(result.context.taskDescription).toBe("Build feature X");
		expect(result.context.maxIterations).toBe(5);
	});

	test("start uses defaults when no options provided", async () => {
		const controller = new LoopController({ verifyOnComplete: false });

		const result = JSON.parse(await loopCore("start", {}, controller));

		expect(result.action).toBe("loop_start");
		expect(result.context.state).toBe("running");
		expect(result.context.taskDescription).toBe("Untitled task");
	});

	test("iterate advances the loop with result", async () => {
		const controller = new LoopController({
			verifyOnComplete: false,
			maxIterations: 10,
		});
		controller.start("Iterate test", { verifyOnComplete: false });

		const result = JSON.parse(
			await loopCore("iterate", { iterationResult: "Completed step 1" }, controller),
		);

		expect(result.action).toBe("loop_iterate");
		expect(result.context.currentIteration).toBe(1);
		expect(result.context.accumulatedContext).toContain("Completed step 1");
	});

	test("pause pauses the running loop", async () => {
		const controller = new LoopController({ verifyOnComplete: false });
		controller.start("Pause test", { verifyOnComplete: false });

		const result = JSON.parse(await loopCore("pause", undefined, controller));

		expect(result.action).toBe("loop_pause");
		expect(result.context.state).toBe("running");

		const iterateResult = JSON.parse(
			await loopCore("iterate", { iterationResult: "Should not advance" }, controller),
		);
		expect(iterateResult.context.currentIteration).toBe(0);
	});

	test("resume unpauses the loop", async () => {
		const controller = new LoopController({ verifyOnComplete: false });
		controller.start("Resume test", { verifyOnComplete: false });
		controller.pause();

		const result = JSON.parse(await loopCore("resume", undefined, controller));

		expect(result.action).toBe("loop_resume");
		expect(result.context.state).toBe("running");

		const iterateResult = JSON.parse(
			await loopCore("iterate", { iterationResult: "After resume" }, controller),
		);
		expect(iterateResult.context.currentIteration).toBe(1);
	});
});
