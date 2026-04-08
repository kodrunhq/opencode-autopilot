import { getLogger } from "../logging/domains";

const logger = getLogger("hooks", "hash-anchored-enforcement");

interface EditToolArgs {
	readonly filePath: string;
	readonly oldString: string;
	readonly newString: string;
	readonly replaceAll?: boolean;
}

export function createHashAnchoredEnforcementHandler() {
	return (
		hookInput: {
			readonly tool: string;
			readonly sessionID: string;
			readonly callID: string;
			readonly args: unknown;
		},
		output: { readonly args: unknown },
	): { readonly args: unknown } => {
		if (hookInput.tool !== "edit") {
			return output;
		}

		const editArgs = hookInput.args as EditToolArgs;
		const filePath = editArgs.filePath;
		const oldString = editArgs.oldString;
		const newString = editArgs.newString;
		const replaceAll = editArgs.replaceAll ?? false;

		logger.warn("Blocked built-in edit tool, enforcing hash-anchored edits", {
			sessionID: hookInput.sessionID,
			filePath,
			oldStringLength: oldString.length,
			newStringLength: newString.length,
			replaceAll,
		});

		throw new Error(
			`Hash-anchored edit enforcement: The built-in 'edit' tool is blocked. ` +
				`Use oc_hashline_edit instead for concurrent-safe file modifications.\n\n` +
				`To convert your edit:\n` +
				`1. Read the file to get current line hashes\n` +
				`2. Identify the line number(s) you want to edit\n` +
				`3. Use oc_hashline_edit with edits: [{line: N, hash: "XY", newContent: "..."}]\n\n` +
				`Example:\n` +
				`oc_hashline_edit({\n` +
				`  filePath: "${filePath}",\n` +
				`  edits: [\n` +
				`    {line: 42, hash: "VK", newContent: "your new content"}\n` +
				`  ]\n` +
				`})\n\n` +
				`For bulk replacements, use multiple edit entries. ` +
				`The hash ensures you're editing the exact line content you expect.`,
		);
	};
}
