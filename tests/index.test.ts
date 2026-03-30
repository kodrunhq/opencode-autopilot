import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import plugin from "../src/index";

describe("plugin entry point", () => {
	let tempDir: string;
	const mockInput = {
		client: {} as ReturnType<
			typeof import("@opencode-ai/sdk").createOpencodeClient
		>,
		project: {} as import("@opencode-ai/sdk").Project,
		directory: "/tmp",
		worktree: "/tmp",
		serverUrl: new URL("http://localhost:3000"),
		$: {} as any,
	};

	beforeEach(async () => {
		tempDir = join(tmpdir(), `opencode-index-test-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("default export is a function", () => {
		expect(typeof plugin).toBe("function");
	});

	test("returns hooks object with tool property", async () => {
		const result = await plugin(mockInput);
		expect(result.tool).toBeDefined();
	});

	test("tool property contains oc_placeholder", async () => {
		const result = await plugin(mockInput);
		expect(result.tool!.oc_placeholder).toBeDefined();
		expect(typeof result.tool!.oc_placeholder.execute).toBe("function");
	});

	test("returns event handler function", async () => {
		const result = await plugin(mockInput);
		expect(result.event).toBeDefined();
		expect(typeof result.event).toBe("function");
	});
});
