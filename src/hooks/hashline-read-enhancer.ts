import { getLogger } from "../logging/domains";
import { loadConfig } from "../config";

const logger = getLogger("hooks", "hashline-read-enhancer");

interface ReadToolOutput {
	readonly content: string;
}

interface ReadToolArgs {
	readonly filePath: string;
}

export function createHashlineReadEnhancerHandler() {
	// Cache config at handler creation time
	let cachedConfig: Awaited<ReturnType<typeof loadConfig>> | null = null;
	let configLoadAttempted = false;

	return (
		hookInput: {
			readonly tool: string;
			readonly sessionID: string;
			readonly callID: string;
			readonly args: unknown;
			readonly agentName?: string;
		},
		output: { readonly content: string },
	): { readonly content: string } => {
		if (hookInput.tool !== "read") {
			return output;
		}

		const readArgs = hookInput.args as ReadToolArgs;
		const originalContent = output.content;
		const agentName = hookInput.agentName;

		// Load config once (cached)
		if (!configLoadAttempted) {
			configLoadAttempted = true;
			loadConfig()
				.then((config) => {
					cachedConfig = config;
				})
				.catch((error) => {
					logger.warn("Failed to load config for hashline read enhancement", {
						sessionID: hookInput.sessionID,
						error: error instanceof Error ? error.message : String(error),
					});
				});
		}

		// If config hasn't loaded yet or failed, skip enhancement
		if (!cachedConfig) {
			return output;
		}

		// Check if hashline_edit is enabled
		if (!cachedConfig?.hashline_edit?.enabled) {
			return output;
		}

		// Check if agent should be enforced
		const enforceForAgents = cachedConfig.hashline_edit.enforce_for_agents || [];
		if (enforceForAgents.length > 0 && agentName && !enforceForAgents.includes(agentName)) {
			return output;
		}

		// Parse the content lines (format: "1: line1\n2: line2\n...")
		const lines = originalContent.split("\n");
		const enhancedLines: string[] = [];

		// CID alphabet from hashline-edit.ts
		const CID_ALPHABET = "ZPMQVRWSNKTXJBYH";

		// FNV-1a 32-bit hash function (same as hashline-edit.ts)
		function fnv1a(str: string): number {
			let hash = 0x811c9dc5; // FNV offset basis
			for (let i = 0; i < str.length; i++) {
				hash ^= str.charCodeAt(i);
				hash = Math.imul(hash, 0x01000193); // FNV prime
			}
			return hash >>> 0;
		}

		// Compute 2-character line hash
		function computeLineHash(content: string): string {
			const h = fnv1a(content);
			return CID_ALPHABET[h & 0xf] + CID_ALPHABET[(h >> 4) & 0xf];
		}

		// Format anchor
		function formatAnchor(lineNum: number, content: string): string {
			return `${lineNum}#${computeLineHash(content)}`;
		}

		for (const line of lines) {
			// Parse line format: "N: content"
			const match = line.match(/^(\d+):\s+(.*)$/);
			if (!match) {
				enhancedLines.push(line);
				continue;
			}

			const lineNum = parseInt(match[1], 10);
			const content = match[2];

			if (lineNum > 0 && content) {
				const hash = computeLineHash(content);
				const anchor = formatAnchor(lineNum, content);

				// Enhance line with hash suffix
				enhancedLines.push(`${lineNum}: ${content} #${hash}`);

				logger.debug("Enhanced read line with hash", {
					sessionID: hookInput.sessionID,
					filePath: readArgs.filePath,
					lineNum,
					hash,
					anchor,
					agentName,
				});
			} else {
				enhancedLines.push(line);
			}
		}

		const enhancedContent = enhancedLines.join("\n");

		logger.info("Enhanced read output with line hashes", {
			sessionID: hookInput.sessionID,
			filePath: readArgs.filePath,
			originalLines: lines.length,
			enhancedLines: enhancedLines.length,
			agentName,
		});

		return { content: enhancedContent };
	};
}
