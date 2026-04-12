import {
	formatEventsTable,
	formatLessonsTable,
	formatMemoriesTable,
	formatPreferencesTable,
	formatRunsTable,
	formatStuckDispatchesTable,
} from "./format-tables";
import {
	formatVerboseEvents,
	formatVerboseLessons,
	formatVerboseMemories,
	formatVerbosePreferences,
	formatVerboseRuns,
	formatVerboseStuckDispatches,
} from "./format-verbose";
import type {
	InspectEventSummary,
	InspectLessonSummary,
	InspectMemorySummary,
	InspectPreferenceSummary,
	InspectRunSummary,
	InspectStuckDispatch,
} from "./repository";

export function formatRuns(runs: readonly InspectRunSummary[], verbose = false): string {
	if (verbose) {
		return formatVerboseRuns(runs);
	}
	if (runs.length === 0) {
		return "No runs found. Pipeline runs appear here after an orchestration starts.";
	}

	return ["Runs", "", formatRunsTable(runs)].join("\n");
}

export function formatEvents(events: readonly InspectEventSummary[], verbose = false): string {
	if (verbose) {
		return formatVerboseEvents(events);
	}
	if (events.length === 0) {
		return "No events found. Forensic events are captured while pipeline sessions execute.";
	}

	return ["Events", "", formatEventsTable(events)].join("\n");
}

export function formatStuckDispatches(
	dispatches: readonly InspectStuckDispatch[],
	verbose = false,
	thresholdMinutes = 60,
): string {
	if (verbose) {
		return formatVerboseStuckDispatches(dispatches);
	}
	if (dispatches.length === 0) {
		return `No stuck dispatches found. Pending dispatches older than ${thresholdMinutes} minutes appear here when a subagent session dies silently.`;
	}

	return ["Stuck Dispatches", "", formatStuckDispatchesTable(dispatches)].join("\n");
}

export function formatStuck(
	dispatches: readonly InspectStuckDispatch[],
	verbose = false,
	thresholdMinutes = 60,
): string {
	return formatStuckDispatches(dispatches, verbose, thresholdMinutes);
}

export function formatLessons(lessons: readonly InspectLessonSummary[], verbose = false): string {
	if (verbose) {
		return formatVerboseLessons(lessons);
	}
	if (lessons.length === 0) {
		return "No lessons found. Lessons are extracted during the RETROSPECTIVE phase of pipeline runs.";
	}

	return ["Lessons", "", formatLessonsTable(lessons)].join("\n");
}

export function formatPreferences(
	preferences: readonly InspectPreferenceSummary[],
	verbose = false,
): string {
	if (verbose) {
		return formatVerbosePreferences(preferences);
	}
	if (preferences.length === 0) {
		return "No preferences found. Preferences are inferred from sessions and confirmed evidence.";
	}

	return ["Preferences", "", formatPreferencesTable(preferences)].join("\n");
}

export function formatMemories(memories: readonly InspectMemorySummary[], verbose = false): string {
	if (verbose) {
		return formatVerboseMemories(memories);
	}
	if (memories.length === 0) {
		return "No memories found. Memories are stored by memory tools or capture heuristics.";
	}

	return ["Memories", "", formatMemoriesTable(memories)].join("\n");
}
