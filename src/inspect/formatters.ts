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

function truncateText(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatFailure(run: InspectRunSummary): string {
	if (run.failurePhase === null && run.failureAgent === null && run.failureMessage === null) {
		return "-";
	}

	return truncateText(
		`${run.failurePhase ?? "-"}/${run.failureAgent ?? "-"}: ${run.failureMessage ?? "-"}`,
		60,
	);
}

function formatPayloadSummary(payload: InspectEventSummary["payload"]): string {
	if (Object.keys(payload).length === 0) {
		return "-";
	}

	return truncateText(JSON.stringify(payload), 60);
}

function formatEvidenceSummary(evidence: InspectPreferenceSummary["evidence"]): string {
	if (evidence.length === 0) {
		return "none";
	}

	const confirmedCount = evidence.filter((item) => item.confirmed).length;
	const unconfirmedCount = evidence.length - confirmedCount;

	return `${confirmedCount} confirmed, ${unconfirmedCount} unconfirmed`;
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
		"| Project | Run ID | Status | Phase | Idea | Failure | Revision | Updated |",
		"|---------|--------|--------|-------|------|---------|----------|---------|",
	];

	for (const run of runs) {
		lines.push(
			`| ${sanitizeCell(run.projectName)} | ${sanitizeCell(run.runId)} | ${sanitizeCell(run.status)} | ${sanitizeCell(run.currentPhase ?? "-")} | ${sanitizeCell(truncateText(run.idea, 40))} | ${sanitizeCell(formatFailure(run))} | ${run.stateRevision} | ${sanitizeCell(run.lastUpdatedAt)} |`,
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
		"| Timestamp | Project | Domain | Type | Phase | Agent | TaskID | Code | Message | Payload |",
		"|-----------|---------|--------|------|-------|-------|--------|------|---------|---------|",
	];

	for (const event of events) {
		lines.push(
			`| ${sanitizeCell(event.timestamp)} | ${sanitizeCell(event.projectName)} | ${sanitizeCell(event.domain)} | ${sanitizeCell(event.type)} | ${sanitizeCell(event.phase ?? "-")} | ${sanitizeCell(event.agent ?? "-")} | ${sanitizeCell(event.taskId ?? "-")} | ${sanitizeCell(event.code ?? "-")} | ${sanitizeCell(event.message ?? "")} | ${sanitizeCell(formatPayloadSummary(event.payload))} |`,
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
			`| ${sanitizeCell(lesson.extractedAt)} | ${sanitizeCell(lesson.projectName)} | ${sanitizeCell(lesson.domain)} | ${sanitizeCell(lesson.sourcePhase)} | ${sanitizeCell(truncateText(lesson.content, 80))} |`,
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
		"| Key | Scope | Value | Confidence | Evidence Count | Evidence | Updated |",
		"|-----|-------|-------|------------|----------------|----------|---------|",
	];

	for (const preference of preferences) {
		lines.push(
			`| ${sanitizeCell(preference.key)} | ${sanitizeCell(preference.scope)}${preference.projectId ? `:${sanitizeCell(preference.projectId)}` : ""} | ${sanitizeCell(preference.value)} | ${sanitizeCell(preference.confidence)} | ${sanitizeCell(preference.evidenceCount)} | ${sanitizeCell(formatEvidenceSummary(preference.evidence))} | ${sanitizeCell(preference.lastUpdated)} |`,
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
				`- ${preference.key}: ${preference.value} (${preference.scope}, confidence ${preference.confidence}, evidence ${preference.evidenceCount}; ${formatEvidenceSummary(preference.evidence)})`,
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
