import { describe, expect, test } from "bun:test";
import { LoopController } from "../../src/autonomy/controller";
import { createLoopInjector, loopInjectorConstants } from "../../src/autonomy/injector";

describe("createLoopInjector", () => {
	test("skips injection when loop is idle", async () => {
		const controller = new LoopController();
		const injector = createLoopInjector(controller);
		const output = { system: ["base"] };

		await injector({ sessionID: "sess-1" }, output);

		expect(output.system).toEqual(["base"]);
	});

	test("injects loop context when loop is active", async () => {
		const controller = new LoopController({ verifyOnComplete: false });
		controller.start("Ship feature", { maxIterations: 4, verifyOnComplete: false });
		await controller.iterate("Still working on docs");
		const injector = createLoopInjector(controller);
		const output = { system: ["base"] };

		await injector({ sessionID: "sess-1" }, output);

		expect(output.system.length).toBe(2);
		const injected = output.system[1];
		expect(injected).toContain("[Autonomy Loop]");
		expect(injected).toContain("Current iteration: 1 of 4");
		expect(injected).toContain("Remaining iterations: 3");
		expect(injected).toContain("Still working on docs");
	});

	test("truncates loop context to the configured character budget", async () => {
		const controller = new LoopController({ verifyOnComplete: false });
		controller.start("Large context", { maxIterations: 4, verifyOnComplete: false });
		await controller.iterate(`Done ${"x".repeat(800)}`);
		const injector = createLoopInjector(controller);
		const output = { system: [] as string[] };

		await injector({ sessionID: "sess-1" }, output);

		expect(output.system.length).toBe(1);
		expect(output.system[0].length).toBeLessThanOrEqual(
			loopInjectorConstants.LOOP_CONTEXT_CHAR_BUDGET,
		);
	});
});
