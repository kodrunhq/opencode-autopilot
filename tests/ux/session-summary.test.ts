import { describe, expect, it, setSystemTime } from "bun:test";
import type { SessionEvents } from "../../src/observability/event-store";
import type { PipelineState } from "../../src/orchestrator/types";
import { generateSessionSummary } from "../../src/ux/session-summary";

describe("generateSessionSummary", () => {
	it("handles null/undefined inputs gracefully", () => {
		const summary = generateSessionSummary(undefined, null);
		expect(summary).toContain("## Session Summary");
		expect(summary).toContain("**Pipeline Status**: Unknown");
	});

	it("summarizes a successful completed session", () => {
		const pipelineState: PipelineState = {
			status: "COMPLETED",
			currentPhase: "RETROSPECTIVE",
			phases: [
				{ name: "RECON", status: "DONE", completedAt: "2024-01-01T00:00:00Z", confidence: "HIGH" },
				{
					name: "CHALLENGE",
					status: "DONE",
					completedAt: "2024-01-01T00:01:00Z",
					confidence: "HIGH",
				},
				{
					name: "ARCHITECT",
					status: "DONE",
					completedAt: "2024-01-01T00:02:00Z",
					confidence: "HIGH",
				},
			],
		} as any;

		const sessionData: SessionEvents = {
			tokens: {
				inputTokens: 1000,
				outputTokens: 500,
				reasoningTokens: 100,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				totalCost: 0.01,
				messageCount: 10,
			},
			events: [
				{
					type: "session_end",
					durationMs: 120000,
					totalCost: 0.01,
					timestamp: "...",
					sessionId: "...",
				},
			],
			startedAt: "2024-01-01T00:00:00Z",
		} as any;

		const summary = generateSessionSummary(sessionData, pipelineState);
		expect(summary).toContain("**Pipeline Status**: COMPLETED (Current Phase: RETROSPECTIVE)");
		expect(summary).toContain("**Phases Completed**: RECON, CHALLENGE, ARCHITECT");
		expect(summary).toContain("- Input: 1,000 tokens");
		expect(summary).toContain("- Output: 500 tokens");
		expect(summary).toContain("- Reasoning: 100 tokens");
		expect(summary).toContain("**Duration**: 120.0s");
	});

	it("includes errors in the summary", () => {
		const sessionData: SessionEvents = {
			events: [
				{
					type: "error",
					errorType: "rate_limit",
					message: "Too many requests",
					timestamp: "...",
					sessionId: "...",
					model: "...",
				},
			],
			startedAt: "2024-01-01T00:00:00Z",
		} as any;

		const summary = generateSessionSummary(sessionData, null);
		expect(summary).toContain("**Errors Encountered**:");
		expect(summary).toContain("- RATE_LIMIT: Too many requests");
	});

	it("shows active duration if session hasn't ended", () => {
		const now = new Date("2024-01-01T00:00:05Z");
		setSystemTime(now);
		const startedAt = new Date("2024-01-01T00:00:00Z").toISOString();
		const sessionData: SessionEvents = {
			events: [],
			startedAt,
		} as any;

		const summary = generateSessionSummary(sessionData, null);
		expect(summary).toContain("**Duration (active)**: 5.0s");
		setSystemTime();
	});

	it("handles empty phases list", () => {
		const pipelineState: PipelineState = {
			status: "IN_PROGRESS",
			currentPhase: "RECON",
			phases: [],
		} as any;

		const summary = generateSessionSummary(undefined, pipelineState);
		expect(summary).toContain("**Pipeline Status**: IN_PROGRESS (Current Phase: RECON)");
		expect(summary).toContain("**Phases Completed**: None");
	});
});
