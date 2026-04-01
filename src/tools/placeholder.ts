import { tool } from "@opencode-ai/plugin";

/**
 * @deprecated Stub retained only to avoid breaking src/index.ts imports.
 * Will be removed in Task 10 when index.ts is rewired to use oc_configure.
 */
export const ocPlaceholder = tool({
	description: "[DEPRECATED] Placeholder tool — will be replaced by oc_configure",
	args: {
		message: tool.schema.string().max(1000).describe("Unused"),
	},
	async execute() {
		return "This tool is deprecated. Use /configure to set up model assignments.";
	},
});
