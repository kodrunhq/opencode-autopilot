import type { Category, CategoryConfig, RoutingDecision } from "../types/routing";

export interface CategoryDefinition {
	readonly category: Category;
	readonly description: string;
	readonly modelGroup: string;
	readonly skills: readonly string[];
	readonly maxIterations: number;
	readonly timeoutSeconds: number;
	readonly keywords: readonly string[];
	readonly filePatterns: readonly string[];
}

export type { Category, CategoryConfig, RoutingDecision };
