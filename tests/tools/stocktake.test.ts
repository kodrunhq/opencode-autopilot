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
});
