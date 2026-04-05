/**
 * Memory repository - unified exports for observations, preferences, projects, and lessons.
 *
 * This module re-exports all public functions from focused sub-modules:
 * - observations.ts: Observation CRUD and search
 * - preferences.ts: Preference records with evidence tracking
 * - projects.ts: Project metadata and path resolution
 * - lessons.ts: Extracted lessons retrieval
 *
 * @module
 */

export { listRelevantLessons } from "./lessons";
// Re-export all public functions from sub-modules
export {
	deleteObservation,
	getObservationsByProject,
	getRecentFailureObservations,
	insertObservation,
	searchObservations,
	updateAccessCount,
} from "./observations";
export {
	deletePreferenceRecord,
	deletePreferencesByKey,
	getAllPreferences,
	getConfirmedPreferencesForProject,
	getPreferenceRecordById,
	type ListPreferenceRecordOptions,
	listPreferenceEvidence,
	listPreferenceRecords,
	type PreferenceEvidencePruneOptions,
	type PreferenceMutationResult,
	type PreferencePruneOptions,
	type PreferencePruneStatus,
	type PreferenceUpsertInput,
	prunePreferenceEvidence,
	prunePreferences,
	type UpsertPreferenceRecordInput,
	upsertPreference,
	upsertPreferenceRecord,
} from "./preferences";
export { getProjectByPath, upsertProject } from "./projects";

// Re-export types for convenience
export type {
	Observation,
	ObservationType,
	Preference,
	PreferenceEvidence,
	PreferenceRecord,
	Project,
} from "./types";
