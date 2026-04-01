import { describe, expect, test } from "bun:test";
import plugin from "../src/index";

describe("plugin entry point", () => {
	const mockInput = {
		client: {} as ReturnType<typeof import("@opencode-ai/sdk").createOpencodeClient>,
		project: {} as import("@opencode-ai/sdk").Project,
		directory: "/tmp",
		worktree: "/tmp",
		serverUrl: new URL("http://localhost:3000"),
		// biome-ignore lint/suspicious/noExplicitAny: BunShell mock requires any
		$: {} as any,
	};

	test("default export is a function", () => {
		expect(typeof plugin).toBe("function");
	});

	test("returns hooks object with tool property", async () => {
		const result = await plugin(mockInput);
		expect(result.tool).toBeDefined();
	});

	test("tool property contains oc_placeholder", async () => {
		const result = await plugin(mockInput);
		expect(result.tool?.oc_placeholder).toBeDefined();
		expect(typeof result.tool?.oc_placeholder.execute).toBe("function");
	});

	test("returns event handler function", async () => {
		const result = await plugin(mockInput);
		expect(result.event).toBeDefined();
		expect(typeof result.event).toBe("function");
	});

	test("event handler handles session.created gracefully", async () => {
		const result = await plugin(mockInput);
		// biome-ignore lint/suspicious/noExplicitAny: SDK event mock requires any
		await result.event?.({ event: { type: "session.created", properties: {} } } as any);
	});

	test("registers all expected tools", async () => {
		const result = await plugin(mockInput);
		const toolNames = Object.keys(result.tool ?? {});
		const expected = [
			"oc_placeholder",
			"oc_create_agent",
			"oc_create_skill",
			"oc_create_command",
			"oc_state",
			"oc_confidence",
			"oc_phase",
			"oc_plan",
			"oc_orchestrate",
			"oc_forensics",
			"oc_review",
		];
		expect(toolNames.sort()).toEqual(expected.sort());
	});
});
