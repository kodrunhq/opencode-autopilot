import type { Plugin } from "@opencode-ai/plugin";
import { ocPlaceholder } from "./tools/placeholder";

const plugin: Plugin = async (_input) => {
	return {
		tool: {
			oc_placeholder: ocPlaceholder,
		},
	};
};

export default plugin;
