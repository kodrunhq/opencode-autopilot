import {
	formatEventsTable,
	formatLessonsTable,
	formatPreferencesTable,
	formatRunsTable,
} from "./format-tables";
import {
	formatVerboseEvents,
	formatVerboseLessons,
	formatVerbosePreferences,
	formatVerboseRuns,
} from "./format-verbose";
import type {
	InspectEventSummary,
	InspectLessonSummary,
	InspectPreferenceSummary,
	InspectRunSummary,
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
