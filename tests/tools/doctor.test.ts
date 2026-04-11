import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolContext } from "@opencode-ai/plugin";
import { createForensicEvent } from "../../src/observability/forensic-log";
import {
	doctorCore,
	ocDoctor,
	setOpenCodeConfig as setDoctorOpenCodeConfig,
} from "../../src/tools/doctor";

function createToolContext(directory: string): ToolContext {
	return {
		sessionID: "ses-test",
		messageID: "msg-test",
		agent: "tester",
		directory,
		worktree: directory,
		abort: new AbortController().signal,
		metadata(_input: Parameters<ToolContext["metadata"]>[0]) {},
		ask: async (_input: Parameters<ToolContext["ask"]>[0]) => {},
	};
}

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

		// Simulate all agents injected (9 standard + 8 pipeline + 2 suppressed native)
		const agentMap: Record<string, unknown> = {};
		for (const name of [
			"autopilot",
			"coder",
			"debugger",
			"metaprompter",
			"specialist-planner",
			"pr-reviewer",
			"specialist-researcher",
			"specialist-reviewer",
			"security-auditor",
			"oc-researcher",
			"oc-challenger",
			"oc-architect",
			"oc-critic",
			"oc-planner",
			"oc-implementer",
			"oc-reviewer",
			"oc-shipper",
		]) {
			agentMap[name] = { systemPrompt: "test" };
		}
		agentMap.plan = { disable: true, mode: "subagent", hidden: true };
		agentMap.build = { disable: true, mode: "subagent", hidden: true };

		// Create expected command files for commandHealthCheck
		const commandsDir = join(tempDir, "commands");
		await mkdir(commandsDir, { recursive: true });
		const expectedCommands = [
			"oc-brainstorm",
			"oc-doctor",
			"oc-new-agent",
			"oc-new-command",
			"oc-new-skill",
			"oc-quick",
			"oc-refactor",
			"oc-review-agents",
			"oc-review-pr",
			"oc-security-audit",
			"oc-stocktake",
			"oc-tdd",
			"oc-update-docs",
			"oc-write-plan",
		];
		for (const cmd of expectedCommands) {
			await writeFile(
				join(commandsDir, `${cmd}.md`),
				`---\ndescription: Test ${cmd}\n---\nContent`,
			);
		}

		// Create memory DB for memoryHealthCheck
		await mkdir(tempDir, { recursive: true });
		const { Database } = await import("bun:sqlite");
		const db = new Database(join(tempDir, "autopilot.db"));
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
			expect(["pass", "warn"]).toContain(check.status);
		}
		const suppressionCheck = result.checks.find(
			(c: { name: string }) => c.name === "native-agent-suppression",
		);
		expect(suppressionCheck).toBeDefined();
		expect(suppressionCheck.status).toBe("pass");

		await rm(tempDir, { recursive: true, force: true });
	});

	test("reports native-agent-suppression failure with fix suggestion", async () => {
		const result = JSON.parse(
			await doctorCore({
				configPath: "/nonexistent/path/config.json",
				openCodeConfig: {
					agent: { plan: { mode: "all" }, build: { mode: "all" } },
				} as unknown as import("@opencode-ai/plugin").Config,
				targetDir: "/nonexistent/target",
			}),
		);

		const suppressionCheck = result.checks.find(
			(c: { name: string }) => c.name === "native-agent-suppression",
		);
		expect(suppressionCheck).toBeDefined();
		expect(suppressionCheck.status).toBe("fail");
		expect(typeof suppressionCheck.fixSuggestion).toBe("string");
		expect(suppressionCheck.fixSuggestion).toContain("Restart OpenCode");
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
			expect(["pass", "warn", "fail"]).toContain(check.status);
			expect(typeof check.message).toBe("string");
			// fixSuggestion is string for failed checks, null for passed
			expect(check.fixSuggestion === null || typeof check.fixSuggestion === "string").toBe(true);
		}
	});

	test("includes exactly 12 checks with expected names", async () => {
		const result = JSON.parse(
			await doctorCore({
				configPath: "/nonexistent/path/config.json",
				openCodeConfig: null,
				targetDir: "/nonexistent/target",
			}),
		);

		const checkNames = result.checks.map((c: { name: string }) => c.name);
		expect(result.checks.length).toBe(12);
		expect(checkNames).toEqual([
			"config-validity",
			"agent-injection",
			"native-agent-suppression",
			"asset-directories",
			"skill-loading",
			"memory-db",
			"command-accessibility",
			"config-v7-fields",
			"routing-health",
			"mcp-health",
			"lsp-servers",
			"hook-registration",
		]);
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
		const forensicLines = [
			createForensicEvent({
				projectRoot: tempDir,
				domain: "orchestrator",
				type: "decision",
				message: "PLAN fallback: parsed legacy tasks.md (tasks.json missing)",
			}),
			createForensicEvent({
				projectRoot: tempDir,
				domain: "contract",
				type: "error",
				message:
					"Legacy result parser path used. Submit typed envelopes for deterministic replay guarantees.",
			}),
		]
			.map((event) => JSON.stringify(event))
			.join("\n");
		await writeFile(
			join(tempDir, ".opencode-autopilot", "orchestration.jsonl"),
			`${forensicLines}\n`,
			"utf-8",
		);

		const result = JSON.parse(await doctorCore({ projectRoot: tempDir }));
		expect(result.contractHealth.legacyTasksFallbackSeen).toBe(true);
		expect(result.contractHealth.legacyResultParserSeen).toBe(true);

		await rm(tempDir, { recursive: true, force: true });
	});

	test("falls back to raw text search for legacy orchestration logs", async () => {
		const tempDir = join(tmpdir(), `doctor-contract-raw-${Date.now()}`);
		await mkdir(join(tempDir, ".opencode-autopilot"), { recursive: true });
		await writeFile(
			join(tempDir, ".opencode-autopilot", "orchestration.jsonl"),
			[
				"[opencode-autopilot] PLAN fallback: parsed legacy tasks.md (tasks.json missing)",
				"Legacy result parser path used. Submit typed envelopes for deterministic replay guarantees.",
			].join("\n"),
			"utf-8",
		);

		const result = JSON.parse(await doctorCore({ projectRoot: tempDir }));
		expect(result.contractHealth.legacyTasksFallbackSeen).toBe(true);
		expect(result.contractHealth.legacyResultParserSeen).toBe(true);

		await rm(tempDir, { recursive: true, force: true });
	});
});

describe("ocDoctor tool wrapper", () => {
	test("uses injected OpenCode config for native-agent-suppression check", async () => {
		setDoctorOpenCodeConfig({
			agent: {
				plan: { disable: true, mode: "subagent", hidden: true },
				build: { disable: true, mode: "subagent", hidden: true },
			},
		} as unknown as import("@opencode-ai/plugin").Config);

		const tempDir = join(tmpdir(), `doctor-wrapper-config-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });

		const result = JSON.parse(await ocDoctor.execute({}, createToolContext(tempDir)));
		const suppressionCheck = result.checks.find(
			(c: { name: string }) => c.name === "native-agent-suppression",
		);

		expect(suppressionCheck).toBeDefined();
		expect(suppressionCheck.status).toBe("pass");

		setDoctorOpenCodeConfig(null);
		await rm(tempDir, { recursive: true, force: true });
	});

	test("uses tool context directory as projectRoot for contract health detection", async () => {
		setDoctorOpenCodeConfig({
			agent: {
				plan: { disable: true, mode: "subagent", hidden: true },
				build: { disable: true, mode: "subagent", hidden: true },
			},
		} as unknown as import("@opencode-ai/plugin").Config);

		const tempDir = join(tmpdir(), `doctor-wrapper-contract-${Date.now()}`);
		await mkdir(join(tempDir, ".opencode-autopilot"), { recursive: true });
		const forensicLines = [
			createForensicEvent({
				projectRoot: tempDir,
				domain: "orchestrator",
				type: "decision",
				message: "PLAN fallback: parsed legacy tasks.md (tasks.json missing)",
			}),
			createForensicEvent({
				projectRoot: tempDir,
				domain: "contract",
				type: "error",
				message:
					"Legacy result parser path used. Submit typed envelopes for deterministic replay guarantees.",
			}),
		]
			.map((event) => JSON.stringify(event))
			.join("\n");
		await writeFile(
			join(tempDir, ".opencode-autopilot", "orchestration.jsonl"),
			`${forensicLines}\n`,
			"utf-8",
		);

		const result = JSON.parse(await ocDoctor.execute({}, createToolContext(tempDir)));
		expect(result.contractHealth.legacyTasksFallbackSeen).toBe(true);
		expect(result.contractHealth.legacyResultParserSeen).toBe(true);

		setDoctorOpenCodeConfig(null);
		await rm(tempDir, { recursive: true, force: true });
	});
});
