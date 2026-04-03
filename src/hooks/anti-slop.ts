/**
 * Anti-slop hook: detects AI-generated comment bloat in code files.
 * Warn-only (non-blocking) -- fires as PostToolUse after file-writing tools.
 */
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import {
	CODE_EXTENSIONS,
	COMMENT_PATTERNS,
	EXT_COMMENT_STYLE,
	SLOP_PATTERNS,
} from "./slop-patterns";

/** A single detected slop comment occurrence. */
export interface SlopFinding {
	readonly line: number;
	readonly text: string;
	readonly pattern: string;
}

/** Returns true if the file path has a code extension eligible for scanning. */
export function isCodeFile(filePath: string): boolean {
	return CODE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

/**
 * Scans content for slop comments matching curated patterns.
 * Only examines comment text (not raw code) to avoid false positives.
 */
export function scanForSlopComments(content: string, ext: string): readonly SlopFinding[] {
	const commentStyle = EXT_COMMENT_STYLE[ext];
	if (!commentStyle) return Object.freeze([]);

	const commentRegex = COMMENT_PATTERNS[commentStyle];
	if (!commentRegex) return Object.freeze([]);

	const lines = content.split("\n");
	const findings: SlopFinding[] = [];

	for (let i = 0; i < lines.length; i++) {
		const match = commentRegex.exec(lines[i]);
		if (!match?.[1]) continue;

		const commentText = match[1].trim();

		for (const pattern of SLOP_PATTERNS) {
			if (pattern.test(commentText)) {
				findings.push(
					Object.freeze({
						line: i + 1,
						text: commentText,
						pattern: pattern.source,
					}),
				);
				break; // one finding per line
			}
		}
	}

	return Object.freeze(findings);
}

/** Tools that write files and should be scanned for slop. */
const FILE_WRITING_TOOLS: ReadonlySet<string> = Object.freeze(
	new Set(["write_file", "edit_file", "write", "edit", "create_file"]),
);

/**
 * Creates a tool.execute.after handler that scans for slop comments.
 * Best-effort: never throws, never blocks the pipeline.
 */
export function createAntiSlopHandler(options: {
	readonly showToast: (title: string, message: string, variant: string) => Promise<void>;
}) {
	return async (
		hookInput: {
			readonly tool: string;
			readonly sessionID: string;
			readonly callID: string;
			readonly args: unknown;
		},
		output: { title: string; output: string; metadata: unknown },
	): Promise<void> => {
		if (!FILE_WRITING_TOOLS.has(hookInput.tool)) return;

		// Extract file path from args (tools use different key names)
		const args = hookInput.args as Record<string, unknown> | null;
		if (!args) return;

		const filePath =
			(args.file_path as string) ??
			(args.filePath as string) ??
			(args.path as string) ??
			(args.file as string);
		if (!filePath || !isCodeFile(filePath)) return;

		const ext = extname(filePath).toLowerCase();

		// Read the actual file content — output.output is the tool's result message, not file content
		let fileContent: string;
		try {
			fileContent = await readFile(filePath, "utf-8");
		} catch {
			return; // file unreadable — best-effort, skip
		}

		const findings = scanForSlopComments(fileContent, ext);
		if (findings.length === 0) return;

		const preview = findings
			.slice(0, 5)
			.map((f) => `L${f.line}: ${f.text}`)
			.join("\n");

		try {
			await options.showToast(
				"Anti-Slop Warning",
				`${findings.length} AI comment(s) detected:\n${preview}`,
				"warning",
			);
		} catch {
			// best-effort -- toast failure is non-fatal
		}
	};
}
