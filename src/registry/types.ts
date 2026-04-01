// src/registry/types.ts

/**
 * The 8 model groups. Used as keys in config.groups and GROUP_DEFINITIONS.
 */
export type GroupId =
	| "architects"
	| "challengers"
	| "builders"
	| "reviewers"
	| "red-team"
	| "researchers"
	| "communicators"
	| "utilities";

/**
 * Model tier hint — used for display ordering and recommendations.
 * Does not affect resolution logic.
 */
export type ModelTier = "heavy" | "medium" | "light";

/**
 * Diversity warning severity.
 * "strong" — displayed with warning icon, explicitly recommended to change.
 * "soft" — displayed as suggestion, not a strong recommendation.
 */
export type DiversitySeverity = "strong" | "soft";

/**
 * Entry in the agent registry. Maps an agent name to its group.
 */
export interface AgentEntry {
	readonly group: GroupId;
}

/**
 * Metadata for a model group. Pure display/recommendation data.
 */
export interface GroupDefinition {
	readonly id: GroupId;
	readonly label: string;
	readonly purpose: string;
	readonly recommendation: string;
	readonly tier: ModelTier;
	readonly order: number;
}

/**
 * Adversarial diversity rule. Declares which groups should use
 * different model families for quality benefits.
 */
export interface DiversityRule {
	readonly groups: readonly GroupId[];
	readonly severity: DiversitySeverity;
	readonly reason: string;
}

/**
 * A model assignment for a group (stored in config).
 */
export interface GroupModelAssignment {
	readonly primary: string;
	readonly fallbacks: readonly string[];
}

/**
 * A per-agent override (stored in config.overrides).
 */
export interface AgentOverride {
	readonly primary: string;
	readonly fallbacks?: readonly string[];
}

/**
 * Resolved model for an agent — returned by the resolver.
 * `null` means no assignment found; agent uses OpenCode's default.
 */
export interface ResolvedModel {
	readonly primary: string;
	readonly fallbacks: readonly string[];
	readonly source: "override" | "group" | "default";
}

/**
 * Diversity warning emitted by checkDiversity().
 */
export interface DiversityWarning {
	readonly rule: DiversityRule;
	readonly sharedFamily: string;
	readonly groups: readonly GroupId[];
}
