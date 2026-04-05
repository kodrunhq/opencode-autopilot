import { describe, expect, test } from "bun:test";
import { filterByScope, isActionAllowed } from "../../src/mcp/scope-filter";

describe("isActionAllowed", () => {
	test("allows read when read is present", () => {
		expect(isActionAllowed("read", ["read"])).toBe(true);
	});

	test("allows write when write is present", () => {
		expect(isActionAllowed("write", ["write"])).toBe(true);
	});

	test("allows execute when execute is present", () => {
		expect(isActionAllowed("execute", ["execute"])).toBe(true);
	});

	test("rejects read when scope list is empty", () => {
		expect(isActionAllowed("read", [])).toBe(false);
	});

	test("rejects write when only read is present", () => {
		expect(isActionAllowed("write", ["read"])).toBe(false);
	});

	test("rejects execute when only read and write are present", () => {
		expect(isActionAllowed("execute", ["read", "write"])).toBe(false);
	});
});

describe("filterByScope", () => {
	test("returns allowed for permitted action", () => {
		const result = filterByScope("read_resource", "read", "filesystem", "docs", ["read"]);
		expect(result.allowed).toBe(true);
		expect(result.violation).toBeNull();
	});

	test("returns violation for denied action", () => {
		const result = filterByScope("write_resource", "write", "filesystem", "docs", ["read"]);
		expect(result.allowed).toBe(false);
		expect(result.violation).not.toBeNull();
		expect(result.violation?.requestedAction).toBe("write");
	});

	test("preserves server and skill names in violation", () => {
		const result = filterByScope("run_shell", "execute", "shell", "ops", ["read"]);
		expect(result.violation?.serverName).toBe("shell");
		expect(result.violation?.skillName).toBe("ops");
	});

	test("includes requested tool name in violation", () => {
		const result = filterByScope("delete_file", "write", "filesystem", "docs", ["read"]);
		expect(result.violation?.toolName).toBe("delete_file");
	});

	test("keeps allowed scopes in violation", () => {
		const result = filterByScope("run_shell", "execute", "shell", "ops", ["read", "write"]);
		expect(result.violation?.allowedScopes).toEqual(["read", "write"]);
	});

	test("returns frozen result for violation", () => {
		const result = filterByScope("delete_file", "write", "filesystem", "docs", ["read"]);
		expect(Object.isFrozen(result)).toBe(true);
		expect(Object.isFrozen(result.violation as object)).toBe(true);
	});
});
