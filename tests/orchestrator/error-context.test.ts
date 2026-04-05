import { describe, expect, it } from "bun:test";
import { enrichErrorMessage } from "../../src/orchestrator/error-context";
import type { PipelineState } from "../../src/orchestrator/types";

const baseState = (overrides: Partial<PipelineState>): PipelineState =>
	({
		schemaVersion: 2,
		status: "IN_PROGRESS",
		runId: "run-1",
		stateRevision: 0,
		idea: "test",
		currentPhase: null,
		startedAt: "2026-01-01T00:00:00.000Z",
		lastUpdatedAt: "2026-01-01T00:00:00.000Z",
		phases: [],
		decisions: [],
		confidence: [],
		tasks: [],
		arenaConfidence: null,
		exploreTriggered: false,
		buildProgress: {
			currentTask: null,
			currentWave: null,
			attemptCount: 0,
			strikeCount: 0,
			reviewPending: false,
		},
		pendingDispatches: [],
		processedResultIds: [],
		failureContext: null,
		phaseDispatchCounts: {},
		...overrides,
	}) as PipelineState;

describe("enrichErrorMessage", () => {
	it("includes phase only when no additional context exists", () => {
		expect(enrichErrorMessage("boom", baseState({ currentPhase: "PLAN" }))).toBe(
			"Error in phase PLAN: boom",
		);
	});

	it("includes build wave and task details", () => {
		const state = baseState({
			currentPhase: "BUILD",
			buildProgress: {
				currentTask: 7,
				currentWave: 2,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
			},
			tasks: [
				{
					id: 7,
					title: "Write tests",
					status: "IN_PROGRESS",
					wave: 2,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
			],
		});

		expect(enrichErrorMessage("failed", state)).toBe(
			"Error in phase BUILD (wave 2, task 7: Write tests): failed",
		);
	});

	it("falls back to unknown phase when missing", () => {
		expect(enrichErrorMessage("oops", baseState({ currentPhase: null }))).toBe(
			"Error in phase UNKNOWN: oops",
		);
	});
});
