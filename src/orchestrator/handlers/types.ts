import type { PipelineState } from "../types";

export const AGENT_NAMES = Object.freeze({
	RECON: "oc-researcher",
	CHALLENGE: "oc-challenger",
	ARCHITECT: "oc-architect",
	CRITIC: "oc-critic",
	EXPLORE: "oc-explorer",
	PLAN: "oc-planner",
	BUILD: "oc-implementer",
	SHIP: "oc-shipper",
	RETROSPECTIVE: "oc-retrospector",
} as const);

export interface DispatchResult {
	readonly action: "dispatch" | "dispatch_multi" | "complete" | "error";
	readonly agent?: string;
	readonly agents?: readonly { readonly agent: string; readonly prompt: string }[];
	readonly prompt?: string;
	readonly phase?: string;
	readonly progress?: string;
	readonly message?: string;
}

export type PhaseHandler = (
	state: Readonly<PipelineState>,
	artifactDir: string,
	result?: string,
) => Promise<DispatchResult>;
