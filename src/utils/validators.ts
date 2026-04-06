export const ASSET_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const MAX_NAME_LENGTH = 64;

export const BUILT_IN_COMMANDS: ReadonlySet<string> = new Set([
	"init",
	"undo",
	"redo",
	"share",
	"help",
	"config",
	"compact",
	"clear",
	"cost",
	"login",
	"logout",
	"bug",
]);

interface ValidationResult {
	readonly valid: boolean;
	readonly error?: string;
}

export function validateAssetName(name: string): ValidationResult {
	if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
		return Object.freeze({
			valid: false,
			error: `Name must be 1-${MAX_NAME_LENGTH} characters. Got ${name.length}.`,
		});
	}

	if (!ASSET_NAME_REGEX.test(name)) {
		return Object.freeze({
			valid: false,
			error: `Name '${name}' is invalid. Names must be 1-${MAX_NAME_LENGTH} lowercase alphanumeric characters with hyphens (e.g., 'my-agent').`,
		});
	}

	return Object.freeze({ valid: true });
}

export function validateCommandName(name: string): ValidationResult {
	const assetResult = validateAssetName(name);
	if (!assetResult.valid) {
		return assetResult;
	}

	if (BUILT_IN_COMMANDS.has(name)) {
		return Object.freeze({
			valid: false,
			error: `Command name '${name}' conflicts with a built-in OpenCode command. Choose a different name.`,
		});
	}

	return Object.freeze({ valid: true });
}

interface PromptValidationResult {
	readonly valid: boolean;
	readonly warnings: readonly string[];
}

export function validateAgentPrompt(prompt: string): PromptValidationResult {
	const warnings: string[] = [];

	if (prompt.length < 50) {
		warnings.push("Prompt is very short. Consider adding detailed instructions.");
	}

	if (!prompt.match(/^You are /i)) {
		warnings.push(
			"Prompt should start with an identity sentence (e.g., 'You are a code reviewer.').",
		);
	}

	const hasSteps = /^## (?:Steps|Instructions)/m.test(prompt);
	const hasConstraints = /^## Constraints/m.test(prompt);
	const hasErrorRecovery = /^## Error Recovery/m.test(prompt);

	if (!hasSteps) {
		warnings.push(
			"Missing '## Steps' or '## Instructions' section. Agents work best with numbered steps.",
		);
	}

	if (!hasConstraints) {
		warnings.push("Missing '## Constraints' section. Add DO/DO NOT rules to bound agent behavior.");
	}

	if (!hasErrorRecovery) {
		warnings.push(
			"Missing '## Error Recovery' section. Define how the agent should handle failures.",
		);
	}

	if (!prompt.includes("NEVER halt silently")) {
		warnings.push("Consider adding 'NEVER halt silently' to Error Recovery section.");
	}

	const placeholderPattern =
		/\[(?:Describe |First step|Core analysis|Validation |Final delivery|primary expected|second expected|primary restriction|second restriction|common failure|second failure|recovery action|Define your)/;
	if (placeholderPattern.test(prompt)) {
		warnings.push(
			"Prompt contains unmodified template placeholders (text in [brackets]). Replace all placeholder text with real instructions.",
		);
	}

	const htmlCommentPattern = /<!--\s*TODO:/;
	if (htmlCommentPattern.test(prompt)) {
		warnings.push(
			"Prompt contains TODO comments from the template. Remove HTML comments and replace with real content.",
		);
	}

	const valid =
		prompt.length >= 50 &&
		/^## /m.test(prompt) &&
		!placeholderPattern.test(prompt) &&
		!htmlCommentPattern.test(prompt);

	return Object.freeze({ valid, warnings: Object.freeze(warnings) });
}
