import type { Phase } from "../types";
import { handleArchitect } from "./architect";
import { handleBuild } from "./build";
import { handleChallenge } from "./challenge";
import { handleExplore } from "./explore";
import { handlePlan } from "./plan";
import { handleRecon } from "./recon";
import { handleRetrospective } from "./retrospective";
import { handleShip } from "./ship";
import type { PhaseHandler } from "./types";

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
