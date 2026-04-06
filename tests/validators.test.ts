import { describe, expect, it } from "bun:test";
import {
	ASSET_NAME_REGEX,
	BUILT_IN_COMMANDS,
	validateAgentPrompt,
	validateAssetName,
	validateCommandName,
} from "../src/utils/validators";

describe("ASSET_NAME_REGEX", () => {
	it("matches valid lowercase names", () => {
		expect(ASSET_NAME_REGEX.test("my-agent")).toBe(true);
		expect(ASSET_NAME_REGEX.test("a")).toBe(true);
		expect(ASSET_NAME_REGEX.test("code-reviewer")).toBe(true);
		expect(ASSET_NAME_REGEX.test("my-long-skill-name")).toBe(true);
		expect(ASSET_NAME_REGEX.test("a1b2")).toBe(true);
	});

	it("rejects invalid names", () => {
		expect(ASSET_NAME_REGEX.test("My-Agent")).toBe(false);
		expect(ASSET_NAME_REGEX.test("-bad")).toBe(false);
		expect(ASSET_NAME_REGEX.test("bad-")).toBe(false);
		expect(ASSET_NAME_REGEX.test("bad--name")).toBe(false);
		expect(ASSET_NAME_REGEX.test("has space")).toBe(false);
		expect(ASSET_NAME_REGEX.test("")).toBe(false);
	});
});

describe("BUILT_IN_COMMANDS", () => {
	it("contains all 12 known built-in commands", () => {
		const expected = [
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
		];
		for (const cmd of expected) {
			expect(BUILT_IN_COMMANDS.has(cmd)).toBe(true);
		}
		expect(BUILT_IN_COMMANDS.size).toBe(12);
	});
});

describe("validateAssetName", () => {
	it("accepts valid names", () => {
		expect(validateAssetName("my-agent")).toEqual({ valid: true });
		expect(validateAssetName("a")).toEqual({ valid: true });
		expect(validateAssetName("code-reviewer")).toEqual({ valid: true });
		expect(validateAssetName("test123")).toEqual({ valid: true });
	});

	it("rejects empty name", () => {
		const result = validateAssetName("");
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
		expect(result.error).toContain("1-64");
	});

	it("rejects name exceeding 64 characters", () => {
		const result = validateAssetName("a".repeat(65));
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
		expect(result.error).toContain("1-64");
	});

	it("accepts name at exactly 64 characters", () => {
		const result = validateAssetName("a".repeat(64));
		expect(result.valid).toEqual(true);
	});

	it("rejects names with uppercase letters", () => {
		const result = validateAssetName("My-Agent");
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
		expect(result.error).toContain("lowercase");
	});

	it("rejects names with spaces", () => {
		const result = validateAssetName("my agent");
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("rejects names with leading hyphen", () => {
		const result = validateAssetName("--bad");
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("rejects names with trailing hyphen", () => {
		const result = validateAssetName("bad-");
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("rejects names with consecutive hyphens", () => {
		const result = validateAssetName("bad--name");
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("returns immutable result objects", () => {
		const valid = validateAssetName("good-name");
		const invalid = validateAssetName("");
		expect(Object.isFrozen(valid)).toBe(true);
		expect(Object.isFrozen(invalid)).toBe(true);
	});
});

describe("validateCommandName", () => {
	it("accepts valid command names", () => {
		expect(validateCommandName("my-cmd")).toEqual({ valid: true });
		expect(validateCommandName("review")).toEqual({ valid: true });
	});

	it("rejects built-in command names", () => {
		const builtins = [
			"help",
			"init",
			"undo",
			"redo",
			"share",
			"config",
			"compact",
			"clear",
			"cost",
			"login",
			"logout",
			"bug",
		];
		for (const cmd of builtins) {
			const result = validateCommandName(cmd);
			expect(result.valid).toBe(false);
			expect(result.error).toContain("built-in");
		}
	});

	it("rejects filesystem-unsafe characters", () => {
		const unsafeNames = [
			"bad/name",
			"bad:name",
			"bad<name",
			"bad>name",
			'bad"name',
			"bad|name",
			"bad?name",
			"bad*name",
			"bad\\name",
		];
		for (const name of unsafeNames) {
			const result = validateCommandName(name);
			expect(result.valid).toBe(false);
			expect(result.error).toBeDefined();
		}
	});

	it("rejects invalid asset names (delegates to validateAssetName)", () => {
		const result = validateCommandName("My-Cmd");
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("returns immutable result objects", () => {
		const valid = validateCommandName("good-cmd");
		const invalid = validateCommandName("help");
		expect(Object.isFrozen(valid)).toBe(true);
		expect(Object.isFrozen(invalid)).toBe(true);
	});
});

describe("validateAgentPrompt", () => {
	const wellFormedPrompt = `You are a code reviewer.

## Steps
1. Read the diff.
2. Identify issues.
3. Report findings.

## Constraints
- DO focus on correctness.
- DO NOT modify files.

## Error Recovery
- If diff is empty, report "no changes to review."
- NEVER halt silently — always report what went wrong and what was attempted.`;

	it("accepts a well-formed prompt as valid", () => {
		const result = validateAgentPrompt(wellFormedPrompt);
		expect(result.valid).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	it("warns when prompt is too short", () => {
		const result = validateAgentPrompt("You are a bot.");
		expect(result.warnings).toContainEqual(expect.stringContaining("very short"));
	});

	it("marks short prompt without sections as invalid", () => {
		const result = validateAgentPrompt("You are a bot.");
		expect(result.valid).toBe(false);
	});

	it("warns when prompt lacks identity sentence", () => {
		const prompt = `Do the thing.

## Steps
1. Step one.

## Constraints
- DO stuff.

## Error Recovery
- NEVER halt silently — always report what went wrong and what was attempted.`;
		const result = validateAgentPrompt(prompt);
		expect(result.warnings).toContainEqual(expect.stringContaining("identity sentence"));
	});

	it("warns when ## Steps section is missing", () => {
		const prompt = `You are a helper.

## Constraints
- DO stuff.

## Error Recovery
- NEVER halt silently — always report what went wrong and what was attempted.`;
		const result = validateAgentPrompt(prompt);
		expect(result.warnings).toContainEqual(expect.stringContaining("Steps"));
	});

	it("warns when ## Constraints section is missing", () => {
		const prompt = `You are a helper.

## Steps
1. Do work.

## Error Recovery
- NEVER halt silently — always report what went wrong and what was attempted.`;
		const result = validateAgentPrompt(prompt);
		expect(result.warnings).toContainEqual(expect.stringContaining("Constraints"));
	});

	it("warns when ## Error Recovery section is missing", () => {
		const prompt = `You are a helper.

## Steps
1. Do work.

## Constraints
- DO stuff.`;
		const result = validateAgentPrompt(prompt);
		expect(result.warnings).toContainEqual(expect.stringContaining("Error Recovery"));
	});

	it("warns when NEVER halt silently is missing", () => {
		const prompt = `You are a helper.

## Steps
1. Do work.

## Constraints
- DO stuff.

## Error Recovery
- Report errors.`;
		const result = validateAgentPrompt(prompt);
		expect(result.warnings).toContainEqual(expect.stringContaining("NEVER halt silently"));
	});

	it("accepts ## Instructions as alternative to ## Steps", () => {
		const prompt = `You are a helper.

## Instructions
1. Do work.

## Constraints
- DO stuff.

## Error Recovery
- NEVER halt silently — always report what went wrong and what was attempted.`;
		const result = validateAgentPrompt(prompt);
		const stepsWarning = result.warnings.find((w) => w.includes("Steps"));
		expect(stepsWarning).toBeUndefined();
	});

	it("returns frozen result", () => {
		const result = validateAgentPrompt(wellFormedPrompt);
		expect(Object.isFrozen(result)).toBe(true);
		expect(Object.isFrozen(result.warnings)).toBe(true);
	});

	it("warns on unmodified template placeholders", () => {
		const prompt = `You are a helper.

## Instructions
1. [First step — how the agent begins processing a task.]

## Constraints
- DO [primary expected behavior].

## Error Recovery
- NEVER halt silently — always report what went wrong and what was attempted.`;
		const result = validateAgentPrompt(prompt);
		expect(result.valid).toBe(false);
		expect(result.warnings).toContainEqual(
			expect.stringContaining("unmodified template placeholders"),
		);
	});

	it("warns on TODO HTML comments from template", () => {
		const prompt = `You are a helper.

<!-- TODO: Replace the placeholder text -->

## Instructions
1. Do work.

## Constraints
- DO stuff.

## Error Recovery
- NEVER halt silently — always report what went wrong and what was attempted.`;
		const result = validateAgentPrompt(prompt);
		expect(result.warnings).toContainEqual(expect.stringContaining("TODO comments"));
	});

	it("marks prompt with placeholders as invalid even with all sections present", () => {
		const prompt = `You are a helper.

## Instructions
1. [Describe the agent's specialty.]

## Constraints
- DO stuff.

## Error Recovery
- NEVER halt silently — always report what went wrong and what was attempted.`;
		const result = validateAgentPrompt(prompt);
		expect(result.valid).toBe(false);
	});
});
