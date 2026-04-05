export interface ContextSource {
	readonly name: string;
	readonly filePath: string;
	readonly content: string;
	readonly priority: number;
	readonly tokenEstimate: number;
}

export interface ContextBudget {
	readonly totalTokens: number;
	readonly allocations: ReadonlyMap<string, number>;
}

export interface ContextInjectionResult {
	readonly injectedText: string;
	readonly sources: readonly ContextSource[];
	readonly totalTokens: number;
	readonly truncated: boolean;
}

export interface DiscoveryOptions {
	readonly projectRoot: string;
	readonly maxDepth?: number;
}
