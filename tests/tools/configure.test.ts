import { beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ALL_GROUP_IDS } from "../../src/registry/model-groups";
import {
	configureCore,
	resetPendingAssignments,
	setAvailableProviders,
} from "../../src/tools/configure";

// Reset state before each test
beforeEach(() => {
	resetPendingAssignments();
});

describe("configureCore start", () => {
	test("returns group definitions and diversity rules", async () => {
		const result = JSON.parse(await configureCore({ subcommand: "start" }));
		expect(result.action).toBe("configure");
		expect(result.stage).toBe("start");
		expect(result.groups).toHaveLength(ALL_GROUP_IDS.length);
		expect(result.diversityRules).toHaveLength(3);
	});

	test("groups include agents derived from AGENT_REGISTRY", async () => {
		const result = JSON.parse(await configureCore({ subcommand: "start" }));
		const architects = result.groups.find((g: { id: string }) => g.id === "architects");
		expect(architects).toBeDefined();
		expect(architects.agents).toContain("oc-architect");
		expect(architects.agents).toContain("oc-planner");
		expect(architects.agents).toContain("autopilot");
	});
});

describe("configureCore assign", () => {
	test("validates group is a valid GroupId", async () => {
		const result = JSON.parse(
			await configureCore({
				subcommand: "assign",
				group: "invalid-group",
				primary: "anthropic/claude-opus-4-6",
			}),
		);
		expect(result.action).toBe("error");
	});

	test("requires primary model", async () => {
		const result = JSON.parse(await configureCore({ subcommand: "assign", group: "architects" }));
		expect(result.action).toBe("error");
	});

	test("stores assignment and returns success", async () => {
		const result = JSON.parse(
			await configureCore({
				subcommand: "assign",
				group: "architects",
				primary: "anthropic/claude-opus-4-6",
				fallbacks: "openai/gpt-5.4",
			}),
		);
		expect(result.action).toBe("configure");
		expect(result.stage).toBe("assigned");
		expect(result.group).toBe("architects");
		expect(result.primary).toBe("anthropic/claude-opus-4-6");
		expect(result.fallbacks).toEqual(["openai/gpt-5.4"]);
		expect(result.assignedCount).toBe(1);
		expect(result.totalGroups).toBe(ALL_GROUP_IDS.length);
	});

	test("returns diversity warnings when applicable", async () => {
		await configureCore({
			subcommand: "assign",
			group: "architects",
			primary: "anthropic/claude-opus-4-6",
		});
		const result = JSON.parse(
			await configureCore({
				subcommand: "assign",
				group: "challengers",
				primary: "anthropic/claude-sonnet-4-6", // same family
			}),
		);
		expect(result.diversityWarnings.length).toBeGreaterThan(0);
		expect(result.diversityWarnings[0].severity).toBe("strong");
	});

	test("no warnings when different families", async () => {
		await configureCore({
			subcommand: "assign",
			group: "architects",
			primary: "anthropic/claude-opus-4-6",
		});
		const result = JSON.parse(
			await configureCore({
				subcommand: "assign",
				group: "challengers",
				primary: "openai/gpt-5.4",
			}),
		);
		expect(result.diversityWarnings).toHaveLength(0);
	});
});

describe("configureCore commit", () => {
	test("fails if not all groups assigned", async () => {
		await configureCore({
			subcommand: "assign",
			group: "architects",
			primary: "anthropic/claude-opus-4-6",
		});
		const result = JSON.parse(await configureCore({ subcommand: "commit" }));
		expect(result.action).toBe("error");
		expect(result.message).toContain("missing");
	});

	test("succeeds when all groups assigned", async () => {
		// Use a temp dir for config so we don't write to the real config
		const tempDir = join(tmpdir(), `configure-commit-test-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "opencode-autopilot.json");

		for (const groupId of ALL_GROUP_IDS) {
			await configureCore({
				subcommand: "assign",
				group: groupId,
				primary: "anthropic/claude-opus-4-6",
			});
		}
		const result = JSON.parse(await configureCore({ subcommand: "commit" }, configPath));
		expect(result.action).toBe("configure");
		expect(result.stage).toBe("committed");
		expect(Object.keys(result.groups)).toHaveLength(ALL_GROUP_IDS.length);

		await rm(tempDir, { recursive: true, force: true });
	});
});

describe("configureCore reset", () => {
	test("clears pending assignments", async () => {
		await configureCore({
			subcommand: "assign",
			group: "architects",
			primary: "anthropic/claude-opus-4-6",
		});
		const resetResult = JSON.parse(await configureCore({ subcommand: "reset" }));
		expect(resetResult.stage).toBe("reset");

		// After reset, commit should fail (no assignments)
		const commitResult = JSON.parse(await configureCore({ subcommand: "commit" }));
		expect(commitResult.action).toBe("error");
	});
});

describe("configureCore edge cases", () => {
	test("returns error for unknown subcommand", async () => {
		const result = JSON.parse(await configureCore({ subcommand: "invalid" as unknown }));
		expect(result.action).toBe("error");
	});

	test("rejects empty-string primary", async () => {
		const result = JSON.parse(
			await configureCore({ subcommand: "assign", group: "architects", primary: "" }),
		);
		expect(result.action).toBe("error");
	});

	test("rejects whitespace-only primary", async () => {
		const result = JSON.parse(
			await configureCore({ subcommand: "assign", group: "architects", primary: "   " }),
		);
		expect(result.action).toBe("error");
	});

	test("parses multiple comma-separated fallbacks", async () => {
		const result = JSON.parse(
			await configureCore({
				subcommand: "assign",
				group: "architects",
				primary: "anthropic/claude-opus-4-6",
				fallbacks: "openai/gpt-5.4, google/gemini-3.1-pro",
			}),
		);
		expect(result.fallbacks).toEqual(["openai/gpt-5.4", "google/gemini-3.1-pro"]);
	});

	test("handles trailing comma in fallbacks", async () => {
		const result = JSON.parse(
			await configureCore({
				subcommand: "assign",
				group: "architects",
				primary: "anthropic/claude-opus-4-6",
				fallbacks: "openai/gpt-5.4,",
			}),
		);
		expect(result.fallbacks).toEqual(["openai/gpt-5.4"]);
	});

	test("second assign to same group overwrites first", async () => {
		await configureCore({
			subcommand: "assign",
			group: "architects",
			primary: "anthropic/claude-opus-4-6",
		});
		const result = JSON.parse(
			await configureCore({
				subcommand: "assign",
				group: "architects",
				primary: "openai/gpt-5.4",
			}),
		);
		expect(result.primary).toBe("openai/gpt-5.4");
		expect(result.assignedCount).toBe(1);
	});

	test("start with availableProviders discovers available models", async () => {
		setAvailableProviders([
			{
				id: "anthropic",
				name: "Anthropic",
				models: {
					"claude-opus-4-6": { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
					"claude-sonnet-4-6": { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
				},
			},
			{
				id: "openai",
				name: "OpenAI",
				models: {
					"gpt-5.4": { id: "gpt-5.4", name: "GPT-5.4" },
				},
			},
		]);

		const result = JSON.parse(await configureCore({ subcommand: "start" }));

		// availableModels is NOT included — redundant with displayText/modelIndex
		// and caused 400KB+ responses that OpenCode truncated
		expect(result.availableModels).toBeUndefined();

		// modelIndex maps numbers to model IDs
		expect(result.modelIndex).toBeDefined();
		expect(Object.keys(result.modelIndex).length).toBe(3);
		expect(Object.values(result.modelIndex)).toContain("anthropic/claude-opus-4-6");
		expect(Object.values(result.modelIndex)).toContain("openai/gpt-5.4");

		// displayText is a pre-formatted numbered list
		expect(result.displayText).toContain("Available models (3 total)");
		expect(result.displayText).toContain("anthropic/claude-opus-4-6");
		expect(result.displayText).toContain("openai/gpt-5.4");

		// groups are compact (no tier/order fields)
		expect(result.groups[0].id).toBeDefined();
		expect(result.groups[0].purpose).toBeDefined();
		expect(result.groups[0].tier).toBeUndefined();

		// diversityRules are compact (no full rule objects)
		expect(result.diversityRules[0].groups).toBeDefined();
		expect(result.diversityRules[0].reason).toBeDefined();
		// cleanup handled by beforeEach → resetPendingAssignments() which also clears providers
	});
});

describe("configureCore Zen provider model discovery", () => {
	test("Zen provider models include sub-provider prefix in model IDs", async () => {
		setAvailableProviders([
			{
				id: "zen",
				name: "Zen",
				models: {
					"anthropic/claude-opus-4-6": {
						id: "anthropic/claude-opus-4-6",
						name: "Claude Opus 4.6",
					},
					"anthropic/claude-sonnet-4-6": {
						id: "anthropic/claude-sonnet-4-6",
						name: "Claude Sonnet 4.6",
					},
					"openai/gpt-5.4": { id: "openai/gpt-5.4", name: "GPT-5.4" },
				},
			},
		]);

		const result = JSON.parse(await configureCore({ subcommand: "start" }));

		// Zen models should include the full path: zen/anthropic/model
		expect(Object.values(result.modelIndex)).toContain("zen/anthropic/claude-opus-4-6");
		expect(Object.values(result.modelIndex)).toContain("zen/anthropic/claude-sonnet-4-6");
		expect(Object.values(result.modelIndex)).toContain("zen/openai/gpt-5.4");

		// displayText should show the full prefixed IDs
		expect(result.displayText).toContain("zen/anthropic/claude-opus-4-6");
		expect(result.displayText).toContain("zen/openai/gpt-5.4");
	});

	test("users can distinguish Go vs Zen providers for same model family", async () => {
		setAvailableProviders([
			{
				id: "anthropic",
				name: "Anthropic",
				models: {
					"claude-opus-4-6": { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
				},
			},
			{
				id: "zen",
				name: "Zen",
				models: {
					"anthropic/claude-opus-4-6": {
						id: "anthropic/claude-opus-4-6",
						name: "Claude Opus 4.6 (Zen)",
					},
				},
			},
		]);

		const result = JSON.parse(await configureCore({ subcommand: "start" }));
		const modelIds = Object.values(result.modelIndex) as string[];

		// Both providers should appear with distinct prefixes
		expect(modelIds).toContain("anthropic/claude-opus-4-6");
		expect(modelIds).toContain("zen/anthropic/claude-opus-4-6");

		// They should be different entries
		expect(Object.keys(result.modelIndex).length).toBe(2);
	});

	test("model id field takes precedence over record key for path construction", async () => {
		setAvailableProviders([
			{
				id: "zen",
				name: "Zen",
				models: {
					// Key might be simplified but id carries the full sub-provider path
					"claude-opus-4-6": {
						id: "anthropic/claude-opus-4-6",
						name: "Claude Opus 4.6",
					},
				},
			},
		]);

		const result = JSON.parse(await configureCore({ subcommand: "start" }));

		// Should use model.id (anthropic/claude-opus-4-6), not key (claude-opus-4-6)
		expect(Object.values(result.modelIndex)).toContain("zen/anthropic/claude-opus-4-6");
		// Should NOT have zen/claude-opus-4-6 (which would use the record key)
		expect(Object.values(result.modelIndex)).not.toContain("zen/claude-opus-4-6");
	});

	test("buildNumberedModelList sorts models alphabetically and preserves provider prefix", async () => {
		setAvailableProviders([
			{
				id: "zen",
				name: "Zen",
				models: {
					"openai/gpt-5.4": { id: "openai/gpt-5.4", name: "GPT-5.4" },
					"anthropic/claude-opus-4-6": {
						id: "anthropic/claude-opus-4-6",
						name: "Claude Opus 4.6",
					},
				},
			},
			{
				id: "anthropic",
				name: "Anthropic",
				models: {
					"claude-sonnet-4-6": { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
				},
			},
		]);

		const result = JSON.parse(await configureCore({ subcommand: "start" }));
		const modelIds = Object.values(result.modelIndex) as string[];

		// Models should be sorted alphabetically
		const sorted = [...modelIds].sort();
		expect(modelIds).toEqual(sorted);

		// All should have provider prefix
		for (const id of modelIds) {
			expect(id).toContain("/");
		}
	});

	test("falls back to record key when model id is empty", async () => {
		setAvailableProviders([
			{
				id: "local",
				name: "Local",
				models: {
					"llama-3.3": { id: "", name: "Llama 3.3" },
				},
			},
		]);

		const result = JSON.parse(await configureCore({ subcommand: "start" }));

		// Empty id should fall back to record key
		expect(Object.values(result.modelIndex)).toContain("local/llama-3.3");
	});
});

describe("configureCore doctor", () => {
	test("returns structured diagnostic report", async () => {
		const result = JSON.parse(await configureCore({ subcommand: "doctor" }));
		expect(result.action).toBe("configure");
		expect(result.stage).toBe("doctor");
		expect(result.checks).toBeDefined();
	});
});

describe("configureCore full flow", () => {
	test("full flow: start -> assign all groups -> commit -> doctor", async () => {
		const tempDir = join(tmpdir(), `configure-flow-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "opencode-autopilot.json");

		const startResult = JSON.parse(await configureCore({ subcommand: "start" }));
		expect(startResult.stage).toBe("start");

		const assignments = [
			["architects", "anthropic/claude-opus-4-6"],
			["challengers", "openai/gpt-5.4"],
			["builders", "anthropic/claude-sonnet-4-6"],
			["reviewers", "openai/gpt-5.4-mini"],
			["red-team", "google/gemini-3.1-pro"],
			["researchers", "anthropic/claude-haiku-4-5"],
			["communicators", "openai/gpt-5.4-mini"],
			["utilities", "anthropic/claude-haiku-4-5"],
		] as const;

		for (const [group, primary] of assignments) {
			await configureCore({ subcommand: "assign", group, primary });
		}

		const commitResult = JSON.parse(await configureCore({ subcommand: "commit" }, configPath));
		expect(commitResult.stage).toBe("committed");
		expect(Object.keys(commitResult.groups)).toHaveLength(ALL_GROUP_IDS.length);

		const doctorResult = JSON.parse(await configureCore({ subcommand: "doctor" }, configPath));
		expect(doctorResult.stage).toBe("doctor");
		expect(doctorResult.checks.configured).toBe(true);
		expect(doctorResult.allPassed).toBe(true);

		await rm(tempDir, { recursive: true, force: true });
	});
});
