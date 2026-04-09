/**
 * Test Isolation Harness - Auto-injects isolated temp directories for all tests
 *
 * This harness enforces test isolation at the framework level to prevent:
 * - Race conditions from shared temp directories
 * - Environment pollution from parent directories
 * - Flaky tests due to concurrent file operations
 *
 * Every test automatically gets:
 * - A unique temp directory via mkdtemp + randomUUID
 * - Automatic cleanup after test completion
 * - process.env.TEST_TEMP_DIR set to the isolated directory
 */

import { afterEach, beforeEach } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDirs: string[] = [];

beforeEach(async () => {
	const dir = await mkdtemp(join(tmpdir(), `test-${randomUUID()}-`));
	tempDirs.push(dir);
	process.env.TEST_TEMP_DIR = dir;
});

afterEach(async () => {
	await Promise.all(
		tempDirs.map((dir) =>
			rm(dir, { recursive: true, force: true }).catch(() => {
				// Ignore cleanup errors - test isolation is best-effort
			}),
		),
	);
	tempDirs.length = 0;
});
