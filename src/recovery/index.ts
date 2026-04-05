export { classifyError } from "./classifier";
export { createRecoveryEventHandler } from "./event-handler";
export { getDefaultRecoveryOrchestrator, RecoveryOrchestrator } from "./orchestrator";
export {
	clearRecoveryState,
	listRecoveryStates,
	loadRecoveryState,
	saveRecoveryState,
} from "./persistence";
export { getStrategy, type RecoveryStrategyResolver } from "./strategies";
export type {
	ClassificationResult,
	ExtendedErrorCategory,
	ExtendedRecoveryStrategy,
	RecoveryActionEnvelope,
	RecoveryAttempt,
	RecoveryState,
} from "./types";
