import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	clearScanTimestamps,
	createAntiSlopHandler,
	isCodeFile,
	scanForSlopComments,
} from "../../src/hooks/anti-slop";
import { isExcludedHashLine, MINIMUM_SLOP_INDICATORS } from "../../src/hooks/slop-patterns";

describe("isCodeFile", () => {
	it("returns true for .ts files", () => {
		expect(isCodeFile("foo.ts")).toBe(true);
	});

	it("returns false for .md files", () => {
		expect(isCodeFile("foo.md")).toBe(false);
	});

	it("returns true for .py files", () => {
		expect(isCodeFile("foo.py")).toBe(true);
	});

	it("returns false for .json files", () => {
		expect(isCodeFile("foo.json")).toBe(false);
	});
});

describe("scanForSlopComments", () => {
	it("detects multiple slop patterns in .ts (meets MINIMUM_SLOP_INDICATORS)", () => {
		// Two distinct patterns: "this function handles" + "elegantly"
		const content = "// This function handles the logic\n// This elegantly solves it\nconst x = 1;";
		const findings = scanForSlopComments(content, ".ts");
		expect(findings.length).toBe(2);
		expect(findings[0].line).toBe(1);
		expect(findings[0].text).toContain("This function handles the logic");
	});

	it("does not flag legitimate comments in .ts", () => {
		const content = "// Configure retry policy\nconst x = 1;";
		const findings = scanForSlopComments(content, ".ts");
		expect(findings).toHaveLength(0);
	});

	it("detects sycophantic patterns in .py when 2+ distinct matches", () => {
		// Two distinct patterns: "elegantly" + "seamlessly"
		const content = "# This elegantly handles errors\n# Seamlessly integrated\nx = 1";
		const findings = scanForSlopComments(content, ".py");
		expect(findings.length).toBe(2);
		expect(findings[0].text).toContain("elegantly");
	});

	it("returns empty when only 1 distinct pattern matches (below threshold)", () => {
		const content = "// increment counter by 1\ncounter++;";
		const findings = scanForSlopComments(content, ".ts");
		// Single pattern match is below MINIMUM_SLOP_INDICATORS
		expect(findings).toHaveLength(0);
	});

	it("does not flag 'robust' in code, only in comments", () => {
		const content = "const robust = true;";
		const findings = scanForSlopComments(content, ".ts");
		expect(findings).toHaveLength(0);
	});

	it("does not flag 'robust' without narrating context in comments", () => {
		// Bare "robust" in comment should not match (requires "this/the/it/our" prefix)
		const content = "// A robust implementation\n// Uses seamless design";
		const findings = scanForSlopComments(content, ".ts");
		// "robust" alone has no narrating context, "seamless" is 1 pattern -> below threshold
		expect(findings).toHaveLength(0);
	});

	it("requires MINIMUM_SLOP_INDICATORS distinct patterns", () => {
		expect(MINIMUM_SLOP_INDICATORS).toBe(2);
	});
});

describe("isExcludedHashLine", () => {
	it("excludes shebangs", () => {
		expect(isExcludedHashLine("#!/usr/bin/env python3")).toBe(true);
	});

	it("excludes hex colors", () => {
		expect(isExcludedHashLine("color = #FF5733")).toBe(true);
		expect(isExcludedHashLine("bg: #abc")).toBe(true);
	});

	it("does not exclude normal comments", () => {
		expect(isExcludedHashLine("# This is a comment")).toBe(false);
	});
});

describe("createAntiSlopHandler", () => {
	let tempDir: string;

	beforeEach(async () => {
		// Use cwd-relative path so hook's path validation passes
		tempDir = join(process.cwd(), `.test-anti-slop-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		// Clear debounce timestamps between tests
		clearScanTimestamps();
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("returns a function", () => {
		const handler = createAntiSlopHandler({
			showToast: mock(() => Promise.resolve()),
		});
		expect(typeof handler).toBe("function");
	});

	it("does nothing for non-code file output", async () => {
		const showToast = mock(() => Promise.resolve());
		const handler = createAntiSlopHandler({ showToast });
		const mdPath = join(tempDir, "readme.md");
		await writeFile(mdPath, "// This function handles stuff");

		await handler(
			{
				tool: "write_file",
				sessionID: "s1",
				callID: "c1",
				args: { file_path: mdPath },
			},
			{ title: "", output: "File written successfully", metadata: {} },
		);

		expect(showToast).not.toHaveBeenCalled();
	});

	it("fires showToast when slop found in code file", async () => {
		const showToast = mock((_t: string, _m: string, _v: "info" | "warning" | "error") =>
			Promise.resolve(),
		);
		const handler = createAntiSlopHandler({ showToast });
		const tsPath = join(tempDir, "app.ts");
		// Two distinct slop patterns to meet MINIMUM_SLOP_INDICATORS threshold
		await writeFile(
			tsPath,
			"// This function handles the logic\n// This elegantly solves it\nconst x = 1;",
		);

		await handler(
			{
				tool: "write_file",
				sessionID: "s1",
				callID: "c1",
				args: { file_path: tsPath },
			},
			{
				title: "",
				output: "File written successfully",
				metadata: {},
			},
		);

		expect(showToast).toHaveBeenCalledTimes(1);
		const [title, , variant] = showToast.mock.lastCall ?? [];
		expect(title).toBe("Anti-Slop Warning");
		expect(variant).toBe("warning");
	});

	it("does nothing for non-file-writing tools", async () => {
		const showToast = mock(() => Promise.resolve());
		const handler = createAntiSlopHandler({ showToast });
		const tsPath = join(tempDir, "app.ts");
		await writeFile(tsPath, "// This function handles the logic");

		await handler(
			{
				tool: "read_file",
				sessionID: "s1",
				callID: "c1",
				args: { file_path: tsPath },
			},
			{ title: "", output: "file content", metadata: {} },
		);

		expect(showToast).not.toHaveBeenCalled();
	});

	it("does nothing when file is unreadable", async () => {
		const showToast = mock(() => Promise.resolve());
		const handler = createAntiSlopHandler({ showToast });

		await handler(
			{
				tool: "write_file",
				sessionID: "s1",
				callID: "c1",
				args: { file_path: "/nonexistent/path/app.ts" },
			},
			{ title: "", output: "done", metadata: {} },
		);

		expect(showToast).not.toHaveBeenCalled();
	});
});
