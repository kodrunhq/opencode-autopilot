import { stringify } from "yaml";

export interface CommandTemplateInput {
	readonly name: string;
	readonly description: string;
	readonly agent?: string;
	readonly model?: string;
}

export function generateCommandMarkdown(input: CommandTemplateInput): string {
	const frontmatter: Record<string, unknown> = {
		description: input.description,
		...(input.agent !== undefined && { agent: input.agent }),
		...(input.model !== undefined && { model: input.model }),
	};

	return `---
${stringify(frontmatter).trim()}
---
The user wants to run the "${input.name}" command.

$ARGUMENTS

<!-- TODO: Replace this placeholder with specific instructions for what the command should do. -->
<!-- Use $ARGUMENTS to reference user-provided arguments. -->
<!-- Use $1, $2, $3 for individual positional arguments. -->
<!-- Use @filename to include file content. -->
`;
}
