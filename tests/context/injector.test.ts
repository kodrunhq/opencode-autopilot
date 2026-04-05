import { describe, expect, test } from "bun:test";
import { createContextInjector } from "../../src/context/injector";
import type { ContextSource } from "../../src/context/types";

function createSource(
	name: string,
	content: string,
	priority: number,
	tokenEstimate: number = Math.ceil(content.length / 4),
): ContextSource {
	return {
		name,
		filePath: `/tmp/${name}`,
		content,
		priority,
		tokenEstimate,
	};
}

describe("createContextInjector", () => {
	test("composes discovered sources into injected system text", async () => {
		const injector = createContextInjector({
			projectRoot: "/tmp/project",
			discover: async () => [
				createSource("AGENTS.md", "agent guidance", 90),
				createSource("README.md", "project overview", 50),
			],
		});

		const output = { system: ["existing"] };
		await injector({ sessionID: "sess-1" }, output);

		expect(output.system).toHaveLength(2);
		expect(output.system[1]).toContain("[Source: AGENTS.md]");
		expect(output.system[1]).toContain("agent guidance");
		expect(output.system[1]).toContain("[Source: README.md]");
	});

	test("caches injected context per session until the ttl expires", async () => {
		let discoverCalls = 0;
		let currentTime = 100;
		const injector = createContextInjector({
			projectRoot: "/tmp/project",
			ttlMs: 1000,
			now: () => currentTime,
			discover: async () => {
				discoverCalls += 1;
				return [createSource("AGENTS.md", "agent guidance", 90)];
			},
		});

		await injector({ sessionID: "sess-1" }, { system: [] });
		await injector({ sessionID: "sess-1" }, { system: [] });
		expect(discoverCalls).toBe(1);

		currentTime = 1200;
		await injector({ sessionID: "sess-1" }, { system: [] });
		expect(discoverCalls).toBe(2);
	});

	test("swallows discovery failures without mutating output", async () => {
		const injector = createContextInjector({
			projectRoot: "/tmp/project",
			discover: async () => {
				throw new Error("boom");
			},
		});

		const output = { system: ["existing"] };
		await injector({ sessionID: "sess-1" }, output);

		expect(output.system).toEqual(["existing"]);
	});
});
