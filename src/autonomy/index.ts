import { getLogger } from "../logging/domains";
import { LoopController, type LoopControllerConfig } from "./controller";

const DEFAULT_LOOP_SESSION_ID = "__default__";
const loopControllers = new Map<string, LoopController>();

function getSessionKey(sessionId?: string | null): string {
	if (typeof sessionId !== "string") {
		return DEFAULT_LOOP_SESSION_ID;
	}

	const trimmed = sessionId.trim();
	return trimmed.length > 0 ? trimmed : DEFAULT_LOOP_SESSION_ID;
}

export function getLoopController(config?: LoopControllerConfig): LoopController;
export function getLoopController(sessionId: string, config?: LoopControllerConfig): LoopController;
export function getLoopController(
	sessionIdOrConfig: string | LoopControllerConfig = {},
	config: LoopControllerConfig = {},
): LoopController {
	const sessionId = typeof sessionIdOrConfig === "string" ? sessionIdOrConfig : null;
	const controllerConfig = typeof sessionIdOrConfig === "string" ? config : sessionIdOrConfig;
	const key = getSessionKey(sessionId ?? controllerConfig.sessionId ?? null);
	const existing = loopControllers.get(key);
	if (existing) {
		return existing;
	}

	const controller = new LoopController({
		...controllerConfig,
		sessionId: sessionId ?? controllerConfig.sessionId ?? null,
		logger: controllerConfig.logger ?? getLogger("autonomy", "controller"),
	});
	loopControllers.set(key, controller);
	return controller;
}

export function deleteLoopController(sessionId?: string | null): void {
	if (sessionId === undefined || sessionId === null) {
		loopControllers.clear();
		return;
	}

	loopControllers.delete(getSessionKey(sessionId));
}

export function setLoopControllerForTests(
	controller: LoopController | null,
	sessionId?: string | null,
): void {
	const key = getSessionKey(sessionId ?? controller?.getSessionId() ?? null);
	if (!controller) {
		if (sessionId === undefined) {
			loopControllers.clear();
			return;
		}

		loopControllers.delete(key);
		return;
	}

	loopControllers.set(key, controller);
}

export * from "./completion";
export * from "./config";
export * from "./controller";
export * from "./injector";
export * from "./oracle-bridge";
export * from "./state";
export * from "./types";
export * from "./verification";
