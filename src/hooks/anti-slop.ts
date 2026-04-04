/**
 * Anti-slop hook: detects AI-generated comment bloat in code files.
 * Warn-only (non-blocking) -- fires as PostToolUse after file-writing tools.
 */
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, resolve } from "node:path";
import {
	CODE_EXTENSIONS,
	COMMENT_PATTERNS,
	EXT_COMMENT_STYLE,
	isExcludedHashLine,
	MINIMUM_SLOP_INDICATORS,
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
	const matchedPatternSources = new Set<string>();

	for (let i = 0; i < lines.length; i++) {
		// Exclude shebangs and hex-color lines from # comment scanning
		if (commentStyle === "#" && isExcludedHashLine(lines[i])) continue;

		const match = commentRegex.exec(lines[i]);
		if (!match?.[1]) continue;

		const commentText = match[1].trim();

		for (const pattern of SLOP_PATTERNS) {
			if (pattern.test(commentText)) {
				matchedPatternSources.add(pattern.source);
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

	// Only report when enough distinct patterns match to reduce false positives
	if (matchedPatternSources.size < MINIMUM_SLOP_INDICATORS) {
		return Object.freeze([]);
	}

	return Object.freeze(findings);
}

/** Tools that write files and should be scanned for slop. */
const FILE_WRITING_TOOLS: ReadonlySet<string> = Object.freeze(
	new Set(["write_file", "edit_file", "write", "edit", "create_file"]),
);

/** Debounce interval: skip re-scanning a file if it was scanned within this window (ms). */
const SCAN_DEBOUNCE_MS = 5000;

/** Module-level debounce map: filePath -> lastScanTimestamp. */
const scanTimestamps: Map<string, number> = new Map();

/** Clear the debounce map. Exported for test isolation. */
export function clearScanTimestamps(): void {
	scanTimestamps.clear();
}

/**
 * Creates a tool.execute.after handler that scans for slop comments.
 * Best-effort: never throws, never blocks the pipeline.
 */
export function createAntiSlopHandler(options: {
	readonly showToast: (
		title: string,
		message: string,
		variant: "info" | "warning" | "error",
	) => Promise<void>;
}) {
	return async (
		hookInput: {
			readonly tool: string;
			readonly sessionID: string;
			readonly callID: string;
			readonly args: unknown;
		},
		_output: { title: string; output: string; metadata: unknown },
	): Promise<void> => {
		if (!FILE_WRITING_TOOLS.has(hookInput.tool)) return;

		// Extract file path from args with type-safe narrowing
		const args = hookInput.args;
		if (args === null || typeof args !== "object") return;
		const record = args as Record<string, unknown>;
		const rawPath = record.file_path ?? record.filePath ?? record.path ?? record.file;
		if (typeof rawPath !== "string" || rawPath.length === 0) return;

		// Validate path is absolute and within cwd (prevent path traversal)
		if (!isAbsolute(rawPath)) return;
		const resolved = resolve(rawPath);
		const cwd = process.cwd();
		if (!resolved.startsWith(`${cwd}/`) && resolved !== cwd) return;

		if (!isCodeFile(resolved)) return;

		// Debounce: skip if this file was scanned within the debounce window
		const now = Date.now();
		const lastScan = scanTimestamps.get(resolved);
		if (lastScan !== undefined && now - lastScan < SCAN_DEBOUNCE_MS) return;

		// Claim the slot before yielding the event loop to prevent TOCTOU races
		scanTimestamps.set(resolved, now);
		if (scanTimestamps.size > 10_000) {
			const cutoff = now - SCAN_DEBOUNCE_MS;
			for (const [path, ts] of scanTimestamps) {
				if (ts < cutoff) scanTimestamps.delete(path);
			}
		}

		const ext = extname(resolved).toLowerCase();

		// Read the actual file content — output.output is the tool's result message, not file content
		let fileContent: string;
		try {
			fileContent = await readFile(resolved, "utf-8");
		} catch {
			scanTimestamps.delete(resolved); // clear slot so next attempt is not blocked
			return;
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
