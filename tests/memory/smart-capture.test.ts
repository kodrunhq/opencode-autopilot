import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createMemoryChatMessageHandler, type MemoryCaptureDeps } from "../../src/memory/capture";
import { extractExplicitPreferences, extractToolDecisions } from "../../src/memory/capture-utils";
import { initMemoryDb } from "../../src/memory/database";

function createTestDeps(db: Database): MemoryCaptureDeps {
	return {
		getDb: () => db,
		projectRoot: "/home/user/my-project",
	};
}

describe("extractToolDecisions", () => {
	test("returns empty for non-tool parts", () => {
		const extracted = extractToolDecisions([
			{ type: "text", text: "I prefer Bun for tests." },
			{ type: "text", content: "No tool activity here." },
		]);

		expect(extracted).toEqual([]);
	});

	test("extracts config and setup tool decisions", () => {
		const extracted = extractToolDecisions([
			{
				type: "tool-invocation",
				toolName: "project_configure",
				result: "Configured Bun as the project test runner.",
			},
			{
				type: "tool_result",
				tool: { name: "setup_workspace" },
				result: { summary: "Initialized workspace settings for CI." },
			},
		]);

		expect(extracted).toHaveLength(2);
		expect(extracted[0]).toMatchObject({
			kind: "decision",
			confidence: 0.86,
		});
		expect(extracted[0]?.content).toContain("project_configure");
		expect(extracted[0]?.content).toContain("Configured Bun as the project test runner.");
		expect(extracted[1]?.content).toContain("setup_workspace");
	});

	test("skips read grep and search tools", () => {
		const extracted = extractToolDecisions([
			{
				type: "tool-invocation",
				toolName: "read_file",
				result: "Read package.json",
			},
			{
				type: "tool_result",
				toolName: "grep_content",
				result: "Matched 3 lines",
			},
			{
				type: "tool_result",
				toolName: "search_repo",
				result: "Found 12 matches",
			},
		]);

		expect(extracted).toEqual([]);
	});
});

describe("extractExplicitPreferences", () => {
	test("extracts I prefer patterns", () => {
		const extracted = extractExplicitPreferences([
			{ type: "text", text: "For this project, I prefer small focused diffs." },
		]);

		expect(extracted).toHaveLength(1);
		expect(extracted[0]).toMatchObject({
			kind: "preference",
			content: "For this project, I prefer small focused diffs.",
			confidence: 0.92,
		});
	});

	test("extracts Always use patterns", () => {
		const extracted = extractExplicitPreferences([
			{ type: "text", content: "Always use bun test before opening a PR." },
		]);

		expect(extracted).toHaveLength(1);
		expect(extracted[0]?.content).toBe("Always use bun test before opening a PR.");
	});

	test("returns empty for no preference language", () => {
		const extracted = extractExplicitPreferences([
			{ type: "text", text: "The test suite passed after the migration." },
		]);

		expect(extracted).toEqual([]);
	});

	test("matches preference language case-insensitively", () => {
		const extracted = extractExplicitPreferences([
			{ type: "text", text: "my preference is to keep setup scripts idempotent." },
			{ type: "text", text: "NEVER USE force push on main." },
		]);

		expect(extracted).toHaveLength(2);
		expect(extracted[0]?.content).toBe("my preference is to keep setup scripts idempotent.");
		expect(extracted[1]?.content).toBe("NEVER USE force push on main.");
	});
});

describe("createMemoryChatMessageHandler", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
	});

	afterEach(() => {
		db.close();
	});

	test("processes assistant parts and saves extracted memories", async () => {
		const handler = createMemoryChatMessageHandler(createTestDeps(db));

		await handler(
			{ sessionID: "sess-123" },
			{
				parts: [
					{
						type: "tool_result",
						toolName: "setup_workspace",
						result: "Enabled Bun-based test workflow.",
					},
					{ type: "text", text: "I prefer small focused diffs." },
				],
			},
		);

		const memories = db
			.query("SELECT kind, content, source_session FROM memories ORDER BY id ASC")
			.all() as Array<{ kind: string; content: string; source_session: string | null }>;

		expect(memories).toHaveLength(2);
		expect(memories[0]).toMatchObject({
			kind: "decision",
			source_session: "sess-123",
		});
		expect(memories[0]?.content).toContain("setup_workspace");
		expect(memories[1]).toMatchObject({
			kind: "preference",
			source_session: "sess-123",
		});
		expect(memories[1]?.content).toBe("I prefer small focused diffs.");
	});
});
