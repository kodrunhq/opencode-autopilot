import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { configureCore, resetPendingAssignments } from "../../src/tools/configure";
import { ALL_GROUP_IDS } from "../../src/registry/model-groups";

// Reset state before each test
beforeEach(() => {
	resetPendingAssignments();
});

describe("configureCore start", () => {
	test("returns group definitions and diversity rules", async () => {
		const result = JSON.parse(await configureCore({ subcommand: "start" }));
		expect(result.action).toBe("configure");
		expect(result.stage).toBe("start");
		expect(result.groups).toHaveLength(8);
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
		const result = JSON.parse(
			await configureCore({ subcommand: "assign", group: "architects" }),
		);
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
		expect(result.totalGroups).toBe(8);
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

	test("succeeds when all 8 groups assigned", async () => {
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
		expect(Object.keys(result.groups)).toHaveLength(8);

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

describe("configureCore doctor", () => {
	test("returns structured diagnostic report", async () => {
		const result = JSON.parse(await configureCore({ subcommand: "doctor" }));
		expect(result.action).toBe("configure");
		expect(result.stage).toBe("doctor");
		expect(result.checks).toBeDefined();
	});
});
