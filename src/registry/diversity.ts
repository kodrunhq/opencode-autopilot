import { DIVERSITY_RULES } from "./model-groups";
import { extractFamily } from "./resolver";
import type { DiversityWarning, GroupId, GroupModelAssignment } from "./types";

/**
 * Check all diversity rules against current group assignments.
 * Returns warnings for adversarial pairs that share the same model family.
 *
 * Only checks groups that are assigned — unassigned groups are skipped
 * (no warning for missing assignments; that's the config validator's job).
 */
export function checkDiversity(
	groups: Readonly<Record<string, GroupModelAssignment>>,
): readonly DiversityWarning[] {
	const warnings: DiversityWarning[] = [];

	for (const rule of DIVERSITY_RULES) {
		// Extract families for all assigned groups in this rule
		const families = new Map<GroupId, string>();
		for (const groupId of rule.groups) {
			const assignment = groups[groupId];
			if (assignment) {
				families.set(groupId, extractFamily(assignment.primary));
			}
		}

		// All groups in the rule must be assigned to check diversity
		if (families.size < rule.groups.length) continue;

		// For 2-group rules: warn if both use same family
		// For 3-group rules (red-team + builders + reviewers):
		//   warn if red-team shares family with ANY of the others
		if (rule.groups.length === 2) {
			const [familyA, familyB] = [...families.values()];
			if (familyA === familyB) {
				warnings.push({
					rule,
					sharedFamily: familyA,
					groups: [...families.keys()],
				});
			}
		} else {
			// Multi-group rule: check if any pair shares a family
			const entries = [...families.entries()];
			const seen = new Set<string>();
			for (const [groupId, family] of entries) {
				if (seen.has(family)) {
					// Find which groups share this family
					const sharing = entries.filter(([, f]) => f === family).map(([g]) => g);
					warnings.push({
						rule,
						sharedFamily: family,
						groups: sharing,
					});
					break; // One warning per rule
				}
				seen.add(family);
			}
		}
	}

	return Object.freeze(warnings);
}
