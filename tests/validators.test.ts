import { describe, expect, it } from "bun:test";
import {
	ASSET_NAME_REGEX,
	BUILT_IN_COMMANDS,
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
