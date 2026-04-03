import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createAntiSlopHandler, isCodeFile, scanForSlopComments } from "../../src/hooks/anti-slop";

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
	it("detects obvious 'this function handles' comment in .ts", () => {
		const content = "// This function handles the logic\nconst x = 1;";
		const findings = scanForSlopComments(content, ".ts");
		expect(findings.length).toBeGreaterThan(0);
		expect(findings[0].line).toBe(1);
		expect(findings[0].text).toContain("This function handles the logic");
	});

	it("does not flag legitimate comments in .ts", () => {
		const content = "// Configure retry policy\nconst x = 1;";
		const findings = scanForSlopComments(content, ".ts");
		expect(findings).toHaveLength(0);
	});

	it("detects sycophantic 'elegantly' in .py comment", () => {
		const content = "# This elegantly handles errors\nx = 1";
		const findings = scanForSlopComments(content, ".py");
		expect(findings.length).toBeGreaterThan(0);
		expect(findings[0].text).toContain("elegantly");
	});

	it("detects 'increment counter by 1' in .ts comment", () => {
		const content = "// increment counter by 1\ncounter++;";
		const findings = scanForSlopComments(content, ".ts");
		expect(findings.length).toBeGreaterThan(0);
	});

	it("does not flag 'robust' in code, only in comments", () => {
		const content = "const robust = true;";
		const findings = scanForSlopComments(content, ".ts");
		expect(findings).toHaveLength(0);
	});
});

describe("createAntiSlopHandler", () => {
	let tempDir: string;

	beforeEach(async () => {
		// Use cwd-relative path so hook's path validation passes
		tempDir = join(process.cwd(), `.test-anti-slop-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
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
		await writeFile(tsPath, "// This function handles the logic\nconst x = 1;");

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
