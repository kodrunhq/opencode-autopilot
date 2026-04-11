import { randomBytes } from "node:crypto";
import { tool } from "@opencode-ai/plugin";
import { loadConfig } from "../config";
import { openKernelDb } from "../kernel/database";
import { getLogger } from "../logging/domains";
import { parseTypedResultEnvelope } from "../orchestrator/contracts/legacy-result-adapter";
import type { PendingDispatch, ResultEnvelope } from "../orchestrator/contracts/result-envelope";
import {
	buildFailureSummary,
	clearPersistedRetryAttempts,
	clearRetryStateByKey,
	decideRetry,
	detectDispatchFailure,
	getPersistedRetryAttempts,
	getRetryStateByKey,
	recordRetryAttempt,
	setPersistedRetryAttempts,
	sleep,
} from "../orchestrator/dispatch-retry";
import { enrichErrorMessage } from "../orchestrator/error-context";
import { isWaveComplete } from "../orchestrator/handlers/build-utils";
import { PHASE_HANDLERS } from "../orchestrator/handlers/index";
import {
	AGENT_NAMES,
	type DispatchResult,
	type PhaseHandlerContext,
} from "../orchestrator/handlers/types";
import { buildLessonContext } from "../orchestrator/lesson-injection";
import { loadLessonMemory } from "../orchestrator/lesson-memory";
import { logOrchestrationEvent } from "../orchestrator/orchestration-logger";
import { completePhase, getNextPhase, PHASE_INDEX, TOTAL_PHASES } from "../orchestrator/phase";
import { groupByWave } from "../orchestrator/plan";
import { getPhaseProgressString } from "../orchestrator/progress";
import { loadAdaptiveSkillContext } from "../orchestrator/skill-injection";
import {
	createInitialState,
	isStateConflictError,
	loadState,
	patchState,
	saveState,
	updatePersistedState,
} from "../orchestrator/state";
import type { Phase, PipelineState } from "../orchestrator/types";
import { resolveProjectIdentitySync } from "../projects/resolve";
import { getIntentRouting, type IntentType, IntentTypeSchema } from "../routing/intent-types";
import { createRouteTicketRepository } from "../routing/route-ticket-repository";
import { isEnoentError } from "../utils/fs-helpers";
import { ensureGitignore } from "../utils/gitignore";
import {
	getGlobalConfigDir,
	getProjectArtifactDir,
	getProjectRootFromArtifactDir,
} from "../utils/paths";
import { getNotificationManager, getProgressTracker, getTaskToastManager } from "../ux/registry";
import { clearReviewState, reviewCore } from "./review";

interface OrchestrateArgs {
	readonly idea?: string;
	readonly result?: string;
	readonly intent?: IntentType;
	readonly abandon?: boolean;
	readonly routeToken?: string;
}

const ORCHESTRATE_ERROR_CODES = Object.freeze({
	ACTIVE_RUN_EXISTS: "E_ACTIVE_RUN_EXISTS",
	INVALID_RESULT: "E_INVALID_RESULT",
	STALE_RESULT: "E_STALE_RESULT",
	PHASE_MISMATCH: "E_PHASE_MISMATCH",
	UNKNOWN_DISPATCH: "E_UNKNOWN_DISPATCH",
	DUPLICATE_RESULT: "E_DUPLICATE_RESULT",
	DUPLICATE_DISPATCH: "E_DUPLICATE_DISPATCH",
	PENDING_RESULT_REQUIRED: "E_PENDING_RESULT_REQUIRED",
	RESULT_KIND_MISMATCH: "E_RESULT_KIND_MISMATCH",
});

function mapRouteTokenValidationError(reason: string | undefined): string {
	switch (reason) {
		case "Route ticket session mismatch":
		case "Route ticket message mismatch":
		case "Route ticket project mismatch":
			return "E_ROUTE_TOKEN_MISMATCH";
		case "Route ticket already consumed":
			return "E_ROUTE_TOKEN_CONSUMED";
		case "Route ticket not found, expired, or already consumed":
			return "E_INVALID_ROUTE_TOKEN";
		case "Route ticket intent mismatch":
		case "Route ticket not authorized for pipeline use":
			return "E_INVALID_ROUTE_TOKEN";
		default:
			if (reason?.includes("already consumed")) {
				return "E_ROUTE_TOKEN_CONSUMED";
			}
			if (reason?.includes("mismatch")) {
				return "E_ROUTE_TOKEN_MISMATCH";
			}
			return "E_INVALID_ROUTE_TOKEN";
	}
}

function createDispatchId(): string {
	return `dispatch_${randomBytes(6).toString("hex")}`;
}

function startProgressForDispatch(phase: string, totalSteps: number): void {
	const tracker = getProgressTracker();
	if (!tracker) {
		return;
	}
	tracker.startPhase(phase, Math.max(1, totalSteps));
}

function buildProgressLabelFromEnvelope(envelope: Readonly<ResultEnvelope>): string {
	if (envelope.taskId !== null) {
		return `${envelope.phase} task ${String(envelope.taskId)}`;
	}
	if (envelope.agent) {
		return `${envelope.phase} ${envelope.agent}`;
	}
	return envelope.phase;
}

function buildProgressLabelFromPending(pending: Readonly<PendingDispatch>): string {
	if (pending.taskId !== null) {
		return `${pending.phase} task ${String(pending.taskId)}`;
	}
	return `${pending.phase} ${pending.agent}`;
}

function advanceProgressForEnvelope(envelope: Readonly<ResultEnvelope>): void {
	getProgressTracker()?.advanceStep(buildProgressLabelFromEnvelope(envelope));
}

function addToastTaskForDispatch(
	pending: Readonly<PendingDispatch>,
	options?: { readonly description?: string },
): void {
	getTaskToastManager()?.addTask({
		id: pending.dispatchId,
		description: options?.description ?? buildProgressLabelFromPending(pending),
		agent: pending.agent,
		isBackground: false,
	});
}

function clearToastTaskForDispatch(dispatchId: string): void {
	getTaskToastManager()?.removeTask(dispatchId);
}

function showCompletionToastForEnvelope(
	state: Readonly<PipelineState>,
	envelope: Readonly<ResultEnvelope>,
): void {
	const pending = findPendingDispatch(state, envelope.dispatchId);
	if (!pending) {
		return;
	}

	getTaskToastManager()?.showCompletionToast({
		id: pending.dispatchId,
		description: buildProgressLabelFromEnvelope(envelope),
		duration: formatElapsed(pending.issuedAt),
	});
}

function findPendingDispatch(
	state: Readonly<PipelineState>,
	dispatchId: string,
): PendingDispatch | null {
	return state.pendingDispatches.find((entry) => entry.dispatchId === dispatchId) ?? null;
}

function withPendingDispatch(
	state: Readonly<PipelineState>,
	entry: PendingDispatch,
): PipelineState {
	return patchState(state, {
		pendingDispatches: [...state.pendingDispatches, entry],
	});
}

function removePendingDispatch(state: Readonly<PipelineState>, dispatchId: string): PipelineState {
	return patchState(state, {
		pendingDispatches: state.pendingDispatches.filter((entry) => entry.dispatchId !== dispatchId),
	});
}

function expectedResultKindForPending(pending: Readonly<PendingDispatch>): string {
	return pending.resultKind;
}

function markResultProcessed(
	state: Readonly<PipelineState>,
	envelope: ResultEnvelope,
): PipelineState {
	if (state.processedResultIds.includes(envelope.resultId)) {
		return state;
	}
	const capped = [...state.processedResultIds, envelope.resultId];
	const nextIds = capped.length > 5000 ? capped.slice(capped.length - 5000) : capped;
	return patchState(state, {
		processedResultIds: nextIds,
	});
}

function asErrorJson(code: string, message: string): string {
	return JSON.stringify({ action: "error", code, message });
}

function logDeterministicError(
	artifactDir: string,
	phase: string,
	code: string,
	message: string,
): void {
	logOrchestrationEvent(artifactDir, {
		timestamp: new Date().toISOString(),
		phase,
		action: "error",
		message: `${code}: ${message}`.slice(0, 500),
	});
}

function inferExpectedResultKindForAgent(
	agent?: string,
): "phase_output" | "task_completion" | "review_findings" {
	if (agent === "oc-reviewer") {
		return "review_findings";
	}
	if (agent === "oc-implementer") {
		return "task_completion";
	}
	return "phase_output";
}

function ensureDispatchIdentity(
	handlerResult: DispatchResult,
	state: Readonly<PipelineState>,
): DispatchResult {
	if (handlerResult.action === "dispatch") {
		const dispatchId = handlerResult.dispatchId ?? createDispatchId();
		return {
			...handlerResult,
			dispatchId,
			runId: state.runId,
			expectedResultKind:
				handlerResult.expectedResultKind ??
				handlerResult.resultKind ??
				inferExpectedResultKindForAgent(handlerResult.agent),
		};
	}

	if (handlerResult.action === "dispatch_multi") {
		return {
			...handlerResult,
			runId: state.runId,
			agents: handlerResult.agents?.map((entry) => ({
				...entry,
				dispatchId: entry.dispatchId ?? createDispatchId(),
				resultKind: entry.resultKind ?? inferExpectedResultKindForAgent(entry.agent),
			})),
		};
	}

	return handlerResult;
}

function detectPhaseFromPending(state: Readonly<PipelineState>): Phase | null {
	const last = state.pendingDispatches.at(-1);
	return (last?.phase as Phase | undefined) ?? state.currentPhase;
}

function detectAgentFromPending(state: Readonly<PipelineState>): string | null {
	const last = state.pendingDispatches.at(-1);
	return last?.agent ?? null;
}

function detectDispatchFromPending(state: Readonly<PipelineState>): string {
	const last = state.pendingDispatches.at(-1);
	return last?.dispatchId ?? "legacy-dispatch";
}

function applyResultEnvelope(
	state: Readonly<PipelineState>,
	envelope: ResultEnvelope,
	options?: { readonly allowMissingPending?: boolean },
): PipelineState {
	if (state.processedResultIds.includes(envelope.resultId)) {
		throw new Error(
			`${ORCHESTRATE_ERROR_CODES.DUPLICATE_RESULT}: duplicate resultId ${envelope.resultId}`,
		);
	}

	const pending = findPendingDispatch(state, envelope.dispatchId);
	if (pending === null) {
		if (options?.allowMissingPending) {
			return markResultProcessed(state, envelope);
		}
		throw new Error(
			`${ORCHESTRATE_ERROR_CODES.UNKNOWN_DISPATCH}: unknown dispatchId ${envelope.dispatchId}`,
		);
	}
	if (pending.phase !== envelope.phase) {
		throw new Error(
			`${ORCHESTRATE_ERROR_CODES.PHASE_MISMATCH}: result phase ${envelope.phase} != pending ${pending.phase}`,
		);
	}
	if (expectedResultKindForPending(pending) !== envelope.kind) {
		throw new Error(
			`${ORCHESTRATE_ERROR_CODES.RESULT_KIND_MISMATCH}: result kind ${envelope.kind} != pending ${pending.resultKind}`,
		);
	}
	if (pending.taskId !== null && envelope.taskId !== pending.taskId) {
		throw new Error(
			`${ORCHESTRATE_ERROR_CODES.PHASE_MISMATCH}: taskId ${String(envelope.taskId)} != pending ${pending.taskId}`,
		);
	}

	const withoutPending = removePendingDispatch(state, envelope.dispatchId);
	return markResultProcessed(withoutPending, envelope);
}

function parseErrorCode(error: unknown): { readonly code: string; readonly message: string } {
	const message = error instanceof Error ? error.message : String(error);
	const idx = message.indexOf(":");
	if (idx <= 0) {
		return { code: ORCHESTRATE_ERROR_CODES.INVALID_RESULT, message };
	}
	const maybeCode = message.slice(0, idx);
	const rest = message.slice(idx + 1).trim();
	if (!maybeCode.startsWith("E_")) {
		return { code: ORCHESTRATE_ERROR_CODES.INVALID_RESULT, message };
	}
	return { code: maybeCode, message: rest.length > 0 ? rest : message };
}

export function isAbortError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	if (error.name === "AbortError") {
		return true;
	}

	const normalizedMessage = error.message.toLowerCase();
	return ["abort", "cancel", "interrupt", "signal"].some((term) =>
		normalizedMessage.includes(term),
	);
}

function canStartFreshRun(state: Readonly<PipelineState>): boolean {
	return (
		state.currentPhase === null ||
		state.status === "COMPLETED" ||
		state.status === "INTERRUPTED" ||
		state.status === "FAILED"
	);
}

async function startFreshRun(idea: string, artifactDir: string): Promise<string> {
	const newState = createInitialState(idea);
	await saveState(newState, artifactDir);

	try {
		await clearReviewState(artifactDir);
	} catch {
		// Review state is best-effort and should not block a fresh run.
	}

	// Best-effort .gitignore update
	try {
		const projectRoot = getProjectRootFromArtifactDir(artifactDir);
		await ensureGitignore(projectRoot);
	} catch {
		// Swallow gitignore errors -- non-critical
	}

	const handler = PHASE_HANDLERS[newState.currentPhase as Phase];
	const handlerResult = await handler(newState, artifactDir, undefined, undefined);
	return processHandlerResult(handlerResult, newState, artifactDir);
}

/**
 * Handle abort/interrupt cleanup: persist INTERRUPTED status, clear review state,
 * and log the interruption. Best-effort — failures are swallowed so the original
 * AbortError propagates cleanly.
 *
 * Exported for direct unit testing without needing module-level mocks on shared modules.
 */
export async function handleAbortCleanup(
	artifactDir: string,
	initialMessage: string,
): Promise<{ readonly safeMessage: string }> {
	let safeMessage = initialMessage;
	try {
		const currentState = await loadState(artifactDir);
		const timestamp = new Date().toISOString();
		const phase = currentState?.currentPhase ?? "UNKNOWN";

		if (currentState?.currentPhase) {
			safeMessage = enrichErrorMessage(safeMessage, currentState);
			await updatePersistedState(artifactDir, currentState, (latest) =>
				patchState(latest, {
					status: "INTERRUPTED" as const,
					pendingDispatches: [],
				}),
			);
		}

		try {
			await clearReviewState(artifactDir);
		} catch {}

		logOrchestrationEvent(artifactDir, {
			timestamp,
			phase,
			action: "interrupted",
			message: safeMessage,
		});
	} catch (persistError: unknown) {
		if (isStateConflictError(persistError)) {
			// Swallow conflict after retry exhaustion — original error takes priority
		}
		// Swallow save errors — original error takes priority
	}
	return { safeMessage };
}

/**
 * Result of buildMergeTransform: the transform function plus metadata about
 * task IDs where this handler's PENDING→IN_PROGRESS change was redundant
 * because the disk state already had the task as IN_PROGRESS (sibling race).
 */
export interface MergeTransformResult {
	readonly transform: (current: Readonly<PipelineState>) => PipelineState;
	/** Task IDs where our change was redundant — a sibling already dispatched them. */
	readonly redundantTaskIds: ReadonlySet<number>;
}

/**
 * Builds a conflict-safe transform that merges task status changes by ID
 * into the latest persisted state. On conflict retry, `current` is freshly
 * loaded from disk — this ensures concurrent completions (task 1→DONE,
 * task 2→DONE) both survive rather than one overwriting the other.
 *
 * `preHandlerState` is the state snapshot before the handler ran. By diffing
 * `updates.tasks` against it, we identify which tasks THIS handler actually
 * changed and apply only those to the (possibly refreshed) `current`.
 *
 * Also tracks "redundant" task dispatches: when this handler changed a task
 * PENDING→IN_PROGRESS but the disk already had it as IN_PROGRESS (from a
 * sibling's concurrent dispatch). The redundantTaskIds set is populated
 * during transform execution and used by stale dispatch detection.
 *
 * branchLifecycle.tasksPushed is merged additively: new entries from this
 * handler are unioned with the current disk state, preventing concurrent
 * completions from overwriting each other's push history.
 */
export function buildMergeTransform(
	updates: Partial<PipelineState>,
	preHandlerState?: Readonly<PipelineState>,
): MergeTransformResult {
	const changedTaskIds: ReadonlySet<number> | null = (() => {
		if (!updates.tasks) return null;
		if (!preHandlerState) {
			return new Set(updates.tasks.map((t) => t.id));
		}
		const preMap = new Map(preHandlerState.tasks.map((t) => [t.id, t]));
		const ids = new Set<number>();
		for (const updated of updates.tasks) {
			const pre = preMap.get(updated.id);
			if (!pre || pre.status !== updated.status) {
				ids.add(updated.id);
			}
		}
		return ids;
	})();

	const taskChanges = updates.tasks ? new Map(updates.tasks.map((t) => [t.id, t])) : null;

	// Identify tasks this handler moved PENDING→IN_PROGRESS (dispatch candidates)
	const dispatchedByThisHandler: ReadonlySet<number> = (() => {
		if (!preHandlerState || !updates.tasks) return new Set<number>();
		const preMap = new Map(preHandlerState.tasks.map((t) => [t.id, t]));
		const ids = new Set<number>();
		for (const updated of updates.tasks) {
			const pre = preMap.get(updated.id);
			if (pre && pre.status === "PENDING" && updated.status === "IN_PROGRESS") {
				ids.add(updated.id);
			}
		}
		return ids;
	})();

	// Compute new branchLifecycle.tasksPushed entries added by this handler
	const newTasksPushed: readonly string[] = (() => {
		if (!preHandlerState || !updates.branchLifecycle?.tasksPushed) return [];
		const prePushed = new Set(preHandlerState.branchLifecycle?.tasksPushed ?? []);
		return updates.branchLifecycle.tasksPushed.filter((id) => !prePushed.has(id));
	})();

	// Mutable set populated during transform execution on each conflict retry
	const redundantTaskIds = new Set<number>();

	const transform = (current: Readonly<PipelineState>): PipelineState => {
		// Merge branchLifecycle.tasksPushed additively — even when this handler added
		// no new push IDs, we must preserve current.branchLifecycle.tasksPushed so a
		// stale updates.branchLifecycle doesn't overwrite sibling pushes.
		const mergedUpdates = { ...updates };
		if (updates.branchLifecycle && current.branchLifecycle) {
			const currentPushed = new Set(current.branchLifecycle.tasksPushed);
			const additionalPushed = newTasksPushed.filter((id) => !currentPushed.has(id));
			mergedUpdates.branchLifecycle = {
				...updates.branchLifecycle,
				tasksPushed: [...current.branchLifecycle.tasksPushed, ...additionalPushed],
			};
		}

		if (!taskChanges || !changedTaskIds) {
			return patchState(current, mergedUpdates);
		}

		// Clear and repopulate redundant set on each retry
		redundantTaskIds.clear();

		const mergedTasks = current.tasks.map((currentTask) => {
			if (!changedTaskIds.has(currentTask.id)) return currentTask;
			const change = taskChanges.get(currentTask.id);
			if (!change) return currentTask;

			// Detect redundant dispatch: this handler moved task PENDING→IN_PROGRESS
			// but disk already has it as IN_PROGRESS (sibling dispatched first)
			if (dispatchedByThisHandler.has(currentTask.id) && currentTask.status === "IN_PROGRESS") {
				redundantTaskIds.add(currentTask.id);
			}

			return { ...currentTask, ...change };
		});

		const inProgressIds = mergedTasks.filter((t) => t.status === "IN_PROGRESS").map((t) => t.id);
		const mergedBuildProgress = mergedUpdates.buildProgress
			? { ...mergedUpdates.buildProgress, currentTasks: inProgressIds }
			: undefined;

		return patchState(current, {
			...mergedUpdates,
			tasks: mergedTasks,
			...(mergedBuildProgress ? { buildProgress: mergedBuildProgress } : {}),
		});
	};

	return { transform, redundantTaskIds };
}

interface ApplyStateResult {
	readonly state: PipelineState;
	readonly redundantTaskIds: ReadonlySet<number>;
}

async function applyStateUpdates(
	state: Readonly<PipelineState>,
	handlerResult: DispatchResult,
	artifactDir: string,
): Promise<ApplyStateResult> {
	const updates = handlerResult._stateUpdates;
	if (!updates) {
		return { state, redundantTaskIds: new Set<number>() };
	}

	if (handlerResult.phase === "BUILD") {
		const { transform, redundantTaskIds } = buildMergeTransform(updates, state);
		const merged = await updatePersistedState(artifactDir, state, transform);
		return { state: merged, redundantTaskIds };
	}

	const merged = await updatePersistedState(artifactDir, state, (current) =>
		patchState(current, updates),
	);
	return { state: merged, redundantTaskIds: new Set<number>() };
}

/**
 * When a handler dispatches "oc-reviewer", call reviewCore directly instead
 * of returning the dispatch instruction. This avoids the JSON round-trip
 * for the review integration in BUILD phase (per CONTEXT.md).
 */
async function maybeInlineReview(
	handlerResult: DispatchResult,
	artifactDir: string,
): Promise<{ readonly inlined: boolean; readonly reviewResult?: string }> {
	if (
		handlerResult.action === "dispatch" &&
		handlerResult.agent === "oc-reviewer" &&
		handlerResult.prompt
	) {
		const projectRoot = getProjectRootFromArtifactDir(artifactDir);
		const reviewResult = await reviewCore({ scope: "branch" }, projectRoot);
		return { inlined: true, reviewResult };
	}
	return { inlined: false };
}

/**
 * Attempt to inject lesson context into a dispatch prompt.
 * Best-effort: failures are silently swallowed to avoid breaking dispatch.
 */
async function injectLessonContext(
	prompt: string,
	phase: string,
	artifactDir: string,
): Promise<string> {
	try {
		const projectRoot = getProjectRootFromArtifactDir(artifactDir);
		const memory = await loadLessonMemory(projectRoot);
		if (memory && memory.lessons.length > 0) {
			const ctx = buildLessonContext(memory.lessons, phase as Phase);
			if (ctx) {
				return prompt + ctx;
			}
		}
	} catch (error: unknown) {
		if (
			isEnoentError(error) ||
			error instanceof SyntaxError ||
			(error !== null && typeof error === "object" && "issues" in error)
		) {
			return prompt; // I/O, parse, or validation error -- non-critical
		}
		// Treat any NodeJS.ErrnoException (EACCES, EPERM, etc.) as non-critical
		if (error !== null && typeof error === "object") {
			const errWithCode = error as { code?: unknown };
			if (typeof errWithCode.code === "string") {
				return prompt;
			}
		}
		throw error; // re-throw programmer errors
	}
	return prompt;
}

/**
 * Attempt to inject stack-filtered adaptive skill context into a dispatch prompt.
 * Best-effort: failures are silently swallowed to avoid breaking dispatch.
 */
async function injectSkillContext(
	prompt: string,
	projectRoot: string,
	phase?: string,
): Promise<string> {
	try {
		const baseDir = getGlobalConfigDir();
		const config = await loadConfig();
		const mcpEnabled = config?.mcp?.enabled ?? false;
		const ctx = await loadAdaptiveSkillContext(baseDir, projectRoot, {
			phase,
			budget: 1500,
			mode: "summary",
			mcpEnabled,
		});
		if (ctx) return prompt + ctx;
	} catch (err) {
		getLogger("tool", "orchestrate").warn("skill injection failed", { err });
	}
	return prompt;
}

/** Build a human-readable progress string for user-facing display. */
function buildUserProgress(state: PipelineState, label?: string, attempt?: number): string {
	const baseProgress = getPhaseProgressString(state);
	const att = attempt != null ? ` (attempt ${attempt})` : "";
	return `${baseProgress}${label ? ` — ${label}` : ""}${att}`;
}

function formatElapsed(issuedAt: string): string {
	const ms = Date.now() - Date.parse(issuedAt);
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	return `${minutes}m ${seconds % 60}s`;
}

/** Per-agent-per-phase dispatch limits. Keyed by `${phase}:${agent}`. */
const MAX_PHASE_DISPATCHES: Readonly<Record<string, number>> = Object.freeze({
	RECON: 2,
	CHALLENGE: 2,
	ARCHITECT: 3,
	EXPLORE: 2,
	PLAN: 2,
	BUILD: 20,
	SHIP: 2,
	RETROSPECTIVE: 2,
});

/**
 * Circuit breaker: increment per-agent-per-phase dispatch count and abort if limit exceeded.
 * Returns `{ abortMsg, newCount }`. When `abortMsg` is non-null the caller must
 * return it immediately. `newCount` is the authoritative post-increment value.
 */
async function checkCircuitBreaker(
	currentState: Readonly<PipelineState>,
	phase: string,
	agent: string,
	artifactDir: string,
	incrementBy: number = 1,
): Promise<{
	readonly abortMsg: string | null;
	readonly newCount: number;
	readonly nextState: PipelineState;
}> {
	const agentPhaseKey = `${phase}:${agent}`;
	const currentCounts = { ...(currentState.phaseDispatchCounts ?? {}) };
	const candidateCount = (currentCounts[agentPhaseKey] ?? 0) + incrementBy;
	const limit = MAX_PHASE_DISPATCHES[phase] ?? 5;
	if (candidateCount > limit) {
		const msg = `Agent "${agent}" in phase ${phase} exceeded max dispatches (${candidateCount}/${limit}) — possible infinite loop detected. Aborting.`;
		logOrchestrationEvent(artifactDir, {
			timestamp: new Date().toISOString(),
			phase,
			action: "loop_detected",
			agent,
			attempt: candidateCount,
			message: msg,
		});
		return {
			abortMsg: JSON.stringify({ action: "error", message: msg }),
			newCount: candidateCount,
			nextState: currentState,
		};
	}
	const withCounts = await updatePersistedState(artifactDir, currentState, (current) => {
		const nextCounts = { ...(current.phaseDispatchCounts ?? {}) };
		nextCounts[agentPhaseKey] = (nextCounts[agentPhaseKey] ?? 0) + incrementBy;
		return patchState(current, { phaseDispatchCounts: nextCounts });
	});
	return {
		abortMsg: null,
		newCount: withCounts.phaseDispatchCounts[agentPhaseKey] ?? candidateCount,
		nextState: withCounts,
	};
}

/**
 * Extract task IDs being dispatched from a DispatchResult.
 */
export function extractDispatchTaskIds(result: DispatchResult): readonly number[] {
	const ids: number[] = [];
	if (result.action === "dispatch" && result.taskId != null) {
		const id = typeof result.taskId === "string" ? Number(result.taskId) : result.taskId;
		if (Number.isFinite(id)) ids.push(id);
	} else if (result.action === "dispatch_multi" && result.agents) {
		for (const entry of result.agents) {
			if (entry.taskId != null) {
				const id = typeof entry.taskId === "string" ? Number(entry.taskId) : entry.taskId;
				if (Number.isFinite(id)) ids.push(id);
			}
		}
	}
	return ids;
}

/**
 * Detect whether a dispatch/dispatch_multi targets task IDs that a concurrent
 * sibling already dispatched. Compares against `preHandlerState` — the state
 * snapshot BEFORE this handler ran. If a task ID was already IN_PROGRESS in
 * the pre-handler state, it was dispatched by a sibling (since this handler
 * hasn't acted yet at that point). Returns true when ALL dispatched task IDs
 * were already IN_PROGRESS before this handler, meaning the entire dispatch
 * is a duplicate.
 */
export function isStaleDispatch(
	result: DispatchResult,
	preHandlerState: Readonly<PipelineState>,
	redundantTaskIds?: ReadonlySet<number>,
): boolean {
	if (preHandlerState.currentPhase !== "BUILD") return false;

	const dispatchedTaskIds = extractDispatchTaskIds(result);
	if (dispatchedTaskIds.length === 0) return false;

	const alreadyInProgress = new Set(
		preHandlerState.tasks.filter((t) => t.status === "IN_PROGRESS").map((t) => t.id),
	);

	// Stale if ALL dispatched IDs were either already IN_PROGRESS in pre-handler
	// state OR detected as redundant during merge (sibling same-snapshot race)
	return dispatchedTaskIds.every(
		(id) => alreadyInProgress.has(id) || (redundantTaskIds?.has(id) ?? false),
	);
}

/**
 * When the stale-pending re-evaluation needs to re-invoke the BUILD handler,
 * ensure that a just-completed wave gets its mandatory review. After concurrent
 * merges, the handler's original E_BUILD_RESULT_PENDING saw siblings still
 * in-progress — but after the merge, the wave may be fully complete. Setting
 * reviewPending=true lets the existing `reviewPending && !resultText` path in
 * build.ts dispatch the reviewer correctly.
 */
export function prepareStateForBuildRerun(currentState: PipelineState): PipelineState {
	const wave = currentState.buildProgress.currentWave;
	if (wave == null) return currentState;

	const waveMap = groupByWave(currentState.tasks);
	if (isWaveComplete(waveMap, wave)) {
		return patchState(currentState, {
			buildProgress: {
				...currentState.buildProgress,
				reviewPending: true,
			},
		});
	}
	return currentState;
}

/**
 * Process a handler's DispatchResult, handling complete/dispatch/dispatch_multi/error.
 * On complete, advances the phase and invokes the next handler.
 */
async function processHandlerResult(
	handlerResult: DispatchResult,
	state: Readonly<PipelineState>,
	artifactDir: string,
): Promise<string> {
	const normalizedResult = ensureDispatchIdentity(handlerResult, state);

	// Apply state updates from handler if present
	const { state: mergedState, redundantTaskIds } = await applyStateUpdates(
		state,
		normalizedResult,
		artifactDir,
	);
	let currentState = mergedState;

	// When concurrent task completions merge, the handler's E_BUILD_RESULT_PENDING
	// decision may be stale — all tasks might already be DONE after the merge.
	// Re-run the BUILD handler against the fresh merged state to pick up wave
	// completion, review dispatch, or next-wave advancement.
	// prepareStateForBuildRerun sets reviewPending=true when the wave is now
	// fully complete, so the handler dispatches a mandatory review rather than
	// skipping to the next wave. We persist this to disk so the reviewer result
	// later finds reviewPending=true.
	if (
		normalizedResult.action === "error" &&
		normalizedResult.code === "E_BUILD_RESULT_PENDING" &&
		currentState.buildProgress.currentTasks.length === 0 &&
		currentState.currentPhase === "BUILD"
	) {
		const stateForRerun = prepareStateForBuildRerun(currentState);
		if (stateForRerun !== currentState) {
			currentState = await updatePersistedState(artifactDir, currentState, (current) =>
				patchState(current, {
					buildProgress: { ...current.buildProgress, reviewPending: true },
				}),
			);
		}
		const freshHandler = PHASE_HANDLERS.BUILD;
		const freshResult = await freshHandler(currentState, artifactDir, undefined, undefined);
		return processHandlerResult(freshResult, currentState, artifactDir);
	}

	// When concurrent completions both try to replenish the same pending task,
	// the pre-handler state already has that task IN_PROGRESS from a sibling's
	// dispatch. Re-invoke BUILD against the fresh merged state so it picks the
	// correct next pending task (or waits if the cap is full).
	if (
		(normalizedResult.action === "dispatch" || normalizedResult.action === "dispatch_multi") &&
		state.currentPhase === "BUILD" &&
		isStaleDispatch(normalizedResult, state, redundantTaskIds)
	) {
		const freshHandler = PHASE_HANDLERS.BUILD;
		const freshResult = await freshHandler(currentState, artifactDir, undefined, undefined);
		return processHandlerResult(freshResult, currentState, artifactDir);
	}

	switch (normalizedResult.action) {
		case "error": {
			const codePrefix = normalizedResult.code ? `${normalizedResult.code}: ` : "";
			const messageBody = normalizedResult.message ?? "Handler returned error";
			logOrchestrationEvent(artifactDir, {
				timestamp: new Date().toISOString(),
				phase: normalizedResult.phase ?? currentState.currentPhase ?? "UNKNOWN",
				action: "error",
				message: `${codePrefix}${messageBody}`.slice(0, 500),
			});
			void getNotificationManager()?.error(
				"Pipeline error",
				`${normalizedResult.phase ?? "Unknown"}: ${messageBody}`.slice(0, 200),
			);
			return JSON.stringify(normalizedResult);
		}

		case "dispatch": {
			// Circuit breaker
			const phase = normalizedResult.phase ?? currentState.currentPhase ?? "UNKNOWN";
			const dispatchAgent = normalizedResult.agent ?? "unknown";
			const {
				abortMsg,
				newCount: attempt,
				nextState,
			} = await checkCircuitBreaker(currentState, phase, dispatchAgent, artifactDir, 1);
			if (abortMsg) return abortMsg;
			currentState = nextState;

			// Duplicate dispatch guard: prevent dispatching the same agent+phase twice
			const isDuplicate = currentState.pendingDispatches.some(
				(p) => p.agent === dispatchAgent && p.phase === phase,
			);
			if (isDuplicate) {
				const msg = `Duplicate dispatch: agent "${dispatchAgent}" already has a pending dispatch for phase ${phase}.`;
				logOrchestrationEvent(artifactDir, {
					timestamp: new Date().toISOString(),
					phase,
					action: "error",
					agent: dispatchAgent,
					message: `${ORCHESTRATE_ERROR_CODES.DUPLICATE_DISPATCH}: ${msg}`,
				});
				return asErrorJson(ORCHESTRATE_ERROR_CODES.DUPLICATE_DISPATCH, msg);
			}

			const pendingEntry: PendingDispatch = {
				dispatchId: normalizedResult.dispatchId ?? createDispatchId(),
				phase: phase as Phase,
				agent: normalizedResult.agent ?? "unknown",
				issuedAt: new Date().toISOString(),
				resultKind: normalizedResult.expectedResultKind ?? "phase_output",
				taskId: normalizedResult.taskId ?? null,
			};

			// Log the dispatch event before any inline-review or context injection
			const progress = buildUserProgress(currentState, normalizedResult.progress, attempt);
			logOrchestrationEvent(artifactDir, {
				timestamp: new Date().toISOString(),
				phase,
				action: "dispatch",
				agent: normalizedResult.agent,
				promptLength: normalizedResult.prompt?.length,
				attempt,
			});

			void getNotificationManager()?.info(
				`${phase}: dispatching`,
				`Agent: ${normalizedResult.agent ?? "unknown"} — ${normalizedResult.progress ?? ""}`.slice(
					0,
					200,
				),
			);
			getTaskToastManager()?.addTask({
				id: pendingEntry.dispatchId,
				description: normalizedResult.progress ?? phase,
				agent: normalizedResult.agent ?? "unknown",
				isBackground: false,
			});
			startProgressForDispatch(phase, 1);

			// Check if this is a review dispatch that should be inlined
			const { inlined, reviewResult } = await maybeInlineReview(normalizedResult, artifactDir);
			if (inlined && reviewResult) {
				if (currentState.currentPhase) {
					let reviewPayloadText = reviewResult;
					try {
						const parsedReview = JSON.parse(reviewResult) as {
							findingsEnvelope?: unknown;
						};
						if (parsedReview.findingsEnvelope) {
							reviewPayloadText = JSON.stringify(parsedReview.findingsEnvelope);
						}
					} catch {
						// keep raw review payload for legacy parser
					}

					const inlinedEnvelope: ResultEnvelope = {
						schemaVersion: 1,
						resultId: `inline-${createDispatchId()}`,
						runId: currentState.runId,
						phase: currentState.currentPhase,
						dispatchId: pendingEntry.dispatchId,
						agent: normalizedResult.agent ?? null,
						kind: "review_findings",
						taskId: normalizedResult.taskId ?? null,
						payload: {
							text: reviewPayloadText,
						},
					};
					const withInlineResult = await updatePersistedState(
						artifactDir,
						currentState,
						(current) =>
							applyResultEnvelope(withPendingDispatch(current, pendingEntry), inlinedEnvelope),
					);
					getTaskToastManager()?.showCompletionToast({
						id: pendingEntry.dispatchId,
						description: normalizedResult.progress ?? phase,
						duration: formatElapsed(pendingEntry.issuedAt),
					});
					advanceProgressForEnvelope(inlinedEnvelope);

					const handler = PHASE_HANDLERS[currentState.currentPhase];
					const nextResult = await handler(withInlineResult, artifactDir, reviewPayloadText, {
						envelope: inlinedEnvelope,
					});
					return processHandlerResult(nextResult, withInlineResult, artifactDir);
				}
				// State unavailable or pipeline completed after inline review — return complete
				return JSON.stringify({
					action: "complete",
					summary: "Inline review completed; no active phase.",
					_userProgress: progress,
				});
			}

			currentState = await updatePersistedState(artifactDir, currentState, (current) =>
				withPendingDispatch(current, pendingEntry),
			);

			// Inject lesson + skill context into dispatch prompt (best-effort)
			if (normalizedResult.prompt && normalizedResult.phase) {
				const enrichedPrompt = await injectLessonContext(
					normalizedResult.prompt,
					normalizedResult.phase,
					artifactDir,
				);
				const withSkills = await injectSkillContext(
					enrichedPrompt,
					getProjectRootFromArtifactDir(artifactDir),
					normalizedResult.phase,
				);
				if (withSkills !== normalizedResult.prompt) {
					return JSON.stringify({
						...normalizedResult,
						prompt: withSkills,
						dispatchId: pendingEntry.dispatchId,
						runId: currentState.runId,
						_userProgress: progress,
					});
				}
			}
			return JSON.stringify({
				...normalizedResult,
				dispatchId: pendingEntry.dispatchId,
				runId: currentState.runId,
				_userProgress: progress,
			});
		}

		case "dispatch_multi": {
			// Circuit breaker — key on first agent, increment by total agent count
			const phase = normalizedResult.phase ?? currentState.currentPhase ?? "UNKNOWN";
			const multiAgentName = normalizedResult.agents?.[0]?.agent ?? "unknown";
			const multiAgentCount = normalizedResult.agents?.length ?? 1;
			const {
				abortMsg,
				newCount: attempt,
				nextState,
			} = await checkCircuitBreaker(
				currentState,
				phase,
				multiAgentName,
				artifactDir,
				multiAgentCount,
			);
			if (abortMsg) return abortMsg;
			currentState = nextState;

			// Duplicate dispatch guard: prevent dispatching the same agent+phase twice
			if (normalizedResult.agents) {
				const duplicateAgent = normalizedResult.agents.find((entry) =>
					currentState.pendingDispatches.some((p) => p.agent === entry.agent && p.phase === phase),
				);
				if (duplicateAgent) {
					const msg = `Duplicate dispatch: agent "${duplicateAgent.agent}" already has a pending dispatch for phase ${phase}.`;
					logOrchestrationEvent(artifactDir, {
						timestamp: new Date().toISOString(),
						phase,
						action: "error",
						agent: duplicateAgent.agent,
						message: `${ORCHESTRATE_ERROR_CODES.DUPLICATE_DISPATCH}: ${msg}`,
					});
					return asErrorJson(ORCHESTRATE_ERROR_CODES.DUPLICATE_DISPATCH, msg);
				}
			}

			const pendingEntries: readonly PendingDispatch[] =
				normalizedResult.agents?.map((entry) => ({
					dispatchId: entry.dispatchId ?? createDispatchId(),
					phase: phase as Phase,
					agent: entry.agent,
					issuedAt: new Date().toISOString(),
					resultKind: entry.resultKind ?? inferExpectedResultKindForAgent(entry.agent),
					taskId: entry.taskId ?? null,
				})) ?? [];

			const progress = buildUserProgress(currentState, normalizedResult.progress, attempt);
			logOrchestrationEvent(artifactDir, {
				timestamp: new Date().toISOString(),
				phase,
				action: "dispatch_multi",
				agent: `${normalizedResult.agents?.length ?? 0} agents`,
				attempt,
			});
			for (const pendingEntry of pendingEntries) {
				addToastTaskForDispatch(pendingEntry, {
					description: buildProgressLabelFromPending(pendingEntry),
				});
			}
			startProgressForDispatch(phase, pendingEntries.length);
			currentState = await updatePersistedState(artifactDir, currentState, (current) => {
				let nextState = current;
				for (const entry of pendingEntries) {
					nextState = withPendingDispatch(nextState, entry);
				}
				return nextState;
			});

			// Inject lesson + skill context into each agent's prompt (best-effort)
			// Load lesson and skill context once and reuse for all agents in the batch
			if (normalizedResult.agents && normalizedResult.phase) {
				const lessonSuffix = await injectLessonContext("", normalizedResult.phase, artifactDir);
				const skillSuffix = await injectSkillContext(
					"",
					getProjectRootFromArtifactDir(artifactDir),
					normalizedResult.phase,
				);
				const combinedSuffix = lessonSuffix + (skillSuffix || "");
				if (combinedSuffix) {
					const enrichedAgents = normalizedResult.agents.map((entry) => ({
						...entry,
						prompt: entry.prompt + combinedSuffix,
					}));
					return JSON.stringify({
						...normalizedResult,
						agents: enrichedAgents,
						runId: currentState.runId,
						_userProgress: progress,
					});
				}
			}
			return JSON.stringify({
				...normalizedResult,
				runId: currentState.runId,
				_userProgress: progress,
			});
		}

		case "complete": {
			if (currentState.currentPhase === null) {
				return JSON.stringify({
					action: "complete",
					summary: `Pipeline completed. Idea: ${currentState.idea}`,
				});
			}

			logOrchestrationEvent(artifactDir, {
				timestamp: new Date().toISOString(),
				phase: currentState.currentPhase,
				action: "complete",
			});

			// Task completion toast when taskId is present
			if (normalizedResult.taskId != null) {
				const taskId = String(normalizedResult.taskId);
				const taskTitle = normalizedResult.progress ?? `Task ${taskId}`;

				const matchingPendingDispatch = currentState.pendingDispatches.find(
					(pending) => pending.dispatchId === taskId || pending.taskId === normalizedResult.taskId,
				);

				getTaskToastManager()?.showCompletionToast({
					id: taskId,
					description: taskTitle,
					...(matchingPendingDispatch?.issuedAt != null
						? { duration: formatElapsed(matchingPendingDispatch.issuedAt) }
						: {}),
				});
				getLogger("tool", "orchestrate").info("task completed", {
					taskId,
					phase: currentState.currentPhase,
				});
			}

			for (const pending of currentState.pendingDispatches) {
				getTaskToastManager()?.showCompletionToast({
					id: pending.dispatchId,
					description: `${pending.phase}: ${pending.agent}`,
					duration: formatElapsed(pending.issuedAt),
				});
			}

			getProgressTracker()?.complete();

			const nextPhase = getNextPhase(currentState.currentPhase);
			const advanced = await updatePersistedState(artifactDir, currentState, (current) =>
				completePhase(current),
			);

			// Phase complete toast
			void getNotificationManager()?.success(
				"Phase Complete",
				`Advanced to ${nextPhase ?? "finished"}`,
			);

			if (nextPhase === null) {
				const idx = PHASE_INDEX[currentState.currentPhase] ?? TOTAL_PHASES;
				void getNotificationManager()?.success(
					"Pipeline complete",
					`All ${TOTAL_PHASES} phases finished for: ${currentState.idea.slice(0, 100)}`,
				);
				return JSON.stringify({
					action: "complete",
					summary: `Pipeline completed all ${TOTAL_PHASES} phases. Idea: ${currentState.idea}`,
					_userProgress: `Completed ${currentState.currentPhase} (${idx}/${TOTAL_PHASES}), pipeline finished`,
				});
			}

			// Phase started toast
			const nextAgent =
				nextPhase === "EXPLORE"
					? "local analysis"
					: (AGENT_NAMES[nextPhase as keyof typeof AGENT_NAMES] ?? "unknown");
			void getNotificationManager()?.info(
				`Phase ${nextPhase} Started`,
				`Executing agent ${nextAgent}`,
			);

			// Invoke the next phase handler immediately
			const nextHandler = PHASE_HANDLERS[nextPhase];
			const nextResult = await nextHandler(advanced, artifactDir, undefined, undefined);
			return processHandlerResult(nextResult, advanced, artifactDir);
		}

		default:
			return JSON.stringify({
				action: "error",
				message: `Unknown handler action: "${String((handlerResult as unknown as Record<string, unknown>).action)}"`,
			});
	}
}

interface OrchestrateContext {
	sessionId: string;
	messageId: string;
	projectRoot: string;
}

export async function orchestrateCore(
	args: OrchestrateArgs,
	artifactDir: string,
	context?: OrchestrateContext,
): Promise<string> {
	try {
		let state = await loadState(artifactDir);

		// No state and no idea -> error
		if (state === null && !args.idea) {
			return JSON.stringify({
				action: "error",
				message: "No active run. Provide an idea to start.",
			});
		}

		// No state but idea provided -> route token validation and intent guard
		if (state === null && args.idea) {
			// Route token validation - only when context is provided (for test compatibility)
			if (context) {
				if (!args.routeToken) {
					return JSON.stringify({
						action: "error",
						code: "E_ROUTE_TOKEN_REQUIRED",
						message:
							"Route token is required to start the pipeline. Call oc_route first to classify the user's intent and obtain a route token, then pass routeToken to oc_orchestrate.",
					});
				}
				if (context.projectRoot) {
					let db: ReturnType<typeof openKernelDb> | null = null;
					try {
						db = await openKernelDb(context.projectRoot);
						const routeTicketRepo = createRouteTicketRepository(db);
						const project = resolveProjectIdentitySync(context.projectRoot, { db });
						const validationResult = routeTicketRepo.validateAndConsumeTicket(args.routeToken, {
							sessionId: context.sessionId,
							messageId: context.messageId ?? "",
							projectId: project.id,
							intent: args.intent ?? "implementation",
						});
						if (!validationResult.valid) {
							return JSON.stringify({
								action: "error",
								code: mapRouteTokenValidationError(validationResult.reason),
								message: `Invalid or expired route token: ${validationResult.reason}. Call oc_route first to obtain a valid route token, then pass it to oc_orchestrate.`,
							});
						}
					} catch {
						// Database/project setup may not exist in all contexts
						// For now, allow the pipeline to proceed if we can't validate
						// This maintains backward compatibility while enabling validation where supported
					} finally {
						db?.close();
					}
				}
			}
			if (!args.intent) {
				return JSON.stringify({
					action: "error",
					code: "E_INTENT_REQUIRED",
					message:
						"Intent classification is required to start the pipeline. Call oc_route first to classify the user's intent, then pass intent: 'implementation' to oc_orchestrate.",
				});
			}
			if (args.intent !== "implementation") {
				const routing = getIntentRouting(args.intent);
				return JSON.stringify({
					action: "error",
					code: "E_INTENT_NOT_IMPLEMENTATION",
					message: `Intent '${args.intent}' does not use the pipeline. Route to ${routing.targetAgent} instead. ${routing.behavior}`,
				});
			}

			return startFreshRun(args.idea, artifactDir);
		}

		// State exists
		if (state !== null) {
			// Result-based resumes are machine-driven continuations — skip intent guards.
			// Human-initiated calls (idea or bare advance) still require intent classification.
			if (!args.result) {
				if (args.intent && args.intent !== "implementation") {
					const routing = getIntentRouting(args.intent);
					return JSON.stringify({
						action: "error",
						code: "E_INTENT_NOT_IMPLEMENTATION",
						message: `Intent '${args.intent}' does not use the pipeline. Route to ${routing.targetAgent} instead. ${routing.behavior}`,
					});
				}

				// New user turn with idea on active pipeline requires intent classification
				if (args.idea && !args.intent) {
					return JSON.stringify({
						action: "error",
						code: "E_INTENT_REQUIRED",
						message:
							"A new idea on an active pipeline requires intent classification. Call oc_route first, then pass intent: 'implementation' to continue the pipeline with a new idea.",
					});
				}

				if (args.idea && args.intent === "implementation") {
					if (canStartFreshRun(state)) {
						return startFreshRun(args.idea, artifactDir);
					}

					return JSON.stringify({
						action: "error",
						code: ORCHESTRATE_ERROR_CODES.ACTIVE_RUN_EXISTS,
						message: `Active pipeline run ${state.runId} is still in progress at ${state.currentPhase}. Resume it with a typed result envelope, or call oc_orchestrate with abandon: true before starting a new idea.`,
					});
				}
			}

			if (args.abandon) {
				const abandonedState = patchState(state, {
					status: "INTERRUPTED" as const,
					pendingDispatches: [],
				});
				await saveState(abandonedState, artifactDir);
				return JSON.stringify({
					action: "abandoned",
					runId: state.runId,
					status: "INTERRUPTED",
					displayText: `Pipeline run ${state.runId} abandoned. Start fresh with oc_orchestrate.`,
				});
			}

			let phaseHandlerContext: PhaseHandlerContext | undefined;
			let handlerInputResult = args.result;

			if (state.currentPhase === null) {
				return JSON.stringify({
					action: "complete",
					summary: `Pipeline already completed. Idea: ${state.idea}`,
				});
			}

			if (args.result === undefined && state.pendingDispatches.length > 0) {
				const pending = state.pendingDispatches.at(-1);
				const msg = `Pending result required for dispatch ${pending?.dispatchId ?? "unknown"} (${pending?.agent ?? "unknown"} / ${pending?.phase ?? state.currentPhase}). Submit a typed result envelope, or call oc_orchestrate with abandon: true to reset the pipeline.`;
				logDeterministicError(
					artifactDir,
					pending?.phase ?? state.currentPhase,
					ORCHESTRATE_ERROR_CODES.PENDING_RESULT_REQUIRED,
					msg,
				);
				return asErrorJson(ORCHESTRATE_ERROR_CODES.PENDING_RESULT_REQUIRED, msg);
			}

			if (typeof args.result === "string") {
				const phaseHint = detectPhaseFromPending(state);
				if (phaseHint === null) {
					const msg = "Received result but no pending dispatch exists.";
					logDeterministicError(
						artifactDir,
						state.currentPhase ?? "UNKNOWN",
						ORCHESTRATE_ERROR_CODES.STALE_RESULT,
						msg,
					);
					return asErrorJson(ORCHESTRATE_ERROR_CODES.STALE_RESULT, msg);
				}

				try {
					const parsed = parseTypedResultEnvelope(args.result, {
						runId: state.runId,
						phase: phaseHint,
						fallbackDispatchId: detectDispatchFromPending(state),
						fallbackAgent: detectAgentFromPending(state),
					});

					if (parsed.envelope.runId !== state.runId) {
						const msg = `Result runId ${parsed.envelope.runId} does not match active run ${state.runId}.`;
						logDeterministicError(
							artifactDir,
							state.currentPhase ?? phaseHint,
							ORCHESTRATE_ERROR_CODES.STALE_RESULT,
							msg,
						);
						return asErrorJson(ORCHESTRATE_ERROR_CODES.STALE_RESULT, msg);
					}

					const payloadText = parsed.envelope.payload.text;
					const dispatchError = detectDispatchFailure(payloadText);

					if (dispatchError !== null) {
						const failedDispatchId = parsed.envelope.dispatchId;
						const failedPhase = parsed.envelope.phase;
						const failedAgent = parsed.envelope.agent ?? "unknown";

						logOrchestrationEvent(artifactDir, {
							timestamp: new Date().toISOString(),
							phase: failedPhase,
							action: "error",
							agent: failedAgent,
							dispatchId: failedDispatchId,
							message: `Dispatch failure detected: ${dispatchError.slice(0, 300)}`,
						});

						void getNotificationManager()?.warn(
							"Subtask failed",
							`${failedAgent} in ${failedPhase}: ${dispatchError.slice(0, 100)}`,
						);

						const persistedAttempts = getPersistedRetryAttempts(
							state.retryAttempts,
							failedPhase,
							failedAgent,
						);
						const decision = decideRetry(
							failedDispatchId,
							failedPhase,
							failedAgent,
							dispatchError,
							2,
							persistedAttempts,
						);

						if (decision.shouldRetry) {
							const newCount = recordRetryAttempt(
								failedDispatchId,
								failedPhase,
								failedAgent,
								decision.errorCategory,
								dispatchError,
							);

							state = await updatePersistedState(artifactDir, state, (current) => {
								const currentPersisted = getPersistedRetryAttempts(
									current.retryAttempts,
									failedPhase,
									failedAgent,
								);
								const retryCountToPersist = Math.max(newCount, currentPersisted + 1);

								return patchState(current, {
									retryAttempts: setPersistedRetryAttempts(
										current.retryAttempts,
										failedPhase,
										failedAgent,
										retryCountToPersist,
									),
								});
							});

							logOrchestrationEvent(artifactDir, {
								timestamp: new Date().toISOString(),
								phase: failedPhase,
								action: "dispatch",
								agent: failedAgent,
								dispatchId: failedDispatchId,
								message: `Retrying dispatch: ${decision.reasoning}`,
								payload: {
									retryBackoffMs: decision.backoffMs,
									useFallbackModel: decision.useFallbackModel,
									errorCategory: decision.errorCategory,
								},
							});

							// Apply backoff delay before retry
							if (decision.backoffMs > 0) {
								await sleep(decision.backoffMs);
							}

							state = await updatePersistedState(artifactDir, state, (current) =>
								applyResultEnvelope(current, parsed.envelope),
							);
							clearToastTaskForDispatch(parsed.envelope.dispatchId);

							if (state.currentPhase !== null) {
								const retryHandler = PHASE_HANDLERS[state.currentPhase];
								const retryResult = await retryHandler(state, artifactDir, undefined, undefined);
								return processHandlerResult(retryResult, state, artifactDir);
							}
						}

						// Read retry state BEFORE clearing — otherwise attempts is always lost
						const retryState = getRetryStateByKey(failedPhase, failedAgent);
						const inMemoryAttempts = retryState?.attempts ?? 0;
						const actualAttempts = Math.max(inMemoryAttempts, persistedAttempts) || 1;
						clearRetryStateByKey(failedPhase, failedAgent);

						state = await updatePersistedState(artifactDir, state, (current) => {
							const withEnvelope = applyResultEnvelope(current, parsed.envelope);
							return patchState(withEnvelope, {
								retryAttempts: clearPersistedRetryAttempts(
									withEnvelope.retryAttempts,
									failedPhase,
									failedAgent,
								),
							});
						});
						clearToastTaskForDispatch(parsed.envelope.dispatchId);
						advanceProgressForEnvelope(parsed.envelope);
						const failureSummary = buildFailureSummary(
							failedDispatchId,
							failedPhase,
							failedAgent,
							dispatchError,
							decision.errorCategory,
							actualAttempts,
						);

						phaseHandlerContext = { envelope: parsed.envelope };
						handlerInputResult = failureSummary;
					} else {
						clearRetryStateByKey(parsed.envelope.phase, parsed.envelope.agent ?? "unknown");

						const nextState = await updatePersistedState(artifactDir, state, (current) => {
							const withEnvelope = applyResultEnvelope(current, parsed.envelope);
							return patchState(withEnvelope, {
								retryAttempts: clearPersistedRetryAttempts(
									withEnvelope.retryAttempts,
									parsed.envelope.phase,
									parsed.envelope.agent ?? "unknown",
								),
							});
						});
						showCompletionToastForEnvelope(state, parsed.envelope);
						state = nextState;
						advanceProgressForEnvelope(parsed.envelope);

						phaseHandlerContext = {
							envelope: parsed.envelope,
						};
						handlerInputResult = parsed.envelope.payload.text;
					}
				} catch (error: unknown) {
					const parsedErr = parseErrorCode(error);
					logOrchestrationEvent(artifactDir, {
						timestamp: new Date().toISOString(),
						phase: state.currentPhase ?? "UNKNOWN",
						action: "error",
						message: `${parsedErr.code}: ${parsedErr.message}`,
					});
					return asErrorJson(parsedErr.code, parsedErr.message);
				}
			}

			// Delegate to current phase handler
			if (state.currentPhase === null) {
				return JSON.stringify({
					action: "complete",
					summary: `Pipeline already completed. Idea: ${state.idea}`,
				});
			}
			const handler = PHASE_HANDLERS[state.currentPhase];
			const handlerResult = await handler(
				state,
				artifactDir,
				handlerInputResult,
				phaseHandlerContext,
			);
			return processHandlerResult(handlerResult, state, artifactDir);
		}

		return JSON.stringify({ action: "error", message: "Unexpected state" });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		const parsedErr = parseErrorCode(error);
		let safeMessage = message.replace(/[/\\][^\s"']+/g, "[PATH]").slice(0, 4096);

		if (isAbortError(error)) {
			const result = await handleAbortCleanup(artifactDir, safeMessage);
			return JSON.stringify({
				action: "error",
				code: "E_INTERRUPTED",
				message: result.safeMessage,
			});
		}

		// Persist failure metadata for forensics (best-effort)
		try {
			const currentState = await loadState(artifactDir);
			if (currentState?.currentPhase) {
				safeMessage = enrichErrorMessage(safeMessage, currentState);
				const lastDone = currentState.phases.filter((p) => p.status === "DONE").pop();
				const failureContext = {
					failedPhase: currentState.currentPhase,
					failedAgent: null as string | null,
					errorMessage: safeMessage,
					timestamp: new Date().toISOString(),
					lastSuccessfulPhase: lastDone?.name ?? null,
				};
				await updatePersistedState(artifactDir, currentState, (latest) =>
					patchState(latest, {
						status: "FAILED" as const,
						failureContext,
					}),
				);
			}
		} catch (persistError: unknown) {
			if (isStateConflictError(persistError)) {
				// Swallow conflict after retry exhaustion -- original error takes priority
			}
			// Swallow save errors -- original error takes priority
		}

		return JSON.stringify({ action: "error", code: parsedErr.code, message: safeMessage });
	}
}

export const ocOrchestrate = tool({
	description:
		"Drive the orchestrator pipeline. Provide an idea to start a new run, or a result to advance the current phase. Returns JSON with action (dispatch/dispatch_multi/complete/error/abandoned).",
	args: {
		idea: tool.schema
			.string()
			.max(4096)
			.optional()
			.describe("Idea to start a new orchestration run"),
		result: tool.schema
			.string()
			.max(1_048_576)
			.optional()
			.describe("Result from previous agent to advance the pipeline"),
		intent: IntentTypeSchema.optional().describe(
			"Intent classification from oc_route. Required for new pipeline starts — must be 'implementation'. Non-implementation intents are rejected with routing guidance. Optional when resuming an existing pipeline with a result.",
		),
		abandon: tool.schema
			.boolean()
			.optional()
			.describe(
				"Set to true to abandon the current pipeline run. Clears pending dispatches and sets status to INTERRUPTED. Use when a dispatch result is unavailable (crashed agent, closed TUI, dead subagent).",
			),
		routeToken: tool.schema
			.string()
			.optional()
			.describe(
				"Route token from oc_route. Required for new pipeline starts. Validates that oc_route was called before starting the pipeline.",
			),
	},
	async execute(args, context) {
		const projectRoot = context.worktree ?? context.directory ?? process.cwd();
		return orchestrateCore(args, getProjectArtifactDir(projectRoot), {
			sessionId: context.sessionID,
			messageId: context.messageID ?? "",
			projectRoot,
		});
	},
});
