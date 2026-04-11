import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { getLogger, initLoggers, resetLoggerState } from "../../src/logging/domains";
import { resetDedupCache } from "../../src/observability/forensic-log";

const FORBIDDEN_CONSOLE_PATTERNS = ["console.log(", "console.warn(", "console.error("] as const;

async function listTypeScriptFiles(directory: string): Promise<readonly string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const nestedFiles = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = join(directory, entry.name);
			if (entry.isDirectory()) {
				return listTypeScriptFiles(entryPath);
			}

			if (entry.isFile() && entry.name.endsWith(".ts")) {
				return [entryPath];
			}

			return [];
		}),
	);

	return nestedFiles.flat();
}

describe("runtime logging safety", () => {
	let tempDir = "";

	afterEach(async () => {
		resetLoggerState();
		resetDedupCache();

		if (tempDir.length > 0) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = "";
		}
	});

	test("no console.log calls exist in src/ runtime paths", async () => {
		const projectRoot = join(import.meta.dir, "..", "..");
		const sourceRoot = join(projectRoot, "src");
		const filePaths = await listTypeScriptFiles(sourceRoot);
		const violations: string[] = [];

		for (const filePath of filePaths) {
			const relativePath = relative(projectRoot, filePath);
			if (relativePath.startsWith("bin/")) {
				continue;
			}

			const content = await Bun.file(filePath).text();
			for (const pattern of FORBIDDEN_CONSOLE_PATTERNS) {
				if (content.includes(pattern)) {
					violations.push(`${relativePath}: ${pattern}`);
				}
			}
		}

		expect(violations).toEqual([]);
	});

	test("getLogger returns a working logger after initLoggers", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "logger-safety-test-"));

		initLoggers(tempDir);
		const logger = getLogger("test");

		expect(() => logger.info("test message")).not.toThrow();
	});
});
