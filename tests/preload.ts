/**
 * Test Isolation Harness - Auto-injects isolated temp directories for all tests.
 *
 * Cleanup happens once at process exit instead of after each test. Bun can run
 * tests concurrently, so eager global cleanup can delete temp dirs that sibling
 * tests are still using.
 */

import { beforeEach } from "bun:test";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDirs = new Set<string>();
let cleanupRegistered = false;

function cleanupTempDirsSync(): void {
	for (const dir of tempDirs) {
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors - test isolation is best-effort
		}
	}
	tempDirs.clear();
}

function ensureCleanupRegistered(): void {
	if (cleanupRegistered) {
		return;
	}
	cleanupRegistered = true;
	process.once("exit", cleanupTempDirsSync);
}

beforeEach(async () => {
	ensureCleanupRegistered();
	const dir = await mkdtemp(join(tmpdir(), `test-${randomUUID()}-`));
	tempDirs.add(dir);
	process.env.TEST_TEMP_DIR = dir;
});
