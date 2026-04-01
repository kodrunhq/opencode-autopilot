import type {
	CommitResult,
	FallbackPlan,
	FallbackPlanFailure,
	FallbackPlanResult,
	FallbackState,
} from "./types";

/**
 * Creates a new FallbackState for a model. Initial state: on primary model, no failures.
 */
export function createFallbackState(model: string): FallbackState {
	return {
		originalModel: model,
		currentModel: model,
		fallbackIndex: -1,
		failedModels: new Map(),
		attemptCount: 0,
		pendingFallbackModel: undefined,
	};
}

/**
 * Plans the next fallback action. Pure function: reads state + config, returns plan or failure.
 * Does NOT mutate state.
 *
 * Finds the next model in the fallback chain that is not in cooldown.
 * Returns failure if max attempts reached or all models exhausted.
 */
export function planFallback(
	state: Readonly<FallbackState>,
	fallbackChain: readonly string[],
	maxAttempts: number,
	cooldownMs: number,
): FallbackPlanResult | FallbackPlanFailure {
	if (state.attemptCount >= maxAttempts) {
		return {
			success: false as const,
			reason: `Max fallback attempts reached (${maxAttempts})`,
		};
	}

	const now = Date.now();

	// Iterate chain starting from fallbackIndex + 1, wrapping around
	for (let i = 0; i < fallbackChain.length; i++) {
		const index = (state.fallbackIndex + 1 + i) % fallbackChain.length;
		const model = fallbackChain[index];

		// Skip models still in cooldown
		const failedAt = state.failedModels.get(model);
		if (failedAt !== undefined && now - failedAt < cooldownMs) {
			continue;
		}

		return {
			success: true as const,
			plan: {
				failedModel: state.currentModel,
				newModel: model,
				newFallbackIndex: index,
				reason: `Fallback from ${state.currentModel} to ${model}`,
			},
		};
	}

	return {
		success: false as const,
		reason: "All fallback models exhausted or in cooldown",
	};
}

/**
 * Commits a fallback plan to produce a new state. Pure function: returns new state, NEVER mutates input.
 *
 * Returns committed:false if the plan is stale (currentModel changed since plan was created).
 */
export function commitFallback(state: Readonly<FallbackState>, plan: FallbackPlan): CommitResult {
	if (state.currentModel !== plan.failedModel) {
		return { committed: false, state: { ...state, failedModels: new Map(state.failedModels) } };
	}

	return {
		committed: true,
		state: {
			...state,
			fallbackIndex: plan.newFallbackIndex,
			failedModels: new Map([...state.failedModels, [plan.failedModel, Date.now()]]),
			attemptCount: state.attemptCount + 1,
			currentModel: plan.newModel,
			pendingFallbackModel: undefined,
		},
	};
}

/**
 * Attempts to recover to the original model after cooldown expires.
 * Pure function: returns new state if recovery is possible, null otherwise.
 *
 * Returns null if already on original model or if original is still in cooldown.
 */
export function recoverToOriginal(
	state: Readonly<FallbackState>,
	cooldownMs: number,
): FallbackState | null {
	if (state.currentModel === state.originalModel) return null;

	const failedAt = state.failedModels.get(state.originalModel);
	if (failedAt !== undefined && Date.now() - failedAt < cooldownMs) {
		return null;
	}

	return {
		...state,
		currentModel: state.originalModel,
		fallbackIndex: -1,
		failedModels: new Map(state.failedModels),
	};
}
