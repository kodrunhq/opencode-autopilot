import { describe, expect, test } from "bun:test";
import { resolveChain } from "../../src/orchestrator/fallback/resolve-chain";

describe("resolveChain", () => {
	test("returns per-agent fallback_models array when set", () => {
		const result = resolveChain(
			"oc-researcher",
			{ "oc-researcher": { fallback_models: ["model-a", "model-b"] } },
			undefined,
		);
		expect(result).toEqual(["model-a", "model-b"]);
	});

	test("normalizes per-agent single string to array", () => {
		const result = resolveChain(
			"oc-researcher",
			{ "oc-researcher": { fallback_models: "model-a" } },
			undefined,
		);
		expect(result).toEqual(["model-a"]);
	});

	test("falls back to global fallback_models array when per-agent not set", () => {
		const result = resolveChain("oc-researcher", {}, ["global-a"]);
		expect(result).toEqual(["global-a"]);
	});

	test("normalizes global single string to array", () => {
		const result = resolveChain("oc-researcher", {}, "global-a");
		expect(result).toEqual(["global-a"]);
	});

	test("returns empty array when neither per-agent nor global exist", () => {
		const result = resolveChain("oc-researcher", undefined, undefined);
		expect(result).toEqual([]);
	});

	test("per-agent takes priority over global (tier 1 > tier 2)", () => {
		const result = resolveChain(
			"oc-researcher",
			{ "oc-researcher": { fallback_models: ["per-agent"] } },
			["global"],
		);
		expect(result).toEqual(["per-agent"]);
	});

	test("returns empty array when agent exists but has no fallback_models", () => {
		const result = resolveChain(
			"oc-researcher",
			{ "oc-researcher": { model: "some-model" } },
			undefined,
		);
		expect(result).toEqual([]);
	});

	test("returns global when agent name not found in configs", () => {
		const result = resolveChain(
			"oc-researcher",
			{ "oc-builder": { fallback_models: ["builder-model"] } },
			["global-fallback"],
		);
		expect(result).toEqual(["global-fallback"]);
	});

	test("returns a copy of per-agent array (no mutation)", () => {
		const original = ["model-a", "model-b"];
		const configs = { "oc-researcher": { fallback_models: original } };
		const result = resolveChain("oc-researcher", configs, undefined);
		expect(result).toEqual(original);
		expect(result).not.toBe(original);
	});

	test("returns a copy of global array (no mutation)", () => {
		const original = ["global-a", "global-b"];
		const result = resolveChain("oc-researcher", undefined, original);
		expect(result).toEqual(original);
		expect(result).not.toBe(original);
	});

	test("filters non-string elements from per-agent array", () => {
		const result = resolveChain(
			"agent-a",
			{ "agent-a": { fallback_models: [42, null, "valid-model", "", true] as any } },
			undefined,
		);
		expect(result).toEqual(["valid-model"]);
	});

	test("filters non-string elements from global array", () => {
		const result = resolveChain("agent-a", undefined, [42, null, "global-model"] as any);
		expect(result).toEqual(["global-model"]);
	});

	test("falls through to global when per-agent fallback_models is a number", () => {
		const result = resolveChain("agent-a", { "agent-a": { fallback_models: 42 } as any }, [
			"global-fallback",
		]);
		expect(result).toEqual(["global-fallback"]);
	});

	test("falls through to global when per-agent fallback_models is boolean true", () => {
		const result = resolveChain("agent-a", { "agent-a": { fallback_models: true } as any }, [
			"global-fallback",
		]);
		expect(result).toEqual(["global-fallback"]);
	});

	test("empty agentName skips tier 1 and uses global", () => {
		const result = resolveChain("", { "oc-researcher": { fallback_models: ["per-agent"] } }, [
			"global",
		]);
		expect(result).toEqual(["global"]);
	});
});
