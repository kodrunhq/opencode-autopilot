import type { Category } from "../types/routing";
import type { CategoryDefinition } from "./types";

function freezeCategoryDefinition(definition: CategoryDefinition): CategoryDefinition {
	return Object.freeze({
		...definition,
		skills: Object.freeze([...definition.skills]),
		keywords: Object.freeze([...definition.keywords]),
		filePatterns: Object.freeze([...definition.filePatterns]),
	});
}

const ALL_CATEGORIES: readonly CategoryDefinition[] = Object.freeze([
	freezeCategoryDefinition({
		category: "quick",
		description: "Small, low-risk tasks with minimal complexity.",
		modelGroup: "utilities",
		skills: [],
		maxIterations: 1,
		timeoutSeconds: 60,
		keywords: ["fix typo", "rename", "simple", "trivial", "single file"],
		filePatterns: [],
	}),
	freezeCategoryDefinition({
		category: "visual-engineering",
		description: "UI, UX, styling, and frontend presentation work.",
		modelGroup: "builders",
		skills: ["frontend-design", "frontend-ui-ux"],
		maxIterations: 5,
		timeoutSeconds: 300,
		keywords: [
			"ui",
			"ux",
			"css",
			"styling",
			"animation",
			"layout",
			"design",
			"dark mode",
			"responsive",
		],
		filePatterns: [".css", ".scss", ".tsx", ".jsx", ".vue", ".svelte"],
	}),
	freezeCategoryDefinition({
		category: "ultrabrain",
		description: "Logic-heavy, performance-sensitive, or algorithmic work.",
		modelGroup: "architects",
		skills: [],
		maxIterations: 10,
		timeoutSeconds: 600,
		keywords: ["algorithm", "architecture", "complex", "optimize", "performance", "logic-heavy"],
		filePatterns: [],
	}),
	freezeCategoryDefinition({
		category: "artistry",
		description: "Creative, novel, or unconventional solutioning.",
		modelGroup: "architects",
		skills: [],
		maxIterations: 8,
		timeoutSeconds: 600,
		keywords: ["creative", "unconventional", "novel", "innovative"],
		filePatterns: [],
	}),
	freezeCategoryDefinition({
		category: "writing",
		description: "Documentation, changelogs, and technical writing tasks.",
		modelGroup: "communicators",
		skills: ["coding-standards"],
		maxIterations: 3,
		timeoutSeconds: 180,
		keywords: ["documentation", "readme", "changelog", "write docs", "technical writing"],
		filePatterns: [],
	}),
	freezeCategoryDefinition({
		category: "unspecified-low",
		description: "General work with unclear category and moderate complexity.",
		modelGroup: "utilities",
		skills: [],
		maxIterations: 3,
		timeoutSeconds: 120,
		keywords: [],
		filePatterns: [],
	}),
	freezeCategoryDefinition({
		category: "unspecified-high",
		description: "General work with unclear category but high likely complexity.",
		modelGroup: "builders",
		skills: [],
		maxIterations: 8,
		timeoutSeconds: 300,
		keywords: [],
		filePatterns: [],
	}),
] satisfies readonly CategoryDefinition[]);

export const CATEGORY_DEFINITIONS: ReadonlyMap<Category, CategoryDefinition> = Object.freeze(
	new Map(ALL_CATEGORIES.map((definition) => [definition.category, definition] as const)),
);

export function getCategoryDefinition(category: Category): CategoryDefinition {
	const definition = CATEGORY_DEFINITIONS.get(category);
	if (!definition) {
		throw new Error(`Unknown routing category: ${category}`);
	}

	return definition;
}

export function getAllCategories(): readonly CategoryDefinition[] {
	return ALL_CATEGORIES;
}
