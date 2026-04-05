// tests/registry/resolver.test.ts
import { describe, expect, test } from "bun:test";
import {
	DEPRECATED_AGENT_REMAP,
	extractFamily,
	resolveModelForAgent,
	resolveModelForGroup,
} from "../../src/registry/resolver";
import type { AgentOverride, GroupModelAssignment } from "../../src/registry/types";

describe("extractFamily", () => {
	test("extracts provider from model string", () => {
		expect(extractFamily("anthropic/claude-opus-4-6")).toBe("anthropic");
	});

	test("extracts provider with multiple slashes", () => {
		expect(extractFamily("openai/gpt-5.4")).toBe("openai");
	});

	test("returns full string when no slash", () => {
		expect(extractFamily("claude-opus")).toBe("claude-opus");
	});

	test("returns empty string for slash-only", () => {
		expect(extractFamily("/model")).toBe("");
	});

	test("returns empty string for empty input", () => {
		expect(extractFamily("")).toBe("");
	});
});

describe("resolveModelForAgent", () => {
	const groups: Record<string, GroupModelAssignment> = {
		architects: { primary: "anthropic/claude-opus-4-6", fallbacks: ["openai/gpt-5.4"] },
		utilities: { primary: "anthropic/claude-haiku-4-5", fallbacks: [] },
	};

	const overrides: Record<string, AgentOverride> = {
		"oc-planner": { primary: "openai/gpt-5.4", fallbacks: ["google/gemini-3.1-pro"] },
	};

	test("returns override when agent has per-agent override", () => {
		const result = resolveModelForAgent("oc-planner", groups, overrides);
		expect(result).not.toBeNull();
		expect(result?.primary).toBe("openai/gpt-5.4");
		expect(result?.fallbacks).toEqual(["google/gemini-3.1-pro"]);
		expect(result?.source).toBe("override");
	});

	test("override takes precedence over group", () => {
		// oc-planner is in architects group, but has an override
		const result = resolveModelForAgent("oc-planner", groups, overrides);
		expect(result?.primary).toBe("openai/gpt-5.4"); // override, not architects
	});

	test("returns group primary when no override exists", () => {
		const result = resolveModelForAgent("oc-architect", groups, {});
		expect(result).not.toBeNull();
		expect(result?.primary).toBe("anthropic/claude-opus-4-6");
		expect(result?.fallbacks).toEqual(["openai/gpt-5.4"]);
		expect(result?.source).toBe("group");
	});

	test("returns null for unknown agent", () => {
		const result = resolveModelForAgent("nonexistent-agent", groups, {});
		expect(result).toBeNull();
	});

	test("returns null for known agent with no group assignment", () => {
		// oc-implementer is in builders group, but builders not in groups
		const result = resolveModelForAgent("oc-implementer", groups, {});
		expect(result).toBeNull();
	});

	test("override without fallbacks returns empty fallbacks array", () => {
		const overridesNoFallback: Record<string, AgentOverride> = {
			autopilot: { primary: "google/gemini-3.1-pro" },
		};
		const result = resolveModelForAgent("autopilot", groups, overridesNoFallback);
		expect(result?.fallbacks).toEqual([]);
	});

	test("override fallbacks replace group fallbacks entirely", () => {
		const groupsWithFallbacks: Record<string, GroupModelAssignment> = {
			architects: { primary: "anthropic/claude-opus-4-6", fallbacks: ["google/gemini-3.1-pro"] },
		};
		const overridesWithFallbacks: Record<string, AgentOverride> = {
			"oc-architect": { primary: "openai/gpt-5.4", fallbacks: ["xai/grok-3"] },
		};
		const result = resolveModelForAgent(
			"oc-architect",
			groupsWithFallbacks,
			overridesWithFallbacks,
		);
		expect(result?.fallbacks).toEqual(["xai/grok-3"]);
	});
});

describe("resolveModelForGroup", () => {
	const groups: Record<string, GroupModelAssignment> = {
		reviewers: { primary: "openai/gpt-5.4", fallbacks: ["google/gemini-3.1-pro"] },
	};

	test("returns assignment for existing group", () => {
		const result = resolveModelForGroup("reviewers", groups);
		expect(result).not.toBeNull();
		expect(result?.primary).toBe("openai/gpt-5.4");
		expect(result?.fallbacks).toEqual(["google/gemini-3.1-pro"]);
		expect(result?.source).toBe("group");
	});

	test("returns null for missing group", () => {
		const result = resolveModelForGroup("architects", groups);
		expect(result).toBeNull();
	});
});

describe("DEPRECATED_AGENT_REMAP", () => {
	const groups: Record<string, GroupModelAssignment> = {
		builders: { primary: "anthropic/claude-opus-4-6", fallbacks: ["openai/gpt-5.4"] },
		researchers: { primary: "google/gemini-3.1-pro", fallbacks: [] },
		communicators: { primary: "anthropic/claude-haiku-4-5", fallbacks: [] },
	};

	test("maps deprecated agent names to their replacements", () => {
		expect(DEPRECATED_AGENT_REMAP.documenter).toBe("coder");
		expect(DEPRECATED_AGENT_REMAP.devops).toBe("coder");
		expect(DEPRECATED_AGENT_REMAP["frontend-engineer"]).toBe("coder");
		expect(DEPRECATED_AGENT_REMAP["db-specialist"]).toBe("coder");
		expect(DEPRECATED_AGENT_REMAP["oc-explorer"]).toBe("oc-researcher");
		expect(DEPRECATED_AGENT_REMAP["oc-retrospector"]).toBe("oc-shipper");
	});

	test("deprecated agents resolve via remap to new agent's group", () => {
		const result = resolveModelForAgent("documenter", groups, {});
		expect(result).not.toBeNull();
		expect(result?.primary).toBe("anthropic/claude-opus-4-6");
		expect(result?.source).toBe("group");
	});

	test("deprecated agent override on new name takes precedence over group", () => {
		const overrides: Record<string, AgentOverride> = {
			coder: { primary: "xai/grok-3", fallbacks: [] },
		};
		const result = resolveModelForAgent("documenter", groups, overrides);
		expect(result).not.toBeNull();
		expect(result?.primary).toBe("xai/grok-3");
		expect(result?.source).toBe("override");
	});

	test("deprecated agent direct override takes precedence over remap", () => {
		const overrides: Record<string, AgentOverride> = {
			documenter: { primary: "openai/gpt-5.4", fallbacks: [] },
			coder: { primary: "xai/grok-3", fallbacks: [] },
		};
		const result = resolveModelForAgent("documenter", groups, overrides);
		expect(result).not.toBeNull();
		expect(result?.primary).toBe("openai/gpt-5.4");
		expect(result?.source).toBe("override");
	});

	test("oc-explorer resolves via remap to oc-researcher group", () => {
		const result = resolveModelForAgent("oc-explorer", groups, {});
		expect(result).not.toBeNull();
		expect(result?.primary).toBe("google/gemini-3.1-pro");
		expect(result?.source).toBe("group");
	});

	test("oc-retrospector resolves via remap to oc-shipper group", () => {
		const result = resolveModelForAgent("oc-retrospector", groups, {});
		expect(result).not.toBeNull();
		expect(result?.primary).toBe("anthropic/claude-haiku-4-5");
		expect(result?.source).toBe("group");
	});
});
