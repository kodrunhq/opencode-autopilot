import {
	formatTimestamp,
	indentLines,
	renderTable,
	wrapText,
} from "./formatter-helpers";
import type {
	InspectEventSummary,
	InspectLessonSummary,
	InspectMemoryOverview,
	InspectMemorySummary,
	InspectPreferenceSummary,
	InspectRunSummary,
} from "./repository";

function formatEvidenceDetail(
	preference: InspectPreferenceSummary,
): readonly string[] {
	if (preference.evidence.length === 0) {
		return ["  - none recorded"];
	}

	return preference.evidence.map((item) => {
		const references = [item.sessionId, item.runId]
			.filter((value) => value !== null)
			.join(" / ");
		const source =
			references.length > 0
				? `${item.statement} [${references}]`
				: item.statement;
		return `  - [${item.confirmed ? "confirmed" : "unconfirmed"}] ${source} (${item.createdAt})`;
	});
}

export function formatVerboseRuns(runs: readonly InspectRunSummary[]): string {
	if (runs.length === 0) {
		return "No runs found. Pipeline runs appear here after an orchestration starts.";
	}

	const headers = [
		"Project",
		"Run ID",
		"Status",
		"Phase",
		"Revision",
		"Updated",
	];
	const rows = runs.map((run) => [
		run.projectName,
		run.runId,
		run.status,
		run.currentPhase ?? "-",
		String(run.stateRevision),
		run.lastUpdatedAt,
	]);
	const lines = [
		"Runs",
		"",
		renderTable(headers, rows, { minWidths: [12, 12, 8, 8, 8, 20] }),
		"",
	];

	for (const run of runs) {
		lines.push(`- ${run.projectName} / ${run.runId}`);
		lines.push(...indentLines([`Idea: ${run.idea}`]));
		lines.push(
			...indentLines([
				`Failure phase: ${run.failurePhase ?? "-"}`,
				`Failure agent: ${run.failureAgent ?? "-"}`,
				`Failure message: ${run.failureMessage ?? "-"}`,
			]),
		);
	}

	return lines.join("\n");
}

export function formatVerboseEvents(
	events: readonly InspectEventSummary[],
): string {
	if (events.length === 0) {
		return "No events found. Forensic events are captured while pipeline sessions execute.";
	}

	const headers = ["Timestamp", "Project", "Domain", "Type", "Phase", "Agent"];
	const rows = events.map((event) => [
		event.timestamp,
		event.projectName,
		event.domain,
		event.type,
		event.phase ?? "-",
		event.agent ?? "-",
	]);
	const lines = [
		"Events",
		"",
		renderTable(headers, rows, { minWidths: [20, 12, 10, 12, 10, 12] }),
		"",
	];

	for (const event of events) {
		lines.push(`- ${event.timestamp} | ${event.projectName} | ${event.type}`);
		lines.push(...indentLines([`Message: ${event.message ?? "-"}`]));
		if (Object.keys(event.payload).length > 0) {
			lines.push("  Payload:");
			lines.push(
				...indentLines(
					JSON.stringify(event.payload, null, 2).split("\n"),
					"    ",
				),
			);
		}
	}

	return lines.join("\n");
}

export function formatVerboseLessons(
	lessons: readonly InspectLessonSummary[],
): string {
	if (lessons.length === 0) {
		return "No lessons found. Lessons are extracted during the RETROSPECTIVE phase of pipeline runs.";
	}

	const lines = ["Lessons", ""];
	for (const lesson of lessons) {
		lines.push(
			`[${formatTimestamp(lesson.extractedAt)}] ${lesson.projectName} | ${lesson.domain} | ${lesson.sourcePhase}`,
		);
		lines.push("Content:");
		lines.push(...indentLines(wrapText(lesson.content)));
		lines.push("");
	}

	return lines.join("\n").trimEnd();
}

export function formatVerbosePreferences(
	preferences: readonly InspectPreferenceSummary[],
): string {
	if (preferences.length === 0) {
		return "No preferences found. Preferences are inferred from sessions and confirmed evidence.";
	}

	const lines = ["Preferences", ""];
	for (const preference of preferences) {
		lines.push(`Key: ${preference.key}`);
		lines.push(
			`Scope: ${preference.scope}${preference.projectId ? ` (${preference.projectId})` : ""}`,
		);
		lines.push(`Value: ${preference.value}`);
		lines.push(`Confidence: ${preference.confidence}`);
		lines.push("Evidence:");
		lines.push(...formatEvidenceDetail(preference));
		lines.push(`Updated: ${preference.lastUpdated}`);
		lines.push("");
	}

	return lines.join("\n").trimEnd();
}

export function formatVerboseMemories(
	memories: readonly InspectMemorySummary[],
): string {
	if (memories.length === 0) {
		return "No memories found. Memories are stored by memory tools or capture heuristics.";
	}

	const lines = ["Memories", ""];
	for (const memory of memories) {
		lines.push(
			`[${memory.kind}/${memory.scope}] ${memory.projectName ?? "global"} | ${formatTimestamp(memory.lastUpdated)}`,
		);
		lines.push(...indentLines([`Summary: ${memory.summary}`]));
		lines.push(...indentLines(wrapText(memory.content)));
		if (memory.tags) {
			lines.push(...indentLines([`Tags: ${memory.tags}`]));
		}
		lines.push(
			...indentLines([
				`Confidence: ${memory.confidence}`,
				`Evidence: ${memory.evidenceCount}`,
				`Accesses: ${memory.lastAccessed}`,
			]),
		);
		lines.push("");
	}

	return lines.join("\n").trimEnd();
}

export function formatVerboseMemoryOverview(
	overview: InspectMemoryOverview,
): string {
	const lines = [
		"Memory Overview",
		"",
		`Total observations: ${overview.stats.totalObservations}`,
		`Total projects: ${overview.stats.totalProjects}`,
		`Total preferences: ${overview.stats.totalPreferences}`,
		`Storage size: ${overview.stats.storageSizeKb} KB`,
		"",
		"Recent observations:",
	];

	if (overview.recentObservations.length === 0) {
		lines.push("- none captured yet");
	} else {
		for (const observation of overview.recentObservations) {
			lines.push(
				`- [${observation.type}] ${observation.projectName ?? "global"}`,
			);
			lines.push(
				...indentLines([
					`Session: ${observation.sessionId}`,
					`Confidence: ${observation.confidence}`,
					`Created: ${observation.createdAt}`,
					`Summary: ${observation.summary}`,
				]),
			);
		}
	}

	lines.push("", formatVerbosePreferences(overview.preferences));
	return lines.join("\n");
}
