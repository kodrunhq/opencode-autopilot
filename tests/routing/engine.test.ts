import { describe, expect, test } from "bun:test";
import { makeRoutingDecision } from "../../src/routing";
import type { RoutingConfig } from "../../src/types/routing";

describe("makeRoutingDecision", () => {
	test("uses default category configuration when no overrides exist", () => {
		const result = makeRoutingDecision("write API documentation");
		expect(result.category).toBe("writing");
		expect(result.appliedConfig?.modelGroup).toBe("communicators");
		expect(result.appliedConfig?.skills).toContain("coding-standards");
	});

	test("respects category config overrides", () => {
		const config: RoutingConfig = {
			enabled: true,
			categories: {
				writing: {
					enabled: true,
					agentId: "coder",
					modelGroup: "utilities",
					timeoutSeconds: 90,
					skills: ["coding-standards", "custom-docs"],
					metadata: { source: "test" },
				},
			},
		};

		const result = makeRoutingDecision("write API documentation", config);
		expect(result.category).toBe("writing");
		expect(result.agentId).toBe("coder");
		expect(result.appliedConfig?.modelGroup).toBe("utilities");
		expect(result.appliedConfig?.timeoutSeconds).toBe(90);
		expect(result.appliedConfig?.skills).toEqual(["coding-standards", "custom-docs"]);
	});

	test("falls back to unspecified-low when the classified category is disabled", () => {
		const config: RoutingConfig = {
			enabled: true,
			categories: {
				writing: {
					enabled: false,
					skills: [],
					metadata: {},
				},
			},
		};

		const result = makeRoutingDecision("write API documentation", config);
		expect(result.category).toBe("unspecified-low");
		expect(result.reasoning).toContain("fell back to unspecified-low");
		expect(result.appliedConfig?.modelGroup).toBe("utilities");
	});
});
