import {
	formatPathsTable,
	formatProjectsTable,
	summarizePreferenceEvidence,
} from "./format-tables";
import { formatVerboseMemoryOverview } from "./format-verbose";
import {
	formatTimestamp,
	getTerminalWidth,
	truncateText,
} from "./formatter-helpers";
import type {
	InspectMemoryOverview,
	InspectProjectDetails,
	InspectProjectSummary,
} from "./repository";

export function formatProjects(
	projects: readonly InspectProjectSummary[],
	_verbose = false,
): string {
	if (projects.length === 0) {
		return "No projects found. Projects appear here after memory or pipeline activity is recorded.";
	}

	return ["Projects", "", formatProjectsTable(projects)].join("\n");
}

export function formatProjectDetails(
	details: InspectProjectDetails,
	_verbose = false,
): string {
	const { project, paths, gitFingerprints } = details;
	const lines = [
		`Project: ${project.name}`,
		"",
		`ID: ${project.id}`,
		`Current Path: ${project.path}`,
		`First Seen: ${project.firstSeenAt}`,
		`Last Updated: ${project.lastUpdated}`,
		`Runs: ${project.runCount}`,
		`Events: ${project.eventCount}`,
		`Lessons: ${project.lessonCount}`,
		`Observations: ${project.observationCount}`,
		`Memories: ${project.memoryCount}`,
		"",
		"Paths:",
		...(paths.length === 0
			? ["- none recorded yet"]
			: paths.map(
					(path) => `- ${path.path}${path.isCurrent ? " [current]" : ""}`,
				)),
		"",
		"Git Fingerprints:",
		...(gitFingerprints.length === 0
			? ["- none recorded yet"]
			: gitFingerprints.map(
					(fingerprint) =>
						`- ${fingerprint.normalizedRemoteUrl}${fingerprint.defaultBranch ? ` (${fingerprint.defaultBranch})` : ""}`,
				)),
	];
	return lines.join("\n");
}

export function formatMemoryOverview(
	overview: InspectMemoryOverview,
	verbose = false,
): string {
	if (verbose) {
		return formatVerboseMemoryOverview(overview);
	}
	const lines = [
		"Memory Overview",
		"",
		`Total observations: ${overview.stats.totalObservations}`,
		`Total projects: ${overview.stats.totalProjects}`,
		`Total preferences: ${overview.stats.totalPreferences}`,
		`Total memories: ${overview.stats.totalMemories}`,
		`Storage size: ${overview.stats.storageSizeKb} KB`,
		"",
		`Memories by kind: ${JSON.stringify(overview.stats.memoriesByKind)}`,
		"",
		"Observations by type:",
		...Object.entries(overview.stats.observationsByType).map(
			([type, count]) => `- ${type}: ${count}`,
		),
		"",
		"Recent observations:",
		...(overview.recentObservations.length === 0
			? ["- none captured yet"]
			: overview.recentObservations.map(
					(observation) =>
						`- [${observation.type}] ${observation.summary} (${formatTimestamp(observation.createdAt)})`,
				)),
		"",
		"Preferences:",
		...(overview.preferences.length === 0
			? ["- none recorded yet"]
			: overview.preferences.map(
					(preference) =>
						`- ${preference.key}: ${truncateText(preference.value, Math.max(24, getTerminalWidth() - 72))} (${preference.scope}, confidence ${preference.confidence}, evidence ${preference.evidenceCount}; ${summarizePreferenceEvidence(preference)})`,
				)),
	];
	return lines.join("\n");
}

export function formatPaths(
	details: InspectProjectDetails,
	_verbose = false,
): string {
	if (details.paths.length === 0) {
		return `No paths found for ${details.project.name}. Paths are captured when project identity changes over time.`;
	}

	return [
		`Paths for ${details.project.name}`,
		"",
		formatPathsTable(details),
	].join("\n");
}
