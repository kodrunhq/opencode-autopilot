import { describe, expect, test } from "bun:test";
import { createCompactionHandler } from "../../src/context/compaction-handler";
import { createContextInjector } from "../../src/context/injector";
import type { ContextSource } from "../../src/context/types";

function createSource(name: string, content: string, priority: number): ContextSource {
	return {
		name,
		filePath: `/tmp/${name}`,
		content,
		priority,
		tokenEstimate: Math.ceil(content.length / 4),
	};
}

describe("createCompactionHandler", () => {
	test("clears session cache and rewarms context on compaction", async () => {
		let discoverCalls = 0;
		const injector = createContextInjector({
			projectRoot: "/tmp/project",
			discover: async () => {
				discoverCalls += 1;
				return [createSource("AGENTS.md", "agent guidance", 90)];
			},
		});
		const handler = createCompactionHandler(injector);

		await injector({ sessionID: "sess-1" }, { system: [] });
		expect(discoverCalls).toBe(1);

		await handler({
			event: { type: "session.compacted", properties: { sessionID: "sess-1" } },
		});
		expect(discoverCalls).toBe(2);

		await injector({ sessionID: "sess-1" }, { system: [] });
		expect(discoverCalls).toBe(2);
	});

	test("ignores non-compaction events and compaction failures", async () => {
		const injector = createContextInjector({
			projectRoot: "/tmp/project",
			discover: async () => {
				throw new Error("boom");
			},
		});
		const handler = createCompactionHandler(injector);

		await expect(
			handler({ event: { type: "session.created", properties: { sessionID: "sess-1" } } }),
		).resolves.toBeUndefined();
		await expect(
			handler({ event: { type: "session.compacted", properties: { sessionID: "sess-1" } } }),
		).resolves.toBeUndefined();
	});
});
