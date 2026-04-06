export type LspCapability =
	| "diagnostics"
	| "definition"
	| "references"
	| "symbols"
	| "rename"
	| "codeAction"
	| "hover"
	| "formatting";

export interface LspServerConfig {
	readonly id: string;
	readonly command: readonly string[];
	readonly extensions: readonly string[];
	readonly capabilities?: readonly LspCapability[];
	readonly disabled?: boolean;
	readonly env?: Readonly<Record<string, string>>;
	readonly initialization?: Readonly<Record<string, unknown>>;
}

export interface Position {
	readonly line: number;
	readonly character: number;
}

export interface Range {
	readonly start: Position;
	readonly end: Position;
}

export interface Location {
	readonly uri: string;
	readonly range: Range;
}

export interface LocationLink {
	readonly targetUri: string;
	readonly targetRange: Range;
	readonly targetSelectionRange: Range;
	readonly originSelectionRange?: Range;
}

export interface SymbolInfo {
	readonly name: string;
	readonly kind: number;
	readonly location: Location;
	readonly containerName?: string;
}

export interface DocumentSymbol {
	readonly name: string;
	readonly kind: number;
	readonly range: Range;
	readonly selectionRange: Range;
	readonly children?: readonly DocumentSymbol[];
}

export interface Diagnostic {
	readonly range: Range;
	readonly severity?: number;
	readonly code?: string | number;
	readonly source?: string;
	readonly message: string;
}

export interface VersionedTextDocumentIdentifier {
	readonly uri: string;
	readonly version: number | null;
}

export interface TextEdit {
	readonly range: Range;
	readonly newText: string;
}

export interface TextDocumentEdit {
	readonly textDocument: VersionedTextDocumentIdentifier;
	readonly edits: readonly TextEdit[];
}

export interface CreateFile {
	readonly kind: "create";
	readonly uri: string;
	readonly options?: {
		readonly overwrite?: boolean;
		readonly ignoreIfExists?: boolean;
	};
}

export interface RenameFile {
	readonly kind: "rename";
	readonly oldUri: string;
	readonly newUri: string;
	readonly options?: {
		readonly overwrite?: boolean;
		readonly ignoreIfExists?: boolean;
	};
}

export interface DeleteFile {
	readonly kind: "delete";
	readonly uri: string;
	readonly options?: {
		readonly recursive?: boolean;
		readonly ignoreIfNotExists?: boolean;
	};
}

export interface WorkspaceEdit {
	readonly changes?: Readonly<Record<string, readonly TextEdit[]>>;
	readonly documentChanges?: readonly (TextDocumentEdit | CreateFile | RenameFile | DeleteFile)[];
}

export interface PrepareRenameResult {
	readonly range: Range;
	readonly placeholder?: string;
}

export interface PrepareRenameDefaultBehavior {
	readonly defaultBehavior: boolean;
}

export interface ServerLookupInfo {
	readonly id: string;
	readonly command: readonly string[];
	readonly extensions: readonly string[];
}

export interface ResolvedServer {
	readonly id: string;
	readonly command: readonly string[];
	readonly extensions: readonly string[];
	readonly capabilities: readonly LspCapability[];
	readonly priority: number;
	readonly env?: Readonly<Record<string, string>>;
	readonly initialization?: Readonly<Record<string, unknown>>;
}

export type ServerLookupResult =
	| { readonly status: "found"; readonly server: ResolvedServer }
	| {
			readonly status: "not_configured";
			readonly extension: string;
			readonly availableServers: readonly string[];
	  }
	| {
			readonly status: "not_installed";
			readonly server: ServerLookupInfo;
			readonly installHint: string;
	  };
