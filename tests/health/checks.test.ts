import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commandHealthCheck, memoryHealthCheck, skillHealthCheck } from "../../src/health/checks";

// ---------------------------------------------------------------------------
// skillHealthCheck
// ---------------------------------------------------------------------------
describe("skillHealthCheck", () => {
	test("returns pass with typescript stack when tsconfig.json exists", async () => {
		const tempDir = join(tmpdir(), `skill-check-ts-${Date.now()}`);
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
		const tempDir = join(tmpdir(), `skill-check-empty-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		// No manifest files, no skills dir

		const result = await skillHealthCheck(tempDir, join(tempDir, "skills"));
		expect(result.status).toBe("pass");
		expect(result.name).toBe("skill-loading");

		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns frozen result", async () => {
		const tempDir = join(tmpdir(), `skill-check-frozen-${Date.now()}`);
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
		const tempDir = join(tmpdir(), `mem-check-pass-${Date.now()}`);
		const memoryDir = join(tempDir, "memory");
		await mkdir(memoryDir, { recursive: true });

		// Create a minimal SQLite DB with observations table
		const { Database } = await import("bun:sqlite");
		const dbPath = join(memoryDir, "memory.db");
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

	test("returns fail when DB file does not exist", async () => {
		const tempDir = join(tmpdir(), `mem-check-noexist-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });

		const result = await memoryHealthCheck(tempDir);
		expect(result.status).toBe("fail");
		expect(result.name).toBe("memory-db");
		expect(result.message).toContain("not found");

		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns frozen result", async () => {
		const tempDir = join(tmpdir(), `mem-check-frozen-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });

		const result = await memoryHealthCheck(tempDir);
		expect(Object.isFrozen(result)).toBe(true);

		await rm(tempDir, { recursive: true, force: true });
	});
});

// ---------------------------------------------------------------------------
// commandHealthCheck
// ---------------------------------------------------------------------------
describe("commandHealthCheck", () => {
	test("returns pass when all command files exist with valid frontmatter", async () => {
		const tempDir = join(tmpdir(), `cmd-check-pass-${Date.now()}`);
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
		const tempDir = join(tmpdir(), `cmd-check-missing-${Date.now()}`);
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
		const tempDir = join(tmpdir(), `cmd-check-frozen-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });

		const result = await commandHealthCheck(tempDir);
		expect(Object.isFrozen(result)).toBe(true);

		await rm(tempDir, { recursive: true, force: true });
	});
});
