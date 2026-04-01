import type { Plugin } from "@opencode-ai/plugin";
import { configHook } from "./agents";
import { isFirstLoad, loadConfig } from "./config";
import { installAssets } from "./installer";
import { ocConfidence } from "./tools/confidence";
import { ocCreateAgent } from "./tools/create-agent";
import { ocCreateCommand } from "./tools/create-command";
import { ocCreateSkill } from "./tools/create-skill";
import { ocForensics } from "./tools/forensics";
import { ocOrchestrate } from "./tools/orchestrate";
import { ocPhase } from "./tools/phase";
import { ocPlaceholder } from "./tools/placeholder";
import { ocPlan } from "./tools/plan";
import { ocReview } from "./tools/review";
import { ocState } from "./tools/state";

const plugin: Plugin = async (_input) => {
	// Self-healing asset installation on every load
	const installResult = await installAssets();
	if (installResult.errors.length > 0) {
		console.error("[opencode-assets] Asset installation errors:", installResult.errors);
	}

	// Load config for first-load detection
	const config = await loadConfig();

	return {
		tool: {
			oc_placeholder: ocPlaceholder,
			oc_create_agent: ocCreateAgent,
			oc_create_skill: ocCreateSkill,
			oc_create_command: ocCreateCommand,
			oc_state: ocState,
			oc_confidence: ocConfidence,
			oc_phase: ocPhase,
			oc_plan: ocPlan,
			oc_orchestrate: ocOrchestrate,
			oc_forensics: ocForensics,
			oc_review: ocReview,
		},
		event: async ({ event }) => {
			if (event.type === "session.created" && isFirstLoad(config)) {
				// First load: config wizard will be triggered via /configure command
				// Phase 2 will add the oc_configure tool
			}
		},
		config: configHook,
	};
};

export default plugin;
