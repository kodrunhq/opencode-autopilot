import type { ResultEnvelope } from "../contracts/result-envelope";
import type { DispatchResultKind, PipelineState } from "../types";

export const AGENT_NAMES = Object.freeze({
	RECON: "oc-researcher",
	CHALLENGE: "oc-challenger",
	ARCHITECT: "oc-architect",
	CRITIC: "oc-critic",
	EXPLORE: "oc-explorer",
	PLAN: "oc-planner",
	BUILD: "oc-implementer",
	REVIEW: "oc-reviewer",
	SHIP: "oc-shipper",
	RETROSPECTIVE: "oc-retrospector",
} as const);

export interface DispatchResult {
	readonly action: "dispatch" | "dispatch_multi" | "complete" | "error";
	readonly code?: string;
	readonly agent?: string;
	readonly agents?: readonly {
		readonly agent: string;
		readonly prompt: string;
		readonly dispatchId?: string;
		readonly taskId?: number | null;
		readonly resultKind?: DispatchResultKind;
	}[];
	readonly prompt?: string;
	readonly phase?: string;
	readonly progress?: string;
	readonly message?: string;
	readonly resultKind?: DispatchResultKind;
	readonly taskId?: number | null;
	readonly dispatchId?: string;
	readonly runId?: string;
	readonly expectedResultKind?: DispatchResultKind;
	readonly _stateUpdates?: Partial<PipelineState>;
	readonly _userProgress?: string;
}

export interface PhaseHandlerContext {
	readonly envelope: ResultEnvelope;
	readonly legacy: boolean;
}

export type PhaseHandler = (
	state: Readonly<PipelineState>,
	artifactDir: string,
	result?: string,
	context?: PhaseHandlerContext,
) => Promise<DispatchResult>;
