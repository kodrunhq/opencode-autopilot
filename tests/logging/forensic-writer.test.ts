import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createForensicSink,
	createForensicSinkForArtifactDir,
} from "../../src/logging/forensic-writer";
import { resetDedupCache } from "../../src/observability/forensic-log";

describe("ForensicWriter", () => {
	let tempDir: string;

	beforeEach(() => {
		resetDedupCache();
		tempDir = join(
			tmpdir(),
			`forensic-writer-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	async function readLines(artifactDir: string): Promise<Record<string, unknown>[]> {
		const content = await readFile(join(artifactDir, "orchestration.jsonl"), "utf-8");
		return content
			.trim()
			.split("\n")
			.filter(Boolean)
			.map((l) => JSON.parse(l) as Record<string, unknown>);
	}

	it("maps LogEntry to a forensic event and writes JSONL", async () => {
		const sink = createForensicSink(tempDir);

		sink.write({
			timestamp: "2026-04-05T12:00:00.000Z",
			level: "ERROR",
			message: "Test error message",
			metadata: {
				domain: "orchestrator",
				operation: "error",
				runId: "run-123",
				extra: "data",
			},
		});

		const artifactDir = join(tempDir, ".opencode-autopilot");
		const lines = await readLines(artifactDir);
		expect(lines.length).toBeGreaterThanOrEqual(1);

		const parsed = lines[lines.length - 1];
		expect(parsed.domain).toBe("orchestrator");
		expect(parsed.type).toBe("error");
		expect(parsed.message).toBe("Test error message");
	});

	it("defaults domain to system when an invalid domain is given", async () => {
		const sink = createForensicSink(tempDir);

		sink.write({
			timestamp: "2026-04-05T12:00:00.000Z",
			level: "INFO",
			message: "Test info message",
			metadata: { domain: "invalid-domain" },
		});

		const artifactDir = join(tempDir, ".opencode-autopilot");
		const lines = await readLines(artifactDir);
		expect(lines[lines.length - 1].domain).toBe("system");
	});

	it("maps log levels to forensic event types when operation is absent", async () => {
		const sink = createForensicSink(tempDir);

		const levels: Array<{ level: "ERROR" | "WARN" | "INFO" | "DEBUG"; expected: string }> = [
			{ level: "ERROR", expected: "error" },
			{ level: "WARN", expected: "warning" },
			{ level: "INFO", expected: "info" },
			{ level: "DEBUG", expected: "debug" },
		];

		for (const { level } of levels) {
			sink.write({
				timestamp: "2026-04-05T12:00:00.000Z",
				level,
				message: "msg",
				metadata: { domain: "orchestrator" },
			});
		}

		const artifactDir = join(tempDir, ".opencode-autopilot");
		const lines = await readLines(artifactDir);

		for (let i = 0; i < levels.length; i++) {
			expect(lines[i].type).toBe(levels[i].expected);
		}
	});

	it("uses operation field when it is a valid ForensicEventType", async () => {
		const sink = createForensicSink(tempDir);

		sink.write({
			timestamp: "2026-04-05T12:00:00.000Z",
			level: "INFO",
			message: "Test message",
			metadata: { domain: "orchestrator", operation: "phase_transition" },
		});

		const artifactDir = join(tempDir, ".opencode-autopilot");
		const lines = await readLines(artifactDir);
		expect(lines[lines.length - 1].type).toBe("phase_transition");
	});

	it("createForensicSinkForArtifactDir writes directly to the artifact dir", async () => {
		const artifactDir = join(tempDir, ".opencode-autopilot");
		const sink = createForensicSinkForArtifactDir(artifactDir);

		sink.write({
			timestamp: "2026-04-05T12:00:00.000Z",
			level: "INFO",
			message: "Direct write",
			metadata: { domain: "session", operation: "dispatch", sessionId: "sess-abc" },
		});

		const lines = await readLines(artifactDir);
		expect(lines.length).toBeGreaterThanOrEqual(1);

		const parsed = lines[lines.length - 1];
		expect(parsed.domain).toBe("session");
		expect(parsed.type).toBe("dispatch");
	});
});
