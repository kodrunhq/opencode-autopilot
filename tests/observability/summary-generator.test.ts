import { describe, expect, test } from "bun:test";
import { createForensicEvent } from "../../src/observability/forensic-log";
import {
	computeDuration,
	formatCost,
	formatDuration,
	generateSessionSummary,
} from "../../src/observability/summary-generator";
import type { SessionLog } from "../../src/observability/types";

function makeSessionLog(overrides?: Partial<SessionLog>): SessionLog {
	return {
		schemaVersion: 1 as const,
		sessionId: "test-session-001",
		projectRoot: "/tmp/project",
		startedAt: "2026-04-01T10:00:00.000Z",
		endedAt: "2026-04-01T10:30:00.000Z",
		events: [],
		decisions: [],
		errorSummary: {},
		...overrides,
	};
}

function event(input: Parameters<typeof createForensicEvent>[0]) {
	return createForensicEvent(input);
}

describe("generateSessionSummary", () => {
	test("returns markdown string with session header (ID, dates, duration)", () => {
		const log = makeSessionLog();
		const summary = generateSessionSummary(log);

		expect(summary).toContain("# Session Summary");
		expect(summary).toContain("test-session-001");
		expect(summary).toContain("2026-04-01T10:00:00.000Z");
		expect(summary).toContain("2026-04-01T10:30:00.000Z");
		expect(summary).toContain("30m 0s");
	});

	test("includes decisions section when decisions exist", () => {
		const log = makeSessionLog({
			decisions: [
				{
					timestamp: "2026-04-01T10:05:00Z",
					phase: "BUILD",
					agent: "oc-implementer",
					decision: "Use spread pattern",
					rationale: "Follows immutability constraint",
				},
				{
					timestamp: "2026-04-01T10:10:00Z",
					phase: "RECON",
					agent: "oc-researcher",
					decision: "Research TypeScript patterns",
					rationale: "Domain context needed",
				},
			],
		});

		const summary = generateSessionSummary(log);

		expect(summary).toContain("## Decisions");
		expect(summary).toContain("BUILD");
		expect(summary).toContain("oc-implementer");
		expect(summary).toContain("Use spread pattern");
		expect(summary).toContain("Follows immutability constraint");
	});

	test("includes errors section when error events exist", () => {
		const log = makeSessionLog({
			events: [
				event({
					projectRoot: "/tmp/project",
					domain: "session",
					timestamp: "2026-04-01T10:05:00Z",
					sessionId: "test-session-001",
					type: "error",
					code: "rate_limit",
					message: "Rate limited by provider",
					payload: { errorType: "rate_limit", model: "anthropic/claude-3-opus" },
				}),
				event({
					projectRoot: "/tmp/project",
					domain: "session",
					timestamp: "2026-04-01T10:06:00Z",
					sessionId: "test-session-001",
					type: "error",
					code: "quota_exceeded",
					message: "Quota exceeded",
					payload: { errorType: "quota_exceeded", model: "anthropic/claude-3-sonnet" },
				}),
			],
			errorSummary: {
				rate_limit: 1,
				quota_exceeded: 1,
			},
		});

		const summary = generateSessionSummary(log);

		expect(summary).toContain("## Errors");
		expect(summary).toContain("rate_limit");
		expect(summary).toContain("Rate limited by provider");
		expect(summary).toContain("quota_exceeded");
	});

	test("includes fallback section when fallback events exist", () => {
		const log = makeSessionLog({
			events: [
				event({
					projectRoot: "/tmp/project",
					domain: "session",
					timestamp: "2026-04-01T10:05:00Z",
					sessionId: "test-session-001",
					type: "fallback",
					code: "FALLBACK",
					payload: {
						failedModel: "anthropic/claude-3-opus",
						nextModel: "anthropic/claude-3-sonnet",
						reason: "rate_limit",
						success: true,
					},
				}),
			],
		});

		const summary = generateSessionSummary(log);

		expect(summary).toContain("## Fallbacks");
		expect(summary).toContain("anthropic/claude-3-opus");
		expect(summary).toContain("anthropic/claude-3-sonnet");
	});

	test("handles empty events gracefully (minimal summary)", () => {
		const log = makeSessionLog({
			events: [],
			decisions: [],
			errorSummary: {},
		});

		const summary = generateSessionSummary(log);

		expect(summary).toContain("# Session Summary");
		// Should not have Decisions, Errors, Fallbacks sections
		expect(summary).not.toContain("## Decisions");
		expect(summary).not.toContain("## Errors");
		expect(summary).not.toContain("## Fallbacks");
	});

	test("includes model switch section when model_switch events exist", () => {
		const log = makeSessionLog({
			events: [
				event({
					projectRoot: "/tmp/project",
					domain: "session",
					timestamp: "2026-04-01T10:05:00Z",
					sessionId: "test-session-001",
					type: "model_switch",
					payload: {
						fromModel: "anthropic/claude-3-opus",
						toModel: "anthropic/claude-3-sonnet",
						trigger: "fallback",
					},
				}),
			],
		});

		const summary = generateSessionSummary(log);

		expect(summary).toContain("## Model Switches");
		expect(summary).toContain("anthropic/claude-3-opus");
		expect(summary).toContain("anthropic/claude-3-sonnet");
		expect(summary).toContain("fallback");
	});

	test("includes strategic summary paragraph", () => {
		const log = makeSessionLog({
			events: [
				event({
					projectRoot: "/tmp/project",
					domain: "session",
					timestamp: "2026-04-01T10:05:00Z",
					sessionId: "test-session-001",
					type: "error",
					code: "rate_limit",
					message: "Rate limited",
					payload: { errorType: "rate_limit", model: "test-model" },
				}),
			],
			decisions: [
				{
					timestamp: "2026-04-01T10:10:00Z",
					phase: "BUILD",
					agent: "oc-implementer",
					decision: "Test decision",
					rationale: "Test rationale",
				},
			],
			errorSummary: { rate_limit: 1 },
		});

		const summary = generateSessionSummary(log);

		expect(summary).toContain("## Summary");
	});

	test("handles null endedAt gracefully", () => {
		const log = makeSessionLog({ endedAt: null });
		const summary = generateSessionSummary(log);

		expect(summary).toContain("# Session Summary");
		expect(summary).toContain("In progress");
	});
});

describe("formatDuration", () => {
	test("converts milliseconds to seconds format", () => {
		expect(formatDuration(5000)).toBe("5s");
	});

	test("converts milliseconds to minutes and seconds", () => {
		expect(formatDuration(150000)).toBe("2m 30s");
	});

	test("converts milliseconds to hours and minutes", () => {
		expect(formatDuration(3_660_000)).toBe("1h 1m");
	});

	test("handles zero milliseconds", () => {
		expect(formatDuration(0)).toBe("0s");
	});

	test("handles exactly one minute", () => {
		expect(formatDuration(60_000)).toBe("1m 0s");
	});

	test("handles exactly one hour", () => {
		expect(formatDuration(3_600_000)).toBe("1h 0m");
	});
});

describe("formatCost", () => {
	test("formats cost as USD string", () => {
		expect(formatCost(0.0234)).toBe("$0.0234");
	});

	test("formats zero cost", () => {
		expect(formatCost(0)).toBe("$0.0000");
	});

	test("formats small cost", () => {
		expect(formatCost(0.0001)).toBe("$0.0001");
	});

	test("formats larger cost", () => {
		expect(formatCost(1.2345)).toBe("$1.2345");
	});
});

describe("computeDuration", () => {
	test("computes duration in ms from startedAt and endedAt", () => {
		const log = makeSessionLog({
			startedAt: "2026-04-01T10:00:00.000Z",
			endedAt: "2026-04-01T10:30:00.000Z",
		});

		expect(computeDuration(log)).toBe(30 * 60 * 1000);
	});

	test("returns 0 when endedAt is null", () => {
		const log = makeSessionLog({ endedAt: null });
		expect(computeDuration(log)).toBe(0);
	});
});
