import { beforeEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	commandHealthCheck,
	configV7FieldsCheck,
	mcpHealthCheck,
	memoryHealthCheck,
	nativeAgentSuppressionHealthCheck,
	routingHealthCheck,
	skillHealthCheck,
} from "../../src/health/checks";
import { resetGlobalMcpManager } from "../../src/mcp";

function createIsolatedTempDir(prefix: string): string {
	return join(import.meta.dir, `.temp-${prefix}-${randomUUID()}`);
}

// ---------------------------------------------------------------------------
// skillHealthCheck
// ---------------------------------------------------------------------------
describe("skillHealthCheck", () => {
	test("returns pass with typescript stack when tsconfig.json exists", async () => {
		const tempDir = createIsolatedTempDir("skill-check-ts");
		await mkdir(tempDir, { recursive: true });
		await writeFile(join(tempDir, "tsconfig.json"), "{}");

		// Create a skills dir with one skill
		const skillsDir = join(tempDir, "skills", "typescript");
		await mkdir(skillsDir, { recursive: true });
		await writeFile(
			join(skillsDir, "SKILL.md"),
			`---
name: typescript
description: TypeScript skill
stacks:
  - typescript
requires: []
---
Content here`,
		);

		const result = await skillHealthCheck(tempDir, join(tempDir, "skills"));
		expect(result.status).toBe("pass");
		expect(result.name).toBe("skill-loading");
		expect(result.message).toContain("typescript");

		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns pass with 0 stacks for empty project root", async () => {
		const tempDir = createIsolatedTempDir("skill-check-empty");
		await mkdir(tempDir, { recursive: true });
		// No manifest files, no skills dir

		const result = await skillHealthCheck(tempDir, join(tempDir, "skills"));
		expect(result.status).toBe("pass");
		expect(result.name).toBe("skill-loading");

		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns frozen result", async () => {
		const tempDir = createIsolatedTempDir("skill-check-frozen");
		await mkdir(tempDir, { recursive: true });

		const result = await skillHealthCheck(tempDir, join(tempDir, "skills"));
		expect(Object.isFrozen(result)).toBe(true);

		await rm(tempDir, { recursive: true, force: true });
	});
});

// ---------------------------------------------------------------------------
// memoryHealthCheck
// ---------------------------------------------------------------------------
describe("memoryHealthCheck", () => {
	test("returns pass when DB file exists and is readable", async () => {
		const tempDir = createIsolatedTempDir("mem-check-pass");
		await mkdir(tempDir, { recursive: true });

		// Create a minimal SQLite DB with observations table
		const { Database } = await import("bun:sqlite");
		const dbPath = join(tempDir, "autopilot.db");
		const db = new Database(dbPath);
		db.run("CREATE TABLE observations (id INTEGER PRIMARY KEY, content TEXT NOT NULL)");
		db.run("INSERT INTO observations (content) VALUES ('test observation')");
		db.close();

		const result = await memoryHealthCheck(tempDir);
		expect(result.status).toBe("pass");
		expect(result.name).toBe("memory-db");
		expect(result.message).toContain("1 observation");
		expect(result.message).toContain("KB");

		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns pass when DB file does not exist (fresh install)", async () => {
		const tempDir = createIsolatedTempDir("mem-check-noexist");
		await mkdir(tempDir, { recursive: true });

		const result = await memoryHealthCheck(tempDir);
		expect(result.status).toBe("pass");
		expect(result.name).toBe("memory-db");
		expect(result.message).toContain("not yet initialized");

		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns frozen result", async () => {
		const tempDir = createIsolatedTempDir("mem-check-frozen");
		await mkdir(tempDir, { recursive: true });

		const result = await memoryHealthCheck(tempDir);
		expect(Object.isFrozen(result)).toBe(true);

		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns pass when only legacy memory DB exists", async () => {
		const tempDir = createIsolatedTempDir("mem-check-legacy");
		const memoryDir = join(tempDir, "memory");
		await mkdir(memoryDir, { recursive: true });

		const { Database } = await import("bun:sqlite");
		const db = new Database(join(memoryDir, "memory.db"));
		db.run("CREATE TABLE observations (id INTEGER PRIMARY KEY, content TEXT NOT NULL)");
		db.close();

		const result = await memoryHealthCheck(tempDir);
		expect(result.status).toBe("pass");
		expect(result.message).toContain("Legacy memory DB found");

		await rm(tempDir, { recursive: true, force: true });
	});
});

// ---------------------------------------------------------------------------
// commandHealthCheck
// ---------------------------------------------------------------------------
describe("commandHealthCheck", () => {
	test("returns pass when all command files exist with valid frontmatter", async () => {
		const tempDir = createIsolatedTempDir("cmd-check-pass");
		const commandsDir = join(tempDir, "commands");
		await mkdir(commandsDir, { recursive: true });

		// Create all expected command files
		const commands = [
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
		for (const cmd of commands) {
			await writeFile(
				join(commandsDir, `${cmd}.md`),
				`---
description: Test command for ${cmd}
---
Command content`,
			);
		}

		const result = await commandHealthCheck(tempDir);
		expect(result.status).toBe("pass");
		expect(result.name).toBe("command-accessibility");
		expect(result.message).toContain(`${commands.length} commands`);

		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns fail when command files are missing", async () => {
		const tempDir = createIsolatedTempDir("cmd-check-missing");
		const commandsDir = join(tempDir, "commands");
		await mkdir(commandsDir, { recursive: true });

		// Create only one command
		await writeFile(
			join(commandsDir, "oc-tdd.md"),
			`---
description: TDD command
---
Content`,
		);

		const result = await commandHealthCheck(tempDir);
		expect(result.status).toBe("fail");
		expect(result.name).toBe("command-accessibility");
		expect(result.details).toBeDefined();
		expect(result.details?.length).toBeGreaterThan(0);

		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns frozen result", async () => {
		const tempDir = createIsolatedTempDir("cmd-check-frozen");
		await mkdir(tempDir, { recursive: true });

		const result = await commandHealthCheck(tempDir);
		expect(Object.isFrozen(result)).toBe(true);

		await rm(tempDir, { recursive: true, force: true });
	});
});

// ---------------------------------------------------------------------------
// nativeAgentSuppressionHealthCheck
// ---------------------------------------------------------------------------
describe("nativeAgentSuppressionHealthCheck", () => {
	test("returns fail when OpenCode config is missing", async () => {
		const result = await nativeAgentSuppressionHealthCheck(null);
		expect(result.status).toBe("fail");
		expect(result.name).toBe("native-agent-suppression");
		expect(result.message).toContain("No OpenCode config");
	});

	test("returns fail when native plan/build suppression is missing", async () => {
		const result = await nativeAgentSuppressionHealthCheck({
			agent: {
				plan: { mode: "all" },
				build: { mode: "all" },
			},
		} as unknown as import("@opencode-ai/plugin").Config);

		expect(result.status).toBe("fail");
		expect(result.name).toBe("native-agent-suppression");
		expect(result.details).toBeDefined();
		expect(result.details?.length).toBeGreaterThan(0);
	});

	test("returns pass when plan/build are disabled and hidden as subagents", async () => {
		const result = await nativeAgentSuppressionHealthCheck({
			agent: {
				plan: { disable: true, mode: "subagent", hidden: true },
				build: { disable: true, mode: "subagent", hidden: true },
			},
		} as unknown as import("@opencode-ai/plugin").Config);

		expect(result.status).toBe("pass");
		expect(result.name).toBe("native-agent-suppression");
		expect(result.message).toContain("suppressed");
	});

	test("returns fail when optional uppercase variants exist but are not suppressed", async () => {
		const result = await nativeAgentSuppressionHealthCheck({
			agent: {
				plan: { disable: true, mode: "subagent", hidden: true },
				build: { disable: true, mode: "subagent", hidden: true },
				Plan: { mode: "all" },
				Build: { mode: "all" },
				Planner: { mode: "all" },
				Builder: { mode: "all" },
			},
		} as unknown as import("@opencode-ai/plugin").Config);

		expect(result.status).toBe("fail");
		expect(result.details).toBeDefined();
		expect(result.details).toContain("Plan: disable must be true");
		expect(result.details).toContain("Build: disable must be true");
		expect(result.details).toContain("Planner: disable must be true");
		expect(result.details).toContain("Builder: disable must be true");
	});

	test("returns frozen result", async () => {
		const result = await nativeAgentSuppressionHealthCheck({
			agent: {
				plan: { disable: true, mode: "subagent", hidden: true },
				build: { disable: true, mode: "subagent", hidden: true },
			},
		} as unknown as import("@opencode-ai/plugin").Config);
		expect(Object.isFrozen(result)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// configV7FieldsCheck
// ---------------------------------------------------------------------------
describe("configV7FieldsCheck", () => {
	async function writeTempConfig(dir: string, payload: unknown): Promise<string> {
		const configPath = join(dir, "opencode-autopilot.json");
		await writeFile(configPath, JSON.stringify(payload));
		return configPath;
	}

	test("returns pass when all v7 fields are present", async () => {
		const tempDir = createIsolatedTempDir("v7-check-pass");
		await mkdir(tempDir, { recursive: true });

		const configPath = await writeTempConfig(tempDir, {
			version: 7,
			configured: true,
			groups: {},
			overrides: {},
			orchestrator: {
				autonomy: "full",
				strictness: "normal",
				phases: {
					recon: true,
					challenge: true,
					architect: true,
					explore: true,
					plan: true,
					build: true,
					ship: true,
					retrospective: true,
				},
			},
			confidence: { enabled: true, thresholds: { proceed: "MEDIUM", abort: "LOW" } },
			fallback: {
				enabled: true,
				notifyOnFallback: true,
				cooldownMinutes: 10,
				maxFallbacksPerSession: 5,
				testMode: { forceError: false, forcedErrorType: null },
			},
			memory: { enabled: true, injectionBudget: 2000, decayHalfLifeDays: 90 },
			background: {},
			routing: {},
			recovery: {},
			mcp: {},
		});

		const result = await configV7FieldsCheck(configPath);
		expect(result.status).toBe("pass");
		expect(result.name).toBe("config-v7-fields");
		expect(result.message).toContain("background");
		expect(result.message).toContain("routing");
		expect(result.message).toContain("recovery");
		expect(result.message).toContain("mcp");

		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns fail when config file is missing", async () => {
		const tempDir = createIsolatedTempDir("v7-check-missing");
		await mkdir(tempDir, { recursive: true });

		const result = await configV7FieldsCheck(join(tempDir, "nonexistent.json"));
		expect(result.status).toBe("fail");
		expect(result.name).toBe("config-v7-fields");
		expect(result.message).toContain("not found");

		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns fail when v7 fields are missing from a v7 config", async () => {
		const tempDir = createIsolatedTempDir("v7-check-incomplete");
		await mkdir(tempDir, { recursive: true });

		const configPath = await writeTempConfig(tempDir, {
			version: 7,
			configured: true,
			groups: {},
			overrides: {},
			orchestrator: {
				autonomy: "full",
				strictness: "normal",
				phases: {
					recon: true,
					challenge: true,
					architect: true,
					explore: true,
					plan: true,
					build: true,
					ship: true,
					retrospective: true,
				},
			},
			confidence: { enabled: true, thresholds: { proceed: "MEDIUM", abort: "LOW" } },
			fallback: {
				enabled: true,
				notifyOnFallback: true,
				cooldownMinutes: 10,
				maxFallbacksPerSession: 5,
				testMode: { forceError: false, forcedErrorType: null },
			},
			memory: { enabled: true, injectionBudget: 2000, decayHalfLifeDays: 90 },
		});

		const result = await configV7FieldsCheck(configPath);
		expect(result.status).toBe("fail");
		expect(result.name).toBe("config-v7-fields");
		expect(result.message).toContain("missing required fields");
		expect(result.details).toBeDefined();
		expect(result.details).toContain("background");
		expect(result.details).toContain("routing");
		expect(result.details).toContain("recovery");
		expect(result.details).toContain("mcp");

		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns pass with migration message for a pre-v7 config", async () => {
		const tempDir = createIsolatedTempDir("v7-check-prev7");
		await mkdir(tempDir, { recursive: true });

		const configPath = await writeTempConfig(tempDir, {
			version: 6,
			configured: true,
			groups: {},
			overrides: {},
			orchestrator: {
				autonomy: "full",
				strictness: "normal",
				phases: {
					recon: true,
					challenge: true,
					architect: true,
					explore: true,
					plan: true,
					build: true,
					ship: true,
					retrospective: true,
				},
			},
			confidence: { enabled: true, thresholds: { proceed: "MEDIUM", abort: "LOW" } },
			fallback: {
				enabled: true,
				notifyOnFallback: true,
				cooldownMinutes: 10,
				maxFallbacksPerSession: 5,
				testMode: { forceError: false, forcedErrorType: null },
			},
			memory: { enabled: true, injectionBudget: 2000, decayHalfLifeDays: 90 },
		});

		const result = await configV7FieldsCheck(configPath);
		expect(result.status).toBe("pass");
		expect(result.name).toBe("config-v7-fields");
		expect(result.message).toContain("background");
		expect(result.message).toContain("routing");
		expect(result.message).toContain("recovery");
		expect(result.message).toContain("mcp");

		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns fail when only some v7 fields are missing", async () => {
		const tempDir = createIsolatedTempDir("v7-check-partial");
		await mkdir(tempDir, { recursive: true });

		const configPath = await writeTempConfig(tempDir, {
			version: 7,
			configured: true,
			groups: {},
			overrides: {},
			orchestrator: {
				autonomy: "full",
				strictness: "normal",
				phases: {
					recon: true,
					challenge: true,
					architect: true,
					explore: true,
					plan: true,
					build: true,
					ship: true,
					retrospective: true,
				},
			},
			confidence: { enabled: true, thresholds: { proceed: "MEDIUM", abort: "LOW" } },
			fallback: {
				enabled: true,
				notifyOnFallback: true,
				cooldownMinutes: 10,
				maxFallbacksPerSession: 5,
				testMode: { forceError: false, forcedErrorType: null },
			},
			memory: { enabled: true, injectionBudget: 2000, decayHalfLifeDays: 90 },
			background: {},
			routing: {},
		});

		const result = await configV7FieldsCheck(configPath);
		expect(result.status).toBe("fail");
		expect(result.name).toBe("config-v7-fields");
		expect(result.details).toBeDefined();
		expect(result.details).toContain("recovery");
		expect(result.details).toContain("mcp");
		expect(result.details).not.toContain("background");
		expect(result.details).not.toContain("routing");

		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns frozen result", async () => {
		const tempDir = createIsolatedTempDir("v7-check-frozen");
		await mkdir(tempDir, { recursive: true });

		const result = await configV7FieldsCheck(join(tempDir, "nonexistent.json"));
		expect(Object.isFrozen(result)).toBe(true);

		await rm(tempDir, { recursive: true, force: true });
	});
});

describe("routingHealthCheck", () => {
	test("returns frozen result", async () => {
		const result = await routingHealthCheck("/nonexistent/path/config.json");
		expect(Object.isFrozen(result)).toBe(true);
	});
});

describe("mcpHealthCheck", () => {
	beforeEach(() => {
		resetGlobalMcpManager();
	});

	test("returns pass when mcp is disabled", async () => {
		const tempDir = createIsolatedTempDir("mcp-health-disabled");
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "opencode-autopilot.json");
		await writeFile(
			configPath,
			JSON.stringify({
				version: 7,
				configured: true,
				groups: {},
				overrides: {},
				orchestrator: { autonomy: "full", strictness: "normal", phases: {} },
				confidence: { enabled: true, thresholds: { proceed: "MEDIUM", abort: "LOW" } },
				fallback: {
					enabled: true,
					notifyOnFallback: true,
					cooldownMinutes: 10,
					maxFallbacksPerSession: 5,
					testMode: { forceError: false, forcedErrorType: null },
				},
				memory: { enabled: true, injectionBudget: 2000, decayHalfLifeDays: 90 },
				background: {},
				autonomy: { enabled: false, verification: "normal", maxIterations: 10 },
				routing: {},
				recovery: {},
				mcp: { enabled: false, skills: {} },
			}),
		);

		const result = await mcpHealthCheck(configPath);
		expect(result.status).toBe("pass");
		expect(result.message).toContain("disabled");

		await rm(tempDir, { recursive: true, force: true });
	});

	test("reports mcp-capable skills when enabled", async () => {
		const tempDir = createIsolatedTempDir("mcp-health-enabled");
		const skillsDir = join(tempDir, "skills", "docs");
		await mkdir(skillsDir, { recursive: true });
		await writeFile(
			join(skillsDir, "SKILL.md"),
			`---
name: docs
description: Docs skill
stacks: []
requires: []
mcp:
  serverName: docs-server
  command: npx
---
# Docs`,
		);
		const configPath = join(tempDir, "opencode-autopilot.json");
		await writeFile(
			configPath,
			JSON.stringify({
				version: 7,
				configured: true,
				groups: {},
				overrides: {},
				orchestrator: { autonomy: "full", strictness: "normal", phases: {} },
				confidence: { enabled: true, thresholds: { proceed: "MEDIUM", abort: "LOW" } },
				fallback: {
					enabled: true,
					notifyOnFallback: true,
					cooldownMinutes: 10,
					maxFallbacksPerSession: 5,
					testMode: { forceError: false, forcedErrorType: null },
				},
				memory: { enabled: true, injectionBudget: 2000, decayHalfLifeDays: 90 },
				background: {},
				autonomy: { enabled: false, verification: "normal", maxIterations: 10 },
				routing: {},
				recovery: {},
				mcp: { enabled: true, skills: {} },
			}),
		);

		const result = await mcpHealthCheck(configPath);
		expect(result.status).toBe("pass");
		expect(result.message).toContain("1 MCP-capable skill");
		expect(result.details).toContain("docs: docs-server (stdio)");

		await rm(tempDir, { recursive: true, force: true });
	});
});
