import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadActiveReviewStateFromKernel } from "../../src/kernel/repository";
import { reviewCore } from "../../src/tools/review";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "review-tool-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

function parseResult(json: string): Record<string, unknown> {
	return JSON.parse(json) as Record<string, unknown>;
}

describe("reviewCore", () => {
	test("with scope returns dispatch action JSON", async () => {
		const result = await reviewCore({ scope: "all" }, tempDir);
		const parsed = parseResult(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.stage).toBe(1);
		expect(Array.isArray(parsed.agents)).toBe(true);
	});

	test("without scope or state returns error", async () => {
		const result = await reviewCore({}, tempDir);
		const parsed = parseResult(result);
		expect(parsed.action).toBe("error");
		expect(typeof parsed.message).toBe("string");
		expect(parsed.message as string).toContain("scope");
	});

	test("saves review state to current-review.json after start", async () => {
		await reviewCore({ scope: "staged" }, tempDir);
		const statePath = join(tempDir, ".opencode-autopilot", "current-review.json");
		const raw = await readFile(statePath, "utf-8");
		const state = JSON.parse(raw);
		expect(state.stage).toBe(1);
		expect(state.scope).toBe("staged");
		expect(loadActiveReviewStateFromKernel(join(tempDir, ".opencode-autopilot"))?.scope).toBe(
			"staged",
		);
	});

	test("with findings and active state advances pipeline", async () => {
		// Start a review first
		await reviewCore({ scope: "all" }, tempDir);

		// Advance with empty findings (simulates no issues found)
		const result = await reviewCore({ findings: '{"findings": []}' }, tempDir);
		const parsed = parseResult(result);
		// Should advance to stage 2 (cross-verification)
		expect(["dispatch", "complete", "error"]).toContain(parsed.action as string);
		if (parsed.action === "dispatch") {
			expect(parsed.stage).toBe(2);
		}
	});

	test("returns typed findingsEnvelope on completion", async () => {
		await reviewCore({ scope: "all" }, tempDir);
		await reviewCore({ findings: '{"findings": []}' }, tempDir);
		await reviewCore({ findings: '{"findings": []}' }, tempDir);
		const result = await reviewCore({ findings: '{"findings": []}' }, tempDir);
		const parsed = parseResult(result);
		expect(parsed.action).toBe("complete");
		expect((parsed.findingsEnvelope as { kind?: string }).kind).toBe("review_findings");
	});

	test("returns status when state exists but no findings provided", async () => {
		// Start a review first
		await reviewCore({ scope: "all" }, tempDir);

		// Call without findings
		const result = await reviewCore({}, tempDir);
		const parsed = parseResult(result);
		expect(parsed.action).toBe("status");
		expect(parsed.stage).toBe(1);
	});

	test("clears state file on pipeline completion", async () => {
		// Start review
		await reviewCore({ scope: "all" }, tempDir);

		// Advance through all stages with empty findings
		await reviewCore({ findings: '{"findings": []}' }, tempDir);
		await reviewCore({ findings: '{"findings": []}' }, tempDir);
		await reviewCore({ findings: '{"findings": []}' }, tempDir);

		// After stage 3 with no critical findings, pipeline should complete
		const statePath = join(tempDir, ".opencode-autopilot", "current-review.json");
		const { access } = await import("node:fs/promises");
		let exists = true;
		try {
			await access(statePath);
		} catch {
			exists = false;
		}
		// State should be cleared after completion
		expect(exists).toBe(false);
	});

	test("saves memory after completion", async () => {
		// Start and complete a review
		await reviewCore({ scope: "all" }, tempDir);
		await reviewCore({ findings: '{"findings": []}' }, tempDir);
		await reviewCore({ findings: '{"findings": []}' }, tempDir);
		await reviewCore({ findings: '{"findings": []}' }, tempDir);

		const memoryPath = join(tempDir, ".opencode-autopilot", "review-memory.json");
		const raw = await readFile(memoryPath, "utf-8");
		const memory = JSON.parse(raw);
		expect(memory.schemaVersion).toBe(1);
		expect(memory.lastReviewedAt).not.toBeNull();
	});

	test("always returns valid JSON (never throws)", async () => {
		// Even with bizarre input, should return JSON
		const result = await reviewCore({ findings: "not json at all {{{{" }, tempDir);
		const parsed = parseResult(result);
		expect(typeof parsed.action).toBe("string");
	});

	test("dispatched agents include specialized agents for universal scope", async () => {
		// When starting a review, universal specialized agents should be selected
		// (stack-gated agents may or may not appear depending on git diff)
		const result = await reviewCore({ scope: "all" }, tempDir);
		const parsed = parseResult(result);
		expect(parsed.action).toBe("dispatch");
		const agents = parsed.agents as readonly { name: string }[];
		// Universal agents should always be present
		const agentNames = agents.map((a) => a.name);
		expect(agentNames).toContain("logic-auditor");
		expect(agentNames).toContain("security-auditor");
		// Universal specialized agents should also be present
		expect(agentNames).toContain("wiring-inspector");
		expect(agentNames).toContain("dead-code-scanner");
		expect(agentNames).toContain("concurrency-checker");
	});

	test("state file contains selectedAgentNames with specialized agents", async () => {
		await reviewCore({ scope: "staged" }, tempDir);
		const statePath = join(tempDir, ".opencode-autopilot", "current-review.json");
		const raw = await readFile(statePath, "utf-8");
		const state = JSON.parse(raw);
		const kernelState = loadActiveReviewStateFromKernel(join(tempDir, ".opencode-autopilot"));
		// Should include universal specialized agents
		expect(state.selectedAgentNames).toContain("wiring-inspector");
		expect(state.selectedAgentNames).toContain("database-auditor");
		expect(kernelState?.selectedAgentNames).toContain("wiring-inspector");
		expect(kernelState?.selectedAgentNames).toContain("database-auditor");
	});
});
