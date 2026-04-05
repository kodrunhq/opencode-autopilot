import { describe, expect, test } from "bun:test";
import { LoopController } from "../../src/autonomy/controller";
import { createLoopInjector, loopInjectorConstants } from "../../src/autonomy/injector";

describe("createLoopInjector", () => {
	test("skips injection when loop is idle", async () => {
		const controller = new LoopController();
		const injector = createLoopInjector(controller);
		const output = { system: "base" };

		await injector({ sessionID: "sess-1" }, output);

		expect(output.system).toBe("base");
	});

	test("injects loop context when loop is active", async () => {
		const controller = new LoopController({ verifyOnComplete: false });
		controller.start("Ship feature", { maxIterations: 4, verifyOnComplete: false });
		await controller.iterate("Still working on docs");
		const injector = createLoopInjector(controller);
		const output = { system: "base" };

		await injector({ sessionID: "sess-1" }, output);

		expect(output.system).toContain("[Autonomy Loop]");
		expect(output.system).toContain("Current iteration: 1 of 4");
		expect(output.system).toContain("Remaining iterations: 3");
		expect(output.system).toContain("Still working on docs");
	});

	test("truncates loop context to the configured character budget", async () => {
		const controller = new LoopController({ verifyOnComplete: false });
		controller.start("Large context", { maxIterations: 4, verifyOnComplete: false });
		await controller.iterate(`Done ${"x".repeat(800)}`);
		const injector = createLoopInjector(controller);
		const output = { system: "" };

		await injector({ sessionID: "sess-1" }, output);

		expect(output.system.length).toBeLessThanOrEqual(
			loopInjectorConstants.LOOP_CONTEXT_CHAR_BUDGET,
		);
	});
});
