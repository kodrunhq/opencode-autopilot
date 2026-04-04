import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	logOrchestrationEvent,
	type OrchestrationEvent,
} from "../../src/orchestrator/orchestration-logger";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "orch-logger-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("logOrchestrationEvent", () => {
	test("writes valid JSONL line to file", async () => {
		const event: OrchestrationEvent = {
			timestamp: "2026-04-04T00:00:00.000Z",
			phase: "RECON",
			action: "dispatch",
			agent: "oc-researcher",
			promptLength: 42,
		};

		logOrchestrationEvent(tempDir, event);

		const content = await readFile(join(tempDir, "orchestration.jsonl"), "utf-8");
		const lines = content.trim().split("\n");
		expect(lines).toHaveLength(1);

		const parsed = JSON.parse(lines[0]);
		expect(parsed.timestamp).toBe("2026-04-04T00:00:00.000Z");
		expect(parsed.phase).toBe("RECON");
		expect(parsed.type).toBe("dispatch");
		expect(parsed.agent).toBe("oc-researcher");
		expect(parsed.payload.promptLength).toBe(42);
		expect(parsed.domain).toBe("orchestrator");
	});

	test("appends multiple events (does not overwrite)", async () => {
		logOrchestrationEvent(tempDir, {
			timestamp: "2026-04-04T00:00:00.000Z",
			phase: "RECON",
			action: "dispatch",
		});
		logOrchestrationEvent(tempDir, {
			timestamp: "2026-04-04T00:01:00.000Z",
			phase: "CHALLENGE",
			action: "complete",
		});

		const content = await readFile(join(tempDir, "orchestration.jsonl"), "utf-8");
		const lines = content.trim().split("\n");
		expect(lines).toHaveLength(2);

		const first = JSON.parse(lines[0]);
		const second = JSON.parse(lines[1]);
		expect(first.phase).toBe("RECON");
		expect(second.phase).toBe("CHALLENGE");
	});

	test("does not throw on unwritable path", () => {
		// /dev/null/impossible is not a valid directory; logOrchestrationEvent
		// swallows the error silently (best-effort logging).
		expect(() => {
			logOrchestrationEvent("/dev/null/impossible", {
				timestamp: new Date().toISOString(),
				phase: "RECON",
				action: "dispatch",
			});
		}).not.toThrow();
	});

	test("includes all action variants", async () => {
		const actions = ["dispatch", "dispatch_multi", "complete", "error", "loop_detected"] as const;

		for (const action of actions) {
			logOrchestrationEvent(tempDir, {
				timestamp: new Date().toISOString(),
				phase: "BUILD",
				action,
			});
		}

		const content = await readFile(join(tempDir, "orchestration.jsonl"), "utf-8");
		const lines = content.trim().split("\n");
		expect(lines).toHaveLength(actions.length);

		const parsedActions = lines.map((line) => JSON.parse(line).type);
		for (const action of actions) {
			expect(parsedActions).toContain(action);
		}
	});
});
