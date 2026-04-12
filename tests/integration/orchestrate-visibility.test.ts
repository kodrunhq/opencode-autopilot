import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { orchestrateCore } from "../../src/tools/orchestrate";
import { createToolVisibilityProjectionHandler } from "../../src/ux/visibility";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "orchestrate-visibility-integration-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("orchestrate visibility projection", () => {
	test("summary mode replaces raw orchestrate envelope with curated operator text", async () => {
		const rawOutput = await orchestrateCore(
			{ idea: "build a chat", intent: "implementation" },
			tempDir,
		);
		const output = { title: "oc_orchestrate", output: rawOutput, metadata: null };

		createToolVisibilityProjectionHandler({ visibilityMode: "summary" })(
			{ tool: "oc_orchestrate", sessionID: "session-1", callID: "call-1", args: {} },
			output,
		);

		expect(output.output).toContain("[1/8]");
		expect(output.output).not.toContain('"action"');
		expect(output.output).not.toContain('"prompt"');
	});
});
