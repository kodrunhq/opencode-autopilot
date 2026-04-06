import { SEVERITY_MAP, SYMBOL_KIND_MAP } from "./language-mappings";
import { uriToPath } from "./lsp-client-wrapper";
import type {
	Diagnostic,
	DocumentSymbol,
	Location,
	LocationLink,
	PrepareRenameDefaultBehavior,
	PrepareRenameResult,
	Range,
	SymbolInfo,
	TextEdit,
	WorkspaceEdit,
} from "./types";
import type { ApplyResult } from "./workspace-edit";

export function formatLocation(location: Location | LocationLink): string {
	if ("targetUri" in location)
		return `${uriToPath(location.targetUri)}:${location.targetRange.start.line + 1}:${location.targetRange.start.character}`;
	return `${uriToPath(location.uri)}:${location.range.start.line + 1}:${location.range.start.character}`;
}

export function formatSymbolKind(kind: number): string {
	return SYMBOL_KIND_MAP[kind] ?? `Unknown(${kind})`;
}

export function formatSeverity(severity?: number): string {
	return severity ? (SEVERITY_MAP[severity] ?? `unknown(${severity})`) : "unknown";
}

export function formatDocumentSymbol(symbol: DocumentSymbol, indent = 0): string {
	const line = `${"  ".repeat(indent)}${symbol.name} (${formatSymbolKind(symbol.kind)}) - line ${symbol.range.start.line + 1}`;
	return symbol.children && symbol.children.length > 0
		? [line, ...symbol.children.map((child) => formatDocumentSymbol(child, indent + 1))].join("\n")
		: line;
}

export function formatSymbolInfo(symbol: SymbolInfo): string {
	return `${symbol.name} (${formatSymbolKind(symbol.kind)})${symbol.containerName ? ` (in ${symbol.containerName})` : ""} - ${formatLocation(symbol.location)}`;
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
	const source = diagnostic.source ? `[${diagnostic.source}]` : "";
	const code = diagnostic.code ? ` (${diagnostic.code})` : "";
	return `${formatSeverity(diagnostic.severity)}${source}${code} at ${diagnostic.range.start.line + 1}:${diagnostic.range.start.character}: ${diagnostic.message}`;
}

export function filterDiagnosticsBySeverity(
	diagnostics: readonly Diagnostic[],
	severity?: "error" | "warning" | "information" | "hint" | "all",
): readonly Diagnostic[] {
	if (!severity || severity === "all") return diagnostics;
	const map: Readonly<Record<Exclude<typeof severity, "all" | undefined>, number>> = {
		error: 1,
		hint: 4,
		information: 3,
		warning: 2,
	};
	return diagnostics.filter((diagnostic) => diagnostic.severity === map[severity]);
}

export function formatPrepareRenameResult(
	result: PrepareRenameResult | PrepareRenameDefaultBehavior | Range | null,
): string {
	if (!result) return "Cannot rename at this position";
	if ("defaultBehavior" in result)
		return result.defaultBehavior
			? "Rename supported (using default behavior)"
			: "Cannot rename at this position";
	const range = "range" in result ? result.range : result;
	const placeholder =
		"placeholder" in result && result.placeholder ? ` (current: "${result.placeholder}")` : "";
	return `Rename available at ${range.start.line + 1}:${range.start.character}-${range.end.line + 1}:${range.end.character}${placeholder}`;
}

function formatTextEdit(edit: TextEdit): string {
	const preview = edit.newText.length > 50 ? `${edit.newText.slice(0, 50)}...` : edit.newText;
	return `  ${edit.range.start.line + 1}:${edit.range.start.character}-${edit.range.end.line + 1}:${edit.range.end.character}: "${preview}"`;
}

export function formatWorkspaceEdit(edit: WorkspaceEdit | null): string {
	if (!edit) return "No changes";
	const lines: string[] = [];
	for (const [uri, edits] of Object.entries(edit.changes ?? {})) {
		lines.push(`File: ${uriToPath(uri)}`, ...edits.map((textEdit) => formatTextEdit(textEdit)));
	}
	for (const change of edit.documentChanges ?? []) {
		if ("kind" in change) {
			lines.push(
				change.kind === "rename"
					? `Rename: ${change.oldUri} -> ${change.newUri}`
					: `${change.kind[0].toUpperCase()}${change.kind.slice(1)}: ${change.uri}`,
			);
			continue;
		}
		lines.push(
			`File: ${uriToPath(change.textDocument.uri)}`,
			...change.edits.map((textEdit) => formatTextEdit(textEdit)),
		);
	}
	return lines.length > 0 ? lines.join("\n") : "No changes";
}

export function formatApplyResult(result: ApplyResult): string {
	if (result.success)
		return [
			`Applied ${result.totalEdits} edit(s) to ${result.filesModified.length} file(s):`,
			...result.filesModified.map((file) => `  - ${file}`),
		].join("\n");
	return [
		"Failed to apply some changes:",
		...result.errors.map((error) => `  Error: ${error}`),
		...(result.filesModified.length > 0
			? [`Successfully modified: ${result.filesModified.join(", ")}`]
			: []),
	].join("\n");
}
