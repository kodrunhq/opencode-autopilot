import { formatMinutesDuration, renderTable } from "./formatter-helpers";
import type {
	InspectEventSummary,
	InspectLessonSummary,
	InspectMemorySummary,
	InspectPreferenceSummary,
	InspectProjectDetails,
	InspectProjectSummary,
	InspectRunSummary,
	InspectStuckDispatch,
} from "./repository";

function formatFailure(run: InspectRunSummary): string {
	if (
		run.failurePhase === null &&
		run.failureAgent === null &&
		run.failureMessage === null
	) {
		return "-";
	}

	return `${run.failurePhase ?? "-"}/${run.failureAgent ?? "-"}: ${run.failureMessage ?? "-"}`;
}

function formatPayloadSummary(payload: InspectEventSummary["payload"]): string {
	return Object.keys(payload).length === 0 ? "-" : JSON.stringify(payload);
}

function formatEvidenceSummary(preference: InspectPreferenceSummary): string {
	if (preference.evidence.length === 0) {
		return "none";
	}

	const confirmedCount = preference.evidence.filter(
		(item) => item.confirmed,
	).length;
	return `${confirmedCount} confirmed, ${preference.evidence.length - confirmedCount} unconfirmed`;
}

export function formatProjectsTable(
	projects: readonly InspectProjectSummary[],
): string {
	return renderTable(
		[
			"Project",
			"Current Path",
			"Updated",
			"Runs",
			"Events",
			"Lessons",
			"Memories",
		],
		projects.map((project) => [
			project.name,
			project.path,
			project.lastUpdated,
			String(project.runCount),
			String(project.eventCount),
			String(project.lessonCount),
			String(project.memoryCount),
		]),
		{ minWidths: [12, 20, 20, 4, 6, 7, 8] },
	);
}

export function formatRunsTable(runs: readonly InspectRunSummary[]): string {
	return renderTable(
		[
			"Project",
			"Run ID",
			"Status",
			"Phase",
			"Idea",
			"Failure",
			"Revision",
			"Updated",
		],
		runs.map((run) => [
			run.projectName,
			run.runId,
			run.status,
			run.currentPhase ?? "-",
			run.idea,
			formatFailure(run),
			String(run.stateRevision),
			run.lastUpdatedAt,
		]),
		{ minWidths: [12, 12, 8, 8, 12, 12, 8, 20] },
	);
}

export function formatStuckDispatchesTable(
	dispatches: readonly InspectStuckDispatch[],
): string {
	return renderTable(
		[
			"Run ID",
			"Status",
			"Run Phase",
			"Dispatch Phase",
			"Agent",
			"Pending",
			"Session ID",
		],
		dispatches.map((dispatch) => [
			dispatch.runId,
			dispatch.status,
			dispatch.currentPhase ?? "-",
			dispatch.dispatchPhase,
			dispatch.agent,
			formatMinutesDuration(dispatch.staleMinutes),
			dispatch.sessionId ?? "-",
		]),
		{ minWidths: [12, 10, 10, 14, 12, 8, 16] },
	);
}

export function formatEventsTable(
	events: readonly InspectEventSummary[],
): string {
	return renderTable(
		[
			"Timestamp",
			"Project",
			"Domain",
			"Type",
			"Phase",
			"Agent",
			"TaskID",
			"Code",
			"Message",
			"Payload",
		],
		events.map((event) => [
			event.timestamp,
			event.projectName,
			event.domain,
			event.type,
			event.phase ?? "-",
			event.agent ?? "-",
			String(event.taskId ?? "-"),
			event.code ?? "-",
			event.message ?? "",
			formatPayloadSummary(event.payload),
		]),
		{ minWidths: [20, 12, 10, 12, 8, 12, 8, 6, 12, 12] },
	);
}

export function formatLessonsTable(
	lessons: readonly InspectLessonSummary[],
): string {
	return renderTable(
		["Extracted", "Project", "Domain", "Source Phase", "Content"],
		lessons.map((lesson) => [
			lesson.extractedAt,
			lesson.projectName,
			lesson.domain,
			lesson.sourcePhase,
			lesson.content,
		]),
		{ minWidths: [20, 12, 10, 12, 24] },
	);
}

export function formatPreferencesTable(
	preferences: readonly InspectPreferenceSummary[],
): string {
	return renderTable(
		[
			"Key",
			"Scope",
			"Value",
			"Confidence",
			"Evidence Count",
			"Evidence",
			"Updated",
		],
		preferences.map((preference) => [
			preference.key,
			preference.scope +
				(preference.projectId ? `:${preference.projectId}` : ""),
			preference.value,
			String(preference.confidence),
			String(preference.evidenceCount),
			formatEvidenceSummary(preference),
			preference.lastUpdated,
		]),
		{ minWidths: [12, 12, 12, 10, 8, 16, 20] },
	);
}

export function formatPathsTable(details: InspectProjectDetails): string {
	return renderTable(
		["Path", "Current", "First Seen", "Last Updated"],
		details.paths.map((path) => [
			path.path,
			path.isCurrent ? "yes" : "no",
			path.firstSeenAt,
			path.lastUpdated,
		]),
		{ minWidths: [20, 7, 20, 20] },
	);
}

export function summarizePreferenceEvidence(
	preference: InspectPreferenceSummary,
): string {
	return formatEvidenceSummary(preference);
}

export function formatMemoriesTable(
	memories: readonly InspectMemorySummary[],
): string {
	return renderTable(
		["Kind", "Scope", "Project", "Summary", "Updated"],
		memories.map((memory) => [
			memory.kind,
			memory.scope,
			memory.projectName ?? "global",
			memory.summary,
			memory.lastUpdated,
		]),
		{ minWidths: [10, 8, 12, 32, 20] },
	);
}
