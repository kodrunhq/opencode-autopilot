import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createForensicEvent, resetDedupCache } from "../../src/observability/forensic-log";
import { writeSessionLog } from "../../src/observability/log-writer";

function makeEvents(projectRoot: string, sessionId: string) {
	return [
		createForensicEvent({
			projectRoot,
			domain: "session",
			timestamp: "2026-04-01T10:00:00.000Z",
			sessionId,
			type: "error",
			code: "rate_limit",
			message: "Rate limited",
			payload: { errorType: "rate_limit", model: "anthropic/claude-3-opus" },
		}),
		createForensicEvent({
			projectRoot,
			domain: "session",
			timestamp: "2026-04-01T10:00:05.000Z",
			sessionId,
			type: "fallback",
			code: "FALLBACK",
			payload: {
				failedModel: "anthropic/claude-3-opus",
				nextModel: "anthropic/claude-3-sonnet",
				reason: "rate_limit",
				success: true,
			},
		}),
		createForensicEvent({
			projectRoot,
			domain: "session",
			timestamp: "2026-04-01T10:01:00.000Z",
			sessionId,
			phase: "BUILD",
			agent: "oc-implementer",
			type: "decision",
			payload: {
				decision: "Use spread pattern for immutability",
				rationale: "Follows project CLAUDE.md constraints",
			},
		}),
		createForensicEvent({
			projectRoot,
			domain: "session",
			timestamp: "2026-04-01T10:02:00.000Z",
			sessionId,
			type: "model_switch",
			payload: {
				fromModel: "anthropic/claude-3-opus",
				toModel: "anthropic/claude-3-sonnet",
				trigger: "fallback",
			},
		}),
	] as const;
}

describe("writeSessionLog", () => {
	let projectRoot: string;
	let artifactDir: string;

	beforeEach(async () => {
		resetDedupCache();
		projectRoot = join(tmpdir(), `log-writer-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		artifactDir = join(projectRoot, ".opencode-autopilot");
		await mkdir(artifactDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(projectRoot, { recursive: true, force: true });
	});

	test("appends forensic JSONL lines to orchestration log", async () => {
		const sessionId = "test-session-001";
		await writeSessionLog({
			projectRoot,
			sessionId,
			startedAt: "2026-04-01T10:00:00.000Z",
			events: makeEvents(projectRoot, sessionId),
		});

		const content = await readFile(join(artifactDir, "orchestration.jsonl"), "utf-8");
		const lines = content.trim().split("\n");
		expect(lines).toHaveLength(4);
		const first = JSON.parse(lines[0]);
		expect(first.domain).toBe("session");
		expect(first.type).toBe("error");
	});

	test("persists decision and model metadata in payload", async () => {
		const sessionId = "test-session-structure";
		await writeSessionLog({
			projectRoot,
			sessionId,
			startedAt: "2026-04-01T10:00:00.000Z",
			events: makeEvents(projectRoot, sessionId),
		});

		const content = await readFile(join(artifactDir, "orchestration.jsonl"), "utf-8");
		const parsed = content
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));

		expect(parsed.some((event) => event.type === "decision")).toBe(true);
		expect(parsed.some((event) => event.type === "model_switch")).toBe(true);
	});

	test("handles empty events gracefully", async () => {
		await writeSessionLog({
			projectRoot,
			sessionId: "test-session-empty",
			startedAt: "2026-04-01T10:00:00.000Z",
			events: [],
		});

		await expect(readFile(join(artifactDir, "orchestration.jsonl"), "utf-8")).rejects.toThrow();
	});
});
