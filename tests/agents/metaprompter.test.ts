import { describe, expect, test } from "bun:test";
import { metaprompterAgent } from "../../src/agents/metaprompter";

describe("metaprompter agent config", () => {
	test("mode is all", () => {
		expect(metaprompterAgent.mode).toBe("all");
	});

	test("has a non-empty description", () => {
		expect(typeof metaprompterAgent.description).toBe("string");
		expect(metaprompterAgent.description?.length).toBeGreaterThan(0);
	});

	test("has a production-ready prompt with at least 100 characters", () => {
		expect(typeof metaprompterAgent.prompt).toBe("string");
		expect(metaprompterAgent.prompt?.length).toBeGreaterThanOrEqual(100);
	});

	test("prompt references asset formats", () => {
		const prompt = (metaprompterAgent.prompt ?? "").toLowerCase();
		expect(prompt.includes("agent") || prompt.includes("skill") || prompt.includes("command")).toBe(
			true,
		);
	});

	test("permissions match D-08: edit=deny, bash=deny, webfetch=deny", () => {
		expect(metaprompterAgent.permission).toEqual({
			edit: "deny",
			bash: "deny",
			webfetch: "deny",
		});
	});
});
