import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { doctorCore } from "../../src/tools/doctor";

describe("doctorCore", () => {
	test("returns allPassed true when plugin is healthy", async () => {
		// Create a temp dir with a valid config file
		const tempDir = join(tmpdir(), `doctor-healthy-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "opencode-autopilot.json");
		const { writeFile } = await import("node:fs/promises");
		await writeFile(
			configPath,
			JSON.stringify({
				version: 4,
				configured: true,
				groups: {
					architects: { primary: "a/m1", fallbacks: [] },
					challengers: { primary: "a/m2", fallbacks: [] },
					builders: { primary: "a/m3", fallbacks: [] },
					reviewers: { primary: "a/m4", fallbacks: [] },
					"red-team": { primary: "a/m5", fallbacks: [] },
					researchers: { primary: "a/m6", fallbacks: [] },
					communicators: { primary: "a/m7", fallbacks: [] },
					utilities: { primary: "a/m8", fallbacks: [] },
				},
				overrides: {},
				orchestrator: {},
				confidence: {},
				fallback: {},
			}),
		);

		// Simulate all 15 agents injected
		const agentMap: Record<string, unknown> = {};
		for (const name of [
			"researcher",
			"metaprompter",
			"documenter",
			"pr-reviewer",
			"autopilot",
			"oc-researcher",
			"oc-challenger",
			"oc-architect",
			"oc-critic",
			"oc-explorer",
			"oc-planner",
			"oc-implementer",
			"oc-reviewer",
			"oc-shipper",
			"oc-retrospector",
		]) {
			agentMap[name] = { systemPrompt: "test" };
		}

		// Create expected command files for commandHealthCheck
		const commandsDir = join(tempDir, "commands");
		await mkdir(commandsDir, { recursive: true });
		const expectedCommands = [
			"oc-tdd",
			"oc-review-pr",
			"oc-brainstorm",
			"oc-write-plan",
			"oc-stocktake",
			"oc-update-docs",
			"oc-new-agent",
			"oc-new-skill",
			"oc-new-command",
			"oc-quick",
			"oc-review-agents",
		];
		for (const cmd of expectedCommands) {
			await writeFile(
				join(commandsDir, `${cmd}.md`),
				`---\ndescription: Test ${cmd}\n---\nContent`,
			);
		}

		// Create memory DB for memoryHealthCheck
		const memoryDir = join(tempDir, "memory");
		await mkdir(memoryDir, { recursive: true });
		const { Database } = await import("bun:sqlite");
		const db = new Database(join(memoryDir, "memory.db"));
		db.run("CREATE TABLE observations (id INTEGER PRIMARY KEY, content TEXT NOT NULL)");
		db.close();

		const result = JSON.parse(
			await doctorCore({
				configPath,
				openCodeConfig: { agent: agentMap } as unknown as import("@opencode-ai/plugin").Config,
				targetDir: tempDir,
				projectRoot: tempDir,
			}),
		);

		expect(result.action).toBe("doctor");
		expect(result.allPassed).toBe(true);
		expect(result.contractHealth).toBeDefined();
		expect(result.contractHealth.legacyTasksFallbackSeen).toBe(false);
		expect(result.contractHealth.legacyResultParserSeen).toBe(false);
		for (const check of result.checks) {
			expect(check.status).toBe("pass");
		}

		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns allPassed false when config check fails", async () => {
		const result = JSON.parse(
			await doctorCore({
				configPath: "/nonexistent/path/config.json",
				openCodeConfig: null,
				targetDir: "/nonexistent/target",
			}),
		);

		expect(result.action).toBe("doctor");
		expect(result.allPassed).toBe(false);
		expect(result.contractHealth).toBeDefined();

		const failedChecks = result.checks.filter((c: { status: string }) => c.status === "fail");
		expect(failedChecks.length).toBeGreaterThan(0);

		// Failed checks should have fixSuggestion strings
		for (const check of failedChecks) {
			expect(check.fixSuggestion).toBeDefined();
			expect(typeof check.fixSuggestion).toBe("string");
		}
	});

	test("each check includes name, status, message, and fixSuggestion fields", async () => {
		const result = JSON.parse(
			await doctorCore({
				configPath: "/nonexistent/path/config.json",
				openCodeConfig: null,
				targetDir: "/nonexistent/target",
			}),
		);

		expect(result.checks.length).toBeGreaterThan(0);
		for (const check of result.checks) {
			expect(typeof check.name).toBe("string");
			expect(["pass", "fail"]).toContain(check.status);
			expect(typeof check.message).toBe("string");
			// fixSuggestion is string for failed checks, null for passed
			expect(check.fixSuggestion === null || typeof check.fixSuggestion === "string").toBe(true);
		}
	});

	test("includes hook-registration check that verifies plugin is loaded", async () => {
		const result = JSON.parse(
			await doctorCore({
				configPath: "/nonexistent/path/config.json",
				openCodeConfig: null,
				targetDir: "/nonexistent/target",
			}),
		);

		const hookCheck = result.checks.find((c: { name: string }) => c.name === "hook-registration");
		expect(hookCheck).toBeDefined();
		expect(hookCheck.status).toBe("pass");
		expect(hookCheck.message).toContain("registered");
	});

	test("output includes displayText with human-readable pass/fail lines", async () => {
		const result = JSON.parse(
			await doctorCore({
				configPath: "/nonexistent/path/config.json",
				openCodeConfig: null,
				targetDir: "/nonexistent/target",
			}),
		);

		expect(typeof result.displayText).toBe("string");
		// Should contain OK or FAIL markers
		expect(result.displayText).toMatch(/\[(OK|FAIL)\]/);
		// Should contain "Completed in" duration line
		expect(result.displayText).toContain("Completed in");
		// Fix suggestions appear for failed checks
		expect(result.displayText).toContain("Fix:");
	});

	test("detects legacy parser usage from orchestration log", async () => {
		const tempDir = join(tmpdir(), `doctor-contract-${Date.now()}`);
		await mkdir(join(tempDir, ".opencode-autopilot"), { recursive: true });
		await writeFile(
			join(tempDir, ".opencode-autopilot", "orchestration.jsonl"),
			"[opencode-autopilot] PLAN fallback: parsed legacy tasks.md (tasks.json missing)\n",
			"utf-8",
		);

		const result = JSON.parse(await doctorCore({ projectRoot: tempDir }));
		expect(result.contractHealth.legacyTasksFallbackSeen).toBe(true);

		await rm(tempDir, { recursive: true, force: true });
	});
});
