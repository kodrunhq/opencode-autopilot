import type { Config } from "@opencode-ai/plugin";
import { documenterAgent } from "./documenter";
import { metaprompterAgent } from "./metaprompter";
import { prReviewerAgent } from "./pr-reviewer";
import { researcherAgent } from "./researcher";

const agents = {
	researcher: researcherAgent,
	metaprompter: metaprompterAgent,
	documenter: documenterAgent,
	"pr-reviewer": prReviewerAgent,
} as const;

export async function configHook(config: Config): Promise<void> {
	if (!config.agent) {
		config.agent = {};
	}
	for (const [name, agentConfig] of Object.entries(agents)) {
		// Only set if not already defined — preserve user customizations (Pitfall 2)
		if (config.agent[name] === undefined) {
			config.agent[name] = agentConfig;
		}
	}
}

export { documenterAgent } from "./documenter";
export { metaprompterAgent } from "./metaprompter";
export { prReviewerAgent } from "./pr-reviewer";
export { researcherAgent } from "./researcher";
