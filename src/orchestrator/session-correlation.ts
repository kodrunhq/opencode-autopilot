import type { PendingDispatch } from "./types";

export function getCallerSessionId(dispatch: Readonly<PendingDispatch>): string | null {
	return dispatch.callerSessionId ?? dispatch.sessionId ?? null;
}

export function getValidSpawnedSessionId(
	dispatch: Readonly<PendingDispatch>,
	currentParentSessionId?: string | null,
): string | null {
	const candidate = dispatch.spawnedSessionId ?? null;
	if (candidate === null) {
		return null;
	}

	const callerSessionId = getCallerSessionId(dispatch);
	if (callerSessionId !== null && candidate === callerSessionId) {
		return null;
	}

	if (currentParentSessionId !== undefined && currentParentSessionId !== null) {
		if (candidate === currentParentSessionId) {
			return null;
		}
	}

	return candidate;
}

export function collectPendingDispatchCallerSessionIds(
	dispatches: readonly PendingDispatch[],
): readonly string[] {
	const sessionIds = new Set<string>();

	for (const dispatch of dispatches) {
		const callerSessionId = getCallerSessionId(dispatch);
		if (callerSessionId !== null) {
			sessionIds.add(callerSessionId);
		}
	}

	return Object.freeze([...sessionIds]);
}

export function collectPendingDispatchSessionIds(
	dispatches: readonly PendingDispatch[],
	options?: { readonly currentParentSessionId?: string | null },
): readonly string[] {
	const sessionIds = new Set<string>();

	for (const dispatch of dispatches) {
		const callerSessionId = getCallerSessionId(dispatch);
		if (callerSessionId !== null) {
			sessionIds.add(callerSessionId);
		}

		const spawnedSessionId = getValidSpawnedSessionId(dispatch, options?.currentParentSessionId);
		if (spawnedSessionId !== null) {
			sessionIds.add(spawnedSessionId);
		}
	}

	return Object.freeze([...sessionIds]);
}
