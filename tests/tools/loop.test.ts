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

		const result = JSON.parse(await loopCore("status"));

		expect(result.action).toBe("loop_status");
		expect(result.context.state).toBe("running");
		expect(result.displayText).toContain("Ship docs");
	});

	test("abort transitions the active loop to failed", async () => {
		const controller = new LoopController({ verifyOnComplete: false });
		controller.start("Abort me", { verifyOnComplete: false });
		setLoopControllerForTests(controller);

		const result = JSON.parse(await loopCore("abort"));

		expect(result.action).toBe("loop_abort");
		expect(result.context.state).toBe("failed");
		expect(result.displayText).toContain("failed");
	});
});
