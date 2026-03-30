import type { Plugin } from "@opencode-ai/plugin";
import { installAssets } from "./installer";
import { isFirstLoad, loadConfig } from "./config";
import { ocPlaceholder } from "./tools/placeholder";

const plugin: Plugin = async (_input) => {
	// Self-healing asset installation on every load
	await installAssets();

	// Load config for first-load detection
	const config = await loadConfig();

	return {
		tool: {
			oc_placeholder: ocPlaceholder,
		},
		event: async ({ event }) => {
			if (event.type === "session.created" && isFirstLoad(config)) {
				// First load: config wizard will be triggered via /configure command
				// Phase 2 will add the oc_configure tool
			}
		},
	};
};

export default plugin;
