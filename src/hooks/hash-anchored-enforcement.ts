import { getLogger } from "../logging/domains";

const logger = getLogger("hooks", "hash-anchored-enforcement");

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

		// Validate args shape before accessing properties
		const args = hookInput.args;
		if (!args || typeof args !== "object") {
			throw new Error(
				"Hash-anchored edit enforcement: Cannot enforce - args is not an object. " +
					"Use oc_hashline_edit for concurrent-safe file modifications.",
			);
		}

		const editArgs = args as Record<string, unknown>;

		// Check required fields exist and are strings
		const filePath = typeof editArgs.filePath === "string" ? editArgs.filePath : null;
		const oldString = typeof editArgs.oldString === "string" ? editArgs.oldString : null;
		const newString = typeof editArgs.newString === "string" ? editArgs.newString : null;
		const replaceAll = typeof editArgs.replaceAll === "boolean" ? editArgs.replaceAll : false;

		if (!filePath || !oldString || !newString) {
			throw new Error(
				"Hash-anchored edit enforcement: Cannot enforce - missing required fields (filePath, oldString, newString). " +
					"Use oc_hashline_edit for concurrent-safe file modifications.",
			);
		}

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
				`3. Use oc_hashline_edit with edits: [{op: "replace", pos: "LINE#HASH", lines: "new content"}]\n\n` +
				`Example:\n` +
				`oc_hashline_edit({\n` +
				`  file: "${filePath}",\n` +
				`  edits: [\n` +
				`    {op: "replace", pos: "42#VK", lines: "your new content"}\n` +
				`  ]\n` +
				`})\n\n` +
				`For bulk replacements, use multiple edit entries. ` +
				`The hash ensures you're editing the exact line content you expect.\n\n` +
				`Note: oc_hashline_edit requires 'file' parameter (not 'filePath') and 'pos: "LINE#HASH"' format.`,
		);
	};
}
