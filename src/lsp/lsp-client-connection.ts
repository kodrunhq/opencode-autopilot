import { pathToFileURL } from "node:url";
import { LspClientTransport } from "./lsp-client-transport";

export class LspClientConnection extends LspClientTransport {
	async initialize(): Promise<void> {
		const rootUri = pathToFileURL(this.root).href;
		await this.sendRequest("initialize", {
			capabilities: {
				textDocument: {
					codeAction: {
						codeActionLiteralSupport: {
							codeActionKind: {
								valueSet: [
									"quickfix",
									"refactor",
									"refactor.extract",
									"refactor.inline",
									"refactor.rewrite",
									"source",
									"source.organizeImports",
									"source.fixAll",
								],
							},
						},
						dataSupport: true,
						disabledSupport: true,
						isPreferredSupport: true,
						resolveSupport: { properties: ["edit", "command"] },
					},
					definition: { linkSupport: true },
					documentSymbol: { hierarchicalDocumentSymbolSupport: true },
					hover: { contentFormat: ["markdown", "plaintext"] },
					publishDiagnostics: {},
					references: {},
					rename: {
						honorsChangeAnnotations: true,
						prepareSupport: true,
						prepareSupportDefaultBehavior: 1,
					},
				},
				workspace: {
					applyEdit: true,
					configuration: true,
					symbol: {},
					workspaceEdit: { documentChanges: true },
					workspaceFolders: true,
				},
			},
			initializationOptions: this.server.initialization,
			processId: process.pid,
			rootPath: this.root,
			rootUri,
			workspaceFolders: [{ name: "workspace", uri: rootUri }],
		});
		this.sendNotification("initialized");
		this.sendNotification("workspace/didChangeConfiguration", {
			settings: { json: { validate: { enable: true } } },
		});
		await this.waitForServerActivity(10, 3000);
	}
}
