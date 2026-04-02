import { checkDiversity } from "./diversity";
import { ALL_GROUP_IDS } from "./model-groups";
import type { DiversityWarning, GroupModelAssignment } from "./types";

/**
 * Plugin config shape expected by diagnose().
 * Minimal subset to avoid coupling to the full PluginConfig Zod schema.
 */
export interface DiagnosableConfig {
	readonly configured: boolean;
	readonly version: number;
	readonly groups: Readonly<Record<string, GroupModelAssignment>>;
}

/**
 * Structured result of a diagnostic check, suitable for both
 * CLI terminal formatting and JSON serialization by the tool.
 */
export interface DiagnosticResult {
	readonly configExists: boolean;
	readonly schemaValid: boolean;
	readonly configured: boolean;
	readonly groupsAssigned: Readonly<
		Record<
			string,
			{
				readonly assigned: boolean;
				readonly primary: string | null;
				readonly fallbacks: readonly string[];
			}
		>
	>;
	readonly diversityWarnings: readonly DiversityWarning[];
	readonly allPassed: boolean;
}

/**
 * Pure diagnostic function — inspects a config (or null) and returns
 * a structured result. No side effects, no I/O.
 *
 * Both `bin/cli.ts:runDoctor()` and `src/tools/configure.ts:handleDoctor()`
 * call this and format the result differently (terminal vs JSON).
 */
export function diagnose(config: DiagnosableConfig | null): DiagnosticResult {
	const configExists = config !== null;
	// Always true when configExists — loadConfig validates through Zod on load
	const schemaValid = configExists;
	const configured = config?.configured ?? false;

	const groupsAssigned: Record<
		string,
		{ assigned: boolean; primary: string | null; fallbacks: readonly string[] }
	> = {};

	for (const groupId of ALL_GROUP_IDS) {
		const assignment = config?.groups[groupId];
		groupsAssigned[groupId] = assignment
			? { assigned: true, primary: assignment.primary, fallbacks: assignment.fallbacks }
			: { assigned: false, primary: null, fallbacks: [] };
	}

	// Diversity check on assigned groups
	const assignedGroups: Record<string, GroupModelAssignment> = {};
	if (config) {
		for (const [key, val] of Object.entries(config.groups)) {
			assignedGroups[key] = val;
		}
	}

	const diversityWarnings = checkDiversity(assignedGroups);

	const allPassed = configExists && schemaValid && configured && diversityWarnings.length === 0;

	return Object.freeze({
		configExists,
		schemaValid,
		configured,
		groupsAssigned: Object.freeze(groupsAssigned),
		diversityWarnings,
		allPassed,
	});
}
