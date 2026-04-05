import { getLogger } from "../logging/domains";
import { LoopController } from "./controller";

let globalLoopController: LoopController | null = null;

export function getLoopController(): LoopController {
	if (!globalLoopController) {
		globalLoopController = new LoopController({
			logger: getLogger("autonomy", "controller"),
		});
	}

	return globalLoopController;
}

export function setLoopControllerForTests(controller: LoopController | null): void {
	globalLoopController = controller;
}

export * from "./completion";
export * from "./controller";
export * from "./injector";
export * from "./state";
export * from "./types";
export * from "./verification";
