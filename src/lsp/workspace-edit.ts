import { mkdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { uriToPath } from "./lsp-client-wrapper";
import type { TextDocumentEdit, TextEdit, WorkspaceEdit } from "./types";

type DocumentChange = NonNullable<WorkspaceEdit["documentChanges"]>[number];

export interface ApplyResult {
	readonly success: boolean;
	readonly filesModified: readonly string[];
	readonly totalEdits: number;
	readonly errors: readonly string[];
}

async function applyTextEditsToFile(
	filePath: string,
	edits: readonly TextEdit[],
): Promise<{ readonly success: boolean; readonly editCount: number; readonly error?: string }> {
	try {
		const lines = (await readFile(filePath, "utf-8")).split("\n");
		for (const edit of [...edits].sort(
			(left, right) =>
				right.range.start.line - left.range.start.line ||
				right.range.start.character - left.range.start.character,
		)) {
			const { start, end } = edit.range;
			if (start.line === end.line) {
				const line = lines[start.line] ?? "";
				lines[start.line] =
					`${line.slice(0, start.character)}${edit.newText}${line.slice(end.character)}`;
				continue;
			}
			const first = lines[start.line] ?? "";
			const last = lines[end.line] ?? "";
			const replacement = `${first.slice(0, start.character)}${edit.newText}${last.slice(end.character)}`;
			lines.splice(start.line, end.line - start.line + 1, ...replacement.split("\n"));
		}
		await writeFile(filePath, lines.join("\n"), "utf-8");
		return { success: true, editCount: edits.length };
	} catch (error) {
		return {
			success: false,
			editCount: 0,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function isTextDocumentEdit(change: DocumentChange): change is TextDocumentEdit {
	return !("kind" in change);
}

export async function applyWorkspaceEdit(edit: WorkspaceEdit | null): Promise<ApplyResult> {
	if (!edit)
		return { success: false, errors: ["No edit provided"], filesModified: [], totalEdits: 0 };
	let success = true;
	let totalEdits = 0;
	const filesModified: string[] = [];
	const errors: string[] = [];
	for (const [uri, edits] of Object.entries(edit.changes ?? {})) {
		const filePath = uriToPath(uri);
		const result = await applyTextEditsToFile(filePath, edits);
		if (result.success) {
			filesModified.push(filePath);
			totalEdits += result.editCount;
		} else {
			success = false;
			errors.push(`${filePath}: ${result.error}`);
		}
	}
	for (const change of edit.documentChanges ?? []) {
		if (isTextDocumentEdit(change)) {
			const filePath = uriToPath(change.textDocument.uri);
			const result = await applyTextEditsToFile(filePath, change.edits);
			if (result.success) {
				filesModified.push(filePath);
				totalEdits += result.editCount;
			} else {
				success = false;
				errors.push(`${filePath}: ${result.error}`);
			}
			continue;
		}
		try {
			if (change.kind === "create") {
				const filePath = uriToPath(change.uri);
				await mkdir(dirname(filePath), { recursive: true });
				await writeFile(filePath, "", {
					encoding: "utf-8",
					flag: change.options?.overwrite ? "w" : "wx",
				});
				filesModified.push(filePath);
			} else if (change.kind === "rename") {
				const oldPath = uriToPath(change.oldUri);
				const newPath = uriToPath(change.newUri);
				await mkdir(dirname(newPath), { recursive: true });
				if (change.options?.overwrite) await rm(newPath, { force: true });
				await rename(oldPath, newPath);
				filesModified.push(newPath);
			} else {
				const filePath = uriToPath(change.uri);
				await unlink(filePath);
				filesModified.push(filePath);
			}
		} catch (error) {
			success = false;
			errors.push(
				`${change.kind} ${"uri" in change ? change.uri : change.oldUri}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
	return { success, errors, filesModified, totalEdits };
}
