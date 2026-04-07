export {
	createMemoryCaptureHandler,
	createMemoryChatMessageHandler,
	type MemoryCaptureDeps,
	memoryCaptureInternals,
} from "./capture";
export * from "./constants";
export { closeMemoryDb, getMemoryDb, initMemoryDb } from "./database";
export { computeRelevanceScore, pruneStaleObservations } from "./decay";
export { computeBigramOverlap, findDuplicateCandidate, normalizeContent } from "./dedup";
export { createMemoryInjector, invalidateMemoryCache, type MemoryInjectorConfig } from "./injector";
export {
	forgetMemory,
	getActiveMemories,
	getMemoryById,
	migratePreferencesToMemories,
	saveMemory,
	searchMemories,
} from "./memories";
export { computeProjectKey } from "./project-key";
export {
	deleteObservation,
	deletePreferenceRecord,
	deletePreferencesByKey,
	getAllPreferences,
	getConfirmedPreferencesForProject,
	getObservationsByProject,
	getPreferenceRecordById,
	getRecentFailureObservations,
	insertObservation,
	listPreferenceEvidence,
	listPreferenceRecords,
	listRelevantLessons,
	prunePreferenceEvidence,
	prunePreferences,
	searchObservations,
	updateAccessCount,
	upsertPreference,
	upsertPreferenceRecord,
	upsertProject,
} from "./repository";
export {
	buildMemoryContext,
	buildMemoryContextV2,
	retrieveMemoryContext,
	retrieveMemoryContextV2,
	type ScoredObservation,
	scoreAndRankObservations,
} from "./retrieval";
export * from "./types";
