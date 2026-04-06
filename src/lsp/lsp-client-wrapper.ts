import { existsSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { LspClient } from "./lsp-client";
import { lspManager } from "./lsp-server";
import { findServerForExtension } from "./server-resolution";
import type { LspCapability, ServerLookupResult } from "./types";

const workspaceMarkers = [
	".git",
	"package.json",
	"pyproject.toml",
	"Cargo.toml",
	"go.mod",
	"pom.xml",
	"build.gradle",
];

export function isDirectoryPath(filePath: string): boolean {
	return existsSync(filePath) && statSync(filePath).isDirectory();
}

export function uriToPath(uri: string): string {
	return fileURLToPath(uri);
}

export function findWorkspaceRoot(filePath: string): string {
	let current = resolve(filePath);
	if (!isDirectoryPath(current)) current = dirname(current);
	let previous = "";
	while (current !== previous) {
		if (workspaceMarkers.some((marker) => existsSync(join(current, marker)))) return current;
		previous = current;
		current = dirname(current);
	}
	return isDirectoryPath(filePath) ? resolve(filePath) : dirname(resolve(filePath));
}

export function formatServerLookupError(
	result: Exclude<ServerLookupResult, { readonly status: "found" }>,
): string {
	if (result.status === "not_installed") {
		return [
			`LSP server '${result.server.id}' is configured but not installed.`,
			"",
			`Command not found: ${result.server.command[0]}`,
			"",
			"To install:",
			`  ${result.installHint}`,
			"",
			`Supported extensions: ${result.server.extensions.join(", ")}`,
		].join("\n");
	}
	return [
		`No LSP server configured for extension: ${result.extension}`,
		"",
		`Available servers: ${result.availableServers.slice(0, 10).join(", ")}${result.availableServers.length > 10 ? "..." : ""}`,
		"",
		"Add an lsp block in ~/.config/opencode/opencode-autopilot.json or .opencode/opencode-autopilot.json.",
	].join("\n");
}

export async function withLspClient<T>(
	filePath: string,
	callback: (client: LspClient) => Promise<T>,
	requiredCapability?: LspCapability,
): Promise<T> {
	const absolutePath = resolve(filePath);
	if (isDirectoryPath(absolutePath))
		throw new Error(
			"Directory paths are not supported by this LSP tool. Use oc_lsp_diagnostics for directory diagnostics.",
		);
	const serverResult = findServerForExtension(extname(absolutePath), requiredCapability);
	if (serverResult.status !== "found") throw new Error(formatServerLookupError(serverResult));
	const root = findWorkspaceRoot(absolutePath);
	const client = await lspManager.getClient(root, serverResult.server);
	try {
		return await callback(client);
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.includes("timeout") &&
			lspManager.isServerInitializing(root, serverResult.server.id)
		) {
			throw new Error(
				`LSP server is still initializing. Please retry in a few seconds. Original error: ${error.message}`,
			);
		}
		throw error;
	} finally {
		lspManager.releaseClient(root, serverResult.server.id);
	}
}
