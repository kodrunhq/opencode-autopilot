import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { tool } from "@opencode-ai/plugin";

/**
 * CID alphabet from omo — 16 uppercase characters used for 2-char line hashes.
 */
export const CID_ALPHABET = "ZPMQVRWSNKTXJBYH";

const CID_SET = new Set(CID_ALPHABET);

/**
 * FNV-1a 32-bit hash.
 */
function fnv1a(str: string): number {
	let hash = 0x811c9dc5; // FNV offset basis
	for (let i = 0; i < str.length; i++) {
		hash ^= str.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193); // FNV prime
	}
	return hash >>> 0;
}

/**
 * Compute a 2-character line hash using FNV-1a and CID alphabet.
 */
export function computeLineHash(content: string): string {
	const h = fnv1a(content);
	return CID_ALPHABET[h & 0xf] + CID_ALPHABET[(h >> 4) & 0xf];
}

/**
 * Parse a "LINE#HASH" anchor string into its components.
 */
export function parseAnchor(
	anchor: string,
): { readonly line: number; readonly hash: string } | { readonly error: string } {
	const idx = anchor.indexOf("#");
	if (idx < 1) {
		return { error: `Invalid anchor format: "${anchor}". Expected "LINE#HASH" (e.g. "42#VK").` };
	}

	const lineStr = anchor.slice(0, idx);
	const hash = anchor.slice(idx + 1);

	const line = Number.parseInt(lineStr, 10);
	if (!Number.isFinite(line) || line < 1) {
		return { error: `Invalid line number in anchor "${anchor}". Must be >= 1.` };
	}

	if (hash.length !== 2 || !CID_SET.has(hash[0]) || !CID_SET.has(hash[1])) {
		return {
			error: `Invalid hash "${hash}" in anchor "${anchor}". Must be 2 chars from CID alphabet.`,
		};
	}

	return { line, hash };
}

// --- Types ---

interface HashlineEdit {
	readonly op: "replace" | "append" | "prepend";
	readonly pos: string; // "LINE#HASH" anchor
	readonly end?: string; // End anchor for range replace
	readonly lines: string | readonly string[] | null; // null = delete
}

interface HashlineEditArgs {
	readonly file: string;
	readonly edits: readonly HashlineEdit[];
}

// --- Helpers ---

function formatAnchor(lineNum: number, content: string): string {
	return `${lineNum}#${computeLineHash(content)}`;
}

function getSurroundingAnchors(
	fileLines: readonly string[],
	lineIdx: number,
	radius: number,
): string {
	const anchors: string[] = [];
	const start = Math.max(0, lineIdx - radius);
	const end = Math.min(fileLines.length - 1, lineIdx + radius);
	for (let i = start; i <= end; i++) {
		anchors.push(`  ${formatAnchor(i + 1, fileLines[i])} ${fileLines[i]}`);
	}
	return anchors.join("\n");
}

function toLineArray(lines: string | readonly string[] | null): readonly string[] | null {
	if (lines === null) return null;
	if (typeof lines === "string") return [lines];
	return lines;
}

// --- Core function ---

export async function hashlineEditCore(args: HashlineEditArgs): Promise<string> {
	// Path safety: require absolute paths to prevent relative path confusion
	if (!isAbsolute(args.file)) {
		return `Error: File path must be absolute. Got: "${args.file}"`;
	}
	const resolved = resolve(args.file);

	if (args.edits.length === 0) {
		return "Applied 0 edit(s) — no changes made.";
	}

	let raw: string;
	try {
		raw = await readFile(resolved, "utf-8");
	} catch (err) {
		return `Error: Cannot read file "${resolved}": ${err instanceof Error ? err.message : String(err)}`;
	}

	// Split preserving trailing newline behavior
	const hasTrailingNewline = raw.endsWith("\n");
	const fileLines = raw.split("\n");
	// If file ends with newline, split produces an extra empty string at the end — remove it
	if (hasTrailingNewline && fileLines[fileLines.length - 1] === "") {
		fileLines.pop();
	}

	// Parse all anchors first and validate
	const parsedEdits: Array<{
		readonly op: "replace" | "append" | "prepend";
		readonly lineIdx: number;
		readonly hash: string;
		readonly endLineIdx?: number;
		readonly endHash?: string;
		readonly lines: readonly string[] | null;
	}> = [];

	const errors: string[] = [];

	for (const edit of args.edits) {
		const parsed = parseAnchor(edit.pos);
		if ("error" in parsed) {
			errors.push(parsed.error);
			continue;
		}

		const lineIdx = parsed.line - 1; // Convert to 0-based
		if (lineIdx >= fileLines.length) {
			errors.push(`Line ${parsed.line} is out of bounds (file has ${fileLines.length} lines).`);
			continue;
		}

		let endLineIdx: number | undefined;
		let endHash: string | undefined;

		if (edit.end) {
			const parsedEnd = parseAnchor(edit.end);
			if ("error" in parsedEnd) {
				errors.push(parsedEnd.error);
				continue;
			}
			endLineIdx = parsedEnd.line - 1;
			endHash = parsedEnd.hash;
			if (endLineIdx >= fileLines.length) {
				errors.push(
					`End line ${parsedEnd.line} is out of bounds (file has ${fileLines.length} lines).`,
				);
				continue;
			}
			if (endLineIdx < lineIdx) {
				errors.push(`End line ${parsedEnd.line} is before start line ${parsed.line}.`);
				continue;
			}
		}

		parsedEdits.push({
			op: edit.op,
			lineIdx,
			hash: parsed.hash,
			endLineIdx,
			endHash,
			lines: toLineArray(edit.lines),
		});
	}

	if (errors.length > 0) {
		return `Error: ${errors.join("\n")}`;
	}

	// Validate hashes against current file content
	const hashErrors: string[] = [];

	for (const edit of parsedEdits) {
		const actualHash = computeLineHash(fileLines[edit.lineIdx]);
		if (actualHash !== edit.hash) {
			const surrounding = getSurroundingAnchors(fileLines, edit.lineIdx, 2);
			hashErrors.push(
				`Hash mismatch at line ${edit.lineIdx + 1}: expected ${edit.hash}, actual ${actualHash}.\nUpdated anchors:\n${surrounding}`,
			);
		}

		if (edit.endLineIdx !== undefined && edit.endHash !== undefined) {
			const actualEndHash = computeLineHash(fileLines[edit.endLineIdx]);
			if (actualEndHash !== edit.endHash) {
				const surrounding = getSurroundingAnchors(fileLines, edit.endLineIdx, 2);
				hashErrors.push(
					`Hash mismatch at end line ${edit.endLineIdx + 1}: expected ${edit.endHash}, actual ${actualEndHash}.\nUpdated anchors:\n${surrounding}`,
				);
			}
		}
	}

	if (hashErrors.length > 0) {
		return `Error: Stale edit(s) detected.\n${hashErrors.join("\n\n")}`;
	}

	// Sort edits bottom-up (highest line index first) to prevent drift
	const sortedEdits = [...parsedEdits].sort((a, b) => {
		const aLine = a.endLineIdx ?? a.lineIdx;
		const bLine = b.endLineIdx ?? b.lineIdx;
		return bLine - aLine;
	});

	// Apply edits
	for (const edit of sortedEdits) {
		const newLines = edit.lines;

		switch (edit.op) {
			case "replace": {
				if (edit.endLineIdx !== undefined) {
					// Range replace: remove from lineIdx to endLineIdx (inclusive), insert newLines
					const count = edit.endLineIdx - edit.lineIdx + 1;
					if (newLines === null) {
						fileLines.splice(edit.lineIdx, count);
					} else {
						fileLines.splice(edit.lineIdx, count, ...newLines);
					}
				} else {
					// Single line replace
					if (newLines === null) {
						fileLines.splice(edit.lineIdx, 1);
					} else {
						fileLines.splice(edit.lineIdx, 1, ...newLines);
					}
				}
				break;
			}
			case "append": {
				const insertLines = newLines ?? [];
				fileLines.splice(edit.lineIdx + 1, 0, ...insertLines);
				break;
			}
			case "prepend": {
				const insertLines = newLines ?? [];
				fileLines.splice(edit.lineIdx, 0, ...insertLines);
				break;
			}
		}
	}

	// Write back
	const output = fileLines.join("\n") + (hasTrailingNewline ? "\n" : "");
	try {
		await writeFile(resolved, output, "utf-8");
	} catch (err) {
		return `Error: Cannot write file "${resolved}": ${err instanceof Error ? err.message : String(err)}`;
	}

	return `Applied ${sortedEdits.length} edit(s) to ${resolved}.`;
}

// --- Tool wrapper ---

export const ocHashlineEdit = tool({
	description:
		"Edit files using hash-anchored line references (LINE#ID format). Validates line content hasn't changed before applying edits. Supports replace, append, and prepend operations.",
	args: {
		file: tool.schema.string().describe("Absolute path to the file to edit"),
		edits: tool.schema
			.array(
				tool.schema.object({
					op: tool.schema.enum(["replace", "append", "prepend"]).describe("Edit operation type"),
					pos: tool.schema.string().describe("LINE#HASH anchor, e.g. '42#VK'"),
					end: tool.schema
						.string()
						.optional()
						.describe("End anchor for range replace, e.g. '48#SN'"),
					lines: tool.schema
						.union([
							tool.schema.string(),
							tool.schema.array(tool.schema.string()),
							tool.schema.null(),
						])
						.describe("New content (string, string[], or null to delete)"),
				}),
			)
			.describe("Array of edit operations to apply"),
	},
	async execute(args) {
		return hashlineEditCore(args);
	},
});
