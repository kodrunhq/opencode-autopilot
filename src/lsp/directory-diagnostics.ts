import { existsSync, lstatSync, readdirSync, type Stats } from "node:fs";
import { extname, join, resolve } from "node:path";
import { MAX_DIAGNOSTICS, MAX_DIRECTORY_FILES } from "./constants";
import type { LspClient } from "./lsp-client";
import { findWorkspaceRoot, formatServerLookupError } from "./lsp-client-wrapper";
import { filterDiagnosticsBySeverity, formatDiagnostic } from "./lsp-formatters";
import { lspManager } from "./lsp-server";
import { findServerForExtension } from "./server-resolution";
import type { Diagnostic } from "./types";

const skippedDirectories = new Set(["node_modules", ".git", "dist", "build", ".next", "out"]);

function collectFilesWithExtension(
	directory: string,
	extension: string,
	maxFiles: number,
): readonly string[] {
	const files: string[] = [];
	const walk = (currentDirectory: string): void => {
		if (files.length >= maxFiles) return;
		let entries: readonly string[] = [];
		try {
			entries = readdirSync(currentDirectory);
		} catch {
			return;
		}
		for (const entry of entries) {
			if (files.length >= maxFiles) return;
			const fullPath = join(currentDirectory, entry);
			let stats: Stats | undefined;
			try {
				stats = lstatSync(fullPath);
			} catch {
				continue;
			}
			if (stats.isSymbolicLink()) continue;
			if (stats.isDirectory()) {
				if (!skippedDirectories.has(entry)) walk(fullPath);
			} else if (stats.isFile() && extname(fullPath) === extension) {
				files.push(fullPath);
			}
		}
	};
	walk(directory);
	return files;
}

export async function aggregateDiagnosticsForDirectory(
	directory: string,
	extension: string,
	severity?: "error" | "warning" | "information" | "hint" | "all",
	maxFiles = MAX_DIRECTORY_FILES,
): Promise<string> {
	if (!extension.startsWith("."))
		throw new Error(`Extension must start with a dot (e.g., ".ts", not "${extension}").`);
	const absoluteDirectory = resolve(directory);
	if (!existsSync(absoluteDirectory))
		throw new Error(`Directory does not exist: ${absoluteDirectory}`);
	const serverResult = findServerForExtension(extension, "diagnostics");
	if (serverResult.status !== "found") throw new Error(formatServerLookupError(serverResult));
	const allFiles = collectFilesWithExtension(absoluteDirectory, extension, maxFiles + 1);
	const filesToProcess = allFiles.slice(0, maxFiles);
	if (filesToProcess.length === 0)
		return [
			`Directory: ${absoluteDirectory}`,
			`Extension: ${extension}`,
			"Files scanned: 0",
			`No files found with extension "${extension}".`,
		].join("\n");
	const diagnostics: Array<{ readonly filePath: string; readonly diagnostic: Diagnostic }> = [];
	const fileErrors: Array<{ readonly file: string; readonly error: string }> = [];
	const root = findWorkspaceRoot(absoluteDirectory);
	let client: LspClient | undefined;
	try {
		client = await lspManager.getClient(root, serverResult.server);
		for (const file of filesToProcess) {
			try {
				const result = await client.diagnostics(file);
				for (const diagnostic of filterDiagnosticsBySeverity(result.items, severity)) {
					diagnostics.push({ diagnostic, filePath: file });
				}
			} catch (error) {
				fileErrors.push({ error: error instanceof Error ? error.message : String(error), file });
			}
		}
	} finally {
		lspManager.releaseClient(root, serverResult.server.id);
	}
	const shownDiagnostics = diagnostics.slice(0, MAX_DIAGNOSTICS);
	const lines = [
		`Directory: ${absoluteDirectory}`,
		`Extension: ${extension}`,
		`Files scanned: ${filesToProcess.length}${allFiles.length > maxFiles ? ` (capped at ${maxFiles})` : ""}`,
		`Files with errors: ${fileErrors.length}`,
		`Total diagnostics: ${diagnostics.length}`,
	];
	if (fileErrors.length > 0)
		lines.push(
			"",
			"File processing errors:",
			...fileErrors.map(({ file, error }) => `  ${file}: ${error}`),
		);
	if (shownDiagnostics.length > 0) {
		lines.push(
			"",
			...shownDiagnostics.map(
				({ filePath, diagnostic }) => `${filePath}: ${formatDiagnostic(diagnostic)}`,
			),
		);
		if (diagnostics.length > MAX_DIAGNOSTICS)
			lines.push("", `... (${diagnostics.length - MAX_DIAGNOSTICS} more diagnostics not shown)`);
	}
	return lines.join("\n");
}
