import type {
	InspectEventSummary,
	InspectLessonSummary,
	InspectMemoryOverview,
	InspectPreferenceSummary,
	InspectProjectDetails,
	InspectProjectSummary,
	InspectRunSummary,
} from "./repository";

function sanitizeCell(value: string | number | boolean | null): string {
	return String(value ?? "")
		.replace(/\|/g, "\\|")
		.replace(/\n/g, " ");
}

function formatTimestamp(value: string | null): string {
	return value ?? "-";
}

export function formatProjects(projects: readonly InspectProjectSummary[]): string {
	if (projects.length === 0) {
		return "No projects found.";
	}

	const lines = [
		"Projects",
		"",
		"| Project | Current Path | Updated | Runs | Events | Lessons |",
		"|---------|--------------|---------|------|--------|---------|",
	];

	for (const project of projects) {
		lines.push(
			`| ${sanitizeCell(project.name)} | ${sanitizeCell(project.path)} | ${sanitizeCell(project.lastUpdated)} | ${project.runCount} | ${project.eventCount} | ${project.lessonCount} |`,
		);
	}

	return lines.join("\n");
}

export function formatProjectDetails(details: InspectProjectDetails): string {
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
		"",
		"Paths:",
	];

	if (paths.length === 0) {
		lines.push("- none");
	} else {
		for (const path of paths) {
			lines.push(`- ${path.path}${path.isCurrent ? " [current]" : ""}`);
		}
	}

	lines.push("", "Git Fingerprints:");
	if (gitFingerprints.length === 0) {
		lines.push("- none");
	} else {
		for (const fingerprint of gitFingerprints) {
			lines.push(
				`- ${fingerprint.normalizedRemoteUrl}${fingerprint.defaultBranch ? ` (${fingerprint.defaultBranch})` : ""}`,
			);
		}
	}

	return lines.join("\n");
}

export function formatRuns(runs: readonly InspectRunSummary[]): string {
	if (runs.length === 0) {
		return "No runs found.";
	}

	const lines = [
		"Runs",
		"",
		"| Project | Run ID | Status | Phase | Revision | Updated |",
		"|---------|--------|--------|-------|----------|---------|",
	];

	for (const run of runs) {
		lines.push(
			`| ${sanitizeCell(run.projectName)} | ${sanitizeCell(run.runId)} | ${sanitizeCell(run.status)} | ${sanitizeCell(run.currentPhase ?? "-")} | ${run.stateRevision} | ${sanitizeCell(run.lastUpdatedAt)} |`,
		);
	}

	return lines.join("\n");
}

export function formatEvents(events: readonly InspectEventSummary[]): string {
	if (events.length === 0) {
		return "No events found.";
	}

	const lines = [
		"Events",
		"",
		"| Timestamp | Project | Domain | Type | Phase | Agent | Code | Message |",
		"|-----------|---------|--------|------|-------|-------|------|---------|",
	];

	for (const event of events) {
		lines.push(
			`| ${sanitizeCell(event.timestamp)} | ${sanitizeCell(event.projectName)} | ${sanitizeCell(event.domain)} | ${sanitizeCell(event.type)} | ${sanitizeCell(event.phase ?? "-")} | ${sanitizeCell(event.agent ?? "-")} | ${sanitizeCell(event.code ?? "-")} | ${sanitizeCell(event.message ?? "")} |`,
		);
	}

	return lines.join("\n");
}

export function formatLessons(lessons: readonly InspectLessonSummary[]): string {
	if (lessons.length === 0) {
		return "No lessons found.";
	}

	const lines = [
		"Lessons",
		"",
		"| Extracted | Project | Domain | Source Phase | Content |",
		"|-----------|---------|--------|--------------|---------|",
	];

	for (const lesson of lessons) {
		lines.push(
			`| ${sanitizeCell(lesson.extractedAt)} | ${sanitizeCell(lesson.projectName)} | ${sanitizeCell(lesson.domain)} | ${sanitizeCell(lesson.sourcePhase)} | ${sanitizeCell(lesson.content)} |`,
		);
	}

	return lines.join("\n");
}

export function formatPreferences(preferences: readonly InspectPreferenceSummary[]): string {
	if (preferences.length === 0) {
		return "No preferences found.";
	}

	const lines = [
		"Preferences",
		"",
		"| Key | Scope | Value | Confidence | Evidence | Updated |",
		"|-----|-------|-------|------------|----------|---------|",
	];

	for (const preference of preferences) {
		lines.push(
			`| ${sanitizeCell(preference.key)} | ${sanitizeCell(preference.scope)}${preference.projectId ? `:${sanitizeCell(preference.projectId)}` : ""} | ${sanitizeCell(preference.value)} | ${sanitizeCell(preference.confidence)} | ${sanitizeCell(preference.evidenceCount)} | ${sanitizeCell(preference.lastUpdated)} |`,
		);
	}

	return lines.join("\n");
}

export function formatMemoryOverview(overview: InspectMemoryOverview): string {
	const lines = [
		"Memory Overview",
		"",
		`Total observations: ${overview.stats.totalObservations}`,
		`Total projects: ${overview.stats.totalProjects}`,
		`Total preferences: ${overview.stats.totalPreferences}`,
		`Storage size: ${overview.stats.storageSizeKb} KB`,
		"",
		"Observations by type:",
	];

	for (const [type, count] of Object.entries(overview.stats.observationsByType)) {
		lines.push(`- ${type}: ${count}`);
	}

	lines.push("", "Recent observations:");
	if (overview.recentObservations.length === 0) {
		lines.push("- none");
	} else {
		for (const observation of overview.recentObservations) {
			lines.push(
				`- [${observation.type}] ${observation.summary} (${formatTimestamp(observation.createdAt)})`,
			);
		}
	}

	lines.push("", "Preferences:");
	if (overview.preferences.length === 0) {
		lines.push("- none");
	} else {
		for (const preference of overview.preferences) {
			lines.push(
				`- ${preference.key}: ${preference.value} (${preference.scope}, confidence ${preference.confidence}, evidence ${preference.evidenceCount})`,
			);
		}
	}

	return lines.join("\n");
}

export function formatPaths(details: InspectProjectDetails): string {
	if (details.paths.length === 0) {
		return `No paths found for ${details.project.name}.`;
	}

	const lines = [
		`Paths for ${details.project.name}`,
		"",
		"| Path | Current | First Seen | Last Updated |",
		"|------|---------|------------|--------------|",
	];

	for (const path of details.paths) {
		lines.push(
			`| ${sanitizeCell(path.path)} | ${path.isCurrent ? "yes" : "no"} | ${sanitizeCell(path.firstSeenAt)} | ${sanitizeCell(path.lastUpdated)} |`,
		);
	}

	return lines.join("\n");
}
