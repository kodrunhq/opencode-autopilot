import { describe, expect, test } from "bun:test";
import plugin from "../src/index";

describe("plugin entry point", () => {
	test("default export is a function", () => {
		expect(typeof plugin).toBe("function");
	});

	test("returns hooks object with tool property", async () => {
		const mockInput = {
			client: {} as ReturnType<typeof import("@opencode-ai/sdk").createOpencodeClient>,
			project: {} as import("@opencode-ai/sdk").Project,
			directory: "/tmp",
			worktree: "/tmp",
			serverUrl: new URL("http://localhost:3000"),
			$: {} as any,
		};
		const result = await plugin(mockInput);
		expect(result.tool).toBeDefined();
	});

	test("tool property contains oc_placeholder", async () => {
		const mockInput = {
			client: {} as ReturnType<typeof import("@opencode-ai/sdk").createOpencodeClient>,
			project: {} as import("@opencode-ai/sdk").Project,
			directory: "/tmp",
			worktree: "/tmp",
			serverUrl: new URL("http://localhost:3000"),
			$: {} as any,
		};
		const result = await plugin(mockInput);
		expect(result.tool!.oc_placeholder).toBeDefined();
		expect(typeof result.tool!.oc_placeholder.execute).toBe("function");
	});
});
