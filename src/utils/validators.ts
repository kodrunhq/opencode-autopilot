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
			error: `Name must be 1-64 characters. Got ${name.length}.`,
		});
	}

	if (!ASSET_NAME_REGEX.test(name)) {
		return Object.freeze({
			valid: false,
			error: `Name '${name}' is invalid. Names must be 1-64 lowercase alphanumeric characters with hyphens (e.g., 'my-agent').`,
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
