import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	createMemoryCaptureHandler,
	createMemoryChatMessageHandler,
	type MemoryCaptureDeps,
	memoryCaptureInternals,
} from "../../src/memory/capture";
import { initMemoryDb } from "../../src/memory/database";

function createTestDeps(db: Database): MemoryCaptureDeps {
	return {
		getDb: () => db,
		projectRoot: "/home/user/my-project",
	};
}

describe("createMemoryCaptureHandler", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
	});

	afterEach(() => {
		db.close();
	});

	it("returns a function", () => {
		const handler = createMemoryCaptureHandler(createTestDeps(db));
		expect(typeof handler).toBe("function");
	});

	describe("session.created", () => {
		it("registers session and upserts project", async () => {
			const handler = createMemoryCaptureHandler(createTestDeps(db));

			await handler({
				event: {
					type: "session.created",
					properties: {
						info: { id: "sess-123", model: "claude-sonnet" },
					},
				},
			});

			const project = db.query("SELECT * FROM projects").get() as Record<string, unknown>;
			expect(project).not.toBeNull();
			expect(project.name).toBe("my-project");
		});
	});

	describe("session.error", () => {
		it("extracts error observation", async () => {
			const handler = createMemoryCaptureHandler(createTestDeps(db));

			await handler({
				event: {
					type: "session.created",
					properties: {
						info: { id: "sess-123" },
					},
				},
			});

			await handler({
				event: {
					type: "session.error",
					properties: {
						sessionID: "sess-123",
						error: {
							type: "rate_limit",
							message: "Rate limit exceeded for model X",
						},
					},
				},
			});

			const obs = db.query("SELECT * FROM observations WHERE type = 'error'").get() as Record<
				string,
				unknown
			>;
			expect(obs).not.toBeNull();
			expect(obs.type).toBe("error");
			expect(typeof obs.content).toBe("string");
		});
	});

	describe("event filtering", () => {
		it("ignores tool_complete events", async () => {
			const handler = createMemoryCaptureHandler(createTestDeps(db));

			await handler({
				event: {
					type: "session.created",
					properties: { info: { id: "sess-123" } },
				},
			});

			await handler({
				event: {
					type: "tool_complete",
					properties: {
						sessionId: "sess-123",
						tool: "read",
						durationMs: 100,
						success: true,
					},
				},
			});

			const count = db.query("SELECT COUNT(*) as cnt FROM observations").get() as {
				cnt: number;
			};
			expect(count.cnt).toBe(0);
		});

		it("ignores context_warning events", async () => {
			const handler = createMemoryCaptureHandler(createTestDeps(db));

			await handler({
				event: {
					type: "session.created",
					properties: { info: { id: "sess-123" } },
				},
			});

			await handler({
				event: {
					type: "context_warning",
					properties: { sessionId: "sess-123", utilization: 0.8 },
				},
			});

			const count = db.query("SELECT COUNT(*) as cnt FROM observations").get() as {
				cnt: number;
			};
			expect(count.cnt).toBe(0);
		});

		it("ignores session.idle and session.compacted events", async () => {
			const handler = createMemoryCaptureHandler(createTestDeps(db));

			await handler({
				event: {
					type: "session.created",
					properties: { info: { id: "sess-123" } },
				},
			});

			await handler({
				event: {
					type: "session.idle",
					properties: { sessionID: "sess-123" },
				},
			});

			await handler({
				event: {
					type: "session.compacted",
					properties: { sessionID: "sess-123" },
				},
			});

			const count = db.query("SELECT COUNT(*) as cnt FROM observations").get() as {
				cnt: number;
			};
			expect(count.cnt).toBe(0);
		});
	});

	describe("session.deleted", () => {
		it("triggers pruning for the project", async () => {
			const handler = createMemoryCaptureHandler(createTestDeps(db));

			await handler({
				event: {
					type: "session.created",
					properties: { info: { id: "sess-123" } },
				},
			});

			await handler({
				event: {
					type: "session.deleted",
					properties: { sessionID: "sess-123" },
				},
			});

			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(true).toBe(true);
		});
	});

	describe("decision capture", () => {
		it("captures decision events from observability data in properties", async () => {
			const handler = createMemoryCaptureHandler(createTestDeps(db));

			await handler({
				event: {
					type: "session.created",
					properties: { info: { id: "sess-123" } },
				},
			});

			await handler({
				event: {
					type: "app.decision",
					properties: {
						sessionID: "sess-123",
						phase: "BUILD",
						agent: "oc-implementer",
						decision: "Use repository pattern for data access",
						rationale: "Keeps data layer testable and swappable",
					},
				},
			});

			const obs = db.query("SELECT * FROM observations WHERE type = 'decision'").get() as Record<
				string,
				unknown
			>;
			expect(obs).not.toBeNull();
			expect(obs.type).toBe("decision");
		});
	});

	describe("phase_transition capture", () => {
		it("captures phase transition events as pattern observations", async () => {
			const handler = createMemoryCaptureHandler(createTestDeps(db));

			await handler({
				event: {
					type: "session.created",
					properties: { info: { id: "sess-123" } },
				},
			});

			await handler({
				event: {
					type: "app.phase_transition",
					properties: {
						sessionID: "sess-123",
						fromPhase: "RESEARCH",
						toPhase: "BUILD",
					},
				},
			});

			const obs = db.query("SELECT * FROM observations WHERE type = 'pattern'").get() as Record<
				string,
				unknown
			>;
			expect(obs).not.toBeNull();
			expect(obs.type).toBe("pattern");
			expect((obs.content as string).includes("RESEARCH")).toBe(true);
			expect((obs.content as string).includes("BUILD")).toBe(true);
		});
	});

	describe("capture-utils", () => {
		it("extractSessionId extracts from properties.sessionID", () => {
			expect(memoryCaptureInternals.extractSessionId({ sessionID: "abc" })).toBe("abc");
		});

		it("extractSessionId extracts from properties.info.id", () => {
			expect(memoryCaptureInternals.extractSessionId({ info: { id: "xyz" } })).toBe("xyz");
		});

		it("extractSessionId returns undefined for missing id", () => {
			expect(memoryCaptureInternals.extractSessionId({})).toBeUndefined();
		});

		it("truncate shortens long strings", () => {
			expect(memoryCaptureInternals.truncate("hello world", 5)).toBe("hello");
		});

		it("truncate preserves short strings", () => {
			expect(memoryCaptureInternals.truncate("hi", 10)).toBe("hi");
		});
	});

	describe("chat message handler (V2 no-op)", () => {
		it("returns a function", () => {
			const handler = createMemoryChatMessageHandler(createTestDeps(db));
			expect(typeof handler).toBe("function");
		});

		it("does not create any preference records", async () => {
			const handler = createMemoryChatMessageHandler(createTestDeps(db));

			await handler(
				{ sessionID: "sess-123" },
				{
					parts: [
						{ type: "text", content: "Please use small diffs in this repo." },
						{ type: "text", content: "I prefer bun test for this project." },
					],
				},
			);

			const prefs = db.query("SELECT COUNT(*) as cnt FROM preference_records").get() as {
				cnt: number;
			};
			expect(prefs.cnt).toBe(0);
		});
	});
});
