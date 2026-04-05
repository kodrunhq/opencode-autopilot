import {
	type Category,
	CategoryConfigSchema,
	type RoutingConfig,
	type RoutingDecision,
} from "../types/routing";
import { getCategoryDefinition } from "./categories";
import { classifyTask } from "./classifier";

function buildDefaultCategoryConfig(category: Category) {
	const definition = getCategoryDefinition(category);
	return CategoryConfigSchema.parse({
		enabled: true,
		modelGroup: definition.modelGroup,
		timeoutSeconds: definition.timeoutSeconds,
		skills: [...definition.skills],
		metadata: {
			maxIterations: definition.maxIterations,
		},
	});
}

function buildAppliedConfig(category: Category, override?: RoutingConfig["categories"][string]) {
	const baseConfig = buildDefaultCategoryConfig(category);
	return CategoryConfigSchema.parse({
		...baseConfig,
		...override,
		skills: override?.skills ?? baseConfig.skills,
		metadata: {
			...baseConfig.metadata,
			...(override?.metadata ?? {}),
		},
	});
}

function resolveCategory(
	classifiedCategory: Category,
	config?: RoutingConfig,
): { readonly category: Category; readonly fallbackReason: string | null } {
	const override = config?.categories[classifiedCategory];
	if (override?.enabled === false && classifiedCategory !== "unspecified-low") {
		return Object.freeze({
			category: "unspecified-low",
			fallbackReason: `Category '${classifiedCategory}' is disabled by config; fell back to unspecified-low.`,
		});
	}

	return Object.freeze({
		category: classifiedCategory,
		fallbackReason: null,
	});
}

export function makeRoutingDecision(
	description: string,
	config?: RoutingConfig,
	changedFiles: readonly string[] = [],
): RoutingDecision {
	if (config?.enabled === false) {
		const fallbackCategory: Category = "unspecified-low";
		const appliedConfig = buildAppliedConfig(
			fallbackCategory,
			config?.categories[fallbackCategory],
		);
		return Object.freeze({
			category: fallbackCategory,
			confidence: 0,
			agentId: appliedConfig.agentId,
			reasoning: "Routing is disabled globally.",
			appliedConfig,
		});
	}

	const classification = classifyTask(description, changedFiles);
	const resolved = resolveCategory(classification.category, config);
	const appliedConfig = buildAppliedConfig(
		resolved.category,
		config?.categories[resolved.category],
	);
	const reasoning = [classification.reasoning, resolved.fallbackReason].filter(Boolean).join(" ");

	return Object.freeze({
		category: resolved.category,
		confidence: classification.confidence,
		agentId: appliedConfig.agentId,
		reasoning,
		appliedConfig,
	});
}
