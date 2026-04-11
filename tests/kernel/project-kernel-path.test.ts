import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getKernelDbPath, openProjectKernelDb } from "../../src/kernel/database";

describe("project kernel db paths", () => {
	let database: Database | null = null;
	let projectRoot = "";

	beforeEach(async () => {
		projectRoot = await mkdtemp(join(tmpdir(), "project-kernel-path-"));
	});

	afterEach(async () => {
		if (database !== null) {
			database.close();
			database = null;
		}

		if (projectRoot.length > 0) {
			await rm(projectRoot, { recursive: true, force: true });
			projectRoot = "";
		}
	});

	test("openProjectKernelDb creates kernel.db inside .opencode-autopilot directory", () => {
		const artifactDir = join(projectRoot, ".opencode-autopilot");
		const expectedDbPath = join(artifactDir, "kernel.db");
		const unexpectedDbPath = join(projectRoot, "kernel.db");

		database = openProjectKernelDb(projectRoot);

		expect(existsSync(expectedDbPath)).toBe(true);
		expect(existsSync(unexpectedDbPath)).toBe(false);
	});

	test("openProjectKernelDb creates .opencode-autopilot directory if missing", () => {
		const artifactDir = join(projectRoot, ".opencode-autopilot");
		const expectedDbPath = join(artifactDir, "kernel.db");

		expect(existsSync(artifactDir)).toBe(false);

		database = openProjectKernelDb(projectRoot);

		expect(existsSync(artifactDir)).toBe(true);
		expect(existsSync(expectedDbPath)).toBe(true);
	});

	test("getKernelDbPath with artifactDir returns correct path", () => {
		expect(getKernelDbPath("/some/project/.opencode-autopilot")).toBe(
			"/some/project/.opencode-autopilot/kernel.db",
		);
	});
});
