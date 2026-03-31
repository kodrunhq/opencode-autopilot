import { stringify } from "yaml";

export interface SkillTemplateInput {
	readonly name: string;
	readonly description: string;
	readonly license?: string;
	readonly compatibility?: string;
}

export function generateSkillMarkdown(input: SkillTemplateInput): string {
	const frontmatter: Record<string, unknown> = {
		name: input.name,
		description: input.description,
		...(input.license !== undefined && { license: input.license }),
		...(input.compatibility !== undefined && { compatibility: input.compatibility }),
	};

	return `---
${stringify(frontmatter).trim()}
---

## What I do

Describe what this skill provides to the AI agent. Be specific about the domain knowledge, patterns, or capabilities it adds.

## Rules

1. Add rules the AI should follow when this skill is active
2. Define constraints and boundaries
3. Specify when this skill should and should not be applied

## Examples

### Example 1

Provide concrete examples of how this skill should be used in practice.

### Example 2

Add more examples to cover different scenarios and edge cases.
`;
}
