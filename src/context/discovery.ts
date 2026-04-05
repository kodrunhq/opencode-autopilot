import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { ContextSource, DiscoveryOptions } from "./types";

const CHARS_PER_TOKEN = 4;
const DEFAULT_MAX_DEPTH = 3;
const PRIORITY_DEPTH_BONUS = 10;

const CONTEXT_FILE_DEFINITIONS = Object.freeze([
	Object.freeze({ name: "AGENTS.md", relativePath: "AGENTS.md", priority: 90 }),
	Object.freeze({ name: "CLAUDE.md", relativePath: "CLAUDE.md", priority: 85 }),
	Object.freeze({ name: "README.md", relativePath: "README.md", priority: 50 }),
	Object.freeze({ name: ".opencode/agents.md", relativePath: ".opencode/agents.md", priority: 80 }),
]);

const discoveryCache = new Map<string, readonly ContextSource[]>();

function createCacheKey(projectRoot: string, maxDepth: number): string {
	return `${resolve(projectRoot)}::${maxDepth}`;
}

function buildSearchRoots(projectRoot: string, maxDepth: number): readonly string[] {
	const roots: string[] = [];
	let currentRoot = resolve(projectRoot);

	for (let depth = 0; depth <= maxDepth; depth += 1) {
		roots.push(currentRoot);
		const parentRoot = dirname(currentRoot);
		if (parentRoot === currentRoot) {
			break;
		}
		currentRoot = parentRoot;
	}

	return roots;
}

function estimateTokens(content: string): number {
	return Math.ceil(content.length / CHARS_PER_TOKEN);
}

export function clearContextDiscoveryCache(projectRoot?: string): void {
	if (!projectRoot) {
		discoveryCache.clear();
		return;
	}

	const projectRootPrefix = `${resolve(projectRoot)}::`;
	for (const key of discoveryCache.keys()) {
		if (key.startsWith(projectRootPrefix)) {
			discoveryCache.delete(key);
		}
	}
}

export async function discoverContextFiles(
	options: DiscoveryOptions,
): Promise<readonly ContextSource[]> {
	const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
	const cacheKey = createCacheKey(options.projectRoot, maxDepth);
	const cached = discoveryCache.get(cacheKey);
	if (cached !== undefined) {
		return cached;
	}

	const roots = buildSearchRoots(options.projectRoot, maxDepth);
	const sources: ContextSource[] = [];

	for (const [depth, root] of roots.entries()) {
		for (const definition of CONTEXT_FILE_DEFINITIONS) {
			const filePath = join(root, definition.relativePath);
			try {
				const content = await readFile(filePath, "utf-8");
				sources.push({
					name: definition.name,
					filePath,
					content,
					priority: definition.priority + (maxDepth - depth + 1) * PRIORITY_DEPTH_BONUS,
					tokenEstimate: estimateTokens(content),
				});
			} catch (error: unknown) {
				if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
					throw error;
				}
			}
		}
	}

	const orderedSources = [...sources].sort(
		(left, right) => right.priority - left.priority || left.filePath.localeCompare(right.filePath),
	);
	discoveryCache.set(cacheKey, orderedSources);
	return orderedSources;
}
