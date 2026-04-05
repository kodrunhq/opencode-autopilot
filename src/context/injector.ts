import { getLogger } from "../logging/domains";
import { allocateBudget, truncateToTokens } from "./budget";
import { clearContextDiscoveryCache, discoverContextFiles } from "./discovery";
import type { ContextInjectionResult, ContextSource, DiscoveryOptions } from "./types";

const DEFAULT_TOTAL_BUDGET = 4000;
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const logger = getLogger("context", "injector");

export interface ContextInjectorOptions {
	readonly projectRoot: string;
	readonly totalBudget?: number;
	readonly ttlMs?: number;
	readonly now?: () => number;
	readonly discover?: (options: DiscoveryOptions) => Promise<readonly ContextSource[]>;
}

interface InjectorInput {
	readonly sessionID?: string;
}

interface InjectorOutput {
	system: string[];
}

interface CacheEntry {
	readonly result: ContextInjectionResult;
	readonly expiresAt: number;
}

export interface ContextInjector {
	(input: InjectorInput, output: InjectorOutput): Promise<void>;
	clearCache(sessionID?: string): void;
}

function buildInjectionText(
	sources: readonly ContextSource[],
	allocations: ReadonlyMap<string, number>,
): {
	readonly injectedText: string;
	readonly truncated: boolean;
} {
	let truncated = false;
	const sections: string[] = [];

	for (const source of sources) {
		const allocation = allocations.get(source.filePath) ?? 0;
		if (allocation <= 0) {
			continue;
		}

		if (allocation < source.tokenEstimate) {
			truncated = true;
		}

		sections.push(
			`---\n[Source: ${source.name}]\n${truncateToTokens(source.content, allocation)}\n---`,
		);
	}

	return {
		injectedText: sections.length > 0 ? `\n${sections.join("\n")}\n` : "",
		truncated,
	};
}

export function createContextInjector(options: ContextInjectorOptions): ContextInjector {
	const discover = options.discover ?? discoverContextFiles;
	const now = options.now ?? Date.now;
	const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
	const totalBudget = options.totalBudget ?? DEFAULT_TOTAL_BUDGET;
	const cache = new Map<string, CacheEntry>();

	const injector: ContextInjector = async (input, output) => {
		try {
			if (!input.sessionID) {
				return;
			}

			const cached = cache.get(input.sessionID);
			if (cached !== undefined && cached.expiresAt > now()) {
				if (cached.result.injectedText.length > 0) {
					output.system.push(cached.result.injectedText);
				}
				return;
			}

			const sources = await discover({ projectRoot: options.projectRoot, maxDepth: 3 });
			const { allocations, totalUsed } = allocateBudget(sources, totalBudget);
			const { injectedText, truncated } = buildInjectionText(sources, allocations);

			const result: ContextInjectionResult = {
				injectedText,
				sources,
				totalTokens: totalUsed,
				truncated,
			};

			cache.set(input.sessionID, { result, expiresAt: now() + ttlMs });

			if (injectedText.length > 0) {
				output.system.push(injectedText);
			}
		} catch (error) {
			logger.warn("context injection failed", { error: String(error) });
		}
	};

	injector.clearCache = (sessionID?: string) => {
		if (sessionID) {
			cache.delete(sessionID);
		} else {
			cache.clear();
		}
		clearContextDiscoveryCache(options.projectRoot);
	};

	return injector;
}
