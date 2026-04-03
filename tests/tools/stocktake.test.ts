import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stocktakeCore } from "../../src/tools/stocktake";

describe("stocktakeCore", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "oc-test-stocktake-"));
		// Create directory structure
		await mkdir(join(tempDir, "skills", "my-skill"), { recursive: true });
		await mkdir(join(tempDir, "commands"), { recursive: true });
		await mkdir(join(tempDir, "agents"), { recursive: true });

		// Write test assets
		await writeFile(
			join(tempDir, "skills", "my-skill", "SKILL.md"),
			"---\nname: my-skill\ndescription: A test skill\nstacks: []\nrequires: []\n---\n# Content",
		);
		await writeFile(
			join(tempDir, "commands", "test-cmd.md"),
			"---\ndescription: A test command\n---\nBody content",
		);
		await writeFile(
			join(tempDir, "agents", "test-agent.md"),
			"---\nname: test-agent\n---\nAgent prompt",
		);
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("returns a report listing all assets", async () => {
		const result = await stocktakeCore({ lint: false }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.skills.length).toBe(1);
		expect(parsed.commands.length).toBe(1);
		expect(parsed.agents.length).toBe(1);
		expect(parsed.summary.total).toBe(3);
	});

	it("includes lint results when lint is true", async () => {
		const result = await stocktakeCore({ lint: true }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.skills[0].lint).toBeDefined();
		expect(parsed.skills[0].lint.valid).toBe(true);
	});

	it("reports lint failures for invalid assets", async () => {
		// Write an invalid skill (missing name field)
		await writeFile(
			join(tempDir, "skills", "my-skill", "SKILL.md"),
			"---\ndescription: Missing name\nstacks: []\nrequires: []\n---\n# Content",
		);
		const result = await stocktakeCore({ lint: true }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.skills[0].lint.valid).toBe(false);
	});

	it("handles empty directories gracefully", async () => {
		const emptyDir = await mkdtemp(join(tmpdir(), "oc-test-empty-"));
		const result = await stocktakeCore({ lint: false }, emptyDir);
		const parsed = JSON.parse(result);
		expect(parsed.summary.total).toBe(0);
		await rm(emptyDir, { recursive: true, force: true });
	});

	// ── Config-hook agent detection tests ──────────────────────────

	it("returns config-hook agents with origin config-hook", async () => {
		const configHookAgents = [
			{ name: "mock-agent", config: { mode: "subagent", hidden: true }, group: "utilities" },
			{ name: "mock-primary", config: { mode: "all" }, group: "architects" },
		];
		const result = await stocktakeCore({ lint: false }, tempDir, configHookAgents);
		const parsed = JSON.parse(result);
		const hookAgents = parsed.agents.filter((a: { origin: string }) => a.origin === "config-hook");
		expect(hookAgents.length).toBe(2);
		expect(hookAgents[0].name).toBe("mock-agent");
		expect(hookAgents[1].name).toBe("mock-primary");
	});

	it("populates mode, group, and hidden fields on config-hook agents", async () => {
		const configHookAgents = [
			{ name: "mock-agent", config: { mode: "subagent", hidden: true }, group: "utilities" },
		];
		const result = await stocktakeCore({ lint: false }, tempDir, configHookAgents);
		const parsed = JSON.parse(result);
		const hookAgent = parsed.agents.find((a: { origin: string }) => a.origin === "config-hook");
		expect(hookAgent.mode).toBe("subagent");
		expect(hookAgent.group).toBe("utilities");
		expect(hookAgent.hidden).toBe(true);
	});

	it("filesystem agents still detected with built-in or user-created origin", async () => {
		const configHookAgents = [
			{ name: "mock-agent", config: { mode: "subagent" }, group: "utilities" },
		];
		const result = await stocktakeCore({ lint: false }, tempDir, configHookAgents);
		const parsed = JSON.parse(result);
		const fsAgent = parsed.agents.find((a: { name: string }) => a.name === "test-agent");
		expect(fsAgent).toBeDefined();
		expect(["built-in", "user-created"]).toContain(fsAgent.origin);
	});

	it("deduplicates filesystem vs config-hook agents — filesystem wins", async () => {
		// test-agent exists on filesystem, also passed as config-hook
		const configHookAgents = [
			{ name: "test-agent", config: { mode: "all", hidden: false }, group: "architects" },
			{ name: "unique-hook", config: { mode: "subagent" }, group: "utilities" },
		];
		const result = await stocktakeCore({ lint: false }, tempDir, configHookAgents);
		const parsed = JSON.parse(result);
		const testAgents = parsed.agents.filter((a: { name: string }) => a.name === "test-agent");
		// Only one entry — the filesystem one
		expect(testAgents.length).toBe(1);
		expect(testAgents[0].origin).not.toBe("config-hook");
		// unique-hook should still be present
		const uniqueHook = parsed.agents.find((a: { name: string }) => a.name === "unique-hook");
		expect(uniqueHook).toBeDefined();
		expect(uniqueHook.origin).toBe("config-hook");
	});

	it("summary includes configHook count", async () => {
		const configHookAgents = [
			{ name: "mock-agent", config: { mode: "subagent" }, group: "utilities" },
			{ name: "mock-primary", config: { mode: "all" }, group: "architects" },
		];
		const result = await stocktakeCore({ lint: false }, tempDir, configHookAgents);
		const parsed = JSON.parse(result);
		expect(parsed.summary.configHook).toBe(2);
	});

	it("works without configHookAgents param (backward compat)", async () => {
		const result = await stocktakeCore({ lint: false }, tempDir);
		const parsed = JSON.parse(result);
		// Should work exactly as before
		expect(parsed.agents.length).toBe(1);
		expect(parsed.summary.total).toBe(3);
		// configHook should be 0
		expect(parsed.summary.configHook).toBe(0);
	});

	it("total agent count includes both filesystem and config-hook agents", async () => {
		const configHookAgents = [
			{ name: "hook-a", config: { mode: "subagent" }, group: "utilities" },
			{ name: "hook-b", config: { mode: "all" }, group: "architects" },
		];
		const result = await stocktakeCore({ lint: false }, tempDir, configHookAgents);
		const parsed = JSON.parse(result);
		// 1 filesystem + 2 config-hook = 3 agents, plus 1 skill + 1 command = 5 total
		expect(parsed.agents.length).toBe(3);
		expect(parsed.summary.total).toBe(5);
	});
});
