import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getLanguageId } from "./language-config";
import { LspClientConnection } from "./lsp-client-connection";
import type { Diagnostic } from "./types";

export class LspClient extends LspClientConnection {
	private readonly openedFiles = new Set<string>();
	private readonly documentVersions = new Map<string, number>();
	private readonly lastSyncedText = new Map<string, string>();

	async openFile(filePath: string): Promise<void> {
		const absolutePath = resolve(filePath);
		const uri = pathToFileURL(absolutePath).href;
		const text = await readFile(absolutePath, "utf-8");
		if (!this.openedFiles.has(absolutePath)) {
			const version = 1;
			this.sendNotification("textDocument/didOpen", {
				textDocument: { languageId: getLanguageId(extname(absolutePath)), text, uri, version },
			});
			this.openedFiles.add(absolutePath);
			this.documentVersions.set(uri, version);
			this.lastSyncedText.set(uri, text);
			await new Promise((resolve) => setTimeout(resolve, 1000));
			return;
		}
		if (this.lastSyncedText.get(uri) === text) return;
		const version = (this.documentVersions.get(uri) ?? 1) + 1;
		this.documentVersions.set(uri, version);
		this.lastSyncedText.set(uri, text);
		this.sendNotification("textDocument/didChange", {
			contentChanges: [{ text }],
			textDocument: { uri, version },
		});
		this.sendNotification("textDocument/didSave", { text, textDocument: { uri } });
	}

	async definition(filePath: string, line: number, character: number): Promise<unknown> {
		const absolutePath = resolve(filePath);
		await this.openFile(absolutePath);
		return this.sendRequest("textDocument/definition", {
			position: { character, line: line - 1 },
			textDocument: { uri: pathToFileURL(absolutePath).href },
		});
	}

	async references(
		filePath: string,
		line: number,
		character: number,
		includeDeclaration: boolean,
	): Promise<unknown> {
		const absolutePath = resolve(filePath);
		await this.openFile(absolutePath);
		return this.sendRequest("textDocument/references", {
			context: { includeDeclaration },
			position: { character, line: line - 1 },
			textDocument: { uri: pathToFileURL(absolutePath).href },
		});
	}

	async documentSymbols(filePath: string): Promise<unknown> {
		const absolutePath = resolve(filePath);
		await this.openFile(absolutePath);
		return this.sendRequest("textDocument/documentSymbol", {
			textDocument: { uri: pathToFileURL(absolutePath).href },
		});
	}

	async workspaceSymbols(query: string): Promise<unknown> {
		return this.sendRequest("workspace/symbol", { query });
	}

	async diagnostics(filePath: string): Promise<{ readonly items: readonly Diagnostic[] }> {
		const absolutePath = resolve(filePath);
		const uri = pathToFileURL(absolutePath).href;
		await this.openFile(absolutePath);
		await new Promise((resolve) => setTimeout(resolve, 500));
		try {
			const result = await this.sendRequest<{ readonly items?: readonly Diagnostic[] }>(
				"textDocument/diagnostic",
				{ textDocument: { uri } },
			);
			if (result.items) return { items: result.items };
		} catch {}
		return { items: this.diagnosticsStore.get(uri) ?? [] };
	}

	async prepareRename(filePath: string, line: number, character: number): Promise<unknown> {
		const absolutePath = resolve(filePath);
		await this.openFile(absolutePath);
		return this.sendRequest("textDocument/prepareRename", {
			position: { character, line: line - 1 },
			textDocument: { uri: pathToFileURL(absolutePath).href },
		});
	}

	async rename(
		filePath: string,
		line: number,
		character: number,
		newName: string,
	): Promise<unknown> {
		const absolutePath = resolve(filePath);
		await this.openFile(absolutePath);
		return this.sendRequest("textDocument/rename", {
			newName,
			position: { character, line: line - 1 },
			textDocument: { uri: pathToFileURL(absolutePath).href },
		});
	}
}
