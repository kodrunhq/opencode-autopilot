/**
 * Reusable prompt section builders for agent definitions.
 *
 * Pure functions and constants that return prompt section strings.
 * These are composable building blocks used by agent definitions.
 * No I/O, no side effects, no internal dependencies.
 */

/**
 * The oc_hashline_edit preference constraint.
 * Include in agents that have edit permission to encourage safer edits
 * that use LINE#ID validation to prevent stale-line corruption.
 */
export const HASHLINE_EDIT_PREFERENCE: string = Object.freeze(
	"DO prefer oc_hashline_edit over the built-in edit tool — hash-anchored edits use LINE#ID validation to prevent stale-line corruption in long-running sessions. The built-in edit tool is still available as a fallback.",
) as string;

/**
 * The "never halt silently" error recovery terminator.
 * Include in ALL agents to ensure failures are always reported.
 */
export const NEVER_HALT_SILENTLY: string = Object.freeze(
	"NEVER halt silently — always report what went wrong and what was attempted.",
) as string;

/**
 * Build a skill reference constraint line for a single skill name.
 *
 * @param skillName - The name of the skill to reference
 * @returns A constraint line instructing the agent to follow the named skill
 */
export function skillConstraint(skillName: string): string {
	return `DO follow the ${skillName} skill injected into your context.`;
}

/**
 * Build a skill reference constraint line for one or more skill names.
 * Joins multiple skill names with " and " and uses a plural noun.
 *
 * @param skillNames - The names of the skills to reference
 * @returns A constraint line instructing the agent to follow the named skills
 */
export function skillConstraints(skillNames: readonly string[]): string {
	if (skillNames.length === 0) return "";
	if (skillNames.length === 1) return skillConstraint(skillNames[0]);
	const joined = skillNames.join(" and ");
	return `DO follow the ${joined} skills injected into your context.`;
}

/**
 * Build a standard Error Recovery section footer.
 * Always returns a bullet-point line using NEVER_HALT_SILENTLY.
 *
 * @returns A markdown bullet line for the error recovery footer
 */
export function errorRecoveryFooter(): string {
	return `- ${NEVER_HALT_SILENTLY}`;
}
