import type { AgentConfig } from "@opencode-ai/sdk";
import { AGENT_NAMES } from "../../orchestrator/handlers/types";
import { ocArchitectAgent } from "./oc-architect";
import { ocChallengerAgent } from "./oc-challenger";
import { ocCriticAgent } from "./oc-critic";
import { ocExplorerAgent } from "./oc-explorer";
import { ocImplementerAgent } from "./oc-implementer";
import { ocPlannerAgent } from "./oc-planner";
import { ocResearcherAgent } from "./oc-researcher";
import { ocRetrospectorAgent } from "./oc-retrospector";
import { ocReviewerAgent } from "./oc-reviewer";
import { ocShipperAgent } from "./oc-shipper";

export const pipelineAgents: Readonly<Record<string, Readonly<AgentConfig>>> = Object.freeze({
	[AGENT_NAMES.RECON]: ocResearcherAgent,
	[AGENT_NAMES.CHALLENGE]: ocChallengerAgent,
	[AGENT_NAMES.ARCHITECT]: ocArchitectAgent,
	[AGENT_NAMES.CRITIC]: ocCriticAgent,
	[AGENT_NAMES.EXPLORE]: ocExplorerAgent,
	[AGENT_NAMES.PLAN]: ocPlannerAgent,
	[AGENT_NAMES.BUILD]: ocImplementerAgent,
	[AGENT_NAMES.REVIEW]: ocReviewerAgent,
	[AGENT_NAMES.SHIP]: ocShipperAgent,
	[AGENT_NAMES.RETROSPECTIVE]: ocRetrospectorAgent,
} as const);
