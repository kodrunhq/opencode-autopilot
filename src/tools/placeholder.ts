import { tool } from "@opencode-ai/plugin";

export const ocPlaceholder = tool({
	description: "Verifies that the OpenCode Assets plugin is loaded and working",
	args: {
		message: tool.schema.string().describe("A test message to echo back"),
	},
	async execute(args) {
		return `OpenCode Assets plugin is active. Your message: ${args.message}`;
	},
});
