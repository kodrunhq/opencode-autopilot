import type { Phase } from "../types";
import type { PhaseHandler } from "./types";
import { handleRecon } from "./recon";
import { handleChallenge } from "./challenge";
import { handleArchitect } from "./architect";
import { handleExplore } from "./explore";
import { handlePlan } from "./plan";
import { handleBuild } from "./build";
import { handleShip } from "./ship";
import { handleRetrospective } from "./retrospective";

export const PHASE_HANDLERS: Readonly<Record<Phase, PhaseHandler>> = Object.freeze({
	RECON: handleRecon,
	CHALLENGE: handleChallenge,
	ARCHITECT: handleArchitect,
	EXPLORE: handleExplore,
	PLAN: handlePlan,
	BUILD: handleBuild,
	SHIP: handleShip,
	RETROSPECTIVE: handleRetrospective,
});
