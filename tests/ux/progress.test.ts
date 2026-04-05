import { describe, expect, test } from "bun:test";
import { ProgressTracker } from "../../src/ux/progress";

describe("ProgressTracker", () => {
	test("formats the current phase progress", () => {
		const tracker = new ProgressTracker();

		tracker.startPhase("Building wave 3", 8);
		tracker.advanceStep("Building wave 3");
		tracker.advanceStep("Building wave 3");

		expect(tracker.getProgress()).toEqual({
			current: 2,
			total: 8,
			label: "Building wave 3",
			detail: "Starting phase",
		});
		expect(tracker.formatProgress()).toBe("[2/8] Building wave 3...");
	});

	test("marks a phase as complete", () => {
		const tracker = new ProgressTracker();

		tracker.startPhase("Plan execution", 3);
		tracker.advanceStep("Compile tasks");
		tracker.complete();

		expect(tracker.getProgress()).toEqual({
			current: 3,
			total: 3,
			label: "Plan execution complete",
			detail: "Completed",
		});
		expect(tracker.formatProgress()).toBe("[3/3] Plan execution complete...");
	});

	test("returns a friendly string when no phase is active", () => {
		const tracker = new ProgressTracker();

		expect(tracker.getProgress()).toBeNull();
		expect(tracker.formatProgress()).toBe("No active phase");
	});
});
