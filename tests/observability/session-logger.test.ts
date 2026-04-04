import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createForensicEvent } from "../../src/observability/forensic-log";
import { getSessionLog, logEvent } from "../../src/observability/session-logger";

describe("session-logger", () => {
	let projectRoot: string;

	beforeEach(async () => {
		projectRoot = join(
			tmpdir(),
			`session-logs-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		await mkdir(join(projectRoot, ".opencode-autopilot"), { recursive: true });
	});

	afterEach(async () => {
		await rm(projectRoot, { recursive: true, force: true });
	});

	test("logEvent persists a forensic session event", async () => {
		const event = createForensicEvent({
			projectRoot,
			domain: "session",
			timestamp: new Date().toISOString(),
			sessionId: "session-001",
			type: "fallback",
			code: "FALLBACK",
			payload: {
				failedModel: "anthropic/claude-3-opus",
				nextModel: "anthropic/claude-3-sonnet",
				reason: "rate_limit",
				success: true,
			},
		});

		await logEvent(event, projectRoot);
		const events = await getSessionLog("session-001", projectRoot);
		expect(events).toHaveLength(1);
		expect(events[0].type).toBe("fallback");
	});

	test("getSessionLog returns events in append order", async () => {
		await logEvent(
			createForensicEvent({
				projectRoot,
				domain: "session",
				timestamp: "2026-04-01T10:00:00Z",
				sessionId: "session-002",
				type: "error",
				code: "rate_limit",
				message: "Rate limited",
				payload: { errorType: "rate_limit", model: "anthropic/claude-3-opus" },
			}),
			projectRoot,
		);
		await logEvent(
			createForensicEvent({
				projectRoot,
				domain: "session",
				timestamp: "2026-04-01T10:01:00Z",
				sessionId: "session-002",
				type: "model_switch",
				payload: {
					fromModel: "anthropic/claude-3-opus",
					toModel: "anthropic/claude-3-sonnet",
					trigger: "fallback",
				},
			}),
			projectRoot,
		);

		const events = await getSessionLog("session-002", projectRoot);
		expect(events).toHaveLength(2);
		expect(events[0].type).toBe("error");
		expect(events[1].type).toBe("model_switch");
	});
});
