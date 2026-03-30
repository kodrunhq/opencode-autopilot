import { describe, expect, test } from "bun:test";
import { ocPlaceholder } from "../../src/tools/placeholder";

describe("ocPlaceholder tool", () => {
	test("has a description", () => {
		expect(ocPlaceholder.description).toBe(
			"Verifies that the OpenCode Assets plugin is loaded and working",
		);
	});

	test("has args with message schema", () => {
		expect(ocPlaceholder.args).toBeDefined();
		expect(ocPlaceholder.args.message).toBeDefined();
	});

	test("has an execute function", () => {
		expect(typeof ocPlaceholder.execute).toBe("function");
	});

	test("execute returns string containing the input message", async () => {
		const mockContext = {
			sessionID: "test",
			messageID: "test",
			agent: "test",
			directory: "/tmp",
			worktree: "/tmp",
			abort: new AbortController().signal,
			metadata: () => {},
			ask: async () => {},
		};
		const result = await ocPlaceholder.execute({ message: "hello" }, mockContext);
		expect(result).toContain("hello");
	});

	test("execute returns string containing OpenCode Assets", async () => {
		const mockContext = {
			sessionID: "test",
			messageID: "test",
			agent: "test",
			directory: "/tmp",
			worktree: "/tmp",
			abort: new AbortController().signal,
			metadata: () => {},
			ask: async () => {},
		};
		const result = await ocPlaceholder.execute({ message: "test" }, mockContext);
		expect(result).toContain("OpenCode Assets");
	});
});
