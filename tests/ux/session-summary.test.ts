import { describe, expect, setSystemTime, test } from "bun:test";
import type { SessionEvents } from "../../src/observability/event-store";
import type { PipelineState } from "../../src/orchestrator/types";
import { generateSessionSummary, type SessionSummaryData } from "../../src/ux/session-summary";

describe("generateSessionSummary", () => {
	test("handles null/undefined inputs gracefully", () => {
		const summary = generateSessionSummary(undefined, null);
		expect(summary).toContain("## Session Summary");
		expect(summary).toContain("**Pipeline Status**: Unknown");
	});

	test("summarizes a successful completed session", () => {
		const pipelineState = {
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
		} as unknown as PipelineState;

		const sessionData = {
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
		} as unknown as SessionEvents;

		const summary = generateSessionSummary(sessionData, pipelineState);
		expect(summary).toContain("**Pipeline Status**: COMPLETED (Current Phase: RETROSPECTIVE)");
		expect(summary).toContain("**Phases Completed**: RECON, CHALLENGE, ARCHITECT");
		expect(summary).toContain("- Input: 1,000 tokens");
		expect(summary).toContain("- Output: 500 tokens");
		expect(summary).toContain("- Reasoning: 100 tokens");
		expect(summary).toContain("**Duration**: 120.0s");
	});

	test("includes errors in the summary", () => {
		const sessionData = {
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
		} as unknown as SessionEvents;

		const summary = generateSessionSummary(sessionData, null);
		expect(summary).toContain("**Errors Encountered**:");
		expect(summary).toContain("- RATE_LIMIT: Too many requests");
	});

	test("shows active duration if session hasn't ended", () => {
		const now = new Date("2024-01-01T00:00:05Z");
		setSystemTime(now);
		const startedAt = new Date("2024-01-01T00:00:00Z").toISOString();
		const sessionData = {
			events: [],
			startedAt,
		} as unknown as SessionEvents;

		const summary = generateSessionSummary(sessionData, null);
		expect(summary).toContain("**Duration (active)**: 5.0s");
		setSystemTime();
	});

	test("handles empty phases list", () => {
		const pipelineState = {
			status: "IN_PROGRESS",
			currentPhase: "RECON",
			phases: [],
		} as unknown as PipelineState;

		const summary = generateSessionSummary(undefined, pipelineState);
		expect(summary).toContain("**Pipeline Status**: IN_PROGRESS (Current Phase: RECON)");
		expect(summary).toContain("**Phases Completed**: None");
	});

	test("generates structured markdown summaries for UX surfaces", () => {
		const summaryData: SessionSummaryData = {
			sessionId: "ses_123",
			startedAt: "2026-01-01T00:00:00.000Z",
			endedAt: "2026-01-01T00:10:00.000Z",
			tokensUsed: 12_345,
			phasesCompleted: ["RECON", "PLAN", "BUILD"],
			errorsEncountered: 2,
			tasksCompleted: 9,
			lessonsLearned: ["Prefer smaller waves", "Compact earlier near token limits"],
		};

		const summary = generateSessionSummary(summaryData);

		expect(summary).toContain("# Session Summary: ses_123");
		expect(summary).toContain("- Tokens Used: 12,345");
		expect(summary).toContain("- Tasks Completed: 9");
		expect(summary).toContain("- Errors Encountered: 2");
		expect(summary).toContain("## Phases Completed");
		expect(summary).toContain("- RECON");
		expect(summary).toContain("## Lessons Learned");
		expect(summary).toContain("- Prefer smaller waves");
	});
});
