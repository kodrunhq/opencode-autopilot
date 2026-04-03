import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	CID_ALPHABET,
	computeLineHash,
	hashlineEditCore,
	parseAnchor,
} from "../../src/tools/hashline-edit";

// --- Unit tests for CID_ALPHABET ---

describe("CID_ALPHABET", () => {
	test("is exactly 'ZPMQVRWSNKTXJBYH'", () => {
		expect(CID_ALPHABET).toBe("ZPMQVRWSNKTXJBYH");
	});
});

// --- Unit tests for computeLineHash ---

describe("computeLineHash", () => {
	test("returns a 2-char string from CID_ALPHABET for any input", () => {
		const hash = computeLineHash("hello world");
		expect(hash).toHaveLength(2);
		for (const ch of hash) {
			expect(CID_ALPHABET).toContain(ch);
		}
	});

	test("is deterministic (same input = same output)", () => {
		const input = "const x = 42;";
		expect(computeLineHash(input)).toBe(computeLineHash(input));
	});

	test("produces different hashes for different inputs", () => {
		const hash1 = computeLineHash("const x = 1;");
		const hash2 = computeLineHash("const x = 2;");
		expect(hash1).not.toBe(hash2);
	});
});

// --- Unit tests for parseAnchor ---

describe("parseAnchor", () => {
	test("parses '42#VK' correctly", () => {
		const result = parseAnchor("42#VK");
		expect(result).toEqual({ line: 42, hash: "VK" });
	});

	test("returns error for invalid format", () => {
		const result = parseAnchor("invalid");
		expect(result).toHaveProperty("error");
	});

	test("returns error for line number < 1", () => {
		const result = parseAnchor("0#VK");
		expect(result).toHaveProperty("error");
	});

	test("returns error for non-CID hash chars", () => {
		const result = parseAnchor("1#aa");
		expect(result).toHaveProperty("error");
	});
});

// --- Integration tests for hashlineEditCore ---

describe("hashlineEditCore", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "hashline-edit-test-"));
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	async function writeTestFile(lines: readonly string[]): Promise<string> {
		const filePath = join(tmpDir, "test.txt");
		await writeFile(filePath, `${lines.join("\n")}\n`, "utf-8");
		return filePath;
	}

	function anchor(lineNum: number, content: string): string {
		return `${lineNum}#${computeLineHash(content)}`;
	}

	test("replace op on matching anchor replaces the line content", async () => {
		const filePath = await writeTestFile(["line one", "line two", "line three"]);
		const pos = anchor(2, "line two");

		const result = await hashlineEditCore({
			file: filePath,
			edits: [{ op: "replace", pos, lines: "line TWO replaced" }],
		});

		expect(result).toContain("Applied 1 edit(s)");
		const content = await readFile(filePath, "utf-8");
		expect(content.split("\n")[1]).toBe("line TWO replaced");
	});

	test("replace op on mismatching hash returns error with updated LINE#ID", async () => {
		const filePath = await writeTestFile(["line one", "line two", "line three"]);
		// Use a wrong hash
		const result = await hashlineEditCore({
			file: filePath,
			edits: [{ op: "replace", pos: "2#ZZ", lines: "replaced" }],
		});

		expect(result).toContain("Error");
		expect(result).toContain("#"); // Should contain updated LINE#ID
	});

	test("append op inserts content after the anchor line", async () => {
		const filePath = await writeTestFile(["line one", "line two", "line three"]);
		const pos = anchor(2, "line two");

		const result = await hashlineEditCore({
			file: filePath,
			edits: [{ op: "append", pos, lines: "inserted after two" }],
		});

		expect(result).toContain("Applied 1 edit(s)");
		const content = await readFile(filePath, "utf-8");
		const lines = content.split("\n");
		expect(lines[1]).toBe("line two");
		expect(lines[2]).toBe("inserted after two");
		expect(lines[3]).toBe("line three");
	});

	test("prepend op inserts content before the anchor line", async () => {
		const filePath = await writeTestFile(["line one", "line two", "line three"]);
		const pos = anchor(2, "line two");

		const result = await hashlineEditCore({
			file: filePath,
			edits: [{ op: "prepend", pos, lines: "inserted before two" }],
		});

		expect(result).toContain("Applied 1 edit(s)");
		const content = await readFile(filePath, "utf-8");
		const lines = content.split("\n");
		expect(lines[0]).toBe("line one");
		expect(lines[1]).toBe("inserted before two");
		expect(lines[2]).toBe("line two");
	});

	test("range replace (pos + end) replaces multiple lines", async () => {
		const filePath = await writeTestFile([
			"line one",
			"line two",
			"line three",
			"line four",
			"line five",
		]);
		const pos = anchor(2, "line two");
		const end = anchor(4, "line four");

		const result = await hashlineEditCore({
			file: filePath,
			edits: [{ op: "replace", pos, end, lines: "replaced range" }],
		});

		expect(result).toContain("Applied 1 edit(s)");
		const content = await readFile(filePath, "utf-8");
		const lines = content.split("\n");
		expect(lines[0]).toBe("line one");
		expect(lines[1]).toBe("replaced range");
		expect(lines[2]).toBe("line five");
	});

	test("null lines value deletes the target line(s)", async () => {
		const filePath = await writeTestFile(["line one", "line two", "line three"]);
		const pos = anchor(2, "line two");

		const result = await hashlineEditCore({
			file: filePath,
			edits: [{ op: "replace", pos, lines: null }],
		});

		expect(result).toContain("Applied 1 edit(s)");
		const content = await readFile(filePath, "utf-8");
		const lines = content.split("\n");
		expect(lines[0]).toBe("line one");
		expect(lines[1]).toBe("line three");
	});

	test("multiple edits applied bottom-up (highest line first) to avoid drift", async () => {
		const filePath = await writeTestFile(["line one", "line two", "line three", "line four"]);
		const pos1 = anchor(1, "line one");
		const pos4 = anchor(4, "line four");

		// Provide edits in non-sorted order — line 1 first, line 4 second
		// The implementation should sort them bottom-up (4 first, then 1)
		const result = await hashlineEditCore({
			file: filePath,
			edits: [
				{ op: "replace", pos: pos1, lines: "ONE" },
				{ op: "replace", pos: pos4, lines: "FOUR" },
			],
		});

		expect(result).toContain("Applied 2 edit(s)");
		const content = await readFile(filePath, "utf-8");
		const lines = content.split("\n");
		expect(lines[0]).toBe("ONE");
		expect(lines[1]).toBe("line two");
		expect(lines[2]).toBe("line three");
		expect(lines[3]).toBe("FOUR");
	});

	test("error recovery includes updated LINE#ID references for surrounding lines", async () => {
		const filePath = await writeTestFile([
			"line one",
			"line two",
			"line three",
			"line four",
			"line five",
		]);

		// Use wrong hash for line 3
		const result = await hashlineEditCore({
			file: filePath,
			edits: [{ op: "replace", pos: "3#ZZ", lines: "replaced" }],
		});

		expect(result).toContain("Error");
		// Should contain updated anchors for surrounding lines
		const hashLine2 = computeLineHash("line two");
		const hashLine3 = computeLineHash("line three");
		const hashLine4 = computeLineHash("line four");
		expect(result).toContain(`2#${hashLine2}`);
		expect(result).toContain(`3#${hashLine3}`);
		expect(result).toContain(`4#${hashLine4}`);
	});

	test("append with string array inserts multiple lines", async () => {
		const filePath = await writeTestFile(["line one", "line two"]);
		const pos = anchor(1, "line one");

		const result = await hashlineEditCore({
			file: filePath,
			edits: [{ op: "append", pos, lines: ["inserted A", "inserted B"] }],
		});

		expect(result).toContain("Applied 1 edit(s)");
		const content = await readFile(filePath, "utf-8");
		const lines = content.split("\n");
		expect(lines[0]).toBe("line one");
		expect(lines[1]).toBe("inserted A");
		expect(lines[2]).toBe("inserted B");
		expect(lines[3]).toBe("line two");
	});

	test("rejects relative file paths", async () => {
		const result = await hashlineEditCore({
			file: "relative/path/file.txt",
			edits: [{ op: "replace", pos: "1#ZZ", lines: "x" }],
		});
		expect(result).toContain("Error");
		expect(result).toContain("absolute");
	});

	test("returns error string for non-existent file", async () => {
		const result = await hashlineEditCore({
			file: "/tmp/this-file-does-not-exist-xyz.txt",
			edits: [{ op: "replace", pos: "1#ZZ", lines: "x" }],
		});
		expect(result).toContain("Error");
		expect(result).toContain("Cannot read");
	});

	test("rejects end anchor before start anchor", async () => {
		const filePath = await writeTestFile(["line one", "line two", "line three", "line four"]);
		const pos = anchor(4, "line four");
		const end = anchor(2, "line two");
		const result = await hashlineEditCore({
			file: filePath,
			edits: [{ op: "replace", pos, end, lines: "x" }],
		});
		expect(result).toContain("Error");
		expect(result).toContain("before start");
	});

	test("returns early with no changes for empty edits array", async () => {
		const filePath = await writeTestFile(["line one"]);
		const result = await hashlineEditCore({ file: filePath, edits: [] });
		expect(result).toBe("Applied 0 edit(s) — no changes made.");
	});

	test("rejects overlapping range edits", async () => {
		const filePath = await writeTestFile(["a", "b", "c", "d", "e"]);
		const result = await hashlineEditCore({
			file: filePath,
			edits: [
				{ op: "replace", pos: anchor(2, "b"), end: anchor(4, "d"), lines: "X" },
				{ op: "replace", pos: anchor(3, "c"), lines: "Y" },
			],
		});
		expect(result).toContain("Error");
		expect(result).toContain("Overlapping");
	});

	test("end-anchor hash mismatch returns error with updated anchors", async () => {
		const filePath = await writeTestFile(["line one", "line two", "line three"]);
		const pos = anchor(1, "line one");
		const result = await hashlineEditCore({
			file: filePath,
			edits: [{ op: "replace", pos, end: "3#ZZ", lines: "x" }],
		});
		expect(result).toContain("Error");
		expect(result).toContain("end line 3");
	});
});
